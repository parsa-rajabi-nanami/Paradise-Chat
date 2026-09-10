# Operations runbook

## Runtime model

The compose stack treats PostgreSQL as durable state and Redis as an ephemeral
coordination service. Redis database 0 carries Channels group data and database
1 carries Django cache entries. Neither is a source of truth for messages,
rooms, users, or refresh-token blacklist rows. The local Redis service uses
`allkeys-lru`; production should keep this policy or choose an equivalent
bounded-memory policy and alert on evictions.

## Deploy and rollback

1. Build and scan the backend/frontend images in CI.
2. Apply migrations before shifting traffic when they are backward-compatible.
   Additive fields/indexes should deploy before code that writes or requires
   them; destructive changes require a later cleanup release.
3. Run `python manage.py check --deploy`, verify `/healthz`, then shift Nginx
   traffic to the new ASGI workers.
4. For rollback, redeploy the previous application images while preserving the
   database volume. Do not reverse an applied migration automatically; restore
   from backup or deploy a forward-compatible corrective migration.

## PostgreSQL backup and restore

Create a consistent daily custom-format backup and retain encrypted copies
outside the host:

```bash
pg_dump --format=custom --file=paradise-chat-$(date +%F).dump "$DATABASE_URL"
pg_restore --list paradise-chat-YYYY-MM-DD.dump
```

Restore into a new database first, run migrations/checks, and validate login,
room permissions, message listing, and attachment metadata before promotion.
Never test restores against the live database volume.

## Redis recovery

Redis loss should cause reconnects and cache misses, not data loss. Verify the
backend health endpoint after recovery; clients will rejoin room groups through
the existing WebSocket reconnect logic. If cache and Channels load become
independent at scale, provide separate Redis instances using
`REDIS_URL` and `REDIS_CACHE_URL`.
