import { planAssemblyNumbering, applyAssemblyNumbering } from './assembly-numbering.js';

export async function numberAssembliesWithDrawings(manager) {
  const plan = planAssemblyNumbering(manager.getState());
  const choices = {};
  const conflicts = plan.groups.filter((g) => g.requiresChoice);
  if (conflicts.length) {
    const accepted = await new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'drawing-workflow';
      dialog.setAttribute('aria-label', 'Slå ihop assemblyritningar');
      const title = document.createElement('h2');
      title.textContent = 'Lika assemblies har flera ritningar';
      const intro = document.createElement('p');
      intro.textContent =
        'Välj ritningen som ska behållas för varje typ. Övriga ritningar tas bort. Hela numreringen kan ångras.';
      dialog.append(title, intro);
      for (const group of conflicts) {
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = `${group.mark} · ${group.name}`;
        fieldset.append(legend);
        for (const drawing of group.candidates) {
          const label = document.createElement('label');
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = group.mark;
          radio.value = drawing.id;
          radio.required = true;
          radio.onchange = () => {
            choices[group.key] = drawing.id;
          };
          label.append(
            radio,
            `${drawing.number} · ${drawing.name} · ${(drawing.annotations || []).length} ritningsanteckningar`,
          );
          fieldset.append(label);
        }
        dialog.append(fieldset);
      }
      const form = document.createElement('form');
      const apply = document.createElement('button');
      apply.textContent = 'Numrera och behåll valda ritningar';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Avbryt';
      form.append(apply, cancel);
      dialog.append(form);
      form.onsubmit = (event) => {
        event.preventDefault();
        if (conflicts.every((g) => choices[g.key])) {
          dialog.returnValue = 'apply';
          dialog.close();
        }
      };
      cancel.onclick = () => dialog.close();
      dialog.addEventListener('keydown', (event) => event.stopPropagation());
      dialog.addEventListener(
        'close',
        () => {
          const accepted = dialog.returnValue === 'apply';
          dialog.remove();
          resolve(accepted);
        },
        { once: true },
      );
      document.body.append(dialog);
      dialog.showModal();
    });
    if (!accepted) return false;
  }
  const patch = applyAssemblyNumbering(plan, choices);
  if (
    ['assemblies', 'drawings', 'assemblyNumbering'].some(
      (key) => JSON.stringify(patch[key]) !== JSON.stringify(plan.state[key]),
    )
  )
    manager.changeAssemblies(patch);
  manager.render();
  return true;
}
