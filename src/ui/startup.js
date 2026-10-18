// Owns the startup surface only. Model recovery and application creation belong to the app.
export function createStartupView(root = document) {
  const status = root.getElementById('app-startup');
  return {
    ready() {
      root.documentElement.removeAttribute('data-app-starting');
      status.remove();
    },
    failed(error) {
      console.error('Kunde inte starta LiraStructure.', error);
      status.setAttribute('aria-busy', 'false');
      status.setAttribute('role', 'alert');
      status.querySelector('p').textContent = 'Appen kunde inte starta. Försök ladda om sidan.';
      const retry = root.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Ladda om';
      retry.onclick = () => root.defaultView.location.reload();
      status.append(retry);
    },
  };
}
