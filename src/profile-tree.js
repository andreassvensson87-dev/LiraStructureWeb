import { renderLibraryTree } from './ui/library-tree.js';
export const PROFILE_TYPES = [
  ['h', 'H-profil'],
  ['i', 'I-profil'],
  ['u', 'U-profil'],
  ['c', 'C-profil med läppar'],
  ['l', 'L-profil'],
  ['t', 'T-profil'],
  ['rect', 'Rektangel'],
  ['rhs', 'Rektangulärt rör'],
  ['circle', 'Cirkel'],
  ['chs', 'Cirkulärt rör'],
  ['triangle', 'Triangel'],
  ['custom', 'Övrig'],
];
export const profileType = (p) =>
  PROFILE_TYPES.some(([key]) => key === p.profileType) ? p.profileType : 'custom';
const PROFILE_GROUPS = [
  ['beams', 'Balkar', ['h', 'i', 'u']],
  ['hollow', 'Hålprofiler', ['rhs', 'chs']],
  ['bars', 'Stänger', ['l', 't', 'rect', 'circle']],
  ['timber', 'Trä', []],
  ['formed', 'Kallformade profiler', ['c']],
  ['other', 'Övriga profiler', ['triangle', 'custom']],
];
export function libraryTree(profiles, search = '') {
  const query = search.trim().toLocaleLowerCase('sv').replace(/\s/g, '');
  const sizes = new Map();
  for (const p of profiles) {
    if (!sizes.has(p.id)) sizes.set(p.id, []);
    sizes.get(p.id).push(p);
  }
  const types = new Map();
  for (const versions of sizes.values()) {
    versions.sort((a, b) => b.revision - a.revision);
    const latest = versions[0],
      type = profileType(latest),
      family = latest.family?.trim() || 'Utan familj',
      label = PROFILE_TYPES.find(([key]) => key === type)[1];
    if (
      !`${label} ${family} ${PROFILE_GROUPS.find(([id]) => id === latest.libraryGroup)?.[1] || ''} ${versions.flatMap((v) => [v.name, v.standard || '', ...(v.aliases || [])]).join(' ')}`
        .toLocaleLowerCase('sv')
        .replace(/\s/g, '')
        .includes(query)
    )
      continue;
    if (!types.has(type)) types.set(type, { type, label, families: new Map() });
    const families = types.get(type).families;
    if (!families.has(family)) families.set(family, []);
    families.get(family).push({ latest, versions });
  }
  return [...types.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'sv'))
    .map((t) => ({
      ...t,
      families: [...t.families]
        .sort(([a], [b]) => a.localeCompare(b, 'sv'))
        .map(([name, sizes]) => ({
          name,
          sizes: sizes.sort((a, b) =>
            a.latest.name.localeCompare(b.latest.name, 'sv', { numeric: true }),
          ),
        })),
    }));
}
export function libraryGroups(profiles, search = '') {
  const tree = libraryTree(profiles, search);
  return PROFILE_GROUPS.map(([id, label, types]) => ({
    id,
    label,
    families: tree
      .flatMap((t) =>
        t.families.map((f) => ({
          ...f,
          sizes: f.sizes.filter(({ latest }) =>
            PROFILE_GROUPS.some(([group]) => group === latest.libraryGroup)
              ? latest.libraryGroup === id
              : types.includes(t.type),
          ),
          type: t.type,
          label: f.name === 'Utan familj' ? t.label : f.name,
        })),
      )
      .filter((f) => f.sizes.length)
      .sort((a, b) => a.label.localeCompare(b.label, 'sv', { numeric: true })),
  })).filter((g) => g.families.length);
}
export function renderProfileTree(root, profiles, current, search, onSelect) {
  const item = (profile, label = profile.name) => ({
    key: `${profile.id}:${profile.revision}`,
    label,
    title: `${profile.name} · version ${profile.revision}`,
    value: profile,
  });
  const nodes = libraryGroups(profiles, search).map((group) => ({
    key: JSON.stringify([group.id]),
    label: group.label,
    count: group.families.reduce((n, family) => n + family.sizes.length, 0),
    children: group.families.map((family) => ({
      key: JSON.stringify([group.id, family.type, family.name]),
      label: family.label,
      count: family.sizes.length,
      children: family.sizes.flatMap((size) => [
        item(size.latest),
        ...(size.versions.length > 1
          ? [
              {
                key: 'history:' + size.latest.id,
                label: `Äldre versioner · ${size.latest.name}`,
                children: size.versions
                  .slice(1)
                  .map((profile) => item(profile, `${profile.name} · v${profile.revision}`)),
              },
            ]
          : []),
      ]),
    })),
  }));
  renderLibraryTree(root, {
    nodes,
    selectedKey: `${current?.id}:${current?.revision}`,
    query: search,
    onSelect: (node) => onSelect(node.value),
    empty: profiles.length
      ? 'Inga profiler matchar sökningen.'
      : 'Inga sparade profiler. Skapa en profil eller importera ett bibliotek.',
  });
}
