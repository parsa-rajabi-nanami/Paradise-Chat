# Operations runbook

This runbook helps you deploy, verify, back up, restore, and troubleshoot Paradise Chat. It assumes the supplied Docker Compose stack unless a section says otherwise.

## Runtime model

The application has three durable or ephemeral storage boundaries:

- **PostgreSQL** stores users, rooms, participants, messages, read receipts, migrations, and refresh-token blacklist rows
- **Redis** stores Django cache entries and Channels group coordination. Redis loss should trigger reconnects and cache misses, not message loss
- **Media storage** stores avatars and message attachments. The default local backend uses the `media/` directory or the Compose `media_data` volume

The Compose Redis service uses database 0 for Channels and database 1 for Django cache. It limits memory to 256 MB and uses `allkeys-lru`. Production should monitor memory and evictions before increasing traffic.

## Pre-deployment checks

Before deploying a release, complete these checks:

1. Set production values in a secret-managed environment. Do not place credentials in the image or repository
2. Validate the rendered Compose configuration:

   ```bash
   docker compose --env-file .env config
   ```

3. Build the images and run the backend deployment check:

   ```bash
   docker compose build
   docker compose run --rm backend python manage.py check --deploy
   ```

4. Confirm that PostgreSQL, Redis, the backend, the frontend, and Nginx have healthy status
5. Confirm the public URL and WebSocket host match the `VITE_*` values baked into the frontend image
6. Create or verify a current PostgreSQL and media backup before a schema change

## Deploy with Docker Compose

For a repeatable deployment, use the repository script. It creates a protected
`.env` from the example when needed, preserves a timestamped backup, generates
missing application secrets, chooses a loopback port that does not collide with
an existing host proxy, rebuilds the frontend with same-origin API settings,
and waits for backend/frontend readiness:

```bash
chmod +x scripts/deploy.sh
scripts/deploy.sh --site-url https://chat.example.com --port 8080
```

Use `--rotate-app-secrets` only deliberately; rotating them invalidates existing
JWTs. The script never removes Docker volumes and refuses to invent a new
database password for an existing database container.

The backend container runs migrations and collects static files during startup. The frontend receives its Vite values at image build time, so rebuild the frontend after changing any `VITE_*` variable:

```bash
scripts/deploy.sh --site-url https://chat.example.com --port 8080
docker compose ps
curl -fsS http://127.0.0.1:8080/healthz
```

The health endpoint returns HTTP 200 only when both the database and Redis checks succeed. A failed dependency returns HTTP 503 and should prevent traffic from reaching the release.

## Safe migration and rollback

Apply migrations before shifting traffic when the migration is backward-compatible. For a multi-release change, deploy additive schema changes first, then deploy code that reads or writes them, and remove old fields in a later release.

Do not reverse an applied migration as an automatic rollback. Restore a verified backup or deploy a forward corrective migration after reviewing the data impact. Preserve the PostgreSQL and media volumes when replacing application images.

## PostgreSQL backup

Create a consistent custom-format backup from a host that can reach PostgreSQL. The command below reads the same connection variables used by the application:

```bash
backup_file="paradise-chat-$(date +%F).dump"
pg_dump --format=custom --file="$backup_file" \
  --host="$DB_HOST" --port="$DB_PORT" \
  --username="$DB_USER" "$DB_NAME"
```

Keep encrypted copies outside the application host and test restoration on a separate database. Inspect a backup before restoring it:

```bash
pg_restore --list paradise-chat-2026-01-15.dump
```

PostgreSQL does not contain uploaded files. Back up the media volume or directory separately, and keep its backup date aligned with the database backup:

```bash
docker run --rm \
  -v paradise-chat_media_data:/source:ro \
  -v "$PWD":/backup \
  alpine tar -czf /backup/media-2026-01-15.tar.gz -C /source .
```

Replace `paradise-chat_media_data` with the volume name shown by `docker volume ls` if your Compose project uses a different project name.

## Restore procedure

Restore into a new PostgreSQL database and a separate media directory first. Do not test a restore against the live database or media volume:

1. Create the target database and restore the custom-format dump with `pg_restore`
2. Extract the matching media backup into the target media directory
3. Start the backend against the restored database and run `python manage.py migrate`
4. Run `python manage.py check --deploy` and verify `/healthz`
5. Test login, room permissions, message history, attachment access, and WebSocket connection
6. Promote the restored database and media storage only after the checks pass

Redis does not need a data restore for application correctness. Restart it, verify `/healthz`, and allow clients to reconnect to their room and status sockets.

## Troubleshooting

### The containers do not start

Check the rendered variables and service logs:

```bash
docker compose --env-file .env config
docker compose ps
docker compose logs --tail=100 db redis backend frontend nginx
```

Missing values such as `DB_PASSWORD`, `ALLOWED_HOSTS`, or `CORS_ALLOWED_ORIGINS` stop production settings from loading. Set them in the environment used by Compose, then recreate the backend container.

If Compose warns that a variable such as `wchljt` is not set, inspect the names of `.env` values containing a dollar sign:

```bash
awk -F= '/\$/ {print $1}' .env
```

Generate application secrets with hexadecimal characters or replace the affected value with a safe value. Do not rotate `DB_PASSWORD` while a database volume contains data unless you also change the PostgreSQL role password deliberately.

### Host port 80 is already in use

The Compose gateway binds to `127.0.0.1:8080` by default. If another service owns port 80, keep that service in place and configure it to reverse proxy to `http://127.0.0.1:8080`:

```bash
ss -ltnp | grep ':80'
docker compose ps
```

Use `APP_PORT` to choose another host port. Do not expose PostgreSQL or Redis publicly to solve an HTTP port conflict.

### `/healthz` returns 503

Read the response body and backend logs:

```bash
curl -i http://127.0.0.1:8080/healthz
docker compose logs --tail=100 backend db redis
```

`database: error` usually means PostgreSQL is unavailable or its credentials do not match the Compose volume. `redis: error` usually means Redis is unavailable or the Redis URL is invalid.

### The browser reports a CORS error for `localhost`

The frontend stores Vite values in the image during the build. A page served from `127.0.0.1:8080` must not call `http://localhost/api` because the browser treats those as different origins. Set the API URL to `/api`, set the WebSocket host to the browser-facing host, and rebuild the frontend:

```bash
scripts/deploy.sh --site-url http://127.0.0.1:8080 --port 8080
```

For a public site, use the public origin in `--site-url`. Do not fix this by allowing every CORS origin in production.

### The frontend healthcheck reports connection refused

The frontend healthcheck uses `127.0.0.1` because some hosts resolve `localhost` to IPv6 while the Nginx image listens on IPv4. Confirm the rendered healthcheck and test the container directly:

```bash
docker compose --env-file .env config | grep -A6 'healthcheck:'
docker compose exec frontend wget -S -O /dev/null http://127.0.0.1/
```

### The browser cannot connect to WebSockets

Check these values and conditions:

- `VITE_WS_HOST` contains the public host and optional port, without `http://` or `https://`
- The browser uses `wss://` when the site uses HTTPS
- Nginx routes `/ws/` with HTTP/1.1 upgrade headers
- The access token is valid and has not exceeded `ACCESS_TOKEN_MINUTES`
- `ALLOWED_HOSTS` includes the request host and `CORS_ALLOWED_ORIGINS` includes the frontend origin

Rebuild the frontend after changing `VITE_WS_HOST`; Vite embeds these values during build.

### Migrations fail

Inspect the migration plan and database connectivity before changing files:

```bash
python manage.py showmigrations
python manage.py migrate --plan
python manage.py check
```

Take a backup, identify the failed migration in the logs, and repair the forward migration or database state deliberately. Do not mark a migration applied without verifying its schema changes.

### Attachments or avatars return 404

The production Nginx configuration intentionally returns 404 for direct `/media/` requests. Use the authenticated attachment or avatar endpoint through the application, and verify that the backend and Nginx containers share the `media_data` volume in the Compose deployment.

### Login or registration is throttled

The default limits are `10/minute` for login and `5/hour` for registration. Wait for the window to expire or review `LOGIN_THROTTLE_RATE` and `REGISTER_THROTTLE_RATE` in a controlled deployment. Do not disable throttling on a public instance without an alternative abuse control.

## Monitoring essentials

Monitor the `/healthz` status, PostgreSQL disk usage and connection errors, Redis memory and evictions, container restarts, Nginx 4xx and 5xx responses, WebSocket disconnects, and media storage capacity. Keep application logs available for request IDs and deployment timestamps when investigating a report.
