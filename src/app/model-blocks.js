import '../blocks/block.css';
import { BlockLibrary } from '../blocks/library-controller.js';
import {
  modelBlockDefinition,
  modelBlockMembers,
  updateModelBlock,
} from '../blocks/model-adapter.js';
import { blockPlacementAt, selectedBlock } from '../blocks/placement.js';
import { evaluateBlock } from '../blocks/definition.js';
import { renderBlockInstance } from '../blocks/instance-inspector.js';
import { nextIdentity } from '../object-identity.js';
/** Model adapter: normal parts, existing placement/preview and one model-editor commit. */
export function installModelBlocks({
  controllers,
  project,
  ui,
  tools,
  actions,
  modelEditor,
  $,
  scene,
  renderer,
  frameGate,
}) {
  const panel = document.createElement('section');
  panel.className = 'block-instance-inspector';
  panel.hidden = true;
  panel.dataset.independentEditor = '';
  $('form').before(panel);
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  const selected = () => selectedBlock(project.objects, ui.selectedIds);
  const clear = () => actions.clearPreview();
  const commit = (batch) => {
    modelEditor.update(batch);
    clear();
    signature = '';
    actions.render();
  };
  const library = new BlockLibrary({
    create: () => create(),
    use: (definition, { values, anchorId }) => {
      actions.select(null);
      actions.setDrawing(true);
      tools.operation = {
        mode: 'blockCreate',
        definition,
        values,
        anchorId,
        instanceId: crypto.randomUUID(),
      };
      actions.syncOperationUI();
      $('status').textContent = '3D-block · Välj insättningspunkt, sedan riktning';
      renderer.domElement.focus({ preventScroll: true });
    },
  });
  function create() {
    controllers.inspector?.finish();
    const objects = project.objects.filter((o) => ui.selectedIds.has(o.id)),
      { definition, placement } = modelBlockDefinition(objects);
    const originals = objects.map((o) => ({ ...o, parametricBlock: { memberId: o.id } }));
    library.edit(definition, (saved) => {
      const batch = modelBlockMembers(saved, {}, placement, crypto.randomUUID(), originals);
      const result = modelEditor.prepare(batch);
      return () => {
        modelEditor.replace(result.objects);
        actions.setSelection(batch.map((o) => o.id));
        $('status').textContent = '3D-block skapat';
      };
    });
  }
  let signature = '';
  controllers.blockUI = {
    library,
    create,
    candidate(start, target) {
      const definition = tools.operation.definition,
        result = evaluateBlock(definition, tools.operation.values);
      const placement = blockPlacementAt(
        result,
        tools.operation.anchorId,
        start,
        target,
        tools.temporaryPlane,
      );
      const objects = modelBlockMembers(
        definition,
        tools.operation.values,
        placement,
        tools.operation.instanceId,
        [],
        tools.operation.anchorId,
      );
      const assigned = [];
      for (const object of objects)
        assigned.push({ ...object, ...nextIdentity(object, [...project.objects, ...assigned]) });
      return assigned;
    },
    commitPlacement(batch) {
      modelEditor.add(batch);
      actions.setDrawing(false);
      actions.setSelection(batch.map((o) => o.id));
      $('status').textContent = '3D-block placerat';
    },
    sync() {
      const members = selected();
      if (members.length) {
        $('form').hidden = true;
        $('plate-form').hidden = true;
      }
      panel.hidden = !members.length || !!tools.operation;
      const key = JSON.stringify(members.map((o) => [o.id, o.parametricBlock]));
      if (key === signature) return;
      signature = key;
      renderBlockInstance(panel, {
        members,
        preview: (values) => {
          clear();
          ui.preview = actions.previewModelBatch(updateModelBlock(members, values), false);
          scene.add(ui.preview);
          frameGate.invalidate();
        },
        commit: (values) => commit(updateModelBlock(members, values)),
        reset: () => {
          clear();
          signature = '';
          controllers.blockUI.sync();
          frameGate.invalidate();
        },
        edit: () =>
          library.edit(members[0].parametricBlock.definition, (definition) => {
            const result = modelEditor.prepare(
              updateModelBlock(members, members[0].parametricBlock.values, definition),
            );
            return () => {
              modelEditor.replace(result.objects);
              clear();
              signature = '';
              actions.render();
            };
          }),
        update: () => {
          const block = members[0].parametricBlock;
          commit(updateModelBlock(members, block.values, library.latest(block.definition)));
        },
        detach: () => {
          commit(
            members.map((o) => {
              const next = { ...o };
              delete next.parametricBlock;
              return next;
            }),
          );
        },
        message,
      });
      panel.hidden = !members.length || !!tools.operation;
    },
  };
}
