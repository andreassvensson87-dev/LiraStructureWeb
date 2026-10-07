import './ui.css';
import {
  defaultNumberingSettings,
  validateNumberingSettings,
  planNumbering,
  applyNumbering,
} from './plan.js';
const statuses = { new: 'Nytt', changed: 'Ändrat', unchanged: 'Oförändrat' };
const preferenceKey = 'lira-numbering-settings-v1';
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};
export function installNumbering({
  getState,
  beforeOpen,
  commit,
  highlight,
  zoom,
  onClose = () => {},
}) {
  let settings = defaultNumberingSettings();
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    if (saved) settings = validateNumberingSettings(saved);
  } catch {
    /* Use defaults if the saved settings are unavailable. */
  }
  const dialog = element('dialog', null, 'numbering-dialog');
  dialog.setAttribute('aria-labelledby', 'numbering-title');
  dialog.innerHTML = `<header><h2 id="numbering-title">Numrering</h2><div><button type="button" class="numbering-model-toggle" hidden>Visa modellen</button><button type="button" aria-label="Stäng numrering">×</button></div></header>
    <nav class="numbering-tabs" role="tablist" aria-label="Numrering">
      <button id="numbering-settings-tab" role="tab" aria-controls="numbering-settings" aria-selected="true">Inställningar</button>
      <button id="numbering-preview-tab" role="tab" aria-controls="numbering-preview" aria-selected="false">Förhandsgranskning</button>
    </nav>
    <section id="numbering-settings" role="tabpanel" aria-labelledby="numbering-settings-tab">
      <p>Hela modellen · Befintliga nummer behålls för oförändrade typer.</p>
      <fieldset class="numbering-kinds"><legend>Numrera</legend>
        <label><input type="checkbox" name="parts">Detaljer</label>
        <label><input type="checkbox" name="assemblies">Assemblies</label>
      </fieldset>
      <h3>Nummerserier för nya typer</h3>
      <table class="numbering-series"><thead><tr><th>Typ</th><th>Prefix</th><th>Startnummer</th></tr></thead><tbody></tbody></table>
      <p class="numbering-note">Lika geometri, profil, material och bearbetningar ger samma detaljnummer. Assemblies jämförs även utifrån delarnas placering och huvuddel.</p>
    </section>
    <section id="numbering-preview" role="tabpanel" aria-labelledby="numbering-preview-tab" hidden>
      <p class="numbering-summary" aria-live="polite"></p>
      <div class="numbering-filters" role="group" aria-label="Filtrera numreringsresultat"></div>
      <div class="numbering-table-scroll"><table class="numbering-results"><thead><tr><th>Status</th><th>Objekt</th><th>Antal</th><th>Tidigare</th><th>Föreslaget</th></tr></thead><tbody></tbody></table></div>
      <p class="numbering-empty" hidden>Inga objekt att visa.</p>
      <div class="numbering-conflicts"></div>
    </section>
    <p class="numbering-error" role="alert"></p>
    <footer><span>Inga nummer ändras förrän du väljer Tilldela nummer.</span><div><button type="button" data-action="cancel">Avbryt</button><button type="button" data-action="apply" class="primary">Förhandsgranska</button></div></footer>`;
  const $ = (selector) => dialog.querySelector(selector);
  const modelToggle = $('.numbering-model-toggle');
  const showModel = (visible) => {
    dialog.classList.toggle('numbering-model-view', visible);
    modelToggle.textContent = visible ? 'Tillbaka till listan' : 'Visa modellen';
    modelToggle.setAttribute('aria-expanded', String(!visible));
  };
  modelToggle.onclick = () => showModel(!dialog.classList.contains('numbering-model-view'));
  let plan = null,
    filter = 'all',
    tab = 'settings',
    choices = { part: {}, assembly: {} },
    resolve = null,
    assigned = false;
  const apply = $('[data-action="apply"]');
  const show = (next) => {
    tab = next;
    modelToggle.hidden = tab !== 'preview';
    for (const name of ['settings', 'preview']) {
      $('#numbering-' + name).hidden = name !== tab;
      const button = $('#numbering-' + name + '-tab');
      button.setAttribute('aria-selected', String(name === tab));
      button.tabIndex = name === tab ? 0 : -1;
    }
    apply.textContent = tab === 'settings' ? 'Förhandsgranska' : 'Tilldela nummer';
    apply.disabled =
      tab === 'preview' &&
      (!plan?.rows.length || plan.conflicts.some((g) => !choices[g.kind][g.key]));
  };
  for (const name of ['parts', 'assemblies']) {
    const input = $(`[name="${name}"]`);
    input.checked = settings[name];
  }
  for (const [type, label] of [
    ['sweep', 'Sweep'],
    ['plate', 'Plate'],
    ['assembly', 'Assembly'],
  ]) {
    const row = element('tr');
    row.append(element('td', label));
    for (const key of ['prefix', 'start']) {
      const cell = element('td'),
        input = element('input');
      input.type = key === 'start' ? 'number' : 'text';
      input.value = settings.series[type][key];
      input.dataset.series = type;
      input.dataset.key = key;
      input.setAttribute('aria-label', `${label} ${key === 'start' ? 'startnummer' : 'prefix'}`);
      if (key === 'start') {
        input.min = 1;
        input.max = 999999999;
        input.step = 1;
      } else input.maxLength = 16;
      cell.append(input);
      row.append(cell);
    }
    $('.numbering-series tbody').append(row);
  }
  const readSettings = () => {
    const next = defaultNumberingSettings();
    for (const name of ['parts', 'assemblies']) next[name] = $(`[name="${name}"]`).checked;
    for (const input of dialog.querySelectorAll('[data-series]'))
      next.series[input.dataset.series][input.dataset.key] =
        input.dataset.key === 'start' ? Number(input.value) : input.value.trim();
    return validateNumberingSettings(next);
  };
  const renderRows = () => {
    const body = $('.numbering-results tbody');
    body.replaceChildren();
    const order = { changed: 0, new: 1, unchanged: 2 };
    const rows = plan.rows
      .filter((row) => filter === 'all' || row.status === filter)
      .sort((a, b) => order[a.status] - order[b.status]);
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = element('tr', null, 'numbering-' + row.status);
      tr.append(element('td', statuses[row.status]));
      const cell = element('td'),
        button = element('button', row.label);
      button.title = 'Markera objekten i modellen';
      const ids = [...new Set(row.ids)];
      const select = () => {
        for (const selected of body.querySelectorAll('.numbering-selected'))
          selected.classList.remove('numbering-selected');
        tr.classList.add('numbering-selected');
        highlight(ids);
      };
      tr.onclick = (event) => {
        if (!event.target.closest('.numbering-expand, .numbering-zoom')) select();
      };
      button.onclick = (event) => {
        event.stopPropagation();
        select();
      };
      const label = element('div', null, 'numbering-object');
      {
        const toggle = element('button', null, 'numbering-expand');
        toggle.type = 'button';
        toggle.innerHTML =
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>';
        toggle.setAttribute('aria-label', `Visa detaljer för ${row.previous} → ${row.proposed}`);
        toggle.setAttribute('aria-expanded', 'false');
        let detail = null;
        toggle.onclick = () => {
          if (!detail) {
            detail = element('tr', null, 'numbering-detail');
            detail.id = 'numbering-detail-' + rows.indexOf(row);
            const content = element('td');
            content.colSpan = 5;
            if (row.reasons.length) content.append(element('div', row.reasons.join(' · ')));
            const list = element('ul', null, 'numbering-members');
            const objects = new Map(plan.state.objects.map((object) => [object.id, object]));
            for (const id of ids) {
              const object = objects.get(id),
                item = element('li'),
                member = element('button', object?.name || id);
              member.type = 'button';
              member.title = `Visa objekt ${id} i modellen`;
              member.onclick = () => {
                highlight([id]);
                zoom?.([id]);
                showModel(true);
              };
              item.append(member, element('span', ` · ${id}`));
              list.append(item);
            }
            content.append(list);
            detail.append(content);
            tr.after(detail);
            toggle.setAttribute('aria-controls', detail.id);
          }
          const expanded = toggle.getAttribute('aria-expanded') !== 'true';
          detail.hidden = !expanded;
          toggle.setAttribute('aria-expanded', String(expanded));
        };
        label.append(toggle);
      }
      label.append(button);
      if (zoom) {
        const fit = element('button', null, 'numbering-zoom');
        fit.type = 'button';
        fit.setAttribute('aria-label', `Zooma till ${row.label} · ${row.proposed}`);
        fit.title = 'Zooma till objekten i modellen';
        fit.innerHTML =
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4"/></svg>';
        fit.onclick = () => {
          select();
          zoom(ids);
          showModel(true);
        };
        label.append(fit);
      }
      cell.append(label);
      tr.append(cell);
      for (const value of [row.count, row.previous, row.proposed])
        tr.append(element('td', String(value)));
      fragment.append(tr);
    }
    body.append(fragment);
    $('.numbering-empty').hidden = rows.length > 0;
    for (const button of $('.numbering-filters').children)
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  };
  const preview = () => {
    try {
      settings = readSettings();
      plan = planNumbering(getState(), settings);
      choices = { part: {}, assembly: {} };
      filter = 'all';
      $('.numbering-error').textContent = '';
      const counts = Object.fromEntries(
        Object.keys(statuses).map((status) => [
          status,
          plan.rows.filter((r) => r.status === status).reduce((n, r) => n + r.count, 0),
        ]),
      );
      $('.numbering-summary').textContent =
        `Hela modellen · ${counts.new} ${counts.new === 1 ? 'nytt' : 'nya'} · ${counts.changed} ${counts.changed === 1 ? 'ändrat' : 'ändrade'} · ${counts.unchanged} ${counts.unchanged === 1 ? 'oförändrat' : 'oförändrade'}`;
      const filters = $('.numbering-filters');
      filters.replaceChildren();
      for (const [key, title] of [
        ['all', 'Alla'],
        ['changed', 'Ändrade'],
        ['new', 'Nya'],
        ['unchanged', 'Oförändrade'],
      ]) {
        const button = element('button', title);
        button.dataset.filter = key;
        button.onclick = () => {
          filter = key;
          renderRows();
        };
        filters.append(button);
      }
      const conflicts = $('.numbering-conflicts');
      conflicts.replaceChildren();
      if (plan.conflicts.length)
        conflicts.append(
          element(
            'p',
            'Lika typer har flera ritningar. Välj vilken ritning som ska behållas. Övriga ritningar i gruppen tas bort från den aktiva listan. Hela tilldelningen kan ångras.',
          ),
        );
      for (const group of plan.conflicts) {
        const label = element('label', `${group.mark} · Behåll ritning`),
          select = element('select');
        select.setAttribute('aria-label', `Behåll ritning för ${group.mark}`);
        select.append(new Option('Välj ritning…', ''));
        for (const d of group.candidates)
          select.append(new Option(`${d.number} · ${d.name}`, d.id));
        select.onchange = () => {
          choices[group.kind][group.key] = select.value;
          show('preview');
        };
        label.append(select);
        conflicts.append(label);
      }
      renderRows();
      show('preview');
    } catch (error) {
      $('.numbering-error').textContent = error.message;
      show('settings');
    }
  };
  $('#numbering-settings-tab').onclick = () => show('settings');
  $('#numbering-preview-tab').onclick = preview;
  $('.numbering-tabs').onkeydown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'settings'
        : event.key === 'End'
          ? 'preview'
          : tab === 'settings'
            ? 'preview'
            : 'settings';
    if (next === 'preview') preview();
    else show(next);
    $('#numbering-' + tab + '-tab').focus();
  };
  $('#numbering-settings').oninput = () => {
    plan = null;
    $('.numbering-error').textContent = '';
  };
  apply.onclick = () => {
    if (tab === 'settings') {
      preview();
      return;
    }
    try {
      const current = getState(),
        patch = applyNumbering(plan, current, choices);
      if (
        Object.keys(patch).some(
          (key) => JSON.stringify(patch[key]) !== JSON.stringify(current[key]),
        )
      )
        commit(patch);
      try {
        localStorage.setItem(preferenceKey, JSON.stringify(settings));
      } catch {
        /* Numbering works without storage. */
      }
      assigned = true;
      dialog.close();
    } catch (error) {
      $('.numbering-error').textContent = error.message;
    }
  };
  $('[aria-label="Stäng numrering"]').onclick = $('[data-action="cancel"]').onclick = () =>
    dialog.close();
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('close', () => {
    onClose();
    resolve?.(assigned);
    resolve = null;
  });
  document.body.append(dialog);
  return {
    dialog,
    open(kinds) {
      if (dialog.open) return Promise.resolve(false);
      beforeOpen();
      if (kinds)
        for (const name of ['parts', 'assemblies']) $(`[name="${name}"]`).checked = kinds[name];
      assigned = false;
      showModel(false);
      plan = null;
      $('.numbering-error').textContent = '';
      show('settings');
      dialog.showModal();
      return new Promise((done) => {
        resolve = done;
      });
    },
  };
}
