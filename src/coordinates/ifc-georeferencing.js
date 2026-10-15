import {
  IFCMAPCONVERSION,
  IFCPROJECT,
  IFCSIUNIT,
  IFCCONVERSIONBASEDUNIT,
  IFCMAPCONVERSIONSCALED,
  IFCRIGIDOPERATION,
} from 'web-ifc';
import { validateSourceCoordinates } from './reference-frame.js';
const val = (v) => v?.value ?? v;
const prefixes = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 100,
  DECA: 10,
  DECI: 0.1,
  CENTI: 0.01,
  MILLI: 0.001,
  MICRO: 1e-6,
  NANO: 1e-9,
};
/** Read only explicit IFC4 map conversion; placements alone remain raw file coordinates. */
export function readIFCGeoreferencing(api, model) {
  if (
    [IFCMAPCONVERSIONSCALED, IFCRIGIDOPERATION].some((type) =>
      api.GetLineIDsWithType(model, type).size(),
    )
  )
    throw Error('IFC-filens georeferering använder en kartomvandling som inte stöds ännu.');
  const ids = api.GetLineIDsWithType(model, IFCMAPCONVERSION);
  if (!ids.size()) return null;
  if (ids.size() !== 1)
    throw Error('IFC-filen har flera kartomvandlingar. Flera geometrikontexter stöds inte ännu.');
  const read = (handle) => api.GetLine(model, handle.value);
  function unitMetres(unit, seen = new Set()) {
    if (!unit || seen.has(unit.expressID)) throw Error('Ogiltig längdenhet i IFC-georeferering.');
    seen.add(unit.expressID);
    if (unit.type === IFCSIUNIT && val(unit.Name) === 'METRE')
      return unit.Prefix ? prefixes[val(unit.Prefix)] : 1;
    if (unit.type === IFCCONVERSIONBASEDUNIT) {
      const factor = read(unit.ConversionFactor);
      return Number(val(factor.ValueComponent)) * unitMetres(read(factor.UnitComponent), seen);
    }
    throw Error('Längdenheten i IFC-georefereringen stöds inte.');
  }
  const conversion = api.GetLine(model, ids.get(0)),
    target = read(conversion.TargetCRS);
  const projects = api.GetLineIDsWithType(model, IFCPROJECT);
  const units = read(api.GetLine(model, projects.get(0)).UnitsInContext).Units.map(read);
  const fileUnit = units.find((u) => val(u.UnitType) === 'LENGTHUNIT');
  const fileMetres = unitMetres(fileUnit),
    mapMetres = target.MapUnit ? unitMetres(read(target.MapUnit)) : fileMetres;
  const x = conversion.XAxisAbscissa == null ? 1 : Number(val(conversion.XAxisAbscissa));
  const y = conversion.XAxisOrdinate == null ? 0 : Number(val(conversion.XAxisOrdinate));
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 1e-12)
    throw Error('Ogiltig riktning i IFC-georeferering.');
  return validateSourceCoordinates({
    map: [conversion.Eastings, conversion.Northings, conversion.OrthogonalHeight].map(
      (v) => Number(val(v)) * mapMetres,
    ),
    rotation: (Math.atan2(y, x) * 180) / Math.PI,
    scale:
      ((conversion.Scale == null ? 1 : Number(val(conversion.Scale))) * mapMetres) / fileMetres,
    crs: String(val(target.Name) || ''),
    verticalDatum: String(val(target.VerticalDatum) || ''),
  });
}
