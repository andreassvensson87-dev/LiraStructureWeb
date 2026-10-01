/** Builds the GA editor DOM without project state, geometry or event behaviour. */
export function createGAShell() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const dialog = document.createElement('dialog');
  dialog.id = 'plan-view';
  dialog.innerHTML =
    '<header><strong>Planritning</strong><button type="button" aria-label="Stäng planritning">×</button></header><div class="plan-toolbar"><label>Nivå<select id="plan-level"></select></label><label>Undre gräns · mm<input id="plan-lower" type="number" value="-1000" step="100"></label><label>Snitthöjd · mm<input id="plan-cut" type="number" value="1200" step="100"></label><label>Övre gräns · mm<input id="plan-upper" type="number" value="3000" step="100"></label><button type="button" id="plan-fit">Visa allt</button></div><p id="plan-error" role="alert"></p><div class="plan-canvas" aria-label="Planritning uppifrån"></div><div class="plan-legend"><span>Höjder relativt vald nivå</span><span>━ Snitt</span><span>─ Synlig kant under snitt</span><span>┄ Ovanför snitt</span><span>Dra för att panorera · scrolla för zoom</span></div>';
  document.body.append(dialog);
  const $ = (id) => dialog.querySelector('#plan-' + id);
  const host = dialog.querySelector('.plan-canvas');
  const views = document.createElement('label');
  views.id = 'part-view-control';
  views.hidden = true;
  views.innerHTML =
    'Detaljvy<select id=part-view><option value=front>Framifrån</option><option value=top>Ovanifrån</option><option value=end>Ändvy</option></select>';
  dialog.querySelector('.plan-toolbar').prepend(views);
  const partViews = views;
  const info = document.createElement('span');
  info.className = 'part-view-info';
  dialog.querySelector('.plan-toolbar').append(info);
  const reviewButton = document.createElement('button');
  reviewButton.textContent = 'Bekräfta aktuell';
  reviewButton.hidden = true;
  dialog.querySelector('.plan-toolbar').append(reviewButton);
  const body = document.createElement('div');
  body.className = 'drawing-body';
  host.before(body);
  const inspector = document.createElement('aside');
  inspector.className = 'drawing-inspector';
  inspector.setAttribute('aria-label', 'Ritningsinspector');
  inspector.innerHTML = '<h3>Planvy</h3>';
  body.append(host, inspector);
  for (const label of dialog.querySelectorAll('.plan-toolbar label')) inspector.append(label);
  const paperWorkspace = document.createElement('div');
  paperWorkspace.className = 'ga-paper-workspace';
  host.before(paperWorkspace);
  const page = document.createElement('div');
  page.className = 'ga-paper-page';
  const stage = document.createElement('div');
  stage.className = 'sheet-stage';
  paperWorkspace.append(stage);
  stage.append(page);
  page.append(host);
  const frameSVG = document.createElementNS(svgNS, 'svg');
  frameSVG.classList.add('ga-frame-overlay');
  page.append(frameSVG);
  return {
    dialog,
    $,
    host,
    partViews,
    info,
    reviewButton,
    paperWorkspace,
    page,
    stage,
    frameSVG,
    body,
    inspector,
  };
}
