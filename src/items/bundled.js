import catalogUrl from './catalog/sectional-railing.bin?url';
export const bundledItemCatalog = {
  catalogId: 'sectional-railing-2026-10-v2',
  async loadBundled() {
    const response = await fetch(catalogUrl);
    if (!response.ok) throw Error('Sectional Railing-biblioteket kunde inte läsas.');
    const decoded = response.body.pipeThrough(new DecompressionStream('gzip'));
    return new Response(decoded).json();
  },
};
