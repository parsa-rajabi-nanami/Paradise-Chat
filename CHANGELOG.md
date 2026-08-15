# Changelog

All notable changes to Paradise Chat are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

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

### Fixed

---

[Unreleased]: https://github.com/parsa-rajabi-nanami/Paradise-Chat/tree/1.0.0-alpha.1