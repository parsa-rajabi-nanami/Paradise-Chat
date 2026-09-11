# Configure Paradise Chat

This reference explains how settings are selected and how each supported environment variable changes the service. Set variables in the process environment. Django does not load `.env` automatically; shell commands and process supervisors must load the file before starting the backend.

## Select a settings environment

`backend/chat_project/settings/__init__.py` reads `DJANGO_ENV`:

| Value | Settings | Main behavior |
| --- | --- | --- |
| `development` or unset | `development.py` | Local hosts, open development CORS, PostgreSQL and Redis defaults |
| `production` | `production.py` | Required secrets and allow-lists, PostgreSQL, Redis, HTTPS security settings |
| `test` | `test.py` | Isolated SQLite, in-memory Channels, local memory cache, disabled throttles |

Unknown values use the development settings. Set `DJANGO_ENV` explicitly in deployment environments.

## Backend variables

The following variables are read by Django or the Compose backend service:

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `DJANGO_ENV` | `development` | Production: yes | Selects the settings package |
| `DJANGO_SECRET_KEY` | Development fallback | Production: yes | Django signing and security secret. Use a random value |
| `JWT_SIGNING_KEY` | Django secret fallback | Production: yes | Separate signing key for access and refresh JWTs |
| `DJANGO_BASE_URL` | `http://127.0.0.1:8000` | No | Base URL used when serializers build absolute URLs without a request |
| `DB_NAME` | `chat_db` | Production: no | PostgreSQL database name |
| `DB_USER` | `chat_user` | Production: no | PostgreSQL role |
| `DB_PASSWORD` | Development fallback | Production: yes | PostgreSQL role password |
| `DB_HOST` | `127.0.0.1` in development | No | PostgreSQL host. Compose sets `db` |
| `DB_PORT` | `5432` | No | PostgreSQL port |
| `REDIS_URL` | `redis://localhost:6379/0` | Production: yes | Channels Redis URL. Use database 0 in the supplied Compose stack |
| `REDIS_CACHE_URL` | `redis://localhost:6379/1` | Production: yes | Django cache Redis URL. Use database 1 in the supplied Compose stack |
| `DEV_USE_SQLITE` | `0` | No | Set to `1` for the deliberate development SQLite fallback |
| `ALLOWED_HOSTS` | Local hosts in development | Production: yes | Comma-separated host names accepted by Django |
| `CORS_ALLOWED_ORIGINS` | Open in development | Production: yes | Comma-separated browser origins, including the scheme |
| `SECURE_SSL_REDIRECT` | `True` in production | No | Redirect HTTP to HTTPS when the proxy forwards HTTPS correctly |
| `ACCESS_TOKEN_MINUTES` | `30` development, `15` production | No | Access JWT lifetime and WebSocket query-token exposure window |
| `LOGIN_THROTTLE_RATE` | `10/minute` | No | Login attempts per throttle window |
| `REGISTER_THROTTLE_RATE` | `5/hour` | No | Registration attempts per throttle window |
| `WS_RATE_LIMIT_WINDOW_SECONDS` | `10` | No | Inbound WebSocket rate-limit window |
| `WS_RATE_LIMIT_MESSAGES` | `30` | No | Maximum inbound WebSocket frames in that window |

Production fails closed when `DJANGO_SECRET_KEY`, `JWT_SIGNING_KEY`, `DB_PASSWORD`, `REDIS_URL`, `REDIS_CACHE_URL`, `ALLOWED_HOSTS`, or `CORS_ALLOWED_ORIGINS` is missing. Compose supplies internal `DB_HOST`, `DB_PORT`, `REDIS_URL`, and `REDIS_CACHE_URL` values to the backend service.

## Compose-only variables

These variables control host bindings or process count in `docker-compose.yml`:

| Variable | Default | Description |
| --- | --- | --- |
| `DB_BIND_ADDRESS` | `127.0.0.1` | Host address for the PostgreSQL port mapping |
| `REDIS_BIND_ADDRESS` | `127.0.0.1` | Host address for the Redis port mapping |
| `WEB_CONCURRENCY` | `2` | Gunicorn worker count for the backend container |

Bind database and Redis ports to localhost unless another trusted service needs host access.

## Frontend variables

Vite reads these values during `npm run build` or the frontend Docker image build. Changing them after the image is built has no effect until you rebuild the frontend:

| Variable | Example | Description |
| --- | --- | --- |
| `VITE_API_URL` | `https://chat.example.com/api` | Axios base URL. Include the `/api` path |
| `VITE_WS_HOST` | `chat.example.com` | WebSocket host and optional port. Do not include `http://`, `https://`, `ws://`, or `wss://` |
| `VITE_SITE_URL` | `https://chat.example.com` | Public site URL passed to the frontend build. Keep it aligned with the deployed origin |
| `VITE_SOURCEMAP` | `false` | Set to `true` to generate frontend source maps. Keep them private when enabled |

`NPM_REGISTRY` is a Compose build argument rather than a browser setting. Compose defaults to
`https://mirror-npm.runflare.com` for the target deployment environment; set it in the root `.env`
to `https://registry.npmjs.org` or another reachable npm-compatible mirror when appropriate. The
lockfile integrity hashes still verify the downloaded packages.

The browser selects `ws://` for an HTTP page and `wss://` for an HTTPS page. The client appends `/ws/chat/<room_id>/` and `/ws/status/` to `VITE_WS_HOST`.

## Runtime controls in Django Admin

The singleton **Chat configuration** record in `/admin/` controls selected application behavior without a code deployment:

- Registration enabled or disabled
- File uploads enabled or disabled
- Moderation and maintenance flags
- Maximum message length, default 5,000 characters
- Maximum attachment size, default 10 MB
- Site name, description, and brand colors

Create a superuser with `python manage.py createsuperuser` or the equivalent Compose command. Keep Admin behind authentication and a protected network.

## Token and upload defaults

The backend uses rotating refresh tokens with blacklist-after-rotation. Access tokens last 30 minutes in development and 15 minutes in production by default. The browser sends the access token in the WebSocket `token` query parameter because browser WebSocket APIs cannot set an Authorization header.

Message attachments are limited to 10 MB by the validator and accept JPEG, PNG, WebP, PDF, plain text, Microsoft Office document types, and ZIP files. Script, executable, HTML, SVG, and other unsafe extensions are rejected. Avatars accept JPG, JPEG, PNG, and WebP files up to 500 KB with dimensions up to 2,000 by 2,000 pixels.
