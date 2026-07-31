# Диагностика сбоев InfoLake на офлайн-компьютере

Инструкция для случая, когда приложение «зависает», nginx перестаёт отдавать страницы, или `docker compose down` / `docker kill` не могут остановить контейнер.

Связанные документы:

- [OFFLINE_DEPLOY_PROD.md](OFFLINE_DEPLOY_PROD.md) — запуск production
- [OFFLINE_DEPLOY_DEV.md](OFFLINE_DEPLOY_DEV.md) — запуск dev
- [OFFLINE_MIGRATION.md](OFFLINE_MIGRATION.md) §8.1 / §8.2 — краткий справочник

**Важно:** собирайте данные **пока Docker ещё отвечает**. После полного зависания демона останется только перезапуск службы Docker или reboot.

---

## 1. Какой сценарий у вас

| Симптом | Что делать дальше |
|---------|-------------------|
| UI «отвалился», помогает **перезапуск браузера** | §2 (лёгкая деградация) → §3–5 |
| **Статика/HTML грузится, но /tiles и /api отвалились** | **§2.1 (stale DNS upstream)** |
| nginx не отвечает, браузер не помогает | §3–6 |
| `docker kill` / `compose down` зависают | §7 (аварийное восстановление) |
| После фикса всё равно повторяется | §3–6 + сохраните вывод команд |

Все команды — из корня проекта на офлайн-машине, например:

```powershell
cd D:\InfoLake\Lake_grok
```

Для prod используйте:

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml ...
```

---

## 2. Быстрая проверка: жив ли стек

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml ps
docker stats --no-stream
```

Ожидание:

- контейнеры `infolake-nginx`, `infolake-backend`, `tileserver-gl` — **Up**
- у nginx память заметно **ниже** лимита (сейчас `512m`)
- у tileserver — не упирается постоянно в `6g`

Проверка HTTP (подставьте IP и порт):

```powershell
curl.exe -s -o NUL -w "app:%{http_code}`n" "http://172.16.80.207/"
curl.exe -s -o NUL -w "api:%{http_code}`n" "http://172.16.80.207/api/v1/"
curl.exe -s -o NUL -w "tiles:%{http_code}`n" "http://172.16.80.207/tiles/"
curl.exe -s -o NUL -w "admin_css:%{http_code}`n" "http://172.16.80.207/static/admin/css/base.css"
```

Ожидание: коды **200** (или 401/403 для API без токена — тоже «живой» ответ, не timeout).

Если `curl` висит без ответа — проблема уже на стороне Docker/nginx, не браузера.

---

## 2.1. Статика работает, /api и /tiles не отвечают (stale DNS)

Типичная последовательность:

1. После старта всё работает.
2. Через время при обновлении страницы — нет тайлов / ошибка glyphs.
3. Позже не приходят данные backend (`/api/`).
4. Вкладка браузера крутится бесконечно; `docker stats` / `docker ps` выглядят нормально.
5. `docker compose ... down` падает с ошибкой kill / «did not return kill event».
6. После reboot ПК снова работает.

**Причина:** nginx без `resolver` кеширует IP `backend` / `tileserver` **один раз при старте**. Если tileserver или backend упали по OOM (`restart: unless-stopped`) и получили **новый IP** в docker-сети, nginx продолжает стучаться в старый адрес. Запросы висят по ~60 с, заполняют `worker_connections`, nginx перестаёт завершаться за grace period.

Healthcheck, который проверяет только `http://127.0.0.1/` (статический `index.html`), остаётся green — поэтому в `docker ps` всё «здорово».

**Доказательства (выполнить при симптоме или сразу после):**

```powershell
docker inspect tileserver-gl infolake-backend infolake-nginx --format "{{.Name}} restarts={{.RestartCount}} oom={{.State.OOMKilled}} started={{.State.StartedAt}}"
docker exec infolake-nginx getent hosts backend tileserver
docker inspect -f "{{.Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" tileserver-gl infolake-backend
docker logs --tail 50 infolake-nginx 2>&1 | findstr /i "upstream-watchdog timed out connect"
```

Подтверждение гипотезы:

- `StartedAt` у tileserver/backend **позже**, чем у nginx, и/или `restarts > 0`, `oom=true`
- IP из `getent hosts` внутри nginx **не совпадает** с актуальным IP контейнера (на старых образах без `resolver`)

**Что уже исправлено в актуальном пакете:**

- `resolver 127.0.0.11 valid=10s` + `proxy_pass` через переменные (DNS перечитывается)
- короткие `proxy_connect_timeout` (fail-fast)
- healthcheck nginx проверяет `/tiles/...` и `/api/v1/`
- watchdog: `nginx -s reload`, затем restart контейнера при длительном отказе upstream
- `mem_limit` tileserver `6g`, backend `3g`; `stop_grace_period: 20s`

**Временное восстановление без reboot (если ещё отвечает Docker):**

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml restart nginx
# если не помогает:
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --force-recreate nginx --no-build --pull never
```

После обновления пакета (новый `infolake-nginx` + compose) рестарт tileserver/backend должен сам «залечиваться» за 10–15 с.

---

## 3. Диск и место Docker

Нехватка места — частая причина «нельзя kill» и зависания записи логов.

```powershell
Get-PSDrive C, D | Format-Table Name, Used, Free
docker system df
```

Интерпретация:

| Наблюдение | Вывод |
|------------|--------|
| Свободно &lt; 5–10 ГБ на диске с Docker | Высокий риск thrashing / зависания |
| `Local Volumes` / `Build Cache` огромные | Очистка после стабилизации (см. §8) |
| Диск почти полный | Сначала освободите место, потом перезапуск Docker |

---

## 4. Логи контейнеров (рост и ротация)

### 4.1. Настроена ли ротация

```powershell
docker inspect infolake-nginx --format "{{json .HostConfig.LogConfig}}"
```

Ожидание после обновлённого пакета:

```json
{"Type":"json-file","Config":{"max-size":"10m","max-file":"3"}}
```

Если `Config` пустой `{}` или нет `max-size` — на машине старый `docker-compose.yml` без лимита логов. Обновите код + пересоздайте контейнеры.

### 4.2. Размер файла лога nginx

```powershell
$log = docker inspect infolake-nginx --format "{{.LogPath}}"
Write-Host $log
# Путь внутри Docker VM; на Windows часто через docker Desktop.
# Если путь доступен с хоста:
if (Test-Path $log) { Get-Item $log | Select-Object FullName, Length, LastWriteTime }
```

Интерпретация:

| Размер лога | Вывод |
|-------------|--------|
| Десятки МБ–ГБ, растёт без остановки | Старый стек без ротации / без `access_log off` на `/tiles/` |
| ≤ ~30 МБ (10m × 3) | Ротация работает |

### 4.3. Последние ошибки nginx / backend

```powershell
docker logs --tail 100 infolake-nginx
docker logs --tail 100 infolake-backend
docker logs --tail 50 tileserver-gl
```

Ищите: `worker_connections are not enough`, `upstream timed out`, OOM, `No space left on device`.

---

## 5. Память и OOM

```powershell
docker stats --no-stream
docker inspect infolake-nginx --format "OOM={{.State.OOMKilled}} Restarts={{.RestartCount}} Status={{.State.Status}}"
docker inspect tileserver-gl --format "OOM={{.State.OOMKilled}} Restarts={{.RestartCount}}"
docker inspect infolake-backend --format "OOM={{.State.OOMKilled}} Restarts={{.RestartCount}}"
```

Интерпретация:

| Наблюдение | Вывод |
|------------|--------|
| `OOM=true` или высокий `Restarts` у **tileserver/backend** | Upstream убивался по лимиту памяти → новый IP → на старых образах nginx «залипал» (см. §2.1) |
| `OOM=true` у nginx | Малый `mem_limit` / слишком много worker'ов |
| nginx RSS близко к 512 MiB | Нехватка лимита / слишком много worker'ов (старый образ) |
| tileserver стабильно ~6 GiB | Узкое место — карта/mbtiles; поднять RAM Docker Desktop |

### Лимиты самой VM Docker Desktop (без WSL2)

1. Docker Desktop → **Settings** → **Resources** → **Advanced**
2. Memory: рекомендуется **12–16 GB** (сумма лимитов: tileserver 6g + backend 3g + nginx 0.5g + frontend/dev ≈ 2g)
3. CPU: 2–4; Swap: 1–2 GB
4. Apply & Restart

(Если Docker через WSL2 — см. [OFFLINE_MIGRATION.md §8.1](OFFLINE_MIGRATION.md), файл `%UserProfile%\.wslconfig`.)

---

## 6. Проверка, что загружен актуальный prod-стек

```powershell
docker images --format "{{.Repository}}:{{.Tag}}  {{.ID}}  {{.CreatedSince}}" | findstr "infolake nginx maptiler"
docker exec infolake-nginx nginx -T 2>&1 | findstr /i "worker_processes access_log"
```

Ожидание в актуальном образе:

- `worker_processes 2;`
- `access_log off;` внутри `location /tiles/`
- `resolver 127.0.0.11` и `set $backend_upstream` / `$tileserver_upstream`
- в логах при старте: `upstream-watchdog: started`

Если видите `worker_processes auto;` и нет `access_log off` у tiles — образ/конфиг старые. Перенесите свежий `infolake_full_offline_prod.tar` и обновлённый код:

```powershell
docker load -i infolake_full_offline_prod.tar
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --no-build --pull never --force-recreate
```

---

## 7. Аварийное восстановление (kill не работает)

Делайте **по порядку**, пока Docker не оживёт:

### Шаг A — служба Docker (без reboot)

PowerShell **от администратора**:

```powershell
Restart-Service com.docker.service -Force
```

Или: `services.msc` → **Docker Desktop Service** / `com.docker.service` → Restart.

Дождитесь статуса Docker Desktop **Running**, затем:

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml ps
```

### Шаг B — WSL2 (только если backend = WSL2)

```powershell
wsl --shutdown
```

Затем снова запустите Docker Desktop.

### Шаг C — перезагрузка ПК

Если A/B не помогли — reboot Windows, затем `.\import-and-start.ps1` (или prod compose up).

### После восстановления

1. Проверьте диск (§3) и логи (§4).
2. Убедитесь в актуальном образе (§6).
3. Ограничьте Resources Docker (§5).

---

## 8. Очистка после стабилизации (не во время зависания)

Только когда `docker` отвечает нормально:

```powershell
docker system df
# осторожно: удаляет неиспользуемые образы/кэш
docker system prune -f
```

Не удаляйте загруженные `infolake-*` / `maptiler/tileserver-gl`, если они ещё нужны для offline (`prune` обычно не трогает используемые).

---

## 9. Шаблон отчёта (скопируйте результат)

Если проблема повторится — сохраните вывод в файл и приложите к обращению:

```powershell
$report = "offline-diag-$(Get-Date -Format yyyyMMdd_HHmmss).txt"
@"
=== InfoLake offline diagnostics ===
Date: $(Get-Date -Format o)
Host: $env:COMPUTERNAME
"@ | Out-File $report -Encoding utf8

docker compose -f docker-compose.yml -f docker-compose.server.yml ps 2>&1 | Out-File $report -Append -Encoding utf8
docker stats --no-stream 2>&1 | Out-File $report -Append -Encoding utf8
docker system df 2>&1 | Out-File $report -Append -Encoding utf8
Get-PSDrive C,D 2>&1 | Out-File $report -Append -Encoding utf8
docker inspect infolake-nginx --format "LogConfig={{json .HostConfig.LogConfig}} OOM={{.State.OOMKilled}} Restarts={{.RestartCount}}" 2>&1 | Out-File $report -Append -Encoding utf8
docker inspect tileserver-gl --format "OOM={{.State.OOMKilled}} Restarts={{.RestartCount}} Started={{.State.StartedAt}}" 2>&1 | Out-File $report -Append -Encoding utf8
docker inspect infolake-backend --format "OOM={{.State.OOMKilled}} Restarts={{.RestartCount}} Started={{.State.StartedAt}}" 2>&1 | Out-File $report -Append -Encoding utf8
docker exec infolake-nginx getent hosts backend tileserver 2>&1 | Out-File $report -Append -Encoding utf8
docker inspect -f "{{.Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" tileserver-gl infolake-backend 2>&1 | Out-File $report -Append -Encoding utf8
docker logs --tail 80 infolake-nginx 2>&1 | Out-File $report -Append -Encoding utf8
docker exec infolake-nginx nginx -T 2>&1 | Select-String -Pattern "worker_processes|access_log|resolver|backend_upstream|tileserver_upstream" | Out-File $report -Append -Encoding utf8

Write-Host "Report: $report"
```

---

## 10. Типичные выводы «одной строкой»

| Набор фактов | Вероятная причина |
|--------------|-------------------|
| HTML/статика 200, `/tiles` и `/api` timeout; Restarts у tileserver/backend | Stale DNS в nginx после OOM upstream — см. **§2.1** |
| Лог nginx гигабайты, нет `max-size` | Рост json-file логов + `/tiles/` access_log |
| Диск почти полный | Давление на IO → зависание Docker |
| `OOM=true` / частые Restarts у nginx | Малый `mem_limit` или `worker_processes auto` |
| Docker Resources = весь RAM ПК | VM Docker съела память хоста |
| Помогает только reboot / Restart-Service | Демон Docker уже в thrashing — смотреть §3–5 после подъёма |
| Помогает только Ctrl+F5 / новый браузер | Клиентские соединения / кэш; проверить, нет ли деградации nginx по `curl` |

Фиксы в актуальном пакете: ротация логов, `access_log off` для `/tiles/`, `resolver` + переменные в `proxy_pass`, fail-fast таймауты, upstream-watchdog, healthcheck по `/tiles`+`/api`, `mem_limit` tileserver `6g` / backend `3g`, `stop_grace_period: 20s` — см. [OFFLINE_MIGRATION.md §8.2](OFFLINE_MIGRATION.md) и §2.1 выше.
