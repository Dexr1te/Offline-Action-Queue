# Security

## Security model

OfflineQ is not a secure vault.

IndexedDB data is accessible to JavaScript running in the same origin.

Therefore:

- do not persist passwords;
- do not persist refresh tokens;
- do not persist long-lived bearer tokens;
- do not assume queued bodies are encrypted at rest;
- protect the application against XSS;
- inject authentication at delivery time;
- allow applications to redact sensitive values from logs;
- do not log request bodies by default.

The README must avoid absolute claims such as:

> "OfflineQ can never lose data."

Use:

> "OfflineQ durably persists queued actions in browser storage until they are
> delivered, cancelled, failed, or browser storage is removed/evicted."

## Security policy

Please do not report security vulnerabilities through public GitHub issues.

Report vulnerabilities privately through GitHub Security Advisories.

Include:

- affected package/version;
- reproduction;
- impact;
- suggested mitigation if known.

Do not include production credentials or private user data.

### Scope

Security issues may include:

- accidental persistence of secrets;
- auth header leakage;
- unsafe logging;
- cross-origin request behavior;
- queue tampering that leads to unintended requests;
- dependency vulnerabilities.

OfflineQ stores queued data in browser storage and does not provide encryption
at rest.
