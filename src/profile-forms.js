// Quick forms have dimensions per sweep; library profiles carry a versioned snapshot.
export const FORM_OPTIONS = [
  ['rect', 'Rektangel'],
  ['rhs', 'Rektangulärt rör'],
  ['circle', 'Cirkel'],
  ['chs', 'Cirkulärt rör'],
  ['triangle', 'Triangel (likbent)'],
  ['i', 'I-profil (förenklad)'],
];
export const isRound = (profile) => profile === 'circle' || profile === 'chs';
export const hasWall = (profile) => ['rhs', 'chs', 'i'].includes(profile);
export function normalizeForm(s) {
  if (isRound(s.profile)) s.height = s.width;
  return s;
}
