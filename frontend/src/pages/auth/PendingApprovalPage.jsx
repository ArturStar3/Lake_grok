import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/images/logo.png';
import './AuthPages.css';

export default function PendingApprovalPage() {
  const { logout, user } = useAuth();

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__logo">
          <img src={logo} alt="" />
          <div>
            <h1 className="auth-card__title">Ожидание одобрения</h1>
            <p className="auth-card__subtitle">{user?.username}</p>
          </div>
        </div>
        <div className="auth-pending-icon" aria-hidden>⏳</div>
        <p>
          Ваша заявка на регистрацию отправлена администратору.
          После назначения группы безопасности вы сможете войти в систему.
        </p>
        <div className="auth-links" style={{ marginTop: 24 }}>
          <button type="button" className="auth-btn auth-btn--secondary" onClick={logout}>
            Выйти
          </button>
          <Link to="/login">Попробовать войти снова</Link>
        </div>
      </div>
    </div>
  );
}
