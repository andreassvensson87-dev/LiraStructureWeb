import { projectData } from './project-state.js';
const pendingRecord = Symbol('pending history record');
const cyclicRecord = new Error('Cyclic shared history record');
const sharedFields = ['spec', 'material', 'section'];
const blockSize = 128;

// Preserve distinctions that ordinary JSON loses, without confusing them with
// user strings. Unusual structured-clone values use an uncached copy instead.
function fingerprint(source) {
  return JSON.stringify(source, function (key, value) {
    const original = key === '' && this[''] === source ? source : this[key];
    if (original && typeof original === 'object') {
      if (typeof original.toJSON === 'function') throw new Error('Custom serialization');
      const prototype = Object.getPrototypeOf(original);
      if (!Array.isArray(original) && prototype !== Object.prototype && prototype !== null)
        throw new Error('Non-plain record');
    }
    if (typeof original === 'function' || typeof original === 'symbol')
      throw new Error('Non-serializable record');
    if (value === undefined) return Object.hasOwn(this, key) ? '\0undefined' : '\0hole';
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0)))
      return `\0number${Object.is(value, -0) ? '-0' : String(value)}`;
    if (typeof value === 'bigint') return `\0bigint${value}`;
    if (typeof value === 'string' && value.startsWith('\0')) return `\0string${value}`;
    return value;
  });
}
function freezeCopy(value, visited = new WeakSet()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || visited.has(value))
    return value;
  visited.add(value);
  if (ArrayBuffer.isView(value)) return value;
  for (const child of Object.values(value)) freezeCopy(child, visited);
  return Object.freeze(value);
}

// Keep the getter in a separate scope: a capture's closures can otherwise
// retain its mutable source records and their derived geometry.
function blockSnapshot(rest, blocks) {
  return Object.freeze({
    ...freezeCopy(structuredClone(rest)),
    get objects() {
      const objects = new Array(blocks.reduce((length, block) => length + block.length, 0));
      let index = 0;
      for (const block of blocks)
        for (let i = 0; i < block.length; i++) objects[index++] = block[i];
      return Object.freeze(objects);
    },
  });
}

/** History owns frozen record copies; mutable editor records are checked on every capture. */
export class ProjectSnapshots {
  constructor() {
    this.records = new WeakMap();
    this.signatures = new WeakMap();
    this.blocks = [];
  }
  record(source, shared) {
    const known = shared.get(source);
    if (known === pendingRecord) throw cyclicRecord;
    if (known) return known;
    shared.set(source, pendingRecord);
    let signature;
    try {
      const prototype = Object.getPrototypeOf(source);
      if (Array.isArray(source) || (prototype !== Object.prototype && prototype !== null))
        throw new Error('Non-plain record');
      signature = fingerprint(source);
    } catch (error) {
      // A cycle can pass through an excluded shared field. Preserve the whole
      // graph with structuredClone rather than copying its records separately.
      if (error instanceof TypeError) throw cyclicRecord;
      this.records.delete(source);
      const copy = freezeCopy(structuredClone(source));
      shared.set(source, copy);
      return copy;
    }
    const previous = this.records.get(source);
    if (previous?.signature === signature) {
      shared.set(source, previous.copy);
      return previous.copy;
    }
    const copy = structuredClone(source);
    for (const key of sharedFields)
      if (source[key] && typeof source[key] === 'object')
        copy[key] = this.record(source[key], shared);
    freezeCopy(copy);
    this.records.set(source, { signature, copy });
    this.signatures.set(copy, signature);
    shared.set(source, copy);
    return copy;
  }
  capture(project) {
    const { objects, ...rest } = projectData(project);
    const shared = new WeakMap();
    try {
      const blocks = [];
      for (let start = 0; start < objects.length; start += blockSize) {
        const values = objects
          .slice(start, start + blockSize)
          .map((source) => this.record(source, shared));
        const previous = this.blocks[blocks.length];
        blocks.push(
          previous?.length === values.length && values.every((copy, i) => copy === previous[i])
            ? previous
            : Object.freeze(values),
        );
      }
      Object.freeze(blocks);
      // Readers retain the frozen-array interface while history shares blocks.
      const snapshot = blockSnapshot(rest, blocks);
      this.blocks = blocks;
      return snapshot;
    } catch (error) {
      if (error !== cyclicRecord) throw error;
      this.records = new WeakMap();
      this.blocks = [];
      return freezeCopy(structuredClone(projectData(project)));
    }
  }
  restore(snapshot, current) {
    const { objects, ...rest } = snapshot;
    const live = structuredClone(rest);
    const byId = new Map(current.objects.map((source) => [source.id, source]));
    const shared = new WeakMap();
    const fields = sharedFields;
    for (const copy of objects) {
      const source = byId.get(copy.id);
      if (source && this.records.get(source)?.copy === copy)
        for (const key of fields)
          if (copy[key] && typeof copy[key] === 'object') shared.set(copy[key], source[key]);
    }
    // capture(current) has just checked every live record. Reuse only those
    // whose owned snapshot is exactly the target; never return frozen history data.
    live.objects = objects.map((copy) => {
      const source = byId.get(copy.id);
      if (source && this.records.get(source)?.copy === copy) return source;
      const restored = structuredClone(copy);
      for (const key of fields) {
        const child = copy[key];
        if (!child || typeof child !== 'object') continue;
        if (shared.has(child)) restored[key] = shared.get(child);
        else shared.set(child, restored[key]);
        const childSignature = this.signatures.get(child);
        if (childSignature !== undefined)
          this.records.set(restored[key], { signature: childSignature, copy: child });
      }
      const signature = this.signatures.get(copy);
      if (signature !== undefined) this.records.set(restored, { signature, copy });
      return restored;
    });
    return live;
  }
}
