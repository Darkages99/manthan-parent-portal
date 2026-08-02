// Deterministic PRNG (mulberry32) so re-running the generator without a DB
// reset produces the exact same in-memory dataset — the DB write itself is
// the only non-idempotent step (guarded by the "already seeded" check in
// seed.mjs).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed = 20260729) {
  const rand = mulberry32(seed);
  return {
    float: () => rand(),
    int(min, max) {
      return min + Math.floor(rand() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(rand() * arr.length)];
    },
    chance(p) {
      return rand() < p;
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    sample(arr, n) {
      return this.shuffle(arr).slice(0, n);
    },
  };
}
