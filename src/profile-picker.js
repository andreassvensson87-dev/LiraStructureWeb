import { profileSnapshot } from './section-profile.js';
import { PROFILE_TYPES } from './profile-tree.js';
import { SearchPicker } from './search-picker.js';
export class ProfilePicker {
  constructor(root, { profiles, apply }) {
    this.profiles = profiles;
    root.innerHTML =
      '<div class="profile-search"></div><p class="inspector-note" role="alert"></p>';
    this.message = root.querySelector('p');
    this.picker = new SearchPicker(root.querySelector('div'), {
      label: 'Sök biblioteksprofil',
      placeholder: 'Sök profil, familj eller typ…',
      onSelect: (p) => {
        try {
          apply(p.parameters ? profileSnapshot(p) : structuredClone(p));
          this.message.textContent = '';
        } catch (e) {
          this.message.textContent = e.message;
        }
      },
    });
  }
  render(current) {
    const latest = new Map();
    for (const p of this.profiles())
      if (!latest.has(p.id) || latest.get(p.id).revision < p.revision) latest.set(p.id, p);
    const all = [...latest.values()];
    if (current && !all.some((p) => p.id === current.id && p.revision === current.revision))
      all.push(current);
    this.picker.set(
      all.map((p) => ({
        label: p.name,
        searchText: `${p.name} ${(p.aliases || []).join(' ')} ${p.family || ''} ${p.standard || ''}`
          .toLocaleLowerCase('sv')
          .replace(/\s/g, ''),
        detail: `${PROFILE_TYPES.find(([id]) => id === p.profileType)?.[1] || 'Övrig'} · ${p.family || 'Övrig'} · v${p.revision}`,
        value: p,
      })),
      current?.name,
    );
    this.message.textContent = all.length
      ? ''
      : 'Biblioteket är tomt. Lägg till en profil via biblioteket.';
  }
}
