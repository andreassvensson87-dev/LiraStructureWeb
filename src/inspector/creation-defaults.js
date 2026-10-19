/** Browser persistence boundary; domain adapters validate snapshots before use. */
const KEY = 'lirastructure.creation-properties.v1';
export function createCreationDefaults(storage) {
  let records = {};
  let pending = {};
  function refresh() {
    try {
      const raw = storage?.getItem(KEY);
      if (!raw || raw.length >= 2000000) return;
      const next = JSON.parse(raw);
      if (next && !Array.isArray(next) && typeof next === 'object')
        records = { ...next, ...pending };
    } catch {
      /* An unavailable store does not prevent session defaults. */
    }
  }
  return {
    get(type) {
      refresh();
      return structuredClone(records[type] || {});
    },
    set(type, values) {
      refresh();
      records[type] = structuredClone(values);
      pending[type] = structuredClone(values);
      try {
        storage?.setItem(KEY, JSON.stringify(records));
        pending = {};
      } catch {
        /* Keep session defaults. */
      }
    },
  };
}
