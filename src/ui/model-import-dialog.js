import { installManagementDialog } from './dialog-presentation.js';
import { installFloatingWindow } from './floating-window.js';
import { createRibbon } from './ribbon.js';
import { createLibraryTreePicker } from './library-tree-picker.js';
import { SearchPicker } from '../search-picker.js';

/** Presentation only; the import controller owns files, choices and transactions. */
export function createModelImportDialog({
  choose,
  packet,
  fit,
  change,
  select,
  commit,
  profiles,
  profileSelection,
  setProfile,
  setMaterial,
}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'model-import-dialog';
  dialog.setAttribute('aria-labelledby', 'model-import-title');
  dialog.innerHTML = `<header><h2 id="model-import-title">Importera AI-modell</h2><button type="button" data-close aria-label="Stäng modellimport">×</button></header>
    <nav data-toolbar class="ui-management-toolbar" aria-label="Importverktyg"><button type="button" data-file>Välj fil…</button><button type="button" data-fit>Visa modell</button><button type="button" data-packet>AI-paket</button></nav>
    <section class="model-import-content"><div data-main><p data-source class="inspector-note">Välj eller släpp filen från ChatGPT i modellvyn.</p><p data-summary class="inspector-note"></p>
    <div class="model-import-table"><table><thead><tr><th><input type="checkbox" data-all aria-label="Välj alla giltiga objekt"></th><th>Objekt</th><th>Profil</th><th>Status</th></tr></thead><tbody data-rows></tbody></table></div>
    <details data-details><summary>Detaljer och antaganden</summary><label class="model-import-options"><input type="checkbox" data-ghost checked> Visa bortvalda i modellen</label>
    <section data-detail hidden><h3 data-name></h3><p data-geometry class="inspector-note"></p><p data-origin class="inspector-note"></p><div data-profile></div><div data-material></div><p data-row-error role="alert"></p><ul data-assumptions></ul></section><p data-detail-hint class="inspector-note">Välj ett objekt i listan eller modellen för att visa dess detaljer.</p></details></div>
    <section data-review hidden><h3 data-review-title tabindex="-1">Importera med antaganden</h3><p class="inspector-note">Följande antaganden följer med de valda objekten. Importera tillsammans eller gå tillbaka och ändra urvalet.</p><div data-review-items></div></section>
    <p data-error role="alert"></p></section><footer><span data-status role="status">Ingen fil inläst</span><button type="button" data-back hidden>Tillbaka</button><button type="button" data-close>Avbryt</button><button type="button" data-import class="primary" disabled>Importera valda</button></footer>`;
  document.body.append(dialog);
  const $ = (s) => dialog.querySelector(`[data-${s}]`);
  createRibbon($('toolbar'), [
    {
      label: 'AI-modell',
      items: ['file', 'fit', 'packet'].map((key) => ({
        node: $(key),
        icon: key === 'fit' ? 'fit' : key === 'file' ? 'folder' : 'page',
      })),
    },
  ]);
  installManagementDialog(dialog);
  const window = installFloatingWindow(dialog);
  const profile = createLibraryTreePicker({
    label: 'Vald profil',
    placeholder: 'Välj profil',
    searchLabel: 'Sök importprofil',
    searchPlaceholder: 'Sök profil…',
    emptyLabel: 'Inga profiler',
    icon: 'profile',
    getNodes: profiles,
    getSelection: profileSelection,
    onSelect: (node) => setProfile(node.value),
  });
  $('profile').append(profile.root);
  const material = new SearchPicker($('material'), {
    label: 'Valt material',
    placeholder: 'Välj material…',
    onSelect: setMaterial,
  });
  material.input.id = 'model-import-material';
  const materialLabel = document.createElement('label');
  materialLabel.htmlFor = material.input.id;
  materialLabel.className = 'attribute-caption';
  materialLabel.textContent = 'Valt material';
  $('material').before(materialLabel);
  $('file').onclick = choose;
  $('packet').onclick = packet;
  $('fit').onclick = fit;
  $('import').onclick = commit;
  $('all').onchange = () => change(null, $('all').checked);
  $('ghost').onchange = () => change('ghost', $('ghost').checked);
  for (const button of dialog.querySelectorAll('[data-close]'))
    button.onclick = () => dialog.close();
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('close', () => {
    profile.close();
    material.close();
  });
  function rows(items, selected, included, issues = new Map()) {
    const focused = $('rows').contains(document.activeElement)
      ? document.activeElement.dataset.rowFocus
      : null;
    const fragment = document.createDocumentFragment();
    for (const row of items) {
      const tr = document.createElement('tr');
      tr.classList.toggle('is-selected', row.id === selected);
      const cell = () => {
        const td = document.createElement('td');
        tr.append(td);
        return td;
      };
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.rowFocus = `${row.id}:include`;
      input.checked = included.has(row.id);
      input.disabled = !!row.error;
      input.setAttribute('aria-label', `Importera ${row.input.name || row.id}`);
      input.onchange = () => change(row.id, input.checked);
      cell().append(input);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.rowFocus = `${row.id}:select`;
      button.textContent = row.input.name || row.id;
      button.onclick = () => {
        select(row.id);
        $('details').open = true;
      };
      cell().append(button);
      cell().textContent =
        row.object?.section?.name ||
        (row.input.type === 'plate'
          ? `${row.input.thickness} mm`
          : row.input.type === 'fit'
            ? `Fit · ${row.input.mode === 'abut' ? 'mot del' : 'gering'}`
            : row.input.type === 'linecut'
              ? 'Linjeskärning'
              : row.input.type === 'polygoncut'
                ? 'Urklinkning'
                : row.input.profile || row.input.type);
      cell().textContent =
        row.error ||
        issues.get(row.id) ||
        (row.assumptions.length
          ? `${row.assumptions.length} ${row.assumptions.length === 1 ? 'antagande' : 'antaganden'}`
          : 'Klar');
      fragment.append(tr);
    }
    $('rows').replaceChildren(fragment);
    if (focused)
      [...$('rows').querySelectorAll('[data-row-focus]')]
        .find((node) => node.dataset.rowFocus === focused)
        ?.focus({ preventScroll: true });
    const counts = new Map();
    for (const row of items) {
      const label =
        row.input.type === 'fit'
          ? 'Fit'
          : ['linecut', 'polygoncut'].includes(row.input.type)
            ? 'skärning'
            : row.input.type === 'plate'
              ? 'plåt'
              : row.input.ifcClass === 'IfcColumn'
                ? 'pelare'
                : row.input.ifcClass === 'IfcBeam' || !row.input.ifcClass
                  ? 'balk'
                  : 'profildel';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    $('summary').textContent = items.length
      ? `${items.length} objekt · ${[...counts].map(([label, count]) => `${count} ${count > 1 && label === 'skärning' ? 'skärningar' : count > 1 && label === 'plåt' ? 'plåtar' : count > 1 && label === 'balk' ? 'balkar' : count > 1 && label === 'profildel' ? 'profildelar' : label}`).join(' · ')}`
      : '';
    const eligible = items.filter((r) => !r.error);
    $('all').disabled = !eligible.length;
    $('all').checked = eligible.length > 0 && eligible.every((r) => included.has(r.id));
    $('all').indeterminate = eligible.some((r) => included.has(r.id)) && !$('all').checked;
  }
  function detail(row, materials) {
    $('detail').hidden = !row;
    $('detail-hint').hidden = !!row;
    if (!row) return;
    $('name').textContent = row.input.name || row.id;
    const object = row.object;
    $('geometry').textContent =
      object?.type === 'sweep'
        ? `Längd ${Math.hypot(...object.end.map((v, i) => v - object.start[i])).toLocaleString('sv')} mm · Rotation ${object.rotation}°`
        : row.input.type === 'fit'
          ? `${row.input.mode === 'abut' ? 'Mot del' : 'Gering'} · ${row.input.references.join(' → ')} · Spalt ${row.input.gap} mm`
          : ['polygoncut', 'linecut'].includes(row.input.type)
            ? `Mål: ${row.input.targets.join(', ')}${object?.thickness ? ` · Djup ${object.thickness} mm` : ''}`
            : object
              ? `Tjocklek ${object.thickness} mm · ${object.polygon.length} hörn`
              : '';
    const source = row.input.source;
    $('origin').textContent =
      source && typeof source.file === 'string'
        ? `Källa: ${source.file}${source.page ? ` · sida ${source.page}` : ''}${source.detail ? ` · ${source.detail}` : ''}`
        : '';
    $('profile').hidden = row.input.type !== 'sweep';
    profile.sync();
    const physical = ['sweep', 'plate'].includes(row.input.type);
    $('material').hidden = !physical;
    materialLabel.hidden = !physical;
    if (physical) material.set(materials, object?.material?.name || row.input.material);
    $('row-error').textContent = row.error;
    $('assumptions').replaceChildren(
      ...row.assumptions.map((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }),
    );
  }
  function review(items) {
    $('main').hidden = !!items;
    $('toolbar').hidden = !!items;
    $('review').hidden = !items;
    $('back').hidden = !items;
    $('review-items').replaceChildren();
    if (!items) return;
    for (const row of items) {
      const heading = document.createElement('h4');
      heading.textContent = row.input.name || row.id;
      const list = document.createElement('ul');
      for (const text of row.assumptions) {
        const item = document.createElement('li');
        item.textContent = text;
        list.append(item);
      }
      $('review-items').append(heading, list);
    }
    $('review-title').focus();
  }
  return { dialog, $, open: () => window.open(), rows, detail, review };
}
