import { createConfirmationDialog } from '../../ui/dialog-presentation.js';
import { createContextMenu } from '../../ui/context-menu.js';
import { installContextClick } from '../../ui/context-click.js';
import { drawingContextSelection } from '../../drawing-context-selection.js';

/** One event owner for the drawing workspace. Commands stay with existing editors. */
export function installDrawingContextMenu(
  editor,
  { cancel, fit, openList, showProperties, showViews },
) {
  const surface = editor.marquee.surface;
  const menu = createContextMenu({ label: 'Ritningsmeny', returnFocus: editor.surface });
  editor.dialog.append(menu.root);
  editor.contextMenu = menu;
  const confirmation = createConfirmationDialog({
    title: 'Ta bort vyer?',
    acceptLabel: 'Ta bort',
    cancelLabel: 'Avbryt',
  });
  const separator = { separator: true };
  const selection = () => ({
    annotationIds: [...editor.selectedIds],
    viewIds: [...(editor.marquee.views?.ids() || [])],
  });
  const update = (next) => {
    const apply = () => {
      editor.marquee.views?.change(new Set(next.viewIds));
      editor.selectedIds = new Set(next.annotationIds);
      editor.selected = next.annotationIds.at(-1) || null;
    };
    if (editor.selectionScope) editor.selectionScope.run(apply);
    else apply();
    editor.selectionScope?.capture();
    editor.ui();
    editor.adapter.redraw();
  };
  const open = (event) => {
    if (editor.richText?.draft || event.target.closest('input,textarea,[contenteditable="true"]'))
      return;
    let items, title;
    if (editor.mode || editor.marquee.views?.busy()) {
      items = [
        {
          label: 'Slutför',
          disabled: !editor.completionCommand() && editor.mode !== 'add',
          run: () => (editor.mode === 'add' ? editor.cancel() : editor.complete()),
        },
        { label: 'Avbryt', run: cancel },
      ];
      title = 'Pågående verktyg';
    } else {
      const annotation = event.target.closest('[data-annotation],[data-rich-text]');
      const id = annotation?.dataset.annotation || annotation?.dataset.richText;
      const hit =
        id && editor.items.some((item) => item.id === id)
          ? { kind: 'annotation', id }
          : editor.marquee.viewAt(event);
      const current = selection(),
        next = drawingContextSelection(current, hit);
      if (next !== current) update(next);
      const selected = editor.items.filter((item) => editor.selectedIds.has(item.id));
      const viewIds = [...(editor.marquee.views?.ids() || [])];
      const count = selected.length + viewIds.length;
      title = count === 1 ? '1 markerat' : `${count} markerade`;
      if (!count) {
        title = 'Ritning';
        items = [
          { label: 'Visa blad', run: () => fit(false) },
          { label: 'Visa allt', run: () => fit(true) },
          separator,
          { label: 'Ritningslista', run: openList },
        ];
      } else {
        const single = selected.length === 1 && !viewIds.length ? selected[0] : null;
        items = [
          { label: 'Flytta', run: () => editor.transform.start('move-shapes') },
          { label: 'Kopiera', run: () => editor.transform.start('copy-shapes') },
          {
            label: 'Rotera',
            disabled: !!viewIds.length || new Set(selected.map((item) => item.view)).size > 1,
            run: () => editor.transform.start('rotate-shapes'),
          },
        ];
        if (single?.type === 'dimension') {
          items.push(
            separator,
            { label: 'Lägg till måttpunkt', run: () => editor.startAdding() },
            { label: 'Flytta måttlinje', run: () => editor.placeDimensionLine() },
          );
          const anchor = hit?.id === single.id ? event.target.closest('[data-anchor]') : null;
          const index = anchor ? Number(anchor.dataset.anchor) : -1;
          if (Number.isInteger(index) && index >= 0 && index < single.points.length)
            items.push({
              label: 'Ta bort måttpunkt',
              disabled: single.points.length <= 2,
              run: () => editor.removeDimensionPoint(index),
            });
        }
        if (['polyline', 'polygon'].includes(single?.shape) && !single.parametricBlock) {
          const point = editor.location(event, single.view, false)?.point;
          if (point)
            items.push(separator, {
              label: 'Lägg till hörn',
              run: () => editor.editVertex('insert', point),
            });
          const node = hit?.id === single.id ? event.target.closest('[data-shape-grip]') : null;
          const index = node ? Number(node.dataset.shapeGrip) : -1;
          if (Number.isInteger(index) && index >= 0 && index < single.points.length)
            items.push({
              label: 'Ta bort hörn',
              disabled:
                single.points.length <= (single.closed || single.shape === 'polygon' ? 3 : 2),
              run: () => editor.editVertex('remove', index),
            });
        }
        if (single?.type === 'richtext')
          items.push(separator, {
            label: 'Redigera text',
            run: () => editor.richText.edit(single),
          });
        if (!selected.length && viewIds.length === 1)
          items.push(separator, ...editor.viewActions.items(viewIds[0]));
        items.push(
          separator,
          { label: 'Egenskaper', run: selected.length ? showProperties : showViews },
          {
            label: 'Ta bort',
            run: () =>
              editor.marquee.removeSelection((count) =>
                confirmation.ask(
                  `Ta bort ${count} vy(er), inklusive beroende vyer och deras ritobjekt?`,
                ),
              ),
          },
        );
      }
    }
    menu.open(items, { x: event.clientX, y: event.clientY, title });
  };
  installContextClick(surface, open);
  // A drawing context event must never reach the model or a browser menu.
  surface.addEventListener('contextmenu', (event) => event.stopPropagation());
  editor.dialog.addEventListener('close', () => menu.close());
  return menu;
}
