# Стабильность API при работе в Django Admin

## Симптом

После **сохранения пользователя** в `/admin/` карта перестаёт загружать данные с `:8000`, помогает `docker compose restart backend`.

## Причина (типичная)

Backend в Docker раньше запускался как:

```text
python manage.py runserver 0.0.0.0:8000 --nothreading
```

- Один поток — запросы API **ждут**, пока admin обрабатывает POST (хеш пароля, M2M групп).
- Autoreload на Windows + bind-mount `./backend:/app` иногда **роняет** процесс — нужен restart.

## Исправление

По умолчанию в `docker-compose.yml`: **`DJANGO_SERVER=gunicorn`** (несколько workers, без autoreload).

Локальная разработка с autoreload:

```yaml
# docker-compose.override.yml (не коммитить секреты)
services:
  backend:
    environment:
      DJANGO_SERVER: runserver
      DJANGO_RUNSERVER_RELOAD: "1"
```

## Проверка после деплоя

1. Открыть карту, убедиться что `GET /api/v1/targets/` отвечает.
2. В admin создать тестового пользователя.
3. Без перезапуска Docker — карта должна продолжать грузить данные.

Скрипт диагностики:

```powershell
.\scripts\offline\diagnose-admin-user-backend.ps1
```

Автотест: `accounts.tests.test_admin_user_creation`.
