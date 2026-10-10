# Kodens ansvar och gränser

## Ägarskap

| Lager | Äger | Ska inte äga |
| --- | --- | --- |
| Projekt (`src/project/`) | Sparbara data, filvalidering, assemblies, ritningsändringar och historik | DOM, storage, aktiva verktyg |
| Objekttyper (`src/model/object-types/`) | Geometri, validering, ankare, snappsegment och transformregler | UI, projektmutationer |
| Verktygsregler (`src/model/tools/`) | Föreslagna objekt och beroende ändringar | Checkpoints, UI-händelser |
| Modell-editor (`src/app/model-editor.js`) | Förbereda, validera och bekräfta objektändringar med en checkpoint | DOM, markering, kamera, rendering |
| Editorstatus (`editor-state.js`, `tool-session.js`) | Markering, utkast, pågående kommando och punktval | Sparbara projektdata |
| Punktplacering (`src/model/ui/placement-controller.js`) | Punktflöde, exakt avstånd, flytt/kopiering och adapter till specialverktyg | Egen snapmotor, direkt objektmutation |
| Modellträffar (`src/model/ui/model-picking.js`) | Raycast, modellträffar och anrop till gemensam `resolveSnap` | Geometriredigering, nya snapinställningar |
| Förhandsvisning (`src/model/ui/model-preview.js`) | Tillfällig geometri, beroende objekt, validering och återställning av visning | Commit eller historik |
| Snapvisning (`src/model/ui/snap-overlay.js`) | Markör, riktningslinje och status för befintligt snapresultat | Snapbeslut eller nya kontroller |
| Modell-UI (`src/model/ui/`, `src/inspector/`) | Kontroller, avsikter och presentation av förhandsvisningar | Direkt skrivning till objektlistan |
| Visning (`viewport.js`, `object-mesh.js`, `navigation.js`) | Kamera, WebGL, visuell återkoppling och inpassning | Domänbeslut och historik |
| Uppstart (`main.js`, `app/workspace-startup.js`) | Stilar, mallinstallation, återställning och start av appen | UI-händelser och modellregler |
| App-koppling (`app/model-application.js`) | Skapa editor/visning och ansluta controllerer i rätt ordning | Händelsehantering, geometri och användarkommandon |
| App-controllerer (`src/app/`) | Koppling mellan projekt, editorer, filer och storage | Egna geometriregler |

## Modelländringarnas gemensamma väg

```text
UI / mus / tangentbord
  → verktyg eller inspektor föreslår objekt
  → befintlig snap och förhandsvisning
  → modelEditor.prepare / update / add / replace
  → validering av resultatet
  → en checkpoint och ändring av projekt.objects
  → markering och rendering
```

`prepare` ändrar varken projektet eller historiken. `update` hanterar befintliga objekt och kopiering, inklusive beroende kopplingar och skruvar. `add` lägger till identifierade objekt. `replace` bekräftar ett färdigberäknat resultat, exempelvis efter radering eller en komponentändring. Ogiltiga resultat avvisas före checkpoint. Samma objektlista ger ingen ny checkpoint.

Sweep, Plate, stomlinjer, inspektorändringar, flytt/kopiering/rotation, material, objektidentitet, skruvar, komponentegenskaper, Item och referenskonvertering använder denna commitgräns. UI visar fel och uppdaterar markering efteråt. Specialiserad geometrivalidering och förhandsvisning finns fortfarande i deras befintliga adaptrar.

Import av hela projekt, återställning, migrering och ändringar av andra projektdata (ritningar, numrering, inställningar och assemblies) har egna projekttransaktioner. Modell-editorn ersätter inte dessa med en objekttransaktion. Stomlinjernas äldre koordinatdata migreras av `grid-objects.js`; projektets grid-cache härleds sedan från objekten för ritningar och äldre konsumenter.

## Gemensamma modelleringsfunktioner

Alla 3D-objekt ansluts till objekttypsregistret. Det kräver geometri, validering, ankare, hörn, snappsegment, translation och rotation samt ritnings-/numreringsstöd för fysiska typer. Icke-fysiska stomlinjer och hjälpobjekt undantas från tillverkningsnumrering.

Modellens markering, `resolveSnap`, `selectionGrips`, transformverktyg och inspektorns förhandsvisning/commit ska återanvändas. Ny objekttyp är inte skäl att bygga en separat snapmotor, låsa resten av modellen eller skapa ett nytt editorläge. Snapinställningarna kommer från `project.snap`; kontroller flyttas inte mellan Settings och andra menyer som en bieffekt av implementationen.

Sweep och Plate har gemensamma attributscheman och layout-/kopieringsadapter. Stomlinjefälten använder den vanliga inspektorns transaktioner. Numrering och insättning är alltid synliga för fysiska delar. Se `docs/inspector.md` för attributramverket.

## Ritningar och andra editorer

`drawing/ui/` bygger GA- och Single Part-editorernas grundläggande DOM. Controllererna tillför projektdata och beteende via argument och callbacks. `app/drawing-controller.js` kopplar ritningseditorerna till projektets historik. Modell, ritning, rapport, ram-, profil- och Item-editorer använder de gemensamma UI-fabrikerna i `src/ui/`. Arbetsytornas adaptrar beskriver grupper och placering; befintliga controllerer behåller kommandon, data, snap och historik. Biblioteken använder gemensamma flyttbara fönster. En aktiv arbetsyta med tydlig återgång används utan dokumentflikar. Se `docs/ui.md` för kontrakten och navigeringen.

## Gränser som koden kontrollerar

ESLint förbjuder DOM/storage och UI-importer i projektmoduler, objekttyper och verktygsregler. Ritningarnas UI-fabriker får inte importera projekt eller controllerer. Modell-UI, inspektorns adaptrar och de nya app-adaptrarna får inte tilldela eller mutera `project.objects` direkt: commit sker genom modell-editorn. `main.js` får enbart importera stilar och de två uppstartsmodulerna; händelsehantering och modellbeteende är förbjudet där. App-kopplingen får inte registrera UI-händelser. Oanvända beroenden kontrolleras i dessa controllerer.

Reglerna kontrollerar konkreta beroenden och mutationer; de kan inte garantera bra UX eller upptäcka varje tänkbar indirekt mutation. `AGENTS.md` beskriver arbetsreglerna och `docs/testing.md` beskriver beteendeverifieringen.

## Uppstart och controllerernas ägarskap

`main.js` laddar stilar, väntar på `recoverWorkspace()` och anropar `createModelApplication()`. Uppstarten installerar mallar och återställer projektet med befintlig projektåterställning. App-kopplingen skapar gemensam editorstatus, verktygssession, historik, modell-editor och visning.

Stabila beroenden skapas före controllerinstallation. Controllerer deklarerar vilka argument de behöver. `actions` innehåller namngivna callbacks med en ägare; fördröjda anrop löser kopplingen mellan exempelvis session, rendering och inspektor utan cirkulära importer. `controllers` innehåller handtag till UI som skapas senare. Båda tillhör en appinstans och får inte användas som globala tjänster eller importeras av domänmoduler. Gemensamma caches och den väntande pekarhändelsen har uttryckliga tillståndsobjekt. Renderloopen startar sist.

| Ansvar | Ägare |
| --- | --- |
| Meshcache, återanvändning, snapindex och synkronisering av modellens UI | `model/ui/model-renderer.js` |
| Markering, skapa/uppdatera/radera, historikåterställning, verktygsavbrott och standardvärden | `model/ui/model-session.js` |
| Pointer- och tangentbordsrouting | `model/ui/model-input.js` |
| Invalidation, väntande pointer och animation | `model/ui/model-frame-loop.js` |
| Koppling till befintliga selection-, rotation-, plate- och helper-controllerer | `model/ui/model-tool-controllers.js` |
| Verktygsmeny och cut-kommandon | `model/ui/model-toolbox-controller.js` |
| Sweep-formulärets koppling till sessionen | `model/ui/model-sweep-form-controller.js` |
| Synlighet, modellträd, filter, hover och kontextmeny | `model/ui/model-visibility.js`, `model-browser-controller.js`, `model-hover.js`, `model-context-menu.js` |
| Inspektorns transaktioner, bibliotek, identitet och egenskapskopiering | `inspector/model-attributes-controller.js`, `model-library-controller.js`, `model-identity-controller.js`, `model-property-copy.js` |
| Skruvar, komponenter och Item | `app/model-fasteners.js`, `model-components.js`, `model-items.js` |
| Inställningar/import, nivåer, ritningar/numrering, rapporter, referenser och assemblies | Motsvarande `app/workspace-*.js` |
| Autosparning, återställningsstatus och PWA | `app/workspace-recovery.js` |
| Valfria utvecklarmätningar | `app/workspace-diagnostics.js` |

`tests/model-session.test.js` kör session, modell-editor, historik, riktiga meshobjekt, synlighet och snapindex tillsammans med en ersatt UI-gräns. Det kontrollerar commit, ogiltiga ändringar, radering/ångra/gör om samt meshåteranvändning och frigöring. `tests/model-placement.test.js` verifierar punktplaceringens preview och flytt/kopiering med samma editor/historik. Webbläsarkontroll behövs fortfarande för den kompletta uppstarten och användarflödena.

## Fortsatt strukturarbete utanför main

Ram-, profil- och ritningscontrollererna blandar fortfarande en del presentation och arbetsflöde. Många äldre domänmoduler ligger direkt i `src/`. Dessa områden har inte byggts om i denna uppdelning. Flytta sammanhängande ansvar när det berörs, med tydliga argument/callbacks; undvik kosmetiska filflyttar och generella ramverk enbart för att minska radantalet.
