import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../config/axios';
import { formatAuthError } from '../../utils/formatAuthError';
import { isPasswordValid } from '../../utils/passwordPolicy';
import PasswordRequirements from '../auth/PasswordRequirements';
import './UsersAdminPanel.css';

function ResetPasswordModal({ user, onClose, onSubmit, loading, error }) {
  const [password, setPassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [mustChange, setMustChange] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      new_password: autoGenerate ? '' : password,
      must_change_password: mustChange,
    });
  };

  return (
    <div className="users-admin-modal-overlay" onClick={onClose}>
      <div className="users-admin-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Изменить пароль</h3>
        <p className="users-admin-modal__user">
          {user.full_name || user.username} <span>@{user.username}</span>
        </p>
        <p className="users-admin-modal__hint">
          При необходимости отметьте «Требуется смена пароля» — пользователь сменит пароль при входе.
        </p>
        {error && <p className="users-admin-panel__error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label className="users-admin-modal__checkbox">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(e) => setAutoGenerate(e.target.checked)}
            />
            Сгенерировать автоматически
          </label>
          {!autoGenerate && (
            <div className="users-admin-modal__field">
              <label htmlFor="temp-password">Пароль</label>
              <input
                id="temp-password"
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!autoGenerate}
              />
              <PasswordRequirements password={password} />
            </div>
          )}
          <label className="users-admin-modal__checkbox">
            <input
              type="checkbox"
              checked={mustChange}
              onChange={(e) => setMustChange(e.target.checked)}
            />
            Требуется смена пароля
          </label>
          <div className="users-admin-modal__actions">
            <button
              type="submit"
              className="users-admin-btn"
              disabled={loading || (!autoGenerate && !isPasswordValid(password))}
            >
              {loading ? 'Сохранение…' : 'Изменить пароль'}
            </button>
            <button type="button" className="users-admin-btn users-admin-btn--secondary" onClick={onClose}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersAdminPanel({ isOpen, onClose }) {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedGroups, setSelectedGroups] = useState({});
  const [resetResult, setResetResult] = useState(null);
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [passwordModalError, setPasswordModalError] = useState('');
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, groupsRes, requestsRes] = await Promise.all([
        apiClient.get('/auth/users/'),
        apiClient.get('/auth/groups/'),
        apiClient.get('/auth/password-reset-requests/', { params: { status: 'pending' } }),
      ]);
      setUsers(usersRes.data || []);
      setGroups(groupsRes.data || []);
      setResetRequests(requestsRes.data || []);
      const initial = {};
      (usersRes.data || []).forEach((u) => {
        initial[u.id] = u.security_group_ids || [];
      });
      setSelectedGroups(initial);
    } catch (err) {
      setError(formatAuthError(err, 'Не удалось загрузить пользователей'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const handleApprove = async (userId) => {
    const groupIds = selectedGroups[userId] || [];
    if (!groupIds.length) {
      setError('Выберите хотя бы одну группу безопасности');
      return;
    }
    try {
      await apiClient.post(`/auth/users/${userId}/approve/`, {
        security_group_ids: groupIds,
        must_change_password: true,
      });
      await load();
    } catch (err) {
      setError(formatAuthError(err, 'Ошибка одобрения'));
    }
  };

  const submitResetPassword = async (userId, payload) => {
    setPasswordModalLoading(true);
    setPasswordModalError('');
    try {
      const { data } = await apiClient.post(`/auth/users/${userId}/reset-password/`, payload);
      setResetResult({
        userId,
        username: passwordModalUser?.username,
        password: data.temporary_password,
      });
      setPasswordModalUser(null);
      await load();
    } catch (err) {
      setPasswordModalError(formatAuthError(err, 'Ошибка установки пароля'));
    } finally {
      setPasswordModalLoading(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await apiClient.post(`/auth/password-reset-requests/${requestId}/reject/`);
      await load();
    } catch (err) {
      setError(formatAuthError(err, 'Не удалось отклонить запрос'));
    }
  };

  const openPasswordModal = (user) => {
    setPasswordModalError('');
    setPasswordModalUser(user);
  };

  const toggleGroup = (userId, groupId) => {
    setSelectedGroups((prev) => {
      const current = new Set(prev[userId] || []);
      if (current.has(groupId)) current.delete(groupId);
      else current.add(groupId);
      return { ...prev, [userId]: [...current] };
    });
  };

  if (!isOpen) return null;

  const pending = users.filter((u) => u.status === 'pending');
  const active = users.filter((u) => u.status !== 'pending');

  return (
    <div className="users-admin-overlay" onClick={onClose}>
      <div className="users-admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="users-admin-panel__header">
          <h2>Управление пользователями</h2>
          <button type="button" className="users-admin-panel__close" onClick={onClose}>×</button>
        </div>
        {error && <p className="users-admin-panel__error">{error}</p>}
        {resetResult && (
          <p className="users-admin-panel__success">
            Пароль для {resetResult.username || `#${resetResult.userId}`}:{' '}
            <strong>{resetResult.password}</strong>
            <button
              type="button"
              className="users-admin-panel__dismiss"
              onClick={() => setResetResult(null)}
            >
              Скрыть
            </button>
          </p>
        )}
        {loading ? (
          <p>Загрузка…</p>
        ) : (
          <>
            {resetRequests.length > 0 && (
              <section className="users-admin-section">
                <h3>Запросы на сброс пароля ({resetRequests.length})</h3>
                {resetRequests.map((req) => (
                  <div key={req.id} className="users-admin-card">
                    <div className="users-admin-card__head">
                      <strong>{req.full_name || req.username}</strong>
                      <span>@{req.username}</span>
                    </div>
                    {req.note && <p className="users-admin-card__note">{req.note}</p>}
                    <p className="users-admin-card__meta">
                      {new Date(req.created_at).toLocaleString('ru-RU')}
                    </p>
                    <div className="users-admin-card__actions">
                      <button
                        type="button"
                        className="users-admin-btn"
                        onClick={() => openPasswordModal({
                          id: req.user_id,
                          username: req.username,
                          full_name: req.full_name,
                        })}
                      >
                        Выдать пароль
                      </button>
                      <button
                        type="button"
                        className="users-admin-btn users-admin-btn--secondary"
                        onClick={() => handleRejectRequest(req.id)}
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {pending.length > 0 && (
              <section className="users-admin-section">
                <h3>Ожидают одобрения ({pending.length})</h3>
                {pending.map((user) => (
                  <div key={user.id} className="users-admin-card">
                    <div className="users-admin-card__head">
                      <strong>{user.full_name || user.username}</strong>
                      <span>@{user.username}</span>
                    </div>
                    {user.registration_note && (
                      <p className="users-admin-card__note">{user.registration_note}</p>
                    )}
                    <div className="users-admin-card__groups">
                      {groups.map((g) => (
                        <label key={g.id} className="users-admin-chip">
                          <input
                            type="checkbox"
                            checked={(selectedGroups[user.id] || []).includes(g.id)}
                            onChange={() => toggleGroup(user.id, g.id)}
                          />
                          {g.name}
                        </label>
                      ))}
                    </div>
                    <button type="button" className="users-admin-btn" onClick={() => handleApprove(user.id)}>
                      Одобрить
                    </button>
                  </div>
                ))}
              </section>
            )}

            <section className="users-admin-section">
              <h3>Пользователи ({active.length})</h3>
              {active.map((user) => (
                <div key={user.id} className="users-admin-card users-admin-card--compact">
                  <div className="users-admin-card__head">
                    <strong>{user.full_name || user.username}</strong>
                    <span className={`users-admin-status users-admin-status--${user.status}`}>{user.status}</span>
                  </div>
                  <button
                    type="button"
                    className="users-admin-btn users-admin-btn--secondary"
                    onClick={() => openPasswordModal(user)}
                  >
                    Изменить пароль
                  </button>
                </div>
              ))}
            </section>
          </>
        )}
      </div>

      {passwordModalUser && (
        <ResetPasswordModal
          user={passwordModalUser}
          loading={passwordModalLoading}
          error={passwordModalError}
          onClose={() => setPasswordModalUser(null)}
          onSubmit={(payload) => submitResetPassword(passwordModalUser.id, payload)}
        />
      )}
    </div>
  );
}
