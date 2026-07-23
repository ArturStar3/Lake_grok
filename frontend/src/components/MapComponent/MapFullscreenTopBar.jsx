import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canManageUsers } from '../../utils/permissions';
import logo from '../../assets/images/logo.png';
import MapFullscreenToolsMenu from './MapFullscreenToolsMenu';

export default function MapFullscreenTopBar({
  toolsMenuRef,
  isToolsOpen,
  onToggleTools,
  effectiveMeasureMode,
  measurePointsLength,
  clusterMode,
  onToggleMeasure,
  onClearMeasure,
  onClusterLegacy,
  onClusterBubble,
  onResetAll,
  onExitFullscreen,
  canEditTargets,
  onOpenAddTarget,
  canOpenReference,
  onOpenReference,
  canOpenReports = false,
  onOpenReports,
  canOpenDataExchange = false,
  onOpenDataExchange,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const displayName = user?.full_name || user?.username || 'Пользователь';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="map-fs-topbar">
      <div className="map-fs-topbar__brand-wrap" ref={accountMenuRef}>
        <button
          type="button"
          className="map-fs-topbar__brand"
          onClick={() => setAccountMenuOpen((v) => !v)}
          aria-expanded={accountMenuOpen}
          aria-haspopup="true"
          aria-label="Меню аккаунта"
        >
          <img className="map-fs-topbar__logo" src={logo} alt="Логотип" width="30" height="30" />
        </button>
        {accountMenuOpen && (
          <div className="map-fs-topbar__account-dropdown" role="menu">
            <div className="map-fs-topbar__account-user">{displayName}</div>
            <button
              type="button"
              className="map-fs-topbar__account-item"
              onClick={() => {
                setAccountMenuOpen(false);
                navigate('/change-password');
              }}
            >
              Сменить пароль
            </button>
            {canManageUsers(user) && (
              <button
                type="button"
                className="map-fs-topbar__account-item"
                onClick={() => {
                  setAccountMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('infolake:open-users-admin'));
                }}
              >
                Управление пользователями
              </button>
            )}
            <button
              type="button"
              className="map-fs-topbar__account-item map-fs-topbar__account-item--danger"
              onClick={handleLogout}
            >
              Выйти
            </button>
          </div>
        )}
      </div>
      <span className="map-fs-topbar__title">InfoLake</span>
      <span className="map-fs-topbar__subtitle">Карта · Полный экран</span>
      <div className="map-fs-topbar__spacer" />
      {canEditTargets && onOpenAddTarget && (
        <button type="button" className="map-fs-topbar__btn map-fs-topbar__btn--ghost" onClick={onOpenAddTarget}>
          + Объект
        </button>
      )}
      {canOpenReference && onOpenReference && (
        <button type="button" className="map-fs-topbar__btn map-fs-topbar__btn--ghost" onClick={onOpenReference}>
          Справочники
        </button>
      )}
      {canOpenReports && onOpenReports && (
        <button type="button" className="map-fs-topbar__btn map-fs-topbar__btn--ghost" onClick={onOpenReports}>
          Отчёты
        </button>
      )}
      {canOpenDataExchange && onOpenDataExchange && (
        <button type="button" className="map-fs-topbar__btn map-fs-topbar__btn--ghost" onClick={onOpenDataExchange}>
          Импорт / экспорт
        </button>
      )}
      <div className="map-fs-topbar__tools-wrap" ref={toolsMenuRef}>
        <button
          type="button"
          className={`map-fs-topbar__btn map-fs-topbar__btn--tools${isToolsOpen ? ' map-fs-topbar__btn--tools-open' : ''}${effectiveMeasureMode ? ' map-fs-topbar__btn--active' : ''}`}
          onClick={onToggleTools}
          aria-expanded={isToolsOpen}
        >
          Инструменты
          <span className="map-fs-topbar__chev" aria-hidden>▼</span>
        </button>
        {isToolsOpen && (
          <MapFullscreenToolsMenu
            effectiveMeasureMode={effectiveMeasureMode}
            measurePointsLength={measurePointsLength}
            clusterMode={clusterMode}
            onToggleMeasure={onToggleMeasure}
            onClearMeasure={onClearMeasure}
            onClusterLegacy={onClusterLegacy}
            onClusterBubble={onClusterBubble}
            onResetAll={onResetAll}
          />
        )}
      </div>
      <button type="button" className="map-fs-topbar__btn map-fs-topbar__btn--exit" onClick={onExitFullscreen}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <polyline points="4,14 10,14 10,20" />
          <polyline points="20,10 14,10 14,4" />
          <line x1="10" y1="14" x2="3" y2="21" />
          <line x1="21" y1="3" x2="14" y2="10" />
        </svg>
        Свернуть
      </button>
    </header>
  );
}
