import { helperLineType } from './helper-types.js';
import { GRID_LABEL_MAX_LENGTH } from '../../grid-labels.js';
export const gridLineType = {
  ...helperLineType,
  id: 'gridline',
  label: 'Stomlinje',
  prefix: 'GL',
  editAttribute(s, key, value) {
    if (!['gridLength', 'gridAngle'].includes(key)) return { ...s, [key]: value };
    const length =
      key === 'gridLength' ? value : Math.hypot(...s.end.map((v, i) => v - s.start[i]));
    if (length < 1) throw new Error('Stomlinjen måste vara minst 1 mm lång.');
    const angle =
      key === 'gridAngle'
        ? (value * Math.PI) / 180
        : Math.atan2(s.end[1] - s.start[1], s.end[0] - s.start[0]);
    return {
      ...s,
      end: [
        s.start[0] + length * Math.cos(angle),
        s.start[1] + length * Math.sin(angle),
        s.start[2],
      ],
    };
  },
  validate(s) {
    const error = helperLineType.validate(s);
    if (error) return error;
    if (Math.hypot(...s.end.map((v, i) => v - s.start[i])) < 1)
      return 'Stomlinjen måste vara minst 1 mm lång.';
    if (Math.abs(s.start[2] - s.end[2]) > 0.001)
      return 'Stomlinjens ändpunkter måste ligga på samma höjd.';
    if (![s.start, s.end].every((p) => p.every((v) => Math.abs(v) <= 1000000)))
      return 'Stomlinjer ska ligga inom ±1 000 000 mm.';
    if (!['x', 'y'].includes(s.gridAxis)) return 'Välj en stomlinjeserie.';
    if (typeof s.name !== 'string' || !s.name.trim() || s.name.length > GRID_LABEL_MAX_LENGTH)
      return 'Ange en stomlinjebeteckning.';
    if (!['both', 'start', 'end'].includes(s.bubbleEnds))
      return 'Välj bubblor i start, slut eller båda ändar.';
    return '';
  },
};
