# Paradise Chat API reference

This reference lists the public HTTP and WebSocket contracts implemented by the current backend. The base URL examples use `https://chat.example.com`; replace it with your deployment URL. All routes require a trailing slash.

## Authentication

Send the access token on protected HTTP requests:

```http
Authorization: Bearer your_access_token_here
```

The login response contains `access`, `refresh`, and `user`. The registration response contains `user` and a nested `tokens` object. Refresh tokens rotate on refresh and the previous token is blacklisted.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register/` | Public | Create an account and return tokens |
| `POST` | `/api/auth/login/` | Public | Sign in with email, password, and passphrase |
| `POST` | `/api/auth/refresh/` | Public | Exchange a refresh token for a new token pair |
| `POST` | `/api/auth/logout/` | Authenticated | Blacklist a refresh token and clear presence |

Registration accepts `email`, `username`, `password`, `password_confirm`, `passphrase`, and optional `display_name`. Login accepts `email`, `password`, and `passphrase`.

## Account endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/auth/profile/` | Return the current profile |
| `PATCH` | `/api/auth/profile/` | Update username, display name, biography, avatar, or notification preferences |
| `POST` | `/api/auth/password/change/` | Change password and optionally passphrase |
| `DELETE` | `/api/auth/profile/delete/` | Confirm and delete the account |
| `GET` | `/api/auth/users/?search=al` | Search active users for conversations |
| `GET` | `/api/auth/users/<user_id>/` | Return a public user profile |
| `GET` | `/api/auth/users/online/` | Return online users |
| `GET` | `/api/auth/users/<user_id>/avatar/` | Stream an authenticated avatar |

Password changes require `current_password`, `new_password`, `new_password_confirm`, and `current_passphrase`. Account deletion requires the current passphrase and the request's refresh token when the client has one.

## Room endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/chat/rooms/` | List the current user's rooms and nested subgroups |
| `POST` | `/api/chat/rooms/` | Create a direct, group, or subgroup room |
| `GET` | `/api/chat/rooms/<room_id>/` | Return room metadata and up to 50 recent messages |
| `PATCH` | `/api/chat/rooms/<room_id>/` | Update group name, description, or avatar |
| `DELETE` | `/api/chat/rooms/<room_id>/` | Leave a room or delete a group in the owner case |
| `POST` | `/api/chat/direct/` | Create or return a direct room for a user |
| `POST` | `/api/chat/rooms/<room_id>/participants/<user_id>/` | Add a group participant |
| `PATCH` | `/api/chat/rooms/<room_id>/participants/<user_id>/` | Change a participant role |
| `DELETE` | `/api/chat/rooms/<room_id>/participants/<user_id>/` | Remove a participant |

Create a room with `name`, `room_type`, `description`, `participant_ids`, and optional `parent`. Valid room types are `direct`, `group`, and `subgroup`. A direct room accepts one other participant. A group requires at least one participant, and a subgroup requires an active group parent.

Create a direct room with the shorter endpoint:

```json
{
  "user_id": 123
}
```

## Message endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/chat/rooms/<room_id>/messages/` | Return non-deleted messages with pagination |
| `POST` | `/api/chat/rooms/<room_id>/messages/` | Create a text or attachment message |
| `GET` | `/api/chat/rooms/<room_id>/messages/<message_id>/` | Return one message |
| `PATCH` | `/api/chat/rooms/<room_id>/messages/<message_id>/` | Edit the sender's text message |
| `DELETE` | `/api/chat/rooms/<room_id>/messages/<message_id>/` | Soft-delete the sender's message |
| `GET` | `/api/chat/messages/<message_id>/attachment/` | Stream an attachment to a room participant |
| `POST` | `/api/chat/rooms/<room_id>/read/` | Mark room messages as read |
| `POST` | `/api/chat/rooms/<room_id>/typing/` | Set the current user's typing state |

Send a text message as JSON:

```json
{
  "content": "Hello from Paradise Chat",
  "reply_to": null
}
```

Send an attachment as `multipart/form-data` with `content`, optional `reply_to`, and `attachment`. The server infers `image` for image content and `file` for other accepted attachments. It rejects deleted or cross-room reply targets.

Only the sender can edit or delete a message. Deleted messages are excluded from normal list and detail responses and retain a tombstone in the database for event consistency.

## Health endpoint

`GET /healthz` checks PostgreSQL and Redis. It returns HTTP 200 with `{"status":"ok"}` when both checks pass and HTTP 503 with `{"status":"error"}` when either dependency fails. Use it for load balancer readiness and deployment verification.

## WebSocket endpoints

Connect with a short-lived access token in the query string:

```text
wss://chat.example.com/ws/chat/room_uuid_here/?token=your_access_token_here
```

The room socket accepts these client frames:

| `type` | Additional fields | Effect |
| --- | --- | --- |
| `message` | `content`, optional `reply_to` | Create a text message |
| `typing` | `is_typing` | Broadcast typing state |
| `read` | None | Mark the room as read |
| `edit` | `message_id`, `content` | Edit the sender's text message |
| `delete` | `message_id` | Soft-delete the sender's message |

The status socket accepts `{"type":"heartbeat"}` every 30 seconds. Server event types include `message`, `typing`, `edit`, `delete`, `user_join`, `user_leave`, `read`, and `status`. Event payloads are shared with the frontend WebSocket service, so consumers should preserve existing fields when extending them.

## Common response codes

| Code | Meaning |
| --- | --- |
| `200` | Request completed |
| `201` | Resource created |
| `204` | Resource deleted with no response body |
| `400` | Invalid input or unsupported action |
| `401` | Missing or expired access token |
| `403` | Authenticated but not permitted |
| `404` | Resource is missing, inactive, or inaccessible to the caller |
| `429` | Login, registration, REST, or WebSocket rate limit reached |
| `503` | Health check found a database or Redis failure |
