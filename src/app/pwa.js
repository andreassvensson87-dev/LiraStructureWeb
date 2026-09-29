export function setupPWA() {
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
      const update = () => {
        if (reg.waiting)
          status.textContent =
            'Ny version klar för nästa session. Modellen sparas inte när appen stängs.';
      };
      update();
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', update);
      });
      window.addEventListener('focus', () => reg.update().catch(() => {}));
    })
    .catch(() => {
      status.textContent = 'Offlinefunktion är inte tillgänglig.';
    });
}
