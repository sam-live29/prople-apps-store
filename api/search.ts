function getSecureCorsHeaders(origin?: string): Record<string, string> {
  const allowOrigin = origin || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Accept, X-User-Id, X-User-Email, X-Entity-Ref-ID',
    'Access-Control-Max-Age': '86400',
  };
}

export default async function handler(req: any, res: any) {
  const corsHeaders = getSecureCorsHeaders(req.headers?.origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Content-Type', 'application/json');
  try {
    const rawQ = ((req.query.q as string) || '').trim();
    // Sanitize query string against ReDoS and control characters
    const q = rawQ.replace(/[\x00-\x1F\x7F-\x9F]/g, '').slice(0, 150);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10) || 20, 1), 100);
    const platform = ((req.query.platform as string) || '').replace(/[^a-zA-Z0-9_\-]/g, '').trim().toLowerCase();

    // If Meilisearch is configured, proxy query
    const meiliHost = process.env.MEILISEARCH_HOST;
    const meiliKey = process.env.MEILISEARCH_SEARCH_KEY || process.env.MEILISEARCH_API_KEY || process.env.MEILISEARCH_ADMIN_KEY;

    if (meiliHost && meiliKey && q) {
      try {
        const searchUrl = `${meiliHost.replace(/\/$/, '')}/indexes/apps/search`;
        const meiliRes = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${meiliKey}`,
          },
          body: JSON.stringify({
            q,
            limit,
            filter: platform ? `platform = "${platform}" OR platform = "all"` : undefined,
          }),
        });

        if (meiliRes.ok) {
          const searchData = await meiliRes.json().catch(() => null);
          if (searchData && Array.isArray(searchData.hits)) {
            return res.status(200).json({ success: true, hits: searchData.hits, totalHits: searchData.estimatedTotalHits || searchData.hits.length });
          }
        }
      } catch (meiliErr) {
        console.warn('Meilisearch query failed:', meiliErr);
      }
    }

    return res.status(200).json({ success: true, hits: [], totalHits: 0 });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Search error' });
  }
}
