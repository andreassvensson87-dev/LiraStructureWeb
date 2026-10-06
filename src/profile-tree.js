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
const treeStates = new WeakMap();
export function renderProfileTree(root, profiles, current, search, onSelect) {
  const state = treeStates.get(root) || { expanded: new Map(), search: '', selected: null };
  if (!state.search)
    for (const d of root.querySelectorAll('details')) state.expanded.set(d.dataset.key, d.open);
  const selectedKey = `${current?.id}:${current?.revision}`;
  const changedSelection = state.selected !== selectedKey;
  const focusKey = root.contains(document.activeElement)
    ? document.activeElement.dataset.key
    : null;
  const scrollTop = root.scrollTop;
  state.search = search.trim();
  state.selected = selectedKey;
  treeStates.set(root, state);
  root.replaceChildren();
  const tree = libraryGroups(profiles, search);
  const branch = (parent, key, label, active = false) => {
    const d = document.createElement('details');
    d.dataset.key = key;
    d.open = !!state.search || (active && changedSelection) || (state.expanded.get(key) ?? active);
    const summary = document.createElement('summary');
    summary.dataset.key = `summary:${key}`;
    summary.title = label;
    summary.textContent = label;
    d.append(summary);
    parent.append(d);
    return d;
  };
  const item = (parent, p, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.key = `profile:${p.id}:${p.revision}`;
    b.textContent = label;
    b.title = `${p.name} · version ${p.revision}`;
    const selected = p.id === current?.id && p.revision === current?.revision;
    b.className = selected ? 'selected' : '';
    if (selected) b.setAttribute('aria-current', 'true');
    b.onclick = () => onSelect(p);
    parent.append(b);
  };
  const activeSize = (size) =>
    size.versions.some((p) => p.id === current?.id && p.revision === current?.revision);
  for (const group of tree) {
    const count = group.families.reduce((n, f) => n + f.sizes.length, 0);
    const td = branch(
      root,
      JSON.stringify([group.id]),
      `${group.label} (${count})`,
      group.families.some((f) => f.sizes.some(activeSize)),
    );
    for (const family of group.families) {
      const fd = branch(
        td,
        JSON.stringify([group.id, family.type, family.name]),
        `${family.label} (${family.sizes.length})`,
        family.sizes.some(activeSize),
      );
      for (const size of family.sizes) {
        item(fd, size.latest, size.latest.name);
        if (size.versions.length > 1) {
          const history = branch(
            fd,
            'history:' + size.latest.id,
            `Äldre versioner · ${size.latest.name}`,
            size.versions
              .slice(1)
              .some((p) => p.id === current?.id && p.revision === current?.revision),
          );
          for (const p of size.versions.slice(1)) item(history, p, `${p.name} · v${p.revision}`);
        }
      }
    }
  }
  if (focusKey)
    [...root.querySelectorAll('[data-key]')].find((el) => el.dataset.key === focusKey)?.focus();
  if (!tree.length) {
    const p = document.createElement('p');
    p.className = 'inspector-note';
    p.textContent = profiles.length
      ? 'Inga profiler matchar sökningen.'
      : 'Inga sparade profiler. Ange typ, familj och storlek och spara en version.';
    root.append(p);
  }
  root.scrollTop = scrollTop;
}
