const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const chevron = icon('m8 10 4 4 4-4');
export function frameEditorHeader() {
  return `<header class="fe-header"><strong>Ritningsramseditor <small>1:1 · mm</small></strong>
    <nav class="fe-header-menus" aria-label="Fil och mallar">
      <details class="fe-top-menu"><summary>Arkiv ${chevron}</summary><div class="fe-top-panel">
        <button data-action="new">Nytt ramblock</button><button data-action="open">Öppna / hantera…</button>
        <button data-action="importDXF">Importera DXF…</button>
      </div></details>
      <details class="fe-top-menu"><summary>Mallar ${chevron}</summary><div class="fe-top-panel">
        <button data-action="standardLayouts">Standardlayouter…</button>
      </div></details>
    </nav>
    <div class="fe-document"><input data-ui="name" aria-label="Ramnamn" readonly><span data-ui="unsaved" class="fe-unsaved" aria-label="Osparade ändringar" title="Osparade ändringar" hidden></span></div>
    <div class="fe-header-actions"><div class="fe-save-group"><button data-action="save" class="fe-save">${icon('M5 3h12l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8')}<span>Spara</span></button>
      <details class="fe-top-menu fe-save-menu"><summary aria-label="Fler sparalternativ">${chevron}</summary><div class="fe-top-panel"><button data-action="saveAs">Spara som…</button></div></details></div>
      <button class="fe-header-icon" data-action="settings" aria-label="Inställningar för rameditorn">${icon('M9 3h6l1 4 4 1v6l-4 1-1 4H9l-1-4-4-1V8l4-1ZM15 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0')}</button>
      <button class="fe-header-icon" data-action="close" aria-label="Stäng ritningsramseditorn">${icon('m6 6 12 12M6 18 18 6')}</button>
    </div></header>
    <div class="fe-bar"><div class="fe-modes" role="group" aria-label="Redigeringsläge"><button data-mode="block" aria-pressed="true">Ramblock</button><button data-mode="layout" aria-pressed="false">Layouter</button></div>
      <span data-ui="modeHint" hidden></span><select hidden data-ui="library" aria-label="Sparade ritningsramar"></select>
      <div class="fe-view-actions" role="group" aria-label="Historik och vy"><button data-action="undo" aria-label="Ångra" title="Ångra · Ctrl Z">${icon('M8 4 3 9l5 5M3 9h10a6 6 0 0 1 0 12')}</button><button data-action="redo" aria-label="Gör om" title="Gör om · Ctrl Shift Z">${icon('m16 4 5 5-5 5M21 9H11a6 6 0 0 0 0 12')}</button><button data-action="fit" title="Visa hela bladet">${icon('M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6')}<span>Visa blad</span></button></div>
      <button class="fe-preview-trigger" data-action="preview">${icon('M3 3h18v14H3ZM12 17v4M8 21h8')}<span>Förhandsvisning</span>${chevron}</button>
      <label hidden>Förhandsvisa attribut<select data-ui="preview"><option value="">Attributnamn</option></select></label>
    </div>`;
}
export function installFrameHeader(dialog) {
  const menus = [...dialog.querySelectorAll('.fe-top-menu')];
  const close = () =>
    menus.forEach((menu) => {
      menu.open = false;
    });
  for (const menu of menus) {
    menu.addEventListener('toggle', () => {
      menu.querySelector('summary').setAttribute('aria-expanded', String(menu.open));
    });
    menu.querySelector('summary').addEventListener('click', () => {
      menus
        .filter((other) => other !== menu)
        .forEach((other) => {
          other.open = false;
        });
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu.open) {
        event.preventDefault();
        event.stopPropagation();
        close();
        menu.querySelector('summary').focus();
      }
    });
  }
  dialog.addEventListener('pointerdown', (event) => {
    for (const menu of menus) if (!menu.contains(event.target)) menu.open = false;
  });
  dialog.addEventListener('close', close);
  return { close };
}
