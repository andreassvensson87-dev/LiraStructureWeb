import { planReferenceConversion, conversionObjects, conversionProfile } from './conversion.js';
import { profileSnapshot } from '../section-profile.js';
import { profileLibraryNodes } from '../profile-tree.js';
import { createLibraryTreePicker } from '../ui/library-tree-picker.js';
import { installDialogPresentation } from '../ui/dialog-presentation.js';
import { renderProfilePreview } from '../ui/profile-preview.js';
import './conversion.css';

/** One selected IFC object's detached conversion draft; only commit changes the model. */
export function installReferenceConversion({
  getObjects,
  getProfiles,
  openProfileLibrary,
  commit,
}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'reference-conversion';
  dialog.setAttribute('aria-labelledby', 'reference-conversion-title');
  dialog.innerHTML = `<div class="panel-title"><h2 id="reference-conversion-title">Konvertera IFC-objekt</h2><button type="button" data-close aria-label="Stäng konvertering">×</button></div>
    <p data-source></p><label class="field">Typ<input data-type readonly></label>
    <section data-profile><h3>Profil</h3><p data-suggestion role="status"></p><div class="reference-conversion-profile"><div data-picker></div><svg aria-label="Förhandsvisning av vald profil"></svg></div><button type="button" data-library>Öppna profilbibliotek…</button></section>
    <p data-summary></p><p data-error role="alert"></p><footer><button type="button" data-close>Avbryt</button><button type="button" data-convert class="primary">Konvertera</button></footer>`;
  document.body.append(dialog);
  const $ = (selector) => dialog.querySelector(selector);
  let row = null,
    rows = [],
    sourceSection = null;
  const profiles = () => {
    const all = [...(getProfiles?.() || [])];
    if (
      sourceSection &&
      !all.some((p) => p.id === sourceSection.id && p.revision === sourceSection.revision)
    )
      all.push(sourceSection);
    return all;
  };
  function apply(section) {
    if (!dialog.open || !row?.object) return;
    try {
      row.object = conversionProfile(
        row.object,
        Array.isArray(section.parameters) ? profileSnapshot(section) : section,
      );
      $('[data-error]').textContent = '';
      sync();
    } catch (error) {
      $('[data-error]').textContent = error.message;
    }
  }
  const picker = createLibraryTreePicker({
    label: 'Vald profil',
    placeholder: 'Välj profil',
    searchLabel: 'Sök konverteringsprofil',
    searchPlaceholder: 'Sök profil, familj eller typ…',
    emptyLabel: 'Inga profiler.',
    icon: 'profile',
    getNodes: (query) => {
      const suggested = (row?.profileMatch?.alternatives || []).filter(
        (c) =>
          !query.trim() ||
          c.section.name
            .toLocaleLowerCase('sv')
            .replace(/\s/g, '')
            .includes(query.toLocaleLowerCase('sv').replace(/\s/g, '')),
      );
      return [
        ...(suggested.length
          ? [
              {
                key: 'conversion-suggestions',
                label: 'Profilförslag',
                children: suggested.map((c) => ({
                  key: 'suggestion:' + c.section.id + ':' + c.section.revision,
                  label: c.section.name,
                  value: c.section,
                  icon: 'profile',
                })),
              },
            ]
          : []),
        ...profileLibraryNodes(profiles(), query),
      ];
    },
    getSelection: () => ({
      key: `${row?.object?.section?.id}:${row?.object?.section?.revision}`,
      label: row?.object?.section?.name,
    }),
    onSelect: (node) => apply(node.value),
  });
  $('[data-picker]').append(picker.root);
  function sync() {
    picker.sync();
    if (row?.object?.section) renderProfilePreview($('svg[aria-label]'), row.object.section);
    $('[data-convert]').disabled = !row?.object;
  }
  $('[data-library]').onclick = () => {
    const current = row;
    openProfileLibrary?.((section) => {
      if (row === current && dialog.open) apply(section);
    });
  };
  for (const button of dialog.querySelectorAll('[data-close]'))
    button.onclick = () => dialog.close();
  $('[data-convert]').onclick = () => {
    try {
      const added = conversionObjects(rows, getObjects());
      if (added.length) commit(added);
      dialog.close();
    } catch (error) {
      $('[data-error]').textContent = error.message;
    }
  };
  dialog.onkeydown = (event) => event.stopPropagation();
  dialog.addEventListener('close', () => {
    picker.close();
    row = null;
    rows = [];
    sourceSection = null;
  });
  installDialogPresentation(dialog);
  return (model, selectedIds) => {
    if (selectedIds?.length !== 1) return;
    rows = planReferenceConversion(model, getObjects(), selectedIds, getProfiles?.());
    row = rows[0] || null;
    sourceSection = row?.object?.section || null;
    $('[data-source]').textContent = `${model.title} · ${row?.name || 'IFC-objekt'}`;
    $('[data-type]').value =
      row?.kind === 'plate' ? 'Plate' : row?.kind === 'sweep' ? 'Sweep' : '—';
    $('[data-error]').textContent = row?.reason || '';
    const match = row?.profileMatch,
      suggestion = match?.suggestion;
    $('[data-profile]').hidden =
      row?.object?.type === 'plate' || (!row?.object && !suggestion && !match?.alternatives.length);
    $('.reference-conversion-profile').hidden = !row?.object;
    $('[data-library]').hidden = !row?.object;
    $('[data-suggestion]').textContent =
      match?.status === 'verified'
        ? `Verifierad profil: ${suggestion.section.name} · ${suggestion.reasons.includes('profile-dimensions') ? 'IFC-profilmått' : 'kontur'} stämmer med biblioteket.`
        : match?.status === 'probable'
          ? `Troligt förslag: ${suggestion.section.name} · behöver bekräftas manuellt.`
          : match?.status === 'ambiguous'
            ? `Flera möjliga profiler: ${match.alternatives.map((c) => c.section.name).join(', ')}. Ingen väljs automatiskt.`
            : 'Ingen säker profilmatchning. IFC-konturen behålls tills du väljer en profil.';
    const notes = {
      'coarse-tessellation': 'Visningsgeometrin har förenklade rundningar.',
      'property-dimensions-conflict': 'Egenskapsmått avviker från IFC-profilen.',
      'profile-name-conflict': 'IFC-beteckningen skiljer sig från bibliotekets.',
      'mapped-scale': 'IFC-geometrin har en separat skalning.',
      'unknown-length-unit': 'IFC-profilens längdenhet kunde inte fastställas.',
    };
    const warnings = [
      ...new Set((match?.warnings || []).map((code) => notes[code]).filter(Boolean)),
    ];
    if (warnings.length) $('[data-suggestion]').textContent += ' ' + warnings.join(' ');
    $('[data-suggestion]').title = match?.conflicts.length
      ? 'Uppgifterna i IFC-filen och biblioteket stämmer inte överens.'
      : '';
    $('[data-summary]').textContent =
      row?.object?.type === 'sweep'
        ? 'Start- och slutpunkt behålls. Referensmodellen behålls.'
        : row?.object
          ? 'Plåtens kontur och tjocklek behålls. Referensmodellen behålls.'
          : '';
    sync();
    dialog.showModal();
  };
}
