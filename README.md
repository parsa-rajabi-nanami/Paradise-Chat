# Paradise Chat

Paradise Chat is a real-time messaging service for direct conversations, group chats, file attachments, online presence, and room administration. The service uses a Django and Django Channels backend, a React and Vite frontend, PostgreSQL for durable data, and Redis for real-time coordination and caching.

This README helps you choose an installation path. Read the [installation guide](docs/INSTALLATION.md) for commands, the [user guide](docs/USER_GUIDE.md) for day-to-day use, and the [operations runbook](docs/OPERATIONS.md) for deployment, backups, and troubleshooting.

## What you can do

- Create an account with email, username, password, and a security passphrase
- Start direct conversations and group chats
- Organize groups with optional subgroups
- Send text messages and validated attachments up to 10 MB
- Edit or soft-delete your own text messages
- See typing indicators, read receipts, and online presence
- Manage group members with owner, admin, and member roles
- Update your profile, avatar, notification preferences, and security credentials

## Choose an installation path

Use one of these supported paths:

- **Development**: Run PostgreSQL and Redis with Docker Compose, then run Django and Vite from the source tree
- **Production with Docker**: Run the complete PostgreSQL, Redis, backend, frontend, and Nginx stack with Compose
- **Manual installation**: Install PostgreSQL and Redis on the host, then run the backend and frontend with a process supervisor and reverse proxy

The [installation guide](docs/INSTALLATION.md) lists prerequisites and includes all three paths. The root [.env.example](.env.example) is the canonical environment variable checklist.

## Quick start for development

The development workflow keeps the application processes on your machine and runs PostgreSQL and Redis in Docker. It gives you production-like database and real-time behavior while keeping code reload available.

1. Install Python 3.12 or newer, Node.js 18 or newer, npm 9 or newer, Docker, and Docker Compose
2. Copy the environment template and adjust local values:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL and Redis:

   ```bash
   docker compose up -d db redis
   ```

4. Create the backend environment, install packages, and migrate the database:

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   set -a; source ../.env; set +a
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```

5. In a second terminal, install and start the frontend:

   ```bash
   cd frontend
   npm ci
   cp .env-sample .env
   npm run dev
   ```

6. Open `http://localhost:3000`, register an account, and start a conversation

For the complete setup, including Windows notes and production configuration, read [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Project structure

```text
backend/                 Django project, REST API, WebSocket consumers, and tests
frontend/                React application, Vite build, and client state
deploy/nginx/            Reverse proxy configuration for the Compose stack
docs/                    Installation, usage, architecture, API, and operations guides
docker-compose.yml       PostgreSQL, Redis, backend, frontend, and Nginx services
```

## Service architecture

The browser uses REST for authentication, room management, profile changes, message history, and file uploads. It uses WebSockets for live text messages, typing events, read events, edits, deletes, and presence. Both message transports write to PostgreSQL and publish room events through Redis. Read the [architecture guide](docs/ARCHITECTURE.md) for the event flow, data model, and deployment boundaries.

## Configuration and security

Settings load from `backend/chat_project/settings/` according to `DJANGO_ENV`:

- `development` uses PostgreSQL and Redis by default, allows local hosts, and uses the console email backend
- `production` requires explicit secrets, PostgreSQL credentials, Redis URLs, allowed hosts, and CORS origins
- `test` uses isolated SQLite, in-memory Channels, and local memory cache for the test suite

Read [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for every supported variable and [SECURITY.md](SECURITY.md) for the security model, upload rules, and WebSocket token trade-off.

Production stores messages, users, rooms, and token blacklist rows in PostgreSQL. Redis stores Channels coordination data and cache entries, so Redis is not a source of truth. Attachments live in the configured media storage and need a separate backup. See [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Useful checks

Run backend checks from `backend/` with the virtual environment active:

```bash
python manage.py check
DJANGO_ENV=test pytest
black --check .
flake8
```

Run frontend checks from `frontend/`:

```bash
npm run lint
npm run build
```

Validate the Compose file before a deployment:

```bash
docker compose config
```

## Documentation map

- [Installation](docs/INSTALLATION.md): Development, Docker production, manual installation, migrations, and build commands
- [User guide](docs/USER_GUIDE.md): Account creation, chats, attachments, settings, and room roles
- [Configuration reference](docs/CONFIGURATION.md): Settings selection and environment variables
- [Architecture](docs/ARCHITECTURE.md): Backend, frontend, REST, WebSockets, Redis, and data flow
- [API reference](docs/API.md): Authentication, account, room, message, and WebSocket contracts
- [Operations runbook](docs/OPERATIONS.md): Deployment, health checks, backups, restores, and troubleshooting
- [Security policy](SECURITY.md): Vulnerability reporting and runtime protections
- [Contributing](CONTRIBUTING.md): Development conventions and pull request checks
- [Changelog](CHANGELOG.md): Release history and unreleased changes

## License

Paradise Chat is available under the [MIT License](LICENSE).
