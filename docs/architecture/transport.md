# Transport, idempotency, and authentication

## Idempotency

Every action receives a stable internal idempotency key when created:

```ts
crypto.randomUUID()
```

The key survives:

- retries;
- reloads;
- browser restarts;
- offline periods.

Transport-level header injection is configurable.

```ts
fetchTransport({
  idempotency: {
    enabled: true,
    header: "Idempotency-Key",
  },
})
```

The documentation must state clearly:

> Sending an idempotency key does not itself guarantee idempotency. The
> backend must store and enforce the key.

## Authentication

Authentication tokens should not be persisted inside queued actions by
default.

Bad:

```ts
{
  headers: {
    Authorization: "Bearer short-lived-token"
  }
}
```

The token may expire before the queued action is replayed.

Instead, the fetch transport should support a send-time hook:

```ts
const transport = fetchTransport({
  async prepareRequest(request) {
    const token = await auth.getAccessToken()

    return {
      ...request,
      headers: {
        ...request.headers,
        Authorization: `Bearer ${token}`,
      },
    }
  },
})
```

For cookie-based authentication:

```ts
fetchTransport({
  credentials: "include",
})
```

## Transport

Transport interface:

```ts
export interface Transport {
  send(action: QueuedAction): Promise<TransportResult>
}
```

Default implementation:

```text
@offlineq/fetch
```

Result:

```ts
export type TransportResult =
  | {
      ok: true
      status: number
      response?: unknown
    }
  | {
      ok: false
      status?: number
      error: QueueError
      retryAfterMs?: number
    }
```

`retryAfterMs` is an optional nonnegative finite duration. The fetch adapter
parses valid `Retry-After` delay-seconds and HTTP-date values and omits invalid
or unrepresentable values; past dates become zero. Custom transports may supply
the same field directly. Core applies it as a floor for retry backoff and caps
the resulting delay at the configured maximum. It does not change retry
classification.

Core must not import `fetch` directly.
