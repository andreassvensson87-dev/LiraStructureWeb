import { createIFCExportDialog } from '../ui/ifc-export-dialog.js';
import { defaultIFCOptions } from '../ifc/export-plan.js';
import { activeBasePoint } from '../coordinates/coordinates.js';
/** Export owns a detached snapshot and worker; neither checking nor download edits the model. */
export function createIFCExportController({ getProject, getSelection, getVisible, finishEditing }) {
  const { dialog, form, $, report } = createIFCExportDialog();
  let worker = null,
    version = 0,
    result = null,
    url = null;
  const revoke = () => {
    if (url) URL.revokeObjectURL(url);
    url = null;
    $('[data-download]').replaceChildren();
  };
  function cancel() {
    version++;
    worker?.terminate();
    worker = null;
    result = null;
    revoke();
  }
  function busy(value) {
    $('[data-progress]').hidden = !value;
    $('[data-check]').disabled = value;
    $('[data-export]').disabled = value;
    for (const input of form.querySelectorAll('input,select'))
      input.disabled = value || input.getAttribute('aria-label') === 'IFC-format';
  }
  function download() {
    if (!result?.file) return;
    revoke();
    url = URL.createObjectURL(new Blob([result.file], { type: 'application/x-step' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.textContent = `Hämta ${result.filename}`;
    $('[data-download]').append(link);
    link.click();
  }
  function options() {
    const scope = $('[data-scope]').value;
    return {
      ...defaultIFCOptions(),
      scope,
      ids: scope === 'selected' ? [...getSelection()] : scope === 'visible' ? getVisible() : [],
      coordinates: $('[data-coordinates]').value,
      geometry: $('[data-geometry]').value,
      ...Object.fromEntries(
        ['materials', 'properties', 'assemblies', 'fasteners'].map((k) => [
          k,
          $(`[data-${k}]`).checked,
        ]),
      ),
      filename: filename(),
    };
  }
  function filename() {
    const value = $('[data-filename]')
      .value.trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
    if (!value) throw Error('Ange ett filnamn.');
    return /\.ifc$/i.test(value) ? value : value + '.ifc';
  }
  function run(exportAfter = false) {
    cancel();
    const token = version;
    $('[data-error]').textContent = '';
    $('[data-summary]').textContent = 'Kontrollerar slutgeometri…';
    $('[data-issues]').replaceChildren();
    let source, settings;
    try {
      finishEditing();
      const p = getProject();
      settings = options();
      source = {
        id: p.id,
        info: p.info,
        objects: p.objects,
        parts: p.parts,
        assemblies: p.assemblies,
        assemblyNumbering: p.assemblyNumbering,
        coordinates: p.coordinates,
      };
      worker = new Worker(new URL('../ifc/export.worker.js', import.meta.url), { type: 'module' });
      busy(true);
      worker.onmessage = ({ data }) => {
        if (token !== version) return;
        if (data.type === 'progress') {
          $('[data-summary]').textContent =
            `${data.stage === 'geometry' ? 'Kontrollerar' : 'Skriver IFC'} · ${data.current + 1}/${data.total}`;
          $('[data-progress]').max = data.total;
          $('[data-progress]').value = data.current + 1;
          return;
        }
        worker.terminate();
        worker = null;
        busy(false);
        if (data.type === 'error') {
          $('[data-error]').textContent = data.message;
          $('[data-summary]').textContent = 'Exporten kunde inte slutföras.';
          return;
        }
        result = { ...data, filename: settings.filename };
        report(data.report);
        if (exportAfter) download();
      };
      worker.onerror = () => {
        if (token === version) {
          worker?.terminate();
          worker = null;
          busy(false);
          $('[data-error]').textContent = 'IFC-exporten kunde inte starta eller slutföras.';
        }
      };
      worker.postMessage({ project: source, options: settings });
    } catch (error) {
      worker?.terminate();
      worker = null;
      busy(false);
      $('[data-error]').textContent = error.message;
    }
  }
  for (const tab of dialog.querySelectorAll('[data-tab]'))
    tab.onclick = () => {
      for (const button of dialog.querySelectorAll('[data-tab]'))
        button.setAttribute('aria-pressed', String(button === tab));
      for (const panel of dialog.querySelectorAll('[data-panel]'))
        panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    };
  form.addEventListener('input', () => {
    cancel();
    busy(false);
    $('[data-summary]').textContent = 'Valen har ändrats. Kontrollera före export.';
  });
  form.addEventListener('change', () => {
    cancel();
    busy(false);
    $('[data-summary]').textContent = 'Valen har ändrats. Kontrollera före export.';
  });
  $('[data-check]').onclick = () => run();
  form.onsubmit = (e) => {
    e.preventDefault();
    if (result?.file) download();
    else run(true);
  };
  $('[data-close]').onclick = $('[data-cancel]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    cancel();
    busy(false);
  });
  return {
    dialog,
    open() {
      finishEditing();
      cancel();
      busy(false);
      const p = getProject(),
        base = activeBasePoint(p.coordinates);
      $('[data-filename]').value = (p.info.name || 'Modell') + '.ifc';
      $('[data-scope]').value = 'all';
      $('[data-geometry]').value = 'auto';
      $('[data-coordinates]').value = base ? 'map' : 'local';
      $('[data-base]').textContent = base
        ? `Aktiv baspunkt: ${base.name}`
        : 'Ingen aktiv baspunkt.';
      $('[data-coordinates] option[value="map"]').disabled = !base;
      for (const [key, value] of Object.entries(defaultIFCOptions()))
        if (typeof value === 'boolean') $(`[data-${key}]`).checked = value;
      dialog.querySelector('[data-tab="export"]').click();
      $('[data-error]').textContent = '';
      $('[data-summary]').textContent = 'Välj innehåll och kontrollera före export.';
      $('[data-issues]').replaceChildren();
      $('[data-check]').textContent = 'Kontrollera';
      dialog.showModal();
    },
  };
}
