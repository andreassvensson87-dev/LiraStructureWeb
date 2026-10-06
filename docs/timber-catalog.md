# Swedish stock timber profiles

The offline profile library contains 42 wood profiles alongside the 901 Tibnor
steel profiles. A shared `profile-catalog.js` owns the combined built-in registry,
personal-only storage and import conflict checks. Editing any built-in creates
a personal ID. Full exports and older steel-only exports can be imported without
duplicates. Existing models retain their detached section snapshots.

The tree is Trä → family → size, with four families:

- Träreglar: 34×70, 45×45, 45×70, 45×95, 45×120, 45×145, 45×170, 45×195, 45×220.
- Limträbalkar GL30c: 90×180/225/270/315/360/405/450;
  115×180/225/270/315/360/405/450/495/630; 140×225/270/315/360/405.
- Limträpelare GL30h: 90×90, 115×115, 140×135, 140×140, 165×165.
- Klyvsågat limträ GL28cs: 42×180/225/270, 56×225/270, 66×270/315.

Regel dimensions come from [Sveden Trä's stock guide](https://www.svedentra.se/vara-produkter-och-tjanster/byggtra/).
Only its explicitly graded 45×95–220 rows carry C24. The smaller/general-purpose
reglar have no inferred strength class. Their 420 kg/m³ is an editable nominal
mass-estimation default. For C24 this is the mean density in
[Svenskt Trä's product declaration](https://www.traguiden.se/produkter/konstruktionsvirke/konstruktionsvirke-obehandlat/konstruktionsvirke-hallfasthetsklass-c24/konstruktionsvirke-c24-gran-obehandlad-45x95/).

Glulam stock dimensions and classes follow
[Svenskt Trä's assortment](https://www.svenskttra.se/bygg-med-tra/om-limtra/hallfasthetsklasser-och-sortiment/).
GL30c/GL28cs use mean density 430 kg/m³; GL30h uses 480 kg/m³.
These are mean mass-estimation values, not characteristic design densities.
The library includes explicit stock rows rather than all combinations of
manufacturing widths and heights. Beam/pelare are library classifications;
the same section can be placed as either in the model. Length is independent.

All definitions reuse the common parametric rectangle (B horizontal, H vertical),
with B/H in mm. The contour represents nominal dimensions; it does not model
manufactured corner rounding, chamfers, lamellae or moisture-driven variation.
Exact and schematic display therefore share the same four corners; model snaps
use eight end-corner points. Geometry, area, moments, elastic moduli and mass are
calculated by the existing section evaluator. No calculated values are presented
as independently tabulated catalog values. Strength classes are descriptive
profile metadata; this import does not implement structural timber design.
Object material/color remains the independently selected material in the existing
material inspector. Selecting a wood profile does not overwrite that selection.

`libraryGroup` is optional library organization metadata. Profiles without it
keep the existing shape-based groups; latest revisions determine classification.
Personal copies retain it. The model embeds geometry, parameters, class, source
and density, and needs no library lookup to reopen or draw the profile.
