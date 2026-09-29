import { helperLineType, helperPointType } from './helper-types.js';
import { createObjectRegistry } from './registry.js';
import { sweepType } from './sweep-type.js';
import { plateType } from './plate-type.js';
import { polygonCutType } from './polygon-cut-type.js';
import { lineCutType } from './line-cut-type.js';
export const objectTypes = createObjectRegistry([
  sweepType,
  plateType,
  polygonCutType,
  lineCutType,
  helperLineType,
  helperPointType,
]);
export const objectType = (object) => objectTypes.get(object);
