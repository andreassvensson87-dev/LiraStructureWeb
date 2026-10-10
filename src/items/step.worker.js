import occtimportjs from 'occt-import-js';
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';
import { combineStepMeshes } from './data.js';
let engine;
self.onmessage = async ({ data }) => {
  try {
    engine ||= occtimportjs({ locateFile: () => wasmUrl });
    const occt = await engine;
    const result = occt.ReadStepFile(new Uint8Array(data.bytes), {
      linearUnit: 'millimeter',
      linearDeflectionType: 'absolute_value',
      linearDeflection: 0.2,
      angularDeflection: 0.3,
    });
    const mesh = combineStepMeshes(result);
    self.postMessage({ mesh, hierarchy: result.root });
  } catch (error) {
    self.postMessage({ error: error.message || 'STEP-importen misslyckades.' });
  }
};
