# Kodens ansvar och gränser

## Parametriska block

`src/blocks/definition.js` utvärderar parametrar, uttryck, lokala referensplan/-linjer, punktlåsningar, egenskapskopplingar och namngivna insättningspunkter utan UI. `session.js` äger det fristående definitionsutkastets testvärden och ångring. `placement.js` äger instansens lokala koordinatsystem och förankring. `grip.js` löser direktkopplade parametergrepp; kopplade uttryck kräver inspektorändring. `library-data.js` äger versions- och importregler; `library-store.js` är den separata lagringsgränsen.

`model-adapter.js` och `drawing-adapter.js` översätter samma definition till befintliga Sweep/Plate respektive ritformer. Ett block är en instanskoppling på dessa objekt, inte ett extra fysiskt modellobjekt eller en ny snapmotor. Material, part-/assemblynumrering och objektidentiteter ligger kvar på verkliga delar. Markering expanderar till hela instansen; flytt, kopiering och rotation transformerar också dess koordinatsystem. Kopior får egen instansidentitet. `validation.js` kontrollerar komplett medlemskap och geometri innan modell-/ritningstransaktionen ändrar projektet eller historiken. Projektfilen validerar och behåller definitionsögonblicksbilder; biblioteket behöver inte finnas för att instansen ska fungera.

`editor-controller.js` och `editor-inspector.js` använder gemensamt ribbon-, inspektor- och sektionsramverk. `editor-renderer.js` visar tillfällig geometri med befintliga modell-/SVG-renderare och frigör resurser vid stängning. `library-controller.js` använder samma flytande biblioteksfönster och filträd som övriga bibliotek. `instance-inspector.js` rapporterar avsikter via callbacks. Modellkopplingen i `app/model-blocks.js` går genom modell-editorn. Ritningskopplingen i `blocks/drawing-controller.js` använder ritobjektens befintliga punktval, snap, grepp och historik; bladgrafik ligger i `drawing-paper-renderer.js` och återanvänder den vanliga SVG-renderingen för export.

Första versionen stöder fristående profiler/plåtar i 3D och ritformer i 2D. Geometri ritas med vanliga verktyg och omvandlas från markering. Definitionseditorn arbetar med parametrar och bindningar; referenser följer blockets lokala axlar och kan roteras tillsammans med instansen. Generell constraint-lösning, sneda referenser inom definitionen, nästlade block och parametriska arrayer ingår inte. Biblioteksrevisioner används uttryckligen; befintliga instanser uppdateras först på användarens begäran.

## Ägarskap

| Lager                                                      | Äger                                                                          | Ska inte äga                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| Projekt (`src/project/`)                                   | Sparbara data, filvalidering, assemblies, ritningsändringar och historik      | DOM, storage, aktiva verktyg                      |
| Objekttyper (`src/model/object-types/`)                    | Geometri, validering, ankare, snappsegment och transformregler                | UI, projektmutationer                             |
| Verktygsregler (`src/model/tools/`)                        | Föreslagna objekt och beroende ändringar                                      | Checkpoints, UI-händelser                         |
| Modell-editor (`src/app/model-editor.js`)                  | Förbereda, validera och bekräfta objektändringar med en checkpoint            | DOM, markering, kamera, rendering                 |
| Editorstatus (`editor-state.js`, `tool-session.js`)        | Markering, utkast, pågående kommando och punktval                             | Sparbara projektdata                              |
| Punktplacering (`src/model/ui/placement-controller.js`)    | Punktflöde, exakt avstånd, flytt/kopiering och adapter till specialverktyg    | Egen snapmotor, direkt objektmutation             |
| Modellträffar (`src/model/ui/model-picking.js`)            | Raycast, modellträffar och anrop till gemensam `resolveSnap`                  | Geometriredigering, nya snapinställningar         |
| Förhandsvisning (`src/model/ui/model-preview.js`)          | Tillfällig geometri, beroende objekt, validering och återställning av visning | Commit eller historik                             |
| Snapvisning (`src/model/ui/snap-overlay.js`)               | Markör, riktningslinje och status för befintligt snapresultat                 | Snapbeslut eller nya kontroller                   |
| Modell-UI (`src/model/ui/`, `src/inspector/`)              | Kontroller, avsikter och presentation av förhandsvisningar                    | Direkt skrivning till objektlistan                |
| Visning (`viewport.js`, `object-mesh.js`, `navigation.js`) | Kamera, WebGL, visuell återkoppling och inpassning                            | Domänbeslut och historik                          |
| Uppstart (`main.js`, `app/workspace-startup.js`)           | Stilar, mallinstallation, återställning och start av appen                    | UI-händelser och modellregler                     |
| App-koppling (`app/model-application.js`)                  | Skapa editor/visning och ansluta controllerer i rätt ordning                  | Händelsehantering, geometri och användarkommandon |
| App-controllerer (`src/app/`)                              | Koppling mellan projekt, editorer, filer och storage                          | Egna geometriregler                               |

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

Import av hela projekt, återställning, migrering och ändringar av andra projektdata (ritningar, numrering, inställningar och assemblies) har egna projekttransaktioner. Modell-editorn ersätter inte dessa med en objekttransaktion. Stomlinjer lagras som modellobjekt; `grid-objects.js` härleder projektets grid-cache från objekten för ritningar och övriga konsumenter.

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

| Ansvar                                                                                       | Ägare                                                                                                                               |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Meshcache, återanvändning, snapindex och synkronisering av modellens UI                      | `model/ui/model-renderer.js`                                                                                                        |
| Markering, skapa/uppdatera/radera, historikåterställning, verktygsavbrott och standardvärden | `model/ui/model-session.js`                                                                                                         |
| Pointer- och tangentbordsrouting                                                             | `model/ui/model-input.js`                                                                                                           |
| Invalidation, väntande pointer och animation                                                 | `model/ui/model-frame-loop.js`                                                                                                      |
| Koppling till befintliga selection-, rotation-, plate- och helper-controllerer               | `model/ui/model-tool-controllers.js`                                                                                                |
| Verktygsmeny och cut-kommandon                                                               | `model/ui/model-toolbox-controller.js`                                                                                              |
| Sweep-formulärets koppling till sessionen                                                    | `model/ui/model-sweep-form-controller.js`                                                                                           |
| Synlighet, modellträd, filter, hover och kontextmeny                                         | `model/ui/model-visibility.js`, `model-browser-controller.js`, `model-hover.js`, `model-context-menu.js`                            |
| Inspektorns transaktioner, bibliotek, identitet och egenskapskopiering                       | `inspector/model-attributes-controller.js`, `model-library-controller.js`, `model-identity-controller.js`, `model-property-copy.js` |
| Skruvar, komponenter och Item                                                                | `app/model-fasteners.js`, `model-components.js`, `model-items.js`                                                                   |
| Inställningar/import, nivåer, ritningar/numrering, rapporter, referenser och assemblies      | Motsvarande `app/workspace-*.js`                                                                                                    |
| Autosparning, återställningsstatus och PWA                                                   | `app/workspace-recovery.js`                                                                                                         |
| Valfria utvecklarmätningar                                                                   | `app/workspace-diagnostics.js`                                                                                                      |

`tests/model-session.test.js` kör session, modell-editor, historik, riktiga meshobjekt, synlighet och snapindex tillsammans med en ersatt UI-gräns. Det kontrollerar commit, ogiltiga ändringar, radering/ångra/gör om samt meshåteranvändning och frigöring. `tests/model-placement.test.js` verifierar punktplaceringens preview och flytt/kopiering med samma editor/historik. Webbläsarkontroll behövs fortfarande för den kompletta uppstarten och användarflödena.

## Editorernas separerade ansvar

| Område                 | Ägare för utbrutet ansvar                                                                                                                             | Controllern behåller                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GA                     | `plan-view-geometry.js` bygger modellens plan-/snittresurser utan DOM; `plan-view-renderer.js` målar vy, stomlinjer och nivåer                        | Vyval, inställningar, projektionscache, IFC-koppling och resursfrigöring      |
| Single Part / Assembly | `part-sheet-geometry.js` väljer och cachar profilgeometri; `part-sheet-composer.js` komponerar blad, förteckningar och vyinspektorns synkronisering   | Öppning, sparning, vyverktyg, urval och geometrins livscykel                  |
| Ram                    | `frame-editor-renderer.js` målar ram och återkoppling; `frame-editor-inspector.js` visar egenskaper och blockinstanser                                | Verktyg, egenskapscommit, lokal historik och biblioteksoperationer            |
| Profil                 | `section-editor-renderer.js` målar canvas och lämnar måttens träffområden; `section-editor-inspector.js` visar parametrar och punktkopplingar         | Profildefinition, utvärdering, parameterändringar, verktyg och historik       |
| Skruv                  | `fasteners/library-inspector.js` visar bibliotek och produktfält; `fasteners/placement-inspector.js` visar tillbehör och hålfält                      | Produktversioner, placeringsförslag, validering och modell-editorcommit       |
| Referens               | `references/reference-import.js` äger worker, väntande geometri och importavbrott; `references/reference-inspector.js` visar lista och placeringsfält | Återställningstransaktion, bekräftade modeller, placering och modellmarkering |
| Item                   | `items/editor.js` äger editorutkast, tillfälliga hjälplinjer och 3D-visarens livscykel                                                                | `items/library-ui.js` äger bibliotek, import/export och versionslagring       |
| Ritningstext           | `drawing-rich-text-content.js` läser tillåten text/formatering; `drawing-rich-text-inspector.js` visar egenskaper                                     | Redigeringssession, placering, grepp och anteckningshistorik                  |

Presentationsmodulerna tar uttryckliga data, DOM-element och callbacks. De skapar inga egna UI-ramverk eller alternativa kommandoägare. Profilparametrar, hålkopplingar, urval och textändringar rapporteras till sina befintliga controllerer. Item-editorn sparar en validerad version genom bibliotekets callback och meddelar biblioteket vilken version som ska väljas. Referensimporten bekräftar en färdig modell genom referenscontrollern; ersättning och projektåterställning behåller sina transaktioner.

Geometribyggarna ändrar inte modellobjekten. GA:s grupp, gränser, snapreferenser och hatch är renderresurser som den anropande controllern äger och frigör. Single Part-cachen tillhör den öppna ritningen och frigörs vid stängning. ESLint förbjuder DOM/storage och UI-importer i dessa geometrimoduler samt kontrollerar oanvända beroenden i de berörda filerna.

Controllererna kan fortfarande vara omfattande eftersom de samordnar en hel arbetsyta. Fortsatt uppdelning ska följa sammanhängande ansvar med tydliga argument/callbacks; undvik kosmetiska filflyttar och generella ramverk enbart för att minska radantalet.

## Livscykel och skyddade gränser

Presentationens renderer-/inspektormoduler får inte importera app-kopplingar, controllerer eller lagringsmoduler och får inte använda browser storage. De tar data och callbacks från sin ägare. Modell-UI:s mutationsskydd omfattar även `this.project.objects` och andra kvalificerade objektlistor, inte bara en lokal variabel med namnet `project`. Import/återställning behåller sina uttryckliga projekttransaktioner.

`syncGridObjects` ändrar endast den härledda grid-cachen. Kopplingen mellan bubblans tillfälliga adress och ett stabilt objekt-ID ligger i cachens linjer; renderingen byter inte modellobjektens identitet och skriver inte klick-ID:n till dem. Markering, synlighet och highlight använder samma cache.

Dialoger, deras fasta händelsehanterare och UI-observers återanvänds under appinstansens livslängd. Stängning ska släppa sessionsresurser, inte avinstallera återanvändbara kontroller. Item-editorn frigör sin viewport, rensar utkast/hjälplinjer och tar bort utkastets fält med deras closures. Pågående versionslagring får slutföras, men ett sent resultat får inte välja, stänga eller visa fel i en annan session. Samtidiga versionsskrivningar från editorn blockeras.

GA avbryter väntande fördröjd ombyggnad och släpper snapdata vid stängning. IFC-vycontrollern avslutar worker, löser väntande jobb och tömmer cache. Single Part/Assembly frigör bas-/assembly-/profilgeometri, tömmer snittcache och snapdata samt släpper modellreferenser och bladets SVG. Ny öppning återskapar visningsresurserna från ritningsdata.

## Ritobjektens arbetsflöde

`drawing-annotations.js` äger urval, anteckningshistorik, routing och bekräftelse. `drawing-annotation-inspector.js` äger presentation och egenskapskontroller med uttryckliga tillståndsdata, DOM-element och callbacks. `drawing-shape-creation.js` och `drawing-dimension-creation.js` samlar punkter och validerar föreslagna utkast utan DOM eller historikmutation. Controllern bestämmer snap, verktygsbyte, checkpoint och commit. Dubblettpunkter ändrar varken objekt, historik eller redo. `drawing-object-transform.js` beräknar kopior och transformationer utan DOM eller projektmutationer. Verktygssessionen i `drawing-shape-transform.js` äger urval → baspunkt → tillpunkt/vinkel och använder samma resultat för preview och commit. Förvalda objekt går direkt till baspunkt; Shift-klick ger flerval. En transaktion omfattar hela urvalet. Objekt från olika vyer blandas inte i samma transformation; bladtext använder papperskoordinater. Positiva numeriska vinklar är moturs både på bladet och i vyer.

`drawing-point-placement.js` samordnar befintliga CAD-inställningar, snappunkter, `snapFrame`, riktningslås och `CadTracking`. Resultatet behåller snappunktens typ, modellreferens och eventuella spårningsguider. `drawing-snap-geometry.js` begränsar segmentens parvisa skärningssökning till pekarens träffområde. `frame-snap-intersections.js` gallrar exakta dubbletter, begränsar sökgränser till pekarens tolerans och prövar bara överlappande lokala gränser. Närmaste giltiga korsning skickas tillbaka till samma `snapFrame`; ändpunkts-/mittpunktsprioritet, Ortho och finita segment behålls. Exakta objektträffar prioriteras före spårning och polar. Snapinställningarna och längdfältet ligger kvar i sina befintliga kontroller.

`drawing-object-renderer.js` och `drawing-rich-text-renderer.js` ritar sparade objekt för skärm och PDF. `drawing-overlay.js` äger enbart tillfälliga markeringar, grepp, snappunktssymboler, gummiband, spårningsguider och grön preview. Hjälpgrafiken märks `data-annotation-helper` och tas bort vid export. Ritobjekt renderas före eller efter modellens geometri; modellens projicerade ytor ger korrekt täckning för bakomliggande ritobjekt. Bladtext har motsvarande bakre lager för GA-export och visning.

`DrawingAnnotations.paintOverlay()` uppdaterar ritobjektens dynamiska hjälplager vid pekarrörelser. Greppdrag ritar om ritobjektslagren, inte modellprojektionen. `DrawingRichTextEditor.paintFeedback()` uppdaterar bladtextens utkast och transformpreview separat; textdrag uppdaterar textlagren. `paintDrawingTool` ger snitt- och detaljverktygen egna grafikgrupper per vy som deras befintliga feedback-controller uppdaterar. Geometri, vy/skala, inställningar och bekräftade ändringar använder fortfarande editorns fullständiga redraw. Frånkopplade lager faller tillbaka till redraw.

Slutna polygoner valideras före sparning och efter greppändringar. Hatch använder samma `material-hatch.js`-geometri och pappersmått som sektionshatchning, och samma `ui/hatch-control.js` i inspektor och materialbibliotek. `hatch-control.js` är den domänmedvetna adaptern; UI-fabriken tar alternativ och validering som argument. Linjeutseende, geometri och ritordning använder `createEditorSection`.

Transformation av en modellkopplad måttpunkt eller leader gör fästpunkten fristående; inspektorn beskriver detta före bekräftelse. En ångring återställer referenserna. Kopierade måttkedjor får nya länkidentiteter så att original och kopia inte påverkar varandra.

`drawing-marquee.js` äger rektangelmarkeringens pointergest och återanvänder ritningens urval. Renderade konturer projiceras till skärmkoordinater och prövas av den DOM-fria `drawing-selection-geometry.js`. En vänster–höger-ruta kräver full inneslutning; höger–vänster väljer även korsade konturer. Shift lägger till, Esc avbryter utan modellmutation. Verktyget ligger i befintliga Markera-menyn. Ritningskommandona använder samma Ctrl/⌘ M, C och R som modellen och lämnar tangenttryckningar i textfält till textredigeringen.

`polarTrackingIntersection` i `cad-tracking.js` prövar skärningen mellan polarstrålen från baspunkten och en förvärvad Otrack-axel inom pekarens snaptolerans. Parallella guider och avlägsna skärningar ger ingen ny snap; exakta objektträffar har fortsatt företräde.

## IFC-underlag i GA

`drawing-ifc-references.js` äger GA-vyns referensval och projektionscache. Appens ritningscontroller får importerade referensmodeller via en uttrycklig callback; import, placering och modellens synlighet ägs fortsatt av referenscontrollern. `settings.ifcReferences` sparar synlighet, skymda kanter och snap per referens-ID och vy. IFC-data kopieras inte in i varje ritning. Objektfiltret är en informationsrad tills filterreglerna har bestämts.

`references/drawing-reference-geometry.js` kopierar de importerade delarnas geometri med deras världstransform och GA-vyns vanliga snittkoordinater. Höjd och vyområde gallrar delar före projektion. Den DOM-fria `drawing-occlusion-index.js` bygger en hierarki över projicerade ytors gränser och största djup. Varje yta förekommer en gång; kanter söker bara överlappande grenar som kan täcka dem, utan en ny kandidat-Set per kant. Exakt klippning och täckningsintervall beräknas fortsatt i `projectedDrawing`. Indexet är lokalt för beräkningen, ändrar inte geometrin och behålls inte i projektionscachen.

Egna objekt och referenser går tillsammans genom `projectedDrawing`, vilket ger gemensam täckning och samma vektorlinjer på skärm och i PDF. Referensens flagga för skymda kanter har företräde framför ritningens generella flagga. Referensobjekt blir inte egna modellobjekt och deltar inte i part mark-markering.

Synliga referenslinjer indexeras i vykoordinater. Indexet matar befintlig punktplacering och `snapFrame`; det är ingen separat snapmotor. Referensmått är i den här versionen fristående och följer inte automatiskt ändringar i IFC-filen. `drawing-projection.worker.js` använder den DOM-fria transportadaptern `drawing-projection-data.js` och samma projektionsfunktion som övriga ritningar. Geometrikopior överförs; importerad geometri behåller sina buffertar. PDF-export väntar på färdiga vyer. Cachen behåller senaste resultatet per vy, återanvänder oförändrade vyer och frigörs tillsammans med worker när editorn stängs. Stora IFC-filer behöver fortfarande mätas innan prestandagarantier ges.

Vid stängning av GA sparas vyinställningarna innan `GAViews.reset()` tar bort vybilderna och ramgrafiken töms. Annoterings-, text- och snitt-/detaljcontrollererna släpper sina grafikreferenser, så att frånkopplade SVG-träd inte behålls via feedbacklagren. IFC-controllern avslutar worker, löser väntande jobb och tömmer projektionscache. Importerade referenser behåller modellcontrollerns livscykel.

`drawing-projection-result.js` packar IFC-vyresultat för workertransport och cache i Float64-buffertar utan koordinatavrundning. Buffertarna överförs med ägarbyte från worker; den importerade modellens buffertar överförs aldrig. Controllercachen sparar packade resultat per vy och håller högst ett uppackat resultat för aktiv visning, snap och export. Borttagna vyer och väntande jobb rensas; vid stängning töms också aktivt resultat och `PlanView.modelFaces`. Ritningskopior av IFC-geometri innehåller endast positioner och index, eftersom de använder MeshBasicMaterial och vektorprojektion.

## Isolering som ritobjekt

Isolering lagras som `type: shape`, `shape: insulation` med två baspunkter, `insulationType` (soft/hard), `thickness` i vykoordinaternas millimeter och `side` (left/right från start till slut). `drawing-insulation.js` beräknar normal, ytterkontur och mönster utan DOM. Samma kontur/mönster projiceras för skärm, preview och vektor-PDF; vyändringar skalar hela objektet. Högst 2 048 mönsterrepetitioner begränsar mycket långa/tunna band.

Rita-menyn, punktplacering, exakt längd, urval, rektangelmarkering, transformverktyg och anteckningshistorik återanvänds. Snap använder fyra ytterhörn och fyra ytterkanter, inte mönstrets repetitioner. Två ändpunktsgrepp ändrar baslinjen; det tredje greppet ändrar vinkelrät tjocklek och kan byta sida genom att passera baslinjen. Ett separat flyttgrepp undviks eftersom det skulle överlappa tjockleksgreppet på tunna band; det befintliga Flytta-kommandot används. `drawing-insulation-inspector.js` använder `createEditorSection` för typ, tjocklek och sida och delar utseende/ritordning med övriga ritobjekt.

## Gemensamma ritningsgrepp

`ui/grip.js`/`grip.css` äger SVG- och HTML-presentation: fyrkant för punkt/hörn/beskärning, fylld diamant för flytt och cirkel för radie/tjocklek/textbredd. Markören är 8 skärmpixlar med 18 pixels träffyta; `updateScreenGrips` använder SVG:s aktuella skärmtransform efter zoom. Hover är orange och aktivt grepp får mörk ram. Träffar i överlappande ytor väljer närmaste greppcentrum. Flyttgrepp utelämnas nära andra grepp; vygrepp visas inte samtidigt som ett ritobjekt redigeras.

`drawing-grip-interaction.js` äger den gemensamma pointerlivscykeln: drag eller klick–placera, numerisk parameter via befintligt måttfält, preview, bekräftelse och avbrott. Alla adaptrar lämnar locate/apply/preview/commit/cancel. `drawing-object-grip-editor.js` validerar former och modellkopplade måttpunkter med befintlig snap; textcontrollern äger textgeometrin. `drawing-view-grip-editor.js` använder papperskoordinater och befintlig beskärning med oförändrad skala. GA- och Single Part-controllererna lämnar sina vyer och redraw/synkronisering, utan att UI-komponenten äger projektdata.

Anteckningshistoriken kan också innehålla en uttrycklig lokal operation med före/efter och återställningscallback, så att ett avslutat vygrepp får ett ångrasteg i samma ordning som ritobjektsändringar. Dessa callbacks sparas inte i projektet och historiken töms vid öppning av ritning. Esc, pointercancel, fönsterblur och stängning återställer pågående preview utan checkpoint; återställning sker före sparning/frigöring vid stängning. PDF-export tar bort `.cad-grip` och övriga hjälplager.

## Aktuellt projektformat under utveckling

Appen har inget löfte om bakåtkompatibilitet under utvecklingen. Projektimport kräver den aktuella strukturen för stomlinjer, referenser, rapporter, assemblies och assemblynumrering. Exempelprojekten använder samma struktur. `createProject` skapar stomlinjeobjekten; `syncGridObjects` bygger enbart den härledda stomlinjecachen från objekten och konverterar inte gamla koordinatlistor.

Single Part och Assembly utan ritningsmall får kompletta standardvyer genom `createPartViews` vid första öppningen. Sparade vyer återanvänds och borttagna vyer återskapas inte. Äldre fasta sektionsvyer, orienteringar och skal-/synlighetskartor konverteras inte. Den gamla parallella greppdragningen i annoteringscontrollern är borttagen; de gemensamma greppadaptrarna äger punkt- och formredigering. Dimensionens linjedrag och måttpunkternas kontextmeny är fortfarande aktiva funktioner.

Weland-mappträdet finns direkt i den medföljande item-katalogen. Kataloginstallation och initiering av nya projekt/bibliotek behövs fortfarande; de ska inte behandlas som övergiven kompatibilitetskod.

`blocks/point-bindings.js` äger identiteter för medlems-/ankarpunkter, sammanfattning av blandade låsningar, atomiska gruppförslag och koordinatbevarande frigöring av en axel. Definitionssessionen validerar gruppens vanliga Sweep/Plate/ritgeometri före ett ångringssteg. `binding-inspector.js` visar urval och rapporterar avsikter; `binding-guides-renderer.js` visar verkliga offsets utan modelländringar. `editor-fields.js` delar fält mellan inspektor, bibliotek och gruppkoppling utan cirkulära imports. Controller och renderer släpper urval, DOM-callbacks, markörtexturer och observatörer vid stängning.

## Polysweep och hörnradier i modellen

`model/geometry/corner-path.js` beräknar tangentbågar för öppna 3D-kedjor och slutna platekonturer. Kontrollpunkterna behåller sina koordinater; `radii` hör till respektive punkt. Intilliggande radier måste rymmas på segmentet. Polysweep-ändpunkter har ingen hörnradie. `model/polysweep.js` äger profiltransport, sammanhängande mesh, validering och banlängd; objekttypen registrerar geometri, ankare, snapsegment, transform och numreringsform. Plate använder samma bågberäkning för kontur, extrusion och mängder. Ingen projektmigrering tillkommer.

`model/ui/polysweep-controller.js` är en adapter till modellens befintliga punktplacering, preview, längdfält och snap. `model/ui/insertion-point-controller.js` äger punkturval och radieutkast; den DOM-fria `model/insertion-point-edit.js` tar fram och validerar hela ändringsbatchen. `inspector/insertion-point-inspector.js` visar fälten och rapporterar avsikter. Endast `model-editor` uppdaterar projektet och skapar ångringssteget. Modellens ordinarie grepp, transformverktyg, material/profilbibliotek och ritgeometri återanvänds.

## Tillfälliga mått i modell och ritning

`geometry/measurements.js` beskriver längder, yttermått och hörnradier i källans millimeter utan DOM. Modellens objekttypsregister äger relevanta mått: Sweep/hjälplinje/stomlinje lämnar ändpunktslängd, Polysweep och Plate lämnar tangentsträckor och hörnradier, övriga fysiska typer använder hörnens yttermått. `model/measurements.js` läser urval, synlighet, inspektorutkast och befintliga Move/Copy-resultat; ett fullständigt assemblyurval får gemensamma yttermått. `drawing-measurements.js` lämnar mått för ritformer och befintlig Move/Copy i vy-/papperskoordinater. Verktygens lösta målpunkt används också för exakt angivet avstånd.

`ui/measurement-layout.js` håller avstånd till objektet, tickstorlek och text i skärmpixlar. `ui/measurement-overlay.js` målar samma tunna SVG-mått med läsbar textriktning och gallring av överlappande etiketter. Modellens adapter projicerar 3D-koordinater efter kamerans uppdatering; ritningens adapter använder befintlig vyprojektion. Single Part/Assembly uppdaterar enbart måttlagret vid zoom. Det tillkommer ingen snapmotor, inspektorkontroll, projektmutation eller historik. Lagret är noninteraktivt och märkt `data-annotation-helper`, så den befintliga PDF-rensningen tar bort det. Måttdata sparas aldrig i projektet.

## Linjära verktygs-HUD:ar

`ui/tool-hud.js` och `tool-hud.css` äger den gemensamma stapeln, aktivering, kompakt presentation och rörelse. Adaptern `model/ui/linear-transform-controller.js` äger separata tillfälliga utkast för Flytta/Kopiera linjärt och kopplar dem till befintlig punktplacering. `model/tools/linear-transform.js` tolkar förflyttningsvektorn utan DOM. En aktiv rad använder samma transformkandidater, snap, modellpreview och modell-editorcommit som vanlig flytt/kopiering. Picker uppdaterar utkastet; den bekräftar aldrig modellen. Verktygsbyte, Esc och projektåterställning avaktiverar preview utan att spara utkasten till projektet. Varje ny aktivering hämtar aktuell markering, inte lagrade objektkopior från tidigare operationer.

Plåthörns flytt genom det vanliga gripflödet använder `gripWorkPlane` i `model/grips.js`. Berörda parallella plåtplan ger ett förflyttningsplan genom baspunkten; gripoperationen lämnar detta till `drawingWorkPlane` och befintlig `resolveSnap`. Plåtvalideringen gäller fortfarande före commit. Det är samma punktplacering och snapmotor som för övriga verktyg. Pluskontrollernas överlappningsskydd hör enbart till skärmprojektionen i `InsertionPoints`, inte till modellgeometrin eller ankarnas identitet.

## Kopplingarnas gemensamma editorflöde

`components/definitions.js` registrerar geometri, parametrar och placeringsregler för varje koppling. `parameter-fields.js` beskriver återanvändbara plåtmått och skruvmönster. `placement-rules.js` äger referenskraven, ändvalet och typens punktsteg; `placement-session.js` äger det fristående placeringsutkastet och identiteten. De saknar DOM, storage, app-kopplingar och projektmutationer. Även Fit lämnar referensvalet som ett utkast som valideras och förhandsvisas innan explicit bekräftelse. Ogiltiga referensval ändrar inte placeringssessionen. `parameter-edit.js` hanterar beroenden som skruvsnapshot, håldiameter och tillbehör utifrån biblioteksdata.

`components/inspector.js` bygger fält, referensknappar och sektionspresentation med befintliga `createAttributeRow`, `createAttributeSection` och attributlayout. Den tar data och callbacks; den äger inte utkast eller modelländringar. `components/ui.js` samordnar kommandon, aktuellt utkast, validering, återställning och egenskapskopiering. Modelladaptern i `app/model-components.js` behåller preview och modell-editorcommit, inklusive beroende plåtar, skruvar och hål. Placeringsflaggor sparas inte på modellobjekten. ESLint skyddar de DOM-fria placerings-/parametermodulerna och inspektorns beroendegräns.


Planflytt och plankopiering delar `ui/tool-hud.js` och samma stapel som de linjära kommandona. `model/tools/plane-transform.js` beräknar en rigid transformation mellan två trepunktsramar genom objekttypernas befintliga rotation och translation, inklusive blockmetadata. `model/ui/plane-transform-controller.js` äger endast sexpunktsutkast, omval, avbrott och bekräftelse. Punktval går genom vanlig modellinput/resolveSnap; guider återanvänder WorkPlaneGuide. Placement-controllern visar samma modellpreview och bekräftar via modell-editorn med en checkpoint. Referensmodeller ingår inte i detta modellobjektkommando.


Arbetsområdet är en sparad visningsinställning i `project.workArea`, inte ett modellobjekt. `model/work-area.js` äger XY-rektangel, absoluta Z-gränser, validering, expansionsunion och tillfällig geometri-klippning för markering. `model/work-area-display.js` äger boxkontur och rendererklippning; instanskanternas gemensamma shader stöder samma klippplan. `model/ui/work-area-controller.js` äger tvåpunktsutkast och den befintliga HUD-stapeln. `app/workspace-work-area.js` äger checkpoint/ändring av inställningen och köar expansionsbeslut efter referensoperationer. Inga objektgeometrier ändras och ingen separat snapmotor införs.

Synlighet gallrar helt utanförliggande modellobjekt och referensdelar. Modellens raycast, rektangelmarkering, resolveSnap, referenskanter och HTML-grepp använder samma box. Urval behåller hela block, skruvgrupper och assemblies när en synlig medlem väljs; utanförliggande medlemmar blir inte synliga grepp. Referensens fulla utbredning för expansion läses oberoende av arbetsområdets gallring och respekterar CAD-lager. Återställning uppdaterar klippningen utan att öppna expansionsfrågor.

Arbetsplanets regler ligger i `work-plane.js`; dess tillfälliga modellgrafik ligger i `model/work-plane-guide.js`. Den gemensamma guiden används även för planöverföring och uppdateras av modellens renderloop. Kameraskalningen påverkar enbart indikatorn, aldrig arbetsplanets koordinater eller snap.

Modellinspektorns skapa/redigera-läge avgörs i `inspector/object-context.js`. En enda instans av namn- och numreringskontrollerna ägs av `model-identity-controller.js`; materialadaptern använder samma lägesbeslut. Förval för nya objekts attribut finns i UI-utkastet, inte i projektet. `model/object-draft.js` gör den DOM-fria valideringen/kopieringen före respektive befintlig modell-editorcommit. Se `docs/inspector.md` för fältens gemensamma ägarskap.

## Projektkoordinater och baspunkter

`coordinates/coordinates.js` äger validerade projektdata och den gemensamma omvandlingen mellan modellens millimeter och kartans meter. Projektet har flera namngivna baspunkter, en valfri aktiv punkt samt gemensamt plan-/höjdsystem. Varje baspunkt kopplar en lokal XYZ-punkt till E/N/H och en moturs rotation från kartans östaxel till modellens X-axel. Byte eller redigering ändrar georefereringen, aldrig modellobjektens koordinater. Samma framåt-/inversfunktioner används av referenser och IFC-export.

`ui/coordinate-settings.js` bygger fältrader och koordinatgrupper i Settings befintliga dialogpresentation. `app/coordinate-settings-controller.js` äger ett fristående utkast för samtliga baspunkter, inte projektmutationer. Settings validerar allt före sin gemensamma checkpoint. Koordinater följer projektfil, återställning och Ångra/Gör om. `model/ui/coordinate-pick-controller.js` återanvänder modellens punktresolver, snapmarkör och pointer-/tangentbordsrouting; punktval återgår till samma Settings-utkast utan historikpost.

`coordinates/ifc-georeferencing.js` läser en uttrycklig IFC4-kartomvandling och dess längdenheter. `coordinates/reference-frame.js` kombinerar filens georeferering med projektets aktiva baspunkt. Referensens transform är manuell lokal placering × kartomvandling till projektet × filens enhetsfaktor. Rotation/skalning beräknas analytiskt, utan differenser mellan stora kartkoordinater. Referenser kan uttryckligen använda verkliga eller lokala modellkoordinater; lokalt läge går förbi både filens och projektets kartomvandling. Källgeometrin ändras inte. Utbredning, klippning, befintlig snap, IFC-konvertering och GA får samma världsmatriser. Filbyte behåller koordinatläge och manuell placering men läser den nya filens georeferering på nytt.

Filer utan uttrycklig kartomvandling använder sina ordinarie koordinater (mm efter enhetsomvandling). Verkligt koordinatläge är importförvalet; använd lokalt läge för filer som redan ligger i modellens lokala system. Kända motstridiga CRS/höjdsystem avvisas före ändring; ingen omprojektering mellan olika kart-/höjdsystem görs. Flera IFC-geometrikontexters kartomvandlingar, MapConversionScaled och RigidOperation avvisas uttryckligen. Första versionen har högst 100 baspunkter och rotation inom ±360°.

## IFC4-export

`ifc/export-plan.js` väljer egna fysiska modellobjekt och assemblies samt kontrollerar klassning, material, numreringsstatus och slutgeometri. `ifc/geometry.js` använder befintliga profil-/plåtregler för oskurna extrusioner och `objectGeometry(..., 'exact')` för utvärderade kapningar, kopplingar och kopplade borrhål. Helfilsexport påverkas inte av arbetsområdets klippning. Synliga/markerade objekt är uttryckliga urval; bara deras geometri exporteras, men samtliga modelloperationer behålls vid geometriberäkningen. Utelämnade skruvar tar därför inte bort hål. Block och kopplingar exporteras genom sina verkliga delar, utan dubbla fysiska behållarobjekt.

`ifc/representation.js` skriver IFC4-profiler/extrusioner eller triangulerade ytnät. Oskurna Items delar en representation map per oföränderlig biblioteksdefinition, medan placering, GlobalId, material och färg hör till varje förekomst. Triangeldata får lokalt origo; koordinater svetsas och CSG-resttrianglar rensas med 0,0001 mm tolerans innan topologin kontrolleras; osäker täthet ger en uttrycklig anmärkning och Closed lämnas okänt. `ifc/properties.js` skriver material, modellens arbets-RGB, part-/assemblyserier, aktuella märken, huvuddel och källidentiteter. Felaktig/inaktuell numrering får inte presenteras som aktuell. Exporten ändrar aldrig numreringen.

`ifc/writer.js` äger IFC-projekt/område/byggnad, delarnas placering och assemblyrelationer. Delarna har egna GlobalId:n även när part mark är samma. `ifc/identity.js` härleder 128-bitars IFC-identiteter från sparat projekt-ID, entitetens roll och stabilt objekt-/assembly-ID; namn, mark, geometri och exportordning påverkar inte identiteten. Projekt-ID skapas i `createProject` och följer projektfil, återställning och historik. `ifc/step.js` är den avgränsade STEP-kodaren med numeriska värden och escapad Unicode/text. Exporten deklarerar IFC4, utan löfte om certifierad MVD.

Verklig placering skrivs med `IfcMapConversion`/`IfcProjectedCRS`. Omvandlingen för lokala 0/0/0 kommer från samma `coordinates/localToMap` och aktiva baspunkt som referenserna använder, med modellmillimeter och kartmeter. Lokal export utelämnar kartomvandlingen. Ingen omprojektering eller flytt av modellobjekt görs. Importerade referenser, hjälpgrafik och ritningsobjekt ingår inte. Rumslig struktur omfattar i första versionen projekt, område och byggnad; exporten uppfinner ingen nivåkoppling för delar som saknar sådan i modellen.

`ui/ifc-export-dialog.js` använder befintliga dialogfält, kategoriknappar, disclosure och knapprad, och äger rapportens presentation. `app/ifc-export-controller.js` äger jobb, ögonblicksbild, val och nedladdnings-URL. Arkiv-kommandot kopplas av projektfilcontrollern. `ifc/export.worker.js` gör kontroll och filskrivning utan DOM, lagring eller modellmutation. Färdiga bytes överförs en gång; avbrott/stängning avslutar workern och frigör bytes/URL. Kontrollens rapport kan begränsa detaljlistan till de första 100 namnen, med tydlig totalräkning. Exportfel blockerar hela filen; objekt hoppas inte över tyst.

Objekttypens definition äger IFC-förvalet. Inspektorns gemensamma IFC-klassfält använder samma skapa/redigera-controller och modell-editortransaktion som namn och numreringsserie. `ifc/classes.js` validerar den begränsade IFC4-klasslistan utan DOM. Fältet ändrar varken form eller tillverkningsnumrering.

## Referensmarkering och profilval vid konvertering

`ReferenceModels` äger ett tillfälligt markeringsläge (`reference`/`object`) och skiljer referenspanelens öppna modell från faktisk helreferensmarkering. Samma raycast väljer modell eller IFC-objekt; DXF/DWG förblir hela referenser. `selection-highlight.js` återställer IFC-materialens emissive och CAD-materialens färg när urvalet byts. Objektmarkering ger inte rätt att flytta hela referensen. Den vanliga modellkontextmenyn anropar samma konverteringskommando som referenspanelen; UI-dialogen laddas vid första användning.

`references/profile-match.js` jämför kontur, hål, area, rotation och dimensioner mot senaste biblioteksrevisionerna. Namn eller omslutande mått räcker inte för ett automatiskt profilbyte. Utan säker match behålls den återvunna IFC-konturen. `conversionProfile` validerar ett manuellt profilval på ett fristående utkast och behåller start-/slutpunkt, rotation och källidentitet. Först Konvertera anropar befintlig modell-editorcommit. Avbrott lämnar modellen orörd.

Konverteringen använder `profileLibraryNodes` från samma profilträd som fulla biblioteket, `createLibraryTreePicker`, gemensam dialogpresentation och `renderProfilePreview`. Profilbibliotekets befintliga editorinstans kan öppnas med en avgränsad urvalscallback; nästa vanliga biblioteksöppning återgår till modellens ordinarie användningskommando. Raka, slutna extrusioner stöds fortfarande; profilväljaren kringgår inte geometrivalideringen.

Profilförslagen har ett fristående evidenskontrakt beskrivet i `docs/profile-matching.md`. IFC-adaptern `references/ifc-profile-data.js` äger läsning av profilmått, typnamn, utvalda egenskaper, mm-enheter och mappade/kapade representationer. Importworkern transporterar detta som metadata på referensobjekten. `profile-match.js` äger bedömning och rangordning; namn och konturgeometri är interna rena hjälpmoduler. UI visar säkerhetsnivå och anmärkningar men gör ingen egen matchning. Metadata kan identifiera profilen även när konverteringens geometrivalidering avvisar objektet. Troliga/tvetydiga förslag ändrar inte automatiskt utkastets profil.
