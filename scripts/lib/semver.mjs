export function parseSemver(input) {
  const m = String(input ?? '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), raw: m[0] };
}

export function compareSemver(a, b) {
  const aa = typeof a === 'string' ? parseSemver(a) : a;
  const bb = typeof b === 'string' ? parseSemver(b) : b;
  if (!aa || !bb) return null;
  for (const k of ['major', 'minor', 'patch']) {
    if (aa[k] !== bb[k]) return aa[k] > bb[k] ? 1 : -1;
  }
  return 0;
}
