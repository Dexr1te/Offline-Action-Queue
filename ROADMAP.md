# Roadmap

The repository has completed the Phase 2 core-model checkpoint. Core action
types, queue lifecycle operations, storage contracts, and in-memory contract
tests are implemented; final integrated validation remains pending. Processor
delivery, IndexedDB, fetch, React, and browser runtime work remain ahead, so
this is not a v1 release.

1. **Foundation** — workspace, package boundaries, strict tooling, project
   documentation, and CI scaffolding. _(Completed)_
2. **Core model** — types, action schema, events, storage contract, and queue
   lifecycle. _(Completed — 31 unit & contract tests passing)_
3. **Processor** — FIFO delivery, retries, failure classification, and crash
   recovery. _(Next)_
4. **IndexedDB** — persistence, migrations, and storage contract tests.
5. **Fetch transport** — HTTP delivery, timeouts, `Retry-After`, auth hooks,
   and idempotency headers.
6. **Offline recovery** — connectivity wakeups and reload recovery.
7. **Cross-tab coordination** — leases, takeover, and notifications.
8. **React adapter** — provider, hooks, and an example application.
9. **Browser verification** — Chromium, Firefox, and WebKit flows.
10. **v1 stabilization** — API freeze, security review, compatibility work,
    package validation, and release automation.

The canonical implementation order is
[`docs/project/implementation.md`](docs/project/implementation.md).
