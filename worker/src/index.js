/* Spelling Worlds save service. One row per player; a save only lands when it names the
   revision it was based on (compare-and-swap), progress can only drop through a Reset,
   and every accepted save is also kept in a history table for recovery. */
const KIDS = ['charlie', 'riley', 'vera', 'cora'];
const ID_RE = /^(charlie|riley|vera|cora|qa-[a-z0-9-]{1,32})$/;
const MAX_BYTES = 200000;
const KEEP_HISTORY = 400;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

async function current(db, id) {
  const r = await db.prepare('SELECT rev, state FROM saves WHERE player = ?').bind(id).first();
  return r ? { rev: r.rev, state: JSON.parse(r.state) } : { rev: 0, state: null };
}

/* rewards may only go down through a Reset, which bumps the epoch */
function lowersProgress(next, prev) {
  if (!prev) return false;
  const ne = next.epoch || 0, pe = prev.epoch || 0;
  if (ne !== pe) return ne < pe;
  const pw = prev.worlds || {}, nw = next.worlds || {};
  return Object.keys(pw).some(k => ((nw[k] && nw[k].pearls) || 0) < ((pw[k] && pw[k].pearls) || 0));
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url), db = env.DB;
    if (url.pathname === '/saves' && req.method === 'GET') {
      const { results } = await db.prepare('SELECT player, rev, state FROM saves WHERE player IN (?, ?, ?, ?)').bind(...KIDS).all();
      const players = {};
      for (const r of results) players[r.player] = { rev: r.rev, state: JSON.parse(r.state) };
      return json({ players });
    }
    const m = url.pathname.match(/^\/saves\/([^/]+)$/);
    if (!m || !ID_RE.test(m[1])) return json({ error: 'not_found' }, 404);
    const id = m[1];
    if (req.method === 'GET') return json(await current(db, id));
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: 'too_big' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad_json' }, 400); }
    const state = body && body.state, base = body && Number.isInteger(body.rev) ? body.rev : -1;
    if (!state || typeof state !== 'object' || Array.isArray(state) || base < 0) return json({ error: 'bad_request' }, 400);

    const cur = await current(db, id);
    /* conflicts answer 200 with conflict:true, so browsers do not log them as failed requests */
    if (cur.rev !== base || lowersProgress(state, cur.state)) return json({ conflict: true, ...cur });
    const now = Date.now(), s = JSON.stringify(state);
    const res = base === 0
      ? await db.prepare('INSERT INTO saves (player, rev, state, updated) VALUES (?, 1, ?, ?) ON CONFLICT(player) DO NOTHING').bind(id, s, now).run()
      : await db.prepare('UPDATE saves SET rev = rev + 1, state = ?, updated = ? WHERE player = ? AND rev = ?').bind(s, now, id, base).run();
    if (!res.meta.changes) return json({ conflict: true, ...(await current(db, id)) });

    const writes = [db.prepare('INSERT INTO history (player, rev, state, at) VALUES (?, ?, ?, ?)').bind(id, base + 1, s, now)];
    if ((base + 1) % 25 === 0) writes.push(db.prepare('DELETE FROM history WHERE player = ? AND id NOT IN (SELECT id FROM history WHERE player = ? ORDER BY id DESC LIMIT ?)').bind(id, id, KEEP_HISTORY));
    await db.batch(writes);
    return json({ rev: base + 1 });
  }
};
