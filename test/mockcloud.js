/* In-memory stand-in for the save service (worker/src/index.js), so tests never touch the kids'
   real saves. attach(page) points the page at it and blocks every request to the real service. */
const MOCK = 'https://cloud.test';
const REAL = /spelling-worlds-saves\.[a-z0-9-]+\.workers\.dev/;
const KIDS = ['charlie', 'riley', 'vera', 'cora', 'addie'];
const clone = o => JSON.parse(JSON.stringify(o));
const { mergeState, lowersProgress } = require('../worker/src/logic.mjs');
function create() {
  const store = {}, history = [], stats = { gets: 0, posts: 0, conflicts: 0, merges: 0, realHits: 0 }, ctl = { down: false, dropNextReply: false, dropReplies: 0, delayMs: 0 };
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  const json = (req, body, status = 200) => req.respond({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
  function handle(req) {
    const url = req.url();
    if (REAL.test(url)) { stats.realHits++; return req.abort('blockedbyclient'); }
    if (!url.startsWith(MOCK)) return req.continue();
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
    if (ctl.down) return req.abort('internetdisconnected');
    const path = new URL(url).pathname;
    if (path === '/saves') { stats.gets++; const players = {}; KIDS.forEach(id => { if (store[id]) players[id] = clone(store[id]); }); return json(req, { players }); }
    const id = decodeURIComponent(path.split('/')[2] || ''), cur = store[id] || { rev: 0, state: null };
    if (req.method() === 'GET') { stats.gets++; return json(req, clone(cur)); }
    stats.posts++;
    const body = JSON.parse(req.postData() || '{}'), isObj = o => o && typeof o === 'object' && !Array.isArray(o);
    let state = body.state, merged = false;
    const conflict = () => { stats.conflicts++; return json(req, { conflict: true, ...clone(cur) }); };
    if (cur.rev !== body.rev) {
      if (!cur.state) return conflict();
      let from = isObj(body.base) ? body.base : null;
      const sids = Array.isArray(body.sids) ? body.sids : [];
      const hit = history.filter(h => h.id === id && h.rev > body.rev && sids.includes(h.sid)).sort((a, b) => b.rev - a.rev)[0];
      if (hit) from = clone(hit.state);
      if (!from) return conflict();
      state = mergeState(state, clone(cur.state), from); merged = true; stats.merges++;
    }
    if (lowersProgress(state, cur.state)) return conflict();
    store[id] = { rev: cur.rev + 1, state: clone(state) }; history.push({ id, rev: cur.rev + 1, sid: state._sid, state: clone(state) });
    if (ctl.dropNextReply) { ctl.dropNextReply = false; return req.abort('connectionreset'); }
    if (ctl.dropReplies > 0) { ctl.dropReplies--; return req.abort('connectionreset'); }
    const reply = merged ? { rev: cur.rev + 1, state, merged: true } : { rev: cur.rev + 1 };
    if (ctl.delayMs) return new Promise(res => setTimeout(() => res(json(req, reply)), ctl.delayMs));
    return json(req, reply);
  }
  async function attach(page) {
    await page.evaluateOnNewDocument(u => { window.SPELLING_CLOUD = u; }, MOCK);
    await page.setRequestInterception(true);
    page.on('request', handle);
  }
  return { store, stats, ctl, attach, MOCK };
}
module.exports = { create };
