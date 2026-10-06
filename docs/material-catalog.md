# Standardmaterial

22 standardmaterial följer med offline. Trädet är hopfällt från början och visar
materialtyp → undergrupp → material. Sökning öppnar matchande grenar. Egna
material kan ges en undergrupp; äldre poster utan undergrupp visas under Egna material.

| Material                               | Densitet kg/m³ | Grund                                   |
| -------------------------------------- | -------------: | --------------------------------------- |
| S235JR, S355J2, S355N, S355M, S355J2H  |           7850 | Nominellt stål                          |
| C20/25, C25/30, C30/37, C35/45, C40/50 |           2400 | Schablon för normalbetong utan armering |
| C14                                    |            350 | Medeldensitet                           |
| C24                                    |            420 | Medeldensitet                           |
| GL28cs, GL30c                          |            430 | Medeldensitet                           |
| GL28hs, GL30h                          |            480 | Medeldensitet                           |
| Glasull, stenull                       |             30 | Schablon för lätt mineralull            |
| EPS                                    |             20 | Schablon                                |
| XPS                                    |             32 | Schablon med XPS250 som referens        |
| PIR, PUR                               |             35 | Schablon                                |

Isoleringens densitet beror på produkt, utförande och tryckhållfasthet.
Betongens densitet beror på recept och armeringsinnehåll. Materialklass och
densitet innebär inte att hållfasthetsdimensionering eller värmeberäkning utförs.
Materialets färg används av befintlig objektvisning. Materialval ändrar inte
profilens geometri eller katalogens nominella massa per meter.
Objektets vikt använder valt materials densitet och visas via högerklick →
Information, se [objektinformation och mängder](object-information.md).

## Lagring och versioner

Standardmaterial har stabila ID:n och version 1. Ändring i bibliotekets formulär
skapar ett eget material med nytt ID. Fortsatta ändringar av egna material skapar
nya versioner. Objekt använder frikopplade materialkopior och påverkas inte av
biblioteksredigering. Egna versioner sparas lokalt; export inkluderar hela biblioteket.
Import slår ihop versioner och avvisar konflikter utan att skriva över biblioteket.
Äldre materialfiler i schema 1 fungerar utan nya metadatafält.

## Källor för densiteter

- [SSAB: stålets densitet](https://www.ssab.com/en/support/product-material-data/steel/20-questions).
- [TräGuiden: C14, medeldensitet 350](https://www.traguiden.se/produkter/konstruktionsvirke/konstruktionsvirke-obehandlat/konstruktionsvirke-hallfasthetsklass-c14/konstruktionsvirke-c14-gran-obehandlad-45x95/).
- [TräGuiden: C24, medeldensitet 420](https://www.traguiden.se/produkter/konstruktionsvirke/konstruktionsvirke-obehandlat/konstruktionsvirke-hallfasthetsklass-c24/konstruktionsvirke-c24-gran-obehandlad-45x95/).
- [Svenskt Trä: limträets medeldensiteter](https://www.svenskttra.se/bygg-med-tra/om-limtra/hallfasthetsklasser-och-sortiment/).
- [ISOVER: glasull, cirka 30](https://www.isover.se/produkter/isover-robust-stav-i-glasull).
- [ROCKWOOL: lätt stenull, produktvariationer](https://www.rockwool.com/dk/produkter/flexibatts-37/).
- [BEWI: EPS-referens 20, intervall 18–22](https://bewi.com/wp-content/uploads/2021/02/EPD-for-EPS.pdf).
- [Finnfoam: XPS250, cirka 32](https://finnfoam.se/produkter/finnfoam-xps/finnfoam-xps250/).
- [Finnfoam: PIR, cirka 32–37](https://finnfoam.se/produkter/ff-pir/ff-pir-pl-plastlaminat/).
- [Sika: PIR/PUR, intervall 25–35](https://www.sika.com/en/construction/roof-systems/thermal-insulation.html).
- [NIST: beräkningsexempel med betongdensitet 2400](https://nehrpsearch.nist.gov/static/files/NIST/PB2002104220.pdf).

Schablonerna är programmets startvärden, inte generella deklarerade produktvärden.
