import SafeImage from "@/shared/components/SafeImage";
import { useLocale } from "@/shared/lib/useLocale";
import type { ChannelWithStream } from "@/shared/types";

interface PlayerLoadingViewProps {
  channel: ChannelWithStream;
  recovering: boolean;
  attempt: number;
}

export default function PlayerLoadingView({
  channel,
  recovering,
  attempt,
}: PlayerLoadingViewProps) {
  const { t } = useLocale();

  return (
    <div className="playback-overlay" role="status" aria-live="polite">
      <div className="loading-art">
        <SafeImage src={channel.logo || undefined} alt="" />
        <span className="stream-spinner" />
      </div>
      <p>
        {recovering
          ? t("Restoring the signal…", "جاري استعادة الإشارة...")
          : t("Connecting to the stream…", "جاري الاتصال بالبث...")}
      </p>
      <small>
        {recovering
          ? t(`Reconnecting · ${attempt}/3`, `إعادة الاتصال · ${attempt}/3`)
          : channel.name}
      </small>
    </div>
  );
}
