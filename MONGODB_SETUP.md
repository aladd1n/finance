# MongoDB Setup & Cloudflare Deployment Guide

Your finance app has been migrated from file-based JSON storage to **MongoDB** (NoSQL), making it ready for Cloudflare deployment.

## Prerequisites

- Node.js 16+ installed
- A MongoDB Atlas account (free tier available)
- Cloudflare account for deployment

## Step 1: Set Up MongoDB Atlas

### 1.1 Create a MongoDB Atlas Account
- Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Sign up for a free account (M0 free tier is perfect for this project)

### 1.2 Create a Cluster
1. Click "Create" to start a new project
2. Select "M0 Free Tier"
3. Choose your cloud provider (AWS, Google Cloud, or Azure)
4. Create your cluster (takes 2-3 minutes)

### 1.3 Get Connection String
1. Go to "Cluster" → "Connect"
2. Choose "Drivers" → "Node.js"
3. Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/finance`)
4. Add your database name at the end: `mongodb+srv://username:password@cluster.mongodb.net/finance?retryWrites=true&w=majority`

### 1.4 Configure Network Access
1. Go to "Network Access"
2. Add IP Address → "Allow Access from Anywhere" (add 0.0.0.0/0)
3. Create a database user with username and password

## Step 2: Install Dependencies

```bash
npm install
```

This will install mongoose and other required packages.

## Step 3: Run Locally

Set your MongoDB URI as an environment variable and run the server:

### On Linux/Mac:
```bash
export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/finance?retryWrites=true&w=majority"
npm run server
```

### On Windows (PowerShell):
```powershell
$env:MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/finance?retryWrites=true&w=majority"
npm run server
```

### Run dev + server together:
```bash
MONGODB_URI="your_connection_string" npm run dev:all
```

## Step 4: Deploy to Cloudflare Workers

### 4.1 Install Wrangler CLI
```bash
npm install -g wrangler
```

### 4.2 Create Wrangler Configuration

Create a `wrangler.toml` file in your project root:

```toml
name = "finance-app"
main = "server/index.js"
type = "javascript"

[env.production]
name = "finance-app-production"
route = "example.com/api/*"
zone_id = "your_zone_id"

[vars]
MONGODB_URI = "mongodb+srv://username:password@cluster.mongodb.net/finance?retryWrites=true&w=majority"
```

### 4.3 Deploy
```bash
wrangler publish
```

## Step 5: Alternative - Deploy with Docker/Node Backend

If you prefer a traditional Node.js backend on a platform like Railway, Render, or Heroku:

### For Railway:
1. Connect your GitHub repo to Railway
2. Set environment variable: `MONGODB_URI` with your connection string
3. Ensure the PORT is set (Railway defaults to 3000)
4. Deploy!

### For Render:
1. Create a new Web Service
2. Connect your GitHub repo
3. Set Build Command: `npm install`
4. Set Start Command: `npm run server`
5. Add Environment Variable: `MONGODB_URI`
6. Deploy!

## API Endpoints (Unchanged)

All API endpoints remain the same - your frontend doesn't need changes!

```
GET  /api/bills              - Get all bills
GET  /api/bills/:id          - Get specific bill
GET  /api/bills/current      - Get most recent bill
POST /api/bills              - Create new bill
PUT  /api/bills/:id          - Update bill
DELETE /api/bills/:id        - Delete bill
GET  /api/health             - Health check
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string (required) |
| `PORT` | Server port (default: 3001) |

## Troubleshooting

### Connection Error: "connect ENOTFOUND"
- Check your MongoDB Atlas connection string is correct
- Ensure your IP is whitelisted in Network Access
- Verify database user credentials

### Error: "Cannot find module 'mongoose'"
- Run `npm install` to install dependencies

### Cloudflare Workers Limits
- MongoDB Atlas free tier has connection limits
- Monitor your usage in MongoDB Atlas dashboard
- Consider upgrading if you hit limits

## Data Migration

Your existing bills are stored in `server/data/bills.json`. To migrate them:

```javascript
// Option 1: Manually import via Compass
// Download MongoDB Compass, import bills.json into your cluster

// Option 2: Use mongoimport command
mongoimport --uri "mongodb+srv://username:password@cluster.mongodb.net/finance" \
  --collection bills \
  --file server/data/bills.json \
  --jsonArray
```

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Set MONGODB_URI environment variable
3. ✅ Test locally with `npm run dev:all`
4. ✅ Deploy to your chosen platform
5. ✅ Test API endpoints in production

You're all set! Your app is now using NoSQL and ready for scalable deployment. 🚀
