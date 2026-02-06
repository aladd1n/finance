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
    picture: session.picture,
    role: session.role || 'user'
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

// Parse receipt text to extract items and prices
function parseReceiptText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const items = [];
  
  // Common receipt patterns:
  // 1. Item name followed by price: "Coffee 12.50" or "Coffee    12.50"
  // 2. Item name on one line, price on next: "Coffee\n12.50"
  // 3. Item with quantity: "2x Coffee 25.00"
  
  const pricePattern = /(\d+[.,]\d{2}|\d+)/g; // Matches prices like 12.50 or 12,50 or 12
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip common receipt headers/footers
    if (
      line.toLowerCase().includes('total') ||
      line.toLowerCase().includes('subtotal') ||
      line.toLowerCase().includes('tax') ||
      line.toLowerCase().includes('tip') ||
      line.toLowerCase().includes('change') ||
      line.toLowerCase().includes('cash') ||
      line.toLowerCase().includes('card') ||
      line.toLowerCase().includes('thank you') ||
      line.toLowerCase().includes('receipt') ||
      line.match(/^\d{2}\/\d{2}\/\d{4}/) || // Date pattern
      line.match(/^\d{2}:\d{2}/) // Time pattern
    ) {
      continue;
    }
    
    // Try to find item name and price on same line
    const matches = line.match(/^(.+?)\s+(\d+[.,]\d{2}|\d+)$/);
    if (matches) {
      const name = matches[1].replace(/^\d+x?\s*/i, '').trim(); // Remove quantity prefix
      const price = matches[2].replace(',', '.');
      
      if (name.length > 2 && parseFloat(price) > 0) {
        items.push({
          name: name,
          price: parseFloat(price).toFixed(2)
        });
      }
      continue;
    }
    
    // Try to find price on the current line and item name from previous lines
    const priceMatches = line.match(pricePattern);
    if (priceMatches && i > 0) {
      const prevLine = lines[i - 1];
      // Check if previous line doesn't contain a price (to avoid duplicates)
      if (!prevLine.match(pricePattern) && prevLine.length > 2) {
        const price = priceMatches[0].replace(',', '.');
        const name = prevLine.replace(/^\d+x?\s*/i, '').trim();
        
        if (parseFloat(price) > 0) {
          items.push({
            name: name,
            price: parseFloat(price).toFixed(2)
          });
        }
      }
    }
  }
  
  return items;
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
          // First user becomes admin, others are regular users
          const usersCount = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
          const role = usersCount.count === 0 ? 'admin' : 'user';
          
          await env.DB.prepare(
            'INSERT INTO users (id, email, name, picture, google_id, role, last_login) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
          ).bind(userId, googleUser.email, googleUser.name, googleUser.picture, googleUser.id, role).run();
          
          user = { id: userId, email: googleUser.email, name: googleUser.name, picture: googleUser.picture, role };
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

      if (path === '/' || path === '/index.html') {
        return new Response(JSON.stringify({
          service: 'Finance API',
          message: 'Use /auth/google to login'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path === '/favicon.ico') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }

      // Health check (public)
      if (path === '/api/health') {
        return new Response(
          JSON.stringify({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            authenticated: !!currentUser,
            role: currentUser?.role || null
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

      // ========== EVENTS API ==========

      // Get all events (visible to all users)
      if (path === '/api/events' && request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT * FROM events ORDER BY event_date DESC, created_at DESC'
        ).bind().all();
        
        return new Response(JSON.stringify(result.results || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create new event (ADMIN ONLY)
      if (path === '/api/events' && request.method === 'POST') {
        if (currentUser.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json();
        const eventId = generateSessionId();
        const now = new Date().toISOString();
        
        const eventData = {
          id: eventId,
          user_id: currentUser.id,
          title: body.title,
          event_date: body.event_date,
          description: body.description || '',
          created_at: now,
          updated_at: now
        };

        await env.DB.prepare(
          'INSERT INTO events (id, user_id, title, event_date, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          eventData.id,
          eventData.user_id,
          eventData.title,
          eventData.event_date,
          eventData.description,
          eventData.created_at,
          eventData.updated_at
        ).run();

        return new Response(JSON.stringify(eventData), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get, Update, or Delete specific event
      const eventMatch = path.match(/^\/api\/events\/([^\/]+)$/);

      if (eventMatch && request.method === 'GET') {
        const eventId = eventMatch[1];
        const result = await env.DB.prepare(
          'SELECT * FROM events WHERE id = ? AND user_id = ?'
        ).bind(eventId, currentUser.id).first();
        
        if (result) {
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Event not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      if (eventMatch && request.method === 'PUT') {
        if (currentUser.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const eventId = eventMatch[1];
        const body = await request.json();
        const now = new Date().toISOString();
        
        const result = await env.DB.prepare(
          'UPDATE events SET title = ?, event_date = ?, description = ?, updated_at = ? WHERE id = ? AND user_id = ?'
        ).bind(
          body.title,
          body.event_date,
          body.description || '',
          now,
          eventId,
          currentUser.id
        ).run();

        if (result.meta.changes > 0) {
          const updated = await env.DB.prepare(
            'SELECT * FROM events WHERE id = ?'
          ).bind(eventId).first();
          
          return new Response(JSON.stringify(updated), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Event not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      if (eventMatch && request.method === 'DELETE') {
        if (currentUser.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const eventId = eventMatch[1];
        const result = await env.DB.prepare(
          'DELETE FROM events WHERE id = ? AND user_id = ?'
        ).bind(eventId, currentUser.id).run();

        if (result.meta.changes > 0) {
          return new Response(JSON.stringify({ message: 'Event deleted successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Event not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ========== BILLS API ==========

      // Get all bills (optionally filtered by event_id)
      if (path === '/api/bills' && request.method === 'GET') {
        const eventId = url.searchParams.get('event_id');
        
        const query = eventId 
          ? 'SELECT * FROM bills WHERE event_id = ? ORDER BY created_at DESC'
          : 'SELECT * FROM bills ORDER BY created_at DESC';
        
        const result = eventId
          ? await env.DB.prepare(query).bind(eventId).all()
          : await env.DB.prepare(query).bind().all();
        
        const bills = result.results.map(row => ({...JSON.parse(row.data), dbId: row.id, event_id: row.event_id}));
        return new Response(JSON.stringify(bills), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get current/most recent bill
      if (path === '/api/bills/current' && request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT * FROM bills ORDER BY created_at DESC LIMIT 1'
        ).bind().first();
        
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
          'SELECT * FROM bills WHERE id = ?'
        ).bind(billId).first();
        
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

      // Create new bill (ADMIN ONLY)
      if (path === '/api/bills' && request.method === 'POST') {
        if (currentUser.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json();
        const billId = Date.now().toString();
        
        const billData = {
          id: billId,
          ...body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: currentUser.id
        };

        await env.DB.prepare(
          'INSERT INTO bills (id, user_id, event_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          billId,
          currentUser.id,
          body.event_id || null,
          JSON.stringify(billData),
          billData.createdAt,
          billData.updatedAt
        ).run();

        return new Response(JSON.stringify(billData), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update bill (ADMIN ONLY)
      if (billMatch && request.method === 'PUT') {
        if (currentUser.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const billId = billMatch[1];
        const body = await request.json();
        
        const billData = {
          ...body,
          id: billId,
          updatedAt: new Date().toISOString()
        };

        const result = await env.DB.prepare(
          'UPDATE bills SET event_id = ?, data = ?, updated_at = ? WHERE id = ?'
        ).bind(
          body.event_id || null,
          JSON.stringify(billData),
          billData.updatedAt,
          billId
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

      // Delete bill (ADMIN ONLY)
      if (billMatch && request.method === 'DELETE') {
        if (currentUser.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const billId = billMatch[1];
        
        const result = await env.DB.prepare(
          'DELETE FROM bills WHERE id = ?'
        ).bind(billId).run();

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

      // Receipt scanning with Cloud Vision API
      if (path === '/api/scan-receipt' && request.method === 'POST') {
        const body = await request.json();
        const { image } = body;

        if (!image) {
          return new Response(JSON.stringify({ error: 'Image required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          // Call Google Cloud Vision API
          const visionApiKey = env.GOOGLE_VISION_API_KEY;
          if (!visionApiKey) {
            return new Response(JSON.stringify({ error: 'Vision API key not configured' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const visionResponse = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requests: [{
                  image: { content: image },
                  features: [{ type: 'TEXT_DETECTION' }]
                }]
              })
            }
          );

          if (!visionResponse.ok) {
            const errorText = await visionResponse.text();
            console.error('Vision API error response:', errorText);
            throw new Error(`Vision API request failed: ${visionResponse.status} - ${errorText}`);
          }

          const visionData = await visionResponse.json();
          
          // Check for errors in the response
          if (visionData.responses && visionData.responses[0]?.error) {
            const apiError = visionData.responses[0].error;
            throw new Error(`Vision API error: ${apiError.message || JSON.stringify(apiError)}`);
          }
          const textAnnotations = visionData.responses[0]?.textAnnotations;

          if (!textAnnotations || textAnnotations.length === 0) {
            return new Response(JSON.stringify({ items: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Extract full text
          const fullText = textAnnotations[0].description;
          
          // Parse text to find items and prices
          const items = parseReceiptText(fullText);

          return new Response(JSON.stringify({ items }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (error) {
          console.error('Vision API error:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to process receipt',
            details: error.message,
            stack: error.stack
          }), {
            status: 500,
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
