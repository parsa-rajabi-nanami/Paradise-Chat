#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
SITE_URL=""
PORT=""
BIND_ADDRESS=""
ROTATE_APP_SECRETS=0
NO_BUILD=0
CREATED_ENV=0

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[deploy] %s\n' "$*"
}

usage() {
  cat <<'EOF'
Usage: scripts/deploy.sh [options]

Deploy Paradise Chat with Docker Compose.

Options:
  --site-url URL          Browser-facing URL (default: http://127.0.0.1:<port>)
  --port PORT             Host port for the internal Nginx (default: 8080)
  --bind-address ADDRESS  Host bind address (default: 127.0.0.1)
  --env-file PATH         Environment file (default: .env)
  --rotate-app-secrets    Rotate Django and JWT secrets explicitly
  --no-build              Recreate services without rebuilding images
  -h, --help              Show this help

Examples:
  scripts/deploy.sh
  scripts/deploy.sh --site-url https://chat.example.com --port 8080
  scripts/deploy.sh --port 8080 --rotate-app-secrets
EOF
}

absolute_path() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    *) printf '%s/%s\n' "$ROOT_DIR" "$1" ;;
  esac
}

while (($#)); do
  case "$1" in
    --site-url)
      (($# >= 2)) || die "--site-url requires a value"
      SITE_URL="$2"
      shift 2
      ;;
    --port)
      (($# >= 2)) || die "--port requires a value"
      PORT="$2"
      shift 2
      ;;
    --bind-address)
      (($# >= 2)) || die "--bind-address requires a value"
      BIND_ADDRESS="$2"
      shift 2
      ;;
    --env-file)
      (($# >= 2)) || die "--env-file requires a value"
      ENV_FILE="$(absolute_path "$2")"
      shift 2
      ;;
    --rotate-app-secrets)
      ROTATE_APP_SECRETS=1
      shift
      ;;
    --no-build)
      NO_BUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

cd "$ROOT_DIR"

command -v docker >/dev/null 2>&1 || die "Docker is required"
command -v openssl >/dev/null 2>&1 || die "OpenSSL is required"
command -v awk >/dev/null 2>&1 || die "awk is required"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"

if [[ ! -f "$ENV_FILE" ]]; then
  [[ -f "$ROOT_DIR/.env.example" ]] || die "Missing .env and .env.example"
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  CREATED_ENV=1
  log "Created $ENV_FILE from .env.example"
else
  backup_file="$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
  cp -p "$ENV_FILE" "$backup_file"
  log "Backed up environment to $(basename "$backup_file")"
fi

compose=(docker compose --env-file "$ENV_FILE")

get_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' "$ENV_FILE"
}

set_env() {
  local key="$1"
  local value="$2"
  local tmp_file
  tmp_file="$(mktemp "$ENV_FILE.tmp.XXXXXX")"

  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 {
      if (!replaced) print key "=" value
      replaced = 1
      next
    }
    { print }
    END {
      if (!replaced) print key "=" value
    }
  ' "$ENV_FILE" > "$tmp_file"

  chmod 600 "$tmp_file"
  mv "$tmp_file" "$ENV_FILE"
}

is_placeholder() {
  case "$1" in
    ""|generate_*|replace_*|change_me*) return 0 ;;
    *) return 1 ;;
  esac
}

csv_add() {
  local current="$1"
  local value="$2"
  local item

  IFS=',' read -r -a items <<< "$current"
  for item in "${items[@]}"; do
    [[ "$item" == "$value" ]] && {
      printf '%s\n' "$current"
      return
    }
  done

  if [[ -n "$current" ]]; then
    printf '%s,%s\n' "$current" "$value"
  else
    printf '%s\n' "$value"
  fi
}

valid_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && ((1 <= 10#$1 && 10#$1 <= 65535))
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -H -ltn | awk -v suffix=":$port" '$4 ~ suffix "$" { found = 1 } END { exit found ? 0 : 1 }'
    return $?
  fi
  return 1
}

if [[ -z "$PORT" ]]; then
  existing_port="$(get_env APP_PORT || true)"
  existing_nginx_id="$("${compose[@]}" ps -q nginx 2>/dev/null || true)"
  existing_nginx_port=""
  if [[ -n "$existing_nginx_id" ]]; then
    existing_nginx_port="$(docker port "$existing_nginx_id" 80/tcp 2>/dev/null | sed -nE 's/.*:([0-9]+)$/\1/p' | head -n1 || true)"
  fi
  if valid_port "$existing_port"; then
    PORT="$existing_port"
  elif valid_port "$existing_nginx_port"; then
    PORT="$existing_nginx_port"
  else
    PORT=8080
    while port_in_use "$PORT"; do
      ((PORT++))
      ((PORT <= 8099)) || die "No free port found in 8080-8099; pass --port explicitly"
    done
  fi
fi
valid_port "$PORT" || die "Invalid port: $PORT"

if [[ -z "$BIND_ADDRESS" ]]; then
  BIND_ADDRESS="$(get_env APP_BIND_ADDRESS || true)"
  BIND_ADDRESS="${BIND_ADDRESS:-127.0.0.1}"
fi

if [[ -z "$SITE_URL" ]]; then
  configured_site_url="$(get_env VITE_SITE_URL || true)"
  if (( CREATED_ENV )) || [[ -z "$configured_site_url" || "$configured_site_url" == "http://localhost" ]]; then
    SITE_URL="http://127.0.0.1:$PORT"
  else
    SITE_URL="$configured_site_url"
  fi
fi
SITE_URL="${SITE_URL%/}"
[[ "$SITE_URL" =~ ^https?://[^/]+$ ]] || die "--site-url must look like http(s)://host[:port]"

site_hostport="${SITE_URL#*://}"
site_host="${site_hostport%%:*}"
[[ -n "$site_host" ]] || die "Could not determine host from --site-url"

db_password="$(get_env DB_PASSWORD || true)"
if is_placeholder "$db_password"; then
  existing_db="$("${compose[@]}" ps -aq db 2>/dev/null || true)"
  if [[ -n "$existing_db" ]]; then
    die "DB_PASSWORD is not configured but an existing database container was found; set the original database password in .env"
  fi
  db_password="$(openssl rand -hex 24)"
  set_env DB_PASSWORD "$db_password"
  log "Generated DB_PASSWORD for this new database volume"
fi
[[ "$db_password" != *'$'* ]] || die 'DB_PASSWORD contains $; use a safe value without $ to avoid Compose interpolation'

for secret_key in DJANGO_SECRET_KEY JWT_SIGNING_KEY; do
  current_secret="$(get_env "$secret_key" || true)"
  if ((ROTATE_APP_SECRETS)) || is_placeholder "$current_secret"; then
    set_env "$secret_key" "$(openssl rand -hex 32)"
    log "Generated $secret_key"
    continue
  fi
  (( ${#current_secret} >= 50 )) || die "$secret_key must be at least 50 characters; use --rotate-app-secrets"
  [[ "$current_secret" != *'$'* ]] || die "$secret_key contains $; use --rotate-app-secrets"
done

current_hosts="$(get_env ALLOWED_HOSTS || true)"
current_hosts="$(csv_add "$current_hosts" "$site_host")"
current_hosts="$(csv_add "$current_hosts" localhost)"
current_hosts="$(csv_add "$current_hosts" 127.0.0.1)"

current_origins="$(get_env CORS_ALLOWED_ORIGINS || true)"
current_origins="$(csv_add "$current_origins" "$SITE_URL")"

set_env DJANGO_ENV production
set_env DJANGO_BASE_URL "$SITE_URL"
set_env ALLOWED_HOSTS "$current_hosts"
set_env CORS_ALLOWED_ORIGINS "$current_origins"
set_env SECURE_SSL_REDIRECT False
set_env APP_BIND_ADDRESS "$BIND_ADDRESS"
set_env APP_PORT "$PORT"
set_env VITE_API_URL /api
set_env VITE_WS_HOST "$site_hostport"
set_env VITE_SITE_URL "$SITE_URL"

if ! "${compose[@]}" config --quiet; then
  die "Compose configuration is invalid; review .env and docker-compose.yml"
fi

log "Deploying on ${BIND_ADDRESS}:${PORT} for ${SITE_URL}"
if ((NO_BUILD)); then
  if ! "${compose[@]}" up -d --force-recreate; then
    "${compose[@]}" ps >&2 || true
    "${compose[@]}" logs --no-color --tail=100 backend frontend nginx >&2 || true
    die "Compose deployment failed"
  fi
else
  if ! "${compose[@]}" up -d --build --force-recreate; then
    "${compose[@]}" ps >&2 || true
    "${compose[@]}" logs --no-color --tail=100 backend frontend nginx >&2 || true
    die "Compose deployment failed"
  fi
fi

wait_for_healthy() {
  local service="$1"
  local timeout_seconds=180
  local deadline=$((SECONDS + timeout_seconds))
  local container_id status health

  while ((SECONDS < deadline)); do
    container_id="$("${compose[@]}" ps -q "$service" 2>/dev/null || true)"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_id" 2>/dev/null || true)"
      [[ "$health" == "healthy" ]] && {
        log "$service is healthy"
        return 0
      }
      if [[ "$status" == "exited" || "$status" == "dead" ]]; then
        "${compose[@]}" logs --no-color --tail=100 "$service" >&2 || true
        die "$service stopped during deployment"
      fi
      [[ "$health" == "unhealthy" ]] && {
        "${compose[@]}" logs --no-color --tail=100 "$service" >&2 || true
        die "$service failed its healthcheck"
      }
    fi
    sleep 2
  done

  "${compose[@]}" logs --no-color --tail=100 "$service" >&2 || true
  die "Timed out waiting for $service"
}

wait_for_running() {
  local service="$1"
  local timeout_seconds=60
  local deadline=$((SECONDS + timeout_seconds))
  local container_id status

  while ((SECONDS < deadline)); do
    container_id="$("${compose[@]}" ps -q "$service" 2>/dev/null || true)"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
      [[ "$status" == "running" ]] && {
        log "$service is running"
        return 0
      }
    fi
    sleep 2
  done

  "${compose[@]}" logs --no-color --tail=100 "$service" >&2 || true
  die "Timed out waiting for $service"
}

wait_for_healthy backend
wait_for_healthy frontend
wait_for_running nginx

if command -v curl >/dev/null 2>&1; then
  curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$PORT/healthz" >/dev/null \
    || die "Public health endpoint failed: http://127.0.0.1:$PORT/healthz"
  log "Health endpoint passed"
fi

"${compose[@]}" ps
log "Deployment complete"
log "Open: $SITE_URL"
log "Internal check: http://127.0.0.1:$PORT/healthz"
