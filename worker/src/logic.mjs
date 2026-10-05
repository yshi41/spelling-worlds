/* merge and safety rules for saves, shared by the Worker and the test stand-in (test/mockcloud.js) */
/* the game's own merge (index.html mergeState): the save was made from base, the service now holds cur;
   keep both sets of changes. A newer epoch (Reset) wins outright. */
const WORLD_KEYS = ['lagoon', 'candy', 'canopy', 'ocean', 'bows', 'boba'];
const CHAR_KEY = { lagoon: 'charLagoon', candy: 'charCandy', canopy: 'charCanopy', ocean: 'charOcean', bows: 'charBows', boba: 'charBoba' };
const CHAR_DEF = { lagoon: 'axolotl', candy: 'bear', canopy: 'sloth', ocean: 'jellyfish', bows: 'bow', boba: 'milktea' };
/* every character has its own rewards (state.chars['world:character']); saves from before that are read the way
   index.html migrateChars reads them */
export function migrateChars(st) {
  const c = {}, ws = st.worlds || {}, view = (st.look && CHAR_KEY[st.look]) ? st.look : (st.theme || (st.grade === '4' ? 'candy' : 'lagoon')), th = st.theme || view;
  const rec = w => ({ pearls: w.pearls || 0, wearLevel: w.wearLevel == null ? null : w.wearLevel });
  WORLD_KEYS.forEach(k => { const w = ws[k]; if (!w || k === th || (!(w.pearls > 0) && w.wearLevel == null)) return; c[k + ':' + (st[CHAR_KEY[k]] || CHAR_DEF[k])] = rec(w); });
  const h = ws[th];
  if (h && (h.pearls > 0 || h.wearLevel != null)) { const key = view + ':' + (st[CHAR_KEY[view]] || CHAR_DEF[view]); if (!c[key] || (h.pearls || 0) >= c[key].pearls) c[key] = rec(h); }
  return c;
}
const SETTINGS = ['kid', 'grade', 'gradePicked', 'charLagoon', 'charCandy', 'charCanopy', 'charOcean', 'charBows', 'charBoba', 'look', 'theme', 'sound', 'roundLen', 'restoredId', '_sid'];
/* store state: things spent only grow (merged like rewards), things owned are the union, what is worn or shown is the newest choice */
const grow = (m, d, b) => Math.max(0, Math.max(d || 0, b || 0) + ((m || 0) - (b || 0)));
const union = (a, b) => Array.from(new Set((a || []).concat(b || [])));
export function mergeStore(out, mem, disk, base) {
  out.storeV = Math.max(mem.storeV || 0, disk.storeV || 0);
  out.mspent = grow(mem.mspent, disk.mspent, base.mspent);
  out.pets = { own: union(mem.pets && mem.pets.own, disk.pets && disk.pets.own) };
  out.decor = {};
  const md = mem.decor || {}, dd = disk.decor || {};
  new Set(Object.keys(md).concat(Object.keys(dd))).forEach(k => { const m = md[k], d = dd[k] || {}; out.decor[k] = { own: union(m && m.own, d.own), on: (m && m.on) ? m.on : (d.on || []) }; });
  return out;
}
const charExtras = (m, d, b) => ({ spent: grow(m.spent, d.spent, b.spent), own: union(m.own, d.own), wear: m.wear ? m.wear : (d.wear || []) });
export function mergeState(mem, disk, base) {
  const me = mem.epoch || 0, de = disk.epoch || 0, be = base.epoch || 0;
  if (me !== be) return mem;
  if (de !== be) return disk;
  const out = Object.assign({}, disk);
  SETTINGS.forEach(k => { if (mem[k] !== undefined) out[k] = mem[k]; });
  out.worlds = {};
  WORLD_KEYS.forEach(k => {
    const m = (mem.worlds && mem.worlds[k]) || { pearls: 0 }, d = (disk.worlds && disk.worlds[k]) || { pearls: 0 }, b = (base.worlds && base.worlds[k]) || { pearls: 0 };
    out.worlds[k] = { pearls: Math.max(0, Math.max(d.pearls || 0, b.pearls || 0) + ((m.pearls || 0) - (b.pearls || 0))), wearLevel: (m.wearLevel !== undefined ? m.wearLevel : d.wearLevel) };
  });
  const mc = mem.chars || migrateChars(mem), dc = disk.chars || migrateChars(disk), bc = base.chars || migrateChars(base);
  out.chars = {};
  new Set(Object.keys(mc).concat(Object.keys(dc))).forEach(k => {
    const m = mc[k] || { pearls: 0 }, d = dc[k] || { pearls: 0 }, b = bc[k] || { pearls: 0 };
    out.chars[k] = Object.assign({ pearls: Math.max(0, Math.max(d.pearls || 0, b.pearls || 0) + ((m.pearls || 0) - (b.pearls || 0))), wearLevel: (m.wearLevel !== undefined ? m.wearLevel : (d.wearLevel === undefined ? null : d.wearLevel)) }, charExtras(m, d, b));
  });
  mergeStore(out, mem, disk, base);
  out.totalCorrect = Math.max(0, Math.max(disk.totalCorrect || 0, base.totalCorrect || 0) + ((mem.totalCorrect || 0) - (base.totalCorrect || 0)));
  out.bestStreak = Math.max(mem.bestStreak || 0, disk.bestStreak || 0);
  out.words = {};
  const mw = mem.words || {}, dw = disk.words || {}, bw = base.words || {};
  new Set(Object.keys(mw).concat(Object.keys(dw))).forEach(k => {
    const m = mw[k], d = dw[k], b = bw[k];
    if (!m) out.words[k] = d; else if (!d) out.words[k] = m;
    else if (JSON.stringify(m) === JSON.stringify(b)) out.words[k] = d; else if (JSON.stringify(d) === JSON.stringify(b)) out.words[k] = m;
    else out.words[k] = (m.seen || 0) >= (d.seen || 0) ? m : d;
  });
  return out;
}

/* rewards may only go down through a Reset, which bumps the epoch */
export function lowersProgress(next, prev) {
  if (!prev) return false;
  const ne = next.epoch || 0, pe = prev.epoch || 0;
  if (ne !== pe) return ne < pe;
  const pw = prev.worlds || {}, nw = next.worlds || {};
  if (Object.keys(pw).some(k => ((nw[k] && nw[k].pearls) || 0) < ((pw[k] && pw[k].pearls) || 0))) return true;
  const pc = prev.chars || migrateChars(prev), nc = next.chars || migrateChars(next);
  return Object.keys(pc).some(k => ((nc[k] && nc[k].pearls) || 0) < ((pc[k] && pc[k].pearls) || 0));
}
