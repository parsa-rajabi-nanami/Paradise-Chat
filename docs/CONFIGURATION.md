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
| `DJANGO_BASE_URL` | Development-only local URL | Production: yes | Public absolute URL used when serializers build URLs without a request; production rejects a missing or non-http(s) value |
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
| `SECURE_SSL_REDIRECT` | `True` in production and Compose | No | Redirect HTTP to HTTPS when the proxy forwards HTTPS correctly. Set `False` only for a deliberately HTTP-only internal hop behind a trusted TLS terminator |
| `ACCESS_TOKEN_MINUTES` | `30` development, `15` production | No | Access JWT lifetime and WebSocket query-token exposure window |
| `LOGIN_THROTTLE_RATE` | `10/minute` | No | Login attempts per throttle window |
| `REGISTER_THROTTLE_RATE` | `5/hour` | No | Registration attempts per throttle window |
| `REFRESH_THROTTLE_RATE` | `30/hour` | No | Anonymous refresh-token rotations per throttle window |
| `UPLOAD_THROTTLE_RATE` | `60/hour` | No | Authenticated profile, room-avatar, and message-upload mutations per throttle window |
| `WS_RATE_LIMIT_WINDOW_SECONDS` | `10` | No | Inbound WebSocket rate-limit window |
| `WS_RATE_LIMIT_MESSAGES` | `30` | No | Maximum inbound WebSocket frames in that window |
| `MEDIA_STORAGE` | `local` | No | `local` uses the persisted Compose volume; `s3` uses django-storages with a private S3-compatible bucket |
| `MEDIA_ROOT` | `backend/media` | No | Local media directory. In Compose this is `/app/media` and is backed by `media_data` |
| `USE_NGINX_ACCEL_REDIRECT` | `True` in production local storage | No | Lets authorized Django media responses hand local files to Nginx through an internal location |
| `AWS_STORAGE_BUCKET_NAME` | — | S3 only | Private bucket name |
| `AWS_S3_REGION_NAME` | — | No | S3 region, when required by the provider |
| `AWS_S3_ENDPOINT_URL` | — | No | S3-compatible endpoint such as MinIO; leave empty for AWS |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | — | Provider-dependent | Credentials or use the provider's workload/IAM identity |

Production fails closed when `DJANGO_SECRET_KEY`, `JWT_SIGNING_KEY`, `DJANGO_BASE_URL`, `DB_PASSWORD`, `REDIS_URL`, `REDIS_CACHE_URL`, `ALLOWED_HOSTS`, or `CORS_ALLOWED_ORIGINS` is missing. Compose supplies internal `DB_HOST`, `DB_PORT`, `REDIS_URL`, and `REDIS_CACHE_URL` values to the backend service.

## Compose-only variables

These variables control host bindings or process count in `docker-compose.yml`:

| Variable | Default | Description |
| --- | --- | --- |
| `DB_BIND_ADDRESS` | `127.0.0.1` | Host address for the PostgreSQL port mapping |
| `REDIS_BIND_ADDRESS` | `127.0.0.1` | Host address for the Redis port mapping |
| `APP_BIND_ADDRESS` | `127.0.0.1` | Host address for the Compose Nginx gateway |
| `APP_PORT` | `8080` | Host port mapped to the Compose Nginx gateway |
| `WEB_CONCURRENCY` | `2` | Gunicorn worker count for the backend container |

Bind database, Redis, and the application gateway to localhost when an external reverse proxy such as aaPanel owns public ports 80 and 443. Set `APP_BIND_ADDRESS=0.0.0.0` only when the host firewall and deployment design require direct public access.

The deployment script chooses an unused port from `8080` through `8099` when a new `.env` does not define `APP_PORT`. It preserves an existing `APP_PORT` on later runs and fails before starting Compose if that port is occupied by another process. Use `--port` or update `.env` to select a different port.

## Frontend variables

Vite reads these values during `npm run build` or the frontend Docker image build. Changing them after the image is built has no effect until you rebuild the frontend:

| Variable | Example | Description |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Axios base URL. Include the `/api` path; use a relative value behind the supplied reverse proxy |
| `VITE_WS_HOST` | `chat.example.com` | WebSocket host and optional port. Do not include `http://`, `https://`, `ws://`, or `wss://` |
| `VITE_DEV_BACKEND_URL` | `http://127.0.0.1:8000` | Vite development proxy target for `/api`, `/ws`, and `/healthz`; not used by the production bundle |
| `VITE_SITE_URL` | `https://chat.example.com` | Public site URL passed to the frontend build. Keep it aligned with the deployed origin |
| `VITE_SOURCEMAP` | `false` | Set to `true` to generate frontend source maps. Keep them private when enabled |

The frontend image installs the lockfile from the official npm registry
(`https://registry.npmjs.org`) and does not accept an arbitrary registry override. This keeps
production builds on the same trusted package source as the committed lockfile.

The browser selects `ws://` for an HTTP page and `wss://` for an HTTPS page. The client appends `/ws/chat/<room_id>/` and `/ws/status/` to `VITE_WS_HOST`. Set `VITE_WS_HOST` to the browser-facing host, not the internal backend service name.

## Deployment profiles

Choose one profile and keep the frontend and backend values aligned:

| Profile | `VITE_API_URL` | `VITE_WS_HOST` | Compose gateway |
| --- | --- | --- | --- |
| Local through Compose | `/api` | `127.0.0.1:8080` | `127.0.0.1:8080` |
| aaPanel or host proxy | `/api` | `chat.example.com` | `127.0.0.1:8080` |
| Standalone public HTTP | `/api` | `chat.example.com:8080` | `0.0.0.0:8080` |

For a public HTTPS site, keep `VITE_API_URL=/api`, set `VITE_WS_HOST` to the public hostname, and set `VITE_SITE_URL` to the HTTPS origin. The browser then sends REST and WebSocket requests through the same public origin.

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

Message attachments are limited to 10 MB by the validator and accept JPEG, PNG, WebP, PDF, plain text, Microsoft Office document types, and ZIP files. Script, executable, HTML, SVG, and other unsafe extensions are rejected. Avatar inputs accept JPEG, PNG, and WebP content up to 5 MB with dimensions up to 4,096 by 4,096 pixels, then are normalized to the smaller WebP sizes described below.

Avatar uploads are normalized server-side regardless of the client: Pillow
verifies the image content, applies EXIF orientation, center-crops to a square,
re-encodes the main image as a 512px WebP, and stores a 96px WebP thumbnail for
list views. The browser also offers a square drag/zoom crop step for a better
preview, but it is not a security boundary.

## Media storage and serving

With `MEDIA_STORAGE=local`, the Compose deployment mounts `media_data` into
both the backend and gateway. Django authorizes `/api/auth/users/.../avatar/`,
`/api/chat/.../attachment/`, and room-avatar requests; for local storage it
returns an internal `X-Accel-Redirect`, and Nginx reads the file from the
persisted volume with private caching and `nosniff`. Direct `/media/` requests
remain disabled, so guessing an opaque filename cannot bypass room permissions.

For a multi-node or object-storage deployment, set `MEDIA_STORAGE=s3`, create a
private bucket, and provide the bucket and endpoint variables above. Keep
`AWS_QUERYSTRING_AUTH` enabled (the production settings do this) and grant the
application only the bucket permissions it needs. The API endpoints continue
to authorize access and stream from the storage abstraction, so no public
bucket policy is required.
