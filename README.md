# directus-extension-key

[![npm version](https://img.shields.io/npm/v/directus-extension-key)](https://www.npmjs.com/package/directus-extension-key)
[![npm downloads](https://img.shields.io/npm/dm/directus-extension-key)](https://www.npmjs.com/package/directus-extension-key)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Directus](https://img.shields.io/badge/Directus-%3E%3D10.0.0-64BCBD)](https://directus.io)

A Directus **bundle extension** that provides centralized, secure management of API keys, access tokens, and encryption secrets. It prevents sensitive values from being exposed in configuration files or version control.

## Features

- 🗄️ **2 Storage Providers** — Database (encrypted), Environment Variable
- 🔐 **AES-256-GCM Encryption** — Database-stored values are encrypted using your Directus `SECRET`
- 🖥️ **Admin UI** — Vue 3 module in the Directus Data Studio sidebar
- 🔌 **REST API** — Full CRUD + secure retrieval endpoint
- 📦 **`getKey()` Helper** — Typed function for use in other Directus extensions

## Installation

### Via npm (recommended)

```bash
npm install directus-extension-key
```

Then place (or symlink) the package inside your Directus `extensions/` folder, or use a Docker volume mount — Directus will auto-load it on startup.

### Via Docker / local build

```bash
# Inside the extension directory
npm install
npm run build
```

Mount the built output into your Directus container:

```yaml
# docker-compose.yml
volumes:
  - ./extensions/directus-extension-key/dist:/directus/extensions/directus-extension-key/dist
  - ./extensions/directus-extension-key/package.json:/directus/extensions/directus-extension-key/package.json
```

## Quick Start

1. **Install** the extension (see above).
2. **Start Directus** — the extension is auto-loaded on startup.
3. **Open the Admin UI** at `http://localhost:8055/admin` → click **Key Manager** in the left sidebar.

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
import { getKey } from 'directus-extension-key/dist/api.js';

// Inside any hook or endpoint that has the `database` knex instance:
const stripeSecret = await getKey('STRIPE_KEY', database);
```

## Storage Providers

| Provider | How it resolves the value | Recommended for |
|---|---|---|
| `database` | Decrypts AES-256-GCM value from DB | Development / low-risk |
| `env` | Returns `process.env[varName]` | CI/CD / containers |

## Security Notes

> **Warning**: If the Directus `SECRET` env var is rotated, all **database-provider** keys must be re-created, as the old ciphertext cannot be decrypted with a new key.

- Raw secret values are **never** returned by the `GET /km/keys` list endpoint
- All endpoints require `admin` role authentication
- For production, prefer `env` providers over `database`

## License

[GPL-3.0](https://www.gnu.org/licenses/gpl-3.0) © [Ankit Chauhan](https://github.com/ankitchauhan246)
