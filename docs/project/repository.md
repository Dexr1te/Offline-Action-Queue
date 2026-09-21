# Repository and package structure

## Repository description

Suggested GitHub description:

> Durable offline action queue for frontend apps — persist actions locally,
> retry failed requests, recover after reloads, and sync automatically when the
> network returns.

Suggested topics:

```text
typescript
offline-first
pwa
indexeddb
frontend
queue
retry
web
react
network
```

## Proposed monorepo structure

```text
offlineq/
│
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── queue.ts
│   │   │   ├── processor.ts
│   │   │   ├── retry.ts
│   │   │   ├── scheduler.ts
│   │   │   ├── events.ts
│   │   │   ├── errors.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── indexeddb/
│   │   ├── src/
│   │   │   ├── storage.ts
│   │   │   ├── migrations.ts
│   │   │   ├── lease.ts
│   │   │   └── index.ts
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── fetch/
│   │   ├── src/
│   │   │   ├── transport.ts
│   │   │   ├── retry-after.ts
│   │   │   └── index.ts
│   │   ├── test/
│   │   └── package.json
│   │
│   └── react/
│       ├── src/
│       │   ├── provider.tsx
│       │   ├── use-offline-queue.ts
│       │   ├── use-action.ts
│       │   └── index.ts
│       ├── test/
│       └── package.json
│
├── examples/
│   ├── react-vite/
│   └── vanilla/
│
├── docs/
│   ├── README.md
│   ├── product.md
│   ├── getting-started.md
│   ├── architecture/
│   │   ├── delivery.md
│   │   ├── storage.md
│   │   ├── transport.md
│   │   └── concurrency.md
│   ├── api/
│   │   ├── core.md
│   │   └── react.md
│   ├── quality/
│   │   ├── browser.md
│   │   ├── security.md
│   │   ├── logging-and-errors.md
│   │   ├── engineering.md
│   │   └── testing.md
│   ├── project/
│   │   ├── repository.md
│   │   ├── roadmap.md
│   │   ├── implementation.md
│   │   ├── contributing.md
│   │   └── release.md
│   └── decisions/
│       ├── README.md
│       ├── 0001-framework-agnostic-core.md
│       ├── 0002-indexeddb-storage.md
│       ├── 0003-at-least-once-delivery.md
│       └── 0004-cross-tab-processor-lease.md
│
├── .changeset/
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── dependabot.yml
│
├── README.md
├── VISION.md
├── ROADMAP.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
├── SUPPORT.md
├── LICENSE
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
└── playwright.config.ts
```

## Tooling

Recommended stack:

```text
Language:           TypeScript
Package manager:    pnpm
Workspace:          pnpm workspaces
Build:              tsup
Unit tests:         Vitest
Browser tests:      Playwright
IDB test runtime:   fake-indexeddb
Linting:            ESLint
Formatting:         Prettier
Release/versioning: Changesets
CI/CD:              GitHub Actions
Registry:           npm
Documentation:      VitePress or Markdown-first docs
```

Core runtime dependencies:

```text
0
```

React adapter:

```text
react → peerDependency
```

## TypeScript policy

Strict TypeScript is mandatory.

Recommended options:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true
  }
}
```

Public APIs must not expose `any`.

## Package policy

Initial packages:

```text
@offlineq/core
@offlineq/indexeddb
@offlineq/fetch
@offlineq/react
```

Rules:

- packages use explicit `exports`;
- type declarations are shipped;
- source maps are shipped;
- packages are tree-shakeable;
- browser runtime code must not depend on Node APIs;
- core stays framework-independent;
- semver applies independently but packages should normally be released together for v1.x.

## README structure

README should stay practical and shorter than this specification.

Recommended order:

```text
logo/name
one-line description
badges

Why OfflineQ?
Installation
Quick Start
How It Works
Delivery Semantics
Retry Behavior
Idempotency
React Example
Browser Support
Limitations
Documentation
Contributing
Security
License
```

README quick-start example:

```ts
import { createQueue } from "@offlineq/core"
import { indexedDBStorage } from "@offlineq/indexeddb"
import { fetchTransport } from "@offlineq/fetch"

const queue = createQueue({
  name: "example",
  storage: indexedDBStorage(),
  transport: fetchTransport(),
})

await queue.start()

await queue.enqueue({
  method: "POST",
  url: "/api/tasks",
  body: {
    title: "Buy milk",
  },
})
```
