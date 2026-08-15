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
4. Ensure Redis is running on `127.0.0.1:6379`.
5. Apply migrations:
   ```bash
   python manage.py migrate
   ```
6. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```
7. Run the development server:
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
   VITE_API_URL=http://localhost:8000
   VITE_WS_HOST=ws://localhost:8000
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
| `DJANGO_SECRET_KEY` | (hardcoded in dev) | Required in production |
| `VITE_API_URL` | — | Base URL for the REST API used by the frontend |
| `VITE_WS_HOST` | — | WebSocket host used by the frontend |
| PostgreSQL settings | — | Production uses PostgreSQL; see `chat_project/settings/base.py` for all variables |
| Redis settings | — | Redis is used for the Channels layer and cache |

---

## WebSocket Endpoints

| Endpoint | Description |
|---|---|
| `/ws/chat/<room_id>/` | Per-room messaging (text, typing, read receipts, edits, deletes) |
| `/ws/status/` | Global online presence and 30s heartbeat |

---

## Security

- JWT authentication with rotating refresh tokens and blacklist after rotation
- Argon2 password hashing for user accounts
- Soft-delete for messages
- Passphrase confirmation for sensitive actions
- Production settings enable full security headers, HSTS, and SSL redirect
- File uploads are handled over authenticated REST endpoints
- All WebSocket connections are authenticated via JWT in the query string

---

## Development

### Backend

```bash
cd backend
source venv/bin/activate
black .
flake8
pytest
```

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