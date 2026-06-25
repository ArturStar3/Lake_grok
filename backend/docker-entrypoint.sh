#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput
# --nothreading: стабильнее autoreload в Docker на Windows
exec python manage.py runserver 0.0.0.0:8000 --nothreading