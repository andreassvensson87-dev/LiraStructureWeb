/** Opt-in dev test of the real application, including UI and WebGL updates. */
export function installMemoryBenchmark({
  project,
  history,
  renderer,
  loadExample,
  commit,
  restore,
  scene,
}) {
  const panel = document.createElement('details');
  panel.id = 'memory-benchmark';
  panel.open = true;
  panel.style.cssText =
    'position:fixed;bottom:30px;left:8px;z-index:1000;background:white;color:black;max-height:35vh;overflow:auto;font-size:11px;padding:8px;max-width:650px';
  const title = document.createElement('summary');
  title.textContent = 'Utvecklingstest · minne under lång session';
  const button = document.createElement('button');
  button.textContent = 'Kör minnestest · 19 212 objekt';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent =
    'Använd en separat testflik. Testet ersätter modellen och kör ångrahistoriken.';
  const output = document.createElement('pre');
  panel.append(title, button, status, output);
  document.body.append(panel);
  const frame = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const idle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const require = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  button.onclick = async () => {
    button.disabled = true;
    const report = {
      startedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      method:
        'Real app load, validated fastener commit, scene/UI rebuild and undo/redo, with two animation frames per operation. Browser performance.memory is approximate and is not process RAM; no forced garbage collection. WebGL counters count uploaded resources, not bytes. Separate OS RSS sampling includes renderer-native memory but excludes the shared GPU process.',
      points: [],
      timings: {},
      completed: false,
    };
    const sample = (label) => {
      const memory = performance.memory;
      let sceneNodes = 0;
      const geometries = new Set(),
        materials = new Set();
      scene.traverse((node) => {
        sceneNodes++;
        if (node.geometry) geometries.add(node.geometry);
        if (node.material) for (const material of [node.material].flat()) materials.add(material);
      });
      report.points.push({
        label,
        at: new Date().toISOString(),
        objects: project.objects.length,
        past: history.past.length,
        future: history.future.length,
        heapUsed: memory?.usedJSHeapSize ?? null,
        heapTotal: memory?.totalJSHeapSize ?? null,
        heapLimit: memory?.jsHeapSizeLimit ?? null,
        sceneNodes,
        sceneGeometries: geometries.size,
        sceneMaterials: materials.size,
        webglGeometries: renderer.info.memory.geometries,
        webglTextures: renderer.info.memory.textures,
        webglPrograms: renderer.info.programs?.length ?? 0,
      });
      status.textContent = `Mäter: ${label} · ${project.objects.length} objekt`;
      output.textContent = JSON.stringify(report, null, 2);
    };
    const timed = async (label, action) => {
      const start = performance.now();
      action();
      await frame();
      (report.timings[label] ||= []).push(performance.now() - start);
    };
    const screw = () => project.objects.find((object) => object.type === 'fastener');
    const diameter = () => screw().holes[0].diameter;
    const edit = (value) => {
      const source = screw();
      commit({ ...source, holes: source.holes.map((hole) => ({ ...hole, diameter: value })) });
      require(diameter() === value, 'Diameter was not committed');
      require(history.past.length <= history.limit, 'History exceeded its limit');
    };
    const edits = async (count, prefix) => {
      for (let step = 1; step <= count; step++) {
        await timed('edit', () => edit(22 + step / 1000));
        if (step % 25 === 0) sample(`${prefix}-${step}`);
      }
    };
    try {
      await frame();
      sample('initial');
      await timed('load', () => loadExample('stress'));
      sample('stress-loaded');
      await edits(200, 'edits');
      for (let step = 1; step <= 100; step++) {
        await timed('undo', () => restore('undo'));
        require(diameter() === 22 + (200 - step) / 1000, 'Undo restored the wrong diameter');
        if (step % 25 === 0) sample(`undo-${step}`);
      }
      for (let step = 1; step <= 100; step++) {
        await timed('redo', () => restore('redo'));
        require(diameter() === 22 + (100 + step) / 1000, 'Redo restored the wrong diameter');
        if (step % 25 === 0) sample(`redo-${step}`);
      }
      for (let cycle = 1; cycle <= 3; cycle++) {
        await timed('load', () => loadExample('small'));
        await timed('load', () => loadExample('stress'));
        sample(`replacement-${cycle}-loaded`);
        await edits(100, `replacement-${cycle}-edits`);
        await idle(1500);
        sample(`replacement-${cycle}-settled`);
      }
      await timed('load', () => loadExample('small'));
      sample('small-old-model-in-history');
      await edits(100, 'small-edits');
      await idle(5000);
      sample('small-old-model-expired');
      require(history.future.length === 0, 'New edits retained redo steps');
      report.completed = true;
      report.finishedAt = new Date().toISOString();
      for (const [label, values] of Object.entries(report.timings)) {
        values.sort((a, b) => a - b);
        report.timings[label] = {
          samples: values.length,
          medianMs: values[Math.floor(values.length / 2)],
          p95Ms: values[Math.ceil(values.length * 0.95) - 1],
        };
      }
      status.textContent =
        'Minnestest klart · 600 ändringar, 100 ångra, 100 gör om och 8 modellinläsningar verifierade';
    } catch (error) {
      report.error = error.stack;
      status.textContent = `Minnestest misslyckades: ${error.message}`;
    } finally {
      output.textContent = JSON.stringify(report, null, 2);
      button.disabled = false;
    }
  };
}
