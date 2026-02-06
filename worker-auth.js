// Cloudflare Worker with D1 Database and Google OAuth
// This file is used for Cloudflare deployment

// Helper function to generate random session ID
function generateSessionId() {
  return crypto.randomUUID();
}

// Helper function to get user from session
async function getUserFromSession(sessionId, env) {
  if (!sessionId) return null;

  const session = await env.DB.prepare(
    'SELECT s.*, u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime("now")'
  ).bind(sessionId).first();

  return session ? {
    id: session.user_id,
    email: session.email,
    name: session.name,
    picture: session.picture
  } : null;
}

// Helper function to exchange Google auth code for tokens
async function exchangeGoogleCode(code, env) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.REDIRECT_URI || 'http://localhost:8787/auth/callback',
      grant_type: 'authorization_code'
    })
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const tokens = await tokenResponse.json();
  
  // Get user info from Google
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  if (!userInfoResponse.ok) {
    throw new Error('Failed to get user info');
  }

  return await userInfoResponse.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Get session from cookie or Authorization header
      const cookies = request.headers.get('Cookie') || '';
      const sessionMatch = cookies.match(/session=([^;]+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : request.headers.get('Authorization')?.replace('Bearer ', '');

      // ========== AUTH ROUTES ==========

      // Google OAuth login URL
      if (path === '/auth/google') {
        const redirectUri = env.REDIRECT_URI || `${url.origin}/auth/callback`;
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'email profile');
        authUrl.searchParams.set('access_type', 'offline');

        return new Response(JSON.stringify({ url: authUrl.toString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // OAuth callback handler
      if (path === '/auth/callback') {
        const code = url.searchParams.get('code');
        if (!code) {
          return new Response('Missing authorization code', { status: 400 });
        }

        // Exchange code for user info
        const googleUser = await exchangeGoogleCode(code, env);

        // Check if user exists, if not create
        let user = await env.DB.prepare(
          'SELECT * FROM users WHERE google_id = ?'
        ).bind(googleUser.id).first();

        if (!user) {
          const userId = generateSessionId();
          await env.DB.prepare(
            'INSERT INTO users (id, email, name, picture, google_id, last_login) VALUES (?, ?, ?, ?, ?, datetime("now"))'
          ).bind(userId, googleUser.email, googleUser.name, googleUser.picture, googleUser.id).run();
          
          user = { id: userId, email: googleUser.email, name: googleUser.name, picture: googleUser.picture };
        } else {
          // Update last login
          await env.DB.prepare(
            'UPDATE users SET last_login = datetime("now") WHERE id = ?'
          ).bind(user.id).run();
        }

        // Create session (expires in 30 days)
        const newSessionId = generateSessionId();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        await env.DB.prepare(
          'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
        ).bind(newSessionId, user.id, expiresAt).run();

        // Redirect to frontend with session
        const redirectUrl = new URL(env.FRONTEND_URL || url.origin);
        redirectUrl.searchParams.set('session', newSessionId);
        
        return Response.redirect(redirectUrl.toString(), 302);
      }

      // Get current user
      if (path === '/auth/me') {
        const user = await getUserFromSession(sessionId, env);
        if (!user) {
          return new Response(JSON.stringify({ error: 'Not authenticated' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify(user), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Logout
      if (path === '/auth/logout' && request.method === 'POST') {
        if (sessionId) {
          await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ========== API ROUTES (Protected) ==========

      // Get current user for protected routes
      const currentUser = await getUserFromSession(sessionId, env);

      // Health check (public)
      if (path === '/api/health') {
        return new Response(
          JSON.stringify({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            authenticated: !!currentUser
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // All other API routes require authentication
      if (!currentUser && path.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get all bills for current user
      if (path === '/api/bills' && request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT * FROM bills WHERE user_id = ? ORDER BY created_at DESC'
        ).bind(currentUser.id).all();
        
        const bills = result.results.map(row => JSON.parse(row.data));
        return new Response(JSON.stringify(bills), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get current/most recent bill for user
      if (path === '/api/bills/current' && request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT * FROM bills WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(currentUser.id).first();
        
        const bill = result ? JSON.parse(result.data) : null;
        return new Response(JSON.stringify(bill), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get specific bill by ID
      const billMatch = path.match(/^\/api\/bills\/([^\/]+)$/);
      if (billMatch && request.method === 'GET') {
        const billId = billMatch[1];
        
        const result = await env.DB.prepare(
          'SELECT * FROM bills WHERE id = ? AND user_id = ?'
        ).bind(billId, currentUser.id).first();
        
        if (result) {
          const bill = JSON.parse(result.data);
          return new Response(JSON.stringify(bill), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Bill not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Create new bill
      if (path === '/api/bills' && request.method === 'POST') {
        const body = await request.json();
        const billId = Date.now().toString();
        
        const billData = {
          id: billId,
          ...body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await env.DB.prepare(
          'INSERT INTO bills (id, user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          billId,
          currentUser.id,
          JSON.stringify(billData),
          billData.createdAt,
          billData.updatedAt
        ).run();

        return new Response(JSON.stringify(billData), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update bill
      if (billMatch && request.method === 'PUT') {
        const billId = billMatch[1];
        const body = await request.json();
        
        const billData = {
          ...body,
          id: billId,
          updatedAt: new Date().toISOString()
        };

        const result = await env.DB.prepare(
          'UPDATE bills SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?'
        ).bind(
          JSON.stringify(billData),
          billData.updatedAt,
          billId,
          currentUser.id
        ).run();

        if (result.meta.changes > 0) {
          return new Response(JSON.stringify(billData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Bill not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Delete bill
      if (billMatch && request.method === 'DELETE') {
        const billId = billMatch[1];
        
        const result = await env.DB.prepare(
          'DELETE FROM bills WHERE id = ? AND user_id = ?'
        ).bind(billId, currentUser.id).run();

        if (result.meta.changes > 0) {
          return new Response(JSON.stringify({ message: 'Bill deleted successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Bill not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 404 Not Found
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
