import { createRibbon } from './ribbon.js';

export function installModelWorkspace({ root, controllers }) {
  document.body.classList.add('ui-model-workspace');
  const header = document.body.querySelector(':scope > header');
  header.after(root);
  const button = (id, size = 'small', label) => ({
    node: document.getElementById(id),
    size,
    label,
  });
  const profileLibrary = document.createElement('button');
  profileLibrary.textContent = 'Välj profil ur bibliotek';
  profileLibrary.onclick = () => controllers.sectionEditor.open();
  root.id = 'model-ribbon';
  createRibbon(root, [
    {
      label: 'Skapa',
      items: [
        {
          label: 'Profil',
          primary: document.getElementById('draw'),
          size: 'large',
          menu: [{ node: profileLibrary, icon: 'library' }],
        },
        { stack: [button('plate'), button('item')] },
        {
          label: 'Koppling',
          size: 'large',
          menu: [
            'component-fit',
            'component-baseplate',
            'component-stiffener',
            'component-endplate',
            'component-bolted-endplate',
            'component-beam-splice',
          ].map((id) => button(id)),
        },
        {
          stack: [
            button('edit-grid'),
            { label: 'Hjälpgeometri', menu: ['helperpoint', 'helperline'].map((id) => button(id)) },
          ],
        },
      ],
    },
    {
      label: 'Bearbeta',
      items: [
        { label: 'Skärning', size: 'large', menu: [button('polygoncut'), button('linecut')] },
        { stack: [button('fastener'), button('fastener-group')] },
      ],
    },
    {
      label: 'Ändra',
      items: [
        button('select', 'large'),
        button('move', 'large'),
        { stack: [button('copy'), button('rotate')] },
        button('box-select'),
      ],
    },
    {
      label: 'Projekt',
      items: [
        button('numbering-open', 'large', 'Numrering'),
        {
          stack: [
            {
              label: 'Ritningar',
              primary: document.getElementById('drawings-open'),
              menu: [button('drawings-create')],
            },
            button('reports-open'),
          ],
        },
      ],
    },
  ]);
  const nav = document.createElement('nav');
  nav.className = 'ui-workspace-navigation';
  nav.setAttribute('aria-label', 'Arbetsytor');
  const action = (label, run, active = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = run;
    if (active) b.setAttribute('aria-current', 'page');
    return b;
  };
  nav.append(
    action('Modell', () => {}, true),
    action('Ritningar', () => document.getElementById('drawings-open').click()),
    action('Rapporter', () => document.getElementById('reports-open').click()),
  );
  const libraries = document.createElement('nav');
  libraries.id = 'workspace-library-menu';
  createRibbon(libraries, [
    {
      label: 'Bibliotek',
      items: [
        {
          label: 'Bibliotek',
          icon: 'library',
          menu: [
            { node: action('Profiler', () => controllers.sectionEditor.open()) },
            { node: action('Material', () => controllers.materialUI.openLibrary()) },
            { node: action('Items', () => controllers.itemUI.library.open()) },
            { node: action('Skruvar', () => controllers.fastenerUI.openLibrary()) },
          ],
        },
      ],
    },
  ]);
  nav.append(libraries);
  header.querySelector('.brand').after(nav);
}
