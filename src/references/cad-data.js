import { parseFrameDXF, frameFromDXF, dxfUnits } from '../frame-dxf.js';
import { cadLayers } from './cad-layers.js';
export function cadReferenceData(source) {
  const doc = parseFrameDXF(source);
  // References retain drawing coordinates and can span an entire site.
  const expand = (e) =>
    e.type === 'DIMENSION' && doc.blocks?.[e.block]
      ? { ...e, type: 'INSERT', name: e.block, position: { x: 0, y: 0 }, rotation: 0 }
      : e;
  // Import model-space layers together; visibility is controlled by the reference.
  const visible = (e) => !e.inPaperSpace && e.visible !== false;
  doc.entities = doc.entities.filter(visible).map(expand);
  for (const block of Object.values(doc.blocks || {}))
    if (block.entities) block.entities = block.entities.filter(visible).map(expand);
  // Unexpanded dimensions are still reported by frameFromDXF.
  doc.omittedTypes = doc.omittedTypes.filter((type) => type !== 'DIMENSION');
  let result;
  try {
    result = frameFromDXF(doc, {
      normalizeOrigin: false,
      maxSize: Infinity,
      maxEntities: 100000,
    });
  } catch (error) {
    throw Error(error.message.replace('ramobjekt', '2D-objekt'));
  }
  return {
    entities: result.frame.entities,
    layers: cadLayers(result.frame.entities),
    skipped: result.skipped,
    unitFactor: dxfUnits.find((u) => u.code === doc.header?.$INSUNITS)?.factor ?? 1,
    unitKnown: dxfUnits.some((u) => u.code === doc.header?.$INSUNITS),
  };
}
