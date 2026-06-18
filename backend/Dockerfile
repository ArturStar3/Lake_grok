# =============================================================================
# ВАЖНО ДЛЯ ОФФЛАЙН-РАЗВЁРТЫВАНИЯ (целевая машина без интернета)
# =============================================================================
# ЭТОТ Dockerfile предназначен ТОЛЬКО для сборки на машине, где ЕСТЬ интернет.
#
# На целевой машине БЕЗ интернета:
#   1. Сделай docker load готового образа (см. комментарии в docker-compose.yml)
#   2. Запускай ТОЛЬКО: docker compose up -d --no-build
#
# Если случайно запустить docker compose build на машине без сети:
#   - apt-get update / pip install упадут.
#
# Рекомендуемый workflow:
#   - Dev машина (с интернетом): docker compose build
#   - Экспорт: docker save ... > infolake_full_offline.tar
#   - Целевая: docker load + up --no-build
# =============================================================================

FROM python:3.12-slim

WORKDIR /app

# Все системные зависимости устанавливаются одной командой.
# После docker load базовые слои + этот слой уже будут на целевой машине.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Copy entrypoint outside the volume mount (/app) to prevent Windows CRLF line-ending issues
# on `exec ./docker-entrypoint.sh: no such file or directory`
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]