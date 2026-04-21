#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${ROOT_DIR}/.backend.pid"
LOG_FILE="${ROOT_DIR}/backend.log"
NODE_BIN="${NODE_BIN:-node}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-9000}"

usage() {
  cat <<EOF
Usage: ./backend.sh <start|stop|restart|status|logs>
EOF
}

is_running() {
  if [[ ! -f "${PID_FILE}" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "${PID_FILE}")"
  if [[ -z "${pid}" ]]; then
    return 1
  fi

  if kill -0 "${pid}" 2>/dev/null; then
    return 0
  fi

  rm -f "${PID_FILE}"
  return 1
}

start_backend() {
  if is_running; then
    echo "Backend already running (PID $(cat "${PID_FILE}"))."
    return 0
  fi

  echo "Starting backend on ${HOST}:${PORT}..."
  (
    cd "${ROOT_DIR}"
    nohup env HOST="${HOST}" PORT="${PORT}" "${NODE_BIN}" server.js >>"${LOG_FILE}" 2>&1 &
    echo $! >"${PID_FILE}"
  )
  echo "Backend started (PID $(cat "${PID_FILE}")). Logs: ${LOG_FILE}"
}

stop_backend() {
  if ! is_running; then
    echo "Backend is not running."
    return 0
  fi

  local pid
  pid="$(cat "${PID_FILE}")"
  echo "Stopping backend (PID ${pid})..."
  kill "${pid}" 2>/dev/null || true

  for _ in {1..20}; do
    if ! kill -0 "${pid}" 2>/dev/null; then
      rm -f "${PID_FILE}"
      echo "Backend stopped."
      return 0
    fi
    sleep 0.2
  done

  echo "Force stopping backend (PID ${pid})..."
  kill -9 "${pid}" 2>/dev/null || true
  rm -f "${PID_FILE}"
  echo "Backend stopped."
}

status_backend() {
  if is_running; then
    echo "Backend is running (PID $(cat "${PID_FILE}")) on ${HOST}:${PORT}."
  else
    echo "Backend is stopped."
  fi
}

logs_backend() {
  if [[ ! -f "${LOG_FILE}" ]]; then
    echo "No log file found yet at ${LOG_FILE}"
    return 0
  fi
  tail -n 80 "${LOG_FILE}"
}

main() {
  if [[ $# -ne 1 ]]; then
    usage
    exit 1
  fi

  case "$1" in
    start) start_backend ;;
    stop) stop_backend ;;
    restart)
      stop_backend
      start_backend
      ;;
    status) status_backend ;;
    logs) logs_backend ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
