// Checks the diagnostic core with Node: graphs, question generators, simulated accuracy, CEFR and grouping.
// Run: node tests/check_engine.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.CORE = CORE;', ctx);
const CORE = ctx.CORE;
const bad = [];
const check = (ok, msg) => { if (!ok) bad.push(msg); };
const key = o => (typeof o === 'string' ? o : o && o.kk);

// ---- IELTS graph shape
const eng = CORE.SUBJ.eng;
check(!!eng, 'SUBJ.eng is missing');
if (eng) {
  check(eng.TOPICS.length === 47, `eng has ${eng.TOPICS.length} topics, expected 47`);
  check(JSON.stringify([...eng.grades]) === '[5,6,7,8,9]', `eng levels ${JSON.stringify([...eng.grades])}`);
}

// ---- every generator of every subject produces a sane multiple-choice question
for (const [sk, G] of Object.entries(CORE.SUBJ)) {
  for (const t of G.TOPICS) {
    const exprs = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      let q;
      try { q = t.gen(CORE.rng(seed)); } catch (e) { bad.push(`${sk}/${t.id} seed ${seed} throws ${e.message}`); break; }
      const keys = q.opts.map(key);
      if (q.opts.length !== 4 || new Set(keys).size !== 4) { bad.push(`${sk}/${t.id} seed ${seed}: options ${JSON.stringify(keys)}`); break; }
      if (!(q.a >= 0 && q.a < 4)) { bad.push(`${sk}/${t.id} seed ${seed}: answer index ${q.a}`); break; }
      if (!q.stem || !q.stem.kk || !q.stem.ru) { bad.push(`${sk}/${t.id}: stem needs kk and ru`); break; }
      exprs.add(JSON.stringify(q.expr));
    }
    if (sk === 'eng' && exprs.size < 3) bad.push(`eng/${t.id}: only ${exprs.size} distinct questions over 40 seeds`);
  }
}

// ---- simulated accuracy of the IELTS diagnostic
if (eng) {
  const ids = eng.TOPICS.map(t => t.id);
  let sum = 0; const N = 200;
  for (let i = 1; i <= N; i++) {
    const r = CORE.rng(1000 + i), roots = [];
    const k = 1 + Math.floor(r() * 2);
    while (roots.length < k) { const id = ids[Math.floor(r() * ids.length)]; if (!roots.includes(id)) roots.push(id); }
    const e = CORE.simulate(eng, roots, i, 0, 9), st = e.result().st, truth = CORE.truthFromRoots(eng, roots);
    sum += ids.filter(id => (st[id] === 'gap') === truth.has(id)).length / ids.length;
  }
  const acc = sum / N;
  console.log('eng simulated accuracy:', (100 * acc).toFixed(1) + '%');
  check(acc >= 0.85, `eng accuracy ${(100 * acc).toFixed(1)}% < 85%`);
}

// ---- CEFR estimate and grouping
if (typeof CORE.cefr !== 'function' || typeof CORE.groupStudents !== 'function') bad.push('cefr / groupStudents are not exported');
else {
  const res = roots => CORE.simulate(eng, roots, 1).result();
  const top = CORE.cefr(eng, res([]));
  check(top.label === 'C1' && top.band === '7–8', `no gaps → ${JSON.stringify(top)}, expected C1 / 7–8`);
  check(CORE.cefr(eng, res(['e1', 'e5'])).label === 'A0', `roots e1,e5 → ${CORE.cefr(eng, res(['e1', 'e5'])).label}, expected A0`);
  check(CORE.cefr(eng, res(['e2'])).label === 'A1', `root e2 → ${CORE.cefr(eng, res(['e2'])).label}, expected A1`);
  const math = CORE.SUBJ.math, mres = roots => CORE.simulate(math, roots, 1).result();
  const g = CORE.groupStudents(math, [{ name: 'A', res: mres([]) }, { name: 'B', res: mres(['n1']) }, { name: 'C', res: mres(['n1']) }]);
  check(JSON.stringify(g.map(x => x.key)) === '["low","high"]', `math groups ${JSON.stringify(g.map(x => x.key))}`);
  check(g[0] && g[0].n === 2 && g[0].topRoot === 'n1' && g[0].names.join() === 'B,C', `low group ${JSON.stringify(g[0])}`);
  const ge = CORE.groupStudents(eng, [{ name: 'X', res: res([]) }, { name: 'Y', res: res(['e2']) }]);
  check(JSON.stringify(ge.map(x => x.key)) === '["A1","C1"]', `eng groups ${JSON.stringify(ge.map(x => x.key))}`);
}

console.log('problems:', bad.length ? bad : 'none');
process.exit(bad.length ? 1 : 0);
