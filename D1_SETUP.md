# Cloudflare D1 Database Setup Guide

Your finance app is now configured to use **Cloudflare D1** - Cloudflare's serverless SQL database built on SQLite.

## Database Information

- **Database ID:** `14f769e0-cf32-4432-b641-0f02509090dc`
- **Database Name:** `finance-db`
- **Type:** SQLite (via Cloudflare D1)

## Step 1: Initialize the Database Schema

Run this command to create the database tables:

```bash
wrangler d1 execute finance-db --file=schema.sql --remote
```

This creates the `bills` table in your D1 database.

### Verify Database

Check if the table was created:

```bash
wrangler d1 execute finance-db --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
```

You should see `bills` in the output.

## Step 2: Local Development

For local development with D1:

```bash
# Create local D1 database for testing
wrangler d1 execute finance-db --file=schema.sql --local

# Start the worker locally
wrangler dev
```

This starts a local development server at `http://localhost:8787`

### Test API Endpoints

```bash
# Health check
curl http://localhost:8787/api/health

# Get all bills
curl http://localhost:8787/api/bills

# Create a bill
curl -X POST http://localhost:8787/api/bills \
  -H "Content-Type: application/json" \
  -d '{
    "participants": [{"id":"1","name":"Alex","paid":false}],
    "items": [{"id":"i1","name":"Coffee","price":5,"category":"tea","participants":["1"],"paidBy":["1"]}],
    "taxPercent": 10,
    "tipPercent": 15
  }'
```

## Step 3: Deploy to Cloudflare

### Deploy the Backend (Worker)

```bash
# Deploy the Worker with D1
wrangler deploy
```

This deploys your API to Cloudflare Workers. You'll get a URL like:
`https://finance.your-subdomain.workers.dev`

### Deploy the Frontend (Pages)

Your frontend is already configured for Cloudflare Pages. Just push to GitHub:

```bash
git push origin main
```

Cloudflare Pages will automatically build and deploy.

## Step 4: Connect Frontend to Backend

Update your frontend to use the Worker URL:

### Option A: Environment Variable (Recommended)

In Cloudflare Pages settings, add:
```
VITE_API_URL = https://finance.your-subdomain.workers.dev
```

### Option B: Update src/App.jsx

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'https://finance.your-subdomain.workers.dev/api';
```

## D1 Database Commands

### View Data

```bash
# Query all bills
wrangler d1 execute finance-db --command="SELECT * FROM bills" --remote

# Count bills
wrangler d1 execute finance-db --command="SELECT COUNT(*) FROM bills" --remote

# Get recent bills
wrangler d1 execute finance-db --command="SELECT id, created_at FROM bills ORDER BY created_at DESC LIMIT 5" --remote
```

### Backup Database

```bash
# Export all data
wrangler d1 export finance-db --output=backup.sql --remote
```

### Delete Data

```bash
# Delete all bills (be careful!)
wrangler d1 execute finance-db --command="DELETE FROM bills" --remote

# Delete specific bill
wrangler d1 execute finance-db --command="DELETE FROM bills WHERE id='1234567890'" --remote
```

### Reset Database

```bash
# Drop and recreate table
wrangler d1 execute finance-db --command="DROP TABLE IF EXISTS bills" --remote
wrangler d1 execute finance-db --file=schema.sql --remote
```

## Architecture

```
┌─────────────────────────────────────────┐
│   Cloudflare Pages (Frontend)          │
│   React + Vite                          │
└──────────┬──────────────────────────────┘
           │
           │ API calls
           ↓
┌─────────────────────────────────────────┐
│   Cloudflare Workers (Backend API)     │
│   worker.js                             │
└──────────┬──────────────────────────────┘
           │
           │ SQL queries
           ↓
┌─────────────────────────────────────────┐
│   Cloudflare D1 Database                │
│   SQLite (serverless)                   │
│   ID: 14f769e0-cf32-4432-b641-0f02509…  │
└─────────────────────────────────────────┘
```

## Configuration Files

### wrangler.toml
```toml
name = "finance"
compatibility_date = "2026-02-06"
main = "worker.js"

[[d1_databases]]
binding = "DB"
database_name = "finance-db"
database_id = "14f769e0-cf32-4432-b641-0f02509090dc"
```

### schema.sql
```sql
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Data Structure

Bills are stored as JSON in the `data` column:

```json
{
  "id": "1738844400000",
  "participants": [
    {"id": "1", "name": "Alex", "paid": false}
  ],
  "items": [
    {
      "id": "i1",
      "name": "Coffee",
      "price": 5,
      "category": "tea",
      "participants": ["1"],
      "paidBy": ["1"]
    }
  ],
  "taxPercent": 10,
  "tipPercent": 15,
  "createdAt": "2026-02-06T10:00:00.000Z",
  "updatedAt": "2026-02-06T10:00:00.000Z"
}
```

## Troubleshooting

### Error: "binding DB not found"

Make sure you've deployed with the correct wrangler.toml:
```bash
wrangler deploy
```

### Error: "no such table: bills"

Initialize the database schema:
```bash
wrangler d1 execute finance-db --file=schema.sql --remote
```

### Error: "Resource at path 'worker.js' not found"

Make sure `worker.js` exists in your project root.

### Local development not working

Use `wrangler dev` instead of `npm run server` for D1 development.

## Monitoring & Logs

### View Worker Logs

```bash
wrangler tail
```

### View D1 Metrics

Go to Cloudflare Dashboard → D1 → finance-db → Metrics

## Pricing

- **D1:** Free tier includes:
  - 5 GB storage
  - 5 million reads/day
  - 100,000 writes/day
  
- **Workers:** Free tier includes:
  - 100,000 requests/day
  - 10ms CPU time per request

Your app should easily fit within free tier limits! 🎉

## Migration from MongoDB (if needed)

If you have existing MongoDB data, export it and import to D1:

```bash
# 1. Export from MongoDB (adjust connection string)
mongoexport --uri="mongodb://..." --collection=bills --out=bills.json

# 2. Convert and import to D1
# Create a script to read bills.json and insert into D1
node migrate-to-d1.js
```

## Next Steps

1. ✅ Initialize database: `wrangler d1 execute finance-db --file=schema.sql --remote`
2. ✅ Test locally: `wrangler dev`
3. ✅ Deploy Worker: `wrangler deploy`
4. ✅ Update frontend API URL in Cloudflare Pages settings
5. ✅ Test the full app!

Your finance app is now running on Cloudflare's edge network with D1! 🚀
