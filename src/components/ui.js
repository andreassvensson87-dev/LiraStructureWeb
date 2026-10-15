import { createComponentInspector } from './inspector.js';
import { createComponentPlacement, componentPlacementPrompt } from './placement-session.js';
import { editComponentParameter } from './parameter-edit.js';
import { setAttributeMessage } from '../inspector/attributes.js';
import { componentInspectorSummary } from './inspector-layout.js';
import { latestFasteners } from '../fasteners/library.js';
import { isComponent } from './fit.js';
import { suggestFitEnds } from './fit-placement.js';
import {
  componentDefinition,
  componentKinds,
  resolveComponentDraft,
  componentDraftChanged,
} from './definitions.js';
import { connectionIcon } from './markers.js';
import { designation } from '../object-identity.js';
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
  promptChanged,
}) {
  const toolbar = document.querySelector('.toolbox');
  const commandId = (kind) => 'component-' + kind.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  for (const kind of componentKinds()) {
    const id = commandId(kind),
      label = componentDefinition(kind).label;
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', 'false');
    button.title = label;
    button.innerHTML = connectionIcon;
    const span = document.createElement('span');
    span.textContent = label;
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
  let placement = null;
  let creation = null,
    source = null,
    staged = null,
    valid = false;
  let copying = null;
  const copyKeys = new Set();
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
  const identity = document.getElementById('inspector-identity');
  const identityHome = document.createComment('Object name home');
  identity.before(identityHome);
  const error = (e) => {
    const message = panel.querySelector('[role=alert]');
    setAttributeMessage(message, e?.message || '');
  };
  function hint() {
    panel.querySelector('[data-prompt]').textContent = creation
      ? componentPlacementPrompt(creation.kind, creation.references.length, creation.ready)
      : '';
    if (creation) promptChanged?.(panel.querySelector('[data-prompt]').textContent);
    panel.querySelector('[data-prompt]').hidden = !creation || !!creation.ready;
    for (const kind of componentKinds())
      document
        .getElementById(commandId(kind))
        .setAttribute('aria-pressed', String(creation?.kind === kind));
  }
  function fastenerChoices(kind) {
    return latestFasteners(getFastenerSpecs?.() || []).filter((s) => s.kind === kind);
  }
  const inspector = createComponentInspector({
    panel,
    form,
    getObjects,
    selectSource,
    hoverReference,
    fastenerChoices,
    openFastenerLibrary,
    copyKeys,
    getState: () => ({ source, staged, valid, creation, copying }),
    changed: () => sync(),
    changeParameter: (key, value) => {
      staged = editComponentParameter(staged, key, value, getFastenerSpecs?.() || []);
      preview();
    },
    changeReference: (index, id) => {
      staged.references[index] = id;
      const [a, b] = staged.references.map((id) => getObjects().find((s) => s.id === id));
      if (['fit', 'beamSplice'].includes(source.kind) && a && b)
        Object.assign(staged, suggestFitEnds(a, b));
      preview();
    },
  });
  const controls = () => inspector.controls();
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
    valid = !creation;
    error();
    inspector.fill(component, { same, open });
  }
  function start(kind = 'fit') {
    finish();
    selectSource(null);
    begin(true, kind);
    placement = createComponentPlacement(kind);
    creation = placement.state;
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
    if (creation) promptChanged?.(`${componentDefinition(creation.kind).label} avbruten`);
    copying = null;
    placement = null;
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
    } else if (identity.parentElement !== panel.querySelector('.component-object-options'))
      panel.querySelector('.component-object-options').append(identity);
    panel.querySelector('.component-object-options').hidden = false;
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
    inspector.references(refs, component);
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
  for (const kind of componentKinds())
    document.getElementById(commandId(kind)).onclick = () => start(kind);
  return {
    pickCopy,
    confirmCopy,
    confirm,
    cancel,
    sync,
    pick(object, point) {
      if (!placement || creation.ready) return;
      try {
        const next = placement.pick(object, point, getObjects(), getFastenerSpecs?.() || []);
        creation = next;
        error();
        if (!next.ready) {
          sync();
          return;
        }
        begin(false, next.kind);
        // Native tool reset cancels the previous controller session before activating preview.
        placement = null;
        creation = next;
        const candidate = { ...next };
        delete candidate.ready;
        fill(candidate);
        preview();
      } catch (e) {
        error(e);
      }
    },
  };
}
