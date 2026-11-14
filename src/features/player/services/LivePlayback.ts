import Hls from "hls.js";
import type { HlsConfig } from "hls.js";

export type PlaybackStatus = "loading" | "buffering" | "playing" | "paused" | "blocked" | "error";
export interface PlaybackSnapshot {
  status: PlaybackStatus;
  recovering: boolean;
  attempt: number;
  error: string;
  levels: Array<{ index: number; label: string }>;
  level: number;
  engine: "hls" | "native";
}

export const INITIAL_PLAYBACK: PlaybackSnapshot = {
  status: "loading", recovering: false, attempt: 0, error: "", levels: [], level: -1, engine: "hls",
};

export const STABLE_HLS_CONFIG: Partial<HlsConfig> = {
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 60,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  manifestLoadingTimeOut: 15000,
  manifestLoadingMaxRetry: 4,
  levelLoadingMaxRetry: 4,
  fragLoadingMaxRetry: 6,
};

interface PlaybackOptions {
  video: HTMLVideoElement;
  source: string;
  resolve?: (source: string, signal: AbortSignal) => Promise<string>;
  nativeUrl?: (source: string) => string;
  config?: Partial<HlsConfig>;
  onChange: (snapshot: PlaybackSnapshot) => void;
  log?: (message: string) => void;
  preferNative?: boolean;
  hlsClass?: typeof Hls;
}

/** One owner for video, requests, timers and listeners. Dispose before replacing it. */
export class LivePlayback {
  private hls: Hls | null = null;
  private abort = new AbortController();
  private disposed = false;
  private terminal = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private frameId: number | undefined;
  private listeners: Array<[string, EventListener]> = [];
  private lastProgress = Date.now();
  private healthySince = 0;
  private lastTime = -1;
  private attempts = 0;
  private mediaErrors = 0;
  private pausedByUser = false;
  private nativeTried = false;
  private source = "";
  private state = { ...INITIAL_PLAYBACK };

  private options: PlaybackOptions;
  constructor(options: PlaybackOptions) { this.options = options; }

  private update(patch: Partial<PlaybackSnapshot>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.options.onChange(this.state);
  }

  async start() {
    const { video, source, resolve } = this.options;
    this.listen("playing", () => {
      if (this.terminal) return;
      this.lastProgress = Date.now();
      this.update({ status: "playing", recovering: false, error: "" });
    });
    this.listen("timeupdate", () => {
      // Audio streams and browsers without requestVideoFrameCallback use media time.
      if (!video.requestVideoFrameCallback || video.videoWidth === 0) this.progress(video.currentTime);
    });
    for (const name of ["waiting", "stalled", "seeking"]) this.listen(name, () => {
      if (!this.pausedByUser && !this.terminal && this.state.status !== "blocked") {
        this.healthySince = 0;
        this.update({ status: "buffering" });
      }
    });
    this.listen("pause", () => {
      if (!this.terminal && this.pausedByUser) this.update({ status: "paused" });
    });
    this.listen("ended", () => this.reconnect("The live broadcast ended. The provider may be offline."));
    this.listen("loadedmetadata", () => { void this.play(); });
    this.listen("error", () => {
      if (!this.terminal && !this.hls) this.reconnect(
        video.error?.code === 4 ? "This device cannot decode the stream, or the provider refused it." : "The stream connection was interrupted.",
      );
    });
    const frame: VideoFrameRequestCallback = (_now, metadata) => {
      if (this.disposed || this.terminal) return;
      this.progress(metadata.mediaTime);
      this.frameId = video.requestVideoFrameCallback(frame);
    };
    if (video.requestVideoFrameCallback) this.frameId = video.requestVideoFrameCallback(frame);
    this.watchdog = setInterval(() => {
      if (this.disposed || this.terminal || !this.source || this.pausedByUser || this.state.status === "blocked") return;
      // Background tabs throttle frame callbacks; give them a fresh window on return.
      if (typeof document !== "undefined" && document.hidden) { this.lastProgress = Date.now(); return; }
      if (Date.now() - this.lastProgress >= 12000 && !this.retryTimer) {
        this.reconnect("No playback progress for 12 seconds. The provider may be unreachable.");
      }
    }, 1000);
    try {
      this.source = resolve ? await resolve(source, this.abort.signal) : source;
      if (this.disposed) return;
      this.lastProgress = Date.now();
      this.connect();
    } catch (error) {
      if (!this.disposed) this.fail(error instanceof Error ? error.message : "Could not resolve the stream.");
    }
  }

  private listen(name: string, callback: EventListener) {
    this.options.video.addEventListener(name, callback);
    this.listeners.push([name, callback]);
  }

  private progress(time: number) {
    if (this.terminal || this.pausedByUser || this.options.video.paused || this.options.video.readyState < 2 || Math.abs(time - this.lastTime) < 0.02) return;
    this.lastTime = time;
    this.lastProgress = Date.now();
    this.healthySince ||= Date.now();
    // Reset budgets only after sustained progress, never after a downloaded fragment.
    if (Date.now() - this.healthySince >= 30000) { this.attempts = 0; this.mediaErrors = 0; }
    if (this.state.status !== "playing") this.update({ status: "playing", recovering: false, error: "" });
  }

  private connect() {
    const { video } = this.options;
    const Library = this.options.hlsClass ?? Hls;
    const directMedia = /\.(mp4|webm|mp3|aac|ogg)(?:[?#]|$)/i.test(this.source);
    const nativeHls = !!video.canPlayType("application/vnd.apple.mpegurl");
    if (directMedia || !Library.isSupported() || (nativeHls && this.options.preferNative)) {
      this.startNative();
      return;
    }
    this.hls = new Library({ ...STABLE_HLS_CONFIG, ...this.options.config });
    const hls = this.hls;
    hls.on(Library.Events.MANIFEST_PARSED, () => {
      if (this.disposed || this.terminal) return;
      this.update({ levels: hls.levels.map((level, index) => ({
        index, label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`,
      })) });
      void this.play();
    });
    hls.on(Library.Events.LEVEL_SWITCHED, (_event, data) => {
      if (!this.terminal) this.update({ level: hls.autoLevelEnabled ? -1 : data.level });
    });
    hls.on(Library.Events.ERROR, (_event, data) => {
      if (this.disposed || this.terminal || !data.fatal) return;
      this.options.log?.(`${data.type}: ${data.details}`);
      if (data.type === Library.ErrorTypes.NETWORK_ERROR) {
        const code = data.response?.code;
        this.reconnect(code === 401 || code === 403
          ? `The provider refused access (HTTP ${code}). Check provider or regional restrictions.`
          : `Network connection failed (${data.details}).`);
      } else if (data.type === Library.ErrorTypes.MEDIA_ERROR) {
        this.mediaErrors++;
        this.healthySince = 0;
        this.lastProgress = Date.now();
        this.update({ status: "buffering", recovering: true });
        if (this.mediaErrors <= 2) {
          try {
            if (this.mediaErrors === 2) hls.swapAudioCodec();
            hls.recoverMediaError();
          } catch { this.fallbackOrFail("This device cannot decode the broadcast."); }
        } else this.fallbackOrFail("Media recovery failed. This device may not support the broadcast codec.");
      } else this.fallbackOrFail(`The stream could not be played (${data.details}).`);
    });
    hls.attachMedia(video);
    hls.loadSource(this.source);
  }

  private clearRetry() {
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }

  private releaseHls() {
    const hls = this.hls;
    this.hls = null;
    if (hls) { hls.stopLoad(); hls.detachMedia(); hls.destroy(); }
  }

  private clearVideo() {
    const video = this.options.video;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  private startNative() {
    this.clearRetry();
    this.releaseHls();
    this.clearVideo();
    this.nativeTried = true;
    this.lastTime = -1;
    this.lastProgress = Date.now();
    this.update({ engine: "native", levels: [], level: -1, status: "loading" });
    this.options.video.src = this.options.nativeUrl?.(this.source) ?? this.source;
    this.options.video.load();
  }

  private fallbackOrFail(reason: string) {
    if (!this.nativeTried && this.options.video.canPlayType("application/vnd.apple.mpegurl")) {
      this.update({ recovering: true });
      this.startNative();
    } else this.fail(reason);
  }

  private reconnect(reason: string) {
    if (this.disposed || this.terminal || this.pausedByUser || this.retryTimer) return;
    this.healthySince = 0;
    if (this.attempts >= 3) { this.fallbackOrFail(reason); return; }
    const delay = 1000 * 2 ** this.attempts++;
    this.update({ status: "buffering", recovering: true, attempt: this.attempts });
    this.hls?.stopLoad();
    this.options.log?.(`Reconnect ${this.attempts}/3 in ${delay}ms: ${reason}`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.disposed || this.terminal) return;
      this.lastProgress = Date.now();
      if (this.hls) {
        // startLoad resumes level/fragment loading; an initial manifest failure needs a fresh source request.
        if (!this.hls.levels.length) this.hls.loadSource(this.source);
        this.hls.startLoad(-1);
      }
      else this.startNative();
    }, delay);
  }

  private fail(reason: string) {
    this.terminal = true;
    this.clearRetry();
    this.releaseHls();
    this.clearVideo();
    this.update({ status: "error", error: reason, recovering: false });
  }

  async play() {
    if (this.disposed || this.terminal) return;
    this.pausedByUser = false;
    if (this.state.status === "paused") this.hls?.startLoad(-1);
    this.lastProgress = Date.now();
    try { await this.options.video.play(); }
    catch (error) {
      if (this.disposed || this.terminal) return;
      if (error instanceof Error && error.name === "NotAllowedError") this.update({ status: "blocked" });
      else if (!(error instanceof Error && error.name === "AbortError")) this.reconnect("Playback could not start.");
    }
  }

  togglePlay() {
    if (this.options.video.paused || this.state.status === "blocked") void this.play();
    else {
      this.pausedByUser = true;
      this.clearRetry();
      this.options.video.pause();
      this.update({ status: "paused" });
    }
  }

  selectLevel(index: number) {
    if (!this.hls || index < -1 || index >= this.hls.levels.length) return;
    this.hls.currentLevel = index;
    this.update({ level: index });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.clearRetry();
    clearInterval(this.watchdog);
    if (this.frameId !== undefined) this.options.video.cancelVideoFrameCallback(this.frameId);
    for (const [name, callback] of this.listeners) this.options.video.removeEventListener(name, callback);
    this.releaseHls();
    this.clearVideo();
  }
}
