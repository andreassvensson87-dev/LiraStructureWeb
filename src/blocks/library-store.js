import { validateBlockLibrary, nextBlockVersion, mergeBlockLibrary } from './library-data.js';
const KEY = 'lirastructure.blocks.v1';
export class BlockStore {
  read() {
    const text = localStorage.getItem(KEY);
    return validateBlockLibrary(text ? JSON.parse(text) : { schema: 1, definitions: [] });
  }
  save(definition) {
    const next = nextBlockVersion(this.read(), definition);
    localStorage.setItem(KEY, JSON.stringify(next.library));
    return next.definition;
  }
  import(data) {
    const library = mergeBlockLibrary(this.read(), data);
    localStorage.setItem(KEY, JSON.stringify(library));
  }
  remove(id, revision) {
    const library = this.read();
    library.definitions = library.definitions.filter((d) => d.id !== id || d.revision !== revision);
    localStorage.setItem(KEY, JSON.stringify(library));
  }
}
