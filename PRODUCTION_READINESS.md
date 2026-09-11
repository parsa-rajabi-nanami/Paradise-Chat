# Production Readiness Plan

This plan moves Paradise Chat from `1.0.0-alpha.1` toward a production-like,
reviewable deployment while preserving the existing REST and WebSocket
contracts. Work is ordered by operational risk and will be delivered in small
workstreams. Each completed workstream will update `CHANGELOG.md`; command,
environment, or architecture changes will also update `AGENTS.md` and
`README.md`.

## Repository baseline

- Backend runtime pins: Django `5.2.17`, Django REST Framework `3.18.1`,
  Channels `4.3.2`, `channels-redis 4.3.0`, Daphne `4.2.3`, SimpleJWT `5.5.1`,
  PostgreSQL driver `psycopg2-binary 2.9.12`, Redis client `7.3.1`.
- Frontend: React `18.2.0`, Vite `8.3.0`, npm lockfile present; existing
  commands are `npm run lint` and `npm run build`.
- Runtime and development Python dependencies are separated: production images
  install `requirements.txt`; CI and local development use
  `requirements-dev.txt`.
- Settings dispatch from `backend/chat_project/settings/__init__.py` to
  `development.py` or `production.py` using `DJANGO_ENV`.
- Development defaults to PostgreSQL/Redis like production; SQLite is an
  explicit test/fallback mode. Both runtime environments keep DRF throttling
  enabled.
- `backend/chat/validators.py` checks a 10 MB extension/MIME allow-list and
  uploads use generated storage names. `backend/chat/signals.py` removes
  attachments through Django's configured storage backend.
- The REST message path is `backend/chat/views.py::MessageListView` and its
  edit/delete path is `MessageDetailView`; the corresponding WebSocket path is
  `backend/chat/consumers.py::ChatConsumer`. Their event types and payloads
  must remain paired (`chat_message`/`message`,
  `message_edited`/`edit`, `message_deleted`/`delete`, and the presence/read
  events).
- The frontend WebSocket singleton is
  `frontend/src/services/websocket.js`; file uploads intentionally use REST.
- Readiness migrations add one presence row per active WebSocket connection and
  a singleton runtime chat configuration managed from Admin. Both are additive
  and reversible; existing message/room data is preserved.

## P0 — blockers before real traffic

### 1. Test-suite bootstrap and critical coverage

Add the root `pytest.ini` with `DJANGO_SETTINGS_MODULE=chat_project.settings.test`
and asyncio configuration, then add focused tests under `backend/accounts/tests/`
and `backend/chat/tests/`. Use the pinned pytest, pytest-django, and
pytest-asyncio dependencies plus Channels `WebsocketCommunicator`.

Coverage will include:

- register/login, rotating refresh tokens, blacklist-after-rotation, logout,
  password change, and passphrase-confirmed account deletion;
- the owner/admin/member matrix in `ManageParticipantView`, including negative
  owner-only and admin boundary cases;
- message create/edit/soft-delete, tombstone behavior, exclusion of deleted
  messages, and attachment cleanup after hard deletion;
- `ChatConsumer` message/typing/read/edit/delete flows and
  `OnlineStatusConsumer` heartbeat behavior;
- a broadcast parity assertion for equivalent REST and WebSocket operations,
  preserving the existing client-facing event shapes.

No artificial coverage threshold will be introduced. Tests requiring Redis will
use an isolated in-memory channel layer override where appropriate; the Docker
stack remains the integration path for real Redis behavior.

### 2. PostgreSQL + Redis development parity

Add a local `docker-compose.yml` with PostgreSQL and Redis health checks and
environment-driven credentials. Development settings will support a
PostgreSQL/Redis profile without removing a lightweight SQLite fallback for
unit-test isolation. The documented default development workflow will use the
compose services so local constraints match production.

### 3. Secrets and configuration audit

Update `base.py`, `development.py`, and `production.py` so production secrets
and connection settings come only from the process environment. Add a root
`.env.example` containing placeholders for every supported backend and
frontend variable, without credentials. Make production `ALLOWED_HOSTS` and
`CORS_ALLOWED_ORIGINS` fail closed when absent rather than silently accepting
an empty or wildcard configuration. Keep HSTS, SSL redirect, secure cookies,
and security headers enabled.

### 4. Upload hardening

Keep the current 10 MB allow-list as the baseline, make validation reject
script/executable extensions explicitly, detect MIME from content, and store
attachments with generated names rather than the client filename. Make cleanup
use Django’s configured storage API so it works for local storage and future
object storage. Keep attachment creation on the existing authenticated REST
endpoint and do not change its response shape.

### 5. WebSocket token exposure mitigation

For this increment, retain the browser-compatible JWT query-string handshake
contract and reduce exposure by documenting the risk, setting bounded access
token lifetime/configuration, and providing reverse-proxy log redaction in the
Nginx configuration. A single-use connect-ticket flow is a follow-up unless
the existing frontend/API contract can support it without an incompatible
authentication transition. The decision and trade-off will be recorded in
`SECURITY.md`.

### 6. Abuse controls

Keep production DRF throttling enabled and add explicit scoped throttles for
login and registration, with environment-configurable rates. Add a per-user,
per-connection sliding-window guard in `ChatConsumer` for inbound frames,
returning a non-contract-breaking error/close behavior and preserving all
valid event payloads.

### 7. Containerization

Add a multi-stage backend `Dockerfile` running as a non-root user with an ASGI
entrypoint, a frontend build/runtime image, and compose services for
PostgreSQL, Redis, backend, frontend, and Nginx. Do not bake secrets into
images. Frontend API/WS values will be explicit build-time arguments for the
current Vite architecture.

### 8. Reverse proxy, process model, and health

Add Nginx configuration with WebSocket upgrade headers, long-lived connection
timeouts, and query-string token redaction. Run multiple ASGI workers through a
supervised container command and add `/healthz` with database and Redis checks
for readiness/liveness diagnostics. Static/media serving will remain explicit;
media will not be exposed as an unauthenticated production directory.

## P1 — hardening and scalability

After all P0 work is green:

1. Add GitHub Actions for Black, Flake8, pytest, frontend lint/build,
   dependency audits, and Docker builds.
2. Add structured JSON request/consumer logging, Sentry-compatible optional
   error tracking, and correlation IDs across REST and broadcast logs. Vendor
   choice remains environment-configurable and is not required for local runs.
3. Audit `flatten_rooms`, message lists, and serializer access patterns for
   N+1 queries; add only evidence-backed indexes for hierarchy, read, and typing
   lookups.
4. Document Redis’s ephemeral channel-layer role, set production memory and
   eviction policy, and separate cache/channel Redis endpoints when needed.
5. Add an S3-compatible storage seam with signed URLs only after selecting an
   object-storage provider and retention policy; local storage remains the
   tested default until that decision is made.
6. Document Postgres backup/restore, migration compatibility, and rollback
   procedures; review future schema changes for zero-downtime safety.
7. Verify Vite environment injection, source-map handling, and bundle size.

The first P1 increment is now represented by `.github/workflows/ci.yml`, JSON
console logging/request IDs, hierarchy/read/typing indexes, Redis policy
documentation, the operations runbook, and source maps disabled in public
frontend images by default. Sentry and S3-compatible media remain provider
decisions documented below.

## P2 — follow-up

Defer load/soak testing, Prometheus/Grafana or hosted metrics, OpenAPI via
`drf-spectacular`, and Playwright REST+WebSocket E2E coverage until the P0/P1
interfaces are stable. These require deployment-scale traffic and, for
observability/storage, human choices about providers and budget.

## Acceptance gates

- `cd backend && pytest`, the source-only Black check, and `flake8` pass.
- `cd frontend && npm run lint && npm run build` pass.
- `docker compose config` succeeds and the compose health checks reach the
  backend, PostgreSQL, and Redis services.
- REST and WebSocket event types/payloads remain synchronized; no soft-delete,
  room hierarchy, or role semantics are changed.
- No secrets, `.env` files, database files, media files, or credentials are
  added to version control.
