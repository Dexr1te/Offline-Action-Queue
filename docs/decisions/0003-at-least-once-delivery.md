# ADR-0003: At-least-once delivery

## Status

Accepted

## Context

A browser client cannot always distinguish a server-side success from a
network failure that occurs before the response arrives. Retrying in that
state can execute the operation more than once.

## Decision

OfflineQ provides at-least-once delivery and does not promise exactly-once
execution.

Server idempotency is required for exactly-once effects.

## Consequences

- action IDs and idempotency keys must remain stable across retries;
- transports can retry after uncertain responses;
- backend APIs must store and enforce idempotency keys where duplicates matter;
- documentation must make duplicate execution possible and visible.
