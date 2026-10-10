import { parseProjectFile, serializeProject } from '../project/project-file.js';

/** Drafts belong to a tab; a newly opened app can resume the most recent draft. */
export class ProjectDraftStore {
  async database() {
    this.db ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('lirastructure-projects', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('drafts');
        request.result.createObjectStore('meta');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(Error('Lokal projektsparning kunde inte öppnas.'));
    });
    return this.db;
  }
  async read(id, sourceId = id) {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['drafts', 'meta']);
      const drafts = tx.objectStore('drafts');
      const own = drafts.get(id);
      own.onsuccess = () => {
        if (own.result) {
          resolve(own.result);
          return;
        }
        const inherited = drafts.get(sourceId);
        inherited.onsuccess = () => {
          if (inherited.result) {
            resolve(inherited.result);
            return;
          }
          const last = tx.objectStore('meta').get('latest');
          last.onsuccess = () => {
            if (!last.result) {
              resolve(null);
              return;
            }
            const request = drafts.get(last.result);
            request.onsuccess = () => resolve(request.result || null);
          };
        };
      };
      tx.onabort = tx.onerror = () => reject(Error('Det autosparade projektet kunde inte läsas.'));
    });
  }
  async write(id, record) {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['drafts', 'meta'], 'readwrite');
      tx.objectStore('drafts').put(record, id);
      tx.objectStore('meta').put(id, 'latest');
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(Error('Autosparningen misslyckades. Spara projektet via Arkiv.'));
    });
  }
}
export class ProjectRecovery {
  constructor({ store = new ProjectDraftStore(), id = crypto.randomUUID(), sourceId = id } = {}) {
    this.store = store;
    this.id = id;
    this.sourceId = sourceId;
    this.lastText = null;
    this.blocked = null;
  }
  async load() {
    try {
      const record = await this.store.read(this.id, this.sourceId);
      if (!record) return null;
      let project;
      let text = record.text;
      let backup = false;
      try {
        project = parseProjectFile(text);
      } catch {
        text = record.previous;
        project = parseProjectFile(text);
        backup = true;
      }
      // Pin the recovered draft to this tab before another tab changes the latest pointer.
      try {
        await this.store.write(this.id, {
          text,
          previous: backup ? text : record.previous,
          savedAt: record.savedAt,
        });
      } catch (error) {
        this.blocked = Error(
          `Projektet återställdes, men lokal sparning misslyckades: ${error.message}`,
        );
      }
      this.lastText = text;
      return { project, backup, savedAt: record.savedAt, warning: this.blocked?.message };
    } catch (error) {
      this.blocked = Error(
        `Återställning misslyckades: ${error.message} Den lagrade kopian har behållits.`,
      );
      throw this.blocked;
    }
  }
  async save(project) {
    if (this.blocked) throw this.blocked;
    const text = serializeProject(project);
    if (text === this.lastText) return;
    await this.store.write(this.id, { text, previous: this.lastText, savedAt: Date.now() });
    this.lastText = text;
  }
  acceptNewProject() {
    this.blocked = null;
  }
}

/** Serialize writes, coalesce bursts, and drain the final state before an app update. */
export class ProjectAutosave {
  constructor({ recovery, getProject, status = () => {}, delay = 500 }) {
    Object.assign(this, { recovery, getProject, status, delay });
    this.dirty = false;
    this.saving = null;
    this.timer = null;
  }
  schedule() {
    this.dirty = true;
    this.status(this.recovery.blocked?.message || 'Sparar lokalt…', !!this.recovery.blocked);
    if (this.timer != null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch(() => {});
    }, this.delay);
  }
  flush() {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
    this.dirty = true;
    if (this.saving) return this.saving;
    this.saving = (async () => {
      try {
        while (this.dirty) {
          this.dirty = false;
          await this.recovery.save(this.getProject());
        }
        this.status('Sparat lokalt', false);
      } catch (error) {
        this.dirty = true;
        this.status(error.message, true);
        throw error;
      } finally {
        this.saving = null;
      }
    })();
    return this.saving;
  }
}

export async function projectSession() {
  let id;
  try {
    id = sessionStorage.getItem('lirastructure-project-session');
  } catch {
    /* Use latest recovery when session storage is unavailable. */
  }
  id ||= crypto.randomUUID();
  const sourceId = id;
  // A duplicated browser tab inherits sessionStorage: fork its draft if the owner is still open.
  if (navigator.locks) {
    const candidate = id;
    await new Promise((resolve) => {
      navigator.locks
        .request(`lirastructure-project:${candidate}`, { ifAvailable: true }, (lock) => {
          if (!lock) {
            id = crypto.randomUUID();
            resolve();
            return;
          }
          resolve();
          return new Promise(() => {});
        })
        .catch(() => resolve());
    });
  }
  try {
    sessionStorage.setItem('lirastructure-project-session', id);
  } catch {
    /* The draft still persists in IndexedDB. */
  }
  return { id, sourceId };
}
