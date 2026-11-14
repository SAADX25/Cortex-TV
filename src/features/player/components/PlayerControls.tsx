import Icon from "@/shared/components/Icon";
import { useLocale } from "@/shared/lib/useLocale";
import type { PlaybackSnapshot } from "../services/LivePlayback";

interface PlayerControlsProps {
  playback: PlaybackSnapshot;
  muted: boolean;
  volume: number;
  aspect: string;
  canPip: boolean;
  canFlip?: boolean;
  channelIndex?: number;
  channelTotal?: number;
  onPrevChannel?: () => void;
  onNextChannel?: () => void;
  onPlay: () => void;
  onMute: () => void;
  onVolume: (volume: number) => void;
  onQuality: (level: number) => void;
  onAspect: () => void;
  onPip: () => void;
  onFullscreen: () => void;
}

export default function PlayerControls(props: PlayerControlsProps) {
  const { t } = useLocale();
  const paused = ["paused", "blocked"].includes(props.playback.status);

  return (
    <div
      className="player-controls"
      role="toolbar"
      aria-label={t("Player controls", "أدوات المشغل")}
      dir="ltr"
    >
      <div className="player-controls-primary">
        <button
          type="button"
          onClick={props.onPlay}
          disabled={props.playback.status === "error"}
          aria-label={paused ? t("Play", "تشغيل") : t("Pause", "إيقاف مؤقت")}
          title="Space"
        >
          <Icon name={paused ? "play" : "pause"} />
        </button>

        <span className={`live-badge ${props.playback.status === "playing" ? "is-live" : ""}`}>
          <i />
          LIVE
        </span>

        <div className="player-volume-group">
          <button
            type="button"
            onClick={props.onMute}
            aria-label={props.muted ? t("Unmute", "إلغاء الكتم") : t("Mute", "كتم الصوت")}
            title="M"
          >
            <Icon name={props.muted || !props.volume ? "mute" : "volume"} />
          </button>
          <input
            className="volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={props.muted ? 0 : props.volume}
            onChange={(event) => props.onVolume(Number(event.target.value))}
            aria-label={t("Volume", "مستوى الصوت")}
          />
        </div>

        {props.canFlip && (
          <div className="channel-flipper" aria-label={t("Channel switcher", "تبديل القنوات")}>
            <button
              type="button"
              className="channel-flip-btn"
              onClick={props.onPrevChannel}
              aria-label={t("Previous channel", "القناة السابقة")}
              title={t("Previous channel (↑)", "القناة السابقة (↑)")}
            >
              <Icon name="chevronUp" size={14} />
              <span>CH-</span>
            </button>

            {props.channelIndex !== undefined &&
              props.channelTotal !== undefined &&
              props.channelTotal > 0 && (
                <span className="channel-flip-counter">
                  {props.channelIndex + 1}/{props.channelTotal}
                </span>
              )}

            <button
              type="button"
              className="channel-flip-btn"
              onClick={props.onNextChannel}
              aria-label={t("Next channel", "القناة التالية")}
              title={t("Next channel (↓)", "القناة التالية (↓)")}
            >
              <span>CH+</span>
              <Icon name="chevronDown" size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="player-controls-secondary">
        <select
          aria-label={t("Quality", "جودة البث")}
          value={props.playback.level}
          onChange={(event) => props.onQuality(Number(event.target.value))}
          disabled={!props.playback.levels.length}
        >
          <option value={-1}>{t("Auto", "تلقائي")}</option>
          {props.playback.levels.map((level) => (
            <option key={level.index} value={level.index}>
              {level.label}
            </option>
          ))}
        </select>

        <div className="player-controls-actions">
          <button
            type="button"
            onClick={props.onAspect}
            aria-label={t(`Aspect ratio: ${props.aspect}`, `نسبة العرض: ${props.aspect}`)}
            title={props.aspect}
            className="aspect-control"
          >
            <Icon name="aspect" />
            <span>{props.aspect}</span>
          </button>

          {props.canPip && (
            <button
              type="button"
              onClick={props.onPip}
              aria-label={t("Picture in Picture", "صورة داخل صورة")}
            >
              <Icon name="pip" />
            </button>
          )}

          <button
            type="button"
            onClick={props.onFullscreen}
            aria-label={t("Fullscreen", "ملء الشاشة")}
            title="F"
          >
            <Icon name="fullscreen" />
          </button>
        </div>
      </div>
    </div>
  );
}
