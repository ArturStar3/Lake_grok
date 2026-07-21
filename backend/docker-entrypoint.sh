#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# gunicorn — для офлайн/production (параллельные запросы, без autoreload).
# runserver — только локальная разработка: DJANGO_SERVER=runserver
SERVER="${DJANGO_SERVER:-gunicorn}"

if [ "$SERVER" = "runserver" ]; then
  if [ "${DJANGO_RUNSERVER_RELOAD:-0}" = "1" ]; then
    exec python manage.py runserver 0.0.0.0:8000
  else
    exec python manage.py runserver 0.0.0.0:8000 --noreload
  fi
fi

WORKERS="${GUNICORN_WORKERS:-2}"
THREADS="${GUNICORN_THREADS:-2}"
TIMEOUT="${GUNICORN_TIMEOUT:-120}"

exec gunicorn infolake.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "$WORKERS" \
  --threads "$THREADS" \
  --timeout "$TIMEOUT" \
  --access-logfile - \
  --error-logfile -
