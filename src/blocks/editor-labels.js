/** Screen-sized labels shared by the block editor's 2D and 3D previews. */
export function createBlockLabels(host, select) {
  const root = document.createElement('div');
  root.className = 'block-reference-labels';
  host.append(root);
  let labels = [],
    update = () => {};
  const observer = new ResizeObserver(() => update());
  observer.observe(host);
  return {
    render(entries) {
      root.replaceChildren();
      labels = entries.map(({ reference, position, active, text }) => {
        const node = document.createElement(reference ? 'button' : 'span');
        node.type = 'button';
        node.textContent = text || `${reference.name} · ${reference.value}`;
        node.title = reference
          ? `${['X', 'Y', 'Z'][reference.axis]} = ${reference.coordinate} mm`
          : text;
        node.classList.toggle('active', active);
        if (reference) node.onclick = () => select?.(reference.id);
        root.append(node);
        return { node, position, offset: reference ? [0, 18] : [0, -22] };
      });
    },
    project(project) {
      update = () => {
        const placed = [];
        for (const { node, position, offset } of labels) {
          const projected = project(position),
            point = projected?.map((v, i) => v + offset[i]);
          node.hidden = !point;
          if (point) {
            const width = node.offsetWidth,
              height = node.offsetHeight;
            const x = Math.max(width / 2 + 4, Math.min(host.clientWidth - width / 2 - 4, point[0]));
            let y = Math.max(
              height / 2 + 4,
              Math.min(host.clientHeight - height / 2 - 4, point[1]),
            );
            for (let attempt = 0; attempt < placed.length + 1; attempt++) {
              const collision = placed.find(
                (box) =>
                  Math.abs(x - box.x) < (width + box.width) / 2 + 4 &&
                  Math.abs(y - box.y) < (height + box.height) / 2 + 4,
              );
              if (!collision) break;
              y = collision.y + (height + collision.height) / 2 + 4;
            }
            placed.push({ x, y, width, height });
            node.style.left = `${x}px`;
            node.style.top = `${y}px`;
          }
        }
      };
      update();
    },
    dispose() {
      observer.disconnect();
      update = () => {};
      root.remove();
      labels = [];
    },
  };
}
