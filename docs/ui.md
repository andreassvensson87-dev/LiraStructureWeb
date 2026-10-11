# Gemensamt UI

## Ansvar

`src/ui/ribbon.js` bygger grupper, stora knappar, små knappar i två rader, dropdowns och delade knappar. Fabriken flyttar de riktiga kontrollerna, så deras ID, händelsehanterare och controllerägda tillstånd behålls. Menyknappen följer alternativen när de blir dolda, inaktiva eller aktiva. Menyer använder browserns popoverlager och stängs vid klick utanför, Esc och stängd arbetsyta. Piltangenter flyttar fokus i menyn.

`src/ui/icons.js` äger gemensamma ikoner. `src/ui/workspace.css` äger formspråket, ribbonens mått, arbetsytornas ram och bibliotekens fönsterram. De uttryckliga editorselektorerna anpassar kvarvarande äldre stilar; de är inte nya editorimplementationer.

`model-workspace.js`, `editor-workspace.js` och `profile-workspace.js` beskriver respektive arbetsytas grupper och placering. De ansluter befintliga kommandon. De äger inte projektändringar, geometri, snap, numrering eller historik. Profilbibliotekets förhandsvisning använder samma `evaluateSection` som editorn.

## Arbetsytor och återgång

Vi använder en aktiv arbetsyta åt gången utan dokumentflikar. Modellens header öppnar ritningshanteraren eller rapporter. Editorernas återgång använder befintliga stängningsflöden. En rameditor som öppnas från rapportläget återgår till rapporten. Profil- och Item-editorerna återgår till sina bibliotek. Befintliga kontroller för osparade ändringar behålls.

Detta återanvänder befintliga editorinstanser och deras tillstånd. Det finns ingen parallell dokumentmodell eller ett nytt globalt UI-register. Dokumentflikar kan diskuteras separat om behovet uppstår.

## Profil- och Item-editorernas byggblock

`editor-surface.js` ansluter befintlig arbetsyta, högerinspektor och kontroller i nederkanten. `createEditorSection` bygger samma native details/summary för båda editorerna. `editor.css` äger panelbredd, sektionsrubriker, egenskapsrader, koordinatgrupper och nederkant. Egenskapsraderna använder samma `adoptAttributeLabel` som inspektorn och biblioteken. Profilens dynamiska måttfält adopteras efter synkronisering; befintliga ID och händelsehanterare behålls.

Adaptrarna i `profile-workspace.js` och `editor-workspace.js` väljer sektioner och flyttar befintliga snabbkontroller och instruktioner till nederkanten. Spara och använd/testa ligger kvar i den gemensamma menyraden. Fabriken äger inte geometri, snapinställningar, historik, formulärvalidering eller versionshantering. Item-formulärets Spara-knapp hör fortfarande till det ursprungliga formuläret. Hjälpgeometri är ett separat hopfällbart avsnitt och koordinater visas i tre lika breda kolumner.

## Bibliotek

`library-workspace.js` bygger samma tvådelade bibliotek för profiler, material, skruvar och Items. Adaptrarna lämnar befintliga kontroller, kommandon och callbacks. Verktygsrad, sökning, trädåtgärder, detaljpanel och nederkant har en gemensam layout i `library.css`. Redigera/Använd ligger i nederkanten. Material och skruvar använder ett disabled fieldset i visningsläge; Redigera aktiverar formuläret och Spara i nederkanten hör fortfarande till det ursprungliga formuläret med normal validering.

`library-tree.js` visar stabila nodnycklar, grupper, antal och ett objekt per rad. Den behåller öppna grenar, fokus och skrollning vid uppdatering, öppnar sökträffar och stöder piltangenter. Adaptrarna äger filtreringen och grupperingen: profilfamiljer och versioner, materialtyp/undergrupp, skruvtyp/serie samt Item-mappar med artiklar direkt i trädet. Items importerar geometri via STEP och har därför Importera i stället för ett tomt Ny-kommando. Förhandsvisningar använder befintlig profilgeometri och Item-visare; skruvbilden är en måttillustration.

Bibliotekscontrollererna behåller ägarskapet för import/export, versioner, lagring och användning i modellen. Den gemensamma presentationen ändrar inga domänregler.

Materialets sektionsmönster lagras i materialversionens `hatch`: mönster, vinkel, avstånd och linjetjocklek. Äldre material använder standardmönster efter materialtyp; inget material ger ingen hatchning. Befintliga objekt behåller sin materialversion när biblioteket redigeras. `ui/preview-select.js` är ett gemensamt dropdown-byggblock med förhandsvisningar från adaptern, native popover, piltangenter och Esc. `material-hatch-ui.js` använder detta i bibliotekets befintliga formulär, redigeringsgrind och versionsflöde. Vinkel och avstånd ligger på samma rad, linjetjocklek under Avancerat.

`material-hatch.js` äger validering, slutna snittkonturer, begränsning till snittbredd och mönsterklippning utan DOM. Varje del hatchas för sitt eget material, med tomma hål enligt jämnt/udda-regeln. `drawing-hatch.js` visar de klippta vektorlinjerna i befintliga SVG-lager för GA, Single Part och Assembly; samma lager exporteras till PDF. Måtten gäller pappersmillimeter. Vyns `settings.materialHatch` styr visning utan att ändra materialet, med visning som standard.

`floating-window.js` ger samma titelrad, drag med pointer capture, resize, Esc och begränsning till fönstret. Bibliotekscontrollererna äger listor, sökning, formulär, versioner och användning av valda objekt. Profilbibliotekets lista har separerats från profileditorns arbetsyta; samma profildefinition och editor används när användaren väljer Redigera.

Bibliotek öppnas utan modal låsning från modellen. Om ett bibliotek öppnas inifrån en modal arbetsyta använder det browserns modallager, så det hamnar ovanpå arbetsytan och går att använda. Tangentbord i biblioteket stannar där; modellens tangentbordsrouting blockerar bara verkliga modala dialoger.

## Kontrollerade flöden

Ritningstext lagras som `richtext`-anteckningar på bladet, med stycken, textdelar och uttryckliga format. `drawing-rich-text.js` äger radbrytning och listnumrering utan DOM. `drawing-rich-text-editor.js` äger placering på bladet, inspektor och ett tillfälligt redigeringsutkast. Bekräftelse ger en checkpoint i ritningens befintliga anteckningshistorik; Esc återställer utan att spara utkastet. Inklistring använder vanlig text. SVG-renderingen delas av bladet och PDF-exporten; textstorlek och bredd anges i pappersmillimeter och påverkas inte av vyskalan. Text ligger i bladets SVG-lager, även för GA med flera vyer, och exporteras en gång per blad.

`exact-length.js` och `exact-length.css` äger det gemensamma kompakta måttfältet i modellens och ritningarnas nederkant. Komponenten adopterar modellens befintliga input/form och bygger motsvarande formulär för ritningar. Verktygen behåller riktning, snap, validering och Enter-kommandon. Ett reserverat fältutrymme och en avgränsad instruktionstext gör placeringen oberoende av textlängd och om fältet visas. Modellens riktningslås visas ovanför fältet vid fokus.

UI-flytten har kontrollerats i webbläsaren: modelleringsverktyg, disabled/aktiv-status, sökning och profilförhandsvisning, bibliotek → editor → bibliotek, ritningsverktyg och ångra, tangentbordsmenyer, rapport → rameditor → rapport samt Item-editor. Regressionstester skyddar domänbeteenden; CSS- eller källtexttester har inte lagts till för denna presentationsändring.

## Ram- och ritningseditorer

Ritningarnas inspektor använder `ui/inspector-rail.js` för en diskret vertikal ikonlist med Egenskaper, Blad och vyer samt Referenser. `drawing/ui/inspector-panels.js` placerar befintliga kontroller i panelerna utan att ersätta deras controllerer. Ritobjekt och ritverktyg visar sina egenskaper när de väljs; panelbyte i sig ändrar inte urval eller aktivt verktyg. Referenspanelen för GA visar importerade IFC:er med synlighet per vy, skymda kanter, snap och en placeholder för objektfilter. Referenser visas enbart på GA; Single Part och Assembly har bara Egenskaper samt Blad och vyer i ikonlisten.

Rameditorn och GA/Single Part använder också `installEditorSurface`. Deras befintliga CAD-statusrad behålls med samma inställningar, menyer och återkopplingscontroller. Ramens befintliga sektioner och ritningarnas dynamiska egenskapspaneler använder samma fält- och rubrikstil. Koordinatgrupper i ritningsvyer har etiketter ovanför respektive kontroll.

För dynamiska paneler kan adaptern aktivera en lokal MutationObserver för barnändringar. Den adopterar nytillkomna etiketter och sektioner idempotent; den bevakar inte attribut eller domändata. Befintliga kontroller flyttas inte när deras caption redan finns. Dialogerna har samma livslängd som appinstansen. Kontroller för validering, ångra och sparning ägs fortfarande av editorerna.

## Rapporter och formulärdialoger

Rapportläget använder samma editorarbetsyta, högerpanel, egenskapsrader och nederkant. Varje rapportkolumn är ett `createEditorSection` med attribut, rubrik, relativ bredd och justering. Öppet/stängt följer kolumnobjektet vid omordning; den första kolumnen är öppen från början. Rapportcontrollern behåller urval, förhandsvisning, kolumnordning, mallar och projektsparning.

`dialog-presentation.js` ansluter befintliga formulär till fält- och knappstilen i `dialog.css`. Inställningar, rapportens Spara mall och Items mappdialog använder adaptern. Den anropas uttryckligen efter att formulärets kontroller skapats och ersätter inga formulär, ID, händelser eller valideringsregler. Checkboxrader behåller sin befintliga struktur, och `hidden` behåller företräde framför presentationsregler. Andra dialoger ansluts när deras användarflöden har granskats.

`installManagementDialog` ger numrering, ritningshanteraren och revisioner samma titelrad, tabellstil, egenskapsrader och knapprad. Numrering öppnar fortfarande förhandsgranskningen först, med Inställningar som andra flik. Prefix och startnummer ägs av inspektorn. Ritningshanterarens verktygsrad använder `createRibbon`; kolumnval ligger i samma popoverlager som övriga menyer. Revisionernas historik, validering och projekttransaktioner behålls.

Attributbiblioteket använder `installLibraryWorkspace` och `renderLibraryTree`, med grupper för projekt, ritning, rapport och egna attribut. Datatyp kan visas som en diskret badge på trädraden; namn, nyckel, tillämpning, källa och redigerbarhet finns kvar i egenskaper eller tooltip. Spara-knappen kopplas till det befintliga formuläret även när den ligger i fönstrets nederkant. Låsta standardattribut och konfigurerbara vallistor styrs fortfarande av attributdefinitionerna.

## Ritobjekt, punktval och hatch

`ui/cad-feedback.js` äger presentationen av snapresultat: gemensamma SVG-symboler för ändpunkt, mittpunkt, centrum, korsning, vinkelrät och kvadrant, samt färger och skärmmått för snap, Polar, Otrack och preview. Modellens HTML-overlay innehåller samma SVG-symboler som ritning och rameditor. Profileditorns Canvas-punktmarkör delar samma färg och mått. Befintliga snapmotorer, toleranser, prioritering och kontrollplacering ändras inte. Ritningens feedback ligger fortsatt i exportundantagna hjälplager; ramens preview och modellens tillfälliga meshmaterial använder den gemensamma previewfärgen. Modellens axelguider behåller X/Y/Z-färger och anpassar strecklängden till skärmprojektionen.

Rameditorns objekt och rapportyta använder också `ui/grip.js` och dess gemensamma stil. Linjehörn och rapportytans kant-/hörngrepp är fyrkantiga; objektflytt och rapportytans mittgrepp är diamanter. Det aktiva greppet följer preview med orange markering. Greppens skärmstorlek uppdateras efter render/zoom, och tangentbordsfokus använder samma återkoppling som hover. Rameditorns befintliga punktval, magnetsnap, transform, validering och historik äger fortsatt ändringarna.

Polygon ligger i befintliga Rita-menyn. Flytta/Kopiera/Rotera behåller samma kommandon och knappar, använder förvalda ritobjekt direkt och tillåter flerval inom samma vy eller bland bladtexter. Inspektorn använder gemensamma sektioner för geometri, utseende och framför/bakom modellen. Den kompakta hatchväljaren och dess fält delas med materialbiblioteket. Centrum och kvadranter finns i befintliga Snappunkter-menyn. Exakt längd och vinkel använder samma reserverade fält i nederkanten.

Sparad grafik påverkas inte av markeringsfärgen. Blå markeringskonturer och gröna previews är ett eget hjälplager som inte exporteras. Snapmarkörer och text har konstant skärmstorlek. Sluten polygon kan avslutas med Enter, C eller klick på första hörnet; öppna polylinjer kan stängas på samma sätt med C/första hörnet eller via inspektorn. Hatch följer den slutna formen och anger avstånd/linjetjocklek i pappersmillimeter.
