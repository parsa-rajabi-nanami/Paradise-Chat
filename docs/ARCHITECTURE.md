# Paradise Chat architecture

Paradise Chat separates the browser interface, HTTP API, real-time gateway, durable database, cache, and media storage. This page explains those boundaries so you can operate the service or change it without breaking REST and WebSocket behavior.

## Request and event flow

The production Compose deployment uses this flow:

```text
Browser
  ├─ HTTP and static assets ─> Nginx ─> Frontend container
  ├─ /api/ ──────────────────> Nginx ─> Django ASGI application ─> PostgreSQL
  └─ /ws/ ───────────────────> Nginx ─> Channels consumer ──────> Redis
                                      ├─ PostgreSQL for messages and presence
                                      └─ media storage for avatars and attachments
```

ASGI means Asynchronous Server Gateway Interface. Django serves HTTP and Channels handles WebSocket connections through `chat_project/asgi.py`. Nginx preserves WebSocket upgrade headers and hides media files from direct public access.

## Backend layers

- **Settings**: `backend/chat_project/settings/` selects development, production, or test behavior from `DJANGO_ENV`
- **Accounts**: `backend/accounts/` owns the custom email-login user model, JWT endpoints, profile operations, presence, and account deletion
- **Chat**: `backend/chat/` owns rooms, participants, messages, attachments, permissions, serializers, REST views, and consumers
- **Routing**: `chat_project/urls.py` exposes `/healthz`, Admin, account API, and chat API. `chat/routing.py` exposes the room and status WebSocket paths
- **Storage**: PostgreSQL stores application records, Redis provides Channels and cache services, and Django storage holds media files

## Two message transports

REST and WebSockets are two entry points into the same message model:

| Operation | REST | WebSocket |
| --- | --- | --- |
| Message history | `GET /api/chat/rooms/<room_id>/messages/` | Not used |
| Text message | `POST /api/chat/rooms/<room_id>/messages/` | `type: message` |
| File attachment | Multipart `POST` to the message endpoint | Not used |
| Typing status | `POST /api/chat/rooms/<room_id>/typing/` | `type: typing` |
| Read receipts | `POST /api/chat/rooms/<room_id>/read/` | `type: read` |
| Edit message | `PATCH` message detail | `type: edit` |
| Delete message | `DELETE` message detail | `type: delete` |

Both paths validate room membership, write to PostgreSQL, and publish compatible events to the Redis group `chat_{room_id}`. The frontend singleton in `frontend/src/services/websocket.js` consumes those events and updates `chatStore`.

## WebSocket connections

The browser maintains two authenticated connections:

- `/ws/chat/<room_id>/?token=<access_token>` joins one room and handles messages, typing, reads, edits, and deletes
- `/ws/status/?token=<access_token>` tracks global online status and sends a heartbeat every 30 seconds

The JWT middleware validates the query token and places the authenticated user in the connection scope. The production access-token default is 15 minutes. Nginx logs `$uri` instead of the raw request line, which prevents the query token from appearing in the supplied access log format.

## Data model

- **User**: Custom email-login user with Argon2 password hashing, a separately hashed security passphrase, profile data, and online state
- **ChatRoom**: Direct, group, or subgroup room with optional parent room and avatar
- **RoomParticipant**: Through model that stores role, mute state, typing state, and last-read time
- **Message**: Text or attachment message with reply, edit, and soft-delete state
- **MessageRead**: Per-user read receipt for a message
- **UserPresence**: Active WebSocket presence records
- **ChatConfiguration**: Singleton Admin record for registration, uploads, limits, maintenance flags, and branding

Room queries require an active room and an active parent for subgroups. `flatten_rooms` converts the hierarchy into the `depth` value that the frontend uses for sidebar indentation.

## Authentication lifecycle

The login and registration endpoints return an access JWT and a refresh token. The frontend stores the tokens in the persisted `auth-storage` Zustand store. Axios adds the access token to REST requests and queues concurrent 401 responses while it refreshes the access token through the raw Axios client. A failed refresh clears the local session.

The logout endpoint blacklists the supplied refresh token and clears presence. Account deletion requires the user's security credentials, removes private attachments, and preserves conversation history without the deleted identity where the model allows it.

## Frontend structure

- `src/App.jsx` defines public routes and protected chat and settings routes
- `src/stores/authStore.js` persists authentication state
- `src/stores/chatStore.js` stores rooms, messages, typing state, and online users
- `src/api/client.js` owns the Axios instance and token refresh queue
- `src/api/auth.js` and `src/api/chat.js` wrap REST endpoints
- `src/services/websocket.js` owns room and status sockets with reconnect backoff

Keep the singleton WebSocket service and existing event shapes. Add new client behavior through the stores and service instead of creating parallel connections.

## Deployment boundaries

The database volume is durable and must be backed up. Redis is coordination and cache state, so it can be recreated. The media volume is separate from PostgreSQL and must be backed up separately. Static files are rebuilt with `collectstatic` and do not replace media backups.

For rollout order, health checks, migration safety, backup, restore, and troubleshooting, read [the operations runbook](OPERATIONS.md).
