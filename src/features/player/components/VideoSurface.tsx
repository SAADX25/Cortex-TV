import { forwardRef } from "react";
import type { ChannelWithStream } from "@/shared/types";
import { cleanName, countryName } from "@/shared/lib/channelUtils";
import type { PlaybackSnapshot } from "../services/LivePlayback";
import PlayerLoadingView from "./PlayerLoadingView";
import PlayerErrorView from "./PlayerErrorView";
import Icon from "@/shared/components/Icon";
import { useLocale } from "@/shared/lib/useLocale";

interface Props {
  channel: ChannelWithStream;
  playback: PlaybackSnapshot;
  aspect: string;
  channelNumber?: number;
  showOsd?: boolean;
  onRetry: () => void;
  onNext?: () => void;
  onPlay: () => void;
  onReport: () => void;
}

export default forwardRef<HTMLVideoElement, Props>(function VideoSurface(
  { channel, playback, aspect, channelNumber, showOsd, onRetry, onNext, onPlay, onReport },
  ref,
) {
  const { t } = useLocale();
  return (
    <div className="video-surface">
      <video
        ref={ref}
        playsInline
        autoPlay
        controls={false}
        preload="metadata"
        aria-label={channel.name}
        style={{ objectFit: aspect === "Fill" ? "cover" : aspect === "16:9" ? "fill" : "contain" }}
      />
      {showOsd && (
        <div className="channel-osd" aria-hidden="true">
          {channelNumber !== undefined && channelNumber > 0 && (
            <span className="channel-osd-num">CH {String(channelNumber).padStart(2, "0")}</span>
          )}
          <div className="min-w-0">
            <div className="channel-osd-title">{cleanName(channel.name)}</div>
            <div className="channel-osd-meta">
              {channel.categories.slice(0, 2).join(" · ") || countryName(channel.country)}
            </div>
          </div>
        </div>
      )}
      {["loading", "buffering"].includes(playback.status) && (
        <PlayerLoadingView channel={channel} recovering={playback.recovering} attempt={playback.attempt} />
      )}
      {playback.status === "error" && (
        <PlayerErrorView message={playback.error} onRetry={onRetry} onNext={onNext} onReport={onReport} />
      )}
      {["blocked", "paused"].includes(playback.status) && (
        <button className="center-play" onClick={onPlay} aria-label={t("Play broadcast", "تشغيل البث")}>
          <Icon name="play" size={30} />
          <span>{t("Press to play", "اضغط للتشغيل")}</span>
        </button>
      )}
    </div>
  );
});
