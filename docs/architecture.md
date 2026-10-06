# Kodens ansvar och gränser

## Befintlig struktur

- `src/project/`: projektdata, historik och ritningsändringar. Inga DOM- eller lagringsanrop.
- `src/model/object-types/`: geometri, validering och ankare för objekttyper.
- `src/model/tools/` och `src/model/ui/`: modelleringskommandon respektive deras UI-kopplingar.
- `src/model/navigation.js`: ortografisk kamera, inpassning, arbetsplansvy och orbitcentrum. Ingen tillgång till projektet eller DOM. Kontroller kan bytas; konsumenter ska alltid läsa aktuell `navigation.controls`.
- `src/model/viewport.js`: WebGL-renderer, ljus, resize, wheel och städning av dessa resurser.
- `src/app/`: kopplar editorer till projektet och dess historik.
- `src/drawing/ui/`: bygger GA- och Single Part-editorernas grundläggande DOM och returnerar elementreferenser. Ingen projektdata, geometri eller lagring.
- `src/plan-view.js` och `src/single-part-sheet.js`: ritningscontroller, händelser och rendering; använder UI-fabrikerna ovan och gemensamma ritningsmoduler.
- `src/references/`: lokal IFC-tolkning, referensgeometri och snapsökning.

`main.js` kopplar fortfarande ihop flera modelleringsflöden. Den är inte en ren
startfil ännu. Ritningscontrollererna skapar fortfarande vissa dynamiska
kontroller. Ram- och profileditorerna samt referenspanelen behöver motsvarande
uppdelning när deras ansvar utökas. Många äldre ritningsmoduler ligger kvar i
`src/`; flytta dem tillsammans med ansvar och uppdatera importerna, inte bara
för att minska antalet filer där.

## Vid utbyggnad

1. Lägg geometriska regler och projektändringar i moduler som kan testas utan DOM.
2. Låt UI rapportera användarens avsikt; projektcontroller ansvarar för historik och ändringar.
3. Dela beteende mellan GA och Single Part där reglerna är samma. Behåll projektion och källobjekt specifika för ritningstypen.
4. Undvik att skicka hela appen eller editorn till en hjälpfunktion. Använd uttryckliga argument, callbacks och returnerade elementreferenser.
5. Behåll importer enkelriktade. UI-fabriker får inte importera sin controller.

`tests/architecture.test.js` bevakar utvalda gränser; det är inte en fullständig
beroendeanalys. `tests/model-navigation.test.js` kontrollerar att orbitcentrum
inte flyttar bilden, att arbetsplansvy bevarar verktygslås och att inpassning
rymmer geometrin. Kör `npm run check` samt berörda användarflöden i webbläsaren
innan publicering.

### Sweep-egenskaper i inspektorn

Sweep och Plate använder det gemensamma attributramverket i `src/inspector/`. Attributscheman beskriver fält, enheter, egna kontroller, avsnitt och kopieringsgrupper; gemensamma presentationsregler och samma kopieringsadapter bygger inspektorn. Modellvalidering och transaktioner ligger kvar i objektens adaptrar. Se [inspektorramverket](inspector.md) för hur nya typer ansluts.

Sweep-inspektorn använder kompakta rader med etikett till vänster och kontroll till höger. Identitet och numrering ligger i ett hopfällbart avsnitt. Insättningen visar sitt aktuella värde i raden; öppna avsnittet för tvärsnittsbilden och placeringsmatrisen. Biblioteksprofiler visar profilnamnet och förhandsvisningen; deras låsta dimensionsfält upprepas inte.

**Kopiera till andra…** utgår från en markerad sweep och låter användaren välja flera målsweeps i modellen. Klick på ett redan valt mål avmarkerar det. Kryssrutor direkt vid egenskapsraderna väljer profil och mått, material, objektfärg, profilrotation, insättningspunkt och valfritt namn. Profilens och måttens kryssrutor är sammankopplade: profilvalet kopierar hela profilens snapshot och mått tillsammans. Valen går även att ändra under pågående målval; de ändrar inte källobjektets egenskaper. Koordinater, längd, identitet, numrering, arbetsplanets profilriktning och kopplingsreferenser tillhör målet. **Modifiera** eller Enter applicerar hela målgruppen som en gemensam transaktion, med uppdatering och validering av beroende kopplingar. Escape avbryter; Ångra återställer hela kopieringen.

Senast använda sweep-egenskaper sparas separat från projektet i webbläsaren under `lirastructure.sweep-defaults.v1`. Nya och modifierade sweeps uppdaterar inställningarna; när en ny sweep startas från ett markerat objekt används dess egenskaper. Giltiga ändringar i en ny sweeps formulär sparas också. Profil, dimensioner, material, färg, rotation och insättning återanvänds även efter omladdning, inklusive profiler och material som finns som sparade snapshots. Koordinater, namn och objektidentiteter återanvänds inte. Ogiltiga formulärvärden ersätter inte de senast giltiga inställningarna. Om lagring är otillgänglig fungerar senaste värdena för den aktuella sessionen.

### Plate-egenskaper i inspektorn

Plate använder samma kompakta rader och kopieringsflöde. Tjocklek, material, objektfärg, placering på planets positiva/negativa sida och valfritt namn kan kopieras till flera fristående plåtar. Målplåtens kontur, konturoffset, arbetsplan, hål, identitet och numrering behålls. Modifiera eller Enter uppdaterar hela målgruppen och beroende kopplingar i en gemensam transaktion; Ångra återställer den. Kopplingsgenererade plåtar och skärobjekt ingår inte i egenskapskopieringen.

Senaste tjocklek, placering, konturoffset, material och objektfärg för fristående plåtar sparas under `lirastructure.plate-defaults.v1`, separat från Sweep. Giltiga ändringar under insättning samt skapade och modifierade plåtar uppdaterar dessa värden. En ny Plate utgår från markerad fristående plåt eller de sparade värdena, även efter omladdning. Kontur, arbetsplan, namn och identitet återanvänds inte; skärobjekt och kopplingsgenererade plåtar ändrar inte förvalen.
