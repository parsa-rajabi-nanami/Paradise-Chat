# Contributing to Paradise Chat

Thank you for taking the time to contribute.

---

## Table of contents

- [Code of Conduct](#code-of-conduct)
- [How to report a bug](#how-to-report-a-bug)
- [How to request a feature](#how-to-request-a-feature)
- [Development setup](#development-setup)
- [Making changes](#making-changes)
- [Pull request checklist](#pull-request-checklist)
- [Coding standards](#coding-standards)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to abide by its terms.

---

## How to report a bug

1. Search [existing issues](https://github.com/your-org/paradise-chat/issues) first.
2. If none match, open a **Bug Report** using the issue template.
3. Include the following:
   - Backend: Python version, Django version, PostgreSQL version, Redis version.
   - Frontend: Node.js version, browser and version.
   - Steps to reproduce, expected vs actual behaviour.
   - Relevant logs (backend console, browser console, network tab).
   - If the bug is WebSocket-related, note whether it occurs on `ws/chat/<room_id>/`, `ws/status/`, or both.

---

## How to request a feature

Open a **Feature Request** using the issue template and describe the use case clearly. Include any relevant UI/UX expectations and how the feature should integrate with the existing REST or WebSocket architecture.

---

## Development setup

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.12+ |
| Node.js | 18+ (20 LTS recommended) |
| npm | 9+ |
| PostgreSQL | 14+ |
| Redis | 6+ |

> **Note:** The development settings (`DJANGO_ENV=development`) use SQLite by default, but PostgreSQL is required for production and is recommended if you are working on database-specific features.

### Quick start

```bash
git clone git@github.com:parsa-rajabi-nanami/Paradise-Chat.git
cd paradise-chat
```

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

#### Frontend

In a separate terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

**Required environment variables (frontend):**

```env
VITE_API_URL=http://localhost:8000
VITE_WS_HOST=ws://localhost:8000
```

**Required services:** Redis must be running on `127.0.0.1:6379` even in development because the Channels layer uses `RedisChannelLayer`.

### Manual setup

If you prefer manual control:

1. Create a Python virtual environment in `backend/` and install dependencies.
2. Ensure PostgreSQL and Redis are running (or switch `DJANGO_ENV` to `development` to use SQLite).
3. Set any production-only environment variables if you run with `DJANGO_ENV=production`.
4. Run migrations, create a superuser, and start the server.
5. In `frontend/`, install npm dependencies and start the Vite dev server.

---

## Making changes

### Architecture rules

#### Backend

- Messaging works over **two transports** that both write to the DB and broadcast to the same Redis channel group `chat_{room_id}`:
  1. WebSocket (`chat/consumers.py::ChatConsumer`) handles text messages, typing, read receipts, edits, and deletes.
  2. REST (`chat/views.py`) handles the same operations for HTTP clients, including file attachments (multipart).
- When adding or modifying message-related actions, **keep the event payload shapes in sync** across REST and WebSocket handlers. Event types include `chat_message`, `message_edited`, `message_deleted`, `user_join`, `user_leave`, and others.
- **Never hard-delete messages** in normal flow; use the soft-delete pattern (`is_deleted=True` and a tombstone content).
- WebSocket authentication uses a JWT in the query string (`?token=<access>`). Do not switch to header-based auth for WS.
- Role-based permissions for room participants live in `chat/views.py::ManageParticipantView`. Preserve the existing owner/admin/member hierarchy.
- Read `chat/utils.py::flatten_rooms` before modifying room tree logic; the sidebar depends on its recursive flattening and `depth` field.
- All new model queries that involve rooms should respect the active-parent condition: `Q(parent__isnull=True) | Q(parent__is_active=True)`.

#### Frontend

- State is managed by two Zustand stores: `authStore` (persisted to `localStorage`) and `chatStore`. Components should read from the store and call `wsService` to send.
- `services/websocket.js` is a singleton that owns both WebSocket connections, auto-reconnects with exponential backoff, and mutates `chatStore` directly. Do not create additional WebSocket instances.
- File attachments must go through REST (`api/client.js`), not the WebSocket. The `sendMessage` method in `wsService` already routes uploads correctly.
- When adding new UI components, prefer lazy-loading them in `App.jsx` to match the current pattern.
- `api/client.js` handles token refresh with a queue; do not bypass the interceptors for authenticated requests.

### Branch naming

```
feat/short-description
fix/short-description
docs/short-description
chore/short-description
```

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add group chat creation modal
fix: correct WebSocket reconnect backoff
docs: update environment variable guide
```

---

## Pull request checklist

- [ ] Backend code formatted with Black and passes Flake8
- [ ] Frontend code passes ESLint (`npm run lint`)
- [ ] New REST or WebSocket events keep payload shapes consistent between consumer and view handlers
- [ ] Database changes include migrations (if applicable)
- [ ] No hard-deletes added to message flows
- [ ] Frontend changes do not break the two‑transport rule (file uploads still use REST)
- [ ] New environment variables documented in README or settings comments
- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] README.md updated if the change affects user-facing behaviour or setup
- [ ] No commented-out code committed

---

## Coding standards

### Backend

- Follow [Django coding style](https://docs.djangoproject.com/en/dev/internals/contributing/writing-code/coding-style/).
- Python code is formatted with [Black](https://black.readthedocs.io/) and linted with [Flake8](https://flake8.pycqa.org/).
- Use Django’s ORM, avoid raw SQL unless absolutely necessary.
- Ensure all user input is validated and sanitised; use Django forms or DRF serializers.
- Follow the existing model method and property naming conventions (`is_active`, `is_online`, `room_type`, etc.).

### Frontend

- Follow the existing React + Vite project conventions.
- JavaScript/JSX is linted with ESLint; `npm run lint` must pass with zero warnings.
- Use functional components and hooks.
- Keep Zustand stores focused; do not add unrelated state to `chatStore` or `authStore`.
- Use `@` alias for imports from `src/`.

### General

- All new code should be readable, well-named, and consistent with the surrounding codebase.
- Prefer small, focused pull requests over large monolithic ones.
- If you are unsure about architecture, open an issue or draft PR to discuss before implementing.