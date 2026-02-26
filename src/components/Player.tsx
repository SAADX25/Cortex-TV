/* ──────────────────────────────────────────────────
   Player.tsx – HLS Video Player using hls.js
   Native <video> element with full error handling.
   ────────────────────────────────────────────────── */

import { useRef, useEffect, useState } from "react";
import Hls from "hls.js";
import type { ChannelWithStream } from "../hooks/useIPTV";

interface PlayerProps {
  channel: ChannelWithStream;
  onClose: () => void;
}

type StreamStatus = "loading" | "playing" | "error";

export default function Player({ channel, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<StreamStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel.streamUrl) {
      setStatus("error");
      setErrorMsg("No stream URL available for this channel.");
      return;
    }

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        fragLoadingMaxRetry: 3,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
      });

      hls.loadSource(channel.streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("[Player] HLS manifest parsed, starting playback…");
        video.play().catch((e) => {
          console.warn("[Player] Auto-play blocked:", e.message);
          // Still mark as "playing" — user can press play manually
          setStatus("playing");
        });
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (status !== "playing") setStatus("playing");
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error("[Player] HLS error:", data.type, data.details);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("[Player] Fatal network error — attempting recovery…");
              hls?.startLoad();
              // If recovery doesn't help within 5s, show error
              setTimeout(() => {
                setStatus((s) => {
                  if (s !== "playing") {
                    setErrorMsg("Network error: Stream is unreachable.");
                    return "error";
                  }
                  return s;
                });
              }, 5000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("[Player] Fatal media error — attempting recovery…");
              hls?.recoverMediaError();
              break;
            default:
              setErrorMsg("Stream Offline or Unreachable");
              setStatus("error");
              hls?.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      /* Safari: native HLS support */
      video.src = channel.streamUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => setStatus("playing"));
      });
    } else {
      setErrorMsg("HLS is not supported in this browser.");
      setStatus("error");
    }

    /* Timeout: if still "loading" after 12s, treat as offline */
    const timeout = setTimeout(() => {
      setStatus((s) => {
        if (s === "loading") {
          setErrorMsg("Stream Offline or Unreachable");
          return "error";
        }
        return s;
      });
    }, 12000);

    return () => {
      clearTimeout(timeout);
      if (hls) {
        hls.destroy();
        hls = null;
      }
    };
  }, [channel.streamUrl]);

  /* Mark playing once actual video frames are produced */
  const handlePlaying = () => setStatus("playing");

  return (
    <div className="absolute inset-0 z-40 bg-black">
      {/* ── Prominent floating Back button ── */}
      <button
        onClick={onClose}
        className="absolute top-6 left-6 z-[100] text-white bg-black/60 hover:bg-red-600 p-3 rounded-full cursor-pointer transition-colors"
        title="Back to globe"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
      </button>

      {/* ── Channel info overlay ── */}
      <div className="absolute top-6 left-20 z-[100] flex items-center gap-3 rounded-lg bg-black/60 px-4 py-2 backdrop-blur-sm">
        {channel.logo && (
          <img
            src={channel.logo}
            alt=""
            className="h-8 w-8 rounded object-contain bg-white/5"
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate max-w-[260px]">
            {channel.name}
          </p>
          {channel.categories.length > 0 && (
            <p className="text-[10px] text-cyan-400/60 uppercase tracking-wider">
              {channel.categories.join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* ── Loading spinner ── */}
      {status === "loading" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
          <div className="h-10 w-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          <p className="mt-4 text-sm text-white/50">
            Connecting to stream…
          </p>
        </div>
      )}

      {/* ── Error state ── */}
      {status === "error" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
          <div className="text-5xl mb-4">📡</div>
          <p className="text-lg font-semibold text-white/70">
            Stream Offline or Unreachable
          </p>
          <p className="mt-2 text-sm text-white/30 max-w-md text-center">
            {errorMsg || "This stream could not be loaded. It may be temporarily offline or geo-restricted."}
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-5 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-colors cursor-pointer"
          >
            ← Back to channels
          </button>
        </div>
      )}

      {/* ── Video element (always mounted for hls.js to attach) ── */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        controls
        autoPlay
        playsInline
        onPlaying={handlePlaying}
      />
    </div>
  );
}
