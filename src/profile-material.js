import { BUILTIN_MATERIALS } from './material-catalog.js';
import { latestMaterials } from './materials.js';

/** Only explicitly stated grades propose materials; ungraded dimensions stay ungraded. */
export function profileMaterialSuggestions(section, records = BUILTIN_MATERIALS) {
  const grades = [
    ...new Set(
      (section?.standard || '')
        .toUpperCase()
        .match(/\b(?:S235JR|S355J2H|S355J2|S355N|S355M|C14|C24|GL28CS|GL28HS|GL30C|GL30H)\b/g) ||
        [],
    ),
  ];
  const latest = latestMaterials(records);
  return grades.flatMap((grade) => {
    const stock = BUILTIN_MATERIALS.find((m) => m.name.toUpperCase() === grade);
    const material = stock && latest.find((m) => m.id === stock.id);
    return material ? [structuredClone(material)] : [];
  });
}

export function suggestedProfileMaterial(section, current, records, automatic = false) {
  const suggestions = profileMaterialSuggestions(section, records);
  // Ambiguous steel grades need an explicit choice. Never guess an ungraded timber class.
  return automatic
    ? suggestions.length === 1
      ? suggestions[0]
      : null
    : structuredClone(current ?? null);
}
