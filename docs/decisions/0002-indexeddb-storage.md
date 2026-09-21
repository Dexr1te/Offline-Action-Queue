# ADR-0002: IndexedDB as browser persistence

## Status

Accepted

## Context

Queued actions must survive reloads and temporary network failures. Browser
storage is the only durable runtime available to a browser-only library.

## Decision

IndexedDB is the default durable browser store and is provided by
`@offlineq/indexeddb`.

## Consequences

- queue persistence is available without a server-side component;
- storage adapters can be replaced through the `QueueStorage` interface;
- schema migrations and storage contract tests are required;
- users must be told that browser data can be cleared or evicted;
- IndexedDB is authoritative over UI state managers and wake-up signals.
