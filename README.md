# Paradise Chat

A modern, production-ready real-time chat application built with Django, Django Channels, React, PostgreSQL, and Redis.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Python 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue)
![Node 18+](https://img.shields.io/badge/Node-18%2B-green)
![PostgreSQL 14+](https://img.shields.io/badge/PostgreSQL-14%2B-blue)
![Redis 6+](https://img.shields.io/badge/Redis-6%2B-red)

---

## Features

**User**
- Real-time messaging with WebSockets
- Private chats
- Group chats
- Online/offline status
- Message editing and deletion
- Mute and permission system

**Backend / API**
- JWT authentication
- REST API powered by Django REST Framework
- User management
- File attachments via REST

**Frontend**
- Responsive React frontend
- State management with Zustand

---

## Requirements

| Requirement | Minimum |
|---|---|
| Python | 3.12+ |
| Node.js | 18+ (20 LTS Recommended) |
| npm | 9+ |
| PostgreSQL | 14+ |
| Redis | 6+ |

---

## Project Structure

```text
backend/
frontend/
```

---

## Installation

### Backend Setup

1. Clone the repository:
   ```bash
   git clone git@github.com:parsa-rajabi-nanami/Paradise-Chat.git
   cd Paradise-Chat
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the root example file, set local PostgreSQL, Redis, and secret values,
   and export it for the current shell. Do not commit `.env`.
   ```bash
   cp ../.env.example ../.env
   set -a; source ../.env; set +a
   ```
5. Start the production-like local dependencies:
   ```bash
   cd ..
   docker compose up -d db redis
   cd backend
   ```
6. Apply migrations:
   ```bash
   python manage.py migrate
   ```
7. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```
8. Run the development server:
   ```bash
   python manage.py runserver
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```env
   VITE_API_URL=http://localhost:8000/api
   VITE_WS_HOST=localhost:8000
   VITE_SITE_URL=http://localhost:3000
   ```
4. Start the Vite dev server:
   ```bash
   npm run dev
   ```

---

## Usage

### 1. Start the backend
Run the Django development server as described above. It serves both HTTP and WebSocket connections via Daphne (ASGI).

### 2. Start the frontend
Run the Vite dev server as described above. The frontend runs on `http://localhost:3000` by default.

### 3. Authenticate and chat
- Register a new account or log in with an existing user.
- Create or join private and group chats.

---

## Configuration

The backend settings live in `chat_project/settings/` and are selected based on the `DJANGO_ENV` environment variable.

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_ENV` | `development` | Which settings module to load (`development` or `production`) |
| `DJANGO_SECRET_KEY` | dev-only fallback | Required and strong in production |
| `JWT_SIGNING_KEY` | — | Required separate JWT signing secret in production |
| `ACCESS_TOKEN_MINUTES` | `15` in production | Access JWT lifetime; bounds WS query-token exposure |
| `VITE_API_URL` | — | Base URL for the REST API used by the frontend |
| `VITE_WS_HOST` | — | WebSocket host used by the frontend |
| `VITE_SITE_URL` | — | Public frontend origin used in metadata |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | — | PostgreSQL connection settings |
| `REDIS_URL`, `REDIS_CACHE_URL` | — | Separate Channels and cache Redis URLs |
| `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` | — | Required explicit production allow-lists |
| `LOGIN_THROTTLE_RATE`, `REGISTER_THROTTLE_RATE` | `10/minute`, `5/hour` | Auth abuse limits |
| `WS_RATE_LIMIT_WINDOW_SECONDS`, `WS_RATE_LIMIT_MESSAGES` | `10`, `30` | Per-connection WS flood guard |

---

## WebSocket Endpoints

| Endpoint | Description |
|---|---|
| `/ws/chat/<room_id>/` | Per-room messaging (text, typing, read receipts, edits, deletes) |
| `/ws/status/` | Global online presence and 30s heartbeat |
| `/api/chat/messages/<message_id>/attachment/` | Authenticated attachment stream for room participants |

---

## Security

- JWT authentication with rotating refresh tokens and blacklist after rotation
- Argon2 password hashing for user accounts
- Soft-delete for messages
- Passphrase confirmation for sensitive actions
- Production settings enable full security headers, HSTS, and SSL redirect
- File uploads are handled over authenticated REST endpoints
- WebSocket query JWTs are short-lived in production and excluded from the
  supplied Nginx access-log request line; see [SECURITY.md](SECURITY.md)
- Attachments are streamed through an authenticated endpoint; `/media/` is not
  public in the production Nginx configuration

---

## Development

### Backend

```bash
cd backend
source venv/bin/activate
black .
flake8
DJANGO_ENV=test pytest
```

For the full production-like stack, copy `.env.example` to `.env` and run
`docker compose up --build`. The stack starts PostgreSQL, Redis, the ASGI
backend, the Vite-built frontend, and Nginx with WebSocket upgrade support.

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## License

[MIT](LICENSE) © 2026 Parsa Rajabi
