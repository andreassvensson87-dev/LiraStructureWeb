import { BUILTIN_PROFILES } from '../profile-catalog.js';
import { profileSnapshot } from '../section-profile.js';
import { profileNameEvidence, profileNameScore } from './profile-match-names.js';
import { profileGeometryMatch } from './profile-match-geometry.js';
const snapshots = new WeakMap();
// Millimetres. Nominal dimensions and tessellated contours have separate tolerances.
export const PROFILE_MATCH_TOLERANCES = Object.freeze({
  dimensions: 0.05,
  contour: 0.15,
  relativeArea: 0.01,
});
const compatible = (kind, type) =>
  kind === 'custom' ||
  (
    {
      i: ['i', 'h'],
      rect: ['rect'],
      rhs: ['rhs'],
      chs: ['chs'],
      circle: ['circle'],
      u: ['u'],
      l: ['l'],
      t: ['t'],
    }[kind] || []
  ).includes(type);
function dimensionComparison(dimensions, section, allowSwap = false) {
  const nominal = {
    ...section.parameters,
    B: section.properties.bounds.width,
    H: section.properties.bounds.height,
  };
  const deviations = [];
  for (const [key, actual] of Object.entries(dimensions || {})) {
    if (!Number.isFinite(actual) || !Number.isFinite(nominal[key])) continue;
    deviations.push({
      dimension: key,
      source: actual,
      library: nominal[key],
      difference: actual - nominal[key],
    });
  }
  if (allowSwap && Number.isFinite(dimensions?.B) && Number.isFinite(dimensions?.H)) {
    const swapped = dimensionComparison(
      { ...dimensions, B: dimensions.H, H: dimensions.B },
      section,
    );
    if (swapped.valid) return { ...swapped, swapped: true };
  }
  return {
    deviations,
    valid: deviations.every((d) => Math.abs(d.difference) <= PROFILE_MATCH_TOLERANCES.dimensions),
    count: deviations.length,
  };
}
const requiredDimensions = {
  i: ['B', 'H', 'tw', 'tf'],
  rect: ['B', 'H'],
  rhs: ['B', 'H', 't'],
  chs: ['D', 't'],
  circle: ['D'],
  u: ['B', 'H', 'tw', 'tf'],
  l: ['B', 'H', 't'],
  t: ['B', 'H', 'tw', 'tf'],
};
const sufficient = (p) => {
  const required = requiredDimensions[p.kind];
  return !!required?.length && required.every((k) => Number.isFinite(p.dimensions?.[k]));
};
/** Pure matching boundary. No IFC API, DOM, storage, project mutation or material assignment. */
export function matchLibraryProfile(evidence = {}, profiles = BUILTIN_PROFILES) {
  const {
    geometry,
    profiles: sourceProfiles = [],
    hints = {},
    warnings: sourceWarnings = [],
  } = evidence;
  const names = profileNameEvidence(evidence.names);
  names.timber ||= /wood|trä|timber/i.test(evidence.material || '');
  const sourceSteel = /steel|stål/i.test(evidence.material || '');
  const sourceConcrete = /concrete|betong/i.test(evidence.material || '');
  const latest = new Map(),
    candidates = [],
    conflicts = [];
  for (const p of profiles)
    if (!latest.has(p.id) || latest.get(p.id).revision < p.revision) latest.set(p.id, p);
  for (const definition of latest.values()) {
    if (!snapshots.has(definition)) {
      try {
        const s = Array.isArray(definition.parameters)
          ? profileSnapshot(definition)
          : structuredClone(definition);
        s.libraryGroup = definition.libraryGroup;
        s.aliases = definition.aliases || [];
        snapshots.set(definition, s);
      } catch {
        snapshots.set(definition, null);
      }
    }
    const section = snapshots.get(definition);
    if (!section) continue;
    const timber = section.libraryGroup === 'timber' || /trä/i.test(section.family);
    if ((sourceSteel && timber) || (sourceConcrete && (timber || section.id.startsWith('tibnor-'))))
      continue;
    const name = profileNameScore(names, section);
    if (name < 0) continue;
    const primary = sourceProfiles.filter((p) => Object.keys(p.dimensions || {}).length);
    const comparisons = primary.map((p) => ({
      ...dimensionComparison(p.dimensions, section, ['rect', 'rhs'].includes(p.kind)),
      kind: compatible(p.kind, section.profileType),
      sufficient: sufficient(p),
      requiredCount: Object.keys(p.dimensions).length,
    }));
    const dimensionsAgree =
      comparisons.length > 0 &&
      comparisons.every((c) => c.kind && c.valid && c.sufficient && c.count >= c.requiredCount);
    const contradiction = comparisons.some((c) => !c.kind || !c.valid);
    if (contradiction) {
      if (name >= 40)
        conflicts.push({
          profile: section.name,
          reason: 'profile-dimensions-conflict',
          deviations: comparisons.flatMap((c) => c.deviations),
        });
      continue;
    }
    const exact = geometry ? profileGeometryMatch(geometry, section) : null;
    const radius = dimensionsAgree
      ? Math.max(0, ...primary.flatMap((p) => ['R', 'Ro', 'Ri'].map((k) => p.dimensions[k] || 0)))
      : 0;
    // Some IFC2x3 renderers reduce a 90-degree root fillet to one chord. Only
    // authoritative matching radii justify that envelope; names never do.
    const circleRadius =
      dimensionsAgree && ['chs', 'circle'].includes(section.profileType)
        ? (section.parameters.D || 0) / 2
        : 0;
    const relaxed =
      geometry && !exact && (name >= 40 || dimensionsAgree)
        ? profileGeometryMatch(geometry, section, {
            linear:
              PROFILE_MATCH_TOLERANCES.contour +
              radius * (1 - Math.SQRT1_2) +
              circleRadius * (1 - Math.cos(Math.PI / 16)),
            bounds: PROFILE_MATCH_TOLERANCES.contour + circleRadius * (1 - Math.cos(Math.PI / 16)),
            area: Math.max(
              PROFILE_MATCH_TOLERANCES.relativeArea,
              (2 * radius * radius) / section.properties.A,
            ),
          })
        : null;
    if (geometry && !exact && !relaxed) {
      if (name >= 40) conflicts.push({ profile: section.name, reason: 'geometry-conflict' });
      continue;
    }
    const hint = dimensionComparison(hints, section, ['rect', 'rhs'].includes(section.profileType));
    if (!dimensionsAgree && !hint.valid) {
      if (name >= 40)
        conflicts.push({ profile: section.name, reason: 'property-dimensions-conflict' });
      continue;
    }
    if (!dimensionsAgree && !exact && !(name >= 40 && relaxed) && name === 0) continue;
    if (names.tokens.size && name < 40 && !dimensionsAgree && !exact) continue;
    // A name alone is a proposal. It cannot replace the recovered IFC contour automatically.
    let verified = dimensionsAgree || !!exact || !!(name >= 40 && relaxed);
    const nameConflict = names.tokens.size > 0 && name < 40;
    if (sourceWarnings.length || nameConflict) verified = false;
    const reasons = [
      ...(dimensionsAgree ? ['profile-dimensions'] : []),
      ...(name >= 40 ? ['profile-name'] : name ? ['named-dimensions'] : []),
      ...(exact ? ['exact-contour'] : relaxed ? ['tessellated-contour'] : []),
    ];
    const warnings = [
      ...sourceWarnings,
      ...(nameConflict ? ['profile-name-conflict'] : []),
      ...(relaxed && dimensionsAgree && relaxed.contourError > PROFILE_MATCH_TOLERANCES.contour
        ? ['coarse-tessellation']
        : []),
      ...(!hint.valid && dimensionsAgree ? ['property-dimensions-conflict'] : []),
    ];
    candidates.push({
      section: structuredClone(section),
      rotation: (exact || relaxed)?.rotation ?? null,
      status: verified ? 'verified' : 'probable',
      score: (dimensionsAgree ? 100 : exact ? 80 : relaxed ? 70 : 20) + name,
      reasons,
      warnings,
      deviations: comparisons.flatMap((c) => c.deviations),
      geometry: exact || relaxed,
    });
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.section.name.localeCompare(b.section.name, 'sv') ||
      a.section.id.localeCompare(b.section.id),
  );
  const top = candidates[0],
    ambiguous =
      !!top &&
      candidates.some((c, i) => i && c.score === top.score && c.section.id !== top.section.id);
  const status = !top ? 'none' : ambiguous ? 'ambiguous' : top.status;
  return {
    status,
    suggestion: ambiguous ? null : top || null,
    alternatives: candidates.slice(0, 5),
    conflicts,
    reasons: ambiguous
      ? ['multiple-candidates']
      : top?.reasons || (conflicts.length ? ['conflicting-evidence'] : ['no-library-profile']),
    warnings: top?.warnings || sourceWarnings,
  };
}
