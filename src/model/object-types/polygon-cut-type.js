import { plateType } from './plate-type.js';
import { plateGeometry } from '../../plate.js';
export const polygonCutType = {
  ...plateType,
  id: 'polygoncut',
  label: 'Polygoncut',
  prefix: 'PC',
  cut: true,
  cutGeometry: plateGeometry,
};
