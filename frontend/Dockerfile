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
#   - npm install упадёт (нет сети для скачивания пакетов).
#
# Рекомендуемый workflow:
#   - Dev машина (с интернетом): docker compose build
#   - Экспорт: docker save ... > infolake_full_offline.tar
#   - Целевая: docker load + up --no-build
#
# Для production на целевой машине обычно используют отдельный production Dockerfile
# с `npm run build` + nginx. Сейчас используется dev-режим (vite).
# =============================================================================

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
# Эта команда требует интернет. Выполняется только на машине со сборкой.
RUN npm install \
    && mkdir -p public/leaflet \
    && cp node_modules/leaflet/dist/images/* public/leaflet/

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]