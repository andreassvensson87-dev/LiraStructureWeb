/** Allocate within a prefix without depending on the object type registry. */
export function nextNumber(prefix, objects) {
  let number = 1;
  const used = new Set(objects.filter((o) => o.prefix === prefix).map((o) => o.number));
  while (used.has(number)) number++;
  return { prefix, number };
}
