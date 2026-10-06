import {
  parseProjectFile,
  serializeProject,
  projectFilename,
  PROJECT_FILE_LIMIT,
} from '../project/project-file.js';

/** Project files include embedded library snapshots, bore identities and editable drawings. */
export function installProjectFiles({ project, finishEditing, loadProject, onLoaded, newProject }) {
  const section = document.createElement('details');
  section.className = 'project-menu';
  section.innerHTML =
    '<summary>Arkiv <span aria-hidden="true">▾</span></summary><div class="project-menu-panel"><div class="project-file-actions"><button type="button" data-new-project>Nytt projekt</button><button type="button" data-open-project>Öppna projekt…</button><button type="button" data-save-project>Spara projekt</button><button type="button" data-save-as-project>Spara som…</button><button type="button" data-export-ifc disabled title="IFC-export är inte tillgänglig ännu">IFC</button></div><input type="file" accept=".json,.lira.json" data-project-file hidden><p data-project-file-status role="status"></p></div>';
  document.querySelector('body > header').prepend(section);
  const trigger = section.querySelector('summary');
  document.addEventListener('pointerdown', (event) => {
    if (!section.contains(event.target)) section.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && section.open) {
      section.open = false;
      trigger.focus();
    }
  });
  const status = section.querySelector('[data-project-file-status]');
  const input = section.querySelector('[data-project-file]');
  let filename = null;
  const saveAsDialog = document.createElement('dialog');
  saveAsDialog.setAttribute('aria-labelledby', 'project-save-as-title');
  saveAsDialog.innerHTML =
    '<form><h2 id="project-save-as-title">Spara som</h2><label class="field">Filnamn<input name="filename" required maxlength="120" autocomplete="off"></label><div class="settings-actions"><button type="button" data-cancel>Avbryt</button><button type="submit" class="primary">Spara</button></div></form>';
  document.body.append(saveAsDialog);
  const filenameInput = saveAsDialog.querySelector('input');
  saveAsDialog.querySelector('[data-cancel]').onclick = () => saveAsDialog.close();
  section.querySelector('[data-new-project]').onclick = () => {
    try {
      finishEditing();
      loadProject(newProject());
      filename = null;
      onLoaded();
      section.open = false;
      status.textContent = '';
      document.getElementById('status').textContent =
        'Nytt projekt · Ångra återställer föregående projekt';
    } catch (error) {
      status.textContent = error.message;
    }
  };
  let downloadUrl = null;
  const saveProject = () => {
    try {
      finishEditing();
      const data = serializeProject(project);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = null;
      const link = document.createElement('a');
      // Small text files also work in embedded browsers without a blob download handler.
      link.href =
        data.length < 1000000
          ? `data:application/json;charset=utf-8,${encodeURIComponent(data)}`
          : (downloadUrl = URL.createObjectURL(new Blob([data], { type: 'application/json' })));
      link.download = filename || projectFilename(project);
      link.textContent = `Hämta ${link.download}`;
      status.replaceChildren(
        `Projektfil klar · ${project.objects.length} objekt · ${project.drawings.length} ritningar`,
        document.createElement('br'),
        link,
      );
      link.click();
    } catch (error) {
      status.textContent = error.message;
    }
  };
  section.querySelector('[data-save-project]').onclick = () => saveProject();
  section.querySelector('[data-save-as-project]').onclick = () => {
    filenameInput.value = (filename || projectFilename(project)).replace(/\.lira\.json$/i, '');
    section.open = false;
    saveAsDialog.showModal();
    filenameInput.select();
  };
  saveAsDialog.querySelector('form').onsubmit = (event) => {
    event.preventDefault();
    const name = filenameInput.value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .replace(/[. ]+$/g, '');
    if (!name) {
      filenameInput.setCustomValidity('Ange ett filnamn.');
      filenameInput.reportValidity();
      return;
    }
    filename = /\.lira\.json$/i.test(name) ? name : `${name}.lira.json`;
    saveAsDialog.close();
    section.open = true;
    saveProject();
  };
  filenameInput.oninput = () => filenameInput.setCustomValidity('');
  section.querySelector('[data-open-project]').onclick = () => {
    input.value = '';
    input.click();
  };
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const button = section.querySelector('[data-open-project]');
    button.disabled = true;
    status.textContent = 'Läser projektfil…';
    try {
      if (file.size > PROJECT_FILE_LIMIT)
        throw new Error('Projektfilen är för stor (högst 100 MB).');
      const next = parseProjectFile(await file.text());
      finishEditing();
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
      loadProject(next);
      filename = file.name;
      onLoaded();
      section.open = false;
      document.getElementById('status').textContent =
        `Projekt öppnat · ${next.objects.length} objekt · ${next.drawings.length} ritningar · Ångra återställer föregående projekt`;
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
