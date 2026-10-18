# Kodens ansvar och gränser

## Skruvplaceringens återkoppling

`fasteners/placement-feedback.js` sammanfattar det redan upplösta skruvförslaget: nådda delar, lagerintervall och längdvarningar. Modulen söker inte material eller ändrar objekt. `placement-inspector.js` visar sammanfattningen och den kompakta dellistan; `assembly-preview-inspector.js` visar första skruvens verkliga lager och tillbehörslägen i den befintliga förbandsväljaren. Övriga skruvars varierande träffar visas som intervall i gruppens återkoppling.

`FastenerUI` behåller fältutkastet när delar väljs om. En sparad grupp uppdateras först med Tillämpa genom befintlig modell-editor; delvalets bekräftelse skapar ingen historik. App-adaptern `app/model-fasteners.js` behåller pågående placeringsplan och första punkt vid tillfälligt delval. Placeringen använder tre vanliga modellpunkter: origo, X-riktning och Y-sida. Först tredje punkten bekräftar gruppen. `placement-frame.js` ortogonaliserar planet och avvisar sammanfallande/kollineära punkter; punktavstånden ändrar inte mönstrets delningar eller skruvlängden. Både preview och bekräftelse använder `preparePickedFasteners` och de befintliga placeringsreglerna.

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

`drawing-selection.js` härleder urvalets befintliga ritningar och numreringsbehov via de vanliga tillverkningstyperna och assemblyreglerna, utan mutation. `app/selection-drawings.js` äger fortsättningen efter numreringsdialogen: sparat urval återställs och aktuella ritningskopplingar läses om efter tilldelning/splittring. `drawing-controller.js` kopplar flödet till befintlig ritningshanterare, skapandelista och editorer. Menyn beskriver enbart kommandona. Numreringen ändrar hela modellen i sin uttryckliga transaktion; inga nummer tilldelas automatiskt av menyn.

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

Linjär förflyttning beräknas i en kopia av det aktiva arbetsplanets bas, annars globala axlar. `linear-transform.js` projicerar punktmätning till lokala komponenter och omvandlar aktiva komponenter tillbaka till modellens koordinater. Fälten återanvänder den begränsade aritmetikgrammatiken i `section-expression.js`, aldrig JavaScript-evaluering. Antal kopior är ett heltal 1–1000. Picker startar vid öppning; samma maskerade vektor används för rörlig preview och bekräftelse. Manuell inmatning avslutar punktvalet.

Placement-adaptern bygger kopieringsseriens kandidater från samma original vid Δ, 2Δ, … NΔ och låter modell-editorns `prepareCopySeries` skapa unika objekt-/grupp-/block-/borridentiteter med befintliga kopieringsregler. Hela serien valideras före en enda `replace` och checkpoint. Preview visar samma serie via befintlig modellpreview. Flytta ändrar bara markerade insättningspunkter när sådana finns; Kopiera använder hela objekten. Linjär kopiering behåller originalurvalet, medan vanlig Copy behåller sitt tidigare beteende. Efter bekräftelse hämtar HUD:en aktuell källgeometri på nytt och behåller sina värden för nästa utförande; upprepad Enter vid nedhållen tangent konsumeras. Esc avaktiverar preview, × tar bort bara sin HUD-rad.

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

Konverteringen använder `profileLibraryNodes` från samma profilträd som fulla biblioteket, `createLibraryTreePicker`, gemensam dialogpresentation och `renderProfilePreview`. Profilbibliotekets befintliga editorinstans kan öppnas med en avgränsad urvalscallback; nästa vanliga biblioteksöppning återgår till modellens ordinarie användningskommando. Raka, slutna extrusioner och två plana ändkapningar stöds; profilväljaren kringgår inte geometrivalideringen.

Profilförslagen har ett fristående evidenskontrakt beskrivet i `docs/profile-matching.md`. IFC-adaptern `references/ifc-profile-data.js` äger läsning av profilmått, typnamn, utvalda egenskaper, mm-enheter och mappade/kapade representationer. Importworkern transporterar detta som metadata på referensobjekten. `profile-match.js` äger bedömning och rangordning; namn och konturgeometri är interna rena hjälpmoduler. UI visar säkerhetsnivå och anmärkningar men gör ingen egen matchning. Metadata kan identifiera profilen även när konverteringens geometrivalidering avvisar objektet. Troliga/tvetydiga förslag ändrar inte automatiskt utkastets profil.

## IFC-geometrikonvertering

Geometrins läsning/topologi, extrusionsanalys, ändplansanalys, objektadapter och slutkontroll ligger i `references/conversion-{mesh,geometry,caps,object,verification}.js`. Dessa är DOM-fria och oberoende av IFC-metadata, bibliotek och profilmatchning. `conversion.js` samordnar dem med den separata matchningen och returnerar fristående `{ object, cuts }`. Sneda ändar använder vanliga Linecut med målidentiteter till en vanlig Sweep; båda bekräftas i samma modell-editortransaktion. `model/tools/transform-sources.js` utökar befintligt urval med skärningar vars samtliga måldelar flyttas/kopieras/roteras, och kopieringsadaptern kopplar skärningarna till nya mål-ID:n. Ingen ny objekttyp, editor eller snapmotor tillkommer. Se `docs/ifc-conversion.md` för kontrakt och geometriska gränser.

## Gemensamt greppurval och punktförflyttning

`model/grip-selection.js` äger giltiga punktreferenser, urval/toggling och rutans rena skärmpunktsprövning. `model/grips.js` grupperar endast sammanfallande världspunkter utan gräns på antal markerade objekt och beräknar en gemensam förflyttning för blandade punkttyper. Alla valda ankare på en del innebär vanlig translation; helt flyttade delar tar med befintliga skärningar. Partiella plåthörn stannar i plåtens plan; radier, blockbindningar och objekttypernas validering gäller fortfarande.

`insertion-points.js` målar och exponerar samma projicerade, synliga grepp till den befintliga markeringsrutans controller. Alt/Option väljer grepp i stället för objekt; Shift utökar urvalet. `insertion-point-controller.js` äger det tillfälliga greppurvalet och återanvänder punktinspektorn. Radiefältet är avstängt om urvalet innehåller punkter utan redigerbar radie.

`model/ui/grip-interaction-controller.js` äger pointer capture och livscykel för greppdragning (4 px tröskel, släpp, Esc, pointercancel, captureförlust och fönsterblur). Den anropar befintlig placering, snap, förhandsvisning och commit; inga geometriregler eller projektmutationer ligger där. En enkel klickning väljer punkt, utan dolt dubbelklickskrav. Alt-rutan ligger i `selection-controller.js`, samma ruta och dokumentlyssnare som objektmarkeringen.

`placement-controller.js` kopplar Move till greppurval när det finns och annars till hela objekt. Flytta linjärt använder samma operation och gemensamma HUD, med bibehållet greppurval och samma förflyttningsvektor. `setDrawing(..., { keepPoints: true })` bevarar endast det tillfälliga punkturvalet genom dessa operationer; byte av objekturval, andra verktyg och historikåterställning rensar som tidigare. Förhandsvisning ändrar inte projektet; en giltig bekräftelse går genom modell-editorn i en transaktion. Punktgreppen under preview använder samma utkast som modellens förhandsvisning. Inga nya permanenta kontroller eller snapinställningar tillkommer.

## Manuellt byte av tillverkningsmark

`numbering/mark-change.js` planerar ett byte för hela den numrerade typen och kontrollerar giltighet, kollisioner och projektstämpel utan DOM eller mutationer. `numbering/assembly-identity.js` för över markändringar till assemblynycklar och medlemstokens; geometrin, assemblynumret och ritningsinnehållet behålls. Samma överföring används när vanlig numrering ändrar en parts mark utan att typen ändras. Manuella registerposter reserveras även vid återanvändning och full omnumrering; en annan typ får inte ärva reservationen.

`ui/mark-change-dialog.js` använder gemensamma attributrader, dialogpresentation och knapprad för båda typerna. `app/workspace-mark-change.js` äger projekttransaktionen med en checkpoint för register, tilldelningar, assemblies och ritningar. Inspektorerna rapporterar typ och identitet via callbacks. Ingen modellgeometri ändras och `main.js` har inga nya beteenden.

## Bevara tillverkningsmark vid ändring

`numbering/type-marks.js` löser gemensamt ägarskap för part- och assemblymärken före tilldelning. Befintlig matchande typ (inklusive historisk jämförelse enligt inställningarna) har företräde. Därefter kan en ändrad typ ärva en tidigare mark från sina kvarvarande objekt-/assemblyidentiteter inom samma serie. Om en oförändrad typ finns kvar behåller den märket. Om alla förekomster delas i nya typer prioriteras största gren, med stabila medlems-ID:n som skiljeregel. Fria omfördelningsvägar mellan samtidiga delningar/sammanslagningar bevarar fler märken utan att ta något från en matchande typ. Nya objekt utan tidigare tilldelning får inte ärva en borttagen ägares mark genom denna regel.

Manuella märken följer samma ägarskap vid ändring. Explicit nya nummer för ändrade detaljer, ändrad serie och full omnumrering behåller sina avsiktliga regler. Registerpostens geometrinyckel uppdateras när märket överförs; två olika typer får aldrig äga samma mark. Ritningsplanerna prioriterar originalritningen för den gren som behåller märket, kopierar endast vid verklig delning och kräver ett uttryckligt val vid ritningssammanslagning. Ändrad typ flaggar ritningen för kontroll även när dess nummer behålls. Projekttransaktionen, förhandsgranskningsstämpeln och historiken är oförändrade.

## Stabilitetsgranskning av numrering

`numbering/type-groups.js` äger stabil gruppering före märktilldelningen. Befintliga giltiga förekomster behandlas först, därefter stabila objekt-ID:n. Gruppen jämförs mot sin sparade representant; `type-marks.js` får endast återanvända en registerpost som alla gruppmedlemmar klarar. Därmed kan en toleranskedja eller omordnad objektlista inte flytta den faktiska representanten utanför en medlems tolerans.

`numbering/validation.js` validerar registerägarskap, tilldelningar och sparade jämförelseregler före numreringsplan, efter tillämpning och vid projektåterläsning. Markbyte använder samma commitkontroll. `assembly-identity.js` sammanför kolliderande historiska nycklar efter ett markbyte med företräde för den aktiva ägaren. Ritningsplanerna reserverar kvarvarande ritningsnummer och de andra numreringsområdena innan nya nummer tilldelas. Saknad källa innebär inte att ritningens nummer är ledigt.

`projectNumberingSettings` i `numbering/plan.js` väljer projektets sparade regler före datorns förval. Dialogen fyller samma befintliga fält vid öppning. Full omnumrering är ett uttryckligt engångsval och återaktiveras inte av en sparad inställning. UI, numreringsregler och projekttransaktioner förblir separata.

### Nearest och vinkelrät snap

`src/snap-geometry.js` äger ändliga segmentprojektioner utan UI. Modellens
`model/snap-projection.js` väljer närmaste skärmpunkt på den verkliga 3D-kanten,
med perspektivkorrekt interpolation. `resolveSnap` och referensernas befintliga
kantindex använder samma projektion; `SnapIndex` gallrar fortsatt bort avlägsna
segment. Exakta punkter och vinkelräta fotpunkter prioriteras framför Nearest.
Arbetsplan, axellås och arbetsområde prövas även för dessa kandidater.

Ritningens befintliga punktplacering använder `snapFrame` för raka kanter och
`drawing-snap-curves.js` för analytiska cirklar/bågar. Samma flöde används vid
skapande, transform och greppredigering. SP/AS levererar de renderade synliga
kantintervallen samt aktiverade dolda kanter. Ingen snap sker mot hatchmönster.
Modellens projektinställning `snap.nearest` och ritningens befintliga CAD-val
`nearest` styr respektive arbetsyta. Den gemensamma presentationsmodulen visar
Närmaste med befintlig kantsymbol och Vinkelrät med rätvinkelsymbol, utan etikett
vid markören.

### Gallring av referensobjekt före kantsnap

`references/snap-part-index.js` äger ett oföränderligt hierarkiskt index över
importerade delars kantgränser i referensens lokala koordinater.
`ReferenceModels.syncParts` bygger det en gång för en ny/ersatt objektlista.
`candidates` frågar indexet med en smal, 16 pixels sökfrustum och skickar endast
lokala kandidater vidare till befintligt kantindex och `resolveSnap`.
Pekarrörelser bygger inte om indexet och går inte igenom alla referensdelar.

Referensens aktuella gruppmatris används vid varje fråga: flytt, rotation,
enhetsskala och baspunktsbyte kräver ingen ombyggnad. Synlighet/lager och
arbetsområdets klippning fortsätter att prövas i befintliga flöden. Ursprunglig
objektordning bevaras för lika snapavstånd. Indexet tillhör referensmodellen och
följer dess livscykel vid borttagning/ersättning; det lagras inte i projektfilen.

### Radie vid blandat greppurval

`model/insertion-point-edit.js` äger `radiusPointRefs`: endast Plate-hörn och
Polysweeps inre hörn har hörnradie. Punktinspektorn och dess modellbatch använder
samma urval. Markerade ändpunkter/andra grepp hindrar inte längre redigering av
radier på de markerade hörnen; de deltar fortsatt i greppflytt men ändras inte
av radiekommandot. Utan ett redigerbart hörn är radiefältet inaktiverat.
Hela radiebatchen valideras före en gemensam modell-editortransaktion.

Profilens insättningsval återställs till modellens sparade värde när ett klick
avvisas av valideringen. Polysweep-valideringen anger vilket hörn/radievärde som
är för litet för profilens tvärsnitt och vald insättning. En profiländring får
inte kringgå kontrollen av en kollapsad innerbåge.

## Skruvinspektor och mönster

`fasteners/library-controller.js` äger bibliotekets fönster, produktversioner, import/export och lagring. `fasteners/ui.js` äger placeringsutkast, punktvalets callbacks och inspektorns bekräftelse. Skapa och redigera använder samma `placement-form.js`, `product-picker.js`, `assembly-ui.js`, `group-ui.js` och `hole-settings.js`, byggda med gemensamma attributrader och sektioner. Biblioteksval beskriver tillgängliga produkter; dimensioner, klasser, ytbehandlingar och längder skapas inte av UI:t.

`fasteners/pattern.js` tolkar delningar och fria koordinater samt utvärderar rutnät, cirkel och fria mönster utan DOM. `group-data.js` förankrar dem i gruppens koordinatsystem; `pattern-picture.js` ritar bara illustrationen. Vänd skruvriktning bevarar gruppens positionsplan även för roterade mönster. `hole-edit.js` behåller frigången när skruvdiametern ändras. `placement-draft.js` förbereder samma validerade, fristående förslag för förhandsvisning och bekräftelse, med befintlig materialträff och hålberäkning. Modellen och historiken ändras först i den befintliga modell-editorn. Behållna gruppceller och deras borrhål behåller identiteter; borttagna celler och deras hål tas bort i samma transaktion.

Förbandets skruv kan stängas av separat från brickor och muttrar. Utan skruvdelar finns bara kopplade hål: tom skruvgeometri och ingen fysisk part för numrering/IFC, men de verkliga hålen finns kvar i delarnas geometri och ritningar. Ett förband utan både skruvdelar och hål avvisas.

Automatiska skruvförband får ligga utanför valda delar. `placement.js` behåller då en flyttbar skruv med noll materiallager och inaktiva borrrelationer. Måldelarnas projicerade gränser används enbart för preliminär anliggning; de räknas aldrig som materialträffar. Ordinarie transform-/greppväg räknar om via `update-joints.js` och aktiverar endast hål som faktiskt träffar material.

`fasteners/manual-length.js` bygger fristående produktögonblicksbilder med användarens längd och ger härledd förbandsåterkoppling utan DOM. Helgängad skruv och stång får motsvarande gänglängd; delgängad produkt behåller sin gänguppgift. Bibliotekets poster ändras aldrig. `automaticPlacement` beräknar material, hål och tillbehörslägen men väljer inte skruvlängd. Gängstångens `startAllowance` är exakt avstånd från stångände till första materialyta, inklusive utrymme för mutter/brickor. För kort skaft, för litet utstick och mutter utanför gängan är icke-blockerande varningar för vanliga placerade förband (`placementMode: range`); ogiltiga dimensioner, relationer och överlappande tillbehör avvisas fortfarande. Bibliotekets produktvalidering är strikt; instansvalidering skiljer strukturella fel från förbandsvarningar. Kopplingarnas egna beräknade produktserier ligger kvar i deras domänregler och återanvänder `selectFastenerLength`.

## Gemensam snapprioritering

`snap-priority.js` äger prioritetsnivåer, skärmpixeltoleranser och retention av fortfarande giltiga fasta kandidater. Modellens `resolveSnap`, ritningens `locateDrawingPoint` och ramgeometrins `snapFrame` använder samma väljare; modellerings-/referensindex och ritningsgeometri behåller geometrisökningen. Exakta punkter går före mittpunkt/kvadrant/vinkelrät, därefter härledd Otrack/Polar-skärning, spårning och sist Nearest. Nearest fångar inom 5 px, fasta punkter inom 12 px och spårning inom 8 px. Fasta kandidater får 2 px extra hållmarginal; borttagna eller otillåtna kandidater återanvänds aldrig. Vid sammanfallande skärmträff behåller ett namngivet hålcentrum sin bearbetningsreferens.

Ritningens befintliga `CadTracking` samlar endast exakta punktankare, aldrig Nearest. Polar- och Otrack-förslag jämförs med Nearest efter geometrisökningen i stället för att stoppas av en tidig kantträff. Ortho och uttryckliga modellaxellås begränsar även spårningskandidater. Modellen behåller Polar/axel-/stomlinjespårning; någon ny Otrack-inställning eller snapmotor har inte införts där.

## Kantträff i transparent visning

`model/selection-hit.js` äger visningens gemensamma kant-/ytträff utan DOM eller snapinställningar. Transparenta modell-/IFC-ytor släpper igenom klick och hover; featurekanter har 6 px tolerans. Täta ytor blockerar kanter bakom. Kantval prioriterar skärmavstånd och därefter djup. Modellens ordinarie handtag och markeringsruta behåller sina regler. Modelladaptern använder visade konturer, hålkanter och översiktsproxy med ursprungligt objekt-ID även vid instansrendering. Referenser återanvänder importerade featurekanter och referensens delindex. `edge-index.js` är det gemensamma geometriska sökträdet; snapreglerna ligger kvar i respektive snapmodul. Modellkontrollern samlar båda objektgruppernas träffar så att hover och klick använder samma resultat. Referenshanteraren översätter träffen enligt referens-/objektläge och återställer hoverfärg vid avmarkering, döljning och frigöring. Orbit använder fortsatt synliga ytor genom `surfaceHit`, oberoende av kantmarkeringen.

Modellens `overlay-navigation.js` vidarebefordrar enbart mitten-/högerknappens start från insättningspunkter och kopplingsikoner till canvasens befintliga punktcontroller och OrbitControls. Kamerastyrningen tar sedan pointer capture för fortsatt rörelse/släpp; ingen separat pan- eller orbitberäkning införs. Modifierare och koordinater bevaras, vänsterklick och greppdragning har kvar sina ägare. Stationärt högerklick återgår till hörnets meny när pointer capture annars skulle rikta menyhändelsen till canvas. Kopplingen installeras och frigörs av viewporten och fortsätter fungera när kamerakontrollerna ersätts vid vybyte.

Arbetsplanets tvåpunktsval delar controller, punktflöde, snap och `WorkPlaneGuide` med trepunktsvalet. `work-plane.js` äger den DOM-fria ramberäkningen: första punkten är origo och andra positiv X. Föregående planets Y används som orienteringsreferens och ortogonaliseras mot X; om riktningarna sammanfaller används föregående normal. Detta behåller en ortonormal högerhandsram även i det degenererade fallet. Controllerutkastet tar en fristående kopia av referensramen vid start. Preview och bekräftelse använder samma beräkning; inget sparbart modellobjekt eller historik ändras av det tillfälliga planet. Båda knapparna ligger i befintlig Arbetsplan-grupp via ribbonadaptern.

## Skruvbibliotekets grundsortiment

`fasteners/default-catalog.js` äger medföljande katalogposter och komplettering av saknade identiteter utan att skriva över användarens revisioner. `fasteners/standard-dimensions.js` äger standardmått och ISO 4014:s gänglängdsband. Bibliotekscontrollern äger fortfarande lagringen; befintligt biblioteksträd och produktväljare visar samma poster. Manuell instanslängd bereds i `manual-length.js`; biblioteksversionen ändras inte. Sortiment, måttunderlag och modellmallarnas avgränsning beskrivs i `docs/fastener-catalog.md`.

## Skruvplacering i arbetsplanet

`fasteners/placement-frame.js` äger ett uttryckligt `layout` för manuellt placerade skruvar: origo, mönstrets X/Y-ram, lokala förskjutningar, skruvvinkel runt X, vänd riktning och valfri söklängd. Origo och X-punkt är separata från de inpassade skaftändarna. Samma layout används för enskild skruv och befintliga rutnäts-/cirkel-/fria mönster. Vändning byter axelriktning och behåller mönstrets lägen. Vanliga transform- och referensföljningsvägar transformerar layoutens ram tillsammans med skruven.

`preparePickedFasteners` i `placement-draft.js` använder samma domänberedning som redigering i inspektorn. Punktkontrollern lämnar punkter, arbetsplanssnapshot och modell; den får en komplett förhandsvisning med inpassade skruvar och hål. Det andra punktvalet bekräftar genom befintliga skruvcontroller/model-editor utan en extra kontrollfas. UI-controllern armerar därefter samma inställningar för en ny placering med ny gruppidentitet. En grupp bekräftas fortfarande atomiskt och befintliga cell-/hålidentiteter behålls vid redigering.

Skruvinspektorn använder befintliga fält för produkt, manuell längd, förbandsbild, mönster, hål och placering. `placement-inspector.js` adopterar de befintliga metadata-kontrollerna till en gemensam, stängd Objekt-sektion under skruvinställningarna; händelseägare och ID:n behålls. Vid byte till annat objekt återställs samma DOM-noder till sina ursprungliga platser. Ingen separat snapmotor, modellista eller historik har införts.

`fasteners/material-reach.js` äger tillgänglig materiallängd utifrån skaftlängd, brickor, muttrar och gängstångens utstick före. Luft mellan flänsar räknas med; genomgående hål kräver att hela lagret och valda tillbehör ryms. Blindhål behåller uttryckligt valt djup. `automaticPlacement` använder samma beräkning vid preview, skapande, inspektorsredigering och ompassning efter modelländringar. Ett lager utom räckhåll blir inaktivt utan att vald måldel eller hålidentitet försvinner. Beräknad passningsvarning ersätts vid varje ompassning. Manuellt håldjup kan inte kringgå längdgränsen i automatisk placering. Inga nya UI-fält införs.

## Modellens djupnoggrannhet

`model/camera-depth.js` anpassar kamerans när-/fjärrplan till innehållets bounds utan att ändra inramning, zoom eller orbitcentrum. Modellrenderaren samlar modell-, stomlinje- och referensbounds vid omrendering; bildloopen projicerar endast boxens åtta hörn och inkluderar aktuell preview. Ingen genomgång av referensdelar görs per kamerabild. Därmed delar inte små hålmarkeringar och materialytor samma grova djupsteg från ett fast 100 km-intervall. Hålgrafik, snap och exakt borrgeometri behåller sina ägare. Skruvgeometrin jämnar endast ut normalerna på cirkulära brickväggar och mutterhål; ändytor och sexkanter behåller skarpa normaler och konturer.

## Ett skruvverktyg och gruppgrepp

Modellens enda skruvkommando heter Skruvgrupp och behåller kontrollernas befintliga kommandoägare. En skruv är ett rutnät med en position; samma produkt-, förbands-, mönster- och hålfält används vid skapande och redigering. Klass, yta, egna tillbehörslägen och sökområde ligger under Avancerat, mönstervinkel under Placering. Metadata adopteras till samma Objekt-sektion även efter uppdatering av markeringens vanliga attribut.

Objektdefinitionens valfria `gripAnchors` skiljer redigeringspunkter från fysiska ankare, snap och mått. Skruvgruppens två redigeringspunkter ligger i layoutens plan: origo och X-punkt med sparad `xLength`. `fasteners/group-grips.js` äger DOM-fria gruppförslag. Origo flyttar gruppen; X ändrar dess riktning och behåller delningar och manuell skruvlängd. Befintliga grip-, Move- och linjära transformcontrollerer använder dessa förslag genom modell-editorn. Oförändrade celler behåller skruv- och hålidentiteter.

`fasteners/preview.js` visar nådda lagerytor i modellens vanliga previewgrupp. Ouppnådda måldelar behåller normal visning. `preview-directions.js` projicerar X- och skruvriktning till det befintliga SVG-lagret för modellens måttåterkoppling; pilarna håller fast skärmstorlek och använder samma färgkälla som arbetsplansguiden. Ingen separat editor, snapmotor, historik eller permanent canvas-kontroll införs. Previewdata är tillfälliga och försvinner vid bekräftelse eller avbrott.

## Gemensam slutföring av modellverktyg

`modelCompletionCommand` återanvänder tangentbordsroutningens Enter-policy som en ren kommandofråga. Modellens pointercontroller använder den vid stationärt, omodifierat skrollklick; inga syntetiska tangentbordshändelser skickas. `model-input.js` kopplar båda inmatningsvägarna till samma lokala `completionActions`. Respektive verktygscontroller äger fortfarande punktantal, geometri, validering och transaktion.

Detta omfattar Polysweep, Plate/Polygoncut/Linecut, skruvgruppens delval, färdigvalda kopplingar, egenskapskopiering, arbetsområde, linjär flytt/kopiering, flytt/kopiering mellan plan och färdigvald rotationsaxel. Verktyg där Enter inte bekräftar en fas får ingen ny skrollklicksåtgärd. Släpp måste ha samma slutföringskommando som knapptryckningen. Rörelse över 5 px under gesten, modifierare och avbruten capture förhindrar bekräftelse; befintliga OrbitControls behåller panorering och orbit.

### Skrollklick i ritningar och profil

`pointer-completion.js` äger den DOM-fria gesten för stationärt, omodifierat skrollklick. Modellens pointercontroller, ritningarnas befintliga pan-adapter och profileditorn använder samma press-/rörelse-/släpp-/avbrottsregler. Gesten tar inte över pointer capture och flyttar inte kamera eller blad.

`DrawingAnnotations.completionCommand()` väljer enbart punktkedjor för polylinje/polygon, måttpunkter och urvalsfaser för transformverktyg/måttassistent. `complete()` är gemensam ägare för Enter och skrollklick; måttlinjens placering och transformernas från-/tillpunkter kräver fortsatt punktval. `DrawingWorkspace` tar uttryckliga completion-callbackar och lämnar dem till `drawing-pan.js`, eftersom panoreringens capture annars stoppar händelser före ritobjektens yta. Samma koppling gäller GA, Single Part och Assembly. Skrollklick sparar inte rich text eller andra inspektorutkast.

Profileditorns befintliga pointermetoder matar samma gest med händelser och slutför genom befintliga `action('finish')`, som validerar kontur och historik. Polylinje och hålkontur stöds; rektangel och insättningspunkt behåller sina punktflöden. Avbrott, förlorad capture och stängd editor rensar en väntande bekräftelse.

## Skruvarnas visningsgeometri

`fasteners/display-geometry.js` äger återanvändbara visningsmallar: släta cirkulära väggar, uttryckliga ytterkonturer och skarpa sexkanter. Normal modell, hover och preview använder samma mall. Närbild använder 24 cirkelsegment och översikt 8. Endast mallens visuella mått normaliseras till 0,0001 mm för delning mellan likadana skruvar; modell, borrning och exakt geometri ändras inte. `fasteners/geometry.js` behåller separat fullständig solid för `objectGeometry`, håloperationer och export.

`fastener-detail.js` väljer närbild, översiktsproxy eller subpixel-döljning genom befintlig detaljhantering, med hysteresis och prioritet för enstaka markerade skruvar. `display-detail.js` äger den gemensamma proxyn och dess lokala transform relativt objektet. Befintliga instansbatcher delar visningsmallar. Batchade skruvproxyer kopplas ur scengrafen men behålls av objektet för detaljpolicy och kantträff; `prepareRebuild` återansluter dem före ersättning/disponering. Färdiga skruvmeshars världsmatriser är statiska tills modellrenderaren ersätter dem; tillfällig preview förblir dynamisk. Ingen separat markering, snap eller projektmutation införs.

### Skruvgrupp på vald materialyta

Modellens befintliga picking-adapter hämtar första punktens ytnormal enbart från synliga förbandsdelar i utkastets `holes`. Vanlig snap behålls; fri punkt får den träffade ytan även när arbetsplanet ses från sidan. En snappunkt måste ligga i den träffade ytans plan för att överta det. `fastenerPlaneFromSurface` i `fasteners/placement-frame.js` skapar ett ortonormalt placeringsplan med arbetsplanets X som orienteringsreferens. Första bekräftade punktvalet låser planet i verktygssessionen; hover ändrar inte arbetsplan eller projekt. Utan ytträff används befintligt arbetsplan. Andra punkten, preview, domänvalidering, hål och redigering använder sedan samma sparade layout som tidigare.

### Hålgrupp utan synlig skruv

`fasteners/display.js` härleder gruppägda hålkanter från samma lager- och ringberäkning som delarnas hålvisning. När skruven är avstängd kombineras dessa kanter med eventuella kvarvarande tillbehör i objektets vanliga outline. Geometrin för hål/solid/export och klassningen som icke-fysisk hålgrupp ändras inte. Sådana outlines använder inte hårdvarans gemensamma instansmall eller översiktsproxy, eftersom kanterna beror på måldelarnas verkliga materialytor. Modellmeshens valda färg och `ObjectFeedback` använder samma konturer.

Den gemensamma `modelSelectionEntry` tillåter extra kantträff även för en opak mesh utan fysisk skruv. Hålkanterna returnerar gruppägarens ID och använder befintligt gruppurval och inspektor. Vid möjlig skymning kontrollerar `displayedSelectionHit` djup vid kantens projicerade punkt; en kant inom pixeltoleransen på en sned yta får inte felaktigt skymmas av ytans träff vid muspekaren. Ogenomskinlig geometri framför kanten fortsätter att blockera träffen.

### Insättningspunkter under Move och Copy

`model/grips.js` äger `retainsSelectionGrips` och `transformGripSnapPoints`. Modellens bildloop behåller samma `selectionGrips` under Move/Copy, inklusive linjära verktyg, plantransformer och markerade grepp. `InsertionPoints` visar dem som passiva spans under kommandot; hörntillägg, hörnmeny, greppval och dragning aktiveras först i vanligt markeringsläge. Markörernas befintliga pointer-events lämnar kommandots canvas och kameran som inmatningsägare.

Picking-adaptern matar de synliga markerade objektens befintliga greppankare till `resolveSnap` som punktkandidater när ändpunktssnap är aktiv. Därmed går också ett gruppankare utanför den fysiska meshens bounds att snappa till. Samma nästa-punkt-filter, prioritering, lås och arbetsområdeskontroll gäller. Ingen parallell snapmotor, ny objektspecifik regel eller modellmutation införs.

### Hålöppning och rektangelmarkering

`fastenerHoleDisplayGeometry` samlar samma materiallager som hålmarkörerna. `selectionGeometryReader` kompletterar skruvgrupper med avstängd skruv med dessa volymer; bounds och trianglar för omslutande/korsande rektangelmarkering omfattar därmed de verkliga hålen även när all hårdvara är borttagen. Ordinarie urvalscontroller äger fortfarande synlighet, arbetsområde, riktning och grupputvidgning. Urvalsgeometrin är tillfällig CPU-data och ändrar varken fysisk solid eller export.

Den gruppägda konturen behåller också hålöppningarnas trianglar som CPU-attribut. `modelSelectionEntry` återanvänder dessa för opak klickträff i öppningen. En sammanfallande öppning prioriteras framför den förenklade, obrutna måldelsytan; verkligt framförliggande material fortsätter att skymma den. Transparent visning använder fortsatt kantträff.

När markeringsrutan är aktiv är insättningspunkterna passiva även utanför Move/Copy. Greppcontroller får då inte fånga dragningen, men projicerade greppreferenser finns kvar för uttrycklig Alt-rektangelmarkering.

### Fristående skruvgrupper och placeringsplan

Manuella skruvgruppers delkopplingar bestämmer borrningen, inte transformägarskapet. `fixed-placement.js` räknar om materiallager och räckvidd mot skruvens befintliga axel och hårdvarulägen; missade eller otillräckligt nådda lager behåller relation och hål-ID utan aktiv borrning. `update-joints.js` använder detta vid modelländringar, medan komponentskapad hårdvara fortsatt ägs av komponenten. `groups.js` behåller befintliga huvudlägen när samma placeringsplan återanvänds i inspektorn, så en längdändring efter en delflytt inte passar om gruppen mot delen.

Origo-, X- och Y-grepp går genom gemensam greppmarkering, Move, linjär Move och modell-editorn. Både X- och Y-greppet kan vrida planet ut ur dess tidigare läge. X använder en rotation av hela koordinatsystemet från föregående till ny X-riktning i `placement-frame.js`, utan projektion eller ett låst grepparbetsplan. Y behåller X och bestämmer planets andra riktning. Modellens befintliga picking använder valda delars materialytor även när förhandsvisningen tillfälligt ersätter deras renderingsmeshar; faktisk användarsynlighet gäller fortfarande. `preview.js` och `preview-directions.js` äger enbart planets tillfälliga kontur och axelvisning. Hålmarkörernas ljusare färg i `display.js` påverkar inte exakt borrgeometri, ritningar eller IFC.

### Homogen skruvhårdvara i transparent modellvy

`object-mesh.js` markerar verklig skruvhårdvara med renderingsflaggan `opaqueHardware`, oberoende av scenens transparensläge. Den befintliga transparensuppdateringen behåller opacitet 1 och djupskrivning för skaft, muttrar, brickor och deras konturer. `display-detail.js` för vidare samma flagga till översiktsrepresentationen; `instance-batches.js` använder den för både kroppar och linjer och hoppar över transparenssortering för hårdvaran. Scenläget behålls separat för befintlig meshåteranvändning.

`selection-hit.js` använder homogena ytträffar för hårdvaran och behåller den gemensamma kanttoleransen för små skruvar. Ägare med enbart hål och tom fysisk geometri behåller sitt tidigare urvalsbeteende; hålmarkörer följer delarnas visningsläge. Tillfällig ghost-preview behåller befintlig återkoppling. Renderingsflaggan sparas inte i modellen och påverkar inte borrning, tillverkningsgeometri, ritningar eller export.

### Ritningsgrepp och beskärningspreview

`drawing-grip-interaction.js` äger klick–dra–släpp för ritningsgrepp, med pointer capture, återställning vid Esc/avbrott och ett avslut per dragning. Klick utan drag lämnar inget placeringsläge. Snitt- och detaljmarkörer använder `ui/grip.js` med skärmkonstanta träffytor; `drawing-marker-grip-editor.js` översätter greppet till ett lokalt utkast, använder befintlig ritningssnap och uppdaterar vyn först vid släpp. `drawing-tool-feedback.js` målar enbart markörens preview under dragningen. View-controllererna äger geometriuppdatering och den befintliga annoteringshistoriken äger ångringen.

`drawing-view-grip-editor.js` ändrar ett lokalt vyutkast. `drawing-view-crop-preview.js` visar en pappersanknuten ram via befintlig previewstil; innehåll, projektion och snapindex byggs inte om medan ramen dras. Vid bekräftelse ändras vyn och en historikoperation registreras. `PartSections` återanvänder projektion/snap när källgeometri och geometriskt vykoordinatsystem är oförändrade; pappersposition, beskärning, kameraoffset och skala ingår inte i invalidationsnyckeln. Ändrad snittdefinition eller källgeometri invaliderar berörda vyer inklusive beroende detaljer. `GAViews.refreshChanged` bygger om ändrad vy och dess efterföljare, med den aktiva ändrade vyn sist, utan att räkna om oberoende snapshots. Ren GA-beskärning använder redan upplöst vektorgeometri.

### Startvisning utan ombyggnadsblinkning

`index.html` laddar `ui/startup.css` före kontrollernas HTML. Attributet `data-app-starting` döljer den ofärdiga arbetsytan med bevarade layoutmått; den neutrala startytan använder appens befintliga logotyp och UI-färger. `ui/startup.js` äger visning och felåterkoppling. `app/application-startup.js` laddar återställning och modellapplikation, inväntar uppbyggnad och första renderingsramarna, och lämnar sedan över till arbetsytan. Fel visar Ladda om utan att exponera halvbyggda kontroller. Ingen modellåterställning eller händelsehantering ligger i `main.js`.

Startfilen startar boot-funktionen utan top-level await: Vites uppdelade lazy-moduler kan importera entry-filens preloadhjälpare och får inte blockeras av att entry-filen samtidigt väntar på dem. Boot-funktionen äger själv completion och felhantering. Lint begränsar startfilen till stilar och denna startmodul.

### Stomlinjebubblor vid arbetsområdets gräns

`GridLines.updateLabels` får samma arbetsområdesbox som modellens övriga visning. Den befintliga `clipSegmentToBox` klipper stomlinjens ändpunktspar före projektion och bubbelplacering. Bubblorna följer den synliga linjens ändar utan att flytta modellobjektens ändpunkter eller grepp. Helt bortklippta linjer och tangentkontakt i en enda punkt får inga bubblor. Modellens frameloop behåller objektens synlighetsfilter men gör ingen extra bortfiltrering baserad på de ursprungliga ändpunkterna.

### Ritningsmenyer och ritningslista

Ritningseditorns översta rad ägs av `drawing-editor-header.js` och innehåller ritningslistan, dokumentnamnet och återgång till modellen. `drawing-toolbox.js` beskriver placeringen med det gemensamma ribbon-byggblocket. Befintliga kommandon anger sin grupp via `data-drawing-command-group`; kommandonas noder, handlers och disabled-status behålls. Ingen generell Fler-meny samlar oklassificerade kontroller.

`drawing-workspace.js` stänger editorn genom dess vanliga livscykel innan listans callback körs. Därmed sparas ritningen med befintlig save-transaktion. `app/drawing-controller.js` kopplar båda editorerna till `DrawingManager.show()`, som också används för att öppna listan från modellen. Editorn äger ingen separat ritningslista eller projektmutation.
