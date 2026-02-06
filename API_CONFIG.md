# API Configuration Guide

## Overview

The Finance app connects to a Cloudflare Workers backend with D1 database. The API URL is configurable via environment variables.

## Default Configuration

**Production (default):** `https://finance.psszdh.workers.dev/api`

The app will use this URL by default when no environment variable is set.

## Environment Variables

### For Production Deployment (Cloudflare Pages)

Set in your Cloudflare Pages dashboard under Settings → Environment variables:

```
VITE_API_URL=https://finance.psszdh.workers.dev/api
```

### For Local Development

Create a `.env.local` file in the project root:

```bash
# For local development with wrangler dev
VITE_API_URL=http://localhost:8787/api
```

Or use the example file:
```bash
cp .env.local.example .env.local
```

## Data Storage

### Primary: Cloudflare D1 Database
- All data is primarily stored in Cloudflare D1 (serverless SQLite)
- Automatic sync to server on every change
- Server is the source of truth

### Backup: LocalStorage (Optional)
- LocalStorage serves as a fallback cache
- Only used when server is unavailable
- Wrapped in try-catch to handle environments where localStorage is disabled
- Can be safely disabled without breaking the app

## Development Workflow

### Local Development with Cloudflare Workers

```bash
# Terminal 1: Start the Cloudflare Worker locally
wrangler dev

# Terminal 2: Start the frontend with local API
VITE_API_URL=http://localhost:8787/api npm run dev
```

### Production Testing Locally

Test against production API:

```bash
# Use production API while developing frontend
VITE_API_URL=https://finance.psszdh.workers.dev/api npm run dev
```

## Troubleshooting

### Error: Connection Refused (localhost:8787)

**Problem:** App is trying to connect to localhost but should use production.

**Solution:** 
1. Rebuild the app with correct environment variable:
   ```bash
   VITE_API_URL=https://finance.psszdh.workers.dev/api npm run build
   ```
2. Or set the environment variable in your deployment platform (Cloudflare Pages)

### LocalStorage Errors

**Problem:** LocalStorage is disabled or unavailable.

**Solution:** No action needed. The app gracefully handles localStorage failures and falls back to server-only mode.

## API Endpoints

The following endpoints are available on the API:

- `GET /api/health` - Health check
- `GET /api/bills` - Get latest bill
- `GET /api/bills/:id` - Get specific bill
- `POST /api/bills` - Create new bill
- `PUT /api/bills/:id` - Update bill

## Security

- All API calls use CORS headers
- Data is stored securely in Cloudflare D1
- No sensitive information in localStorage
- HTTPS enforced in production
