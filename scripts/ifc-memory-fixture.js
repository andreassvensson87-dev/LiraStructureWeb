/** Synthetic IFC4, based on the small placement fixture; no user project data. */
export function createReferenceFixture(template, count = 20000) {
  if (!Number.isInteger(count) || count < 1 || count > 100000)
    throw new Error('Use 1–100000 reference parts.');
  const end = template.indexOf('\nENDSEC;\nEND-ISO-10303-21;');
  if (end < 0) throw new Error('Invalid IFC fixture template.');
  const base = template.slice(0, end).replace(/^#(?:11|12|13|20)=.*(?:\n|$)/gm, '');
  const lines = [
    base,
    "#30=IFCCIRCLEPROFILEDEF(.AREA.,'Circle',#15,90.);",
    '#31=IFCEXTRUDEDAREASOLID(#30,#4,#2,800.);',
    "#32=IFCSHAPEREPRESENTATION(#5,'Body','SweptSolid',(#31));",
    '#33=IFCPRODUCTDEFINITIONSHAPE($,$,(#32));',
  ];
  for (let i = 0; i < count; i++) {
    const id = 1000 + i * 4;
    const x = 1000 + (i % 100) * 600;
    const y = 2000 + (Math.floor(i / 100) % 20) * 600;
    const z = 3000 + Math.floor(i / 2000) * 1000;
    const guid = '0' + (i + 1).toString(36).padStart(21, '0');
    lines.push(
      `#${id}=IFCCARTESIANPOINT((${x}.,${y}.,${z}.));`,
      `#${id + 1}=IFCAXIS2PLACEMENT3D(#${id},#2,#3);`,
      `#${id + 2}=IFCLOCALPLACEMENT($,#${id + 1});`,
      `#${id + 3}=IFCBUILDINGELEMENTPROXY('${guid}',$,'Reference ${i + 1}',$,$,#${id + 2},#${i % 10 === 9 ? 33 : 19},$,.NOTDEFINED.);`,
    );
  }
  return lines.join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n';
}
