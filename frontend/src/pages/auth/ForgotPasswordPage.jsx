import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../config/axios';
import { formatAuthError } from '../../utils/formatAuthError';
import logo from '../../assets/images/logo.png';
import './AuthPages.css';

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/forgot-password/', {
        username: username.trim(),
        note: note.trim(),
      });
      setSuccess(data.detail);
      setUsername('');
      setNote('');
    } catch (err) {
      setError(formatAuthError(err, 'Не удалось отправить запрос'));
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
            <h1 className="auth-card__title">Восстановление пароля</h1>
            <p className="auth-card__subtitle">Система работает без email и SMS</p>
          </div>
        </div>

        <p className="auth-card__hint">
          Укажите логин — администратор увидит запрос и выдаст временный пароль.
          После входа система попросит сменить пароль на свой.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {success && <p className="auth-success" role="status">{success}</p>}

          <div className="auth-field">
            <label htmlFor="forgot-username">Логин</label>
            <input
              id="forgot-username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="forgot-note">Комментарий для администратора</label>
            <textarea
              id="forgot-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Например: подразделение, контактный телефон"
            />
          </div>

          <button type="submit" className="auth-btn auth-btn--primary" disabled={loading}>
            {loading ? 'Отправка…' : 'Отправить запрос'}
          </button>

          <div className="auth-links">
            <Link to="/login">Вернуться ко входу</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
