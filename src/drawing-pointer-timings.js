/** Opt-in development timing of actual pointer handlers; no editor/model ownership. */
export class DrawingPointerTimings {
  constructor() {
    this.groups = new Map();
  }
  measure(stage, settings, work) {
    const started = performance.now();
    try {
      return work();
    } finally {
      const key = JSON.stringify({
        stage,
        snap: settings.snap,
        intersections: settings.intersections,
        polar: settings.polar,
        otrack: settings.otrack,
      });
      const values = this.groups.get(key) || [];
      values.push(performance.now() - started);
      this.groups.set(key, values.slice(-1000));
      if (stage === 'pointer' && values.length % 20 === 0) this.report();
    }
  }
  report() {
    console.info(
      'DRAWING_POINTER_TIMINGS',
      JSON.stringify(
        [...this.groups].map(([key, values]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return {
            ...JSON.parse(key),
            samples: values.length,
            medianMs: sorted[Math.floor(sorted.length / 2)],
            p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
            maxMs: sorted.at(-1),
          };
        }),
      ),
    );
  }
}
