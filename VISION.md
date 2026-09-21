# Vision

OfflineQ aims to be a small, dependable infrastructure primitive for
frontend applications: durable action delivery for the browser.

The core promise for a future release is:

> An action accepted into the queue remains recoverable until it is confirmed
> delivered, explicitly cancelled, permanently failed, or browser storage is
> removed or evicted.

The project will stay framework-agnostic at its core, persist before delivery,
document at-least-once semantics, keep dependencies small, expose predictable
retry and recovery behavior, and avoid hidden magic. It is not intended to be
a frontend framework, state manager, API client, backend queue, or local-first
database.

This is a product direction, not a claim that those behaviors exist in the
current implementation. See [`docs/product.md`](docs/product.md) for the
complete scope, goals, and non-goals.
