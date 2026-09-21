# Architecture decision records

Architecture decisions should not disappear inside issues or pull-request
comments.

Use this directory for decisions that affect delivery semantics, storage,
public package boundaries, or concurrency.

## Format

```md
# ADR-0001: Framework-Agnostic Core

## Status

Accepted

## Context

...

## Decision

...

## Consequences

...
```

## Initial decisions

- [ADR-0001 — Framework-agnostic core](0001-framework-agnostic-core.md)
- [ADR-0002 — IndexedDB as browser persistence](0002-indexeddb-storage.md)
- [ADR-0003 — At-least-once delivery](0003-at-least-once-delivery.md)
- [ADR-0004 — Cross-tab processor lease](0004-cross-tab-processor-lease.md)
- [ADR-0005 — Queue binding and fenced storage coordination](0005-storage-coordination-contract.md)
- [ADR-0006 — Transport retry timing and pending counts](0006-retry-timing-and-pending-count.md)
- [ADR-0007 — FIFO ordering when the head action is retrying](0007-fifo-retry-ordering.md)
