import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canManageUsers, canManageReference, canReadModule } from '../../utils/permissions';
import './Header.css';
import logo from '../../assets/images/logo.png';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const canOpenReference = canManageReference(user);
  const canOpenReports = canReadModule(user, 'reports');

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.full_name || user?.username || 'Пользователь';

  return (
    <header className="header">
      <div className="header__brand">
        <img className="header__logo" src={logo} alt="" width="34" height="34" />
        <div className="header__brand-text">
          <div className="header__brand-title">InfoLake</div>
          <div className="header__brand-sub">Информационно-аналитическая система</div>
        </div>
      </div>
      <div className="header__spacer" />
      <div className="header__user-menu" ref={menuRef}>
        <button
          type="button"
          className={`header__user-btn${menuOpen ? ' header__user-btn--open' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <svg className="header__user-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="header__user-name">{displayName}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </button>
        {menuOpen && (
          <div className="header__dropdown" role="menu">
            <div className="header__dropdown-user">{displayName}</div>
            <button type="button" className="header__dropdown-item" onClick={() => { setMenuOpen(false); navigate('/change-password'); }}>
              Сменить пароль
            </button>
            {canManageUsers(user) && (
              <button
                type="button"
                className="header__dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('infolake:open-users-admin'));
                }}
              >
                Управление пользователями
              </button>
            )}
            {canOpenReference && (
              <button
                type="button"
                className="header__dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('infolake:open-reference'));
                }}
              >
                Справочники
              </button>
            )}
            {canOpenReports && (
              <button
                type="button"
                className="header__dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('infolake:open-reports'));
                }}
              >
                Отчёты
              </button>
            )}
            <button type="button" className="header__dropdown-item header__dropdown-item--danger" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
