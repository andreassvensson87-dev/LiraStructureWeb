const KEY = 'lirastructure.colors.v1';
const DEFAULTS = [
  ['Vit', '#f3f4f2'],
  ['Ljusgrå', '#c5cccf'],
  ['Grå', '#89969c'],
  ['Mörkgrå', '#4b5961'],
  ['Svart', '#263238'],
  ['Röd', '#c45151'],
  ['Orange', '#dc8946'],
  ['Gul', '#e3c957'],
  ['Lime', '#a8bd59'],
  ['Grön', '#598467'],
  ['Mint', '#80bda4'],
  ['Turkos', '#4e9695'],
  ['Ljusblå', '#8cbad0'],
  ['Blå', '#517eae'],
  ['Marinblå', '#3e526f'],
  ['Lila', '#8876a6'],
  ['Rosa', '#ca8fab'],
  ['Beige', '#cabb9c'],
  ['Brun', '#8a6b53'],
  ['Blågrå', '#688391'],
];
export function readColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (
      Array.isArray(saved) &&
      saved.length === 20 &&
      saved.every(
        (c) => typeof c.name === 'string' && c.name.trim() && /^#[0-9a-f]{6}$/i.test(c.color),
      )
    )
      return saved;
  } catch {}
  return DEFAULTS.map(([name, color]) => ({ name, color }));
}
export class ColorLibrary {
  constructor(onChange) {
    this.onChange = onChange;
    this.colors = DEFAULTS.map(([name, color]) => ({ name, color }));
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (
        Array.isArray(saved) &&
        saved.length === 20 &&
        saved.every(
          (c) => typeof c.name === 'string' && c.name.trim() && /^#[0-9a-f]{6}$/i.test(c.color),
        )
      )
        this.colors = saved;
    } catch {}
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'color-library';
    this.dialog.innerHTML =
      '<div class="panel-title"><h2>Färgbibliotek</h2><button type="button" aria-label="Stäng färgbibliotek">×</button></div><form><div class="color-edit-list"></div><p role="alert"></p><button class="primary">Spara färger</button></form><p class="inspector-note">Paletten sparas i webbläsaren. Befintliga objekt behåller sin färg.</p>';
    document.body.append(this.dialog);
    this.dialog.querySelector('button').onclick = () => this.dialog.close();
    this.dialog.addEventListener('keydown', (e) => e.stopPropagation());
    this.dialog.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const colors = [...this.dialog.querySelectorAll('.color-edit-row')].map((row) => ({
        name: row.querySelector('input[type=text]').value.trim(),
        color: row.querySelector('input[type=color]').value,
      }));
      try {
        if (colors.some((c) => !c.name)) throw Error('Ange namn för alla färger.');
        localStorage.setItem(KEY, JSON.stringify(colors));
        this.colors = colors;
        this.onChange();
        this.dialog.close();
      } catch (e) {
        this.dialog.querySelector('[role=alert]').textContent = e.message;
      }
    };
  }
  open() {
    const list = this.dialog.querySelector('.color-edit-list');
    list.replaceChildren();
    this.colors.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'color-edit-row';
      const color = document.createElement('input'),
        name = document.createElement('input');
      color.type = 'color';
      color.value = c.color;
      color.setAttribute('aria-label', `Färg ${i + 1}`);
      name.type = 'text';
      name.value = c.name;
      name.maxLength = 40;
      name.required = true;
      name.setAttribute('aria-label', `Färgnamn ${i + 1}`);
      row.append(color, name);
      list.append(row);
    });
    this.dialog.querySelector('[role=alert]').textContent = '';
    this.dialog.showModal();
  }
}
