import { dxfUnits, parseFrameDXF, frameFromDXF } from './frame-dxf.js';

export function showFrameDXFImport(editor) {
  const dialog = document.createElement('dialog');
  dialog.className = 'fe-file-dialog fe-dxf-dialog';
  dialog.setAttribute('aria-label', 'Importera DXF');
  dialog.innerHTML = `<header><strong>Importera DXF</strong><button type="button" aria-label="Stäng DXF-import">×</button></header><form><label>Fil<input name="file" type="file" accept=".dxf" required></label><label>Namn<input name="name" required maxlength="120"></label><label>Enhet<select name="unit"></select></label><label>Skala<input name="scale" type="number" value="1" min="0.000001" step="any" required></label><label>Insättningspunkt X<input name="x" type="number" value="0" step="any" required></label><label>Insättningspunkt Y<input name="y" type="number" value="0" step="any" required></label><p role="status"></p><footer><button type="button" data-cancel>Avbryt</button><button type="submit" disabled>Importera</button></footer></form>`;
  const form = dialog.querySelector('form'),
    fields = form.elements,
    message = dialog.querySelector('[role=status]'),
    submit = dialog.querySelector('[type=submit]');
  fields.unit.replaceChildren(...dxfUnits.map((u) => new Option(u.name, String(u.factor))));
  fields.unit.value = '1';
  let doc = null,
    request = 0;
  fields.file.onchange = async () => {
    const current = ++request,
      file = fields.file.files[0];
    doc = null;
    submit.disabled = true;
    message.textContent = '';
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw Error('DXF-filen får vara högst 10 MB.');
      const bytes = await file.arrayBuffer();
      let source;
      try {
        source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        source = new TextDecoder('windows-1252').decode(bytes);
      }
      const parsed = parseFrameDXF(source);
      if (current !== request || !dialog.isConnected) return;
      doc = parsed;
      fields.name.value = file.name.replace(/\.dxf$/i, '');
      const detected = dxfUnits.find((u) => u.code === doc.header?.$INSUNITS);
      fields.unit.value = String(detected?.factor || 1);
      fields.x.value = doc.header?.$INSBASE?.x || 0;
      fields.y.value = doc.header?.$INSBASE?.y || 0;
      message.textContent = detected ? '' : 'Enhet saknas i filen · välj enhet.';
      submit.disabled = false;
    } catch (error) {
      if (current === request) message.textContent = error.message;
    }
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!doc) return;
    try {
      const result = frameFromDXF(doc, {
        name: fields.name.value.trim(),
        factor: +fields.unit.value,
        scale: +fields.scale.value,
        origin: [+fields.x.value, +fields.y.value],
      });
      if (!editor.canDiscard()) return;
      editor.frame = result.frame;
      editor.loaded();
      editor.dirty = true;
      editor.sync();
      editor.status(
        `${result.frame.entities.length} objekt importerade${result.skipped.length ? ' · Utelämnat: ' + result.skipped.join(', ') : ''}`,
      );
      dialog.close();
    } catch (error) {
      message.textContent = error.message;
    }
  };
  dialog.querySelector('header button').onclick = dialog.querySelector('[data-cancel]').onclick =
    () => dialog.close();
  dialog.addEventListener('keydown', (e) => e.stopPropagation());
  dialog.addEventListener('cancel', (e) => e.stopPropagation());
  dialog.addEventListener('close', () => {
    request++;
    dialog.remove();
  });
  editor.dialog.append(dialog);
  dialog.showModal();
}
