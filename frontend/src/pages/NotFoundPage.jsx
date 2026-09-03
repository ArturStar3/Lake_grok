import { Link } from 'react-router-dom';
import AuthPage from './auth/AuthPage';
import logo from '../assets/images/logo.png';
import './auth/AuthPages.css';

export default function NotFoundPage() {
  return (
    <AuthPage>
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-card__logo" style={{ justifyContent: 'center' }}>
          <img src={logo} alt="InfoLake" />
          <div>
            <h1 className="auth-card__title">404</h1>
            <p className="auth-card__subtitle">Страница не найдена</p>
          </div>
        </div>
        <p className="auth-card__hint">
          Запрошенный адрес не существует или был перемещён.
        </p>
        <Link className="auth-btn auth-btn--primary" to="/" style={{ display: 'inline-block', textDecoration: 'none' }}>
          На главную
        </Link>
      </div>
    </AuthPage>
  );
}
