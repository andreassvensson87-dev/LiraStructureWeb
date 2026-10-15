/** Supported IFC4 occurrence classes. Object definitions own their default. */
export const IFC_CLASSES = [
  ['IfcBeam', 'Balk'],
  ['IfcColumn', 'Pelare'],
  ['IfcMember', 'Stång / annan profildel'],
  ['IfcPlate', 'Plåt'],
  ['IfcSlab', 'Bjälklag'],
  ['IfcWall', 'Vägg'],
  ['IfcFooting', 'Fundament'],
  ['IfcCovering', 'Beklädnad / isolering'],
  ['IfcMechanicalFastener', 'Skruv / fästdon'],
  ['IfcBuildingElementProxy', 'Generellt objekt'],
];
export function validateIFCClass(value) {
  if (!IFC_CLASSES.some(([key]) => key === value)) throw Error('Välj en giltig IFC-klass.');
  return value;
}
