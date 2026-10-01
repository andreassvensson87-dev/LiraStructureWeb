/** Builds the Single Part editor DOM. Events and drawing state belong to its controller. */
export function createSinglePartShell() {
  const dialog = document.createElement('dialog');
  dialog.id = 'single-sheet';
  dialog.innerHTML =
    '<header><strong></strong><button aria-label="Stäng detaljritning">×</button></header><div class="sheet-toolbar"><label>Papper<select id="sheet-paper"></select></label><button id="sheet-library">Pappersbibliotek…</button><label>Orientering<select id="sheet-orientation"><option value="landscape">Liggande</option><option value="portrait">Stående</option></select></label><label>Top 1:<input id="sheet-scale-top" type="number" min="0.1" max="1000" step="any"></label><label>Front 1:<input id="sheet-scale-front" type="number" min="0.1" max="1000" step="any"></label><label>Sektion 1:<input id="sheet-scale-section" type="number" min="0.1" max="1000" step="any"></label><label>Snitt A–A · mm<input id="sheet-section" type="number" step="any"></label><button id="sheet-layout">Ordna vyer</button><button id="sheet-fit">Visa blad</button><button id="sheet-review">Bekräfta aktuell</button></div><p id="sheet-message" role="status"></p><div class="sheet-workspace"><svg class="drawing-paper" aria-label="Single Part ritningsblad"></svg></div><footer>Dra i vyernas ramar för att placera dem; varje vy kan flyttas och beskäras självständigt. Scrolla för att zooma mot muspekaren.</footer>';
  document.body.append(dialog);
  const $ = (id) => dialog.querySelector('#sheet-' + id);
  const svg = dialog.querySelector('svg');
  const workspace = dialog.querySelector('.sheet-workspace');
  const stage = document.createElement('div');
  stage.className = 'sheet-stage';
  workspace.append(stage);
  stage.append(svg);
  const body = document.createElement('div');
  body.className = 'drawing-body';
  workspace.before(body);
  const inspector = document.createElement('aside');
  inspector.className = 'drawing-inspector';
  inspector.setAttribute('aria-label', 'Ritningsinspector');
  inspector.innerHTML =
    '<h3>Vy</h3><label>Markerad vy<select id="sheet-selected-view"><option value="top">Top</option><option value="front">Front</option><option value="section">Sektion A–A</option></select></label><div class="view-properties"></div><details open><summary>Blad</summary><div class="sheet-properties"></div></details>';
  body.append(workspace, inspector);
  for (const v of ['top', 'front', 'section'])
    inspector.querySelector('.view-properties').append($('scale-' + v).parentElement);
  inspector.querySelector('.view-properties').append($('section').parentElement);
  for (const id of ['paper', 'orientation'])
    inspector.querySelector('.sheet-properties').append($(id).parentElement);
  inspector.querySelector('.sheet-properties').append($('library'));
  return { dialog, $, svg, workspace, stage, body, inspector };
}
