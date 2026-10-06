import { designation, typeName } from '../../object-identity.js';
import { objectQuantities } from '../object-quantities.js';
import { FORM_OPTIONS, isRound, hasWall } from '../../profile-forms.js';

const format = (value, unit, digits = 3) =>
  value == null
    ? '—'
    : `${value.toLocaleString('sv-SE', { maximumFractionDigits: digits })} ${unit}`;

export class ObjectInformation {
  constructor({ getObjects, getModel, partLabel }) {
    this.getObjects = getObjects;
    this.getModel = getModel;
    this.partLabel = partLabel;
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'object-information';
    this.dialog.setAttribute('aria-labelledby', 'object-information-title');
    this.dialog.innerHTML =
      '<header><strong id="object-information-title">Information</strong><button type="button" aria-label="Stäng objektinformation">×</button></header><div class="object-information-content"></div>';
    this.dialog.querySelector('button').onclick = () => this.dialog.close();
    this.dialog.addEventListener('keydown', (e) => e.stopPropagation());
    document.body.append(this.dialog);
  }
  open() {
    const objects = this.getObjects(),
      model = this.getModel();
    if (!objects.length) return;
    const content = this.dialog.querySelector('.object-information-content');
    content.replaceChildren();
    for (const object of objects) {
      const section = document.createElement('section');
      const title = document.createElement('h2');
      title.textContent = `${designation(object)} · ${object.name || typeName(object)}`;
      section.append(title);
      const details = document.createElement('dl');
      const row = (label, value) => {
        const key = document.createElement('dt'),
          data = document.createElement('dd');
        key.textContent = label;
        data.textContent = value;
        details.append(key, data);
      };
      row('Objekttyp', typeName(object));
      row('Part mark', this.partLabel(object));
      const profile = object.profile === 'custom' ? object.section : null;
      const dimensions = object.profile
        ? `${FORM_OPTIONS.find(([id]) => id === object.profile)?.[1] || ''} · ${isRound(object.profile) ? `Ø ${object.width}` : `${object.width} × ${object.height}`}${hasWall(object.profile) ? ` × ${object.thickness}` : ''} mm`
        : '—';
      row('Profil', profile?.name || object.spec?.name || dimensions);
      if (profile) row('Profilversion', String(profile.revision));
      row('Material', object.material?.name || 'Inget material');
      if (object.material) row('Materialversion', String(object.material.revision));
      try {
        const q = objectQuantities(object, model);
        if (q) {
          row('Densitet', format(q.densityKgM3, 'kg/m³'));
          if (q.densitySource === 'profile')
            row('Densitetsgrund', 'Profilens nominella densitet · material saknas');
          if (q.lengthMm != null) row('Axellängd', format(q.lengthMm, 'mm'));
          if (q.areaMm2 != null)
            row(object.profile ? 'Tvärsnittsarea' : 'Plattarea', format(q.areaMm2 * 1e-6, 'm²', 6));
          if (object.thickness && !object.profile) row('Tjocklek', format(object.thickness, 'mm'));
          row('Bruttovolym', format(q.grossVolumeM3, 'm³', 6));
          row('Nettovolym', format(q.volumeM3, 'm³', 6));
          if (q.massPerMeter != null)
            row('Massa per meter · oskuren profil', format(q.massPerMeter, 'kg/m'));
          row('Vikt', format(q.massKg, 'kg'));
          if (q.cutCount) row('Bearbetningar', String(q.cutCount));
          if (q.approximate)
            row(
              'Beräkningsgrund',
              'Rundningar och bearbetningar följer modellens geometriska upplösning.',
            );
        }
      } catch (error) {
        row('Mängdberäkning', error.message);
      }
      if (object.start) row('Start · XYZ', object.start.map((v) => format(v, 'mm')).join(' · '));
      if (object.end) row('Slut · XYZ', object.end.map((v) => format(v, 'mm')).join(' · '));
      row('Objekt-ID', object.id);
      section.append(details);
      content.append(section);
    }
    this.dialog.showModal();
  }
}
