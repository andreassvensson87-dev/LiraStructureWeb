import { ifcPlacement } from './ifc-coordinates.js';
import { IfcAPI } from 'web-ifc';
import wasmURL from 'web-ifc/web-ifc.wasm?url';
import * as THREE from 'three';
self.onmessage = async ({ data }) => {
  const api = new IfcAPI();
  let model;
  try {
    await api.Init(() => new URL(wasmURL, self.location.href).href, true);
    model = api.OpenModel(new Uint8Array(data), {
      COORDINATE_TO_ORIGIN: false,
      CIRCLE_SEGMENTS: 32,
    });
    if (model < 0) throw Error('Filen kunde inte läsas som IFC.');
    const schema = api.GetModelSchema(model);
    let count = 0;
    // web-ifc streams metres in a Y-up frame; the editor uses millimetres and Z-up.
    api.StreamAllMeshes(model, (mesh, index, total) => {
      const line = api.GetLine(model, mesh.expressID);
      for (let j = 0; j < mesh.geometries.size(); j++) {
        const part = mesh.geometries.get(j),
          raw = api.GetGeometry(model, part.geometryExpressID);
        const vertices = api.GetVertexArray(raw.GetVertexData(), raw.GetVertexDataSize());
        const indices = api.GetIndexArray(raw.GetIndexData(), raw.GetIndexDataSize()).slice();
        const positions = new Float32Array(vertices.length / 2);
        for (let k = 0; k < vertices.length / 6; k++)
          positions.set(vertices.subarray(k * 6, k * 6 + 3), k * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        const transform = ifcPlacement(part.flatTransformation);
        const origin = new THREE.Vector3().setFromMatrixPosition(transform);
        transform.setPosition(0, 0, 0);
        geometry.applyMatrix4(transform);
        const edges = new THREE.EdgesGeometry(geometry, 20);
        const edgePositions = edges.attributes.position.array;
        const output = {
          type: 'mesh',
          positions: geometry.attributes.position.array,
          indices,
          edges: edgePositions,
          origin: origin.toArray(),
          color: [part.color.x, part.color.y, part.color.z],
          opacity: part.color.w,
          id: mesh.expressID,
          ifcType: line?.type,
          name: line?.Name?.value || '',
          globalId: line?.GlobalId?.value || '',
        };
        self.postMessage(output, [output.positions.buffer, indices.buffer, edgePositions.buffer]);
        edges.dispose();
        geometry.dispose();
        raw.delete();
        count++;
      }
      if (index % 50 === 0)
        self.postMessage({
          type: 'progress',
          value: total ? Math.round(((index + 1) / total) * 100) : 0,
        });
    });
    if (!count) throw Error('IFC-filen innehåller ingen visningsbar geometri.');
    self.postMessage({ type: 'done', schema, count });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'IFC-importen misslyckades.' });
  } finally {
    if (model !== undefined && model >= 0) api.CloseModel(model);
  }
};
