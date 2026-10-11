import { createHatchControl } from './hatch-control.js';
import { materialHatch } from './material-hatch.js';

export function installMaterialHatch(form) {
  const control = createHatchControl({ label: 'Hatchning i sektion' });
  form.querySelector('#material-color').parentElement.after(control.root);
  form.closest('dialog').addEventListener('close', control.close);
  return { set: (material) => control.set(materialHatch(material)), get: control.get };
}
