import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createProject } from '../src/project/project-state.js';
import { defaultGrid } from '../src/grid-lines.js';
import { initialLevels } from '../src/levels.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { ProjectRecovery, ProjectAutosave } from '../src/app/project-recovery.js';
import { placeItem } from '../src/items/geometry.js';
const create = () => createProject({ grid: defaultGrid, levels: initialLevels() });
class MemoryStore {
  constructor() {
    this.records = new Map();
    this.writes = 0;
    this.latest = null;
  }
  async read(id, sourceId = id) {
    return structuredClone(
      this.records.get(id) || this.records.get(sourceId) || this.records.get(this.latest) || null,
    );
  }
  async write(id, record) {
    this.records.set(id, structuredClone(record));
    this.latest = id;
    this.writes++;
  }
}
test('local recovery restores a complete project and embedded item geometry after restart', async () => {
  const store = new MemoryStore(),
    recovery = new ProjectRecovery({ store, id: 'tab' });
  const p = create();
  const box = new THREE.BoxGeometry(20, 30, 100);
  const definition = {
    id: 'shape',
    revision: 1,
    name: 'Stolpe',
    article: '123',
    supplier: 'Weland',
    sourceName: 'post.step',
    geometryId: 'post-mesh',
    start: [0, 0, -50],
    end: [0, 0, 50],
    snap: 'anchors',
    mesh: {
      positions: Array.from(box.attributes.position.array),
      normals: Array.from(box.attributes.normal.array),
      indices: Array.from(box.index.array),
    },
  };
  p.objects.push({
    ...placeItem(definition, [100, 200, 300], [100, 200, 400]),
    id: 'post',
    name: 'Stolpe',
  });
  p.info.name = 'Pågående projekt';
  p.snap.polar = '30';
  await recovery.save(p);
  const loaded = await new ProjectRecovery({ store, id: 'tab' }).load();
  assert.deepEqual(loaded.project, parseProjectFile(serializeProject(p)));
  assert.equal(loaded.project.objects[0].item.supplier, 'Weland');
  assert.equal(loaded.backup, false);
  box.dispose();
});
test('tab drafts remain independent; a new app resumes latest while a duplicated tab forks its source', async () => {
  const store = new MemoryStore(),
    p = create();
  p.info.name = 'A';
  await new ProjectRecovery({ store, id: 'a' }).save(p);
  p.info.name = 'B';
  await new ProjectRecovery({ store, id: 'b' }).save(p);
  assert.equal((await new ProjectRecovery({ store, id: 'a' }).load()).project.info.name, 'A');
  // Most recently opened A is now the latest draft; preserve each tab independently.
  assert.equal((await new ProjectRecovery({ store, id: 'b' }).load()).project.info.name, 'B');
  assert.equal((await new ProjectRecovery({ store, id: 'c' }).load()).project.info.name, 'B');
  assert.equal(
    (await new ProjectRecovery({ store, id: 'copy', sourceId: 'a' }).load()).project.info.name,
    'A',
  );
});
test('invalid primary restores previous valid data, and invalid backups never get overwritten by an empty model', async () => {
  const store = new MemoryStore(),
    p = create();
  p.info.name = 'Säkerhetskopia';
  store.records.set('a', { text: 'broken', previous: serializeProject(p) });
  const restored = await new ProjectRecovery({ store, id: 'a' }).load();
  assert.equal(restored.backup, true);
  assert.equal(restored.project.info.name, 'Säkerhetskopia');
  store.records.set('bad', { text: 'broken', previous: 'also broken' });
  const blocked = new ProjectRecovery({ store, id: 'bad' });
  await assert.rejects(blocked.load(), /behållits/);
  await assert.rejects(blocked.save(create()), /behållits/);
  assert.equal(store.records.get('bad').text, 'broken');
  blocked.acceptNewProject();
  await blocked.save(create());
  assert.equal(parseProjectFile(store.records.get('bad').text).objects.length, 0);
});
test('autosave drains edits made during a write before allowing update and skips unchanged writes', async () => {
  const store = new MemoryStore(),
    p = create(),
    recovery = new ProjectRecovery({ store, id: 'a' });
  let release,
    writes = 0;
  const write = store.write.bind(store);
  store.write = async (...args) => {
    if (++writes === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    await write(...args);
  };
  const autosave = new ProjectAutosave({ recovery, getProject: () => p });
  const pending = autosave.flush();
  p.info.name = 'Senaste ändringen';
  autosave.schedule();
  const updating = autosave.flush();
  assert.equal(updating, pending);
  release();
  await updating;
  assert.equal(parseProjectFile(store.records.get('a').text).info.name, 'Senaste ändringen');
  const count = store.writes;
  await autosave.flush();
  assert.equal(store.writes, count);
  assert.equal(autosave.dirty, false);
});
test('storage failures keep a draft dirty and reject update preparation; retry saves latest state', async () => {
  const store = new MemoryStore(),
    p = create(),
    statuses = [];
  const recovery = new ProjectRecovery({ store, id: 'a' });
  const autosave = new ProjectAutosave({
    recovery,
    getProject: () => p,
    status: (...args) => statuses.push(args),
  });
  const write = store.write.bind(store);
  store.write = async () => {
    throw Error('Disk full');
  };
  await assert.rejects(autosave.flush(), /Disk full/);
  assert.equal(autosave.dirty, true);
  assert.deepEqual(statuses.at(-1), ['Disk full', true]);
  store.write = write;
  p.info.name = 'Senare';
  await autosave.flush();
  assert.equal(autosave.dirty, false);
  assert.equal(parseProjectFile(store.records.get('a').text).info.name, 'Senare');
});

test('readable work still restores when storage is full, and the previous backup survives reopening', async () => {
  const store = new MemoryStore(),
    p = create();
  p.info.name = 'Föregående';
  const previous = serializeProject(p);
  p.info.name = 'Senaste';
  const text = serializeProject(p);
  store.records.set('a', { text, previous, savedAt: 123 });
  await new ProjectRecovery({ store, id: 'a' }).load();
  assert.equal(store.records.get('a').previous, previous);
  store.write = async () => {
    throw Error('Disk full');
  };
  const recovery = new ProjectRecovery({ store, id: 'a' }),
    loaded = await recovery.load();
  assert.equal(loaded.project.info.name, 'Senaste');
  assert.match(loaded.warning, /Disk full/);
  await assert.rejects(recovery.save(p), /Disk full/);
  assert.equal(store.records.get('a').text, text);
});
