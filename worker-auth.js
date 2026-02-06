// Cloudflare Worker with D1 Database (no auth for now)
// This file is used for Cloudflare deployment

const PUBLIC_USER_ID = 'public-user';
const PUBLIC_USER_EMAIL = 'public@finance.app';
const PUBLIC_USER_NAME = 'Finance Public';
const PUBLIC_USER_GOOGLE_ID = 'public-user';

async function ensurePublicUser(env) {
  await env.DB.prepare(
    'INSERT OR IGNORE INTO users (id, email, name, picture, google_id, last_login) VALUES (?, ?, ?, ?, ?, datetime("now"))'
  ).bind(
    PUBLIC_USER_ID,
    PUBLIC_USER_EMAIL,
    PUBLIC_USER_NAME,
    '',
    PUBLIC_USER_GOOGLE_ID
  ).run();

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(PUBLIC_USER_ID).first();

  return user ? {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture
  } : null;
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
      const currentUser = await ensurePublicUser(env);

      if (path === '/' || path === '/index.html') {
        return new Response(JSON.stringify({
          service: 'Finance API',
          message: 'Authentication is disabled temporarily. Use /api/bills to save and load data.'
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

      if (path.startsWith('/auth')) {
        return new Response(JSON.stringify({ error: 'Authentication disabled for now' }), {
          status: 501,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!currentUser) {
        return new Response(JSON.stringify({ error: 'Public user initialization failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

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
