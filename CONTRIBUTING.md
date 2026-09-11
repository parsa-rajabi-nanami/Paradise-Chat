# Contributing to Paradise Chat

Thank you for contributing. This guide explains how to prepare a development environment, preserve the service contracts, and validate a pull request.

## Before you start

Read the [Code of Conduct](CODE_OF_CONDUCT.md), search existing issues, and choose the smallest change that addresses the problem. Use the repository's current commands and dependencies unless the change requires an update.

## Development setup

The default development settings use PostgreSQL and Redis. The supplied Docker Compose file starts both services without starting the application containers:

```bash
cp .env.example .env
docker compose up -d db redis
```

In `backend/`, create a virtual environment, load the root environment file, install dependencies, and run migrations:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
set -a; source ../.env; set +a
python manage.py migrate
python manage.py runserver
```

In a second terminal, install frontend dependencies and start Vite:

```bash
cd frontend
npm ci
cp .env-sample .env
npm run dev
```

Use `DJANGO_ENV=test` for the isolated pytest settings. Set `DEV_USE_SQLITE=1` only when you need the deliberate lightweight development fallback; Redis is still required for real-time features unless the test settings are active.

## Architecture rules

Preserve these contracts when changing the service:

- The backend exposes REST under `/api/` and WebSockets under `/ws/`
- Text messages, typing, reads, edits, and deletes can travel over WebSockets; file uploads use the authenticated REST message endpoint
- REST and WebSocket message operations write to the same database and broadcast to the same Redis group, `chat_{room_id}`
- WebSocket authentication uses a short-lived access JWT in the `token` query parameter because browsers cannot set handshake headers
- Messages use soft deletion. Normal user flows must not hard-delete a message
- Room queries must preserve active-room and active-parent filtering
- The frontend uses the singleton `wsService` and the two Zustand stores. Do not create a second WebSocket service
- Authenticated API calls must use the Axios client so token refresh and its concurrent-request queue remain active

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing transport, room hierarchy, authentication, or storage behavior.

## Making changes

1. Create a focused branch, such as `feat/group-invites`, `fix/ws-reconnect`, or `docs/installation-guide`
2. Inspect nearby tests before editing backend behavior
3. Add or update tests for changed REST, WebSocket, permission, migration, or storage behavior
4. Update the relevant documentation when a command, environment variable, API contract, or user-facing behavior changes
5. Run the smallest relevant checks, then run the full checks before opening a pull request

## Validation commands

Run backend checks from `backend/`:

```bash
python -m pytest
black --check .
flake8
```

Run frontend checks from `frontend/`:

```bash
npm run lint
npm run build
```

Run the deployment configuration check from the repository root:

```bash
docker compose config
```

## Pull request checklist

- [ ] The change has focused tests or a documented reason that tests do not apply
- [ ] Backend checks pass: pytest, Black, and Flake8
- [ ] Frontend checks pass: ESLint and the production build
- [ ] New migrations are included and reviewed for safe rollout
- [ ] REST and WebSocket event payloads remain compatible
- [ ] File uploads still use REST and authenticated streaming
- [ ] No message hard-delete was added to a normal user flow
- [ ] New environment variables appear in `.env.example` and `docs/CONFIGURATION.md`
- [ ] User-facing setup or behavior changes appear in `README.md` and the relevant guide
- [ ] `CHANGELOG.md` includes the change under `[Unreleased]` when appropriate
- [ ] No secrets, populated environment files, media files, database files, or build output were committed

## Code style and issue reports

Use Black and Flake8 for Python. Use functional React components, hooks, the `@` import alias, and the existing Zustand and Axios patterns for frontend changes. Validate and sanitize user input with the existing Django, Django REST Framework, and serializer conventions.

For bug reports, include the operating system, Python, Node.js, browser, PostgreSQL, and Redis versions; reproduction steps; expected and actual behavior; and relevant backend or browser logs. For WebSocket failures, name the affected endpoint, `/ws/chat/<room_id>/` or `/ws/status/`.

Use Conventional Commits, for example `docs: update installation guide` or `fix: preserve websocket event shape`.
