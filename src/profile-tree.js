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
export function libraryTree(profiles, search = '') {
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
      !`${label} ${family} ${versions.map((v) => v.name).join(' ')}`
        .toLocaleLowerCase('sv')
        .includes(search.trim().toLocaleLowerCase('sv'))
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
export function renderProfileTree(root, profiles, current, search, onSelect) {
  const expanded = new Map(
    [...root.querySelectorAll('details')].map((d) => [d.dataset.key, d.open]),
  );
  root.replaceChildren();
  const tree = libraryTree(profiles, search);
  const branch = (parent, key, label, active = false) => {
    const d = document.createElement('details');
    d.dataset.key = key;
    d.open = !!search || active || (expanded.get(key) ?? true);
    const summary = document.createElement('summary');
    summary.textContent = label;
    d.append(summary);
    parent.append(d);
    return d;
  };
  const item = (parent, p, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = `${p.name} · version ${p.revision}`;
    const selected = p.id === current.id && p.revision === current.revision;
    b.className = selected ? 'selected' : '';
    if (selected) b.setAttribute('aria-current', 'true');
    b.onclick = () => onSelect(p);
    parent.append(b);
  };
  for (const type of tree) {
    const td = branch(root, JSON.stringify([type.type]), type.label);
    for (const family of type.families) {
      const fd = branch(
        td,
        JSON.stringify([type.type, family.name]),
        `${family.name} (${family.sizes.length})`,
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
              .some((p) => p.id === current.id && p.revision === current.revision),
          );
          if (!expanded.has(history.dataset.key) && !search && current.id !== size.latest.id)
            history.open = false;
          for (const p of size.versions.slice(1)) item(history, p, `${p.name} · v${p.revision}`);
        }
      }
    }
  }
  if (!tree.length) {
    const p = document.createElement('p');
    p.className = 'inspector-note';
    p.textContent = profiles.length
      ? 'Inga profiler matchar sökningen.'
      : 'Inga sparade profiler. Ange typ, familj och storlek och spara en version.';
    root.append(p);
  }
}
