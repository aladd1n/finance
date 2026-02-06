// Cloudflare Worker with D1 Database
// This file is used for Cloudflare deployment

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/api/health') {
        return new Response(
          JSON.stringify({ status: 'OK', timestamp: new Date().toISOString() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get all bills
      if (path === '/api/bills' && request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT * FROM bills ORDER BY created_at DESC'
        ).all();
        
        const bills = result.results.map(row => JSON.parse(row.data));
        return new Response(JSON.stringify(bills), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get current/most recent bill
      if (path === '/api/bills/current' && request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT * FROM bills ORDER BY created_at DESC LIMIT 1'
        ).first();
        
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
          'INSERT INTO bills (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind(
          billId,
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
          'UPDATE bills SET data = ?, updated_at = ? WHERE id = ?'
        ).bind(
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

      // Delete bill
      if (billMatch && request.method === 'DELETE') {
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

      // 404 Not Found
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
