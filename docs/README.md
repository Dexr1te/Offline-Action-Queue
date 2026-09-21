# OfflineQ v1.0 documentation

OfflineQ is durable client-side delivery infrastructure for web applications.
This directory is the canonical, structured version of the v1.0 product and
engineering specification.

## Read first

- [Product direction](product.md) — scope, goals, non-goals, positioning, and success criteria.
- [Getting started](getting-started.md) — the intended v1.0 developer experience.
- [Delivery semantics](architecture/delivery.md) — lifecycle, ordering, retries, and invariants.
- [Storage](architecture/storage.md) — persisted action shape, IndexedDB, and serialization.
- [Transport](architecture/transport.md) — idempotency, authentication, and HTTP transport.
- [Core API](api/core.md) — framework-independent queue API.
- [React and Zustand](api/react.md) — React integration and the optional Zustand adapter.

## Architecture

- [Delivery](architecture/delivery.md)
- [Storage](architecture/storage.md)
- [Transport](architecture/transport.md)
- [Cross-tab coordination](architecture/concurrency.md)

## API

- [Core API](api/core.md)
- [React adapter](api/react.md)

## Quality and platform constraints

- [Browser limitations](quality/browser.md)
- [Security](quality/security.md)
- [Logging and error handling](quality/logging-and-errors.md)
- [Engineering standards](quality/engineering.md)
- [Testing and CI](quality/testing.md)

## Project work

- [Repository and package structure](project/repository.md)
- [Roadmap](project/roadmap.md)
- [Implementation order and v1.0 definition of done](project/implementation.md)
- [Contributing](project/contributing.md)
- [Release process](project/release.md)
- [Decisions](decisions/README.md)

## Recommended reading order

1. [Product direction](product.md)
2. [Delivery semantics](architecture/delivery.md)
3. [Storage](architecture/storage.md)
4. [Transport](architecture/transport.md)
5. [Core API](api/core.md)
6. [Testing and CI](quality/testing.md)

The public contract is defined by the delivery, storage, transport, and API
documents together. Implementation details may change only if they preserve
the documented semantics and invariants.
