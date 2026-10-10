import { InteractionTimings } from '../model/interaction-timings.js';

export function createInteractionTimings() {
  const interactionTimings = new InteractionTimings(
    import.meta.env.DEV && new URLSearchParams(location.search).get('performance') === '1',
  );
  if (interactionTimings.enabled)
    document.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('form.fastener-editor button[type="submit"], #undo, #redo'))
          interactionTimings.begin(
            event.target.closest('#undo')
              ? 'undo'
              : event.target.closest('#redo')
                ? 'redo'
                : 'jointEdit',
          );
      },
      { capture: true },
    );

  return interactionTimings;
}

export async function installWorkspaceDiagnostics({
  actions,
  camera,
  controllers,
  host,
  project,
  projectHistory,
  renderer,
  scene,
}) {
  const commitFastener = (...args) => actions.commitFastener(...args);
  const loadFrameExample = (...args) => actions.loadFrameExample(...args);
  const restore = (...args) => actions.restore(...args);
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('memory') === '1') {
    const { installMemoryBenchmark } = await import('../model/memory-benchmark.js');
    installMemoryBenchmark({
      project,
      history: projectHistory,
      renderer,
      loadExample: loadFrameExample,
      commit: commitFastener,
      restore,
      scene,
    });
  }

  if (import.meta.env.DEV && new URLSearchParams(location.search).get('referenceMemory') === '1') {
    const { installReferenceMemoryBenchmark } = await import('../references/memory-benchmark.js');
    installReferenceMemoryBenchmark({
      references: controllers.referenceModels,
      renderer,
      camera,
      host,
      project,
      history: projectHistory,
    });
  }
}
