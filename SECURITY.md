# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | Yes |

---

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing **pursa218rajaby@gmail.com** with:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential security impact
- Environment details (Operating System, Python version, PostgreSQL version, Redis version, Browser if applicable)
- Paradise Chat version

You will receive acknowledgement within **48 hours** and a status update within **7 days**.

Once the vulnerability has been confirmed, a fix will be developed and released as soon as possible. Coordinated disclosure will follow, and credit will be given in the release notes unless you prefer to remain anonymous.

## Runtime protections

- Production secrets, database credentials, Redis URLs, and the separate JWT
  signing key are read from the process environment. Use
  `.env.example` as a variable checklist; never commit a populated `.env`.
- Production `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` are explicit,
  non-empty allow-lists. HSTS, secure cookies, SSL redirect, and security
  headers remain enabled.
- Message and avatar uploads use extension/content validation, a 10 MB message
  limit, generated storage names, and Django storage cleanup. Nginx does not
  serve `/media/`; attachments are streamed through an authenticated room
  participant endpoint.

### WebSocket token exposure decision

Browsers cannot add an Authorization header to the WebSocket handshake, so the
current client contract continues to pass a short-lived access JWT as the
`token` query parameter. This can appear in browser/proxy telemetry. The
production default access-token lifetime is 15 minutes (configurable through
`ACCESS_TOKEN_MINUTES`), and the supplied Nginx log format records `$uri`
instead of the raw request line, so query parameters are excluded from access
logs. A single-use connect-ticket endpoint remains a follow-up if deployments
need stronger protection against browser-history or upstream telemetry leaks;
the existing REST refresh and WebSocket event contracts do not change in this
increment.
