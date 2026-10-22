const { Redis } = require('@upstash/redis');

// Initialize Redis from Upstash environment variables or Vercel KV fallback
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

const LB_KEY = 'jp_leaderboard';
const TOP_N = 10;
const MAX_NAME = 10;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!redis) {
    console.error('Redis credentials missing! Check Vercel project environment variables.');
    return res.status(500).json({ error: 'Database not configured' });
  }

  // GET /api/scores  →  return top 10 [ { name, score }, ... ]
  if (req.method === 'GET') {
    try {
      // zrange with withScores returns [{ member, score }, ...] in @upstash/redis
      const results = await redis.zrange(LB_KEY, 0, TOP_N - 1, { rev: true, withScores: true });
      if (!results || results.length === 0) return res.status(200).json([]);

      // Format results cleanly (handles both [member, score, ...] array and [{member, score}] objects)
      const board = [];
      for (let i = 0; i < results.length; i++) {
        const item = results[i];
        if (typeof item === 'object' && item !== null && 'member' in item) {
          board.push({ name: String(item.member), score: Number(item.score) });
        } else if (typeof item === 'string' && i + 1 < results.length && typeof results[i + 1] === 'number') {
          board.push({ name: String(item), score: Number(results[i + 1]) });
          i++;
        } else {
          board.push({ name: String(item), score: 0 });
        }
      }
      return res.status(200).json(board);
    } catch (err) {
      console.error('GET /api/scores error:', err);
      return res.status(500).json({ error: 'Failed to load scores' });
    }
  }

  // POST /api/scores  body: { name, score }  →  save if it's a personal best
  if (req.method === 'POST') {
    try {
      let { name, score } = req.body || {};
      name = String(name || '').trim().toUpperCase().slice(0, MAX_NAME);
      score = parseInt(score, 10);

      if (!name || isNaN(score) || score <= 0) {
        return res.status(400).json({ error: 'Invalid name or score' });
      }

      // Only update the leaderboard if this is a new personal best for this name
      const existing = await redis.zscore(LB_KEY, name);
      if (existing === null || score > Number(existing)) {
        await redis.zadd(LB_KEY, { score, member: name });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('POST /api/scores error:', err);
      return res.status(500).json({ error: 'Failed to save score' });
    }
  }

  res.status(405).end();
};

