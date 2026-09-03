import { useTheme } from '../../../context/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle({ compact = false, className = '' }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Светлая тема' : 'Тёмная тема';

  return (
    <button
      type="button"
      className={['theme-toggle', compact ? 'theme-toggle--compact' : '', className].filter(Boolean).join(' ')}
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={label}
      title={label}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
        </svg>
      )}
      {!compact && <span>{isDark ? 'Тёмная' : 'Светлая'}</span>}
    </button>
  );
}
