import {
  IFCPROJECT,
  IFCSIUNIT,
  IFCCONVERSIONBASEDUNIT,
  IFCRELDEFINESBYTYPE,
  IFCRELDEFINESBYPROPERTIES,
  IFCISHAPEPROFILEDEF,
  IFCRECTANGLEPROFILEDEF,
  IFCRECTANGLEHOLLOWPROFILEDEF,
  IFCCIRCLEPROFILEDEF,
  IFCCIRCLEHOLLOWPROFILEDEF,
  IFCUSHAPEPROFILEDEF,
  IFCLSHAPEPROFILEDEF,
  IFCTSHAPEPROFILEDEF,
} from 'web-ifc';
const value = (v) => v?.value ?? v;
const prefixes = { MILLI: 0.001, CENTI: 0.01, DECI: 0.1, MICRO: 1e-6, KILO: 1000 };
const shapes = new Map([
  [
    IFCISHAPEPROFILEDEF,
    [
      'i',
      {
        B: 'OverallWidth',
        H: 'OverallDepth',
        tw: 'WebThickness',
        tf: 'FlangeThickness',
        R: 'FilletRadius',
      },
    ],
  ],
  [IFCRECTANGLEPROFILEDEF, ['rect', { B: 'XDim', H: 'YDim' }]],
  [
    IFCRECTANGLEHOLLOWPROFILEDEF,
    [
      'rhs',
      {
        B: 'XDim',
        H: 'YDim',
        t: 'WallThickness',
        Ro: 'OuterFilletRadius',
        Ri: 'InnerFilletRadius',
      },
    ],
  ],
  [IFCCIRCLEPROFILEDEF, ['circle', { radius: 'Radius' }]],
  [IFCCIRCLEHOLLOWPROFILEDEF, ['chs', { radius: 'Radius', t: 'WallThickness' }]],
  [
    IFCUSHAPEPROFILEDEF,
    [
      'u',
      {
        B: 'FlangeWidth',
        H: 'Depth',
        tw: 'WebThickness',
        tf: 'FlangeThickness',
        R: 'FilletRadius',
      },
    ],
  ],
  [IFCLSHAPEPROFILEDEF, ['l', { B: 'Width', H: 'Depth', t: 'Thickness', R: 'FilletRadius' }]],
  [
    IFCTSHAPEPROFILEDEF,
    [
      't',
      {
        B: 'FlangeWidth',
        H: 'Depth',
        tw: 'WebThickness',
        tf: 'FlangeThickness',
        R: 'FilletRadius',
      },
    ],
  ],
]);
/** IFC adapter only. Outputs small, serializable evidence in millimetres, never a library choice. */
export function createIFCProfileReader(api, model) {
  const legacyZeroFillet = /^IFC2X3/i.test(api.GetModelSchema(model));
  const cache = new Map(),
    profiles = new Map(),
    relations = new Map();
  const read = (handle) => {
    const id = typeof handle === 'number' ? handle : handle?.value;
    if (!id) return null;
    if (!cache.has(id)) cache.set(id, api.GetLine(model, id));
    return cache.get(id);
  };
  function unitMM(handle, seen = new Set()) {
    const u = read(handle);
    if (!u || seen.has(u.expressID)) return null;
    seen.add(u.expressID);
    if (u.type === IFCSIUNIT && value(u.Name) === 'METRE') {
      const prefix = u.Prefix ? prefixes[value(u.Prefix)] : 1;
      return prefix == null ? null : prefix * 1000;
    }
    if (u.type === IFCCONVERSIONBASEDUNIT) {
      const c = read(u.ConversionFactor),
        base = unitMM(c?.UnitComponent, seen);
      return base == null ? null : Number(value(c.ValueComponent)) * base;
    }
    return null;
  }
  const projectIds = api.GetLineIDsWithType(model, IFCPROJECT),
    project = read(projectIds.get(0));
  const unit = read(project?.UnitsInContext)?.Units?.find(
    (h) => value(read(h)?.UnitType) === 'LENGTHUNIT',
  );
  const parsedUnit = unitMM(unit);
  const mm = Number.isFinite(parsedUnit) && parsedUnit > 0 ? parsedUnit : null;
  function index(type) {
    if (relations.has(type)) return relations.get(type);
    const map = new Map(),
      ids = api.GetLineIDsWithType(model, type);
    for (let i = 0; i < ids.size(); i++) {
      const r = read(ids.get(i));
      for (const h of r?.RelatedObjects || []) {
        if (!map.has(h.value)) map.set(h.value, []);
        map
          .get(h.value)
          .push(type === IFCRELDEFINESBYTYPE ? r.RelatingType : r.RelatingPropertyDefinition);
      }
    }
    relations.set(type, map);
    return map;
  }
  function profile(handle) {
    const p = read(handle);
    if (!p) return null;
    if (profiles.has(p.expressID)) return profiles.get(p.expressID);
    const [kind, fields] = shapes.get(p.type) || ['custom', {}],
      dimensions = {};
    if (mm != null)
      for (const [key, field] of Object.entries(fields)) {
        const n = value(p[field]);
        if (typeof n === 'number' && Number.isFinite(n)) dimensions[key] = n * mm;
      }
    // IFC2x3 defines an omitted I-profile root fillet as zero, not unknown.
    if (legacyZeroFillet && p.type === IFCISHAPEPROFILEDEF && p.FilletRadius == null)
      dimensions.R = 0;
    if (dimensions.radius != null) {
      dimensions.D = dimensions.radius * 2;
      delete dimensions.radius;
    }
    const result = { kind, name: String(value(p.ProfileName) || ''), dimensions };
    profiles.set(p.expressID, result);
    return result;
  }
  function geometry(handle, found, warnings, seen = new Set()) {
    const r = read(handle);
    if (!r || seen.has(r.expressID) || seen.size > 128) return;
    seen.add(r.expressID);
    if (r.SweptArea) {
      const p = profile(r.SweptArea);
      if (p && !found.includes(p)) found.push(p);
    }
    if (r.FirstOperand) geometry(r.FirstOperand, found, warnings, seen);
    if (r.MappingSource) {
      const target = read(r.MappingTarget);
      if (
        ['Scale', 'Scale2', 'Scale3'].some(
          (k) => target?.[k] != null && Math.abs(value(target[k]) - 1) > 1e-8,
        )
      )
        warnings.add('mapped-scale');
      geometry(read(r.MappingSource)?.MappedRepresentation, found, warnings, seen);
    }
    for (const h of r.Items || []) geometry(h, found, warnings, seen);
  }
  return (objectOrId) => {
    const o = typeof objectOrId === 'number' ? read(objectOrId) : objectOrId;
    const names = new Set([String(value(o.Name) || '')]),
      hints = {},
      found = [],
      warnings = new Set();
    let material = '';
    if (mm == null) warnings.add('unknown-length-unit');
    const types = (index(IFCRELDEFINESBYTYPE).get(o.expressID) || []).map(read).filter(Boolean);
    const sets = [];
    for (const t of types) {
      names.add(String(value(t.Name) || ''));
      sets.push(...(t.HasPropertySets || []));
    }
    sets.push(...(index(IFCRELDEFINESBYPROPERTIES).get(o.expressID) || []));
    const fields = { b: 'B', bf: 'B', d: 'H', h: 'H', t: 't', tf: 'tf', tw: 'tw', kr: 'R' };
    for (const h of sets) {
      const set = read(h),
        setName = String(value(set?.Name) || '');
      if (
        !/^(Dimensions|Identity Data|Other|Materials and Finishes|Pset_(Beam|Column|Member)Common)$/i.test(
          setName,
        )
      )
        continue;
      for (const h of set.HasProperties || []) {
        const p = read(h),
          name = String(value(p?.Name) || ''),
          v = value(p?.NominalValue);
        if (
          [
            'Type Name',
            'Type Comments',
            'Family and Type',
            'Reference',
            'Family Name',
            'Family',
          ].includes(name) &&
          typeof v === 'string'
        )
          names.add(v);
        if (name === 'Structural Material' && typeof v === 'string') material = v;
        const key = setName === 'Dimensions' && fields[name],
          factor = p?.Unit ? unitMM(p.Unit) : mm;
        if (
          key &&
          Number.isFinite(factor) &&
          factor > 0 &&
          typeof v === 'number' &&
          Number.isFinite(v)
        )
          hints[key] = v * factor;
      }
    }
    const representation = read(o.Representation);
    for (const h of representation?.Representations || []) {
      const r = read(h);
      if (value(r?.RepresentationIdentifier) === 'Body') geometry(h, found, warnings);
    }
    found.forEach((p) => {
      if (p.name) names.add(p.name);
    });
    return {
      names: [...names].filter(Boolean),
      material,
      profiles: found,
      hints,
      warnings: [...warnings],
    };
  };
}
