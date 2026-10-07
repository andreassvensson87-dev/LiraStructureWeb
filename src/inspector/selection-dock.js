import './selection-dock.css';
const icons = {
  all: 'M3 7l9-4 9 4-9 4ZM3 12l9 4 9-4M3 17l9 4 9-4',
  sweep: 'M4 3h16v4h-6v10h6v4H4v-4h6V7H4Z',
  plate: 'm3 14 13-9 5 3-13 9ZM3 14v3l5 4 13-10V8M8 17v4',
  fastener: 'm7 3 5-2 5 2v5l-5 2-5-2ZM10 10v11h4V10M10 13h4M10 16h4M10 19h4',
  helperpoint: 'M12 3v18M3 12h18M8 8h8v8H8Z',
  helperline: 'M3 21 21 3M3 17v4h4M17 3h4v4',
  component: 'M3 5h8v8H3ZM13 11h8v8h-8ZM7 13v6h6',
  polygoncut: 'M4 4h16v16H4ZM3 21 21 3',
  linecut: 'M3 18 21 6M3 13l4 8M17 3l4 8',
};
export function installSelectionDock(inspector) {
  const dock = document.createElement('div');
  dock.className = 'selection-type-dock';
  dock.hidden = true;
  dock.setAttribute('role', 'toolbar');
  dock.setAttribute('aria-label', 'Redigera markerad objekttyp');
  document.querySelector('.workspace').append(dock);
  let signature;
  return {
    sync() {
      const state = inspector.rawState(),
        groups = inspector.scope.groups(state.selected);
      dock.hidden =
        inspector.tab !== 'properties' || state.selected.length < 2 || !!state.operation;
      const key = JSON.stringify([groups, inspector.scope.type]);
      if (signature === key) return;
      signature = key;
      dock.replaceChildren();
      const choices =
        groups.length > 1
          ? [{ id: '', label: 'Alla', count: state.selected.length }, ...groups]
          : groups;
      for (const group of choices) {
        const button = document.createElement('button');
        button.type = 'button';
        const label = `${group.label} · ${group.count}`;
        button.setAttribute('aria-label', label);
        button.dataset.tooltip = label;
        button.setAttribute(
          'aria-pressed',
          String(group.id === (inspector.scope.type || (groups.length === 1 ? groups[0].id : ''))),
        );
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[group.id || 'all'] || icons.all}"/></svg>`;
        button.onclick = () => inspector.chooseScope(group.id);
        dock.append(button);
      }
    },
  };
}
