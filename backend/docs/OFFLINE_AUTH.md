# Аутентификация и разграничение доступа (офлайн)

## Первичная настройка

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_security_groups
```

Суперпользователь имеет полный доступ ко всем странам и модулям.

## Backend в Docker (офлайн)

По умолчанию контейнер backend запускается через **Gunicorn** (`DJANGO_SERVER=gunicorn` в `docker-compose.yml`), а не через `runserver --nothreading`. Это нужно, чтобы сохранение пользователя в `/admin/` не блокировало параллельные запросы карты к API.

Подробнее: [ADMIN_USER_STABILITY.md](ADMIN_USER_STABILITY.md).

Для локальной разработки с autoreload задайте в override:

```yaml
services:
  backend:
    environment:
      DJANGO_SERVER: runserver
      DJANGO_RUNSERVER_RELOAD: "1"
```

После смены образа backend пересоберите пакет на машине с интернетом: `docker compose build backend` и `export-offline.ps1`.

## Переменные окружения (`.env`)

```env
SECRET_KEY=your-secret-key
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://172.16.80.207:5173
CORS_ALLOW_ALL_ORIGINS=False
```

Для разработки можно оставить `CORS_ALLOW_ALL_ORIGINS=True` (по умолчанию при `DEBUG=True`).

## Группы безопасности

- Настраиваются в Django Admin (`/admin/`) или через API `/api/v1/auth/groups/`.
- Каждая группа задаёт:
  - **страны** (M2M) — пользователь видит только данные этих стран;
  - **права по модулям**: `none` / `read` / `write` / `write_delete` для объектов, событий, формуляра, досье стран, персоналий, техники;
  - флаги: справочники, управление пользователями, одобрение регистраций (`write_delete` включает удаление по модулю).

Команда `seed_security_groups` создаёт примеры: «Ближний Восток», «Операторы», «Администраторы».

## Регистрация и одобрение

1. Пользователь регистрируется на `/register`.
2. Учётная запись создаётся со статусом `pending`.
3. Администратор открывает «Управление пользователями» в меню профиля, назначает группы и одобряет.
4. При одобрении пользователь активируется; рекомендуется сброс пароля с флагом обязательной смены.

## Сброс пароля (офлайн)

- **Пользователь**: «Сменить пароль» в меню профиля (требуется текущий пароль).
- **Администратор**: «Сбросить пароль» в панели пользователей — выдаётся временный пароль.
- **Забыли пароль**: страница `/forgot-password` с инструкцией обратиться к администратору (email/SMS недоступны).

## JWT

- Access-токен: 30 минут.
- Refresh-токен: 7 дней, хранится в `sessionStorage` браузера.
- Работает полностью локально, без интернета.

## API auth

| Метод | URL |
|-------|-----|
| POST | `/api/v1/auth/register/` |
| POST | `/api/v1/auth/login/` |
| POST | `/api/v1/auth/refresh/` |
| POST | `/api/v1/auth/logout/` |
| GET | `/api/v1/auth/me/` |
| POST | `/api/v1/auth/change-password/` |
| GET | `/api/v1/auth/users/` |
| POST | `/api/v1/auth/users/{id}/approve/` |
| POST | `/api/v1/auth/users/{id}/reset-password/` |

## Безопасность

- Rate limit на вход: 5 неудачных попыток за 15 минут (по IP + логину).
- Журнал аудита: модель `AuthAuditLog` в админке.
- Объекты чужих стран возвращают `404`, а не `403`.
