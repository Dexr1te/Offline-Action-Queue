# Browser support and limitations

## Browser support

v1.0 targets modern evergreen browsers with:

- IndexedDB;
- `crypto.randomUUID()` or an internal fallback;
- Promises;
- Fetch for the default transport;
- modern ES modules.

Cross-tab wake-up uses `BroadcastChannel` when available.

A fallback polling/lease strategy should allow correctness even if
`BroadcastChannel` is unavailable.

Exact browser versions should be maintained in README/CI rather than
hard-coded permanently into the architecture.

## Browser limitations

This documentation must explain:

1. IndexedDB can be cleared by the user.
2. Browser storage can theoretically be evicted.
3. Private browsing may provide different persistence guarantees.
4. OfflineQ cannot process when no page/service worker runtime is alive.
5. `navigator.onLine` is not proof that the API is reachable.
6. Browser-only code cannot guarantee exactly-once execution.
7. Cross-tab coordination does not mean cross-device coordination.
8. Queued request data is not encrypted by OfflineQ.

Users must understand that clearing browser/site data removes queued actions.
