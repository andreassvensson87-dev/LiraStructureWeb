import * as THREE from 'three';
import { createObjectMesh } from '../object-mesh.js';
import { isCut, cutsForModel, displayGeometry, validateObject } from '../../model-object.js';
import { isFastener } from '../../fasteners/object-type.js';
import { validateFastenerTargets } from '../../fasteners/relations.js';
import { replaceFastenerGroup } from '../../fasteners/groups.js';
import { updateAutomaticJoints } from '../../fasteners/update-joints.js';
import { applyObjectBatch } from '../tools/transform-tool.js';

// Owns temporary geometry and validation against the proposed model. No commits.
export function createModelPreview({
  project,
  ui,
  tools,
  scene,
  objects,
  objectFeedback,
  isVisible,
  getReferences,
}) {
  function dispose(o) {
    o.traverse((child) => {
      child.geometry?.dispose();
      if (child.material) child.material.dispose();
    });
  }
  function clearPreview() {
    getReferences()?.clearPlacementPreview();
    ui.componentPreview = false;
    objectFeedback.setModel(project.objects);
    objects.children.forEach((child) => (child.visible = isVisible(child.userData.id)));
    ui.previewSweep = null;
    if (ui.preview) {
      scene.remove(ui.preview);
      dispose(ui.preview);
      ui.preview = null;
    }
  }
  function mesh(s, ghost = false, model = project.objects, geometryContext = null) {
    return createObjectMesh(s, {
      model,
      geometryContext,
      profileDetail: ui.exactProfileIds.has(s.id) ? 'exact' : 'schematic',
      selectedIds:
        tools.operation?.mode === 'fastenerTargets'
          ? new Set(tools.operation.targetIds)
          : ui.selectedIds,
      transparentView: ui.transparentView,
      ghost,
    });
  }
  function validateSweep(s) {
    const error = validateObject(s);
    if (error) return error;
    if (
      s.id &&
      project.objects.some((o) => o.id === s.id) &&
      ui.selectedIds.size <= 1 &&
      (tools.operation?.sources?.length || 0) <= 1
    ) {
      try {
        applyObjectBatch(project.objects, [s]);
      } catch (error) {
        return error.message;
      }
    }
    if (isFastener(s)) {
      try {
        validateFastenerTargets(s, project.objects);
        const model = [...project.objects.filter((old) => old.id !== s.id), s];
        for (const h of s.holes)
          displayGeometry(
            model.find((o) => o.id === h.targetId),
            model,
            'exact',
          ).dispose();
      } catch (e) {
        return e.message;
      }
    }
    if (!isCut(s) && !cutsForModel(s, project.objects).length) return '';
    const model = project.objects.some((old) => old.id === s.id)
      ? project.objects.map((old) => (old.id === s.id ? s : old))
      : [...project.objects, s];
    try {
      for (const target of isCut(s) ? model.filter((old) => s.targets.includes(old.id)) : [s])
        displayGeometry(target, model, 'exact').dispose();
      return '';
    } catch (error) {
      return error.message;
    }
  }
  function previewModelBatch(batch, ghost = true) {
    const previous = new Map(project.objects.map((s) => [s.id, s]));
    const batchIds = new Set(batch.map((s) => s.id));
    const groupId = batch[0]?.group?.id;
    const groupPreview = groupId && batch.every((s) => s.group?.id === groupId);
    let model = groupPreview
      ? updateAutomaticJoints(project.objects, replaceFastenerGroup(project.objects, batch))
      : applyObjectBatch(
          project.objects,
          batch.filter((s) => s.id),
        ).objects;
    if (!groupPreview && batch.some((s) => !previous.has(s.id)))
      model = updateAutomaticJoints(project.objects, [
        ...model,
        ...batch.filter((s) => !previous.has(s.id)),
      ]);

    const affected = new Set(batch.map((s) => s.id));
    const proposed = new Map(model.map((s) => [s.id, s]));
    for (const s of [...project.objects, ...model])
      if (
        s.generatedBy &&
        (previous.get(s.id) !== proposed.get(s.id) || batchIds.has(s.generatedBy))
      ) {
        affected.add(s.id);
        for (const h of s.holes || []) affected.add(h.targetId);
      }
    if (groupPreview)
      for (const s of project.objects)
        if (s.group?.id === groupId) {
          affected.add(s.id);
          for (const h of s.holes) affected.add(h.targetId);
        }
    for (const s of model) {
      const old = previous.get(s.id);
      if (s.type === 'component' && s !== old) {
        affected.add(s.id);
        for (const id of [...s.targets, ...(old?.targets || [])]) affected.add(id);
      }
      if (isFastener(s) && (s !== old || batchIds.has(s.id))) {
        affected.add(s.id);
        for (const h of [...s.holes, ...(old?.holes || [])]) affected.add(h.targetId);
      }
    }
    for (const s of batch)
      if (isCut(s)) {
        s.targets.forEach((id) => affected.add(id));
        project.objects.find((old) => old.id === s.id)?.targets.forEach((id) => affected.add(id));
      }
    const group = new THREE.Group();
    try {
      for (const s of model)
        if (affected.has(s.id))
          group.add(mesh(s, isCut(s) || (ghost && !batch.some(isCut)), model));
    } catch (error) {
      dispose(group);
      throw error;
    }
    // Move/copy targets are previews; keep the real model at its original position
    // so its visible geometry agrees with the unchanged snapping index.
    const keepOriginals = ghost && ['move', 'copy'].includes(tools.operation?.mode);
    objects.children.forEach(
      (child) =>
        (child.visible =
          isVisible(child.userData.id) && (keepOriginals || !affected.has(child.userData.id))),
    );
    objectFeedback.setModel(keepOriginals ? project.objects : model);
    return group;
  }

  return { dispose, clearPreview, mesh, validateSweep, previewModelBatch };
}
