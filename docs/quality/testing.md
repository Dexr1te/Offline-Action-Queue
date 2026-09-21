# Testing and CI

## Testing strategy

### Unit tests

Vitest:

```text
enqueue persistence
FIFO ordering
state transitions
retry calculation
jitter bounds
Retry-After parsing
HTTP classification
max attempts
manual retry
cancel
idempotency preservation
serializer errors
event emission
processor lifecycle
crash recovery
lease expiry
```

### Storage contract tests

Every storage adapter must pass the same suite:

```text
put
get
list
update
delete
ordering
persistence
schema migration
lease acquisition
lease expiry
```

### Transport contract tests

```text
success response
network exception
timeout
4xx
5xx
Retry-After
auth prepareRequest hook
idempotency header
```

### Browser tests

Playwright:

```text
Chromium
Firefox
WebKit
```

Critical end-to-end scenarios:

1. enqueue while online → delivered;
2. enqueue while offline → remains persisted;
3. reload while offline → action survives;
4. restore network → action delivered;
5. browser reload during retry → retry resumes;
6. multiple tabs → one processor delivers action;
7. leader tab closes → another tab resumes;
8. failed action remains inspectable;
9. manual retry works;
10. cancel removes pending action.

## CI

Every pull request should run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Recommended CI jobs:

```text
lint/typecheck
unit tests
browser integration tests
build/packages
package exports validation
```

No release should occur if any required CI job fails.
