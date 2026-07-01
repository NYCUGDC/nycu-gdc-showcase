const VALID_IDS = new Set([
  'ashlight-ii',
  'astral-siphon',
  'do-a-barrel-roll',
  'elements-habitat',
  'afterglow',
  'industrial-cafe',
]);

const RATE_LIMIT_MAX = 60;    // max views per IP per project per hour
const RATE_LIMIT_TTL = 3600;  // 1 hour window

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function hashIP(ip) {
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function clientIP(request) {
  const cf = request.headers.get('CF-Connecting-IP');
  if (cf) return cf;
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // GET /api/views — all project view counts
    if (pathname === '/api/views' && method === 'GET') {
      const { keys } = await env.VIEWS_KV.list({ prefix: 'views:' });
      const counts = {};
      await Promise.all(
        keys.map(async ({ name }) => {
          const id = name.slice('views:'.length);
          const val = await env.VIEWS_KV.get(name);
          counts[id] = parseInt(val ?? '0', 10);
        })
      );
      return json(counts);
    }

    const match = pathname.match(/^\/api\/views\/([^/]+)$/);
    if (match) {
      const id = match[1];

      if (!VALID_IDS.has(id)) {
        return json({ error: 'Not Found' }, 404);
      }

      // GET /api/views/:id
      if (method === 'GET') {
        const val = await env.VIEWS_KV.get(`views:${id}`);
        return json({ id, views: parseInt(val ?? '0', 10) });
      }

      // POST /api/views/:id — increment with rate limiting
      if (method === 'POST') {
        const ip = clientIP(request);
        const hashed = await hashIP(ip);
        const hourBucket = Math.floor(Date.now() / 3600000);
        const rateLimitKey = `ratelimit:${hashed}:${id}:${hourBucket}`;

        const [rlVal, val] = await Promise.all([
          env.VIEWS_KV.get(rateLimitKey),
          env.VIEWS_KV.get(`views:${id}`),
        ]);

        const current = parseInt(val ?? '0', 10);
        const rlCount = parseInt(rlVal ?? '0', 10);

        if (rlCount >= RATE_LIMIT_MAX) {
          return json({ id, views: current });
        }

        const next = current + 1;
        await Promise.all([
          env.VIEWS_KV.put(`views:${id}`, String(next)),
          env.VIEWS_KV.put(rateLimitKey, String(rlCount + 1), { expirationTtl: RATE_LIMIT_TTL }),
        ]);
        return json({ id, views: next });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
