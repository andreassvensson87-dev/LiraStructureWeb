/** Replace changed meshes without detaching the rest of the model from its scene. */
export function reconcileChildren(group, children) {
  const retained = new Set(children);
  for (const child of [...group.children]) {
    if (!retained.has(child)) group.remove(child);
  }
  for (const child of children) {
    if (child.parent !== group) group.add(child);
  }
  // Keep the model's order, including replacements inserted between retained
  // objects. Parent links and Three's add/remove events are handled above.
  group.children = children.slice();
}
