/* merge and safety rules for saves, shared by the Worker and the test stand-in (test/mockcloud.js) */
/* the game's own merge (index.html mergeState): the save was made from base, the service now holds cur;
   keep both sets of changes. A newer epoch (Reset) wins outright. */
const WORLD_KEYS = ['lagoon', 'candy', 'canopy', 'ocean', 'bows', 'boba'];
const CHAR_KEY = { lagoon: 'charLagoon', candy: 'charCandy', canopy: 'charCanopy', ocean: 'charOcean', bows: 'charBows', boba: 'charBoba' };
const FIRST_CHAR = { lagoon: 'axolotl', candy: 'bear', canopy: 'sloth', ocean: 'jellyfish', bows: 'bow', boba: 'milktea' };
const SETTINGS = ['kid', 'grade', 'gradePicked', 'charLagoon', 'charCandy', 'charCanopy', 'charOcean', 'charBows', 'charBoba', 'look', 'theme', 'sound', 'roundLen', 'restoredId', '_sid'];
const clone = o => JSON.parse(JSON.stringify(o));

/* each character keeps its own rewards in worlds[k].chars[id]. A save from before that gives the world's
   rewards to the character picked there (index.html migrateWorld does the same). */
export function migrate(st) {
  if (!st || !st.worlds) return st;
  WORLD_KEYS.forEach(k => {
    const w = st.worlds[k];
    if (!w || w.chars) return;
    const id = st[CHAR_KEY[k]] || FIRST_CHAR[k];
    w.chars = {};
    if ((w.pearls || 0) > 0 || w.wearLevel != null) w.chars[id] = { pearls: w.pearls || 0, wearLevel: w.wearLevel === undefined ? null : w.wearLevel };
    delete w.wearLevel;
  });
  return st;
}

const add = (m, d, b) => Math.max(0, Math.max(d || 0, b || 0) + ((m || 0) - (b || 0)));
export function mergeState(mem, disk, base) {
  mem = migrate(clone(mem)); disk = migrate(clone(disk)); base = migrate(clone(base));
  const me = mem.epoch || 0, de = disk.epoch || 0, be = base.epoch || 0;
  if (me !== be) return mem;
  if (de !== be) return disk;
  const out = Object.assign({}, disk);
  SETTINGS.forEach(k => { if (mem[k] !== undefined) out[k] = mem[k]; });
  out.worlds = {};
  WORLD_KEYS.forEach(k => {
    const blank = { pearls: 0, chars: {} };
    const m = (mem.worlds && mem.worlds[k]) || blank, d = (disk.worlds && disk.worlds[k]) || blank, b = (base.worlds && base.worlds[k]) || blank;
    const w = out.worlds[k] = { pearls: add(m.pearls, d.pearls, b.pearls), chars: {} };
    new Set(Object.keys(m.chars || {}).concat(Object.keys(d.chars || {}))).forEach(id => {
      const mc = (m.chars || {})[id] || {}, dc = (d.chars || {})[id] || {}, bc = (b.chars || {})[id] || {};
      w.chars[id] = { pearls: add(mc.pearls, dc.pearls, bc.pearls), wearLevel: mc.wearLevel !== undefined ? mc.wearLevel : (dc.wearLevel === undefined ? null : dc.wearLevel) };
    });
  });
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

/* rewards may only go down through a Reset, which bumps the epoch: a world's total, and each character's own */
export function lowersProgress(next, prev) {
  if (!prev) return false;
  const ne = next.epoch || 0, pe = prev.epoch || 0;
  if (ne !== pe) return ne < pe;
  const pw = prev.worlds || {}, nw = migrate(clone(next)).worlds || {};
  return Object.keys(pw).some(k => {
    const p = pw[k] || {}, n = nw[k] || {};
    if ((n.pearls || 0) < (p.pearls || 0)) return true;
    return Object.keys(p.chars || {}).some(id => ((n.chars && n.chars[id] && n.chars[id].pearls) || 0) < (p.chars[id].pearls || 0));
  });
}
