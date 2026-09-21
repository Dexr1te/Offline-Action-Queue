# Security

OfflineQ is not a secure vault. IndexedDB data is accessible to JavaScript
running in the same origin, may be cleared or evicted by the browser, and is
not encrypted at rest by OfflineQ.

Do not persist passwords, refresh tokens, long-lived bearer tokens, or other
secrets. Inject authentication at delivery time, protect the host application
against XSS, redact sensitive log values, and do not log request bodies by
default. Never promise that queued data can never be lost.

## Reporting a vulnerability

Do not report security vulnerabilities through public GitHub issues. Use the
repository's private GitHub Security Advisory process and include:

- affected package and version;
- a minimal reproduction;
- impact;
- a suggested mitigation, if known.

Do not include production credentials or private user data. The repository has
not selected a separate security contact channel yet.
