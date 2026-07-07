import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canManageUsers } from '../../utils/permissions';
import userIcon from '../../assets/images/no_user.png';
import './Header.css';
import logo from '../../assets/images/logo.png';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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
      <div className="header__wraper">
        <img className="header__logo" src={logo} alt="Логотип" width="40" height="40" />
        <h2 className="header__title">И</h2>
      </div>
      <nav className="header__nav">
        <ul className="header__nav-list">
          <li className="header__nav-item header__user-menu" ref={menuRef}>
            <button
              type="button"
              className="header__user-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <img className="header__user-img" src={userIcon} alt="" width="40" height="40" />
              <span className="header__user-name">{displayName}</span>
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
                <button type="button" className="header__dropdown-item header__dropdown-item--danger" onClick={handleLogout}>
                  Выйти
                </button>
              </div>
            )}
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
