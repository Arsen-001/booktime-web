#!/usr/bin/env bash
# Поднять дев-сервер на 3710, если его нет. НИКОГДА не останавливает работающий сервер.
#   bash scripts/ensure-dev.sh
# Работает — ждёт готовности /dev/health и выходит. Нет — под замком /tmp/booking-dev.lock
# запускает `next dev -p 3710` в фоне (лог .dev.log) и ждёт готовности.
set -u

PORT=3710
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK=/tmp/booking-dev.lock
HEALTH="http://localhost:${PORT}/dev/health"
WAIT_SECONDS=180

listening() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

healthy() {
  curl -s -o /dev/null -m 20 -w '%{http_code}' "$HEALTH" 2>/dev/null | grep -q '^200$'
}

wait_ready() {
  local waited=0
  while [ "$waited" -lt "$WAIT_SECONDS" ]; do
    if healthy; then
      echo "✓ дев-сервер готов: http://localhost:${PORT}"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
    if [ $((waited % 20)) -eq 0 ]; then echo "… жду готовности (${waited} с)"; fi
  done
  echo "✗ сервер на ${PORT} не ответил на /dev/health за ${WAIT_SECONDS} с (см. ${ROOT}/.dev.log)"
  return 1
}

if listening; then
  echo "На порту ${PORT} уже работает сервер — не трогаю его, жду готовности."
  wait_ready
  exit $?
fi

# Замок: снимаем, только если он старше 10 минут и порт свободен
if [ -d "$LOCK" ]; then
  age=$(( $(date +%s) - $(stat -f %m "$LOCK" 2>/dev/null || echo 0) ))
  if [ "$age" -gt 600 ] && ! listening; then
    echo "Старый замок (${age} с) без сервера — снимаю."
    rmdir "$LOCK" 2>/dev/null || rm -rf "$LOCK"
  fi
fi

if mkdir "$LOCK" 2>/dev/null; then
  trap 'rmdir "$LOCK" 2>/dev/null' EXIT
  if listening; then
    echo "Сервер появился, пока я брал замок — жду готовности."
    wait_ready
    exit $?
  fi
  echo "Запускаю next dev -p ${PORT} (лог: ${ROOT}/.dev.log)…"
  cd "$ROOT" || exit 1
  # Лог дописываем, а не перезаписываем: после падения причина остаётся (30.09 ночной лог пропал при перезапуске).
  # Больше 20 МБ — прошлый уходит в .dev.log.1
  if [ -f "$ROOT/.dev.log" ] && [ "$(stat -f %z "$ROOT/.dev.log" 2>/dev/null || echo 0)" -gt 20971520 ]; then
    mv "$ROOT/.dev.log" "$ROOT/.dev.log.1"
  fi
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') запуск next dev -p ${PORT} =====" >> "$ROOT/.dev.log"
  nohup npx next dev -p "$PORT" >> "$ROOT/.dev.log" 2>&1 &
  disown || true
  wait_ready || exit $?
  # Прогрев: next dev собирает страницу при первом заходе (секунды) — «нажал, а оно как будто не работает».
  # Собираем все страницы меню заранее, в фоне, по 3 за раз; скрипт не ждёт, лог — .dev-warmup.log
  (
    curl -s -m 30 "http://localhost:${PORT}/dev/routes" \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).all.join("\n"))}catch{}})' \
      | xargs -P 3 -I{} curl -s -o /dev/null -m 120 -w '%{http_code} {}\n' "http://localhost:${PORT}{}"
  ) > "$ROOT/.dev-warmup.log" 2>&1 &
  disown || true
  echo "… прогреваю страницы в фоне (лог: ${ROOT}/.dev-warmup.log)"
  exit 0
else
  echo "Сервер запускает другой процесс (замок ${LOCK}) — жду его."
  waited=0
  while [ "$waited" -lt "$WAIT_SECONDS" ]; do
    if listening; then
      wait_ready
      exit $?
    fi
    if [ ! -d "$LOCK" ]; then break; fi
    sleep 2
    waited=$((waited + 2))
  done
  if listening; then wait_ready; exit $?; fi
  echo "✗ сервер так и не появился. Запустите скрипт ещё раз."
  exit 1
fi
