import Icon from "@/shared/components/Icon";
import { useLocale } from "@/shared/lib/useLocale";

interface PlayerErrorViewProps {
  message: string;
  onRetry: () => void;
  onNext?: () => void;
  onReport: () => void;
}

export default function PlayerErrorView({
  message,
  onRetry,
  onNext,
  onReport,
}: PlayerErrorViewProps) {
  const { t } = useLocale();

  return (
    <div className="playback-overlay playback-error" role="alert">
      <span className="error-symbol">
        <Icon name="tv" size={30} />
      </span>
      <h2>{t("Signal unavailable", "تعذر استقبال الإشارة")}</h2>
      <p className="error-reason" dir="auto">
        {message}
      </p>
      <div className="overlay-actions">
        <button className="primary-button" onClick={onRetry}>
          <Icon name="retry" size={16} />
          {t("Retry", "إعادة المحاولة")}
        </button>
        {onNext && (
          <button className="secondary-button" onClick={onNext}>
            <Icon name="next" size={16} />
            {t("Next channel", "القناة التالية")}
          </button>
        )}
      </div>
      <button className="report-stream" onClick={onReport}>
        {t("Copy stream report", "نسخ تقرير البث")}
      </button>
    </div>
  );
}
