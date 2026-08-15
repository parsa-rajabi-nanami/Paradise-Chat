# Repository Guidelines

This file provides guidance to AI coding agents when working with code in this repository.

## Overview

Paradise Chat is a real-time chat app: a Django + Channels (ASGI) backend in `backend/` and a
React + Vite frontend in `frontend/`. The two are deployed and run separately and communicate over
REST (`/api/...`) and WebSockets (`/ws/...`).

## Commands

### Backend (run from `backend/`, with `venv` activated: `source venv/bin/activate`)

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver          # serves both HTTP and WebSockets via Daphne (ASGI)
python manage.py createsuperuser
black .                             # format
flake8                             # lint
```

- **Redis must be running** (`127.0.0.1:6379`) even in development — the Channels layer uses
  `RedisChannelLayer`, so WebSockets fail without it.
- `pytest`, `pytest-django`, and `pytest-asyncio` are installed, but there are currently **no tests
  and no pytest config**. Running `pytest` requires setting `DJANGO_SETTINGS_MODULE=chat_project.settings`.

### Frontend (run from `frontend/`)

```bash
npm install
npm run dev        # Vite dev server on port 3000
npm run build
npm run lint       # eslint, fails on any warning (--max-warnings 0)
```

- `@` is aliased to `frontend/src` (see `vite.config.js`).
- Frontend env vars (`.env`): `VITE_API_URL`, and `VITE_WS_HOST` — the WebSocket host is configured
  **separately** from the API URL.

## Settings & environment

`chat_project/settings/` is a package, not a module. `__init__.py` dispatches on the `DJANGO_ENV`
environment variable: `production` loads `production.py` (and requires `DJANGO_SECRET_KEY`), anything
else loads `development.py`. Both inherit `base.py`.

- **Development**: SQLite (`db.sqlite3`), a hardcoded insecure secret key, CORS open to all, throttling
  disabled. Despite the README listing PostgreSQL, dev actually runs on SQLite.
- **Production**: PostgreSQL, Redis cache, full security headers/HSTS/SSL redirect.
- `base.py` reads config from `os.environ` directly (no `.env` autoloading is wired in), so env vars
  must be present in the process environment for production.

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
sets `scope["user"]`; the ASGI stack wires this in `chat_project/asgi.py`.

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
tokens live 30 min.
```