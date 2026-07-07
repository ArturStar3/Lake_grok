import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatAuthError } from '../../utils/formatAuthError';
import logo from '../../assets/images/logo.png';
import './AuthPages.css';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(location.state?.blocked ? 'Учётная запись заблокирована' : '');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user?.status === 'active' && !user?.must_change_password) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedIn = await login(username.trim(), password);
      if (loggedIn.status === 'pending') {
        navigate('/pending');
        return;
      }
      if (loggedIn.must_change_password) {
        navigate('/change-password');
        return;
      }
      navigate(location.state?.from?.pathname || '/');
    } catch (err) {
      if (err.response?.data?.status === 'pending') {
        navigate('/pending');
        return;
      }
      setError(formatAuthError(err, 'Не удалось войти. Проверьте логин и пароль.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__logo">
          <img src={logo} alt="" />
          <div>
            <h1 className="auth-card__title">Вход в систему</h1>
            <p className="auth-card__subtitle">Информационно-аналитическая система</p>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="auth-field">
            <label htmlFor="login-username">Логин</label>
            <input
              id="login-username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="login-password">Пароль</label>
            <div className="auth-field__password-row">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>
          <button type="submit" className="auth-btn auth-btn--primary" disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
          <div className="auth-links">
            <Link to="/forgot-password">Забыли пароль?</Link>
            <Link to="/register">Регистрация</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
