import { ObjectInformation } from './object-information.js';
import { isPhysical } from '../../model-object.js';
import { partStatus } from '../../part-marks.js';
import { setModelProfilesExact, hasExactProfile } from '../../profile-detail.js';

import { createContextMenu } from '../../ui/context-menu.js';
import { installContextClick } from '../../ui/context-click.js';
import { nextPointSnaps, nextPointSnapLabel } from '../next-point-snap.js';

export function installModelContextMenu({
  $,
  actions,
  controllers,
  pointerQueue,
  project,
  renderer,
  tools,
  ui,
}) {
  const surface = renderer.domElement;
  const menu = createContextMenu({ label: 'Objektmeny', returnFocus: surface });
  const objectInformation = new ObjectInformation({
    getObjects: () => project.objects.filter((s) => ui.selectedIds.has(s.id)),
    getModel: () => project.objects,
    partLabel: (s) => (isPhysical(s) ? partStatus(s, project.objects, project.parts).label : '—'),
  });
  const command = (label, run, disabled = false) => ({ label, run, disabled });
  const separator = { separator: true };
  const transform = (mode, label) => ({
    label,
    disabled: $(mode).disabled,
    items: [
      command('Med två punkter', () => $(mode).click()),
      command('Linjärt…', () => controllers.linearUI.open(mode)),
      command('Till plan…', () => controllers.planeTransformUI.open(mode)),
    ],
  });
  function openToolMenu(event) {
    pointerQueue.pending = null;
    if (actions.modelToolMenuState().pointPicking) actions.updatePointer(event);
    const state = actions.modelToolMenuState();
    const items = [command('Bekräfta', () => actions.confirmModelTool(), !state.canConfirm)];
    if (state.pointPicking)
      items.push({
        label: tools.nextPointSnap
          ? `Nästa punkt · ${nextPointSnapLabel(tools.nextPointSnap)}`
          : 'Nästa punkt',
        items: [
          ...nextPointSnaps.map(({ id, label }) =>
            command(
              label,
              () => {
                actions.resetLength();
                tools.nextPointSnap = id;
                tools.activeSnap = null;
                if (tools.lastPointer) actions.updatePointer(tools.lastPointer);
                actions.updateSnapOverlay();
              },
              id === 'perpendicular' && !tools.first,
            ),
          ),
          separator,
          command(
            'Använd vanliga snappval',
            () => {
              tools.nextPointSnap = null;
              tools.activeSnap = null;
              if (tools.lastPointer) actions.updatePointer(tools.lastPointer);
              actions.updateSnapOverlay();
            },
            !tools.nextPointSnap,
          ),
        ],
      });
    items.push(
      separator,
      command('Avbryt', () => actions.cancelModelTool()),
    );
    const label =
      {
        move: 'Flytta',
        copy: 'Kopiera',
        rotate: 'Rotera',
        polysweepCreate: 'Polysweep',
        plateCreate: 'Plate',
        plateVertex: 'Flytta hörn',
        workArea: 'Arbetsområde',
        workPlane: 'Arbetsplan',
        fastenerTargets: 'Välj delar för skruvar',
        fastenerCreate: 'Skruv',
        fit: 'Koppling',
        coordinatePoint: 'Välj koordinatpunkt',
      }[tools.operation?.mode] || 'Pågående verktyg';
    menu.root.setAttribute('aria-label', 'Verktygsmeny');
    menu.open(items, { x: event.clientX, y: event.clientY, title: label });
  }
  function open(event) {
    if (tools.drawing || tools.operation) return openToolMenu(event);
    menu.root.setAttribute('aria-label', 'Objektmeny');
    controllers.inspector?.finish();
    actions.ray(event);
    // A selected grip belongs to the current selection even when another solid overlaps it.
    const onGrip = !!event.target.closest?.('.insertion-point');
    const hit = onGrip ? null : actions.selectionHit();
    if (hit && !ui.selectedIds.has(hit)) actions.selectModelOrReference(hit);
    else if (!onGrip && !hit && actions.referenceSelectionHit())
      actions.selectModelOrReference(null);
    const hadPoints = !!controllers.pointUI?.selected().length;
    controllers.pointUI?.clear();
    if (hadPoints) actions.render({ selectionOnly: true });
    const selected = project.objects.filter((s) => ui.selectedIds.has(s.id));
    const referenceObject = controllers.referenceModels?.selectedObject;
    const referenceSelected = referenceObject || controllers.referenceModels?.selectedReferenceId;
    if (referenceSelected) {
      menu.open(
        referenceObject
          ? [command('Konvertera…', () => controllers.referenceModels.openConversion())]
          : [
              command('Flytta med två punkter', () => $('move').click(), $('move').disabled),
              command('Rotera…', () => $('rotate').click(), $('rotate').disabled),
            ],
        {
          x: event.clientX,
          y: event.clientY,
          title: referenceObject ? 'IFC-objekt' : 'Referensmodell',
        },
      );
      return;
    }
    const profiles = selected.filter(hasExactProfile);
    const drawingSelection = new Set(ui.selectedIds);
    const drawings = controllers.drawingController.selectionContext(drawingSelection);
    const drawingItems = drawings.drawings.map(({ record, valid }) =>
      command(
        `${record.type === 'AS' ? 'Assembly' : 'Part'} · ${record.number}${record.name && record.name !== record.number ? ` · ${record.name}` : ''}${valid ? '' : ' · numrering krävs'}`,
        () => controllers.drawingController.openForSelection(record, drawingSelection),
      ),
    );
    if (!drawingItems.length)
      drawingItems.push(command('Inga befintliga ritningar', () => {}, true));
    drawingItems.push(
      separator,
      command('Skapa partritningar…', () =>
        controllers.drawingController.createForSelection('SP', drawingSelection),
      ),
      command('Skapa assemblyritningar…', () =>
        controllers.drawingController.createForSelection('AS', drawingSelection),
      ),
    );
    const items = [
      transform('move', 'Flytta'),
      transform('copy', 'Kopiera'),
      command('Rotera…', () => $('rotate').click(), $('rotate').disabled),
      separator,
      command('Dölj markerade', () => actions.hideSelected(), !selected.length),
      command('Visa endast markerade', () => controllers.modelTree.isolate(), !selected.length),
      command(
        'Arbetsområde runt markering',
        () => controllers.workAreaUI.aroundSelection(),
        !selected.length,
      ),
      separator,
      command('Egenskaper', () => controllers.inspector.show('properties'), !selected.length),
      command('Information', () => objectInformation.open(), !selected.length),
      { label: 'Ritningar', disabled: !drawings.selection.size, items: drawingItems },
      command(
        'Lägg till i assembly',
        () => {
          const secondaryIds = [...ui.selectedIds];
          actions.setDrawing(false);
          tools.operation = { mode: 'assemblyMain', secondaryIds };
          actions.syncOperationUI();
          surface.style.cursor = 'crosshair';
          $('status').textContent = 'Assembly · Klicka på huvuddelen · Escape avbryter';
          surface.focus({ preventScroll: true });
        },
        !selected.length || selected.some((s) => !isPhysical(s)),
      ),
      {
        label: 'Visning',
        items: [
          command(
            'Visa exakt',
            () => {
              setModelProfilesExact(ui, project.objects, ui.selectedIds, true);
              $('status').textContent = 'Markerade profiler visas exakt med radier';
              actions.render();
            },
            !profiles.length || profiles.every((s) => ui.exactProfileIds.has(s.id)),
          ),
          command(
            'Visa schematiskt',
            () => {
              setModelProfilesExact(ui, project.objects, ui.selectedIds, false);
              $('status').textContent = 'Markerade profiler visas schematiskt utan radier';
              actions.render();
            },
            !profiles.some((s) => ui.exactProfileIds.has(s.id)),
          ),
          command('Rita om vyn', () => {
            ui.exactProfileIds.clear();
            $('status').textContent = 'Vyn omritad · alla profiler visas schematiskt';
            actions.render();
          }),
        ],
      },
      separator,
      command('Ta bort', () => actions.remove(), !selected.length),
    ];
    menu.open(items, {
      x: event.clientX,
      y: event.clientY,
      title: selected.length === 1 ? '1 objekt markerat' : `${selected.length} objekt markerade`,
    });
  }
  // Grips overlay the canvas. Keep their vertex menu, while other grips use the object menu.
  installContextClick(surface.parentElement, open, {
    accepts: (event) =>
      !event.target.closest?.('.drawing-editor') &&
      (event.target === surface || !!event.target.closest?.('.insertion-point')),
  });
  controllers.modelContextMenu = menu;
}
