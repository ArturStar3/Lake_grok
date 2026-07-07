import { API_URL } from '../config/api';

const FIELD_LABELS = {
  username: 'Логин',
  password: 'Пароль',
  current_password: 'Текущий пароль',
  new_password: 'Новый пароль',
  full_name: 'ФИО',
  registration_note: 'Комментарий',
  detail: '',
};

function formatFieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

function flattenApiErrors(data) {
  if (!data) return null;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    return data.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ');
  }
  if (typeof data === 'object') {
    if (data.detail) {
      return typeof data.detail === 'string' ? data.detail : flattenApiErrors(data.detail);
    }
    const parts = [];
    Object.entries(data).forEach(([key, value]) => {
      const label = formatFieldLabel(key);
      const text = flattenApiErrors(value);
      if (text) parts.push(label ? `${label}: ${text}` : text);
    });
    return parts.join(' ') || null;
  }
  return String(data);
}

export function formatAuthError(error, fallback = 'Произошла ошибка') {
  if (!error) return fallback;

  if (error.response?.data) {
    const parsed = flattenApiErrors(error.response.data);
    if (parsed) return parsed;
  }

  if (error.code === 'ERR_NETWORK' || !error.response) {
    return `Сервер недоступен (${API_URL}). Проверьте, что backend запущен и миграции применены.`;
  }

  if (error.response?.status === 429) {
    return 'Слишком много попыток. Подождите и повторите.';
  }

  return fallback;
}
