# CAD-referenser

Under Referenser kan IFC, ASCII-DXF och DWG läggas i samma lista och grupper.
Varje referens kan döpas om, visas/döljas, göras transparent, ersättas och tas bort.
Hörn- och kantsnapping kan slås av separat. CAD-referenser är underlag och
konverteras inte till konstruktionsobjekt.

CAD-underlag placeras i modellens XY-plan. Filens ursprungliga XY-koordinater
bevaras. Enheten läses från INSUNITS; saknad eller okänd enhet antas vara
millimeter och visas som en upplysning. Enhet, X/Y/Z i millimeter, rotation runt Z
och skala kan ändras på referensen. Snapping använder samma transformation.
Referenser behåller filens koordinater vid import; förflyttning och rotation
börjar på noll. Välj en referens i listan och använd modellens Move/Flytta eller
Rotate/Rotera för att transformera hela underlaget. Rotera använder samma valda
referenslinje som modellobjekten och fungerar runt valfri axel. IFC behåller sin
skala. Referensfliken visar förflyttning X/Y/Z i mm och rotation X/Y/Z i grader
från det importerade läget. Förhandsvisning kan avbrytas, och bekräftade verktygs-
ändringar kan ångras. Transformeringen följer med vid sparning och filbyte.

CAD-referensens lager med importerad geometri kan tändas/släckas separat.
Listan har 24 px höga rader, sökning och en egen scroll efter åtta rader.
Visa alla/Dölj alla gäller hela listan, även när sökningen filtrerar rader.
Dolda lager bidrar inte till snapping, markering eller referensens visade utbredning.
Lager 0 i block ärver lagret från blockets insättning. Lagerlistans antal avser
importerade linjeobjekt och textrader; objekttyper utan stöd ingår inte.

Placeringen kan låsas för IFC, DWG och DXF. Låset spärrar Move, Rotate och de
numeriska placeringsfälten. Återställ importläge nollställer förflyttning och
rotation och kan ångras; vald CAD-enhet och skala behålls.
Lagerinställningar och placeringslås sparas med projektet och behålls vid filbyte.

Importen omfattar model space, med alla lager i referensen. Paper space
och uttryckligen osynliga objekt utesluts. LINE, LWPOLYLINE, plana POLYLINE,
CIRCLE, ARC, TEXT, MTEXT och enkla INSERT-block stöds. DIMENSION visas via
filens geometriblock när ett sådant finns. Kurvor approximeras med linjesegment
och text visas med Arial. Linjetyper, typsnitt och linjevikter återskapas inte exakt.
3D-solider, hatch, spline, externa xrefs, speglade/ojämnt skalade block och andra
objekt som saknar stöd importeras inte. Referensens uppgifter visar utelämnade
objekttyper; en fil utan stödd geometri ger ett fel.

Gränsen är 10 MB för CAD-filen och den mellanliggande ASCII-DXF-filen samt
100 000 utökade geometriobjekt. IFC, DWG och DXF sparas med sina originalfiler
i projektfilen tillsammans med namn, grupper, synlighet, transparens och snapping.
CAD-enhet och placering sparas också. När projektet öppnas läses referenserna
lokalt på nytt. Äldre projektfiler utan referenser öppnas med en tom lista.
Hela projektfilen får vara högst 100 MB, inklusive de inbäddade filerna.

DXF parsas med projektets befintliga dxf-parser. DWG konverteras till DXF i en
lokal Web Worker med @mlightcad/libredwg-web 0.7.15 och WebAssembly. Filer skickas
inte till en konverteringstjänst. Läsaren laddas vid DWG-import; dess WASM och
worker-resurser ingår i bygget och service workerns cache.

DWG-beroendet har GPL-3.0-licens (se paketets LICENSE), vilket måste beaktas vid
distribution av applikationen. Källkod och bibliotekets dokumentation:
<https://github.com/mlightcad/libredwg-web> och
<https://mlightcad.com/libredwg-web/docs/index.html>.
