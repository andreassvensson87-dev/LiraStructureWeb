# Geometrikonvertering från IFC

## Användning

Välj enskilda referensobjekt med switchen i nedre menyn, klicka på ett IFC-objekt i modellvyn och välj **Konvertera…** via högerklick eller **Konvertera markerat IFC-objekt…** i referenspanelen. Dialogen visar typ, profilförslag, manuellt profilval och eventuella avvisningsorsaker. **Konvertera** bekräftar objektet; referensen behålls och ändringen kan ångras i ett steg. Utan markerat IFC-objekt är kommandot avstängt.

IFC Beam, Column, Member och BuildingElementProxy kan bli Sweep med återvunnen eller verifierad biblioteksprofil. IFC Plate kan bli Plate med kontur, tjocklek och arbetsplan; Plate med genomgående hål stöds ännu inte. Alla resultat måste klara respektive objekttyps vanliga validering. Profilmatchningen omfattar bibliotekets stödda profilfamiljer enligt `docs/profile-matching.md`.

Material och materialkvalitet överförs inte; ange material i inspektorn efteråt. Delarna är vanliga modellobjekt som kan redigeras, numreras, sparas och användas i ritningar. Källfil, IFC GlobalId och ExpressId sparas på delen. GlobalId, eller filnamn + ExpressId om GlobalId saknas, förhindrar dubbelkonvertering. Detta är en engångskonvertering; ändringar i referensfilen synkroniseras inte till redan skapade delar.

## Geometrins ansvar


Konverteringen arbetar på samma Float32-mesh och världsmatris som referensvisning och snap. Filens längdenheter, mappade placeringar, projektets baspunkt och manuell referensplacering är redan tillämpade av import-/koordinatadaptrarna. Geometrimodulerna läser inga IFC-entiteter, profilnamn, DOM-element eller biblioteksdata.

## Ansvar

- `references/conversion-mesh.js`: läs världstransformerade trianglar, välj närliggande beräkningsorigo, kontrollera finita koordinater och sluten topologi samt samla volym och kandidatnormaler. Rundade profiler avvisas inte längre för att de har fler än 64 normalriktningar. Högst 20 000 ingångsvertexar behandlas.
- `references/conversion-geometry.js`: återvinn rak extrusion, båda ändkonturerna, inre konturer, längdriktning och tvärsnitt. Kandidater från både capnormaler och längskanter verifieras; en nästan parallell lång triangeldiagonal får inte ensam bestämma riktningen.
- `references/conversion-caps.js`: återvinn två plana, eventuellt sneda ändar och längsgående sidor. Båda ändarna måste ha samma projicerade kontur. Hål i profilens längdriktning bevaras. Tvärgående hål, urtag, flera ändkapplan och krökta längdaxlar godtas inte via denna väg.
- `references/conversion-object.js`: översätt resultatet till befintliga Sweep/Plate och vanliga Linecut-objekt. Vid sneda ändar förlängs ämnet 10 mm i varje ände före de två kapningarna, så att CSG inte skär tangentiellt vid ämnets yttersta hörn. Kapningarna tar bort hela tillägget.
- `references/conversion-verification.js`: kontrollera att modellens verkliga CSG-resultat behåller källans volym och utbredning före profilval.
- `references/conversion.js`: samordna geometriförslaget, anropa den separata profilmatchningen, göra ett fristående manuellt profilbyte och tilldela objektidentiteter. `convertReferencePart` returnerar `{ object, cuts }`; kapningar får inte tappas bort av anroparen.
- `references/conversion-ui.js`: presentera resultat och avsikter med befintliga byggblock. Den äger inga geometriregler.

`planReferenceConversion` föreslår separata kapningar på raden. `conversionObjects` ger dem egna identiteter och kopplar dem till den nya delens ID. Del och kapningar bekräftas tillsammans genom modell-editorn med en enda checkpoint. Appen räknar och markerar endast de fysiska delarna efteråt. Vanliga Flytta/Kopiera/Rotera använder `model/tools/transform-sources.js` för att ta med skärningar vars samtliga måldelar ingår; kopierade skärningar får de nya målidentiteterna. Punktgrepp behåller den befintliga punktredigeringen.

## Geometriska gränser

Meshanalysen använder 0,02 mm positionskontroll och relativ volymkontroll 0,0001. Slutlig modellgeometri ska behålla utbredningen inom 0,05 mm. För slutvolymen tillkommer en uttrycklig Float32-budget: källans ytarea gånger maximal koordinatavrundning vid aktuell koordinatstorlek. Detta tar hänsyn till att modellens mesh lagrar absoluta koordinater som Float32; budgeten hämtas aldrig från profilnamn eller ett förmodat material. Analysen av källans extrusionsform får inte denna utvidgning.

Slutkontrollen görs före automatisk eller manuell biblioteksersättning. Ett avsiktligt byte av profil kan ändra rundningar och tvärsnitt. Profilmatchningens egna mått-/konturregler ligger kvar i `profile-match*.js`. Ingen omslutande låda ersätter ett objekt som inte kan konverteras.

## Återupprepbar analys

```sh
node scripts/analyze-ifc-conversion.mjs /absolute/path/model.ifc /tmp/conversion-report.json
```

Skriptet kör web-ifc med importerarens inställningar, behåller faktiska placeringar och provar balkar, pelare och stänger. Det använder en tom profilkatalog för att mäta geometri utan biblioteksersättning. Rapporten innehåller ID/namn, antal delar/kapningar, avvisningsorsak, relativ volymavvikelse, Float32-budget och största skillnad i utbredning. Detta är inte en kontroll av material, numrering, metadata eller IFC-läsarens tessellering mot Revit.

2026-10-15: K-20-V-01.ifc gav före ändringen 455 av 691 geometriskt konverterbara objekt. Efter ändringen gav samma fil 661 godkända objekt, varav 24 med ändkapningar. Samtliga 661 klarade kontroll av färdig modellgeometri i filens faktiska placering. Största skillnad i utbredning var cirka 0,026 mm; största relativa volymskillnad cirka 0,079 %. Resterande 30 stoppas: 15 har flera geometrier, 7 har former utanför extrusions-/tvåplansreglerna och 8 klarar inte triangelnätets slutna topologikontroll. Ett avvisat triangelnät är inte i sig bevis för ett fel i Revit-modellen.

Tre små anonymiserade meshutdrag i `tests/fixtures/revit-conversion-meshes.json` bevarar källans Float32-tessellering men använder generiska identiteter och placeringar. De skyddar rundad UPE, mappad hålprofil och snedkapad I-profil. Originalfilen lagras inte i repositoryt.
