# Deployment Checklist for Cloudflare

## Issue Fixed
✅ Application was trying to connect to localhost:8787 instead of production Cloudflare Workers domain

## Changes Made

### 1. API URL Configuration
- **Changed default API URL** from `http://localhost:8787/api` to `https://finance.psszdh.workers.dev/api`
- **Environment variable support**: Can be overridden with `VITE_API_URL`

### 2. Data Storage Priority
- **Primary**: Cloudflare D1 Database (via Workers API)
- **Backup**: LocalStorage (optional, gracefully handles failures)
- **Server is source of truth**: Always loads from server first

### 3. LocalStorage Handling
- All localStorage operations wrapped in try-catch
- Graceful degradation if localStorage is unavailable
- Console warnings instead of errors

## Deployment Steps

### For Cloudflare Pages (Frontend)

1. **Push to GitHub** (already done)
   ```bash
   git push origin main
   ```

2. **Set Environment Variable** (optional, for custom domain)
   - Go to Cloudflare Pages Dashboard
   - Navigate to: Settings → Environment variables
   - Add for Production:
     ```
     VITE_API_URL = https://finance.psszdh.workers.dev/api
     ```
   - Note: This step is optional since the URL is now the default

3. **Trigger Rebuild**
   - Cloudflare Pages will automatically rebuild on push
   - Or manually trigger: Deployments → Retry deployment

### For Cloudflare Workers (Backend)

No changes needed - backend is already deployed at:
```
https://finance.psszdh.workers.dev
```

## Verification

### 1. Check Build Output
```bash
npm run build
grep "finance.psszdh.workers.dev" dist/assets/*.js
```
Should return: `finance.psszdh.workers.dev`

### 2. Test API Connection
```bash
curl https://finance.psszdh.workers.dev/api/health
```
Expected: `{"status":"healthy"}`

### 3. Test Frontend
1. Open: `https://your-pages-domain.pages.dev`
2. Open browser DevTools → Console
3. Should see successful API calls to `https://finance.psszdh.workers.dev/api`
4. Should NOT see errors like "ERR_CONNECTION_REFUSED"

## Local Development

### Option 1: Test with Production API
```bash
npm run dev
# Uses production API by default
```

### Option 2: Test with Local Worker
```bash
# Terminal 1: Start worker locally
wrangler dev

# Terminal 2: Create .env.local and start frontend
echo "VITE_API_URL=http://localhost:8787/api" > .env.local
npm run dev
```

## Rollback Plan

If issues occur, revert the API URL:

1. **Quick Fix**: Set environment variable in Cloudflare Pages:
   ```
   VITE_API_URL = http://localhost:8787/api
   ```
   (Not recommended for production)

2. **Proper Rollback**: Revert the commit and redeploy

## Expected Behavior After Fix

✅ No more "ERR_CONNECTION_REFUSED" errors
✅ API calls go to `https://finance.psszdh.workers.dev/api`
✅ Data loads from D1 database
✅ LocalStorage works as backup cache
✅ App works even if localStorage is disabled

## Support

For issues, check:
1. Cloudflare Pages deployment logs
2. Cloudflare Workers logs: `wrangler tail`
3. Browser DevTools → Network tab
4. Browser DevTools → Console tab
