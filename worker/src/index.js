/* Spelling Worlds save service. One row per player; a save only lands when it names the
   revision it was based on (compare-and-swap), progress can only drop through a Reset,
   and every accepted save is also kept in a history table for recovery. */
import { mergeState, lowersProgress } from './logic.mjs';

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
    let state = body && body.state;
    const base = body && Number.isInteger(body.rev) ? body.rev : -1, isObj = o => o && typeof o === 'object' && !Array.isArray(o);
    if (!isObj(state) || base < 0) return json({ error: 'bad_request' }, 400);

    const cur = await current(db, id);
    let merged = false;
    if (cur.rev !== base && cur.state) {
      /* another device saved first. Merge here, so a page that is closing still gets its save in. If one of the
         page's earlier saves landed but its reply was lost (sids), the newest such save is the true starting point. */
      let from = isObj(body.base) ? body.base : null;
      const sids = Array.isArray(body.sids) ? body.sids.filter(x => typeof x === 'string').slice(-20) : [];
      if (sids.length) {
        const hit = await db.prepare(`SELECT state FROM history WHERE player = ? AND rev > ? AND json_extract(state, '$._sid') IN (${sids.map(() => '?').join(',')}) ORDER BY rev DESC LIMIT 1`).bind(id, base, ...sids).first();
        if (hit) from = JSON.parse(hit.state);
      }
      if (!from) return json({ conflict: true, ...cur });
      state = mergeState(state, cur.state, from); merged = true;
    } else if (cur.rev !== base) return json({ conflict: true, ...cur });
    /* conflicts answer 200 with conflict:true, so browsers do not log them as failed requests */
    if (lowersProgress(state, cur.state)) return json({ conflict: true, ...cur });
    const now = Date.now(), s = JSON.stringify(state);
    const res = cur.rev === 0
      ? await db.prepare('INSERT INTO saves (player, rev, state, updated) VALUES (?, 1, ?, ?) ON CONFLICT(player) DO NOTHING').bind(id, s, now).run()
      : await db.prepare('UPDATE saves SET rev = rev + 1, state = ?, updated = ? WHERE player = ? AND rev = ?').bind(s, now, id, cur.rev).run();
    if (!res.meta.changes) return json({ conflict: true, ...(await current(db, id)) });

    const rev = cur.rev + 1;
    const writes = [db.prepare('INSERT INTO history (player, rev, state, at) VALUES (?, ?, ?, ?)').bind(id, rev, s, now)];
    if (rev % 25 === 0) writes.push(db.prepare('DELETE FROM history WHERE player = ? AND id NOT IN (SELECT id FROM history WHERE player = ? ORDER BY id DESC LIMIT ?)').bind(id, id, KEEP_HISTORY));
    await db.batch(writes);
    return json(merged ? { rev, state, merged: true } : { rev });
  }
};
