import { useEffect, useState } from 'react';
import './DismissibleBanner.css';

/**
 * Всплывающий баннер с кнопкой закрытия.
 * При смене message снова показывается (если не controlled через visible).
 */
export default function DismissibleBanner({
  message,
  children,
  className = '',
  variant = 'error',
  role = 'alert',
  onDismiss,
}) {
  const content = message ?? children;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [content]);

  if (!content || hidden) return null;

  const handleDismiss = () => {
    setHidden(true);
    onDismiss?.();
  };

  return (
    <div
      className={`dismissible-banner dismissible-banner--${variant}${className ? ` ${className}` : ''}`}
      role={role}
    >
      <div className="dismissible-banner__body">{content}</div>
      <button
        type="button"
        className="dismissible-banner__close"
        onClick={handleDismiss}
        aria-label="Закрыть"
      >
        ✕
      </button>
    </div>
  );
}
