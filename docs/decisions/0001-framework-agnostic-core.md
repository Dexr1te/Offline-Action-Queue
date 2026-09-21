# ADR-0001: Framework-agnostic core

## Status

Accepted

## Context

OfflineQ is intended to serve frontend applications that use different UI and
state-management frameworks. Queue durability and delivery semantics should
not be coupled to a component framework.

## Decision

The core package cannot depend on React, Zustand, Redux, Vue, or other UI/state
frameworks.

Framework integrations live in separate adapter packages.

## Consequences

- the core can be used from vanilla JavaScript and any frontend framework;
- framework adapters can evolve independently;
- UI-specific state remains outside the durable queue engine;
- adapters must expose queue state without changing core semantics.
