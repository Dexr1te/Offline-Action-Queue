# Engineering standards

## Public API stability

Before v1.0:

```text
breaking changes allowed between minor versions when documented
```

After v1.0:

```text
public exported APIs follow Semantic Versioning
```

Internal modules not exported through package `exports` are not public API.

Avoid exposing low-level implementation details unnecessarily.

## Performance expectations

v1.0 should optimize for correctness first.

Expected workload:

```text
tens to low thousands of queued actions
```

Do not load the entire database into memory for every operation if IndexedDB
indexes can answer the query.

Processor should fetch only eligible actions needed for current work.

No strict benchmark target is required for v1.0, but benchmark regressions
should become part of later releases.

## Accessibility

The core library has no UI.

React examples and future DevTools must follow accessible UI practices.

The project should not force any visual component library on consumers.
