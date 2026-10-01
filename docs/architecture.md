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
