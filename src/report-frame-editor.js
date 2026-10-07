import {
  REPORT_VIEWPORT_ID,
  reportViewportGrips,
  editReportViewport,
} from './report-viewport-grips.js';
import { validateReportViewport } from './report-layout.js';
export function installReportLayoutControls(editor) {
  const section = document.createElement('section');
  section.className = 'fe-report-settings';
  section.innerHTML =
    '<h3>Layoutens användning</h3><label>Gäller för<select data-report-usage><option value="drawing">Ritningar</option><option value="report">Rapporter</option><option value="both">Ritningar och rapporter</option></select></label><h3>Rapportyta</h3><p>Tabellen fortsätter automatiskt på nästa sida. Y mäts från bladets överkant.</p><button type="button" data-report-place>Rita rapportyta · två hörn</button><div class="fe-pair"><label>X · mm<input data-report="x" type="number" step="any"></label><label>Y · mm<input data-report="y" type="number" step="any"></label><label>Bredd · mm<input data-report="width" type="number" min="30" step="any"></label><label>Höjd · mm<input data-report="height" type="number" min="30" step="any"></label></div><label class="fe-check"><input type="checkbox" data-report-fill>Kolumnlinjer till nederkanten</label><button type="button" data-report-apply>Tillämpa rapportyta</button><button type="button" data-report-remove>Ta bort rapportyta</button>';
  const usage = document.createElement('section');
  usage.className = 'fe-report-usage';
  usage.append(...[...section.children].slice(0, 2));
  editor.dialog.querySelector('.fe-paper').prepend(usage);
  editor.dialog.querySelector('aside').prepend(section);
  usage.querySelector('[data-report-usage]').onchange = (event) => {
    editor.checkpoint();
    editor.frame.usage = event.target.value;
    editor.sync();
  };
  section.querySelector('[data-report-place]').onclick = () => editor.setTool('report-area');
  section.querySelector('[data-report-remove]').onclick = () => {
    editor.checkpoint();
    delete editor.frame.reportViewport;
    editor.selected.delete(REPORT_VIEWPORT_ID);
    editor.sync();
  };
  section.querySelector('[data-report-apply]').onclick = () => {
    try {
      const area = Object.fromEntries(
        [...section.querySelectorAll('[data-report]')].map((input) => [
          input.dataset.report,
          input.value.trim() ? Number(input.value) : NaN,
        ]),
      );
      validateReportViewport({ ...editor.frame, reportViewport: area });
      editor.checkpoint();
      editor.frame.reportViewport = {
        ...editor.frame.reportViewport,
        ...area,
        fillViewport: section.querySelector('[data-report-fill]').checked,
      };
      editor.selected = new Set([REPORT_VIEWPORT_ID]);
      if (!editor.frame.usage || editor.frame.usage === 'drawing') editor.frame.usage = 'both';
      editor.sync();
    } catch (error) {
      editor.status(error.message);
    }
  };
  return {
    selection(active) {
      section.hidden = editor.mode !== 'layout' || !active;
    },
    sync() {
      usage.hidden = editor.mode !== 'layout';
      section.hidden =
        editor.mode !== 'layout' ||
        !(editor.selected.has(REPORT_VIEWPORT_ID) || editor.tool === 'report-area');
      usage.querySelector('[data-report-usage]').value = editor.frame.usage || 'drawing';
      const area = editor.frame.reportViewport || {
        x: 15,
        y: 25,
        width: Math.max(30, editor.frame.width - 30),
        height: Math.max(30, editor.frame.height - 50),
      };
      section.querySelector('[data-report-fill]').checked = area.fillViewport ?? true;
      for (const input of section.querySelectorAll('[data-report]'))
        input.value = area[input.dataset.report];
      section.querySelector('[data-report-remove]').disabled = !editor.frame.reportViewport;
    },
  };
}
export function paintReportViewport(editor) {
  if (editor.mode !== 'layout') return;
  let area = editor.frame.reportViewport;
  if (editor.tool === 'report-area' && editor.pending.length && editor.cursor) {
    const a = editor.pending[0],
      b = editor.cursor;
    area = {
      x: Math.min(a[0], b[0]),
      y: editor.frame.height - Math.max(a[1], b[1]),
      width: Math.abs(a[0] - b[0]),
      height: Math.abs(a[1] - b[1]),
    };
  }
  if (!area) return;
  if (
    editor.base &&
    editor.cursor &&
    editor.selected.has(REPORT_VIEWPORT_ID) &&
    editor.tool === 'move'
  ) {
    try {
      area = editReportViewport(editor.frame, editor.base, editor.cursor, editor.reportGrip ?? -1);
    } catch {
      /* Keep the last valid area visible until the cursor returns to the sheet. */
    }
  }
  const selected = editor.selected.has(REPORT_VIEWPORT_ID);
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('data-entity', REPORT_VIEWPORT_ID);

  const NS = 'http://www.w3.org/2000/svg';
  const rect = document.createElementNS(NS, 'rect');
  for (const [key, value] of Object.entries({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    fill: '#e5f0ff55',
    stroke: selected ? '#178268' : '#5788b9',
    'stroke-width': 0.3,
    'stroke-dasharray': '3 2',
    'pointer-events': editor.tool === 'select' ? 'all' : 'none',
  }))
    rect.setAttribute(key, value);
  const label = document.createElementNS(NS, 'text');
  label.setAttribute('x', area.x + 3);
  label.setAttribute('y', area.y + 6);
  label.setAttribute('font-size', '3.5');
  label.setAttribute('fill', '#416c97');
  label.textContent = 'Rapportyta · automatisk fortsättning';
  label.setAttribute('pointer-events', 'none');
  group.append(rect, label);
  editor.svg.append(group);
  if (selected && editor.tool === 'select') {
    const radius = (editor.view[2] / Math.max(editor.svg.clientWidth, 1)) * 4;
    for (const { point, index } of reportViewportGrips(editor.frame)) {
      const grip = document.createElementNS(NS, 'g');
      for (const [key, value] of Object.entries({
        'data-grip': REPORT_VIEWPORT_ID,
        'data-index': index,
        role: 'button',
        tabindex: 0,
        'aria-label': index === -1 ? 'Flytta rapportyta' : `Ändra rapportyta · grepp ${index + 1}`,
        class: 'fe-object-grip',
      }))
        grip.setAttribute(key, value);
      const x = point[0],
        y = editor.frame.height - point[1];
      const hit = document.createElementNS(NS, 'circle');
      for (const [key, value] of Object.entries({
        cx: x,
        cy: y,
        r: radius * 2.2,
        fill: 'transparent',
      }))
        hit.setAttribute(key, value);
      const handle = document.createElementNS(NS, 'rect');
      for (const [key, value] of Object.entries({
        x: x - radius,
        y: y - radius,
        width: radius * 2,
        height: radius * 2,
        fill: index === -1 ? '#d4eeff' : 'white',
        stroke: '#178268',
        'stroke-width': radius * 0.35,
      }))
        handle.setAttribute(key, value);
      grip.append(hit, handle);
      grip.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          editor.startGrip(REPORT_VIEWPORT_ID, index);
        }
      };
      editor.svg.append(grip);
    }
  }
}
