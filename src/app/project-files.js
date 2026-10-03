import {
  parseProjectFile,
  serializeProject,
  projectFilename,
  PROJECT_FILE_LIMIT,
} from '../project/project-file.js';

/** Project files include embedded library snapshots, bore identities and editable drawings. */
export function installProjectFiles({ project, finishEditing, loadProject, onLoaded }) {
  const section = document.createElement('section');
  section.innerHTML =
    '<h3>Projektfil</h3><p>Spara modellen, skruvförbanden, hålen och ritningarna i en fil.</p><div class="project-file-actions"><button type="button" data-save-project>Spara projekt…</button><button type="button" data-open-project>Öppna projekt…</button></div><input type="file" accept=".json,.lira.json" data-project-file hidden><p class="inspector-note">Öppna ersätter modellen. Ångra återställer föregående projekt. Biblioteksvärden som används av objekten följer med filen.</p><p data-project-file-status role="status"></p>';
  document.querySelector('[data-settings-panel="project"]').prepend(section);
  const status = section.querySelector('[data-project-file-status]');
  const input = section.querySelector('[data-project-file]');
  let downloadUrl = null;
  section.querySelector('[data-save-project]').onclick = () => {
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
      link.download = projectFilename(project);
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
      onLoaded();
      document.getElementById('settings-dialog').close();
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
