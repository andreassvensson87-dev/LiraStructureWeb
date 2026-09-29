import { installDrawingPan } from './drawing-pan.js';
import { pasteboardSize } from './drawing-pasteboard.js';
import { actionButton } from './drawing-toolbar.js';

export function drawingEditorShell({ dialog, body, toolbar, tools, cancel }) {
  dialog.classList.add('drawing-editor');
  const back = dialog.querySelector('header button');
  back.textContent = 'Till modellen';
  back.onclick = () => {
    dialog.close();
    const manager = document.querySelector('#drawing-manager');
    if (manager?.open) manager.close();
  };
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    cancel();
  });
  dialog.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  });
  const nav = document.createElement('nav');
  nav.className = 'sheet-tools drawing-commandbar';
  nav.setAttribute('aria-label', 'Ritningsverktyg');
  const select = actionButton(document.createElement('button'), 'select', 'Markera');
  select.onclick = cancel;
  nav.append(select, ...tools);
  body.prepend(nav);
}

export class DrawingWorkspace {
  constructor({
    workspace,
    stage,
    paper,
    getPaper,
    getBounds,
    blocked = () => false,
    onScale = () => {},
  }) {
    Object.assign(this, { workspace, stage, paper, getPaper, getBounds, blocked, onScale });
    this.scale = 1;
    this.pan = installDrawingPan(workspace, { blocked });
    workspace.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (blocked() || this.pan.active) return;
        const r = paper.getBoundingClientRect(),
          x = (e.clientX - r.left) / this.scale,
          y = (e.clientY - r.top) / this.scale;
        this.scale = Math.max(
          0.001,
          Math.min(32, this.scale * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.03 : 0.002))),
        );
        this.size();
        const next = paper.getBoundingClientRect();
        workspace.scrollLeft += next.left + x * this.scale - e.clientX;
        workspace.scrollTop += next.top + y * this.scale - e.clientY;
      },
      { capture: true, passive: false },
    );
    workspace.closest('dialog')?.addEventListener('close', () => this.pan.cancel());
  }
  size() {
    const previous = this.position,
      p = this.getPaper(),
      b = this.getBounds() || [0, 0, ...p],
      s = pasteboardSize(p, b, this.scale, [
        this.workspace.clientWidth,
        this.workspace.clientHeight,
      ]);
    this.stage.style.width = s.width + 'px';
    this.stage.style.height = s.height + 'px';
    Object.assign(this.paper.style, {
      width: s.paperWidth + 'px',
      height: s.paperHeight + 'px',
      left: s.x + 'px',
      top: s.y + 'px',
    });
    this.position = [s.x, s.y];
    if (previous) {
      this.workspace.scrollLeft += s.x - previous[0];
      this.workspace.scrollTop += s.y - previous[1];
    }
    this.onScale(this.scale);
  }
  fit(all = false) {
    const p = this.getPaper(),
      b = all ? this.getBounds() || [0, 0, ...p] : [0, 0, ...p];
    this.scale = Math.max(
      0.001,
      Math.min(
        (this.workspace.clientWidth - 60) / (b[2] - b[0]),
        (this.workspace.clientHeight - 60) / (b[3] - b[1]),
      ),
    );
    this.size();
    this.workspace.scrollLeft =
      this.position[0] + ((b[0] + b[2]) / 2) * this.scale - this.workspace.clientWidth / 2;
    this.workspace.scrollTop =
      this.position[1] + ((b[1] + b[3]) / 2) * this.scale - this.workspace.clientHeight / 2;
  }
}
