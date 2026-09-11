# Install and run Paradise Chat

This guide helps you install Paradise Chat for local development, run the complete Docker deployment, or install the services manually. Start with the development path if you are evaluating the project or changing code. Use Docker or a supervised manual deployment for a public service.

## Choose the right path

- **Development**: PostgreSQL and Redis run in Docker; Django and Vite run from the source tree with reload support
- **Docker deployment**: Compose runs PostgreSQL, Redis, the backend, the built frontend, and Nginx
- **Manual deployment**: You manage PostgreSQL, Redis, the backend process, the frontend build, and the reverse proxy separately

## Prerequisites

Install these tools before you begin:

| Tool | Supported baseline | Used by |
| --- | --- | --- |
| Python | 3.12 or newer | Django backend and tests |
| Node.js | 18 or newer | React and Vite frontend |
| npm | 9 or newer | Frontend dependencies and build |
| PostgreSQL | 14 or newer | Durable application data |
| Redis | 6 or newer | Channels and cache |
| Docker Compose | v2 | Development services or full deployment |

The Docker path only requires Docker and Docker Compose on the host. The manual path also requires the database, Redis, Python, Node.js, and a reverse proxy such as Nginx.

## Prepare environment variables

The root `.env.example` is the canonical template. Copy it once from the repository root:

```bash
cp .env.example .env
```

For local development, the example values work with the supplied `db` and `redis` services. For a public deployment, replace every secret and set the public host, frontend origin, and Vite URLs before building. Read [Configuration reference](CONFIGURATION.md) for variable meanings and production requirements.

Never commit `.env`, database files, media files, or credentials. Generate separate random values for `DJANGO_SECRET_KEY` and `JWT_SIGNING_KEY`.

## Development with Docker services

This path runs only PostgreSQL and Redis in Docker. It keeps the backend and frontend available for local code changes.

1. Clone the repository and enter its directory
2. Copy `.env.example` to `.env`
3. Start the dependencies:

   ```bash
   docker compose up -d db redis
   ```

4. Create the backend environment and install Python packages:

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

5. Load the root environment variables into the backend shell and prepare the database:

   ```bash
   set -a; source ../.env; set +a
   python manage.py migrate
   python manage.py createsuperuser
   ```

6. Start the backend in that terminal:

   ```bash
   python manage.py runserver
   ```

7. In a second terminal, install and start the frontend:

   ```bash
   cd frontend
   npm ci
   cp .env-sample .env
   npm run dev
   ```

8. Open `http://localhost:3000`. The backend API is available at `http://localhost:8000/api/`, and the WebSocket host is `localhost:8000`

On Windows, activate the virtual environment with `venv\Scripts\activate`, load environment variables with PowerShell or Docker Desktop, and run the same Django and npm commands from their directories.

## Full deployment with Docker Compose

The Compose deployment starts all application services. The supplied Nginx configuration serves HTTP on port 80 and proxies API and WebSocket traffic to the backend.

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

   The Compose file anchors build contexts and the deployment Nginx
   configuration to `PROJECT_ROOT` (default: `/www/wwwroot/paradise-chat`).
   This prevents a command launched from a deleted or recycle-bin copy from
   building stale source. Set `PROJECT_ROOT` to the absolute path of the
   intended checkout when deploying elsewhere.

2. Set deployment values in `.env`. For a domain behind an external TLS proxy, use values like these:

   ```env
   DJANGO_ENV=production
   DJANGO_BASE_URL=https://chat.example.com
   ALLOWED_HOSTS=chat.example.com,localhost
   CORS_ALLOWED_ORIGINS=https://chat.example.com
   VITE_API_URL=https://chat.example.com/api
   VITE_WS_HOST=chat.example.com
   VITE_SITE_URL=https://chat.example.com
   SECURE_SSL_REDIRECT=False
   ```

3. Replace the example secret and database values. Keep the internal Compose values for `DB_HOST`, `REDIS_URL`, and `REDIS_CACHE_URL`; the Compose file supplies the service names and Redis databases. Keep `localhost` in `ALLOWED_HOSTS` because the backend health check calls the container directly with that host name
4. Validate the configuration:

   ```bash
   docker compose config
   ```

   Confirm that the rendered `build.context` values point to the intended
   checkout, not a temporary or recycle-bin directory.

5. Build and start the stack:

   ```bash
   docker compose up -d --build
   ```

6. Confirm service status and readiness:

   ```bash
   docker compose ps
   curl -i http://localhost/healthz
   ```

7. Open the public frontend URL and register the first user. Create an administrator separately if you need Django Admin:

   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

The backend container runs `migrate` and `collectstatic` on startup. It runs as a non-root user and stores local media in the `media_data` volume. The frontend values are compiled into the Vite bundle, so changing `VITE_API_URL`, `VITE_WS_HOST`, or `VITE_SITE_URL` requires a frontend image rebuild.

The supplied Nginx container does not terminate TLS. Put a TLS-aware load balancer or reverse proxy in front of it, or extend the Nginx configuration before exposing the service to the public internet. In the supplied Compose stack, let that external proxy enforce HTTPS and keep `SECURE_SSL_REDIRECT=False` unless you also update the internal health check to send the forwarded HTTPS header.

## Manual installation

Use this path when you manage the database and application processes outside Docker.

### Install PostgreSQL and Redis

Install PostgreSQL 14 or newer and Redis 6 or newer using your operating system's package manager or managed services. Create a database and role that match the `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values:

```sql
CREATE USER chat_user WITH PASSWORD 'replace_with_a_database_password';
CREATE DATABASE chat_db OWNER chat_user;
```

Allow the backend host to reach PostgreSQL and Redis, but do not expose either service to the public internet without network controls and authentication.

### Install the backend

From the repository root, create the environment and install Python dependencies:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
set -a; source ../.env; set +a
```

Set `DJANGO_ENV=production`, a strong `DJANGO_SECRET_KEY`, a separate `JWT_SIGNING_KEY`, PostgreSQL variables, Redis URLs, `ALLOWED_HOSTS`, and `CORS_ALLOWED_ORIGINS`. Then run the checks and database commands:

```bash
python manage.py check --deploy
python manage.py migrate
python manage.py collectstatic --noinput
```

Run the ASGI application with a process supervisor. A single-process example is:

```bash
gunicorn chat_project.asgi:application \
  -k uvicorn.workers.UvicornWorker \
  --bind 127.0.0.1:8000 --workers 2
```

Do not use `python manage.py runserver` for a public deployment. Configure the supervisor to restart the process, preserve logs, and inject the environment without storing secrets in the repository.

### Build the frontend

Create `frontend/.env` with public values. `VITE_API_URL` must include `/api`; `VITE_WS_HOST` contains only the WebSocket host and optional port:

```env
VITE_API_URL=https://chat.example.com/api
VITE_WS_HOST=chat.example.com
VITE_SITE_URL=https://chat.example.com
```

Install dependencies and create the production bundle:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

Serve `frontend/dist` from Nginx or another static web server. Route `/api/`, `/ws/`, and `/healthz` to the backend. Preserve the WebSocket upgrade headers for `/ws/`, and route application paths to `index.html` so React Router can load `/chat` and `/settings`.

### Apply updates

Pull the new source, install dependency changes, inspect the migration plan, run migrations, rebuild the frontend, and restart the supervised backend process:

```bash
python manage.py showmigrations
python manage.py migrate --plan
python manage.py migrate
python manage.py collectstatic --noinput
npm ci
npm run build
```

Take a PostgreSQL and media backup before a release that changes the schema. Follow the [operations runbook](OPERATIONS.md) for rollback and restore procedures.

## Test settings and isolated checks

The pytest configuration points to `chat_project.settings`. Set `DJANGO_ENV=test` to load isolated SQLite, in-memory Channels, and local memory cache settings:

```bash
cd backend
source venv/bin/activate
DJANGO_ENV=test pytest
```

Run the frontend checks from `frontend/`:

```bash
npm run lint
npm run build
```
