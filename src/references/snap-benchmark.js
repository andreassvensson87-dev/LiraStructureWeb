import { runReferenceSnapWorkload, timingSummary } from '../../scripts/reference-snap-workload.js';

/** Explicit development-only CPU comparison. Synthetic references never enter a project or storage. */
export function installReferenceSnapBenchmark({
  references,
  camera,
  host,
  project,
  tools,
  pickPoint,
  updateOverlay,
}) {
  const panel = document.createElement('details');
  panel.id = 'reference-snap-benchmark';
  panel.open = true;
  panel.style.cssText =
    'position:fixed;bottom:30px;left:8px;z-index:1000;background:white;color:black;max-height:40vh;overflow:auto;font-size:11px;padding:8px;max-width:650px';
  const title = document.createElement('summary');
  title.textContent = 'Utvecklingstest · referenssnap';
  const button = document.createElement('button');
  button.textContent = 'Kör snaptest · 20 referenser / 20 000 objekt';
  const status = document.createElement('p'),
    output = document.createElement('pre');
  status.setAttribute('role', 'status');
  panel.append(title, button, status, output);
  document.body.append(panel);
  const measureModelPoint = (fixture, queries, nearest, perpendicular) => {
    const saved = {
      models: references.models,
      camera: camera.clone(),
      snap: project.snap,
      first: tools.first,
      activeSnap: tools.activeSnap,
      status: document.getElementById('status').textContent,
    };
    const box = host.getBoundingClientRect(),
      values = [];
    try {
      references.models = fixture.models;
      camera.copy(fixture.queries[0].camera);
      camera.updateMatrixWorld();
      project.snap = {
        ...project.snap,
        nearest,
        perpendicular,
        endpoints: true,
        corners: true,
        midpoints: false,
        axes: false,
        polar: '0',
        gridLines: false,
        gridIntersections: false,
      };
      for (const q of queries) {
        tools.first = q.start;
        const started = performance.now();
        pickPoint({
          clientX: box.left + (q.pointer[0] / q.width) * box.width,
          clientY: box.top + (q.pointer[1] / q.height) * box.height,
        });
        values.push(performance.now() - started);
      }
      return timingSummary(values);
    } finally {
      references.models = saved.models;
      camera.copy(saved.camera);
      camera.updateMatrixWorld();
      project.snap = saved.snap;
      tools.first = saved.first;
      tools.activeSnap = saved.activeSnap;
      updateOverlay();
      document.getElementById('status').textContent = saved.status;
    }
  };
  button.onclick = async () => {
    button.disabled = true;
    try {
      const report = await runReferenceSnapWorkload({
        samples: 120,
        measureModelPoint,
        progress: async (text) => {
          status.textContent = text;
          await new Promise((resolve) => setTimeout(resolve, 0));
        },
      });
      output.textContent = JSON.stringify(report, null, 2);
      panel.dataset.complete = 'true';
      status.textContent = 'Klart · identiska snapresultat före/efter';
    } catch (error) {
      status.textContent = error.stack;
      panel.dataset.error = 'true';
    } finally {
      button.disabled = false;
    }
  };
}
