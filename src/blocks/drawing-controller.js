import { BlockLibrary } from './library-controller.js';
import { blockButton } from './editor-fields.js';
import {
  drawingBlockDefinition,
  drawingBlockMembers,
  updateDrawingBlock,
} from './drawing-adapter.js';
import { blockPlacementAt, selectedBlock, blockSelection } from './placement.js';
import { evaluateBlock } from './definition.js';
import { renderBlockInstance } from './instance-inspector.js';
import { blockGripValues, blockPropertyGripValues, blockRadiusGripValues } from './grip.js';
import { insulationFrame } from '../drawing-insulation.js';
import { paintBlockPaper, paintBlockPaperFeedback } from './drawing-paper-renderer.js';
import { shapeGrips } from '../drawing-shape-grips.js';
import { translatedShapes } from '../drawing-object-transform.js';
import { validateBlockInstances } from './validation.js';
/** Adapter for native DrawingAnnotations tools, snap, grips, history and SVG preview. */
export class DrawingBlocks {
  constructor(editor, toolbar) {
    this.editor = editor;
    if (editor.adapter.paper !== editor.surface) {
      editor.dialog.addEventListener(
        'pointerdown',
        (event) => {
          if (event.defaultPrevented || !editor.adapter.paper?.contains(event.target)) return;
          if (
            (editor.mode === 'block-place' && this.definition?.units === 'paper') ||
            (event.target.closest('[data-block-paper]') &&
              (!editor.mode || editor.transform?.active())) ||
            (!editor.mode &&
              editor.item()?.parametricBlock &&
              editor.item().view === 'paper' &&
              !event.target.closest('[data-annotation],[data-rich-text]'))
          )
            editor.down(event);
        },
        true,
      );
      editor.adapter.paper?.addEventListener(
        'pointermove',
        (event) => {
          if (
            !event.defaultPrevented &&
            editor.mode === 'block-place' &&
            this.definition?.units === 'paper'
          )
            this.move(event);
        },
        true,
      );
    }
    this.library = new BlockLibrary({
      use: (definition, { values, anchorId }) => {
        this.definition = definition;
        this.values = values;
        this.anchorId = anchorId;
        this.first = null;
        this.instanceId = crypto.randomUUID();
        editor.start('block-place');
      },
      create: () => this.create(),
    });
    for (const [label, action] of [
      ['Block från markering…', () => this.create()],
      ['Blockbibliotek…', () => this.library.open(2)],
    ]) {
      const button = blockButton(label, () => {
        try {
          action();
        } catch (error) {
          editor.hint.textContent = error.message;
        }
      });
      button.dataset.drawingGroup = 'other';
      toolbar.append(button);
    }
    editor.dialog.addEventListener('close', () => {
      this.preview = null;
      this.definition = null;
    });
  }
  create() {
    const editor = this.editor,
      chosen = editor.items.filter((item) => editor.selectedIds.has(item.id)),
      { definition, placement, view } = drawingBlockDefinition(chosen);
    this.library.edit(definition, (saved) =>
      this.prepare(
        drawingBlockMembers(
          saved,
          {},
          placement,
          saved.units === 'paper' ? 'paper' : view,
          crypto.randomUUID(),
          chosen.map((item) => ({ ...item, parametricBlock: { memberId: item.id } })),
        ),
      ),
    );
  }
  prepare(batch) {
    const editor = this.editor;
    if (!editor.record) throw Error('Öppna ritningen först.');
    const byId = new Map(batch.map((item) => [item.id, item]));
    const next = editor.items.map((item) => byId.get(item.id) || item);
    for (const item of batch) if (!next.some((o) => o.id === item.id)) next.push(item);
    validateBlockInstances(next, 2, updateDrawingBlock);
    return () => {
      editor.checkpoint();
      editor.items = editor.record.annotations = next;
      this.preview = null;
      editor.selectedIds = new Set(batch.map((item) => item.id));
      editor.selected = batch.at(-1)?.id;
      editor.cancel();
    };
  }
  commit(batch) {
    return this.prepare(batch)();
  }
  ui(message) {
    const editor = this.editor;
    if (editor.mode === 'block-place') {
      editor.panel.replaceChildren();
      const title = document.createElement('h3');
      title.textContent = this.definition.name;
      editor.panel.append(title);
      editor.hint.textContent =
        message || (this.first ? 'Block · Välj riktning' : 'Block · Välj insättningspunkt');
      return true;
    }
    if (editor.mode) return false;
    const members = selectedBlock(editor.items, editor.selectedIds);
    if (!members.length) {
      this.preview = null;
      return false;
    }
    if (this.preview?.[0]?.parametricBlock.instanceId !== members[0].parametricBlock.instanceId)
      this.preview = null;
    const error = document.createElement('p');
    error.setAttribute('role', 'alert');
    error.textContent = message || '';
    renderBlockInstance(editor.panel, {
      members,
      message: error,
      preview: (values) => {
        this.preview = null;
        try {
          this.preview = updateDrawingBlock(members, values);
        } finally {
          editor.redrawFeedback();
        }
      },
      commit: (values) => this.commit(updateDrawingBlock(members, values)),
      reset: () => {
        this.preview = null;
        editor.ui();
        editor.adapter.redraw();
      },
      edit: () =>
        this.library.edit(members[0].parametricBlock.definition, (definition) =>
          this.prepare(updateDrawingBlock(members, members[0].parametricBlock.values, definition)),
        ),
      update: () => {
        const block = members[0].parametricBlock;
        this.commit(
          updateDrawingBlock(members, block.values, this.library.latest(block.definition)),
        );
      },
      detach: () =>
        this.commit(
          members.map((item) => {
            const next = { ...item };
            delete next.parametricBlock;
            return next;
          }),
        ),
    });
    editor.panel.parentElement.classList.add('annotation-focused');
    return true;
  }
  candidate(hit) {
    const definition = this.definition,
      result = evaluateBlock(definition, this.values);
    const placement = blockPlacementAt(
      result,
      this.anchorId,
      this.first?.point || hit.point,
      this.first ? hit.point : undefined,
    );
    return drawingBlockMembers(
      definition,
      this.values,
      placement,
      this.first?.view || hit.view,
      this.instanceId,
      [],
      this.anchorId,
    );
  }
  locate(event) {
    const editor = this.editor;
    return editor.location(
      event,
      this.first?.view || (this.definition.units === 'paper' ? 'paper' : undefined),
      true,
    );
  }
  down(event) {
    const hit = this.locate(event);
    if (!hit) return;
    try {
      if (!this.first) {
        this.first = hit;
        this.editor.draft = { points: [hit.point], view: hit.view };
        this.editor.ui();
      } else this.commit(this.candidate(hit));
    } catch (error) {
      this.editor.ui(error.message);
    }
    this.editor.adapter.redraw();
  }
  move(event) {
    this.editor.hover = this.locate(event);
    this.editor.redrawFeedback();
  }
  render(root) {
    const editor = this.editor;
    if (editor.mode === 'block-place' && editor.hover) {
      try {
        this.candidate(editor.hover)
          .filter((item) => item.view !== 'paper')
          .forEach((item) => editor.paint(root, item, false, true));
      } catch {
        /* An incomplete direction has no preview. */
      }
    } else if (!editor.mode && this.preview)
      this.preview
        .filter((item) => item.view !== 'paper')
        .forEach((item) => editor.paint(root, item, false, true));
    this.paintPaperFeedback();
  }
  paintPaper(root, backRoot) {
    this.paperRoot = root;
    const editor = this.editor;
    paintBlockPaper({
      root,
      backRoot,
      items: editor.items,
      selectedIds: editor.selectedIds,
      record: editor.record,
      mode: editor.mode,
    });
    this.paintPaperFeedback();
  }
  paintPaperFeedback() {
    let items = this.preview || [];
    if (this.editor.transform?.active() && this.editor.transform.view === 'paper')
      items = this.editor.transform.preview();
    if (
      this.editor.mode === 'block-place' &&
      this.definition?.units === 'paper' &&
      this.editor.hover
    ) {
      try {
        items = this.candidate(this.editor.hover);
      } catch {
        items = [];
      }
    }
    paintBlockPaperFeedback(this.paperRoot, items, this.editor.record);
  }
  beginGrip(event, node, item) {
    const editor = this.editor,
      members = selectedBlock(editor.items, blockSelection(editor.items, [item.id])),
      index = Number(node.dataset.shapeGrip),
      grip = shapeGrips(item)[index],
      before = structuredClone(members);
    if (!grip) return null;
    editor.selected = item.id;
    editor.selectedIds = blockSelection(editor.items, [item.id]);
    editor.ui();
    let batch;
    const session = {
      label: 'Blockparameter',
      base: grip.point,
      locate: (e) => editor.location(e, item.view, true, item.id),
      apply: (hit) => {
        batch =
          grip.kind === 'move'
            ? translatedShapes(
                before,
                before.map((o) => o.id),
                grip.point,
                hit.point,
              )
            : updateDrawingBlock(
                before,
                grip.kind === 'thickness'
                  ? blockPropertyGripValues(
                      item.parametricBlock,
                      item.parametricBlock.memberId,
                      'thickness',
                      Math.abs(
                        hit.point.reduce(
                          (sum, v, i) =>
                            sum + (v - item.points[0][i]) * insulationFrame(item).normal[i],
                          0,
                        ),
                      ),
                    )
                  : grip.kind === 'radius'
                    ? blockRadiusGripValues(
                        item.parametricBlock,
                        item.parametricBlock.memberId,
                        item.points[0],
                        item.points[1],
                        hit.point,
                      )
                    : blockGripValues(
                        item.parametricBlock,
                        item.parametricBlock.memberId,
                        grip.index,
                        hit.point,
                      ),
              );
        this.preview = batch;
      },
      preview: () => editor.redrawFeedback(),
      commit: () => {
        if (batch) this.commit(batch);
      },
      cancel: () => {
        this.preview = null;
        editor.redrawFeedback();
      },
    };
    if (grip.kind === 'thickness') {
      const frame = insulationFrame(item);
      session.numeric = {
        label: 'Tjocklek · mm',
        hit: (value) => ({ point: frame.point(frame.length / 2, value) }),
      };
    } else if (grip.kind === 'radius') {
      const center = item.points[0],
        direction = grip.point.map((v, i) => v - center[i]),
        length = Math.hypot(...direction);
      session.numeric = {
        label: 'Radie · mm',
        hit: (value) => ({ point: center.map((v, i) => v + (direction[i] * value) / length) }),
      };
    }
    return session;
  }
}
