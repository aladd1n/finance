# Finance App - Complete Deployment Guide

This app is deployed as a **full-stack application** with separated frontend and backend services.

```
┌─────────────────────────────────────────────────────┐
│          Cloudflare Pages (Frontend)                │
│  React + Vite → Static HTML/CSS/JS                  │
└────┬────────────────────────────────────────────────┘
     │
     │ API calls to
     │
┌────v────────────────────────────────────────────────┐
│        Railway/Render (Backend)                     │
│  Express + Node.js + MongoDB                        │
└─────────────────────────────────────────────────────┘
```

## Part 1: Deploy Frontend to Cloudflare Pages

### Step 1.1: Connect Repository to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Pages** → **Create a project** → **Connect to Git**
3. Select your GitHub account and authorize
4. Select repository: `aladd1n/finance`
5. Click **Begin setup**

### Step 1.2: Configure Build Settings

**Build configuration:**
- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory (advanced):** `/` (leave default)

**Environment variables:**
Add this so frontend can call the backend:
```
VITE_API_URL = https://your-backend-domain.com
```

(For local dev, keep it as `http://localhost:3001`)

### Step 1.3: Create `vite.config.js` with API proxy

Update your Vite config to handle both local and production environments:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
```

### Step 1.4: Update Frontend API Calls

Make sure your React components use the API URL from environment:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Example API call
fetch(`${API_URL}/api/bills`)
```

### Step 1.5: Deploy

Once you push to `main` branch, Cloudflare Pages automatically builds and deploys!

---

## Part 2: Deploy Backend to Railway or Render

### Option A: Deploy to Railway (Recommended)

#### Step 2A.1: Create Account
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub

#### Step 2A.2: Create New Project
1. Click **New Project**
2. Select "Deploy a service" → **GitHub Repo**
3. Authorize GitHub and select `aladd1n/finance`

#### Step 2A.3: Configure Environment
1. Go to **Variables** tab
2. Add these environment variables:

```
MONGODB_URI = mongodb+srv://username:password@cluster.mongodb.net/finance?retryWrites=true&w=majority
NODE_ENV = production
PORT = 3000
```

#### Step 2A.4: Configure Service
1. Go to **Settings** tab
2. **Root Directory:** `server`
3. **Start Command:** `node index.js`
4. Railway will auto-detect Node.js

#### Step 2A.5: Deploy
Push to `main` and Railway automatically deploys!

You'll get a URL like: `https://finance-prod-production.up.railway.app`

---

### Option B: Deploy to Render.com

#### Step 2B.1: Create Account
1. Go to [Render.com](https://render.com)
2. Sign up with GitHub

#### Step 2B.2: Create Web Service
1. Click **New Web Service**
2. Connect to GitHub repo `aladd1n/finance`
3. Select repository and branch

#### Step 2B.3: Configure Service
- **Name:** `finance-backend`
- **Environment:** Node
- **Build Command:** `npm install`
- **Start Command:** `cd server && node index.js`
- **Root Directory:** `/` (leave default)

#### Step 2B.4: Add Environment Variables
```
MONGODB_URI = mongodb+srv://username:password@cluster.mongodb.net/finance?retryWrites=true&w=majority
NODE_ENV = production
PORT = 3000
```

#### Step 2B.5: Deploy
Click **Create Web Service** and Render auto-deploys!

You'll get a URL like: `https://finance-backend.onrender.com`

---

## Part 3: Connect Frontend to Backend

### Step 3.1: Get Backend URL

After backend deployment, you'll have a URL. Example:
- **Railway:** `https://finance-prod-production.up.railway.app`
- **Render:** `https://finance-backend.onrender.com`

### Step 3.2: Update Cloudflare Pages Environment

1. Go to **Cloudflare Pages** → Your project → **Settings**
2. Go to **Environment variables**
3. Add for **Production**:
```
VITE_API_URL = https://your-backend-url.com
```

### Step 3.3: Push Code Update

Update your frontend API calls if not already done:

```javascript
// src/App.jsx or where you make API calls
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function fetchBills() {
  const response = await fetch(`${API_URL}/api/bills`)
  return response.json()
}
```

Push to `main` → Cloudflare Pages auto-rebuilds with new API URL

---

## Local Development

### Run Everything Locally

```bash
# Terminal 1: Frontend (http://localhost:3000)
npm run dev

# Terminal 2: Backend (http://localhost:3001)
MONGODB_URI="mongodb://localhost:27017/finance" npm run server

# OR both together:
MONGODB_URI="mongodb://localhost:27017/finance" npm run dev:all
```

### Using Local MongoDB

```bash
# Option 1: MongoDB Community Edition (installed locally)
mongod

# Option 2: Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

---

## Environment Variables Summary

### Backend (`.env` file or deployment service)
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/finance
NODE_ENV=production
PORT=3000
```

### Frontend (Cloudflare Pages environment variables)
```
VITE_API_URL=https://your-backend-url.com
```

---

## Testing Your Deployment

### 1. Test Frontend
```bash
# Visit your Cloudflare Pages URL
https://your-finance-app.pages.dev
```

### 2. Test Backend Health
```bash
curl https://your-backend-url.com/api/health
# Should return: {"status":"OK","timestamp":"..."}
```

### 3. Test API Connection
```bash
curl https://your-backend-url.com/api/bills
# Should return: [] or list of bills
```

### 4. Test Full App
1. Open frontend URL in browser
2. Create a bill
3. Check MongoDB Atlas dashboard to confirm data saved

---

## Troubleshooting

### Frontend builds successfully but shows API errors

**Problem:** Frontend can't reach backend
**Solution:**
1. Check `VITE_API_URL` is set correctly in Cloudflare Pages
2. Check backend is running: `curl https://your-backend-url.com/api/health`
3. Check your fetch code uses `import.meta.env.VITE_API_URL`

### Backend fails to connect to MongoDB

**Problem:** "MongoError: connect ENOTFOUND"
**Solution:**
1. Verify `MONGODB_URI` is correct in your deployment service
2. Check MongoDB Atlas IP whitelist includes your backend provider's IPs
3. For Railway/Render: They use dynamic IPs, so add `0.0.0.0/0` to whitelist

### Cloudflare Pages shows blank page

**Problem:** Build failed silently
**Solution:**
1. Check **Deployments** in Cloudflare Pages
2. Click latest deployment to see build logs
3. Ensure `npm run build` works locally: `npm run build && ls dist/`

### CORS errors when frontend calls backend

**Problem:** "Access to XMLHttpRequest blocked by CORS"
**Solution:**
1. Backend already has CORS enabled in `server/index.js`
2. Add your frontend domain to CORS if needed:
```javascript
app.use(cors({
  origin: ['https://your-finance-app.pages.dev', 'http://localhost:3000']
}))
```

---

## Cost Summary

| Service | Cost | Notes |
|---------|------|-------|
| Cloudflare Pages | Free | Static site hosting |
| Railway | Free tier | $5/month after free credits |
| Render | Free tier | ~$7/month paid tier |
| MongoDB Atlas | Free (M0) | Shared cluster, 512MB storage |
| **Total** | **Free** | All free tiers available |

---

## Next Steps

1. ✅ Create MongoDB Atlas account (done earlier)
2. ✅ Connect GitHub to Cloudflare Pages → Deploy frontend
3. ✅ Connect GitHub to Railway/Render → Deploy backend
4. ✅ Update `VITE_API_URL` in Cloudflare Pages
5. ✅ Test API connection between frontend and backend
6. ✅ Celebrate! 🎉

Your app is now globally distributed and ready for production! 🚀
