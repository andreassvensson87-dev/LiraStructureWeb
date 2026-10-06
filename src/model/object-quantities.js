import { fitEnvelope } from '../components/fit.js';
import { contours } from '../sweep.js';
import { roundProfile } from '../round-profile.js';
import { sectionProperties } from '../section-profile.js';
import { evaluateProfileContours } from '../section-contours.js';
import { plateArea } from '../plate.js';
import { isPhysical, isPlate, cutsForModel, geometryForModel } from '../model-object.js';

/** Closed triangle mesh volume in mm³. Translate locally for numerical stability. */
export function meshVolume(geometry) {
  const positions = geometry.attributes.position;
  if (!positions?.count) return 0;
  const index = geometry.index;
  const count = index?.count ?? positions.count;
  const origin = [positions.getX(0), positions.getY(0), positions.getZ(0)];
  const point = (n) => {
    const i = index ? index.getX(n) : n;
    return [
      positions.getX(i) - origin[0],
      positions.getY(i) - origin[1],
      positions.getZ(i) - origin[2],
    ];
  };
  let volume = 0;
  for (let i = 0; i + 2 < count; i += 3) {
    const a = point(i),
      b = point(i + 1),
      c = point(i + 2);
    volume +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) +
      a[1] * (b[2] * c[0] - b[0] * c[2]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return Math.abs(volume / 6);
}

export function sweepArea(object) {
  const round = roundProfile(object);
  if (round) return Math.PI * (round.outer ** 2 - round.inner ** 2);
  const section = object.section;
  const loops = section?.contourDefinition
    ? evaluateProfileContours(section.contourDefinition, section.parameters, 'exact')
    : contours(object);
  return sectionProperties(loops, 0).A;
}

/** Derived on demand from physical geometry. No camera/display state or catalog mass inputs. */
export function objectQuantities(object, model = []) {
  if (!isPhysical(object)) return null;
  const section = object.profile === 'custom' ? object.section : null;
  if (section?.generatedProfileDetail === 'schematic' && section.contourDefinition)
    object = {
      ...object,
      section: {
        ...section,
        loops: evaluateProfileContours(section.contourDefinition, section.parameters, 'exact'),
      },
    };
  const density = object.material?.density ?? section?.density ?? null;
  if (density != null && (!Number.isFinite(density) || density < 0 || density > 100000))
    throw new Error('Ogiltig densitet för mängdberäkning.');
  const lengthMm =
    object.start && object.end
      ? Math.hypot(...object.end.map((v, i) => v - object.start[i]))
      : null;
  const sweep = (object.type || 'sweep') === 'sweep';
  const areaMm2 = sweep ? sweepArea(object) : isPlate(object) ? plateArea(object) : null;
  const cutCount = cutsForModel(object, model).length;
  const stock = fitEnvelope(object, cutsForModel(object, model));
  const stockLength = sweep ? Math.hypot(...stock.end.map((v, i) => v - stock.start[i])) : null;
  const grossMm3 = areaMm2 == null ? null : areaMm2 * (sweep ? stockLength : object.thickness);
  let netMm3 = grossMm3;
  if (cutCount || grossMm3 == null) {
    const geometry = geometryForModel(object, model);
    try {
      netMm3 = meshVolume(geometry);
    } finally {
      geometry.dispose();
    }
  }
  const volumeM3 = netMm3 * 1e-9;
  return {
    lengthMm,
    areaMm2,
    grossVolumeM3: grossMm3 == null ? null : grossMm3 * 1e-9,
    volumeM3,
    massKg: density == null ? null : volumeM3 * density,
    massPerMeter: sweep && density != null ? areaMm2 * 1e-6 * density : null,
    densityKgM3: density,
    densitySource: object.material ? 'material' : section ? 'profile' : 'none',
    cutCount,
    approximate: Boolean(
      cutCount || (!sweep && !isPlate(object)) || object.section?.contourDefinition,
    ),
  };
}
