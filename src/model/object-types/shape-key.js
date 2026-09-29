export const clean = (n) => Math.round(n * 1000) / 1000;
export function loopKey(points) {
  const p = points.map((p) => p.map(clean)),
    variants = [];
  for (const list of [p, [...p].reverse()])
    for (let i = 0; i < list.length; i++)
      variants.push(JSON.stringify([...list.slice(i), ...list.slice(0, i)]));
  return variants.sort()[0];
}
