import { bindInspectorField } from './inspector/field-state.js';
import { installInsulationInspector } from './drawing-insulation-inspector.js';
import { installDrawingOrder, installDrawingGeometry } from './drawing-object-inspector.js';
import {
  installShapeStyle,
  shapeToolSettings,
  applyShapeToolSettings,
} from './drawing-shape-style.js';
import { shapeNames } from './drawing-shapes.js';
import { linkedDimensions, unlinkDimensions, linkedPaperOffsets } from './dimension-links.js';
import { dimensionAxis, chainGeometry, dimensionPaperOffset } from './dimension-chain.js';
import { dimensionDirections as names } from './drawing-dimension-creation.js';

/** Presentation and property controls; session ownership stays with DrawingAnnotations. */
export function renderAnnotationInspector(
  { state, panel, hint, dialog, dynamicInput, adapter, tools, commands },
  message,
) {
  const propertyEditor = {
    panel,
    hint,
    items: state.items,
    record: state.record,
    get history() {
      return commands.history().history;
    },
    get future() {
      return commands.history().future;
    },
    adapter,
    checkpoint: commands.checkpoint,
    ui: commands.refresh,
  };
  if (tools.transform?.active()) {
    panel.parentElement.classList.add('annotation-focused');
    tools.transform.ui(message);
    tools.assistant?.cancel();
    return;
  }
  if (!state.mode && state.selectedIds?.size > 1) {
    panel.replaceChildren();
    const title = document.createElement('h3'),
      text = document.createElement('p');
    title.textContent = `${state.selectedIds.size} ritobjekt markerade`;
    text.textContent =
      'Använd Flytta, Kopiera eller Rotera i den övre menyn. Shift-klick ändrar urvalet.';
    panel.append(title, text);
    panel.parentElement.classList.add('annotation-focused');
    hint.textContent = tools.marquee?.enabled
      ? 'Dra en ruta · vänster till höger: inneslutna · höger till vänster: korsade · Shift lägger till · Esc avslutar'
      : 'Shift-klick för flerval · Esc avmarkerar';
    return;
  }
  if (tools.richText && (state.mode === 'richtext' || state.item?.type === 'richtext')) {
    tools.richText.ui();
    return;
  }
  panel.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = 'Anteckningar';
  panel.append(title);
  const item = state.item;
  const shapeTool = state.workflow === 'shape' && shapeNames[state.mode];
  panel.parentElement.classList.toggle('annotation-focused', !!item || !!shapeTool);
  if (shapeTool && state.record) {
    title.textContent = `${shapeTool} · verktyg`;
    const info = document.createElement('p');
    info.textContent = 'Inställningar för nästa objekt';
    panel.append(info);
    const settings = shapeToolSettings(state.record, state.mode);
    const toolEditor = {
      panel: panel,
      record: state.record,
      history: state.history,
      future: state.future,
      checkpoint() {},
      ui: () => commands.refresh(),
      adapter: {
        redraw: () => {
          if (state.draft?.type === 'shape') applyShapeToolSettings(state.draft, settings);
          adapter.redraw();
        },
      },
    };
    installInsulationInspector(toolEditor, settings);
    installShapeStyle(toolEditor, settings);
  }
  const button = (text, fn, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.disabled = disabled;
    b.onclick = fn;
    panel.append(b);
    return b;
  };
  if (item) {
    const status = document.createElement('p');
    status.className = 'annotation-reference-status';
    status.setAttribute('role', 'status');
    if (item.type !== 'shape') {
      panel.append(status);
      renderAnnotationReferenceStatus(panel, item);
    }
    title.textContent =
      item.type === 'shape'
        ? shapeNames[item.shape]
        : item.type === 'dimension'
          ? item.points.length > 2
            ? 'Måttkedja'
            : 'Mått'
          : item.manual
            ? 'Leader'
            : 'Part mark';
    const field = (labelText, key, type, value) => {
      const label = document.createElement('label'),
        input = document.createElement('input');
      label.textContent = labelText;
      input.type = type;
      input.value = value;
      if (type === 'number') {
        input.min = 0.5;
        input.max = 20;
        input.step = 0.5;
      } else {
        input.maxLength = 120;
        input.placeholder = 'Valfri kommentar';
      }
      let recorded = false;
      input.onfocus = () => (recorded = false);
      input.oninput = () => {
        const value = type === 'number' ? Number(input.value) : input.value;
        if (
          type === 'number' &&
          (!input.value.trim() || !Number.isFinite(value) || value < 0.5 || value > 20)
        ) {
          input.setCustomValidity('Ange en textstorlek mellan 0,5 och 20.');
          return;
        }
        input.setCustomValidity('');
        if (!recorded) {
          commands.checkpoint();
          recorded = true;
        }
        for (const member of linkedDimensions(state.items, item)) member[key] = value;
        for (const b of panel.querySelectorAll('.annotation-history button'))
          b.disabled =
            b.textContent === 'Ångra'
              ? !commands.history().history.length
              : !commands.history().future.length;
        adapter.redraw();
      };
      input.onblur = () => {
        if (!input.checkValidity()) {
          input.value = item[key] ?? value;
          input.setCustomValidity('');
        }
      };
      bindInspectorField(input, () => item[key] ?? value);
      label.append(input);
      panel.append(label);
    };
    if (item.type !== 'shape') {
      field('Kommentar', 'comment', 'text', item.comment || '');
      field(
        'Textstorlek · mm',
        'textSize',
        'number',
        item.textSize ??
          state.record?.drawingPreset?.[item.type === 'leader' ? 'leaderSize' : 'dimensionSize'] ??
          2.5,
      );
    }
    if (item.type === 'shape') {
      installDrawingGeometry(propertyEditor, item);
      installShapeStyle(propertyEditor, item);
    }
    installDrawingOrder(propertyEditor, item);
    if (item.type === 'dimension') {
      const linked = linkedDimensions(state.items, item);
      if (linked.length > 1) {
        const info = document.createElement('p');
        info.textContent = `${linked.length} länkade mått · flytt och måttstil ändras tillsammans`;
        panel.append(info);
        button('Bryt länk', () => {
          commands.checkpoint();
          unlinkDimensions(state.items, item);
          commands.refresh();
          adapter.redraw();
        });
      }
      const choice = (title, options, value, change) => {
        const label = document.createElement('label'),
          select = document.createElement('select');
        label.textContent = title;
        select.append(...options.map(([v, name]) => new Option(name, v)));
        select.value = String(value);
        select.onchange = () => change(select.value);
        label.append(select);
        panel.append(label);
        return select;
      };
      const direction = choice('Riktning', Object.entries(names), item.kind, (kind) => {
        try {
          const next = { ...item, kind, axis: dimensionAxis(kind, item.points) };
          if (chainGeometry(next).points.length < 2)
            throw Error('Punkterna ger inget mått i vald riktning.');
          commands.checkpoint();
          item.kind = kind;
          item.axis = next.axis;
          commands.refresh();
          adapter.redraw();
        } catch (error) {
          direction.value = item.kind;
          hint.textContent = error.message;
        }
      });
      choice(
        'Decimaler',
        [['auto', 'Automatiskt'], ...[0, 1, 2, 3].map((n) => [String(n), String(n)])],
        item.precision ?? 'auto',
        (value) => {
          commands.checkpoint();
          for (const member of linkedDimensions(state.items, item)) {
            if (value === 'auto') delete member.precision;
            else member.precision = +value;
          }
          adapter.redraw();
        },
      );
      const label = document.createElement('label'),
        offset = document.createElement('input');
      label.textContent = 'Avstånd · mm';
      offset.type = 'number';
      offset.min = -500;
      offset.max = 500;
      offset.step = 1;
      const project = (p) => adapter.project(p, item.view);
      offset.value = Number(dimensionPaperOffset(item, project, adapter.unit()).value.toFixed(2));
      offset.onchange = () => {
        try {
          if (!offset.value.trim()) throw Error('Ange ett avstånd.');
          const changes = linkedPaperOffsets(
            state.items,
            item,
            +offset.value,
            project,
            adapter.unit(),
          );
          commands.checkpoint();
          for (const { member, line } of changes) member.line = line;
          adapter.redraw();
        } catch (error) {
          hint.textContent = error.message;
          offset.value = Number(
            dimensionPaperOffset(item, project, adapter.unit()).value.toFixed(2),
          );
        }
      };
      bindInspectorField(offset, () =>
        Number(dimensionPaperOffset(item, project, adapter.unit()).value.toFixed(2)),
      );
      label.append(offset);
      panel.append(label);
      button('Lägg till måttpunkt', () => commands.addDimensionPoint());
      const details = document.createElement('details');
      details.className = 'annotation-point-details';
      const summary = document.createElement('summary');
      summary.textContent = `Måttpunkter (${item.points.length})`;
      details.append(summary);
      const list = document.createElement('div');
      list.className = 'annotation-points';
      for (const p of chainGeometry(item).points) {
        const row = document.createElement('div'),
          text = document.createElement('span'),
          remove = document.createElement('button');
        text.textContent = `${Math.round(p.point[0])}, ${Math.round(p.point[1])}`;
        remove.textContent = '×';
        remove.title = 'Ta bort måttpunkt';
        remove.setAttribute('aria-label', `Ta bort måttpunkt ${p.index + 1}`);
        remove.disabled = item.points.length <= 2;
        remove.onclick = () => {
          commands.checkpoint();
          item.points.splice(p.index, 1);
          item.references?.splice(p.index, 1);
          commands.refresh();
          panel.querySelector('details').open = true;
          adapter.redraw();
        };
        row.append(text, remove);
        list.append(row);
      }
      details.append(list);
      panel.append(details);
    }
    const remove = button('Ta bort', () => {
      commands.checkpoint();
      state.items.splice(state.items.indexOf(item), 1);
      commands.clearSelection();
      commands.cancel();
    });
    remove.className = 'annotation-delete';
  }

  if (state.mode) {
    if (state.mode === 'circle' && state.draft) {
      const label = document.createElement('label'),
        radius = document.createElement('input');
      label.textContent = 'Radie · mm i vyn';
      radius.type = 'number';
      radius.min = '0.001';
      radius.step = 'any';
      radius.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        const value = Number(radius.value);
        if (!(value > 0) || !Number.isFinite(value)) {
          radius.setCustomValidity('Ange en positiv radie.');
          radius.reportValidity();
          return;
        }
        const p = state.draft.points[0];
        state.draft.points.push([p[0] + value, p[1]]);
        commands.finishShape();
      };
      radius.oninput = () => radius.setCustomValidity('');
      label.append(radius);
      panel.append(label);
    }
    if (state.draft?.type === 'shape' && ['polyline', 'polygon'].includes(state.draft.shape)) {
      button(
        state.mode === 'polygon' ? 'Stäng polygon ↵' : 'Avsluta polylinje ↵',
        () => commands.finishShape(),
        state.draft.points.length < (state.mode === 'polygon' ? 3 : 2),
      );
      if (state.mode === 'polyline')
        button(
          'Stäng polylinje · C',
          () => commands.finishShape(true),
          state.draft.points.length < 3,
        );
    }
    if (state.draft?.type === 'dimension' && state.phase === 'points')
      button('Placera måttlinje ↵', () => commands.finishPoints(), state.draft.points.length < 2);
    button('Avbryt · Esc', () => commands.cancel());
  }
  const undo = document.createElement('div');
  undo.className = 'annotation-history';
  for (const [text, redo, disabled] of [
    ['Ångra', false, !state.history.length],
    ['Gör om', true, !state.future.length],
  ]) {
    const b = document.createElement('button');
    b.textContent = text;
    b.disabled = disabled;
    b.onclick = () => commands.undo(redo);
    undo.append(b);
  }
  panel.append(undo);
  for (const b of dialog.querySelectorAll('[data-drawing-history]'))
    b.disabled = !(b.dataset.drawingHistory === 'redo' ? state.future : state.history).length;
  const instructions =
    state.workflow === 'shape' && state.mode
      ? state.mode === 'circle'
        ? state.draft
          ? 'Välj radiepunkt eller ange radie vid pekaren · Esc avbryter.'
          : 'Välj cirkelns centrum.'
        : state.mode === 'arc'
          ? ['Välj bågens startpunkt.', 'Välj en punkt på bågen.', 'Välj bågens slutpunkt.'][
              state.draft?.points.length || 0
            ]
          : state.mode === 'rectangle'
            ? state.draft
              ? 'Välj motsatt hörn.'
              : 'Välj rektangelns första hörn.'
            : state.mode === 'insulation'
              ? state.draft
                ? 'Välj isoleringens slutpunkt · ange tjocklek i inspektorn.'
                : 'Välj isoleringens startpunkt.'
              : ['polyline', 'polygon'].includes(state.mode)
                ? 'Välj hörnpunkter · klicka första punkten eller C för att stänga · Enter/skrollklick avslutar · Esc avbryter.'
                : state.draft
                  ? 'Välj linjens slutpunkt.'
                  : 'Välj linjens startpunkt.'
      : state.mode === 'leader'
        ? state.draft
          ? 'Klicka för att placera texten.'
          : adapter.manualLeaders
            ? 'Klicka för att placera hänvisningens fästpunkt.'
            : 'Klicka på en numrerad detalj.'
        : state.mode === 'add'
          ? 'Klicka på en ny måttpunkt. Esc avslutar.'
          : state.mode === 'place-existing'
            ? 'Klicka för att placera om.'
            : state.mode
              ? state.phase === 'place'
                ? 'Klicka för att placera måttlinjen.'
                : state.workflow === 'holes'
                  ? 'Klicka på ett hålcentrum.'
                  : state.workflow === 'point'
                    ? state.draft
                      ? 'Välj andra måttpunkten.'
                      : 'Välj första måttpunkten.'
                    : `Välj måttpunkter · Enter/skrollklick placerar kedjan · Esc avbryter`
              : '';
  hint.textContent =
    message ||
    (tools.marquee?.enabled
      ? 'Dra en ruta · vänster till höger: inneslutna · höger till vänster: korsade · Shift lägger till · Esc avslutar'
      : instructions) ||
    '';
  hint.title = hint.textContent;
  if (dynamicInput) {
    dynamicInput.querySelector('.ui-exact-length-label span').textContent =
      state.mode === 'circle' ? 'Radie · mm' : 'Längd · mm';
    dynamicInput.hidden = !(
      state.workflow === 'shape' &&
      state.draft?.points.length &&
      ['line', 'polyline', 'polygon', 'circle', 'insulation'].includes(state.mode) &&
      !state.drag
    );
  }
  tools.assistant?.ui();
}

export function renderAnnotationReferenceStatus(panel, item, broken = []) {
  const status = panel.querySelector('.annotation-reference-status');
  if (!status) return;
  const linked = item.references?.filter(Boolean).length || 0;
  status.textContent = broken.length
    ? `${broken.length} bruten koppling – flytta fästpunkten till en ny snappunkt.`
    : `${linked} av ${item.points.length} punkter kopplade till modellen`;
  status.classList.toggle('broken', broken.length > 0);
}
