/** Opt-in development measurements of a real submit, including the following frame. */
export class InteractionTimings {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.samples = [];
    this.current = null;
  }
  begin(action = 'jointEdit') {
    if (!this.enabled) return;
    this.current = { action, started: performance.now(), stages: {} };
  }
  measure(name, work) {
    if (!this.current) return work();
    const started = performance.now();
    try {
      return work();
    } finally {
      this.record(name, started);
    }
  }
  record(name, started) {
    if (!this.current || this.current.submitted !== undefined) return;
    const stages = this.current.stages;
    stages[name] = (stages[name] || 0) + performance.now() - started;
  }
  frameSubmitted(objects) {
    const sample = this.current;
    if (!sample || sample.submitted !== undefined) return;
    sample.submitted = performance.now();
    sample.objects = objects;
    // The next animation callback bounds the opportunity to paint this frame.
    // It is not a GPU completion fence or a measurement of physical presentation.
    requestAnimationFrame(() => {
      this.samples.push({
        action: sample.action,
        objects: sample.objects,
        clickToSubmissionMs: sample.submitted - sample.started,
        nextFrameBoundaryMs: performance.now() - sample.started,
        stages: sample.stages,
      });
      if (this.current === sample) this.current = null;
      let report = document.getElementById('interaction-timings');
      if (!report) {
        report = document.createElement('details');
        report.id = 'interaction-timings';
        report.style.cssText =
          'position:fixed;bottom:30px;left:8px;z-index:1000;background:white;color:black;max-height:45vh;overflow:auto;font-size:11px;padding:6px;max-width:600px';
        const summary = document.createElement('summary');
        summary.textContent = 'Utvecklarmätning · förbandsändringar';
        report.append(summary, document.createElement('pre'));
        document.body.append(report);
      }
      report.querySelector('pre').textContent = JSON.stringify(
        {
          method:
            'Real save/undo/redo click, validation, history, model/UI update and WebGL submission. Next frame boundary approximates a paint opportunity; excludes GPU completion and physical presentation.',
          samples: this.samples,
        },
        null,
        2,
      );
    });
  }
}
