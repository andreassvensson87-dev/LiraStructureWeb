import * as THREE from 'three';
import { isRound, hasWall, normalizeForm } from '../../profile-forms.js';
import { isPlate, isHelper } from '../../model-object.js';
import { contours, profileAnchor } from '../../sweep.js';
import { isFastener } from '../../fasteners/object-type.js';
export function createSweepForm({
  project,
  tools,
  ui,
  getProfilePicker,
  getInspector = () => null,
  fillPlate,
  save,
  updateTypedLength,
  updatePointer,
  clearPreview,
  remember,
}) {
  const $ = (id) => document.getElementById(id),
    fmt = (n) => n.toLocaleString('sv-SE', { maximumFractionDigits: 3 });
  $('rotation').title = 'Shift + mellanslag: rotera markerade sweeps 90°';
  document.querySelectorAll('[data-placement-h]').forEach((button) => {
    button.title = `${button.getAttribute('aria-label') || button.title} · Shift + piltangent: flytta insättningspunkten`;
  });
  function readForm() {
    const source = ui.selected ? project.objects.find((s) => s.id === ui.selected) : null;
    const profileUp =
      source?.profileUp ??
      (!ui.selected && tools.temporaryPlane
        ? new THREE.Vector3(...tools.temporaryPlane.u)
            .cross(new THREE.Vector3(...tools.temporaryPlane.v))
            .normalize()
            .toArray()
        : null);
    return normalizeForm({
      ...(profileUp ? { profileUp: [...profileUp] } : {}),
      ...($('profile').value === 'custom' && ui.formSection
        ? { section: structuredClone(ui.formSection) }
        : {}),
      placement: { ...ui.placement },
      profile: $('profile').value,
      width: +$('width').value,
      height: +$('height').value,
      thickness: +$('thickness').value,
      rotation: +$('rotation').value,
      start: ['sx', 'sy', 'sz'].map((k) => +$(k).value),
      end: ['ex', 'ey', 'ez'].map((k) => +$(k).value),
    });
  }
  function fillForm(s) {
    if (s.type === 'component' || isHelper(s) || isFastener(s)) return;
    ui.libraryMode = s.profile === 'custom';
    if (isPlate(s)) {
      fillPlate(s);
      return;
    }
    ui.formSection = s.section ? structuredClone(s.section) : null;
    ui.placement = { horizontalAlignment: 'center', verticalAlignment: 'center', ...s.placement };
    for (const k of ['profile', 'width', 'height', 'thickness', 'rotation']) $(k).value = s[k];
    ['sx', 'sy', 'sz'].forEach((k, i) => ($(k).value = s.start[i]));
    ['ex', 'ey', 'ez'].forEach((k, i) => ($(k).value = s.end[i]));
    updateForm();
  }
  function updateForm() {
    const round = isRound($('profile').value);
    if (round) $('height').value = $('width').value;
    const custom = $('profile').value === 'custom' && ui.formSection;
    if (custom) {
      $('width').value = ui.formSection.properties.bounds.width;
      $('height').value = ui.formSection.properties.bounds.height;
    }
    $('width').disabled = $('height').disabled = !!custom;
    $('section-reference').hidden = !custom;
    $('section-reference').textContent = custom
      ? `${ui.formSection.name} · v${ui.formSection.revision}`
      : '';
    const s = readForm();
    const library = ui.libraryMode || !!custom;
    $('profile-source-form').setAttribute('aria-pressed', String(!library));
    $('profile-source-library').setAttribute('aria-pressed', String(library));
    $('profile-kind-field').hidden = library;
    $('profile-quick-picker').hidden = !library;
    $('section-library-open').hidden = !library;
    getProfilePicker()?.render(custom ? ui.formSection : null);
    $('profile-height-field').hidden = round;
    $('profile-width-label').textContent = round
      ? 'Diameter'
      : s.profile === 'triangle'
        ? 'Bas'
        : 'Bredd';
    $('thickness-field').hidden = !hasWall(s.profile);
    $('thickness').disabled = !hasWall(s.profile);
    $('profile-dimensions').textContent = custom
      ? ''
      : (round ? 'Ø ' + fmt(s.width) : fmt(s.width) + ' × ' + fmt(s.height)) +
        (hasWall(s.profile) ? ' × ' + fmt(s.thickness) : '') +
        ' mm';
    $('length').textContent = fmt(Math.hypot(...s.end.map((v, i) => v - s.start[i]))) + ' mm';
    $('error').textContent = '';
    const paths = contours(s),
      bounds = custom ? ui.formSection.properties.bounds : null;
    $('cross-section').setAttribute(
      'viewBox',
      bounds
        ? `${bounds.minX - s.width * 0.15} ${-bounds.maxY - s.height * 0.15} ${s.width * 1.3} ${s.height * 1.3}`
        : `${-s.width * 0.65} ${-s.height * 0.65} ${s.width * 1.3} ${s.height * 1.3}`,
    );
    $('cross-section').innerHTML =
      `<path d="${paths.map((p) => 'M' + p.map((v) => v.join(',')).join('L') + 'Z').join(' ')}" fill="#528a80" fill-rule="evenodd" transform="scale(1,-1)"/><circle cx="${profileAnchor(s)[0]}" cy="${-profileAnchor(s)[1]}" r="${Math.max(s.width, s.height) * 0.045}" fill="#183e34" stroke="white" stroke-width="${Math.max(s.width, s.height) * 0.015}"/>`;
    document
      .querySelectorAll('[data-placement-h]')
      .forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String(
            b.dataset.placementH === ui.placement.horizontalAlignment &&
              b.dataset.placementV === ui.placement.verticalAlignment,
          ),
        ),
      );
    const h = { left: 'Vänster', center: 'Centrum', right: 'Höger' }[
        ui.placement.horizontalAlignment
      ],
      v = { top: 'uppe', center: 'mitten', bottom: 'nere' }[ui.placement.verticalAlignment];
    if ($('sweep-placement-summary')) $('sweep-placement-summary').textContent = `${h} · ${v}`;
  }
  document.querySelectorAll('[data-placement-h]').forEach(
    (b) =>
      (b.onclick = () => {
        const inspector = getInspector();
        if (inspector?.multiEditing) {
          inspector.stage((s) => ({
            ...s,
            placement: {
              horizontalAlignment: b.dataset.placementH,
              verticalAlignment: b.dataset.placementV,
            },
          }));
          return;
        }
        ui.placement = {
          horizontalAlignment: b.dataset.placementH,
          verticalAlignment: b.dataset.placementV,
        };
        updateForm();
        if (ui.selected) save(readForm());
        else {
          remember?.();
        }
        if (tools.drawing && tools.first) {
          if ($('draw-length').value.trim()) updateTypedLength();
          else if (tools.lastPointer) updatePointer(tools.lastPointer);
        }
      }),
  );
  $('form').addEventListener('input', () => {
    if (getInspector()?.multiEditing) return;
    clearPreview();
    updateForm();
    remember?.();
  });

  return { readForm, fillForm, updateForm };
}
