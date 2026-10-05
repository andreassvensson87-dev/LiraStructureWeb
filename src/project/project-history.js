import { ProjectSnapshots } from './project-snapshots.js';
/** Snapshot history deliberately owns copies, never live references to project objects. */
export class ProjectHistory {
  constructor(limit = 100) {
    this.limit = limit;
    this.past = [];
    this.future = [];
    this.snapshots = new ProjectSnapshots();
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  prime(project) {
    // Prepare owned copies during full model loading rather than the first edit.
    this.snapshots.capture(project);
  }
  checkpoint(project) {
    this.past.push(this.snapshots.capture(project));
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
    const current = this.snapshots.capture(project),
      next = from.pop();
    to.push(current);
    return this.snapshots.restore(next, project);
  }
}
