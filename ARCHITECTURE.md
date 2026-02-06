# Application Architecture - After Fix

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│         Browser (User's Device)                         │
│                                                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │  React App (Vite Build)                           │ │
│  │  - API_URL: https://finance.psszdh.workers.dev    │ │
│  │  - Can be overridden with VITE_API_URL env var   │ │
│  └──────────────────┬────────────────────────────────┘ │
│                     │                                   │
│                     │ 1. On Load:                       │
│                     │    Try server first ────────┐     │
│                     │                             │     │
│  ┌──────────────────▼───────────────┐            │     │
│  │  LocalStorage (Optional Backup)  │            │     │
│  │  - Only used if server fails     │◄───────────┘     │
│  │  - Wrapped in try-catch          │  2. Fallback     │
│  │  - Graceful error handling       │     if needed    │
│  └──────────────────────────────────┘                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ HTTPS
                        │ API Calls
                        │
┌───────────────────────▼─────────────────────────────────┐
│    Cloudflare Workers                                    │
│    https://finance.psszdh.workers.dev/api               │
│                                                          │
│    Endpoints:                                            │
│    - GET  /api/health                                    │
│    - GET  /api/bills                                     │
│    - GET  /api/bills/:id                                 │
│    - POST /api/bills                                     │
│    - PUT  /api/bills/:id                                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ SQL Queries
                        │
┌───────────────────────▼─────────────────────────────────┐
│    Cloudflare D1 Database                                │
│    Database ID: 14f769e0-cf32-4432-b641-0f02509090dc   │
│    Database Name: finance-db                             │
│                                                          │
│    Tables:                                               │
│    - bills (id, data, created_at, updated_at)           │
└──────────────────────────────────────────────────────────┘
```

## Before Fix vs After Fix

### Before Fix ❌

```
React App
  └─> API_URL: http://localhost:8787/api
        └─> ❌ ERR_CONNECTION_REFUSED (localhost not running)
              └─> Falls back to localStorage only
                    └─> Data not synced to server
```

### After Fix ✅

```
React App
  └─> API_URL: https://finance.psszdh.workers.dev/api
        └─> ✅ Connects to Cloudflare Workers
              └─> ✅ Data synced with D1 Database
                    └─> LocalStorage as backup only
```

## Environment Configuration

### Production (Cloudflare Pages)
```
Default: https://finance.psszdh.workers.dev/api
Override: Set VITE_API_URL in Cloudflare Pages settings
```

### Local Development
```
Option 1: Use production API (default)
  npm run dev
  → Uses https://finance.psszdh.workers.dev/api

Option 2: Use local Worker
  Terminal 1: wrangler dev
  Terminal 2: Create .env.local with VITE_API_URL=http://localhost:8787/api
              npm run dev
  → Uses http://localhost:8787/api
```

## Data Loading Priority

```
1. Try to load from Server (D1 via Workers)
   ├─> Success: Use server data ✅
   │   └─> Save to localStorage as backup
   │
   └─> Failure: Check localStorage
       ├─> Found: Use cached data ⚠️
       │   └─> User sees cached data, can still add new items
       │       └─> Auto-retry server sync in background
       │
       └─> Not Found: Start fresh 🆕
           └─> User can add participants and items
               └─> Auto-save to server (with retry)
```

## Error Handling

### Server Connection Errors
```javascript
try {
  const response = await fetch(`${API_URL}/bills`);
  // Success: Use server data
} catch (error) {
  console.error('Failed to load from server:', error);
  // Fallback to localStorage
  // User still has access to cached data
}
```

### LocalStorage Errors
```javascript
try {
  localStorage.setItem('billSplitterData', JSON.stringify(data));
} catch (e) {
  console.warn('LocalStorage not available:', e);
  // No problem - server is primary storage
  // App continues to work normally
}
```

## Security Features

- ✅ HTTPS enforced in production
- ✅ CORS properly configured on Workers
- ✅ No sensitive data in localStorage
- ✅ Environment variables for configuration
- ✅ CodeQL security scan passed

## Scalability

- ✅ D1 Database handles 5M reads/day (free tier)
- ✅ Workers handle 100K requests/day (free tier)
- ✅ Edge network for global low latency
- ✅ Serverless - auto-scales with demand

## Monitoring

### Check Server Health
```bash
curl https://finance.psszdh.workers.dev/api/health
```

### View Worker Logs
```bash
wrangler tail
```

### Check D1 Database
```bash
wrangler d1 execute finance-db --command="SELECT COUNT(*) FROM bills" --remote
```
