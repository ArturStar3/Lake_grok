import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { passwordStrength, isPasswordValid } from '../../utils/passwordPolicy';
import { formatAuthError } from '../../utils/formatAuthError';
import PasswordRequirements from '../../components/auth/PasswordRequirements';
import logo from '../../assets/images/logo.png';
import './AuthPages.css';

export default function ChangePasswordPage() {
  const { changePassword, user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const strength = passwordStrength(newPassword);
  const forced = Boolean(user?.must_change_password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Новые пароли не совпадают');
      return;
    }
    if (!isPasswordValid(newPassword)) {
      setError('Пароль не соответствует требованиям безопасности');
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/');
    } catch (err) {
      setError(formatAuthError(err, 'Не удалось сменить пароль'));
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
            <h1 className="auth-card__title">Смена пароля</h1>
            <p className="auth-card__subtitle">
              {forced ? 'Необходимо задать новый пароль для продолжения работы' : 'Обновите пароль учётной записи'}
            </p>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="auth-field">
            <label htmlFor="cp-current">Текущий пароль</label>
            <input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="cp-new">Новый пароль</label>
            <input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <div className="auth-strength" aria-hidden>
              <div
                className="auth-strength__bar"
                style={{
                  width: `${(strength.score / strength.maxScore) * 100}%`,
                  backgroundColor: strength.score >= strength.maxScore ? '#22c55e' : strength.score >= 3 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
            <span className="auth-strength__label">Надёжность: {strength.label}</span>
            <PasswordRequirements password={newPassword} />
          </div>
          <div className="auth-field">
            <label htmlFor="cp-confirm">Повторите новый пароль</label>
            <input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-btn auth-btn--primary" disabled={loading}>
            {loading ? 'Сохранение…' : 'Сохранить пароль'}
          </button>
          {!forced && (
            <div className="auth-links">
              <Link to="/">Отмена</Link>
            </div>
          )}
          {forced && (
            <button type="button" className="auth-btn auth-btn--secondary" onClick={logout}>
              Выйти
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
