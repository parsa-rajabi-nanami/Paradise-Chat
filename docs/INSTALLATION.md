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
| Node.js | 20.19+ (or 22.12+) | React and Vite frontend |
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
   pip install -r requirements-dev.txt
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

## Deploy with Docker Compose

Use `scripts/deploy.sh` for a repeatable deployment. It prepares `.env`, keeps secrets out of logs, selects a host port, rebuilds the frontend with same-origin API settings, and waits for service readiness.

### Run the deployment script

Run the script from the repository root. The default bind address is `127.0.0.1`, and the default port is `8080`. This works with aaPanel or another host reverse proxy that already owns ports 80 and 443.

```bash
chmod +x scripts/deploy.sh
scripts/deploy.sh --port 8080
```

For a public domain, pass the browser-facing URL:

```bash
scripts/deploy.sh \
  --site-url https://chat.example.com \
  --port 8080
```

The script performs these actions:

- Creates `.env` from `.env.example` when `.env` is missing
- Saves a timestamped `.env` backup before an existing file changes
- Generates missing Django and JWT secrets with 64 hexadecimal characters
- Refuses to invent a password for an existing PostgreSQL container
- Adds the site host and origin to the backend allow-lists
- Builds the frontend with `VITE_API_URL=/api`
- Starts PostgreSQL, Redis, backend, frontend, and the Compose Nginx gateway
- Waits for backend and frontend healthchecks, then verifies `/healthz`

The script never removes Docker volumes. Use `--rotate-app-secrets` only when you intend to invalidate existing JWTs:

```bash
scripts/deploy.sh --site-url https://chat.example.com --port 8080 --rotate-app-secrets
```

Use `--no-build` only when the images already contain the intended source and frontend configuration:

```bash
scripts/deploy.sh --site-url https://chat.example.com --port 8080 --no-build
```

### Configure aaPanel or another reverse proxy

The Compose Nginx binds to `127.0.0.1:8080` by default. Configure the public host proxy to forward the site to:

```text
http://127.0.0.1:8080
```

Enable WebSocket proxying. Forward these paths to the same target:

- `/api/`
- `/ws/`
- `/healthz`
- `/`

The reverse proxy terminates TLS. Keep `SECURE_SSL_REDIRECT=False` for the supplied internal HTTP hop unless the proxy forwards `X-Forwarded-Proto: https` through every application path, including `/healthz`.

### Configure the environment manually

The script writes the deployment values for you. If you edit `.env` manually, keep the following rules:

- Use separate random values for `DJANGO_SECRET_KEY` and `JWT_SIGNING_KEY`
- Keep both application secrets at least 50 characters long
- Avoid `$` in secret values because Compose interprets it as variable expansion
- Keep `DB_PASSWORD` unchanged when a PostgreSQL volume already contains data
- Set `VITE_API_URL=/api` for same-origin browser requests
- Set `VITE_WS_HOST` to the public host and optional port, without a URL scheme

Use the rendered configuration check before starting the stack:

```bash
docker compose --env-file .env config
```

The backend container runs `migrate` and `collectstatic` on startup. It runs as a non-root user and stores local media in the `media_data` volume. Changing a `VITE_*` value requires a frontend image rebuild.

### Verify the deployment

Check service state and the internal readiness endpoint:

```bash
docker compose ps
curl -i http://127.0.0.1:8080/healthz
```

The endpoint must return HTTP 200 with both `database` and `redis` marked `ok`. Create an administrator after the first successful deployment if you need Django Admin:

```bash
docker compose exec backend python manage.py createsuperuser
```

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

The pytest configuration points directly to `chat_project.settings.test`, which loads isolated SQLite, in-memory Channels, and local memory cache settings:

```bash
cd backend
source venv/bin/activate
pytest
```

Run the frontend checks from `frontend/`:

```bash
npm run lint
npm run build
```
