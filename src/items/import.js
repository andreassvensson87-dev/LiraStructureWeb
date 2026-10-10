import { defaultItemPoints, ITEM_FILE_LIMIT, validateItemDefinition } from './data.js';
export function readStep(bytes, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./step.worker.js', import.meta.url), { type: 'module' });
    const finish = (error, result) => {
      worker.terminate();
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(result);
    };
    const abort = () => finish(new Error('Importen avbröts.'));
    const timer = setTimeout(() => finish(new Error('STEP-importen tog för lång tid.')), 120000);
    worker.onmessage = ({ data }) => finish(data.error ? Error(data.error) : null, data);
    worker.onerror = (event) => finish(Error(event.message || 'STEP-importen kunde inte starta.'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) return abort();
    worker.postMessage({ bytes }, [bytes]);
  });
}
export async function importStepFile(file, options) {
  if (!/\.(step|stp)$/i.test(file.name)) throw Error('Välj en .step- eller .stp-fil.');
  if (!file.size || file.size > ITEM_FILE_LIMIT)
    throw Error('STEP-filen måste vara mellan 1 byte och 50 MB.');
  const bytes = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const geometryId = [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
  const { mesh, hierarchy } = await readStep(bytes, options);
  const stem = file.name.replace(/\.(step|stp)$/i, '');
  const [article, ...description] = stem.split(/[,]/);
  return validateItemDefinition({
    id: crypto.randomUUID(),
    revision: 1,
    name: (description.length ? description.join(',').trim() : stem).slice(0, 200),
    article: description.length ? article.trim().slice(0, 300) : '',
    supplier: '',
    sourceName: file.name.slice(0, 300),
    geometryId,
    mesh,
    hierarchy,
    ...defaultItemPoints(mesh),
    snap: 'anchors',
  });
}
