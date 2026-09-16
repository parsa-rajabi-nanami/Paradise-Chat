# Repository Guidelines

This file provides guidance to AI coding agents when working with code in this repository.

## Overview

Paradise Chat is a real-time chat app: a Django + Channels (ASGI) backend in `backend/` and a
React + Vite frontend in `frontend/`. The two are deployed and run separately and communicate over
REST (`/api/...`) and WebSockets (`/ws/...`).

## Commands

### Backend (run from `backend/`, with `venv` activated: `source venv/bin/activate`)

```bash
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver          # serves both HTTP and WebSockets via Daphne (ASGI)
python manage.py createsuperuser
python -m pytest                    # uses the configured test settings
black conftest.py manage.py  # format
find accounts chat chat_project -name '*.py' -exec black {} \;
flake8                             # lint
```

- **PostgreSQL and Redis must be running** in development (the supplied
  `docker-compose.yml` starts both). Development now uses the same engines as
  production; set `DEV_USE_SQLITE=1` only for a deliberate fallback.
- `pytest.ini` selects `chat_project.settings.test` for isolated
  SQLite/in-memory Channels settings. Tests cover auth, permissions,
  soft-delete, upload cleanup, REST/WS event parity, and
  `WebsocketCommunicator` consumer flows.
- The production-like stack is started with `docker compose up --build`; Nginx
  proxies `/api/`, `/ws/`, and `/healthz`, serves collected static files, and
  keeps direct `/media/` access private; authorized attachments use the
  authenticated stream endpoint and internal media location.

### Frontend (run from `frontend/`)

```bash
npm install
npm run dev        # Vite dev server on port 3000
npm run build
npm run lint       # eslint, fails on any warning (--max-warnings 0)
```

- `@` is aliased to `frontend/src` (see `vite.config.js`).
- Frontend env vars (`.env`): `VITE_API_URL`, `VITE_WS_HOST`, and `VITE_SITE_URL` — the WebSocket
  host is configured **separately** from the API URL.

## Settings & environment

`chat_project/settings/` is a package, not a module. `__init__.py` dispatches on the `DJANGO_ENV`
environment variable: `production` loads `production.py` (and requires `DJANGO_SECRET_KEY`,
`JWT_SIGNING_KEY`, `DB_PASSWORD`, `REDIS_URL`, and `REDIS_CACHE_URL`), anything else loads
`development.py`. Both inherit `base.py`.

- **Development**: PostgreSQL and Redis by default, CORS open to all for local
  use, and the same DRF throttling classes as production. SQLite is an explicit
  fallback only.
- **Production**: PostgreSQL, separate Redis database URLs for Channels/cache,
  full security headers/HSTS/SSL redirect, explicit host/CORS allow-lists, and
  a 15-minute default access JWT lifetime. Production also requires an
  absolute `DJANGO_BASE_URL` for URL generation.
- `base.py` reads config from `os.environ` directly (no `.env` autoloading is wired in), so env vars
  must be present in the process environment for production.

## Production learnings

Use this section as the agent-facing production reference. Operator procedures and the complete variable table live in [docs/CONFIGURATION.md](docs/CONFIGURATION.md), [docs/INSTALLATION.md](docs/INSTALLATION.md), and [docs/OPERATIONS.md](docs/OPERATIONS.md).

### Environment and media

- `DJANGO_ENV=development` loads local PostgreSQL/Redis defaults, `test` loads isolated SQLite, in-memory Channels, and local-memory cache, and `production` fails closed on missing secrets or allow-lists.
- Production requires `DJANGO_SECRET_KEY`, `JWT_SIGNING_KEY`, `DJANGO_BASE_URL`, `DB_PASSWORD`, `REDIS_URL`, `REDIS_CACHE_URL`, `ALLOWED_HOSTS`, and `CORS_ALLOWED_ORIGINS`. Set `SECURE_SSL_REDIRECT` to match the TLS proxy topology.
- Auth and upload abuse controls are configurable with `LOGIN_THROTTLE_RATE` (default `10/minute`), `REGISTER_THROTTLE_RATE` (`5/hour`), `REFRESH_THROTTLE_RATE` (`30/hour`), and `UPLOAD_THROTTLE_RATE` (`60/hour`). Refresh throttling is anonymous/IP-based; upload throttling applies to authenticated profile, room-avatar, and message-upload mutations.
- `MEDIA_STORAGE=local` uses `/app/media` and the persistent Compose `media_data` volume. Authorized Django media endpoints can return an internal `X-Accel-Redirect`; Nginx reads the file from its read-only media mount. Direct `/media/` requests return 404.
- `MEDIA_STORAGE=s3` uses `django-storages` with a private AWS or S3-compatible bucket. Keep query-string authorization enabled. Do not add a public bucket policy.
- The gateway serves collected Django static files from the persistent `static_data` volume. An outer TLS proxy must preserve `X-Forwarded-Proto`, `Host`, and WebSocket upgrade headers; otherwise generated media URLs can use the wrong scheme.
- `/healthz` is a public readiness endpoint: it runs `SELECT 1` and writes a short-lived cache key, returning 200 only when both database and Redis checks pass, otherwise 503.

### Upload conventions

- Profile and room avatars enter through `accounts.avatar_processing.process_avatar`. Pillow verifies decoded JPEG, PNG, or WebP content, applies EXIF orientation, center-crops to a square, strips metadata through RGB conversion, and writes a 512×512 WebP plus a 96×96 profile thumbnail.
- Avatar input is limited to 5 MB and 4096×4096 pixels. The client cropper improves the preview but is not a validation boundary. Direct multipart API calls must still pass the same serializer processing path.
- Message attachments are limited to 10 MB. `chat.validators.validate_attachment` checks the extension and libmagic-detected MIME type against the allow-list, rejects executable/script/HTML/SVG types, and stores opaque generated names.
- Soft-deleting a message removes its attachment from storage and clears the field. New upload features should reuse the existing validators and storage abstraction rather than trusting extensions or client MIME values.

### WebSocket authentication and reconnects

- Browser WebSockets send the short-lived access JWT as `?token=` because browser handshakes cannot set an Authorization header. `JWTAuthMiddleware` validates it on connect, stores the token in `scope["auth_token"]`, and sets `scope["user"]`.
- `chat.middleware.get_user_from_token` is one `@database_sync_to_async` callable: both `AccessToken(token_key)` decode/expiry validation and the `User.objects.get(...)` lookup run inside its worker. `ChatConsumer.refresh_authenticated_user` (called for every frame) and `OnlineStatusConsumer.refresh_authenticated_user` (called for every heartbeat) await that callable; invalid sessions close with code `4001`.
- The frontend refreshes access tokens through the REST refresh endpoint before handshakes and reconnects room/status sockets with exponential backoff. Keep the Nginx access log format based on `$uri`, not the raw request line, so query tokens are not logged.

### Deployment topology

- The production Compose stack is PostgreSQL plus Redis, a Gunicorn ASGI backend using Uvicorn workers, a built React frontend, and a gateway Nginx service.
- PostgreSQL uses `postgres_data`; local media uses `media_data`; collected backend static files use `static_data`. Redis holds Channels coordination and cache data, not application records.
- Before going live, configure separate random Django/JWT secrets, the public base URL, database credentials, Redis URLs, host/origin allow-lists, frontend `VITE_API_URL`/`VITE_WS_HOST` values, and either the local media volume or private S3 settings. Rebuild the frontend after changing any `VITE_*` value.

### Testing conventions and known boundaries

- Upload tests live in `backend/accounts/tests/test_auth.py` and `backend/chat/tests/test_permissions_and_messages.py`. Use `APIClient` multipart requests, `override_settings(MEDIA_ROOT=tmp_path)`, and Pillow assertions on stored dimensions and formats.
- Health and Nginx media-boundary contract tests live in `backend/chat_project/tests.py`; keep direct `/media/` and `/protected-media/` access private when changing the gateway config.
- WebSocket tests live in `backend/chat/tests/test_websockets.py`. Reuse the existing consumer subclasses and event-parity assertions when adding message, auth, or scheme tests. The test settings intentionally use in-memory Channels; production uses Redis-backed Channels.
- A live S3 bucket is not part of the test suite. The S3 settings path is checked by Django configuration validation; use a private integration environment before switching a deployment.
- Malware scanning through ClamAV or another service is not bundled. MIME/content validation is the current boundary. A future scanner must run before storage and preserve the same size and permission rules.
- A single-use WebSocket connection-ticket protocol is not implemented. The current query-token design remains documented and mitigated with short access lifetimes, revalidation, reconnect refresh, and sanitized proxy logs.
- With Channels 4.3/asgiref 3.12, the in-memory `WebsocketCommunicator` tests can deadlock in Channels' `aclose_old_connections` sync bridge when wrapped by `async_to_sync`; the full traceback ends at `channels.consumer.dispatch -> channels.db.aclose_old_connections -> sync_to_async(close_old_connections)`. The module fixture `disable_channels_connection_cleanup_for_communicator` patches only that harness cleanup, while production consumers and their `database_sync_to_async` methods remain unchanged. Diagnose this harness before changing production consumers; do not treat it as Redis misconfiguration.

## Architecture

### Real-time layer (the core of this app)

Messaging works over **two transports that both write to the DB and both broadcast to the same Redis
channel group `chat_{room_id}`**:

1. **WebSocket** (`chat/consumers.py::ChatConsumer`) handles text messages, typing, read receipts,
   edits, and deletes. Incoming frames are dispatched by a `type` field (`message`, `typing`, `read`,
   `edit`, `delete`) to `handle_*` methods.
2. **REST** (`chat/views.py`) handles the same operations for HTTP clients. Notably, **file
   attachments go through REST** (`POST .../messages/` with multipart), not the WebSocket — see
   `frontend/src/services/websocket.js::sendMessage`, which routes uploads to REST and plain text to
   the socket.

Both paths call `channel_layer.group_send(f"chat_{room_id}", {...})` with matching event types
(`chat_message`, `message_edited`, `message_deleted`, `user_join`, `user_leave`, ...). The consumer's
methods of those names then fan the event out to connected sockets. When editing REST or WS handlers,
keep these event payload shapes in sync, or clients will diverge.

There are **two WebSocket endpoints** (`chat/routing.py`):
- `ws/chat/<room_id>/` → `ChatConsumer` (per-room messaging).
- `ws/status/` → `OnlineStatusConsumer` (global online presence + 30s heartbeat).

**WebSocket auth**: JWT is passed in the query string (`?token=<access>`), not a header, because
browsers can't set headers on WS handshakes. `chat/middleware.py::JWTAuthMiddleware` validates it and
sets `scope["user"]`; the ASGI stack wires this in `chat_project/asgi.py`. Production bounds the token
lifetime and Nginx excludes query strings from access logs; see `SECURITY.md` for the trade-off.

### Data model (`chat/models.py`, `accounts/models.py`)

- **`ChatRoom`** has a self-referential `parent`/`subrooms` hierarchy and a `room_type` of
  `direct` / `group` / `subgroup`. Almost every query guards on the room being active *and* its parent
  being active: `Q(parent__isnull=True) | Q(parent__is_active=True)`. `chat/utils.py::flatten_rooms`
  recursively flattens the tree into a list with a `depth` field for the sidebar.
- **`RoomParticipant`** is the M2M through-model and carries `role` (`member`/`admin`/`owner`),
  typing state, and `last_read_at`. Role-based permissions live in `views.py::ManageParticipantView`
  (e.g. only an owner changes roles; an admin may only remove members).
- **`Message`** is **soft-deleted** (`is_deleted=True`, content replaced with a tombstone string) —
  never hard-deleted in normal flow. Read receipts are tracked via the `MessageRead` through-model.
  A `post_delete` signal (`chat/signals.py`) cleans up attachment files.
- **`User`** (custom, `AUTH_USER_MODEL=accounts.User`) logs in by **email** (`USERNAME_FIELD=email`),
  uses Argon2 hashing, tracks `is_online`/`last_seen`, and has a separate hashed `passphrase` field
  used to confirm sensitive actions like account deletion.

### Frontend (`frontend/src/`)

- **State is two Zustand stores**: `stores/authStore.js` (tokens + user, **persisted** to
  `localStorage` under `auth-storage`) and `stores/chatStore.js` (rooms, `messages` keyed by roomId,
  typing users, online users `Set`).
- **`services/websocket.js`** is a singleton (`wsService`) that owns both sockets, auto-reconnects with
  exponential backoff, and **mutates `chatStore` directly** as events arrive. UI components generally
  call `wsService` to send and read from the store to render.
- **`api/client.js`** is the axios instance. A request interceptor injects the Bearer token from
  `authStore`; a response interceptor catches `401`, refreshes the access token (queuing concurrent
  failures via `isRefreshing`/`failedQueue`), and logs out on refresh failure. The refresh call uses
  raw `axios` (not the instance) to avoid interceptor recursion, and auth routes are excluded from the
  retry logic.
- **Routing** (`App.jsx`) uses `react-router` with a `ProtectedRoute` wrapper; `ChatPage`,
  `UserSettings`, and `ChatSettings` are lazy-loaded.

### REST surface

- `api/auth/` (`accounts/urls.py`): JWT login/refresh, register, logout (token blacklist), profile,
  password change, account deletion, user list, online users.
- `api/chat/` (`chat/urls.py`): rooms (list/detail), participant management, messages
  (list/create/detail), direct-message creation, mark-as-read, typing status.

JWT uses rotating refresh tokens with blacklist-after-rotation (`SIMPLE_JWT` in `base.py`); access
tokens live 30 min in development and 15 min in production.
```
