/* merge and safety rules for saves, shared by the Worker and the test stand-in (test/mockcloud.js) */
/* the game's own merge (index.html mergeState): the save was made from base, the service now holds cur;
   keep both sets of changes. A newer epoch (Reset) wins outright. */
const WORLD_KEYS = ['lagoon', 'candy', 'canopy', 'ocean', 'bows'];
const SETTINGS = ['kid', 'grade', 'gradePicked', 'charLagoon', 'charCandy', 'charCanopy', 'charOcean', 'charBows', 'look', 'theme', 'sound', 'roundLen', 'restoredId', '_sid'];
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
  return Object.keys(pw).some(k => ((nw[k] && nw[k].pearls) || 0) < ((pw[k] && pw[k].pearls) || 0));
}
