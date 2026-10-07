import { dimensionAxis, orderedPoints } from './dimension-chain.js';
import { actionButton } from './drawing-toolbar.js';

export function assistantDimensions({ candidates, sources, type, direction, line, view }) {
  const selected = candidates.filter((p) => sources.includes(p.reference?.source));
  const corners = selected.filter((p) => p.reference?.kind !== 'bore');
  const bounds = [0, 1].map((axis) => [
    Math.min(...selected.map((p) => p[axis])),
    Math.max(...selected.map((p) => p[axis])),
  ]);
  const kinds =
    direction === 'auto'
      ? [
          ...(line[1] < bounds[1][0] || line[1] > bounds[1][1] ? ['horizontal'] : []),
          ...(line[0] < bounds[0][0] || line[0] > bounds[0][1] ? ['vertical'] : []),
        ]
      : [direction];
  if (!kinds.length) throw Error('Klicka utanför de valda detaljerna för att placera måtten.');
  const result = [];
  for (const kind of kinds) {
    const axis = dimensionAxis(kind),
      points = [];
    const ends = (list) => {
      const sorted = orderedPoints(list, axis);
      if (sorted.length) points.push(sorted[0].point, sorted.at(-1).point);
    };
    if (type === 'holes') points.push(...selected.filter((p) => p.reference?.kind === 'bore'));
    else if (type === 'main') ends(corners);
    else for (const source of sources) ends(corners.filter((p) => p.reference.source === source));
    const ordered = orderedPoints(points, axis).map((p) => p.point);
    if (ordered.length < 2) continue;
    result.push({
      id: crypto.randomUUID(),
      type: 'dimension',
      kind,
      axis,
      view,
      points: ordered.map((p) => [...p]),
      references: ordered.map((p) => structuredClone(p.reference)),
      line: [...line],
    });
  }
  if (!result.length)
    throw Error(
      type === 'holes'
        ? 'Valda detaljer behöver minst två synliga hålcentrum i måttriktningen.'
        : 'Valda detaljer ger inget mått i riktningen.',
    );
  return result;
}

export class DrawingDimensionAssistant {
  constructor(annotations, toolbar) {
    this.editor = annotations;
    const button = actionButton(document.createElement('button'), 'dimension', 'Assistent');
    button.dataset.drawingGroup = 'measure';
    button.dataset.drawingCategory = 'Automatisk måttsättning';
    button.dataset.annotationMode = 'assistant';
    button.onclick = () => this.start();
    toolbar.append(button);
    annotations.toolButtons.push(button);
    this.menu = document.createElement('section');
    this.menu.className = 'dimension-assistant';
    this.menu.setAttribute('aria-label', 'Måttassistent');
    this.menu.hidden = true;
    annotations.dialog.querySelector('.drawing-body').append(this.menu);
  }
  start() {
    this.type = 'main';
    this.direction = 'auto';
    this.sources = [];
    this.proposals = [];
    this.phase = 'select';
    this.view = null;
    this.editor.start('assistant');
    this.ui();
  }
  cancel() {
    this.menu.hidden = true;
    this.proposals = [];
  }
  ui(message) {
    if (this.editor.mode !== 'assistant') {
      this.menu.hidden = true;
      return;
    }
    this.menu.hidden = false;
    this.menu.replaceChildren();
    const row = document.createElement('div');
    row.className = 'assistant-actions';
    const button = (label, action, disabled = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.disabled = disabled;
      b.onclick = action;
      row.append(b);
      return b;
    };
    for (const [value, label] of [
      ['main', 'Huvudmått'],
      ['parts', 'Delmått'],
      ['holes', 'Hålmått'],
    ]) {
      const choice = button(label, () => {
        this.type = value;
        this.phase = 'select';
        this.proposals = [];
        this.ui();
        this.editor.adapter.redraw();
      });
      choice.setAttribute('aria-pressed', String(this.type === value));
    }
    const close = button('×', () => this.editor.cancel());
    close.setAttribute('aria-label', 'Stäng måttassistent');
    close.title = 'Avbryt · Esc';
    this.menu.append(row);
    const instruction =
      message ||
      (this.phase === 'select'
        ? this.sources.length
          ? `${this.sources.length} valda · välj fler detaljer eller klicka utanför för att skapa mått · hörnklick ger två sidor`
          : 'Välj detaljer och klicka sedan där måtten ska placeras'
        : 'Klicka vänster, ovan, höger eller under för att skapa mått · hörnklick ger två sidor');
    this.editor.hint.textContent = instruction + ' · Esc avbryter';
  }
  down(e) {
    const a = this.editor,
      hit = a.location(e, this.view, this.phase === 'select');
    if (!hit) return;
    if (this.view && hit.view !== this.view) {
      this.ui('Välj detaljer i samma ritningsvy.');
      return;
    }
    const selected = a.adapter
      .candidates(hit.view)
      .filter((p) => this.sources.includes(p.reference?.source));
    const outsideSelection =
      selected.length &&
      [0, 1].some(
        (axis) =>
          hit.point[axis] < Math.min(...selected.map((p) => p[axis])) ||
          hit.point[axis] > Math.max(...selected.map((p) => p[axis])),
      );
    const picked = this.phase === 'select' ? a.adapter.pick(e, hit) : null;
    const id = (picked && (a.adapter.referenceSource?.(picked) || picked)) || hit.reference?.source;
    if (this.phase === 'select' && (!outsideSelection || (id && !this.sources.includes(id)))) {
      if (id && a.adapter.candidates(hit.view).some((p) => p.reference?.source === id)) {
        this.view = hit.view;
        this.sources = this.sources.includes(id)
          ? this.sources.filter((s) => s !== id)
          : [...this.sources, id];
        if (!this.sources.length) this.view = null;
        this.ui();
        a.adapter.redraw();
        return;
      }
      if (!this.sources.length) {
        this.ui('Klicka på en synlig detalj i ritningsvyn.');
        return;
      }
    }
    try {
      this.proposals = assistantDimensions({
        candidates: a.adapter.candidates(this.view),
        sources: this.sources,
        type: this.type,
        direction: this.direction,
        line: hit.point,
        view: this.view,
      });
      this.commit();
    } catch (error) {
      this.ui(error.message);
    }
    a.adapter.redraw();
  }
  render(root) {
    if (this.editor.mode !== 'assistant') return;
    if (this.phase === 'select')
      for (const p of this.editor.adapter
        .candidates(this.view)
        .filter((p) => this.sources.includes(p.reference?.source)))
        this.editor.dot(root, p, this.view);
    for (const p of this.proposals) if (!p.excluded) this.editor.paint(root, p, true);
  }
  commit() {
    const selected = this.proposals.filter((p) => !p.excluded);
    if (!selected.length) return;
    this.editor.checkpoint();
    const linkId = selected.length > 1 ? crypto.randomUUID() : undefined;
    for (const p of selected) {
      const item = structuredClone(p);
      delete item.excluded;
      if (linkId) item.dimensionLinkId = linkId;
      this.editor.items.push(item);
    }
    this.sources = [];
    this.view = null;
    this.phase = 'select';
    this.proposals = [];
    this.editor.ui();
  }
}
