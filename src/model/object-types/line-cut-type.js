import { lineCutGeometry, validateLineCut, lineCutTool } from '../../line-cut.js';
import { plateVertices } from '../../plate.js';
import { translateFrame, rotateFrame } from './frame-transform.js';
export const lineCutType = {
  id: 'linecut',
  label: 'Linecut',
  prefix: 'LC',
  family: 'plate',
  inspector: 'linecut',
  cut: true,
  geometry: lineCutGeometry,
  validate: validateLineCut,
  corners: plateVertices,
  anchors: plateVertices,
  snapSegments: (s) => ({ segments: [plateVertices(s)], includeEdges: false }),
  translate: translateFrame,
  rotate: rotateFrame,
  cutGeometry: lineCutTool,
};
