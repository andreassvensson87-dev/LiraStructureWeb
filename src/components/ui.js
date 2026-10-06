import { componentInspectorSchema } from '../inspector/component-schemas.js';
import {
  createAttributeRow,
  createAttributeSection,
  mountAttributeLayout,
  setAttributeMessage,
} from '../inspector/attributes.js';
import { componentFastenerOptions, componentInspectorSummary } from './inspector-layout.js';
import { flangeProfile } from './bolted-endplate.js';
import { fastenerSeriesKey } from '../fasteners/assembly.js';
import { stiffenerDistance } from './stiffener.js';
import { latestFasteners } from '../fasteners/library.js';
import { isComponent } from './fit.js';
import { suggestFitEnds, pickFitReference, nearestFitEnd } from './fit-placement.js';
import {
  componentDefinition,
  resolveComponentDraft,
  componentDraftChanged,
} from './definitions.js';
import { connectionIcon } from './markers.js';
import { nextIdentity, designation } from '../object-identity.js';
import {
  componentCopyKeys,
  copyComponentProperties,
  localComponentCopyKeys,
} from './property-copy.js';

export function createComponentUI({
  getObjects,
  getSelection,
  getFastenerSpecs,
  openFastenerLibrary,
  commit,
  finish,
  begin,
  highlight,
  hoverReference,
  selectSource,
  showInspector,
  beginCopy,
  commitCopy,
}) {
  const toolbar = document.querySelector('.toolbox');
  for (const [id, label] of [
    ['component-fit', 'Fit'],
    ['component-baseplate', 'Fotplåt'],
    ['component-stiffener', 'Avstyvning'],
    ['component-endplate', 'Ändplåt'],
    ['component-bolted-endplate', 'Ändplåtskoppling'],
    ['component-beam-splice', 'Balkskarv'],
    ['component-library', 'Komponentbibliotek'],
  ]) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', 'false');
    button.title = label;
    button.innerHTML = connectionIcon;
    const span = document.createElement('span');
    span.textContent = id === 'component-library' ? 'Bibliotek' : label;
    button.append(span);
    toolbar.append(button);
  }
  const panel = document.createElement('section');
  panel.className = 'component-properties';
  panel.hidden = true;
  panel.innerHTML = `<p data-prompt aria-live="polite"></p><p class="component-notice" role="status" hidden></p><p class="component-error" role="alert" hidden></p>
  <form data-independent-editor><div class="component-parameters"></div>
  <details class="component-reference-options" data-disclosure="references"><summary>Referenser och delar</summary><div class="component-references"></div><div class="component-reference-actions"><button type="button" data-reference-edit aria-expanded="false">Byt referensobjekt</button><button type="button" data-swap>Byt ordning</button></div><div class="component-reference-fields" hidden></div></details>
  <div class="component-actions"><button type="button" data-reset>Återställ</button><button type="submit" class="primary">Modifiera</button></div></form>
  <details class="component-object-options" data-disclosure="identity"><summary>Objektnamn</summary></details>`;
  document.getElementById('inspector-properties').append(panel);
  const form = panel.querySelector('form');
  let creation = null,
    source = null,
    staged = null,
    valid = false;
  let copying = null;
  const copyKeys = new Set();
  let attributeLayout = null;
  const copyBar = document.createElement('section');
  copyBar.className = 'object-property-copy';
  copyBar.hidden = true;
  copyBar.innerHTML =
    '<button type="button" data-start>Kopiera till andra…</button><p data-copy-status role="status" hidden></p><div class="sweep-copy-actions" hidden><button type="button" data-cancel>Avbryt</button><button type="button" data-apply class="primary">Modifiera</button></div>';
  panel.append(copyBar);
  copyBar.querySelector('[data-start]').onclick = () => {
    try {
      if (!valid || componentDraftChanged(source, staged))
        throw new Error('Modifiera eller återställ källkopplingen först.');
      if (!copyKeys.size) throw new Error('Välj minst en egenskap att kopiera.');
      const snapshot = structuredClone(source);
      beginCopy(snapshot.kind);
      copying = { source: snapshot, targets: [] };
      error();
      sync();
    } catch (e) {
      error(e);
    }
  };
  copyBar.querySelector('[data-cancel]').onclick = () => {
    finish();
    sync();
  };
  copyBar.querySelector('[data-apply]').onclick = confirmCopy;
  function confirmCopy() {
    if (!copying || !copying.targets.length) return;
    try {
      const objects = getObjects();
      const batch = copying.targets.map((id) =>
        copyComponentProperties(
          copying.source,
          objects.find((s) => s.id === id),
          [...copyKeys],
          objects,
        ),
      );
      commitCopy(batch);
    } catch (e) {
      error(e);
    }
  }
  function pickCopy(object) {
    try {
      const component = object?.generatedBy
        ? getObjects().find((s) => s.id === object.generatedBy)
        : object;
      if (
        !copying ||
        component?.kind !== copying.source.kind ||
        component.type !== 'component' ||
        component.id === copying.source.id
      )
        throw new Error(
          `Välj en annan ${componentDefinition(copying?.source.kind || source.kind).label.toLowerCase()} eller en av dess delar.`,
        );
      const ids = new Set(copying.targets);
      if (ids.has(component.id)) ids.delete(component.id);
      else ids.add(component.id);
      copying.targets = [...ids];
      error();
      sync();
    } catch (e) {
      error(e);
    }
  }
  const fitButton = document.getElementById('component-fit');
  const identity = document.getElementById('inspector-identity');
  const identityHome = document.createComment('Object name home');
  identity.before(identityHome);
  const error = (e) => {
    const message = panel.querySelector('[role=alert]');
    setAttributeMessage(message, e?.message || '');
  };
  function hint() {
    panel.querySelector('[data-prompt]').textContent =
      creation?.kind === 'beamSplice'
        ? creation.references.length
          ? 'Klicka på andra balken nära den mötande änden.'
          : 'Klicka nära första balkänden. Välj två raka H/I-balkar.'
        : creation?.kind === 'boltedEndplate'
          ? creation.ready
            ? 'Kontrollera plåt, skruvar och hål och klicka på Skapa ändplåtskoppling.'
            : creation.references.length
              ? 'Klicka på balken nära den ände som ska ansluta till pelarflänsen.'
              : 'Klicka på pelaren. Första versionen ansluter H/I-balk vinkelrätt mot H/I-pelarfläns.'
          : creation?.kind === 'endplate'
            ? creation.ready
              ? 'Kontrollera förhandsvisningen och klicka på Skapa ändplåt.'
              : 'Klicka nära den ände på balken eller pelaren där plåten ska sitta.'
            : creation?.kind === 'stiffener'
              ? creation.ready
                ? 'Kontrollera förhandsvisningen och klicka på Skapa avstyvning.'
                : creation.references.length
                  ? 'Klicka på platsen längs samma balk eller pelare.'
                  : 'Klicka på en H-, I- eller U-profil.'
              : creation?.kind === 'baseplate'
                ? creation.ready
                  ? 'Kontrollera förhandsvisningen och klicka på Skapa fotplåt.'
                  : 'Klicka på pelaren. Fotplåten placeras vid dess nedre ände.'
                : creation
                  ? `Klicka på ${creation.references.length ? 'andra' : 'första'} sweepen nära anslutningen. Kopplingen skapas efter andra klicket.`
                  : 'Ändra valen och klicka på Modifiera. Återställ avbryter ändringarna.';
    panel.querySelector('[data-prompt]').hidden = !creation || !!creation.ready;
    fitButton.setAttribute('aria-pressed', String(creation?.kind === 'fit'));
    document
      .getElementById('component-baseplate')
      .setAttribute('aria-pressed', String(creation?.kind === 'baseplate'));
    document
      .getElementById('component-stiffener')
      .setAttribute('aria-pressed', String(creation?.kind === 'stiffener'));
    document
      .getElementById('component-endplate')
      .setAttribute('aria-pressed', String(creation?.kind === 'endplate'));
    document
      .getElementById('component-bolted-endplate')
      .setAttribute('aria-pressed', String(creation?.kind === 'boltedEndplate'));
    document
      .getElementById('component-beam-splice')
      .setAttribute('aria-pressed', String(creation?.kind === 'beamSplice'));
  }
  function fastenerChoices(kind) {
    return latestFasteners(getFastenerSpecs?.() || []).filter((s) => s.kind === kind);
  }
  function refreshSpecs(input) {
    input.replaceChildren();
    const parameter = componentDefinition(source.kind).parameters.find((p) => p.key === input.name);
    const key = input.name;
    const options = componentFastenerOptions(
      fastenerChoices(parameter.fastenerKind || staged.anchorKind),
      staged[key],
      key === 'boltSpec' && staged.lengthMode === 'auto',
    );
    const choices = options.map((option) => option.spec);
    input._specs = choices;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = choices.length ? 'Välj skruv…' : 'Lägg till skruv i skruvbiblioteket';
    input.append(placeholder);
    choices.forEach((spec, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = options[index].label;
      input.append(option);
    });
    input.value = staged[key]
      ? String(
          choices.findIndex((s) => s.id === staged[key].id && s.revision === staged[key].revision),
        )
      : '';
  }
  function controls() {
    if (!source) return;
    const def = componentDefinition(source.kind);
    for (const parameter of def.parameters) {
      const input = form.elements.namedItem(parameter.key);
      if (parameter.type === 'fastener')
        input.closest('label').querySelector('span').textContent =
          parameter.key === 'boltSpec' && staged.lengthMode === 'auto' ? 'Serie' : 'Skruv';
      if (parameter.type === 'checkbox') input.checked = staged[parameter.key];
      else if (parameter.type === 'fastener') refreshSpecs(input);
      else input.value = staged[parameter.key];
    }
    attributeLayout?.sync({
      compact: true,
      copyVisible: !creation && !panel.hidden,
      copying: !!copying,
      state: { draft: staged },
    });
    form.querySelectorAll('[data-section]').forEach((section) => {
      section.hidden = ![...section.querySelectorAll('label')].some((label) => !label.hidden);
    });
    const productNote = form.querySelector('[data-product-note]');
    if (productNote) {
      productNote.textContent = (def.notices?.(staged) || []).join('. ');
      productNote.hidden = !valid || !productNote.textContent;
    }
    staged.references.forEach((id, i) => (form.elements.namedItem(`reference-${i}`).value = id));
    const changed = componentDraftChanged(source, staged);
    form.querySelector('[type=submit]').disabled = (!changed && !creation?.ready) || !valid;
    form.querySelector('[type=submit]').textContent = creation?.ready
      ? `Skapa ${componentDefinition(creation.kind).label.toLowerCase()}`
      : 'Modifiera';
    form.querySelector('[data-reset]').disabled = !changed;
  }
  function preview() {
    commit(null, 'clear');
    error();
    valid = false;
    try {
      const resolved = resolveComponentDraft(source, stagedParameters(), getObjects());
      staged = resolved;
      valid = true;
      if (creation?.ready || componentDraftChanged(source, staged)) commit(resolved, 'preview');
    } catch (e) {
      valid = false;
      error(e);
    }
    controls();
    sync();
  }
  function stagedParameters() {
    const def = componentDefinition(source.kind);
    return Object.fromEntries(
      ['references', ...(def.snapshotKeys || []), ...def.parameters.map((p) => p.key)].map(
        (key) => [key, staged[key]],
      ),
    );
  }
  function fill(component) {
    const same = source?.id === component.id && source?.kind === component.kind;
    const open = same
      ? new Map(
          [...panel.querySelectorAll('[data-disclosure]')].map((section) => [
            section.dataset.disclosure,
            section.open,
          ]),
        )
      : new Map();
    source = component;
    if (!same) {
      copyKeys.clear();
      for (const key of componentCopyKeys(component.kind))
        if (!localComponentCopyKeys.includes(key)) copyKeys.add(key);
    }
    staged = structuredClone(component);
    valid = true;
    error();
    const def = componentDefinition(source.kind);
    const schema = componentInspectorSchema(source.kind);
    const refs = form.querySelector('.component-reference-fields');
    refs.replaceChildren();
    if (!same) {
      refs.hidden = true;
      form.querySelector('[data-reference-edit]').setAttribute('aria-expanded', 'false');
    }
    def.references.forEach((labelText, index) => {
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('select');
      input.name = `reference-${index}`;
      input.setAttribute('aria-label', labelText);
      for (const s of getObjects().filter((s) => (s.type ?? 'sweep') === 'sweep')) {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.name || designation(s);
        input.append(option);
      }
      input.onchange = () => {
        staged.references[index] = input.value;
        const [a, b] = staged.references.map((id) => getObjects().find((s) => s.id === id));
        if (['fit', 'beamSplice'].includes(source.kind) && a && b)
          Object.assign(staged, suggestFitEnds(a, b));
        preview();
      };
      label.append(input);
      refs.append(label);
    });
    panel.dataset.kind = component.kind;
    const parameters = form.querySelector('.component-parameters');
    parameters.replaceChildren();
    for (const details of panel.querySelectorAll('details'))
      details.open = open.get(details.dataset.disclosure) || false;
    for (const section of schema.groups) {
      const { root, fields } = createAttributeSection(section, {
        open: open.get(section.key) || false,
      });
      root.dataset.section = section.key;
      if (section.collapsed) root.dataset.disclosure = section.key;
      parameters.append(root);
      for (const key of section.fields) {
        const parameter = def.parameters.find((p) => p.key === key);
        const field = schema.fields.find((f) => f.key === key);
        const label = createAttributeRow(field, {
          value: staged[key],
          custom: () => {
            const input = document.createElement('select');
            input.name = key;
            refreshSpecs(input);
            return input;
          },
        });
        const input = label.querySelector('input,select');
        input.id = `component-parameter-${key}`;
        label.htmlFor = input.id;
        input.setAttribute('aria-label', parameter.label);
        if (input.type === 'number') input.step = parameter.step || 'any';
        input.addEventListener(
          parameter.options || ['fastener', 'checkbox'].includes(parameter.type)
            ? 'change'
            : 'input',
          () => {
            staged[parameter.key] =
              parameter.type === 'fastener'
                ? structuredClone(
                    input.value === '' ? null : input._specs[Number(input.value)] || null,
                  )
                : input.type === 'checkbox'
                  ? input.checked
                  : input.type === 'number'
                    ? input.value.trim()
                      ? Number(input.value)
                      : NaN
                    : input.value;
            if (parameter.key === 'anchorKind')
              staged.anchorSpec = structuredClone(fastenerChoices(staged.anchorKind)[0] || null);
            if (['anchorKind', 'anchorSpec'].includes(parameter.key) && staged.anchorSpec) {
              staged.holeDiameter = staged.anchorSpec.diameter + 2;
              staged.useWasher = !!staged.anchorSpec.washer;
            }
            if (parameter.key === 'boltSpec' && staged.boltSpec) {
              staged.lengthOptions = structuredClone(
                fastenerChoices('bolt').filter(
                  (spec) => fastenerSeriesKey(spec) === fastenerSeriesKey(staged.boltSpec),
                ),
              );
              staged.holeDiameter = staged.boltSpec.diameter + 2;
              staged.nearWasher = staged.farWasher = !!staged.boltSpec.washer;
            }
            preview();
          },
        );
        if (parameter.type === 'fastener' && openFastenerLibrary) {
          const libraryButton = document.createElement('button');
          libraryButton.type = 'button';
          libraryButton.textContent = 'Bibliotek';
          libraryButton.setAttribute('aria-label', 'Öppna skruvbibliotek');
          libraryButton.onclick = () =>
            openFastenerLibrary(() => {
              controls();
              sync();
            });
          const control = document.createElement('div');
          control.className = 'component-spec-control';
          control.append(input, libraryButton);
          label.append(control);
        }
        fields.append(label);
      }
      if (source.kind === 'baseplate' && section.key === 'anchor-details') {
        const note = document.createElement('p');
        note.dataset.productNote = '';
        note.className = 'component-product-note';
        root.append(note);
      }
    }
    attributeLayout = mountAttributeLayout(panel, schema, sync, {
      keys: () => [...copyKeys],
      has: (key) => copyKeys.has(key),
      set: (key, checked) => {
        if (checked) copyKeys.add(key);
        else copyKeys.delete(key);
      },
    });
    controls();
  }
  function start(kind = 'fit') {
    finish();
    selectSource(null);
    begin(true, kind);
    creation = {
      type: 'component',
      id: crypto.randomUUID(),
      kind,
      ...structuredClone(componentDefinition(kind).defaults),
      references: [],
    };
    source = null;
    staged = null;
    error();
    sync();
    showInspector();
  }
  function confirm() {
    if (!source || !valid || (!creation?.ready && !componentDraftChanged(source, staged))) return;
    try {
      commit(resolveComponentDraft(source, stagedParameters(), getObjects()), 'save');
    } catch (e) {
      error(e);
    }
  }
  function cancel() {
    copying = null;
    hoverReference(null);
    creation = null;
    staged = source ? structuredClone(source) : null;
    commit(null, 'clear');
    hint();
    if (source) {
      valid = true;
      error();
      controls();
    }
  }
  function sync() {
    const selected = getSelection();
    copyBar.hidden = !!creation || selected.length !== 1 || !componentCopyKeys(source?.kind).length;
    copyBar.querySelector('[data-start]').hidden = !!copying;
    copyBar.querySelector('.sweep-copy-actions').hidden = !copying;
    copyBar.querySelector('[data-copy-status]').hidden = !copying;
    if (copying) {
      copyBar.querySelector('[data-copy-status]').textContent =
        `${copying.targets.length} mål valda · Klicka på kopplingssymboler eller deras delar, sedan Modifiera.`;
      copyBar.querySelector('[data-apply]').disabled = !copying.targets.length || !copyKeys.size;
      controls();
    }
    const owner =
      selected.length &&
      selected.every((s) => s.generatedBy && s.generatedBy === selected[0].generatedBy)
        ? selected[0].generatedBy
        : null;
    const component = owner
      ? getObjects().find((s) => s.id === owner && isComponent(s))
      : selected.length === 1
        ? selected.find(isComponent)
        : null;
    panel.hidden = !creation && !component;
    if (panel.hidden) {
      document.getElementById('inspector-properties').classList.remove('component-inspector');
      if (identity.previousSibling !== identityHome) identityHome.after(identity);
      document.getElementById('identity-fields').hidden = selected.length !== 1;
    } else if (identity.parentElement !== panel.querySelector('.component-object-options'))
      panel.querySelector('.component-object-options').append(identity);
    panel.querySelector('.component-object-options').hidden = !!creation;
    form.hidden = creation ? !creation.ready : !component;
    if (component && !creation && source !== component) fill(component);
    copyBar.hidden = !!creation || !component || !componentCopyKeys(component.kind).length;
    if (!component && !creation) {
      source = null;
      staged = null;
    }
    hint();
    const notice = panel.querySelector('.component-notice');
    notice.textContent =
      source && staged && valid && (!creation || creation.ready)
        ? componentInspectorSummary(staged)
        : '';
    notice.hidden = !notice.textContent;
    const refs =
      (creation?.ready ? staged?.references : creation?.references) ||
      staged?.references ||
      component?.references ||
      [];
    highlight(refs);
    if (copying)
      highlight([
        ...refs,
        ...copying.targets.flatMap((id) => getObjects().find((s) => s.id === id)?.references || []),
      ]);
    const links = panel.querySelector('.component-references');
    hoverReference(null);
    links.replaceChildren();
    refs.forEach((id, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.referenceIndex = i;
      button.disabled = !!copying;
      const object = getObjects().find((s) => s.id === id);
      button.textContent = `${componentDefinition((creation || component || source).kind).references[i]}: ${object?.name || id}`;
      button.setAttribute(
        'aria-label',
        `${componentDefinition((creation || component || source).kind).references[i]} referens: ${object?.name || id}`,
      );
      button.onclick = () => {
        if (!creation) selectSource(id);
      };
      button.addEventListener('pointerenter', () => hoverReference(id));
      button.addEventListener('pointerleave', () => hoverReference(null));
      button.addEventListener('focus', () => hoverReference(id));
      button.addEventListener('blur', () => hoverReference(null));
      links.append(button);
    });
    if (
      component &&
      ['baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice'].includes(
        component.kind,
      ) &&
      !creation
    ) {
      const plates = getObjects().filter(
        (s) => s.generatedBy === component.id && s.componentRole === 'plate',
      );
      for (const plate of plates) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `Plåt: ${designation(plate)}`;
        button.disabled = !!copying;
        button.onclick = () => selectSource(plate.id);
        button.onpointerenter = () => hoverReference(plate.id);
        button.onpointerleave = () => hoverReference(null);
        links.append(button);
      }
    }
    if (!panel.hidden) {
      if (owner) document.getElementById('material-panel').hidden = true;
      document.getElementById('cut-relations').hidden = true;
      document.getElementById('identity-fields').hidden = true;
      document.getElementById('multi-selection').hidden = true;
      form.querySelector('[data-swap]').hidden = (creation || component).kind !== 'fit';
      document.getElementById('object-heading').textContent = componentDefinition(
        (creation || component).kind,
      ).label;
      document.getElementById('mode-label').textContent = creation
        ? creation.ready
          ? 'Förhandsvy'
          : 'Ny'
        : designation(component);
      document.getElementById('inspector-properties').classList.add('component-inspector');
      document.getElementById('form').hidden = true;
      document.getElementById('plate-form').hidden = true;
    }
  }
  form.addEventListener('input', (e) => e.stopPropagation());
  form.addEventListener('change', (e) => e.stopPropagation());
  form.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (creation || copying) finish();
      else cancel();
      sync();
    } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      if (copying) confirmCopy();
      else confirm();
    }
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    confirm();
  };
  form.querySelector('[data-reset]').onclick = () => {
    if (creation?.ready) {
      staged = structuredClone(source);
      preview();
    } else {
      cancel();
      sync();
    }
  };
  form.querySelector('[data-reference-edit]').onclick = () => {
    const fields = form.querySelector('.component-reference-fields');
    fields.hidden = !fields.hidden;
    form
      .querySelector('[data-reference-edit]')
      .setAttribute('aria-expanded', String(!fields.hidden));
  };
  form.querySelector('[data-swap]').onclick = () => {
    staged.references.reverse();
    [staged.endA, staged.endB] = [staged.endB, staged.endA];
    preview();
  };
  fitButton.onclick = () => start('fit');
  document.getElementById('component-baseplate').onclick = () => start('baseplate');
  document.getElementById('component-stiffener').onclick = () => start('stiffener');
  document.getElementById('component-endplate').onclick = () => start('endplate');
  document.getElementById('component-bolted-endplate').onclick = () => start('boltedEndplate');
  document.getElementById('component-beam-splice').onclick = () => start('beamSplice');
  const library = document.createElement('dialog');
  library.className = 'component-dialog';
  library.setAttribute('aria-labelledby', 'component-library-title');
  library.innerHTML =
    '<header><h2 id="component-library-title">Komponenter / kopplingar</h2><button type="button" aria-label="Stäng bibliotek">×</button></header><p>Kopplingar som följer sina referensobjekt och styrs med parametrar.</p><button type="button" class="component-card"><strong>Fit</strong><span>Gerning eller anslutning mot genomgående sweep</span></button><button type="button" class="component-card" data-baseplate><strong>Fotplåt</strong><span>Pelare, plåt och ankarmönster med gängstång eller betongskruv</span></button><button type="button" class="component-card" data-stiffener><strong>Avstyvning</strong><span>Profilpassade plåtar för H-, I- och U-profiler</span></button><button type="button" class="component-card" data-endplate><strong>Ändplåt</strong><span>Plåt vinkelrätt mot balkens eller pelarens ände</span></button><button type="button" class="component-card" data-bolted-endplate><strong>Ändplåtskoppling</strong><span>H/I-balk mot pelarfläns med plåt, skruvar och hål</span></button><button type="button" class="component-card" data-beam-splice><strong>Balkskarv</strong><span>Två ändplåtar med gemensamma skruvar och hål för raka H/I-balkar</span></button><h3>Planerade stålkopplingar</h3><ul><li>Pelare mot balk</li><li>Balk mot balk</li><li>Pelarskarv</li></ul>';
  document.body.append(library);
  library.querySelector('header button').onclick = () => library.close();
  library.querySelector('.component-card').onclick = () => {
    library.close();
    start();
  };
  library.querySelector('[data-baseplate]').onclick = () => {
    library.close();
    start('baseplate');
  };
  library.querySelector('[data-stiffener]').onclick = () => {
    library.close();
    start('stiffener');
  };
  library.querySelector('[data-endplate]').onclick = () => {
    library.close();
    start('endplate');
  };
  library.querySelector('[data-bolted-endplate]').onclick = () => {
    library.close();
    start('boltedEndplate');
  };
  library.querySelector('[data-beam-splice]').onclick = () => {
    library.close();
    start('beamSplice');
  };
  library.addEventListener('keydown', (e) => e.stopPropagation());
  document.getElementById('component-library').onclick = () => {
    finish();
    library.showModal();
  };
  return {
    pickCopy,
    confirmCopy,
    confirm,
    cancel,
    sync,
    pick(object, point) {
      if (!creation || creation.ready) return;
      try {
        if (['boltedEndplate', 'beamSplice'].includes(creation.kind)) {
          if (!flangeProfile(object)) throw new Error('Välj en H- eller I-profil.');
          if (!creation.references.length) {
            creation.references = [object.id];
            if (creation.kind === 'beamSplice') creation.endA = nearestFitEnd(object, point);
            sync();
            return;
          }
          if (creation.references[0] === object.id)
            throw new Error('Välj ett annat referensobjekt.');
          const choices = fastenerChoices('bolt').filter((spec) => spec.head.kind === 'hex');
          const spec = choices.find((spec) => spec.standard === 'ISO 4017') || choices[0] || null;
          const candidate = {
            ...creation,
            references: [creation.references[0], object.id],
            endB: nearestFitEnd(object, point),
            boltSpec: structuredClone(spec),
            lengthOptions: structuredClone(
              spec
                ? choices.filter((other) => fastenerSeriesKey(other) === fastenerSeriesKey(spec))
                : [],
            ),
            holeDiameter: spec ? spec.diameter + 2 : 18,
            nearWasher: !!spec?.washer,
            farWasher: !!spec?.washer,
          };
          Object.assign(candidate, nextIdentity(candidate, getObjects()));
          candidate.name = `${componentDefinition(candidate.kind).label} · ${designation(candidate)}`;
          begin(false, candidate.kind);
          creation = { ...candidate, ready: true };
          fill(candidate);
          preview();
          return;
        }
        if (creation.kind === 'endplate') {
          if (!object || (object.type ?? 'sweep') !== 'sweep')
            throw new Error('Välj en balk eller pelare.');
          const candidate = {
            ...creation,
            references: [object.id],
            endA: nearestFitEnd(object, point),
          };
          const value = componentDefinition('endplate').resolve(candidate, getObjects());
          Object.assign(value, nextIdentity(value, getObjects()));
          value.name = `Ändplåt · ${designation(value)}`;
          begin(false, 'endplate');
          creation = { ...value, ready: true };
          fill(value);
          preview();
          return;
        }
        if (creation.kind === 'stiffener') {
          if (!object || (object.type ?? 'sweep') !== 'sweep')
            throw new Error('Välj en H-, I- eller U-profil.');
          const candidate = {
            ...creation,
            references: [object.id],
            distance: creation.references.length
              ? Math.round(stiffenerDistance(object, point) * 10) / 10
              : Math.hypot(...object.end.map((v, i) => v - object.start[i])) / 2,
          };
          if (creation.references.length && object.id !== creation.references[0])
            throw new Error('Klicka på samma balk eller pelare för att välja plats.');
          const value = componentDefinition('stiffener').resolve(candidate, getObjects());
          if (!creation.references.length) {
            creation = { ...creation, references: [object.id] };
            sync();
            return;
          }
          Object.assign(value, nextIdentity(value, getObjects()));
          value.name = `Avstyvning · ${designation(value)}`;
          begin(false, 'stiffener');
          creation = { ...value, ready: true };
          fill(value);
          preview();
          return;
        }
        if (creation.kind === 'baseplate') {
          if (!object || (object.type ?? 'sweep') !== 'sweep') throw new Error('Välj en pelare.');
          const candidate = {
            ...creation,
            references: [object.id],
            endA: object.start[2] < object.end[2] ? 'start' : 'end',
          };
          const value = componentDefinition('baseplate').resolve(candidate, getObjects());
          Object.assign(value, nextIdentity(value, getObjects()));
          value.name = `Fotplåt · ${designation(value)}`;
          begin(false, 'baseplate');
          creation = { ...value, ready: true };
          fill(value);
          preview();
          return;
        }
        const slot = creation.references.length ? 'b' : 'a';
        const picked = pickFitReference({ a: creation.references[0], b: '' }, slot, object, point);
        if (slot === 'a') {
          creation.references = [picked.id];
          creation.endA = picked.end;
          sync();
          return;
        }
        const candidate = {
          ...creation,
          references: [...creation.references, picked.id],
          endB: picked.end,
        };
        const value = componentDefinition(candidate.kind).resolve(candidate, getObjects());
        value.id = crypto.randomUUID();
        Object.assign(value, nextIdentity(value, getObjects()));
        value.name = `Fit · ${designation(value)}`;
        commit(value, 'save');
      } catch (e) {
        error(e);
      }
    },
  };
}
