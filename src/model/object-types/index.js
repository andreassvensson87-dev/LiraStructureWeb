import { gridLineType } from './grid-line-type.js';
import { helperLineType, helperPointType } from './helper-types.js';
import { createObjectRegistry } from './registry.js';
import { sweepType } from './sweep-type.js';
import { plateType } from './plate-type.js';
import { polygonCutType } from './polygon-cut-type.js';
import { lineCutType } from './line-cut-type.js';
import { componentType } from '../../components/fit.js';
import { fastenerType } from '../../fasteners/object-type.js';
import { itemType } from '../../items/geometry.js';
export const objectTypes = createObjectRegistry([
  sweepType,
  plateType,
  polygonCutType,
  lineCutType,
  helperLineType,
  gridLineType,
  helperPointType,
  fastenerType,
  itemType,
  componentType,
]);
export const objectType = (object) => objectTypes.get(object);
