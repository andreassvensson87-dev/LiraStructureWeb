import { installExactLength } from './exact-length.js';
import { createRibbon } from './ribbon.js';

export function installModelWorkspace({ root, controllers }) {
  document.body.classList.add('ui-model-workspace');
  const footer = document.querySelector('body > footer');
  const hint = document.createElement('div');
  hint.className = 'ui-command-hint';
  hint.append(document.getElementById('status'), document.getElementById('snap-status'));
  footer.prepend(hint);
  installExactLength(footer, {
    form: document.getElementById('draw-length-form'),
    input: document.getElementById('draw-length'),
    label: document.querySelector('#draw-length-form > label'),
  });
  const header = document.body.querySelector(':scope > header');
  header.after(root);
  const button = (id, size = 'small', label, icon) => ({
    node: document.getElementById(id),
    size,
    label,
    icon,
  });
  const areaCommand = (id, label, icon, run, title = label) => {
    const node = document.createElement('button');
    node.id = id;
    node.textContent = label;
    node.title = title;
    node.onclick = run;
    return { node, label, icon, size: 'large' };
  };
  const areaCorners = areaCommand(
    'work-area',
    'Två hörn',
    'workArea',
    () => controllers.workAreaUI.open(),
    'Arbetsområde från två motstående hörn i XY',
  );
  const polysweep = document.createElement('button');
  polysweep.id = 'polysweep';
  polysweep.textContent = 'Polysweep';
  polysweep.onclick = () => controllers.polysweepUI.start();
  const planeCommand = (mode, label) => {
    const node = document.createElement('button');
    node.textContent = label;
    node.onclick = () => controllers.planeTransformUI.open(mode);
    return { node, icon: mode };
  };
  const linearCommand = (mode, label) => {
    const node = document.createElement('button');
    node.textContent = label;
    node.onclick = () => controllers.linearUI.open(mode);
    return { node, icon: mode };
  };
  root.id = 'model-ribbon';
  createRibbon(root, [
    {
      label: 'Markera',
      items: [button('select', 'large')],
    },
    {
      label: 'Skapa',
      items: [
        button('draw', 'large', 'Sweep'),
        { node: polysweep, icon: 'polyline', size: 'large' },
        { stack: [button('plate'), button('item')] },
        {
          label: 'Block',
          icon: 'layers',
          menu: [
            { label: 'Från markering…', run: () => controllers.blockUI.create() },
            { label: 'Blockbibliotek…', run: () => controllers.blockUI.library.open(3) },
          ].map(({ label, run }) => {
            const node = document.createElement('button');
            node.textContent = label;
            node.onclick = () => {
              try {
                run();
              } catch (error) {
                document.getElementById('status').textContent = error.message;
              }
            };
            return { node };
          }),
        },
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
        {
          label: 'Flytta',
          primary: document.getElementById('move'),
          size: 'large',
          menu: [linearCommand('move', 'Flytta linjärt'), planeCommand('move', 'Flytta till plan')],
        },
        {
          stack: [
            {
              label: 'Kopiera',
              primary: document.getElementById('copy'),
              menu: [
                linearCommand('copy', 'Kopiera linjärt'),
                planeCommand('copy', 'Kopiera till plan'),
              ],
            },
            button('rotate'),
          ],
        },
        button('box-select'),
      ],
    },
    {
      label: 'Arbetsplan',
      items: [
        button('work-plane-two', 'large', 'Två punkter'),
        button('work-plane', 'large', 'Tre punkter'),
        {
          stack: [
            button('work-plane-view', 'small', 'Mot planet'),
            button('work-plane-reset', 'small', 'Återställ', 'undo'),
          ],
        },
      ],
    },
    {
      label: 'Arbetsområde',
      items: [
        {
          primary: areaCorners.node,
          label: areaCorners.label,
          icon: areaCorners.icon,
          size: 'large',
          menu: [
            areaCommand('work-area-selection', 'Runt markering', 'workArea', () =>
              controllers.workAreaUI.aroundSelection(),
            ),
            areaCommand('work-area-reset', 'Visa utan arbetsområde', 'fit', () =>
              controllers.workAreaUI.reset(),
            ),
          ].map((command) => ({ ...command, size: 'small' })),
        },
        areaCommand(
          'work-area-fit',
          'Anpassa till allt',
          'workAreaFit',
          () => controllers.workAreaUI.fitAll(),
          'Anpassa arbetsområdets box till hela modellen och synliga referenser',
        ),
        areaCommand(
          'work-area-heights',
          'Plushöjder',
          'elevations',
          () => controllers.settingsController.open('workArea'),
          'Ändra arbetsområdets övre och nedre plushöjd',
        ),
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
            { node: action('Block', () => controllers.blockUI.library.open(3)) },
            { node: action('Skruvar', () => controllers.fastenerUI.openLibrary()) },
          ],
        },
      ],
    },
  ]);
  nav.append(libraries);
  header.querySelector('.brand').after(nav);
}
