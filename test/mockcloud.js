/* In-memory stand-in for the save service (worker/src/index.js), so tests never touch the kids'
   real saves. attach(page) points the page at it and blocks every request to the real service. */
const MOCK = 'https://cloud.test';
const REAL = /spelling-worlds-saves\.[a-z0-9-]+\.workers\.dev/;
const KIDS = ['charlie', 'riley', 'vera', 'cora'];
const clone = o => JSON.parse(JSON.stringify(o));
function lowersProgress(next, prev) {
  if (!prev) return false;
  const ne = next.epoch || 0, pe = prev.epoch || 0;
  if (ne !== pe) return ne < pe;
  const pw = prev.worlds || {}, nw = next.worlds || {};
  return Object.keys(pw).some(k => ((nw[k] && nw[k].pearls) || 0) < ((pw[k] && pw[k].pearls) || 0));
}
function create() {
  const store = {}, stats = { gets: 0, posts: 0, conflicts: 0, realHits: 0 }, ctl = { down: false, dropNextReply: false };
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
    const body = JSON.parse(req.postData() || '{}');
    if (cur.rev !== body.rev || lowersProgress(body.state, cur.state)) { stats.conflicts++; return json(req, { conflict: true, ...clone(cur) }); }
    store[id] = { rev: cur.rev + 1, state: body.state };
    if (ctl.dropNextReply) { ctl.dropNextReply = false; return req.abort('connectionreset'); }
    return json(req, { rev: cur.rev + 1 });
  }
  async function attach(page) {
    await page.evaluateOnNewDocument(u => { window.SPELLING_CLOUD = u; }, MOCK);
    await page.setRequestInterception(true);
    page.on('request', handle);
  }
  return { store, stats, ctl, attach, MOCK };
}
module.exports = { create };
