import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { passwordStrength, isPasswordValid } from '../../utils/passwordPolicy';
import { formatAuthError } from '../../utils/formatAuthError';
import PasswordRequirements from '../../components/auth/PasswordRequirements';
import logo from '../../assets/images/logo.png';
import './AuthPages.css';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    password: '',
    password2: '',
    full_name: '',
    registration_note: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = passwordStrength(form.password);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password !== form.password2) {
      setError('Пароли не совпадают');
      return;
    }
    if (!isPasswordValid(form.password)) {
      setError('Пароль не соответствует требованиям безопасности');
      return;
    }
    setLoading(true);
    try {
      const data = await register({
        username: form.username.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        registration_note: form.registration_note.trim(),
      });
      setSuccess(data.detail || 'Заявка отправлена');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(formatAuthError(err, 'Не удалось отправить заявку на регистрацию'));
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
            <h1 className="auth-card__title">Регистрация</h1>
            <p className="auth-card__subtitle">Заявка будет рассмотрена администратором</p>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {success && <p className="auth-success" role="status">{success}</p>}
          <div className="auth-field">
            <label htmlFor="reg-username">Логин</label>
            <input
              id="reg-username"
              autoComplete="username"
              value={form.username}
              onChange={(e) => handleChange('username', e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="reg-fullname">ФИО</label>
            <input
              id="reg-fullname"
              value={form.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="reg-password">Пароль</label>
            <div className="auth-field__password-row">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className="auth-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Скрыть' : 'Показать'}
              </button>
            </div>
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
            <PasswordRequirements password={form.password} />
          </div>
          <div className="auth-field">
            <label htmlFor="reg-password2">Повторите пароль</label>
            <input
              id="reg-password2"
              type="password"
              autoComplete="new-password"
              value={form.password2}
              onChange={(e) => handleChange('password2', e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="reg-note">Комментарий для администратора</label>
            <textarea
              id="reg-note"
              rows={3}
              value={form.registration_note}
              onChange={(e) => handleChange('registration_note', e.target.value)}
              placeholder="Например: подразделение, регион работы"
            />
          </div>
          <button type="submit" className="auth-btn auth-btn--primary" disabled={loading}>
            {loading ? 'Отправка…' : 'Зарегистрироваться'}
          </button>
          <div className="auth-links">
            <Link to="/login">Уже есть аккаунт? Войти</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
