const { kv } = require('@vercel/kv');

const LB_KEY = 'jp_leaderboard';
const TOP_N = 10;
const MAX_NAME = 10;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // GET /api/scores  →  return top 10 [ { name, score }, ... ]
  if (req.method === 'GET') {
    try {
      // Fetch member names ordered highest-score first
      const names = await kv.zrange(LB_KEY, 0, TOP_N - 1, { rev: true });
      if (!names || names.length === 0) return res.status(200).json([]);

      // Fetch their scores in one round-trip
      const scores = await kv.zmscore(LB_KEY, ...names);
      const board = names.map((name, i) => ({
        name: String(name),
        score: Number(scores[i]),
      }));
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

      if (!name || isNaN(score) || score < 0) {
        return res.status(400).json({ error: 'Invalid name or score' });
      }

      // Only update the leaderboard if this is a new personal best for this name
      const existing = await kv.zscore(LB_KEY, name);
      if (existing === null || score > Number(existing)) {
        await kv.zadd(LB_KEY, { score, member: name });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('POST /api/scores error:', err);
      return res.status(500).json({ error: 'Failed to save score' });
    }
  }

  res.status(405).end();
};

