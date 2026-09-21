# OfflineQ

Durable client-side delivery infrastructure for web applications.

> Status: Phase 2 core model is implemented. All packages remain private
> `0.0.0`; processor, durable adapters, transport, React runtime, and browser
> verification are not complete, so this is not a v1 release.

OfflineQ is a small, framework-agnostic action queue in active development for
browser applications. The Phase 2 core currently provides the action model,
storage contract, queue lifecycle, and in-memory contract tests. Its documented
target is durable delivery across temporary offline periods, retries, reloads,
and multiple tabs. The canonical product and engineering contract lives in
[`docs/`](docs/README.md).

## Packages

- `@offlineq/core` — framework-independent Phase 2 core model (implemented)
- `@offlineq/indexeddb` — IndexedDB storage adapter (planned)
- `@offlineq/fetch` — Fetch transport (planned)
- `@offlineq/react` — React adapter (planned)

The packages remain private `0.0.0`. Core has Phase 2 exports, but no processor
or built-in durable storage yet; the other package entry points remain
placeholders until their roadmap phases are implemented.

## Development

Requirements: Node.js and pnpm.

```bash
pnpm install
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

The test commands are real gates. The Phase 2 handoff records 31 passing core
unit tests plus passing lint, typecheck, formatting, and build checks. Final
integrated validation remains pending; the browser command reports no tests and
is not a pass.

## Documentation

- [Product direction](docs/product.md)
- [Getting started target](docs/getting-started.md)
- [Architecture](docs/README.md#architecture)
- [Roadmap](ROADMAP.md)

## Security

Read [SECURITY.md](SECURITY.md) before planning to persist application data.
OfflineQ is not a secure vault and must not be used to store credentials or
other secrets.

## Contributing and support

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SUPPORT.md](SUPPORT.md).

## License

OfflineQ is released under the [MIT License](LICENSE).
