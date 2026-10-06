# Tibnor profile catalog

The offline catalog contains 901 profiles: IPE (18), HEA (24), HEB (24), HEM (24), T (11),
UPE (14), U/UPN (23), L equal-leg (59), L unequal-leg (49), VKR (142), KKR (122), welded circular KCKR (38) and seamless circular CHS (353), from Tibnors konstruktionstabeller 2023, tables 002–012, printed
pages 8–49 (PDF spreads 5–25). UPE 80–400 has parallel flanges. U 30–400 includes the small U bars and tapered UPN channels. VKR and KKR include both square and rectangular sections; circular tubes include both cold formed welded and hot finished seamless sections.

Source: https://www.tibnor.se/medias/konstruktionstabellerSWE-2023.pdf

`src/tibnor-data.js` stores the extracted table rows and their original unit
multipliers. `src/tibnor-catalog.js` converts these to versioned profile definitions.
Dimensions are in mm, area in mm², mass in kg/m, moments in mm⁴ and elastic
section moduli in mm³. Tibnor's flange thickness `t` maps to `tf`, web thickness
`d` to `tw`, y-axis properties to the application's horizontal X-axis, and z-axis
properties to its vertical Y-axis. The torsion factor `It` maps to `J`.
Nominal names must never substitute for actual dimensions (HEA 200 is 190 mm high).
The catalog's S355J2 designation for I/H and S355N/S355M/S355J2 for UPE
and S235JR for U/UPN are retained in each profile's standard field.

U/UPN uses two inner root fillets (Rk) and two rounded flange tips (Rf).
Both radii come from Tibnor table 002, including U 300 Rf = 8.5 mm.
The inner flange slope is 8% through height 300 and 5% above 300.
Flange thickness is measured at b/2 from the tip for the smaller series and
(b-tw)/2 from the tip for the larger series. These fixed construction rules
follow the official ArcelorMittal UPN section sketch:
https://sections.arcelormittal.com/repository2/Sections/5_1_2_ArcelorMittal_ES_EN_IT_web.pdf
(page 122). They also reproduce the small U bars' tabulated area and centroid.
The shared contour generator constructs arcs tangent to the sloping flange and
vertical faces. Schematic mode sets Rk/Rf to zero while retaining the flange slope.
U/UPN's tabulated weak-axis modulus is the conservative open-side value.
U 400's calculated centroid differs by 0.26 mm from the printed value; the
original catalog value remains separate. Names follow Tibnor's U labels;
UPN aliases make the same records searchable without duplicate profiles.

L profiles share one angle contour for equal and unequal legs. One inner
fillet uses Tibnor's Rk and the two toe fillets use Rf. The initial toe radius
is min(Rk/2, t): EN 10056-1's half-root rule is documented by the producer at
https://orangebook.arcelormittal.com/fr/node/162 (Section 3.1); the thickness
limit keeps thin-leg geometry inside its stated dimensions. In particular,
L 50x50x3 has Rk=7 and therefore uses Rf=3 instead of 3.5. Both radii are editable
and validated. The shared contour evaluator removes coincident samples when
a parametric toe fillet meets an outer corner; plain polygon/plate validation
still rejects duplicate vertices. Setting both radii to zero yields six
section corners and twelve model end-corner snaps.
The family tree separates Stänger → L liksidig / L oliksidig → size.
Catalog cy/cz measure from the outside heel; application cy = source cy-H/2
and cx = source cz-B/2. Ix/Iy and Wx/Wy follow the same y/z mapping as beams.
Ixy is calculated from geometry; principal-axis and torsion values are not imported.

### Table 011 source discrepancies

The raw extracted rows remain unchanged in tibnor-data.js. Geometry consistently
uses the dimensions in the L size designation. Two printed dimension cells
conflict with those names: L25x25x4 prints t=5, and L35x35x3 prints b=36.
Their definitions retain sourceDimensionConflict metadata; geometry uses
25×25×4 and 35×35×3 respectively. Catalog properties stay separate and unchanged.
Other printed conflicts are retained for traceability: L50x50x3 prints mass
2.45 kg/m despite its area of 296 mm²; L80x40x8 repeats Iz=9.68 as Wel,z=9.68;
L150x75x11 repeats the thinner size's mass of 15.3 kg/m despite area 2360 mm².
These three cells must not be treated as independently validated design values.
L35x35x3's moment/centroid differ after resolving the dimension cell. Small
angle moments also show differences beyond the printed rounding unit.
All L geometry agrees within 1.5% in area, 3.5% (or half a 0.01 cm4 unit)
in moments and 0.35 mm in centroid. Geometry/density-derived mass and section
properties remain visible alongside the original catalog numbers.

VKR/KKR uses a common rounded hollow rectangle with two loops: four outer
arcs using Ro and four inner arcs using Ri, with the same 15-degree generator.
Dimensions and physical properties come from tables 008 and 009.
VKR S355J2H/SS-EN 10210 has Ro=1.5t and Ri=1.0t.
KKR S355J2H/SS-EN 10219 has Ro=2t, 2.5t or 3t for t≤6, 6<t≤10 or t>10 mm,
respectively; Ri=Ro-t. These are nominal calculation radii, not measurements
of individual manufactured tubes, and reproduce every imported catalog row
within 1% for area, moments, elastic moduli and mass.
The nominal rules are specified in EN 10210-2:2006 Annex A.3 (printed page 15):
https://rusenergosnab.ru/images/files/EN_10210.pdf
and EN 10219-2:2019 Annex A.3 (printed page 15):
https://www.botopsteelpipes.com/wp-content/uploads/2024/08/EN-10219-2-2019.pdf
VKR's nominal inner radius is t; it must not be inferred as Ro-t.
Radii are stored as arithmetic expressions referencing t. Thickness edits scale
the imported row's radius ratios; crossing a KKR thickness band in a personal
definition does not reclassify the contour's chosen ratio automatically.
The original catalog values are cleared by geometry edits.
Both radii are editable. Validation checks corner size and prevents the hole
from crossing the outer contour, including edited independent radii.

The hollow profile tree is Hålprofiler → VKR/KKR kvadratisk/rektangulär → size.
Names and IDs include height, width and thickness; family identity distinguishes
VKR and KKR even for identical nominal dimensions. Schematic generation sets
both Ro/Ri to zero and retains the hole, giving four outer and four inner corners,
with sixteen model end-corner snaps. Exact arcs add no snap candidates.
Tibnor's Iy and Iz values map to application Ix and Iy respectively.
Hollow-section It is printed in cm4 and maps to J with a 1e4 multiplier,
unlike the scaled It columns for I/H/U profiles. Plastic and torsional moduli,
radii of gyration and superficial area columns are not imported.

I/H root fillets use four quarter-circle contours with 15° segments and parameter `R`.
UPE uses two inner fillets (`R1`) and two outer web corners (`R2`), with
the same arc generator and contour evaluator. Flange tips remain square,
matching the catalog sketch. Both radii become zero in schematic display;
the resulting eight section corners give 16 model end-corner snap points.
UPE centroids are offset toward the web. Catalog `cx` is the tabulated
distance from the outer web face minus half the width; `cy` is zero.
Both weak-axis moduli are retained: `WyMinus` at the web and `WyPlus`
at the open side. The legacy scalar `Wy` retains the smaller, conservative
value. All coordinates use the same bounding-box centre as I/H profiles.
Contour-derived properties therefore differ slightly from the tabulated values.
The original catalog values remain separate and are carried into model snapshots.
Geometry and density edits clear the catalog values to prevent stale values being
carried into modified personal profiles. Undo restores the previous definition.
The imported values do not include plastic moduli, warping constants or load tables.

Bundled IDs include the source year, family and size. Only personal definitions
are persisted in local storage. Editing and saving a built-in creates a personal
profile with a new ID. Full library exports include the built-ins and can be
imported without duplicates; conflicts at the same ID/revision are rejected.
Existing models retain their detached section snapshots.

## Profile display

Each rounded profile has one expression contour and named radius parameters.
The common contour evaluator uses stored radii for exact geometry and overrides
only radius parameters to zero for schematic geometry. Collapsed arc samples are
removed, leaving one theoretical sharp corner. New model snapshots embed this
versioned contour definition, parameters and the evaluated physical contour;
no separate schematic contour is stored. Schematic results are cached in memory.
Parametric tangent points that coincide are collapsed as well. Multiple radius names use the same evaluator without family or catalog-ID branches.
Import validation checks the definition against the embedded physical contour.
Legacy snapshot compatibility is isolated in `section-display-compat.js`.
Model objects and manufacturing keys always retain the exact geometry.
Physical cuts and automatic hole placement are
evaluated against the exact profile, independently of display mode.

The model defaults to schematic display. Its context menu has **Visa exakt** and
**Visa schematiskt** for selected rounded profiles. **Rita om vyn** clears all exact
overrides and redraws the model schematically. These overrides are session UI
state, excluded from project snapshots, and are reset when loading a project.
Picking, mesh reuse and instancing use the chosen display contour. Model snaps
always use schematic corners and segments, including when the object is displayed
exactly. Root arc tessellation supplies no extra snap points. Shared geometry
caches keep this snap contour stable when display mode changes.

Every GA, Single Part and assembly drawing view has its own persisted
`settings.profileDetail` (`exact` or `schematic`). Plans default to schematic;
Single Part/assembly views, sections and details default to exact. New details and
sections default to exact even when their parent plan is schematic. The inspector
selector and view context menu change the selected view independently. Drawing
**Rita om vyn** regenerates that view while retaining its display mode.
Mixed exact/schematic views share the physical model without sharing display
settings; vector paths and section cuts use each view's chosen display contour.
Annotation snap candidates always use schematic geometry. Hole-centre references
remain independent of profile radii. Radius edge smoothing uses the contour's
segment-angle metadata rather than guessing from point counts.

The browser tree uses group → family → profile, with counts, collapsed branches
by default, search that opens only matching branches, and explicit expand/collapse
controls. Expansion preferences survive search and editor redraws. Historical
versions are hidden below each size. Library validation permits 5,000 versions.

I/H (including HEM) and VKR/KKR validation checks contours against catalog area and moments (within 1%,
or half the printed whole cm4 rounding unit for UPE moments), asymmetric
centroids and extreme-fibre moduli, reference rows for units and axis mapping, personal
storage/export roundtrips, conflicting imports and project save/reload with 3D
geometry for each family.

## Circular tubes — table 010

Hålprofiler → Runda svetsade / Runda sömlösa → size contains every row on
printed pages 30–39. KCKR uses S355J2H / SS-EN 10219 and CHS uses
S355J2H / SS-EN 10210. CHS is the library label for the catalog's unnamed
seamless series; the source heading, rather than its repeated KCKR footer,
determines the manufacturing standard. IDs distinguish both series at equal D/t.
Names include outer diameter D and wall thickness t; comma-decimal aliases
support Swedish searches. Only D/t are parameters, with inner radius D/2-t.
The common CHS expression template and round-profile geometry cache are reused.
Both display modes retain the same round shape and physical bore. Tube radii
are not corner fillets and must never be zeroed by schematic display.
Snaps use the four theoretical outer and inner quadrant points at each end
(16 total), independently of the 96-segment rendering contour and drawing mode.
Catalog area, mass, equal-axis moments and elastic moduli are preserved;
tabulated torsion is imported only for welded tubes (cm⁴ → mm⁴).
No torsion value is invented for the seamless table.

Seven printed cells differ from the D/t-based circular formulas by more than
1.5% and remain unchanged in the raw rows and catalog properties:
CHS 20x4 mass=1.50 kg/m; 25x2 I=0.923 cm⁴; 60.3x5 I=35.5 cm⁴;
193.7x16 I=2554 cm⁴; 193.7x17.5 A=8990 mm²; 559x16 W=3800 cm³;
622x25 A=36900 mm². These are source discrepancies, not geometry inputs.
All other imported values agree with the circular formulas within 1.5%.
Every contour agrees with the analytical annulus area/moments within 0.2%,
including these seven rows. Geometry/density-derived values remain available
alongside the unchanged source values.

## T bars and HEM beams — tables 012 and 007

All 24 HEM 100–1000 sizes use the existing H beam contour and four root arcs.
HEM names are nominal; for example HEM 200 is H=220, B=206, tw=15, tf=25,
R=18 mm, and HEM 1000 is 1008 mm high. The source's S235JR/S355J2 is retained.
Units match the other beams, including torsion ×10⁶ mm⁴. HEM 700's printed
It=15.59 is retained without rounding or substitution. Library placement is
Balkar → HEM → size. Area, mass and moments agree within 1% for every row.

All 11 T20x20–T140x140 rows use one tapered tee contour, with the flange above
the web as in the existing T template. This reflects Tibnor's flange-below
sketch: cx=0, cy=H/2-source Cy. The printed conservative Wel,y is Wx/WxMinus
at the web tip; Wel,z is Wy. No unprinted torsion value is imported.
Tibnor's thickness t initializes both tw and tf; they can subsequently be edited
independently in personal definitions. Rk, Rf and R1 are the tabulated root,
flange-toe and web-toe radii. Six tangent arcs use the common profileArc generator.
The 2% web and flange slopes, with tw measured at H/2 and tf at B/4, follow the
producer's tee sketch (printed page 57 / PDF page 60):
https://e-steel.arcelormittal.com/medias/sys_master/root/h78/hee/9134295056414/Arcelor-Catalogue-Web-2020-avec-liens-bouton-light.pdf
The slope is a series construction rule embedded in the arithmetic contour,
not an adjustment fitted separately to individual rows. Contour area agrees
within 0.5%, moments/moduli within 3.5% and centroid within 0.2 mm of Tibnor's
printed values. Original catalog properties remain separate from calculations.
Library placement is Stänger → T → size. In schematic display all three radii
become zero; both slopes remain. The eight theoretical section corners supply
16 model end-corner snaps. HEM retains twelve sharp corners and 24 end snaps.
Model/drawing display changes preserve the physical profile and manufacturing
identity; both new families retain snapshots through project save/reload.
