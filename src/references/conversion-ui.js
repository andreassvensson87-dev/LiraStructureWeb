import { planReferenceConversion, conversionObjects } from './conversion.js';
const node = (tag, text) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
};
export function installReferenceConversion({ getObjects, commit }) {
  const dialog = node('dialog');
  dialog.className = 'reference-conversion';
  dialog.setAttribute('aria-labelledby', 'reference-conversion-title');
  dialog.innerHTML = `<header><h2 id="reference-conversion-title">Konvertera markerat IFC-objekt</h2><button type="button" data-close aria-label="Stäng konvertering">×</button></header>
    <p data-summary></p><p>Raka extrusioner blir redigerbara Sweep eller Plate. Profilkonturen följer IFC-geometrin. Material och kapningar överförs inte; kontrollera material efter konvertering. Referensmodellen behålls.</p>
    <div class="reference-conversion-scroll"><table><thead><tr><th><input type="checkbox" data-all aria-label="Välj alla konverterbara objekt"></th><th>Objekt</th><th>Typ</th><th>Resultat</th></tr></thead><tbody></tbody></table></div>
    <p data-error role="alert"></p><footer><span data-count></span><div><button type="button" data-close>Avbryt</button><button type="button" data-convert class="primary">Konvertera valda</button></div></footer>`;
  const $ = (selector) => dialog.querySelector(selector);
  const selected = new Set();
  let rows = [];
  const update = () => {
    $('[data-count]').textContent = `${selected.size} objekt valda · Kan ångras`;
    $('[data-convert]').disabled = selected.size === 0;
    const ready = rows.filter((row) => row.object).length;
    $('[data-all]').checked = ready > 0 && selected.size === ready;
    $('[data-all]').indeterminate = selected.size > 0 && selected.size < ready;
    $('[data-all]').disabled = !ready;
  };
  $('[data-all]').onchange = () => {
    selected.clear();
    for (const input of dialog.querySelectorAll('[data-row]')) {
      input.checked = $('[data-all]').checked;
      if (input.checked) selected.add(Number(input.dataset.row));
    }
    update();
  };
  for (const button of dialog.querySelectorAll('[data-close]'))
    button.onclick = () => dialog.close();
  $('[data-convert]').onclick = () => {
    try {
      const added = conversionObjects(
        rows.filter((_, i) => selected.has(i)),
        getObjects(),
      );
      if (added.length) commit(added);
      dialog.close();
    } catch (error) {
      $('[data-error]').textContent = error.message;
    }
  };
  dialog.onkeydown = (event) => event.stopPropagation();
  document.body.append(dialog);
  return (model, selectedIds) => {
    rows = planReferenceConversion(model, getObjects(), selectedIds || []);
    selected.clear();
    $('[data-error]').textContent = '';
    const body = $('tbody'),
      fragment = document.createDocumentFragment();
    body.replaceChildren();
    rows.forEach((row, i) => {
      const tr = node('tr'),
        cell = node('td');
      if (row.object) {
        const input = node('input');
        input.type = 'checkbox';
        input.dataset.row = i;
        input.checked = true;
        selected.add(i);
        input.setAttribute('aria-label', `Konvertera ${row.name} · IFC #${row.id}`);
        input.onchange = () => {
          if (input.checked) selected.add(i);
          else selected.delete(i);
          update();
        };
        cell.append(input);
      }
      tr.append(
        cell,
        node('td', `${row.name} · #${row.id}`),
        node(
          'td',
          row.object?.type === 'plate'
            ? 'Plate'
            : row.object
              ? `Sweep${row.object.section?.family === 'HEA' ? ' · ' + row.object.section.name : ''}`
              : '—',
        ),
        node('td', row.reason || 'Klar'),
      );
      if (!row.object) tr.className = 'reference-conversion-skipped';
      fragment.append(tr);
    });
    body.append(fragment);
    $('[data-summary]').textContent =
      `${model.title} · ${selected.size} kan konverteras · ${rows.length - selected.size} hoppas över`;
    update();
    dialog.showModal();
  };
}
