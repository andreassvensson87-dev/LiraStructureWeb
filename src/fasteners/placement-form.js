import { adoptAttributeLabel } from '../inspector/attributes.js';
import { commandIcon } from '../ui/icons.js';
const numeric = (name, label, value, min = 0) =>
  `<label class="field">${label}<input name="${name}" type="number" step="any" min="${min}" value="${value}" required></label>`;
/** Shared controls for creation and modification; callbacks and model state stay in the controller. */
export function createFastenerPlacementForm() {
  const form = document.createElement('form');
  form.className = 'fastener-editor';
  form.dataset.placement = '';
  form.innerHTML = `
      <div data-product-picker></div><select name="spec" aria-label="Bibliotekspost" hidden></select>
      <fieldset class="fastener-assembly-section"><legend>Förband</legend><label class="field">Utförande<select name="assemblyMode"><option value="preset">Bild</option><option value="manual">Egna lägen</option></select></label><div data-assembly-picker></div></fieldset>
<fieldset data-length-section><legend>Längd</legend><div class="fastener-length-options attribute-columns"><label class="field">Längd<input name="manualLength" type="number" min="0.001" max="10000" step="any" required></label><label class="field" data-start-allowance hidden>Utstick före<input name="startAllowance" type="number" min="0" max="10000000" step="any" value="20"></label></div><output data-length-result class="fastener-length-result" aria-live="polite"></output></fieldset>
      <details data-connections class="fastener-connections" open><summary>Hål <span data-hole-overview></span></summary><div class="fastener-connections-heading"><h3>Delar <span data-hole-count></span></h3><button type="button" data-select-targets>Välj delar…</button></div><p data-target-empty hidden></p><div data-hole-settings></div><div data-holes></div><details data-hole-tools><summary>Avancerat · referensdel och hålstandard</summary><label class="field">Referensdel<select name="anchor"><option value="">Fristående</option></select></label><button type="button" data-apply-hole-defaults>Hämta hålstandard från bibliotek</button></details></details>
      <p data-layer-info hidden></p>
      <details data-search-settings><summary>Sökområde</summary><label class="fastener-check"><input type="checkbox" name="limitLayers">Begränsa söklängden</label><label class="field" data-drill-depth>Söklängd från första materialytan · mm<input name="drillDepth" type="number" min="0.001" step="any" value="100"></label></details><details data-position><summary>Placering</summary><fieldset><legend data-entry-label>Origo</legend><div class="coordinates">${['X', 'Y', 'Z'].map((a, i) => numeric(`start${i}`, a, 0, -1e7)).join('')}</div></fieldset><fieldset><legend data-exit-label>X-riktning</legend><div class="coordinates">${['X', 'Y', 'Z'].map((a, i) => numeric(`direction${i}`, a, i === 2 ? -100 : 0, -1e7)).join('')}</div></fieldset></details>
      <details data-manual-hardware><summary>Avancerat</summary><label class="field" data-nut-offset hidden>Mutterläge · mm från under huvud<input name="nutOffset" type="number" step="any" min="0"></label>
      <fieldset data-washers><legend>Brickor</legend><div class="fastener-washer-options"><label class="fastener-check"><input type="checkbox" name="washerHead">Under huvud</label><label class="fastener-check" data-washer-nut><input type="checkbox" name="washerNut">Vid mutter</label></div><p data-washer-info class="inspector-note"></p></fieldset>

      <fieldset data-accessory-editor><legend>Muttrar och brickor</legend><label class="fastener-check"><input type="checkbox" name="customAccessories">Placera muttrar och brickor längs axeln</label><div data-accessories hidden><div data-accessory-rows></div><div class="fastener-accessory-actions"><button type="button" data-add-nut>+ Mutter</button><button type="button" data-add-washer>+ Bricka</button></div></div></fieldset>
      </details><p data-error role="alert"></p><div class="fastener-actions"><button type="submit" class="primary">Skapa</button><button type="button" data-cancel>Avbryt</button><button type="button" data-delete class="danger">Ta bort skruv</button></div>`;
  const advanced = form.querySelector('[data-manual-hardware]');
  const mode = form.querySelector('[name=assemblyMode]').parentElement;
  advanced.dataset.advanced = '';
  delete advanced.dataset.manualHardware;
  const manual = document.createElement('div');
  manual.dataset.manualHardware = '';
  for (const child of [...advanced.children].slice(1)) manual.append(child);
  advanced.append(
    mode,
    manual,
    form.querySelector('[data-hole-tools]'),
    form.querySelector('[data-search-settings]'),
    form.querySelector('[data-delete]'),
  );
  form.querySelector('.fastener-actions').prepend(form.querySelector('[data-cancel]'));
  const lengthSection = form.querySelector('[data-length-section]');
  lengthSection.querySelector('legend').remove();
  form.querySelector('[data-connections]').open = false;
  form.querySelector('[data-hole-tools] > summary').textContent = 'Referensdel och hålstandard';
  form.querySelector('.fastener-assembly-section').before(lengthSection);
  const position = form.querySelector('[data-position]');
  const points = document.createElement('details');
  points.innerHTML = '<summary>Punkter</summary>';
  for (const fieldset of [...position.querySelectorAll('fieldset')]) points.append(fieldset);
  const placementFields = document.createElement('div');
  placementFields.className = 'attribute-columns fastener-position-fields';
  placementFields.innerHTML =
    numeric('layoutRotation', 'Skruvvinkel', 0, -36000) +
    ['X', 'Y', 'Z']
      .map((axis, i) => numeric(`layoutOffset${i}`, `Förskjutning ${axis}`, 0, -1e7))
      .join('');
  position.append(placementFields, points);

  form.querySelector('.fastener-length-options').classList.add('attribute-columns');
  form.querySelector('.fastener-length-options').classList.remove('dimensions');
  const reverse = document.createElement('button');
  reverse.type = 'button';
  reverse.dataset.reverse = '';
  reverse.title = 'Vänd skruvriktning';
  reverse.setAttribute('aria-label', reverse.title);
  reverse.append(commandIcon('rotate'), 'Vänd');
  placementFields.prepend(reverse);
  form.querySelectorAll('label.field').forEach(adoptAttributeLabel);
  form.querySelectorAll('details').forEach((node) => node.classList.add('attribute-section'));
  form.querySelectorAll('fieldset').forEach((node) => node.classList.add('attribute-group'));
  return form;
}
