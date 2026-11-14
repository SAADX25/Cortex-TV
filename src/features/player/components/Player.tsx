import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LivePlayback, INITIAL_PLAYBACK } from "../services/LivePlayback";
import type { PlaybackSnapshot } from "../services/LivePlayback";
import { createPlaybackLoader, proxyRewrite } from "../services/playbackProxy";
import { resolveStream } from "@/features/iptv/services/StreamResolver";
import { cleanName, countryName, flagUrl } from "@/shared/lib/channelUtils";
import { useLocale } from "@/shared/lib/useLocale";
import ChannelList from "@/features/channels/components/ChannelList";
import SafeImage from "@/shared/components/SafeImage";
import Icon from "@/shared/components/Icon";
import VideoSurface from "./VideoSurface";
import PlayerControls from "./PlayerControls";
import type { PlayerProps } from "../types";

export default function Player({
  channel,
  onClose,
  sidebarChannels = [],
  sidebarCountryName,
  sidebarLoading,
  sidebarError,
  favorites = [],
  onToggleFavorite,
  onPlayChannel,
  customProxyUrl,
}: PlayerProps) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const theatreRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LivePlayback | null>(null);
  const [playback, setPlayback] = useState<PlaybackSnapshot>({ ...INITIAL_PLAYBACK });
  const [retry, setRetry] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [aspect, setAspect] = useState("Fit");
  const [notice, setNotice] = useState("");
  const [debug, setDebug] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [showOsd, setShowOsd] = useState(true);
  const [sessionChannels, setSessionChannels] = useState(sidebarChannels);
  const awaitingGuide = useRef(!!sidebarLoading);

  useEffect(() => {
    // Loading a country can finish after the player opens. Freeze the resulting guide
    // so updates to home recommendations or recent history don't reorder remote zapping.
    if (sidebarLoading) {
      awaitingGuide.current = true;
      return;
    }
    if (awaitingGuide.current || !sessionChannels.length) {
      setSessionChannels(sidebarChannels);
      awaitingGuide.current = false;
    }
  }, [sidebarChannels, sidebarLoading, sessionChannels.length]);

  const isFavorite = favorites.some((item) => item.id === channel.id);

  useEffect(() => {
    setShowOsd(true);
    const timer = setTimeout(() => setShowOsd(false), 2600);
    return () => clearTimeout(timer);
  }, [channel.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setPlayback({ ...INITIAL_PLAYBACK });
    setDebug([]);
    if (!channel.streamUrl) {
      setPlayback({
        ...INITIAL_PLAYBACK,
        status: "error",
        error: "No stream URL is available for this channel.",
      });
      return;
    }
    const controller = new LivePlayback({
      video,
      source: channel.streamUrl,
      resolve: resolveStream,
      config: { loader: createPlaybackLoader(customProxyUrl) },
      nativeUrl: (source) => proxyRewrite(source, customProxyUrl),
      preferNative: /Apple/i.test(navigator.vendor) && !/CriOS|FxiOS/.test(navigator.userAgent),
      onChange: setPlayback,
      log: (line) => setDebug((previous) => [...previous.slice(-24), line]),
    });
    engineRef.current = controller;
    void controller.start();
    return () => {
      controller.dispose();
      engineRef.current = null;
    };
  }, [channel.id, channel.streamUrl, customProxyUrl, retry]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted, channel.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const syncVolume = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };
    video.addEventListener("volumechange", syncVolume);
    return () => video.removeEventListener("volumechange", syncVolume);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const available = useMemo(
    () => (sessionChannels.some((item) => item.id === channel.id) ? sessionChannels : [channel, ...sessionChannels]),
    [sessionChannels, channel],
  );
  const queue = useMemo(() => available.filter((item) => item.streamUrl), [available]);
  const channelIndex = useMemo(() => queue.findIndex((item) => item.id === channel.id), [queue, channel.id]);

  const switchChannel = useCallback((direction = 1) => {
    if (!onPlayChannel || !queue.length) return;
    const index = queue.findIndex((item) => item.id === channel.id);
    const next = queue[(index + direction + queue.length) % queue.length];
    if (next && next.id !== channel.id) onPlayChannel(next);
  }, [queue, channel.id, onPlayChannel]);

  const canNext = !!onPlayChannel && queue.some((item) => item.id !== channel.id);
  const togglePlay = useCallback(() => engineRef.current?.togglePlay(), []);

  const fullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (theatreRef.current?.requestFullscreen) {
        await theatreRef.current.requestFullscreen();
      } else {
        const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
        video?.webkitEnterFullscreen?.();
      }
    } catch {
      setNotice("Fullscreen is unavailable on this device.");
    }
  }, []);

  const pip = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current?.requestPictureInPicture();
      }
    } catch {
      setNotice(
        t(
          "Picture in Picture is available once the stream is playing.",
          "تتوفر صورة داخل صورة بعد بدء البث.",
        ),
      );
    }
  };

  const report = async () => {
    try {
      await navigator.clipboard.writeText(
        [
          "Cortex TV stream report",
          channel.name,
          channel.country,
          channel.streamUrl,
          playback.error,
          ...debug,
        ].join("\n"),
      );
      setNotice(t("Stream report copied.", "تم نسخ تقرير البث."));
    } catch {
      setNotice(t("Clipboard access is unavailable.", "تعذر الوصول إلى الحافظة."));
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const ignoreTarget = target.closest("input,textarea,select,[contenteditable=true],[role=dialog]");
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || ignoreTarget) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === " " && target.closest("button,[role=button]")) return;
      if (["arrowup", "arrowdown", "f", "m", " "].includes(key)) event.preventDefault();
      if (key === "arrowup") switchChannel(-1);
      if (key === "arrowdown") switchChannel(1);
      if (key === "f") void fullscreen();
      if (key === "m") setMuted((previous) => !previous);
      if (key === " ") togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [switchChannel, fullscreen, togglePlay]);

  return (
    <div className="classic-player" data-classic-player>
      <main className="classic-player-main">
        <div className="classic-player-title">
          <SafeImage src={channel.logo || flagUrl(channel.country)} alt="" className="classic-channel-logo" />
          <div className="classic-player-meta">
            <h1 dir="auto">{cleanName(channel.name)}</h1>
            <p>{channel.categories.join(" · ") || countryName(channel.country)}</p>
          </div>
          <span className={`live-badge ${playback.status === "playing" ? "is-live" : ""}`}><i />LIVE</span>
          {canNext && (
            <div className="channel-flipper hidden sm:inline-flex" aria-label={t("Quick channel flip", "تقليب القنوات السريع")}>
              <button
                type="button"
                className="channel-flip-btn"
                onClick={() => switchChannel(-1)}
                aria-label={t("Previous channel", "القناة السابقة")}
                title={t("Previous channel (↑)", "القناة السابقة (↑)")}
              >
                <Icon name="chevronUp" size={14} />
              </button>
              {channelIndex >= 0 && (
                <span className="channel-flip-counter">
                  {channelIndex + 1}/{queue.length}
                </span>
              )}
              <button
                type="button"
                className="channel-flip-btn"
                onClick={() => switchChannel(1)}
                aria-label={t("Next channel", "القناة التالية")}
                title={t("Next channel (↓)", "القناة التالية (↓)")}
              >
                <Icon name="chevronDown" size={14} />
              </button>
            </div>
          )}
          <button
            className={`icon-button ${isFavorite ? "active" : ""}`}
            onClick={() => onToggleFavorite?.(channel)}
            aria-label={isFavorite ? t("Remove favorite", "إزالة من المفضلة") : t("Add favorite", "إضافة إلى المفضلة")}
            aria-pressed={isFavorite}
          >
            <Icon name="star" />
          </button>
          <button
            className="icon-button classic-close"
            onClick={onClose}
            aria-label={t("Back to browse", "العودة للتصفح")}
            title="Back to globe"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="theatre" ref={theatreRef} data-playback-engine={playback.engine}>
          <VideoSurface
            ref={videoRef}
            channel={channel}
            playback={playback}
            aspect={aspect}
            channelNumber={channelIndex >= 0 ? channelIndex + 1 : undefined}
            showOsd={showOsd}
            onRetry={() => setRetry((previous) => previous + 1)}
            onNext={canNext ? () => switchChannel(1) : undefined}
            onPlay={togglePlay}
            onReport={report}
          />
          <PlayerControls
            playback={playback}
            muted={muted}
            volume={volume}
            aspect={aspect}
            canPip={!!document.pictureInPictureEnabled}
            canFlip={canNext}
            channelIndex={channelIndex >= 0 ? channelIndex : undefined}
            channelTotal={queue.length}
            onPrevChannel={() => switchChannel(-1)}
            onNextChannel={() => switchChannel(1)}
            onPlay={togglePlay}
            onMute={() => setMuted(!muted)}
            onVolume={(value) => {
              setVolume(value);
              setMuted(value === 0);
            }}
            onQuality={(index) => engineRef.current?.selectLevel(index)}
            onAspect={() =>
              setAspect((previous) =>
                previous === "Fit" ? "Fill" : previous === "Fill" ? "16:9" : "Fit",
              )
            }
            onPip={pip}
            onFullscreen={fullscreen}
          />
        </div>

        {notice && <p role="status" className="player-notice">{notice}</p>}
        {import.meta.env.DEV && (
          <div className="player-debug">
            <button onClick={() => setShowDebug(!showDebug)}>Playback diagnostics</button>
            {showDebug && <pre>{debug.join("\n") || "No playback errors recorded."}</pre>}
          </div>
        )}
      </main>

      {!!(available.length || sidebarLoading || sidebarError) && (
        <aside className="classic-player-guide">
          <ChannelList
            embedded
            countryName={sidebarCountryName || t("Channels", "القنوات")}
            channels={available}
            loading={sidebarLoading ?? false}
            error={sidebarError ?? null}
            onPlayChannel={onPlayChannel}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite ?? (() => {})}
            isPlaying
            playingChannelId={channel.id}
          />
        </aside>
      )}
    </div>
  );
}
