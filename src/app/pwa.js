import { watchAppUpdate } from '../update-ui.js';
export function setupPWA(beforeUpdate = async () => {}) {
  if (!import.meta.env.PROD) return;
  const footer = document.querySelector('body > footer');
  const status = document.createElement('span');
  status.className = 'pwa-status';
  status.setAttribute('role', 'status');
  const install = document.createElement('button');
  install.textContent = 'Installera app';
  install.hidden = true;
  install.className = 'pwa-install';
  footer.append(status, install);
  const updateButton = document.createElement('button');
  updateButton.hidden = true;
  document.querySelector('body > header .history').prepend(updateButton);
  let prompt;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event;
    install.hidden = false;
  });
  install.onclick = async () => {
    const current = prompt;
    if (!current) return;
    prompt = null;
    install.hidden = true;
    try {
      await current.prompt();
      await current.userChoice;
    } catch {
      status.textContent = 'Installera via webbläsarens appmeny.';
    }
  };
  window.addEventListener('appinstalled', () => {
    install.hidden = true;
  });
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      watchAppUpdate(reg, updateButton, status, async () => {
        try {
          await beforeUpdate();
        } catch (error) {
          return `Uppdateringen väntar. ${error.message}`;
        }
      });
    })
    .catch(() => {
      status.textContent = 'Offlinefunktion är inte tillgänglig.';
    });
}
