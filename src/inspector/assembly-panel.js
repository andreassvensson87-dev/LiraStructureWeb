import './assembly-panel.css';
import { assemblySeries, modelAssemblies } from '../assembly-series.js';
import { updateAssembly } from '../project/assemblies.js';
import { assemblyNumberStatus } from '../assembly-numbering.js';
import { designation } from '../object-identity.js';
import { partStatus } from '../part-marks.js';

export function installAssemblyPanel({ getState, commit, selectPart }) {
  const parent = document.getElementById('inspector-properties');
  const root = document.createElement('section');
  root.id = 'assembly-inspector';
  root.hidden = true;
  parent.append(root);
  let activeId, signature;
  const error = document.createElement('p');
  error.setAttribute('role', 'alert');
  error.className = 'assembly-inspector-error';
  const edit = (assembly, changes) => {
    try {
      const state = getState();
      const stored = state.assemblies.find((a) => a.id === assembly.id);
      const base = stored ? state : { ...state, assemblies: [...state.assemblies, assembly] };
      const patch = updateAssembly(base, assembly.id, { ...assembly, ...changes });
      if (
        JSON.stringify(patch.assemblies) !== JSON.stringify(state.assemblies) ||
        JSON.stringify(patch.drawings) !== JSON.stringify(state.drawings)
      )
        commit(patch);
    } catch (problem) {
      error.textContent = problem.message;
    }
  };
  root.addEventListener('input', (event) => event.stopPropagation());
  root.addEventListener('change', (event) => event.stopPropagation());
  return {
    sync() {
      const state = getState();
      const candidates =
        state.mode === 'assembly' && !state.operation && !state.drawing
          ? modelAssemblies(state).filter((a) =>
              a.memberIds.some((id) => state.selectedIds.has(id)),
            )
          : [];
      root.hidden = !candidates.length;
      parent.classList.toggle('assembly-inspector-active', !!candidates.length);
      if (!candidates.length) {
        signature = null;
        return;
      }
      const assembly = candidates.find((a) => a.id === activeId) || candidates[0];
      activeId = assembly.id;
      const key = JSON.stringify([
        candidates,
        activeId,
        state.selectedIds.size,
        state.parts,
        state.objects.filter((o) => assembly.memberIds.includes(o.id)),
      ]);
      if (key === signature) return;
      signature = key;
      root.replaceChildren();
      error.textContent = '';
      const heading = document.createElement('h1');
      heading.textContent = 'Assembly';
      root.append(heading);
      if (candidates.length > 1) {
        const picker = document.createElement('select');
        picker.setAttribute('aria-label', 'Assembly att redigera');
        for (const candidate of candidates)
          picker.append(new Option(`${candidate.mark} · ${candidate.name}`, candidate.id));
        picker.value = activeId;
        picker.onchange = () => {
          activeId = picker.value;
          signature = null;
          this.sync();
        };
        root.append(picker);
      }
      const mark = document.createElement('p');
      mark.className = 'assembly-inspector-mark';
      const markCaption = document.createElement('span');
      markCaption.textContent = 'Assembly mark';
      const markValue = document.createElement('strong');
      markValue.textContent = assembly.typeKey
        ? `${assembly.mark}${assemblyNumberStatus(assembly, state).valid ? '' : ' · kontroll krävs'}`
        : 'Ej numrerad';
      mark.append(markCaption, markValue);
      root.append(mark);
      const series = assemblySeries(assembly, state.objects);
      const fields = document.createElement('div');
      fields.className = 'assembly-series-fields numbering-series-fields';
      const inputs = {};
      for (const [name, labelText] of [
        ['prefix', 'Prefix'],
        ['start', 'Startnummer'],
      ]) {
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.setAttribute(
          'aria-label',
          name === 'start' ? 'Assemblystartnummer' : 'Assemblyprefix',
        );
        input.type = name === 'start' ? 'number' : 'text';
        input.setAttribute('data-independent-editor', '');
        input.value = series[name];
        if (name === 'start') {
          input.min = 1;
          input.max = 999999999;
          input.step = 1;
        } else input.maxLength = 16;
        inputs[name] = input;
        label.append(input);
        fields.append(label);
        input.onchange = () =>
          edit(assembly, {
            series: { prefix: inputs.prefix.value.trim(), start: Number(inputs.start.value) },
          });
        input.onblur = input.onchange;
        input.onkeydown = (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            input.onchange();
            input.blur();
          }
        };
      }
      root.append(fields, error);
      const caption = document.createElement('h2');
      caption.textContent = `Ingående delar · ${assembly.memberIds.length}`;
      root.append(caption);
      const list = document.createElement('ul');
      list.className = 'assembly-member-list';
      for (const id of assembly.memberIds) {
        const object = state.objects.find((o) => o.id === id);
        if (!object) continue;
        const main = id === assembly.mainId;
        const row = document.createElement('li');
        row.classList.toggle('assembly-main-member', main);
        if (main) row.title = 'Huvuddel';
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'assembly-member-pick';
        pick.title = `${object.name || designation(object)}${main ? ' · Huvuddel' : ''}`;
        pick.setAttribute(
          'aria-label',
          `Markera ${designation(object)}${main ? ' · Huvuddel' : ''}`,
        );
        const name = document.createElement('strong');
        name.textContent = designation(object);
        const part = document.createElement('span');
        part.textContent = partStatus(object, state.objects, state.parts).label;
        pick.append(name, part);
        pick.onclick = () => selectPart(id);
        row.append(pick);
        const makeMain = document.createElement('button');
        makeMain.type = 'button';
        makeMain.className = 'assembly-member-action';
        makeMain.textContent = '◇';
        makeMain.title = main ? 'Huvuddel' : 'Gör till huvuddel';
        makeMain.setAttribute('aria-label', `${makeMain.title} · ${designation(object)}`);
        makeMain.disabled = main;
        makeMain.onclick = () => edit(assembly, { mainId: id });
        row.append(makeMain);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'assembly-member-action';
        remove.textContent = '×';
        remove.title = main
          ? 'Välj en annan huvuddel innan delen tas ur assemblyn'
          : 'Ta ur assemblyn';
        remove.setAttribute('aria-label', `Ta ur ${designation(object)} ur assemblyn`);
        remove.disabled = main;
        remove.onclick = () =>
          edit(assembly, { memberIds: assembly.memberIds.filter((memberId) => memberId !== id) });
        row.append(remove);
        list.append(row);
      }
      root.append(list);
    },
  };
}
