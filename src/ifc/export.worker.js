import { exportIFC } from './export.js';
self.onmessage = async ({ data }) => {
  try {
    const result = await exportIFC(data.project, data.options, (p) => {
      if (p.current % 10 === 0) self.postMessage({ type: 'progress', ...p });
    });
    self.postMessage({ type: 'done', ...result }, result.file ? [result.file.buffer] : []);
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'IFC-exporten misslyckades.' });
  }
};
