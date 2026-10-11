import { renderLibraryTree } from '../ui/library-tree.js';
import { FASTENER_KINDS, hasNut, latestFasteners } from './library.js';

export function renderFastenerLibrary({ library, records, editingSpec, editSpec, renderLibrary }) {
  const query = library.querySelector('[data-search]').value;
  const normalize = (value) => value.toLocaleLowerCase('sv').replace(/\s/g, '');
  const nodes = FASTENER_KINDS.map(([kind, label]) => {
    const groups = new Map();
    for (const spec of latestFasteners(records).filter((record) => record.kind === kind)) {
      const series = spec.series || spec.standard || 'Egna skruvar';
      if (
        !normalize(
          `${label} ${series} ${spec.name} ${spec.diameter} ${spec.length} ${spec.manufacturer || ''} ${spec.article || ''}`,
        ).includes(normalize(query))
      )
        continue;
      if (!groups.has(series)) groups.set(series, []);
      groups.get(series).push({
        key: `${spec.id}:${spec.revision}`,
        label: `${spec.name} · Ø${spec.diameter} × ${spec.length}`,
        title: `${spec.name} · Ø${spec.diameter} × ${spec.length} mm · version ${spec.revision}`,
        value: spec,
      });
    }
    return {
      key: kind,
      label,
      children: [...groups].map(([series, children]) => ({
        key: `${kind}/${series}`,
        label: series,
        children,
      })),
    };
  }).filter((node) => node.children.length);
  renderLibraryTree(library.querySelector('[data-records]'), {
    nodes,
    query,
    selectedKey: `${editingSpec?.id}:${editingSpec?.revision}`,
    onSelect: (node) => {
      editSpec(node.value);
      renderLibrary();
    },
    empty: query
      ? 'Inga skruvar matchar sökningen.'
      : 'Biblioteket är tomt. Skapa en skruv eller importera ett bibliotek.',
  });
}
export function renderFastenerSpec(
  { editForm, library, syncHoleDefaults, libraryUI, syncNut },
  spec,
) {
  const values = {
    kind: spec?.kind || 'wood',
    standard: spec?.standard || '',
    grade: spec?.grade || '',
    series: spec?.series || '',
    manufacturer: spec?.manufacturer || '',
    article: spec?.article || '',
    coating: spec?.coating || '',
    threadLength: spec?.thread?.length ?? spec?.length ?? 100,
    threadPitch: spec?.thread?.pitch ?? 0,
    embedment: spec?.anchor?.embedment ?? 60,
    drillDiameter: spec?.anchor?.drillDiameter ?? spec?.diameter ?? 6,
    anchorDrillDepth: spec?.anchor?.drillDepth ?? 70,
    name: spec?.name || '',
    diameter: spec?.diameter || 6,
    length: spec?.length || 100,
    headKind: spec?.head?.kind || 'countersunk',
    headDiameter: spec?.head?.diameter || 12,
    headHeight: spec?.head?.height || 4,
    nutAcrossFlats: spec?.nut?.acrossFlats || 17,
    nutThickness: spec?.nut?.thickness || 8,
    washerInner: spec?.washer?.innerDiameter || (spec?.diameter || 10) + 1,
    washerOuter: spec?.washer?.outerDiameter || (spec?.diameter || 10) * 2.2,
    washerThickness: spec?.washer?.thickness || 2,
    defaultHoleExtent: spec?.holeDefaults?.extent === 'wall' ? 'wall' : 'profile',
    defaultHoleKind: spec?.holeDefaults?.kind || 'none',
    defaultHoleDiameter: spec?.holeDefaults?.diameter ?? spec?.diameter ?? 6,
    defaultHoleDepth: spec?.holeDefaults?.depth ?? 50,
    defaultCsDiameter: spec?.holeDefaults?.countersink?.diameter ?? spec?.head?.diameter ?? 12,
    defaultCsDepth: spec?.holeDefaults?.countersink?.depth ?? spec?.head?.height ?? 4,
  };
  for (const [name, value] of Object.entries(values))
    editForm.elements.namedItem(name).value = value;
  editForm.elements.hasWasher.checked = !!spec?.washer;
  editForm.elements.hasThread.checked = !!spec?.thread || spec?.kind === 'rod';
  editForm.elements.defaultHasCountersink.checked = !!spec?.holeDefaults?.countersink;
  library.querySelector('[data-library-holes]').open = false;
  syncHoleDefaults();
  library.querySelector('[data-edit-title]').textContent = spec ? spec.name : 'Ny skruv';
  if (libraryUI) {
    libraryUI.setEditing(!spec);
    libraryUI.use.disabled = !spec;
    library.querySelector('.ui-fastener-preview text').textContent = spec
      ? `Ø${spec.diameter} × ${spec.length} mm`
      : 'Ange skruvens mått';
  }
  library.querySelector('[data-version]').textContent = spec
    ? `Version ${spec.revision}`
    : 'Ej sparad';
  libraryUI.save.textContent = spec ? 'Spara ny version' : 'Spara skruv';
  library
    .querySelectorAll('[data-spec-id]')
    .forEach((entry) =>
      entry.setAttribute('aria-pressed', String(entry.dataset.specId === spec?.id)),
    );
  library.querySelector('[data-error]').textContent = '';
  syncNut();
}
export function syncFastenerHardwareFields({ editForm, library }) {
  const f = editForm.elements;
  const rod = f.kind.value === 'rod';
  f.namedItem('length').closest('label').firstChild.textContent = rod
    ? 'Längd'
    : 'Längd under huvud';
  if (f.kind.value !== 'bolt') f.standard.value = '';
  const full = rod || f.standard.value === 'ISO 4017';
  if (full || f.standard.value) f.hasThread.checked = true;
  f.hasThread.disabled = full || !!f.standard.value;
  f.threadLength.readOnly = full;
  if (full) f.threadLength.value = f.namedItem('length').value;
  library.querySelector('[data-thread-dimensions]').hidden = !f.hasThread.checked;
  for (const name of ['threadLength', 'threadPitch'])
    f.namedItem(name).disabled = !f.hasThread.checked;
  library.querySelector('[data-head]').hidden = rod;
  for (const name of ['headKind', 'headDiameter', 'headHeight']) f.namedItem(name).disabled = rod;
  library.querySelector('[data-anchor]').hidden = f.kind.value !== 'concrete';
  for (const name of ['embedment', 'drillDiameter', 'anchorDrillDepth'])
    f.namedItem(name).disabled = f.kind.value !== 'concrete';
  library.querySelector('[data-nut]').hidden = !hasNut({ kind: f.kind.value });
  for (const name of ['nutAcrossFlats', 'nutThickness'])
    f.namedItem(name).disabled = !hasNut({ kind: f.kind.value });
  const enabled = editForm.elements.hasWasher.checked;
  library.querySelector('[data-washer-dimensions]').hidden = !enabled;
  for (const name of ['washerInner', 'washerOuter', 'washerThickness'])
    editForm.elements.namedItem(name).disabled = !enabled;
}
export function syncFastenerHoleFields({ editForm, library }) {
  const f = editForm.elements;
  const enabled = f.defaultHoleKind.value !== 'none';
  for (const name of ['defaultHoleDiameter', 'defaultHoleDepth', 'defaultHasCountersink'])
    f.namedItem(name).disabled = !enabled;
  library.querySelector('[data-default-extent]').hidden = f.defaultHoleKind.value !== 'clearance';
  f.defaultHoleExtent.disabled = f.defaultHoleKind.value !== 'clearance';
  f.defaultHoleDepth.closest('label').hidden = f.defaultHoleKind.value === 'clearance';
  const countersink = enabled && f.defaultHasCountersink.checked;
  library.querySelector('[data-default-countersink]').hidden = !countersink;
  for (const name of ['defaultCsDiameter', 'defaultCsDepth'])
    f.namedItem(name).disabled = !countersink;
  library.querySelector('[data-hole-summary]').textContent = enabled
    ? `${f.defaultHoleKind.value === 'pilot' ? 'Förborrning' : 'Frigång'} · Ø${f.defaultHoleDiameter.value}${f.defaultHoleKind.value === 'pilot' ? ` × ${f.defaultHoleDepth.value}` : ''}`
    : 'Ingen borrning';
}
