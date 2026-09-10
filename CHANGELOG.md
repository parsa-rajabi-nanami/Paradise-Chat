# Changelog

All notable changes to Paradise Chat are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Production-readiness bootstrap: pytest configuration and critical auth,
  permissions, message lifecycle, upload cleanup, and Channels consumer tests
- PostgreSQL/Redis Docker Compose stack, non-root ASGI backend image, frontend
  build image, and Nginx WebSocket reverse-proxy configuration
- `/healthz` database/Redis readiness endpoint and explicit login/register/WS
  abuse controls
- Authenticated attachment streaming with randomized filenames and storage-safe
  cleanup
- CI/frontend build hardening: explicit Vite site URL injection, private source
  maps by default, and a green lint/build baseline

- Real-time messaging over WebSockets using Django Channels and Redis channel layer
- JWT authentication with rotating refresh tokens and blacklist after rotation
- Private chats and group chats with a hierarchical room tree (parent/subrooms)
- User management: registration, login, profile, password change, account deletion
- Online/offline presence tracking with a 30-second heartbeat WebSocket
- Message editing and deletion (soft-delete with tombstone content)
- Mute and permission system for room participants (roles: owner, admin, member)
- REST API built with Django REST Framework for rooms, messages, participants, and direct-message creation
- File attachments uploaded via REST endpoint (multipart) and broadcast to the room
- Responsive React frontend powered by Vite, Zustand state management, and Axios
- WebSocket service as a singleton with auto-reconnect and exponential backoff
- Axios interceptors for automatic access-token refresh and queuing of concurrent 401s
- Protected routes and lazy-loaded pages (ChatPage, UserSettings, ChatSettings)
- Backend settings package that dispatches between development and production based on `DJANGO_ENV`
- Development environment uses SQLite and open CORS; production uses PostgreSQL, Redis, and hardened security headers
- Custom user model with email login, Argon2 hashing, and passphrase confirmation for sensitive actions

### Changed

- Development now defaults to PostgreSQL/Redis parity; SQLite is limited to
  isolated test or explicitly opted-in lightweight fallback usage
- Production configuration fails closed for missing secrets, database password,
  hosts, and CORS origins; production access JWT lifetime defaults to 15 minutes
- REST read/typing broadcasts and WebSocket message serialization share the
  established channel event shapes

### Fixed

- Excluded soft-deleted messages from normal list/detail/reply flows and fixed
  participant-removal broadcast payloads

---

[Unreleased]: https://github.com/parsa-rajabi-nanami/Paradise-Chat/tree/1.0.0-alpha.1
