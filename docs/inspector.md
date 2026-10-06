# Gemensamma inspektorattribut

Sweep och Plate använder `src/inspector/object-schemas.js` och samma layout- och kopieringsadapter. Fit, fotplåt, avstyvning, ändplåt, ändplåtskoppling och balkskarv använder `src/inspector/component-schemas.js`, som översätter komponentdefinitionernas parametrar och grupper till samma attributstruktur. Objektets attributbeskrivning anger nyckel, rubrik, kontrolltyp, enhet, befintlig kontroll/egen widget, kopieringsgrupp och hopfällbara avsnitt. `attributes.js` sköter rader, tillgängliga etiketter, avsnitt, synkroniserade kopieringsval, låsning av källkontroller under målval och meddelanden. Grundläggande radlayout, etikettbredd och kontrollhöjd ligger i de gemensamma `.attribute-inspector`/`.attribute-row`-reglerna i `src/style.css`.

## Ansluta en objekttyp

1. Beskriv fälten med `defineAttributeSchema`. Fältnycklar ska vara unika. Stödda typer är `number`, `text`, `select`, `checkbox` och `custom`.
2. Ange `selector` för befintliga kontroller och `row: 'label'` eller `row: 'self'`. `mountAttributeLayout` återanvänder dessa kontroller och deras händelser. Nya vanliga fält kan skapas med `createAttributeRow`; egna visualiseringar monteras via `custom` eller som ett befintligt widgetavsnitt.
3. Ange `copy` för kopierbara fält och definiera gruppernas rubriker i `copyGroups`. Flera fält kan dela grupp, som Sweep-profilens mått. `unchecked` anger avbockade förval. Geometri, identitet och referenser ska inte bli kopierbara av misstag.
4. Beskriv avsnitt med `sections`: nyckel, rubrik och innehållsselektor. Insättningsfiguren behålls i ett eget avsnitt och ändrar inte sin funktion.
5. Objektadaptern ansvarar för värden, specialvillkor, validering, förhandsvisning och atomisk modelluppdatering. Anropa layoutens `sync` med aktuellt tillstånd. Ett nytt fält kan använda `visibleWhen(state)` för deklarativ synlighet; befintliga Sweep/Plate-kontroller behåller sina etablerade geometrivillkor.

Exempel på en vanlig attributrad:

```js
const field = {
  key: 'thickness',
  label: 'Tjocklek',
  type: 'number',
  unit: 'mm',
  min: 1,
  max: 1000,
  step: 'any',
};
const row = createAttributeRow(field, {
  value: draft.thickness,
  onChange: (key, value) => updateDraft(key, value),
});
```

Ramverket utför inga geometriberäkningar och skriver inte till projektet. Kopieringsadapter, historik och modellregler ligger utanför presentationslagret. Ändringar av radlayout görs centralt; nya objekttyper behöver beskriva sina attribut och ansluta sina modelloperationer. Kopplingarnas skruvval behåller sin bibliotekskontroll som en egen widget, medan rader, enheter, villkorad synlighet, grupper och kopieringskryssrutor hanteras gemensamt. `createAttributeSection` bygger avsnitt för nya kontroller; `mountAttributeDisclosure` kan flytta befintliga widgets till ett avsnitt. Egenskapskopiering stöds för alla sex kopplingstyper, mellan kopplingar av samma typ. Kopierbara nycklar hämtas från komponentdefinitionernas parametrar; referenser och härledd geometri ingår inte. Gemensamma förval i `localComponentCopyKeys` lämnar ändar, lokala placeringar och rotationer avbockade. Nya definitioner återanvänder samma parameterbaserade kopieringsflöde.

## Referensmodeller

Referensfliken visar lokala IFC-filer i en sökbar, grupperad lista. Varje import lägger till en separat referens. Ögonknappar styr synligheten för en modell, en hel grupp eller alla referenser. Sökning matchar namn, filnamn och grupp och visar matchande modeller även i hopfällda grupper.

Klick på modellnamnet öppnar en kompakt detaljvy med tillbakaknapp. Namn, grupp, synlighet, transparens och snapping ändras direkt. Filbyte ersätter enbart den valda referensen efter lyckad import; fel och avbrott behåller befintlig geometri. Dolda referenser påverkar varken snapping eller Visa allt. Borttagning frigör referensens geometri och avbryter pågående import.

Referenser och grupper är fortfarande lokala för sessionen och sparas inte i projektfilen. IFC-filer behöver läggas till igen efter omstart. Placering kommer från IFC-filen; panelen tillför inga manuella offset-, rotations- eller skalningsfält i detta steg.

## Ritningshanterare

Ritningar visas i en kompakt tabell med filter för GA, Single Part, Assembly, aktuell status, nya ritningar och ritningar som behöver uppdateras. Sökning matchar ritningsattribut, status, format och skala. Kolumnrubriker sorterar med naturlig nummerordning. Revision visas från början; övriga attribut väljs i Kolumner. Befintlig redigering av ritningsattribut finns kvar i raderna.

Kryssrutor ger flerval och Markera alla gäller visade rader. Filter och sökning rensar markeringar som inte längre visas. Öppna och Uppdatera gäller en giltig ritning åt gången och öppnar befintlig ritningseditor mot aktuell modell. Dubbelklick på radens fria yta eller Enter på en fokuserad rad öppnar den. Mellanslag växlar markering. Status Aktuell bekräftas i editorns befintliga granskningsflöde.

Duplicera kan skapa flera GA- eller Single Part-kopior med unika nummer och egna bladinställningar. Kopior behåller modellreferenser och börjar utan granskningsstämpel. Assemblyritningar dupliceras inte eftersom namn och nummer ägs av assemblyn. Ändringarna använder projektets befintliga historik. PDF-export finns för GA, Single Part och Assembly.

### PDF-export

Markera ritningar och välj Exportera PDF. Filen innehåller ett blad per sida i tabellens aktuella sorteringsordning. Varje sida behåller bladets format och orientering, även vid blandade format. En enskild ritning får ritningsnumret som filnamn; en samlad export heter Ritningar.pdf. Länken Hämta PDF kan användas för att hämta filen igen.

Exporten använder befintliga ritningseditorer med frikopplade ritningskopior och tomma spara-/granskningscallbackar. Modellgeometrin räknas om, utan att ändra projektets bladinställningar, historik eller granskningsstatus. GA-vyer, snappingrutnät, vytexter och ritningsram läggs samman i SVG; detalj- och Assemblyblad använder sin komponerade SVG med stycklistor och anteckningar. Redigeringsramar och draghandtag tas bort. Ritningar med saknade/ändrade källor måste åtgärdas före export.

SVG konverteras lokalt till PDF med jsPDF och svg2pdf.js, som laddas vid export. Geometri och text behålls som vektorer. PDF använder standardtypsnitt; full inbäddning av användarens egna typsnitt ingår inte.

### Revision

Markera en eller flera ritningar och välj Revision… för att ange revisionsbeteckning (t.ex. A eller 1), skapad av, kommentar och revisionsdatum. Gemensamma befintliga värden visas i formuläret; datum förväljs till dagens lokala datum. Spara revision uppdaterar samtliga markerade ritningar i en historikändring och markerar dem för kontroll. Namn, ritningsnummer och modellreferenser behålls.

Alla fyra värden finns som inbyggda attribut för samtliga ritningstyper och i ramblockseditor: drawing.revision, drawing.revisionCreatedBy, drawing.revisionComment och drawing.revisionDate. De kan också visas som kolumner i hanteraren. Revisionsdatum är separat från ritningens ursprungliga datum, och skapad av är separat från ritad av. Ritningsblock och PDF hämtar värdena från ritningens attributkontext. Fälten sparas i projektfilen och ingår i ritningens granskningsstämpel. Detta steg hanterar den aktuella revisionens värden; separat revisionshistorik och utgivna PDF-versioner återstår.

### DXF till ramblock

I ramblockseditor öppnar **Importera DXF…** en filruta med namn, enhet,
skala och insättningspunkt X/Y i filens koordinater. Enhet föreslås från
`$INSUNITS` och insättningspunkt från `$INSBASE`; utan enhet föreslås mm.
Importen skapar ett nytt osparat ramblock. **Spara** lägger det i det lokala
biblioteket. Ett öppet block med osparade ändringar har samma bekräftelse som
vid öppning av ett annat block. Läs- och konverteringsfel lämnar det kvar.

Textbaserad DXF stöds, högst 10 MB. LINE, LWPOLYLINE, vanlig 2D POLYLINE,
CIRCLE, ARC, TEXT och MTEXT konverteras till separata redigerbara objekt.
Bågar, cirklar och polylinjers bulge-segment blir polylinjer. INSERT expanderas
med blockets baspunkt, rotation och positiv likformig skala, även nästlade
block. Lagerfärg och vanlig linjetjocklek används. Text får Arial; MTEXT
formatering förenklas till vanlig text och separata styckerader. TEXT använder
vanlig vänster-, center- och högerjustering. DXF-text kopplas inte automatiskt
till ritningsattribut; ersätt den med attributverktyget för dynamiska värden.

Binär DXF stöds inte. HATCH, SPLINE, DIMENSION, DXF-attribut och andra
objekttyper utelämnas och redovisas kort efter importen. Speglade eller
olikformigt skalade block, blockarrayer, specialjusterad text och 3D-objekt
utelämnas också. Importen begränsas till 20 000 konverterade objekt och
5 000 mm i bredd/höjd. Filen läses lokalt; UTF-8 används med Windows-1252
som reserv för äldre svenska filer.
