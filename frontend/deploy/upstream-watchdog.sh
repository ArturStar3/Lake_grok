#!/bin/sh
# Upstream watchdog for InfoLake nginx.
# Runs from /docker-entrypoint.d/ before nginx starts; background loop is
# inherited by the master process (pid 1 after exec).
#
# After backend/tileserver OOM-restart they get a new Docker DNS IP.
# Even with resolver valid=10s, hung workers / stale state can linger —
# this script reloads nginx, then force-restarts the container if needed.

PROBE_TILES="${WATCHDOG_TILES_URL:-http://127.0.0.1/tiles/styles/infolake-unified/style.json}"
PROBE_API="${WATCHDOG_API_URL:-http://127.0.0.1/api/v1/}"
INTERVAL="${WATCHDOG_INTERVAL:-15}"
FAIL_THRESHOLD="${WATCHDOG_FAIL_THRESHOLD:-3}"
RELOAD_BEFORE_KILL="${WATCHDOG_RELOAD_BEFORE_KILL:-2}"

probe_ok() {
    url="$1"
    # Accept any HTTP response (2xx–5xx): connection + nginx proxy path works.
    # Connection refused / timeout => fail.
    code=$(wget -q -S -O /dev/null --timeout=5 "$url" 2>&1 | awk '/^  HTTP\//{print $2; exit}')
    [ -n "$code" ] && [ "$code" -ge 100 ] && [ "$code" -lt 600 ]
}

run_watchdog() {
    fails=0
    reloads=0
    # Wait for nginx to finish starting.
    sleep 20
    echo "upstream-watchdog: started (tiles=$PROBE_TILES api=$PROBE_API interval=${INTERVAL}s)" >&2

    while true; do
        sleep "$INTERVAL"
        tiles_ok=0
        api_ok=0
        probe_ok "$PROBE_TILES" && tiles_ok=1
        probe_ok "$PROBE_API" && api_ok=1

        if [ "$tiles_ok" -eq 1 ] && [ "$api_ok" -eq 1 ]; then
            fails=0
            reloads=0
            continue
        fi

        fails=$((fails + 1))
        echo "upstream-watchdog: probe fail #$fails (tiles=$tiles_ok api=$api_ok)" >&2

        if [ "$fails" -lt "$FAIL_THRESHOLD" ]; then
            continue
        fi

        fails=0
        reloads=$((reloads + 1))

        if [ "$reloads" -le "$RELOAD_BEFORE_KILL" ]; then
            echo "upstream-watchdog: nginx -s reload (attempt $reloads/$RELOAD_BEFORE_KILL)" >&2
            nginx -s reload || true
            sleep 5
            continue
        fi

        echo "upstream-watchdog: still failing after $RELOAD_BEFORE_KILL reloads — TERM pid 1" >&2
        kill -TERM 1
        exit 0
    done
}

# Launch in background so docker-entrypoint can exec nginx as pid 1.
run_watchdog &
