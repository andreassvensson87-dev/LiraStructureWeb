import * as THREE from 'three';
import { createModelImportDialog } from '../ui/model-import-dialog.js';
import {
  parseModelImport,
  planModelImport,
  modelImportObjects,
  MODEL_IMPORT_LIMIT,
} from '../project/model-import.js';
import { latestMaterials } from '../materials.js';
import { profileLibraryNodes } from '../profile-tree.js';
import { updateObjectMeshSelection } from '../model/object-mesh.js';
import { cadFeedback } from '../ui/cad-feedback.js';
import schema from '../project/model-import.schema.json';
import exampleData from '../project/model-import-example.json';
import instructions from '../../docs/model-import.md?raw';

/** File/session owner. Only the model editor commits the selected, reviewed batch. */
export function installWorkspaceModelImport({
  $,
  actions,
  controllers,
  project,
  modelEditor,
  ui,
  scene,
  navigation,
  frameGate,
  host,
  pointerQueue,
}) {
  let data = null,
    rows = [],
    selected = null,
    included = new Set(),
    reviewing = false,
    overrides = new Map(),
    showExcluded = true,
    version = 0,
    engaged = false,
    previousSelection = [],
    inert = [];
  const current = () => rows.find((row) => row.id === selected);
  const libraries = () => ({
    profiles: actions.getLibraryProfiles(),
    materials: controllers.materialUI.records,
    objects: project.objects,
  });
  const report = (error) => {
    view.$('error').textContent = error.message;
  };
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.lira-import.json,.json,application/json';
  input.hidden = true;
  const view = createModelImportDialog({
    choose: () => {
      input.value = '';
      input.click();
    },
    packet: () => downloadPacket().catch(report),
    fit: fitPreview,
    change(id, checked) {
      if (id === 'ghost') showExcluded = checked;
      else if (id === null)
        included = new Set(checked ? rows.filter((row) => !row.error).map((row) => row.id) : []);
      else if (checked) included.add(id);
      else included.delete(id);
      sync();
    },
    select(id) {
      selected = id;
      sync();
    },
    commit,
    profiles: (query) => profileLibraryNodes(actions.getLibraryProfiles(), query),
    profileSelection: () => ({
      key: current()?.object?.section
        ? `${current().object.section.id}:${current().object.section.revision}`
        : '',
      label: current()?.object?.section?.name || current()?.input.profile || '',
    }),
    setProfile: (profile) => override({ profile }),
    setMaterial: (material) => override({ material }),
  });
  document.body.append(input);
  view.$('back').onclick = () => {
    reviewing = false;
    view.review(null);
    sync();
    view.$('import').focus();
  };
  function engage() {
    if (engaged) return;
    controllers.inspector.finish();
    previousSelection = [...ui.selectedIds];
    actions.setSelection([]);
    pointerQueue.pending = null;
    engaged = true;
    // The nonmodal window leaves navigation available while other edit commands are suspended.
    inert = [
      ...document.querySelectorAll(
        'body > header, #model-ribbon, main > aside, body > footer, .ui-tool-hud-stack, dialog[open]',
      ),
    ]
      .filter((node) => node !== view.dialog)
      .map((node) => [node, node.inert]);
    for (const [node] of inert) node.inert = true;
  }
  function open() {
    if (document.querySelector('dialog:modal')) return;
    engage();
    view.open();
  }
  function cleanup(restore = true) {
    version++;
    actions.clearPreview();
    for (const [node, value] of inert) node.inert = value;
    inert = [];
    engaged = false;
    if (restore)
      actions.setSelection(
        previousSelection.filter((id) => project.objects.some((o) => o.id === id)),
      );
    data = null;
    rows = [];
    included.clear();
    reviewing = false;
    view.review(null);
    overrides.clear();
    selected = null;
    view.rows([], null, included);
    view.detail(null, []);
    view.$('details').open = false;
    view.$('source').textContent = 'Välj eller släpp filen från ChatGPT i modellvyn.';
    view.$('status').textContent = 'Ingen fil inläst';
    view.$('import').disabled = true;
    view.$('fit').disabled = true;
    view.$('error').textContent = '';
    frameGate.invalidate();
  }
  view.dialog.addEventListener('close', () => {
    if (engaged) cleanup();
  });
  function paint() {
    if (!ui.preview) return;
    for (const child of ui.preview.children) {
      const row = rows.find((r) => r.object?.id === child.userData.id);
      if (!row) continue;
      const take = included.has(row.id),
        highlight = row.id === selected;
      child.visible = take || showExcluded;
      updateObjectMeshSelection(child, row.object, new Set(highlight ? [row.object.id] : []));
      if (!highlight) child.material.color.set(take ? cadFeedback.preview : '#82969f');
      child.material.opacity = take ? cadFeedback.previewOpacity : 0.09;
      child.material.depthWrite = take;
      if (child.children[0]?.material) child.children[0].material.opacity = take ? 1 : 0.25;
    }
    frameGate.invalidate();
  }
  function preview() {
    actions.clearPreview();
    const batch = rows.flatMap((row) => (row.object ? [row.object] : []));
    if (batch.length) {
      ui.preview = actions.previewModelBatch(batch);
      scene.add(ui.preview);
    }
    paint();
  }
  function fitPreview() {
    if (ui.preview?.children.length) {
      navigation.fit(new THREE.Box3().setFromObject(ui.preview));
      // Use the existing camera projection to frame the part of the viewport beside the window.
      const viewport = host.getBoundingClientRect(),
        window = view.dialog.getBoundingClientRect();
      const left = Math.max(viewport.left, window.right + 16);
      const width = viewport.right - left;
      if (width > 280) {
        navigation.viewHeight *= Math.max(1, viewport.height / width);
        const shift = (left + viewport.right) / 2 - (viewport.left + viewport.right) / 2;
        navigation.projectionOffset.x = (-shift * navigation.viewHeight) / viewport.height;
        navigation.updateProjection();
      }
      frameGate.invalidate();
    }
  }
  function sync() {
    view.rows(rows, selected, included);
    view.detail(
      current(),
      latestMaterials(controllers.materialUI.records).map((material) => ({
        label: material.name,
        value: material,
        detail: `${material.category} · v${material.revision}`,
      })),
    );
    const assumptions = rows.filter((row) => included.has(row.id) && row.assumptions.length).length;
    const errors = rows.filter((row) => row.error).length;
    view.$('status').textContent =
      `${included.size} av ${rows.length} valda${errors ? ` · ${errors} kan inte importeras` : ''}${assumptions ? ` · ${assumptions} med antaganden` : ''}`;
    view.$('import').textContent = reviewing
      ? `Importera ${included.size} med antaganden`
      : `Importera ${included.size} objekt`;
    view.$('import').disabled = !included.size;
    view.$('fit').disabled = !rows.some((row) => row.object);
    paint();
  }
  function override(choice) {
    if (!current()) return;
    const wasInvalid = !!current().error;
    overrides.set(selected, { ...overrides.get(selected), ...choice });
    rows = planModelImport(data, libraries(), overrides);
    included = new Set(
      [...included].filter((id) => rows.some((row) => row.id === id && row.object)),
    );
    if (wasInvalid && current()?.object) included.add(selected);
    view.$('error').textContent = '';
    try {
      preview();
      sync();
    } catch (error) {
      report(error);
      view.$('import').disabled = true;
    }
  }
  async function read(file) {
    if (!engaged) open();
    if (!engaged) return;
    const request = ++version;
    actions.clearPreview();
    data = null;
    rows = [];
    included.clear();
    reviewing = false;
    view.review(null);
    overrides.clear();
    selected = null;
    sync();
    view.$('source').textContent = `Läser ${file.name}…`;
    view.$('error').textContent = '';
    try {
      if (file.size > MODEL_IMPORT_LIMIT) throw Error('Modellförslaget får vara högst 10 MB.');
      const parsed = parseModelImport(await file.text());
      if (request !== version || !engaged) return;
      const planned = planModelImport(parsed, libraries());
      actions.clearPreview();
      data = parsed;
      rows = planned;
      overrides = new Map();
      included = new Set(rows.filter((r) => !r.error).map((r) => r.id));
      selected = null;
      view.$('details').open = false;
      view.$('source').textContent = file.name;
      preview();
      sync();
      fitPreview();
    } catch (error) {
      if (request === version && engaged) {
        view.$('source').textContent = `${file.name} kunde inte läsas.`;
        report(error);
      }
    }
  }
  input.onchange = () => {
    if (input.files[0]) read(input.files[0]);
  };
  async function downloadPacket() {
    const request = version;
    const example = structuredClone(exampleData);
    if (!engaged || request !== version) return;
    const { profiles, materials } = libraries();
    const content = JSON.stringify(
      {
        instructions,
        schema,
        example,
        profiles: profiles.map(({ id, revision, name }) => ({ id, revision, name })),
        materials: latestMaterials(materials).map(({ id, revision, name }) => ({
          id,
          revision,
          name,
        })),
      },
      null,
      2,
    );
    const a = document.createElement('a');
    a.href = `data:application/json;charset=utf-8,${encodeURIComponent(content)}`;
    a.download = 'lirastructures-ai-paket.json';
    a.click();
  }
  function commit() {
    try {
      const assumptions = rows.filter((row) => included.has(row.id) && row.assumptions.length);
      if (assumptions.length && !reviewing) {
        reviewing = true;
        view.review(assumptions);
        sync();
        return;
      }
      const approved = new Set(assumptions.map((row) => row.id));
      const batch = modelImportObjects(data, rows, included, approved, project.objects);
      modelEditor.add(batch);
      cleanup(false);
      view.dialog.close();
      actions.setSelection(batch.map((o) => o.id));
      $('status').textContent = `${batch.length} objekt importerade · Kan ångras i ett steg`;
    } catch (error) {
      report(error);
    }
  }
  sync();
  controllers.modelImportUI = {
    open,
    active: () => engaged,
    cancel: () => view.dialog.close(),
    pick(event) {
      actions.ray(event);
      const id = actions.selectionHit(ui.preview?.children || []);
      const row = rows.find((r) => r.object?.id === id);
      if (row) {
        selected = row.id;
        view.$('details').open = true;
        sync();
      }
    },
  };
  host.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  host.addEventListener('drop', (event) => {
    const files = [...(event.dataTransfer?.files || [])];
    if (!files.length) return;
    event.preventDefault();
    const file = files.find((f) => /\.lira-import\.json$/i.test(f.name));
    if (file) read(file);
    else {
      $('status').textContent =
        'Modellförslag ska ha filändelsen .lira-import.json. Öppna projektfiler via Arkiv.';
    }
  });
}
