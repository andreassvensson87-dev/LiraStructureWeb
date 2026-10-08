import { cadReferenceData } from './cad-data.js';
import wasmUrl from '../../node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm?url';
self.onmessage = async ({ data }) => {
  try {
    let bytes = data.bytes;
    if (data.format === 'DWG') {
      const { LibreDwg, createModule } = await import('@mlightcad/libredwg-web');
      const wasm = await createModule({ locateFile: () => wasmUrl });
      bytes = LibreDwg.createByWasmInstance(wasm).dwg_write_dxf(bytes);
      if (!bytes) throw Error('DWG-filen kunde inte läsas. Prova att exportera den som ASCII-DXF.');
    }
    const parsed = cadReferenceData(new TextDecoder().decode(bytes));
    self.postMessage({ type: 'cad', ...parsed });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'CAD-filen kunde inte läsas.' });
  }
};
