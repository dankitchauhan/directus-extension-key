# Directus Key Extension

A Directus **bundle extension** that provides centralized, secure management of API keys, access tokens, and encryption secrets. It prevents sensitive values from being exposed in configuration files or version control.

## Features

- 🗄️ **4 Storage Providers** — Database (encrypted), File, Environment Variable, External (Vault/KMS)
- 🔐 **AES-256-GCM Encryption** — Database-stored values are encrypted using your Directus `SECRET`
- 🖥️ **Admin UI** — Vue 3 module in the Directus Data Studio sidebar
- 🔌 **REST API** — Full CRUD + secure retrieval endpoint
- 📦 **`getKey()` Helper** — Typed function for use in other Directus extensions

## Project Structure

```
src/
├── api/
│   ├── hook/index.ts           ← creates directus_keys table on startup
│   ├── endpoint/index.ts       ← REST routes at /km/*
│   └── providers/
│       ├── index.ts            ← getKey() helper + provider factory
│       ├── database.ts         ← AES-256-GCM encrypt/decrypt
│       ├── file.ts             ← reads from server file path
│       ├── env.ts              ← reads from process.env
│       └── external.ts        ← HTTP fetch (Vault / KMS)
└── module/
    ├── index.ts                ← Vue module registration
    └── components/
        ├── KeyList.vue         ← table with provider badges + CRUD actions
        └── KeyForm.vue         ← drawer form with dynamic fields per provider
```

## Getting Started

### 1. Build the Extension

```bash
npm install
npm run build
```

### 2. Start Directus

The extension is auto-loaded via the mounted `extensions/` volume.

```bash
cd ../../   # directus/
docker compose up
```

### 3. Use the Admin UI

Log in to `http://localhost:8055/admin` → click **Key Manager** in the left sidebar.

## REST API

All routes require an admin Bearer token.

```bash
# List all keys (values never exposed)
curl -H "Authorization: Bearer <token>" http://localhost:8055/km/keys

# Create an env-var key
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"STRIPE_KEY","provider":"env","source":"STRIPE_SECRET"}' \
  http://localhost:8055/km/keys

# Retrieve resolved secret
curl -H "Authorization: Bearer <token>" http://localhost:8055/km/retrieve/STRIPE_KEY
# → { "data": { "name": "STRIPE_KEY", "value": "sk_live_..." } }

# Update a key
curl -X PATCH -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"description":"Updated description"}' \
  http://localhost:8055/km/keys/<id>

# Delete a key
curl -X DELETE -H "Authorization: Bearer <token>" http://localhost:8055/km/keys/<id>
```

## Using `getKey()` in Other Extensions

```typescript
import { getKey } from 'directus-extension-key-manager/src/api/providers/index.js';

// Inside any hook or endpoint that has the `database` knex instance:
const stripeSecret = await getKey('STRIPE_KEY', database);
```

## Storage Providers

| Provider | How it resolves the value | Recommended for |
|---|---|---|
| `database` | Decrypts AES-256-GCM value from DB | Development / low-risk |
| `file` | Reads from absolute file path on server | Staging / production |
| `env` | Returns `process.env[varName]` | CI/CD / containers |
| `external` | HTTP GET to Vault / KMS URL | Production / enterprise |

### External Provider

Set `KM_EXTERNAL_TOKEN` env var to send a `Authorization: Bearer` header to your external endpoint.

Supported response shapes:
- `{ "value": "..." }` — generic
- `{ "data": { "value": "..." } }` — HashiCorp Vault KV v2
- `{ "SecretString": "..." }` — AWS Secrets Manager

## Security Notes

> **Warning**: If the Directus `SECRET` env var is rotated, all **database-provider** keys must be re-created, as the old ciphertext cannot be decrypted with a new key.

- Raw secret values are **never** returned by the `GET /km/keys` list endpoint
- All endpoints require `admin` role authentication
- For production, prefer `file`, `env`, or `external` providers over `database`
