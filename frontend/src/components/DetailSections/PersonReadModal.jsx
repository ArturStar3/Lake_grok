import { useEffect, useState } from 'react';
import PersonReadContent from './PersonReadContent';
import './PersonReadModal.css';

export default function PersonReadModal({ person, onClose }) {
  const [stack, setStack] = useState(() => (person ? [person] : []));

  useEffect(() => {
    if (person) {
      setStack([person]);
    }
  }, [person?.id]);

  if (!person || !stack.length) return null;

  const current = stack[stack.length - 1];
  const canGoBack = stack.length > 1;

  const handleRelationClick = (other) => {
    if (!other?.id) return;
    setStack((prev) => {
      if (prev[prev.length - 1]?.id === other.id) return prev;
      return [...prev, other];
    });
  };

  const handleBack = () => {
    if (canGoBack) {
      setStack((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div
      className="person-read-modal__overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="person-read-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-read-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="person-read-modal__header">
          <div className="person-read-modal__header-start">
            {canGoBack && (
              <button
                type="button"
                className="person-read-modal__back"
                onClick={handleBack}
              >
                ← Назад
              </button>
            )}
            <h2 id="person-read-modal-title" className="person-read-modal__title">
              {current.full_name}
            </h2>
          </div>
          <button
            type="button"
            className="person-read-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="person-read-modal__body">
          <PersonReadContent
            key={current.id}
            person={current}
            onRelationClick={handleRelationClick}
          />
        </div>
      </div>
    </div>
  );
}
