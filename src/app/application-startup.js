import { createStartupView } from '../ui/startup.js';

async function loadWorkspace() {
  const [recovery, application] = await Promise.all([
    import('./workspace-startup.js'),
    import('./model-application.js'),
  ]);
  return {
    recoverWorkspace: recovery.recoverWorkspace,
    createApplication: application.createModelApplication,
  };
}

const firstPaint = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

// Reveal only after restoration, workspace adoption and the initial render have completed.
export async function startApplication({
  load = loadWorkspace,
  view = createStartupView(),
  painted = firstPaint,
} = {}) {
  try {
    const { recoverWorkspace, createApplication } = await load();
    const workspace = await recoverWorkspace();
    await createApplication(workspace);
    await painted();
    view.ready();
    return true;
  } catch (error) {
    view.failed(error);
    return false;
  }
}
