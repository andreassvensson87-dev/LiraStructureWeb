import { captureProject } from './project-state.js';
/** Snapshot history deliberately owns copies, never live references to project objects. */
export class ProjectHistory {
  constructor(limit = 100) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  checkpoint(project) {
    this.past.push(captureProject(project));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(project) {
    return this.restore(this.past, this.future, project);
  }
  redo(project) {
    return this.restore(this.future, this.past, project);
  }
  restore(from, to, project) {
    if (!from.length) return null;
    const current = captureProject(project),
      next = from.pop();
    to.push(current);
    return next;
  }
}
