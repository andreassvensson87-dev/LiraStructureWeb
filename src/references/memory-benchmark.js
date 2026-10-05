import * as THREE from 'three';
import { createReferenceFixture } from '../../scripts/ifc-memory-fixture.js';

/** Real browser Worker/WASM import and the same controls used by reference UI. */
export function installReferenceMemoryBenchmark({
  references,
  renderer,
  camera,
  host,
  project,
  history,
}) {
  const panel = document.createElement('details');
  panel.id = 'reference-memory-benchmark';
  panel.open = true;
  panel.style.cssText =
    'position:fixed;bottom:30px;left:8px;z-index:1000;background:white;color:black;max-height:35vh;overflow:auto;font-size:11px;padding:8px;max-width:650px';
  const title = document.createElement('summary');
  title.textContent = 'Utvecklingstest · IFC-import och minne';
  const button = document.createElement('button');
  button.textContent = 'Kör IFC-test · 20 000 geometridelar';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent =
    'Separat testflik. Testar lokal IFC4, importfel, avbrott och upprepade importer.';
  const output = document.createElement('pre');
  panel.append(title, button, status, output);
  document.body.append(panel);
  const frame = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const require = (value, message) => {
    if (!value) throw new Error(message);
  };
  button.onclick = async () => {
    button.disabled = true;
    const report = {
      startedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      method:
        'Real ReferenceModels.load(File), web-ifc in its browser Worker, transferable geometry, actual visibility/transparency/remove/cancel controls, WebGL rendering and reference snapping. Synthetic IFC4 with 18000 boxes and 2000 circular extrusions. performance.memory is approximate; no forced GC; excludes worker heaps and shared GPU process. OS renderer RSS sampled separately includes worker/native memory.',
      points: [],
      checks: [],
      completed: false,
    };
    const sample = (label) => {
      const memory = performance.memory;
      report.points.push({
        label,
        at: new Date().toISOString(),
        parts: references.parts.length,
        pending: references.pending?.length || 0,
        workerActive: !!references.worker,
        visible: references.group.visible,
        heapUsed: memory?.usedJSHeapSize ?? null,
        heapTotal: memory?.totalJSHeapSize ?? null,
        webglGeometries: renderer.info.memory.geometries,
        webglTextures: renderer.info.memory.textures,
        webglPrograms: renderer.info.programs?.length || 0,
        objects: project.objects.length,
        past: history.past.length,
        future: history.future.length,
      });
      status.textContent = `Mäter: ${label} · ${references.parts.length} IFC-delar`;
      output.textContent = JSON.stringify(report, null, 2);
    };
    const waitForFinish = async () => {
      const started = performance.now();
      while (references.worker) {
        require(performance.now() - started < 60000, 'IFC import timed out');
        await pause(16);
      }
      await frame();
      require(!references.pending?.length, 'Finished import retained pending meshes');
    };
    const load = async (file, count) => {
      await references.load(file);
      await waitForFinish();
      require(references.parts.length === count &&
        references.$('[data-name]').textContent ===
          file.name, `Import failed: ${references.$('[role=status]').textContent}`);
    };
    const startPending = async (file) => {
      await references.load(file);
      const worker = references.worker;
      require(worker, 'Worker was not created');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('No partial mesh received')), 60000);
        const receive = worker.onmessage;
        worker.onmessage = (event) => {
          receive(event);
          if (event.data.type === 'mesh') {
            clearTimeout(timeout);
            resolve();
          } else if (event.data.type === 'error') {
            clearTimeout(timeout);
            reject(new Error(event.data.message));
          }
        };
      });
      require(references.pending.length > 0 &&
        references.worker === worker, 'Partial import not available');
    };
    const click = async (selector) => {
      references.$(selector).click();
      await frame();
    };
    const snap = () => {
      const part = references.parts[0];
      const target = new THREE.Vector3().fromArray(part.edges).add(part.mesh.position);
      const projected = target.clone().project(camera);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
      const points = references.candidates({
        ray: raycaster.ray,
        camera,
        pointer: [
          ((projected.x + 1) * host.clientWidth) / 2,
          ((1 - projected.y) * host.clientHeight) / 2,
        ],
        width: host.clientWidth,
        height: host.clientHeight,
      });
      require(points.some(
        (p) => p.label === 'IFC-hörn' && new THREE.Vector3(...p.coords).distanceTo(target) < 0.01,
      ), 'IFC corner snap lost its world placement');
    };
    try {
      const template = await (await fetch('/tests/fixtures/reference-box.ifc')).text();
      const small = new File([template], 'reference-box.ifc');
      const large = new File([createReferenceFixture(template)], 'reference-stress-20000.ifc');
      report.fixtureBytes = large.size;
      await frame();
      sample('initial');
      await load(small, 1);
      snap();
      sample('small-loaded');
      const original = references.parts[0];
      await startPending(large);
      sample('cancel-with-pending');
      await click('[data-cancel]');
      require(!references.worker &&
        !references.pending.length &&
        references.parts[0] === original, 'Cancellation lost old model or retained pending import');
      report.checks.push('Partial import cancellation preserves the existing reference');
      sample('cancelled');
      await references.load(new File(['not an IFC file'], 'invalid.ifc'));
      await waitForFinish();
      require(references.parts[0] === original, 'Import error replaced the existing reference');
      report.checks.push('Invalid IFC terminates the worker and preserves the existing reference');
      sample('invalid-file');
      await startPending(large);
      await click('[data-remove]');
      require(!references.worker &&
        !references.pending.length &&
        !references.parts.length, 'Removing a reference left a running import or pending meshes');
      report.checks.push('Removing during import also cancels the pending reference');
      sample('removed-during-import');
      await references.load(large);
      await load(small, 1);
      report.checks.push('A new import supersedes an unfinished import');
      sample('rapid-replacement');
      let unloadedGeometries;
      for (let cycle = 1; cycle <= 8; cycle++) {
        const started = performance.now();
        await load(large, 20000);
        snap();
        report.checks.push(
          `Import ${cycle}: 20000 parts and exact corner snap, ${(performance.now() - started).toFixed(0)} ms`,
        );
        sample(`loaded-${cycle}`);
        await click('[data-visible]');
        require(!references.group.visible, 'Hidden reference remained visible');
        require(references.candidates({}).length === 0, 'Hidden reference remained snap-enabled');
        sample(`hidden-${cycle}`);
        await click('[data-visible]');
        snap();
        await click('[data-transparent]');
        require(references.parts.every(
          (p) => p.mesh.material.opacity === 0.3,
        ), 'Transparency did not affect every part');
        await click('[data-transparent]');
        sample(`visible-solid-${cycle}`);
        await click('[data-remove]');
        require(!references.parts.length &&
          !references.worker &&
          !references.pending.length, 'Removal retained reference resources');
        sample(`removed-${cycle}`);
        unloadedGeometries ??= renderer.info.memory.geometries;
        require(renderer.info.memory.geometries ===
          unloadedGeometries, 'Uploaded geometries grew after repeated removal');
        require(project.objects.length === 0 &&
          history.past.length === 0 &&
          history.future.length === 0, 'Reference imports entered the editable model or history');
        await pause(500);
      }
      await pause(5000);
      await frame();
      sample('empty-after-idle');
      await load(small, 1);
      snap();
      sample('small-final');
      report.completed = true;
      report.finishedAt = new Date().toISOString();
      status.textContent =
        'IFC-test klart · 8 stora importer, dölj/visa, transparens, snap, borttagning, avbrott och importfel verifierade';
    } catch (error) {
      report.error = error.stack;
      status.textContent = `IFC-test misslyckades: ${error.message}`;
    } finally {
      output.textContent = JSON.stringify(report, null, 2);
      button.disabled = false;
    }
  };
}
