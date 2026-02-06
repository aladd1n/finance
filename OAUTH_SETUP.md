# Google OAuth Setup Guide

Your finance app now has Google OAuth authentication with role-based access (Admin/User)!

## Quick Setup for Production

You need to set Google OAuth secrets in Cloudflare. Run these commands:

```bash
# Set Google OAuth Client ID
npx wrangler secret put GOOGLE_CLIENT_ID
# When prompted, paste your Google Client ID

# Set Google OAuth Client Secret
npx wrangler secret put GOOGLE_CLIENT_SECRET
# When prompted, paste your Google Client Secret

# Set redirect URI (your worker URL)
npx wrangler secret put REDIRECT_URI
# When prompted, enter: https://finance.psszdh.workers.dev/auth/callback

# Set frontend URL (Pages or local)
npx wrangler secret put FRONTEND_URL
# When prompted, enter: https://your-frontend-url
```

## Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (or use existing)
3. Add authorized redirect URIs:
   ```
   https://finance.psszdh.workers.dev/auth/callback
   ```
4. Copy the Client ID and Client Secret

## OAuth Credentials

Your OAuth credentials should be configured as Cloudflare Secrets. Keep these secret and never commit them to git!

- **Client ID:** `<your-client-id>.apps.googleusercontent.com`
- **Client Secret:** `GOCSPX-<your-client-secret>`
- **Redirect URI:** `https://finance.psszdh.workers.dev/auth/callback`
- **Frontend URL:** Your Cloudflare Pages or frontend URL
- **Status:** ⚠️ Configure secrets using commands above
- **Test Users:** OAuth access is restricted to test users listed on your OAuth consent screen

> **Note:** Actual credentials are stored securely in `.dev.vars` (local) and Cloudflare Secrets (production).

## Setup Steps

### 1. Configure Authorized URLs in Google Cloud Console

Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and add these URLs:

#### Authorized JavaScript Origins:
```
http://localhost:8787
http://localhost:3000
https://finance.psszdh.workers.dev
```

#### Authorized Redirect URIs:
```
http://localhost:8787/auth/callback
https://finance.psszdh.workers.dev/auth/callback
```

### 2. Local Development Setup

Create a `.dev.vars` file with your OAuth credentials:

```bash
# .dev.vars (create this file, NOT committed to git)
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-<your-client-secret>
REDIRECT_URI=http://localhost:8787/auth/callback
FRONTEND_URL=http://localhost:3000
```

> **Security Note:** The `.dev.vars` file is gitignored and contains your actual OAuth credentials. Never commit this file!

### 3. Role-Based Access

- **Admin:** First user to sign up becomes admin automatically
  - Can add/edit/delete bills
  - Can manage participants and items
  - Auto-save enabled
  
- **User:** All subsequent users are regular users
  - Can view bills
  - Can mark their payment status
  - Can see their share amounts
  - Cannot create/edit/delete bills

Run this command to create users and sessions tables:

```bash
wrangler d1 execute finance-db --file=schema.sql --remote
```

This adds:
- `users` table - stores Google user data
- `sessions` table - manages login sessions
- `bills` table updated with `user_id` foreign key

### 4. Run Locally

```bash
# Terminal 1: Start the Worker with D1
npm run worker:dev

# Terminal 2: Start the frontend
npm run dev
```

Navigate to `http://localhost:3000` and you should see the Google login screen!

### 5. Deploy to Production

#### Set Cloudflare Secrets (IMPORTANT!)

```bash
# Set OAuth secrets (don't commit these!)
wrangler secret put GOOGLE_CLIENT_ID
# Paste your Google Client ID when prompted

wrangler secret put GOOGLE_CLIENT_SECRET  
# Paste your Google Client Secret when prompted

wrangler secret put REDIRECT_URI
# Paste: https://finance.your-subdomain.workers.dev/auth/callback

wrangler secret put FRONTEND_URL
# Paste: https://finance-xxx.pages.dev
```

#### Deploy Worker

```bash
npm run worker:deploy
```

#### Update Cloudflare Pages Environment Variable

In Cloudflare Pages settings, add:
```
VITE_API_URL = https://finance.your-subdomain.workers.dev
```

### 6. Update Google OAuth Consent Screen

Add test users who can access your app:

1. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Click "ADD USERS" under Test users
3. Add email addresses of people who should have access

## Authentication Flow

```
User clicks "Google ilə daxil ol"
          ↓
Redirects to Google OAuth
          ↓
User approves access
          ↓
Google redirects to /auth/callback with code
          ↓
Worker exchanges code for user info
          ↓
Worker creates/updates user in D1
          ↓
Worker creates session
          ↓
Redirects to frontend with session token
          ↓
Frontend stores session and loads user data
```

## API Endpoints

### Auth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google` | GET | Get Google OAuth URL |
| `/auth/callback` | GET | OAuth callback handler |
| `/auth/me` | GET | Get current user info |
| `/auth/logout` | POST | Logout and delete session |

### Protected API Endpoints

All `/api/*` endpoints now require authentication via session token.

Pass session token in header:
```
Authorization: Bearer <session-token>
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  google_id TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Bills Table (Updated)
```sql
CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Security Features

✅ **Session-based Authentication** - Sessions expire after 30 days
✅ **Google OAuth 2.0** - Industry standard authentication  
✅ **User Data Isolation** - Each user only sees their own bills
✅ **Secure Secrets Management** - OAuth credentials stored in Cloudflare secrets
✅ **CORS Protection** - Configured CORS headers
✅ **SQL Injection Protection** - Parameterized queries

## Testing the App

### Test Login Flow

1. Open `http://localhost:3000`
2. Click "Google ilə daxil ol"
3. Login with a Google account listed as test user
4. You should be redirected back to the app
5. Your profile picture appears in the header

### Test Protected API

```bash
# Without session (should fail)
curl http://localhost:8787/api/bills

# With session (should work)
curl -H "Authorization: Bearer <your-session-token>" \
  http://localhost:8787/api/bills
```

## Troubleshooting

### "OAuth access is restricted to test users"

**Solution:** Add your Google account as a test user in the OAuth consent screen.

### "redirect_uri_mismatch"

**Solution:** Make sure the redirect URI in Google Cloud Console matches exactly:
- Local: `http://localhost:8787/auth/callback`
- Production: `https://your-worker-url.workers.dev/auth/callback`

### Session not persisting

**Solution:** Check that:
1. Session is being stored in localStorage
2. Authorization header is being sent with API requests
3. Session hasn't expired (30 days)

### "Not authenticated" error

**Solution:** 
1. Check if session token is valid: `GET /auth/me`
2. Clear localStorage and login again
3. Check Cloudflare secrets are set correctly

### Cannot see bills from other users

**Solution:** This is by design! Each user can only see their own bills for privacy.

## D1 Database Commands

### View users
```bash
wrangler d1 execute finance-db \
  --command="SELECT id, email, name, created_at FROM users" \
  --remote
```

### View active sessions
```bash
wrangler d1 execute finance-db \
  --command="SELECT s.id, u.email, s.expires_at FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.expires_at > datetime('now')" \
  --remote
```

### Clean up expired sessions
```bash
wrangler d1 execute finance-db \
  --command="DELETE FROM sessions WHERE expires_at < datetime('now')" \
  --remote
```

## Production Checklist

- [ ] Set all Cloudflare secrets (CLIENT_ID, CLIENT_SECRET, etc.)
- [ ] Update Google OAuth redirect URIs with production URLs
- [ ] Deploy worker: `npm run worker:deploy`
- [ ] Update Cloudflare Pages VITE_API_URL
- [ ] Initialize D1 database: `wrangler d1 execute finance-db --file=schema.sql --remote`
- [ ] Add test users in Google OAuth consent screen
- [ ] Test login flow in production
- [ ] Verify bills are user-specific

## Next Steps

1. ✅ Run `wrangler d1 execute finance-db --file=schema.sql --remote`
2. ✅ Set Cloudflare secrets with `wrangler secret put`
3. ✅ Deploy worker: `npm run worker:deploy`
4. ✅ Add test users in Google Cloud Console
5. ✅ Test the app!

Your finance app now has enterprise-grade authentication! 🎉🔐
