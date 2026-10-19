# Teststrategi

## Skruvplacering, vändning och delurval

`fastener-group-grips.test.js` verifierar vändning och tillagda/borttagna måldelar genom samma placeringsberäkning, oförändrade sparade objekt före Tillämpa, bibehållna befintliga skruv-/hålidentiteter, borttagna hål på bortvalda delar och ångring. Återkopplingens intervall kontrolleras med blandade träffar, inaktiva hål, Inga hål och längdvarningar. `fastener-placement-ui.test.js` skyddar att bekräftat delurval återgår till ett väntande inspektorutkast och att ogiltigt urval inte skapar eller uppdaterar gruppen.

Webbläsarprov 2026-10-17 på separat localhost-origin: två plåtar valda med modellträffar, skrollklick till placering, sex skruvar, origo följt av ändrat delurval och bibehållen origo/vändning efter återgång. Nästa punkt skapade exakt en grupp. Sparad grupp provades med Vänd, borttagen och återvald del, skrollklick, Tillämpa och Ångra. UI-export före Tillämpa behöll originalets delkopplingar och riktning; efter Tillämpa var samtliga sex vända med bevarade befintliga skruv-/hål-ID:n. Längd 5 gav noll nådda lager och varning; återgång till 80 rensade varningen och visade två lager. Ett 30° snett förband vändes med bibehållna ID:n, längd 80, axel cirka (0,5, 0, 0,8660254) och aktiva hål i båda delarna. Ingen separat snap eller hålberäkning används för återkopplingen. Inga browserfel rapporterades. Full `npm run check` passerade.

Testantalet är inget kvalitetsmått. Vi kontrollerar beteenden och felrisker, inte hur många gröna rader körningen ger.

- `npm test`: ett mindre urval centrala modellflöden — objekt, verktyg, snap, inspektor, historik, projektåterställning och numrering. Lämpligt för löpande modelleringsarbete.
- `node --test tests/<område>.test.js`: specialisttester för den ändrade funktionen. Rita, importera och exportera har andra felrisker än modellens vanligaste kommandon.
- `npm run test:all`: hela regressionen, inklusive ritningar, referenser, kataloger och export.
- `npm run check`: formatering, lint, full regression och produktionsbygge. GitHub använder detta före publicering.

Arkitekturgränser bevakas av ESLint i stället för tester som söker efter text i källfiler. Modellens UI och app-adaptrar får inte skriva objektlistan direkt; modell-editorn äger validering och checkpoint. Objektdefinitioner, verktygsregler och projektmoduler får inte använda DOM eller browser storage. `main.js` får bara ladda stilar och starta appen. App-kopplingen får inte äga UI-händelser.

De centrala testerna omfattar också sessionens koppling till modell-editor, historik, rendering och snapindex. UI-gränsen ersätts i dessa tester; komplett uppstart, dialoger och input kontrolleras i webbläsaren.

Behåll tester för geometri, numrering, beroende objekt, save/load, ångra/gör om och verkliga regressioner. Ta bort tester för övergiven kod. Slå inte ihop oberoende beteenden enbart för att sänka räknaren. Radera inte specialisttester bara för att de inte behövs vid varje UI-ändring.

Se `docs/test-review.md` för den genomförda granskningens omfattning och beslut.

Små ändringar av text eller layout verifieras i webbläsaren. Nya tester ska fånga ett konkret fel, inte spegla implementationen eller kontrollera att en viss sträng finns i en fil. Test som kör en worker eller en service worker via VM är beteendetest, även när det läser källfilen.

## IFC-underlag i GA: manuell verifiering

`scripts/benchmark-drawing-ifc.mjs /absolute/path/model.ifc` mäter IFC-läsning/geometri, förberedelse av plan och snitt, transportkopior, gemensam vektorprojektion och referensens snapindex. Kör med Node. Filen är ett argument och lagras inte i repositoryt. Mätningen kör den DOM-fria geometrin direkt, utan SVG, verklig workerkommunikation eller PDF-layout; tiderna är inte hela användarflödets responstid.

Kontroll 2026-10-11 med lokal `KP-25-V-001.ifc`: 2 808 501 byte, 2 686 geometridelar, 264 817 trianglar. En körning på utvecklingsdatorn gav cirka 616 ms för IFC-läsning och mesh/kanter, 350 ms för planprojektion och 1 606 ms för snittprojektion. Snapindexets lokala sökning hade p95 under 0,005 ms över 1 000 spridda frågor per vy (tolerans 50 mm). Detta mäter indexsökning, inte hela snap-/pointerflödet. Filens IFC-läsare rapporterade självskärande kompositkurvor; en komplett jämförelse med källprogrammets geometri har inte gjorts.

Webbläsarkontrollen kördes i det separata localhost-testprojektet: återställning av två referenser, synlighet per vy, skymda kanter, punktval med linjeverktyget, skapande av IFC-snitt, sparning samt PDF-export. PDF:n renderades med Poppler och jämfördes visuellt med bladet. Ett fel för externa snitthänvisningar efter verktygsavbrott och ett fel där snittets inpassning saknade IFC-underlaget rättades; specialisttester skyddar båda beteendena. En riktig fil av denna storlek är inte ett prestandabevis för mycket större federerade modeller.

### Verklig snap- och pekarmätning

Utvecklingsläge med `?drawingPerformance=1` aktiverar `DrawingPointerTimings` på ritningscontrollerinstansen. Konsolen rapporterar `DRAWING_POINTER_TIMINGS`: `snap` mäter hela `locateDrawingPoint` (adapter, kandidater, snapFrame, tracking och koordinat-/inputuppdatering), `pointer` mäter den synkrona pointermove-hanteraren inklusive editorredraw. Faserna är överlappande och ska inte summeras. Browserns efterföljande layout/paint, GPU och musens faktiska fördröjning ingår inte. Inga kontroller läggs till; produktionsläget aktiverar inte instrumenteringen.

Explorativ kontroll 2026-10-11: linjeverktyget, sparad GA-plan med egna delar samt två IFC-referenser (KP-25-V-001 och boxfixture), inpassat blad 1:100, 1280×720. Native drag över samma täta område användes, 20–63 pointerhändelser per kombination. Testlinjer tillkom under körningen men sparades inte. Detta är en riktad diagnos, inte ett kontrollerat FPS-benchmark eller representativt prov av alla pekarpositioner.

Med snap och Korsning på var snap median 0,3 ms, p95 55,6 ms och max 109,1 ms (70 punktval inklusive pointerdown). Hela pekarhanteraren hade median 23,8 ms och p95 78,3 ms. Med snap av var punktval p95 0,2 ms och hela hanteraren p95 32,5 ms. Snap utan Korsning gav p95 6,9 ms, max 10 ms. Polar 45° + Otrack aktiverade utan Korsning gav snap p95 4 ms i en kortare körning. Värdena visar att den tidigare snabba indexsökningen inte beskriver hela snapflödet. Korsningssökning och den synkrona omritningen ska profileras var för sig före optimering; aktiverad Otrack är inte ett fullständigt test av alla förvärvade spårningsguider.

Efter uppdelning av scen och hjälplager 2026-10-11 användes samma GA, skärmstorlek och dragområde. Med snap av blev pointer median 7,7 ms och p95 9,4 ms (36 händelser), jämfört med tidigare p95 32,5 ms. Med snap utan Korsning, Polar 45° och Otrack blev pointer median 7,8 ms och p95 14,2 ms (36 händelser); motsvarande tidigare korta körning gav p95 46,8 ms. Med Korsning blev snap p95 16,1 ms och max 57,5 ms, pointer p95 23,4 ms (20 händelser). Provstorlekar och tillkommande testlinjer skiljer sig; resultaten visar riktningen men är inte ett kontrollerat jämförelsebenchmark. Snitt-/detaljpreview samt Single Part-linje och textutkast kontrollerades också i webbläsaren. Pointertester skyddar att oförändrad modellgrafik inte begärs omritad av dessa feedbackvägar.

### Optimerad Korsningssnap

`benchmark-drawing-ifc.mjs` mäter också Korsning på 100 deterministiska positioner per vy, hälften vid renderade segmentändpunkter och hälften spridda över vyn, med tolerans 667 mm (ungefär 10 skärmpixlar i den testade planvyn). Detta isolerar lokal gallring och korsningsberäkning utan DOM, övriga snaptyper, tracking eller overlay. Samma KP-fil och frågepositioner före/efter gallrad korsningssökning gav plan p95 3,15 → 0,43 ms och snitt p95 5,92 → 0,38 ms; största lokala listorna hade 688 respektive 700 segment. Enskilda körningar är inte en generell prestandagaranti.

Webbläsarkontroll med samma GA och fyra tidigare dragbanor, Snap + Korsning + Polar 45° + Otrack: snap p95 3,6 ms, max 7,7 ms (23 punktval) och pointer p95 10,8 ms (20 händelser). Föregående körning före korsningsoptimeringen gav snap p95 16,1 ms/max 57,5 ms och pointer p95 23,4 ms. Detta är fortsatt ett litet explorativt prov. Korsningssymbol och preview kontrollerades visuellt. Tester jämför 200 deterministiska punktval mot uttömmande parvis korsning, med Ortho, dubbla segment, långa linjer, ändpunktsprioritet och finita utbredningar; flyttalsresultat jämförs med numerisk tolerans.

### Belastningsprov och sammanhängande GA-flöde

Kör `node --expose-gc scripts/benchmark-drawing-ifc.mjs /absolute/path/model.ifc 4` för fyra förskjutna testkopior (tillåtet 1–16, standard 1). Kopiorna delar importerad källgeometri och kanter; ritningsförberedelsen gör vanliga geometrikopior med världstransform. Detta är ett syntetiskt projektionstest, inte import av fyra separata stora IFC-filer. `importedMemory` och `projectedMemory` är Node-processens minnesvärden efter valfri GC, inte browserns heap, GPU-minne, minnesläckagemätning eller maximal RSS mellan provpunkterna.

2026-10-11 med KP-filens fyra kopior: 10 744 delar och 1 059 268 trianglar. Planprojektion 1 338 ms, snittprojektion 8 565 ms. Lokal Korsning p95 0,374 respektive 0,393 ms. Observerad RSS efter snittet cirka 1,16 GB; heapUsed cirka 268 MB och arrayBuffers cirka 175 MB. WASM, Node och projektionsdata bidrar alla till processminnet. Långa snitt och minnesåtgång behöver optimeras och följas upp på större verkliga modeller; någon sådan fil fanns inte lokalt vid kontrollen.

I separat localhost-testprojekt kontrollerades GA med två återställda IFC-referenser: skapa linje, Ctrl M/C/R, flytta/kopiera och 90° rotation med exakt vinkel, ångra/gör om, slutet ritobjekt med korshatch, ritordning framför/bakom, spara och återladda sidan, referenssynlighet, skymda kanter och referenssnap samt upprepad öppning/stängning. Inga browserfel rapporterades. A3-PDF på en sida renderades med Poppler och jämfördes med skärmen: IFC, ritobjekt, korshatch och bladtext följer med; hjälpgrafik saknas. PDF-textkontroll bekräftade fet stil för textrubriken. De överlappande vyerna är avsiktliga i det befintliga testbladet.

Granskningen upptäckte att slutna ritningar kunde behålla SVG-vybilder och grafikreferenser via controllererna. GA rensar nu vybilder och ramgrafik efter att inställningar sparats; annoteringar, text och snitt-/detaljfeedback släpper sina grafikreferenser vid stängning. Tester skyddar avslut av worker, väntande jobb/export, projektionscache och annoteringsgrafik. Detta verifierar ägarskap och städning, inte att browserns processminne omedelbart sjunker.

### Gallring av snittets skymmande ytor

2026-10-11 profilerades samma fyra KP-kopior. Största kostnaden var att samla och testa ytkandidater i det tidigare projektionsrutnätet. Efter byte till en hierarki med XY-gränser och konservativ djupgallring: plan 1 405 → 516 ms, snitt 8 269 → 1 713 ms i två efterföljande körningar med samma indata. Det är cirka 4,8 gånger snabbare snittprojektion i detta syntetiska prov, inte hela editorns öppningstid. SHA-256 över samtliga projicerade ytor och kantgrupper (inklusive synliga/dolda intervall och metadata) var identisk före/efter för båda vyerna. Skriptet beräknar nu `projectionHash` stegvis för att undvika en modellstor JSON-sträng.

Minnesprovet efter GC gav i båda fallen cirka 268 MB heapUsed och 1,20 GB RSS efter snittet. Ingen betydande minskning av kvarvarande minne har visats; ritningsresultat och geometrikopior är fortfarande stora. Tidigare hashförsök med en enda JSON-sträng gav missvisande extra RSS och ingår inte i jämförelsen. Tester jämför hierarkins kandidater med uttömmande gränsprövning, inklusive smala/sammanfallande ytor, tom geometri, berörande gränser och oförändrad indata; projektionstest skyddar luckor och ytor bakom en kant.

Webbläsarkontroll i separat localhost-projekt: öppna GA med två återställda IFC-underlag, växla plan/snitt, slå på och av skymda IFC-kanter och återställ valet. Single Part med exakt profil, snitt och hatch kontrollerades också eftersom samma projektionsfunktion används där. Inga browserfel rapporterades. Full regression, formatering, lint och produktionsbygge passerade; kontrollerna kördes direkt med den bundlade Node-runtime eftersom `npm` saknades i terminalens PATH.

### Packad IFC-vycache och minneslivscykel

2026-10-11 utökades benchmarkskriptet med separat mätning av cache och sex vybyten. Varje vy beräknas i en egen funktionsram; geometri, transportdata och snapindex släpps innan cacheprovet. IFC-geometrin får nu normaler som i appens importerare, men ritningskopiorna behåller endast positioner och index. Två explicita GC-anrop per minnesprov minskar fördröjningen för frigöring av ArrayBuffer-data. Detta är fortfarande Node/WASM-processdata, inte browserheap, GPU eller toppminne.

Samma fyra KP-kopior: importerad heapUsed 57,8 MB och arrayBuffers 22,8 MB. Två uppackade vyresultat gav totalt 310,5 MB heapUsed, alltså cirka 252,6 MB extra. Packad cache gav 75,4 MB heapUsed plus 46,6 MB nya numeriska buffertar, alltså cirka 64,1 MB extra (cirka 75 % mindre cachedata). Aktiv plan/snitt gav 151,3/242,6 MB total heapUsed, med samma 69,4 MB totala arrayBuffers; den aktiva vyn behöver fortfarande uppackade data. Sex alternerande vybyten gav stabila jämförbara prov. Efter att all vycache släppts: heapUsed 58,2 MB och arrayBuffers 22,8 MB. RSS sjönk inte tillbaka till importnivån; allokeraren kan behålla frigjort processminne.

Planprojektion 522 ms och snittprojektion 1 721 ms i isolerad körning. SHA-256 för plan och snitt var identiska med tidigare resultat; snittet behöll samma checksumma efter packning, uppackning och upprepade vybyten. Tester skyddar exakt Float64-transport (inklusive små koordinater och -0), dolda kanter, referensflaggor, originalgeometrins buffertägarskap, borttagen vy/väntande jobb och frigöring av controllerdata vid clear/close.

Webbläsarkontroll med packad workertransport i separat localhost-projekt: sex växlingar mellan plan, kopia och snitt, linjeverktygets punktval/preview/avbrott samt upprepad stängning/återöppning. GA-exporten väntade på vyerna och gav en PDF som renderades med Poppler; IFC-linjer, hatch och text kontrollerades visuellt. Inga browserfel rapporterades. Full regression, lint, formatering och produktionsbygge passerade. Browserns totala minne har inte mätts.

## Ritad isolering

`drawing-insulation.test.js` skyddar lutad baslinje, sida, ytterkontur/snap, höjdgrepp utan baslinjeförflyttning, nollhöjd, transformation/kopia, skalad SVG-geometri, begränsat antal repetitioner samt tvåpunktsflöde med ångra/gör om och sparad ritningsändring.

Webbläsarkontroll 2026-10-11 i separat localhost-testprojekt: tvåpunktsskapande i GA och Single Part-snitt, verktygets förvalda tjocklek, mjuk/hård, sida, tjockleksfält, höjdgrepp, ångring, kopiering, numerisk rotation, flytt och sparning. Single Part-PDF renderades med Poppler; båda mönstren och roterad mjuk isolering visas som vektorer utan grepp/markeringsramar. Befintliga testobjekt/vy utanför bladet i testprojektet ändrades inte.

## Gemensamma ritningsgrepp

`drawing-grip-interaction.test.js` verifierar drag och klick–placera med exakt en commit, ogiltig placering efter giltig preview, Esc utan historik, numerisk decimal-komma/nollmått, måttpunkters snapreferenser/avbrott samt flytt av flera vyer och beskärning med ångra/gör om och bibehållen skala. Domän-/transformtester för former och isolering behålls.

Webbläsarkontroll i separat localhost-projekt: isoleringens parameter via drag, klick–placera och måttfält; numerisk cirkelradie; textbredd och textflytt; GA- och Single Part-vyflytt/beskärning och ångring. Grepp och inspektorvärden kontrolleras tillsammans; vygeometrins återställning är inte tillräcklig om formuläret visar gamla värden. Greppens zoom och PDF hjälplager verifieras också visuellt.

### Rensning av ersatta kodvägar

2026-10-11 togs tester för borttagna formatkonverteringar och den tidigare separata greppdragningen bort. Geometri, aktuella grepptransaktioner, numrering, projektfiler och historik behåller sina beteendetester. Exempelprojekt och testdata använder nu objektbaserade stomlinjer. Ett scenario verifierar att nya Single Part-standardvyer och en redigerbar sektion skapas utan migrering och att borttagna vyer förblir borttagna.

Webbläsarkontroll i separat localhost-projekt: öppna befintlig Single Part, dra isoleringens tjockleksgrepp och ångra; skapa och öppna Single Part utan mall samt spara och återöppna. Kontrollen fångade ett saknat initieringssteg för nya standardvyer som rättades innan slutförandet.

### Uppdelning av ritobjektens controller

2026-10-11 flyttades inspektorns presentation och punktinsamling för former, mått och leader till egna moduler. Befintliga scenarier kompletterades med linjefortsättning, polygonstängning och ångra/gör om samt att en dubblettpunkt inte ändrar måttets modellreferenser eller rensar redo-historiken. Full regression: 895 tester passerade.

Webbläsarkontroll i separat localhost-projekt: skapa linje i Single Part, ändra linjetjocklek och ritordning samt ångra ritordningen; skapa måttkedja, ändra kommentar och precision samt lägga till måttpunkt. I GA skapades leader med modellkoppling och dess kommentar och textstorlek ändrades i inspektorn. Inga browserfel rapporterades. Lint, formatering och produktionsbygge passerade.

### Editorernas ansvar och beroenden

GA, Single Part/Assembly, ram, profil, skruv, referens, Item och ritningstext har separata ägare för rendering, egenskapsvisning eller import/redigeringssession. Befintliga domän- och transaktionstester återanvänds. `plan-section.test.js` verifierar båda GA-geometribyggarna med verkliga modellobjekt: höjd-/djupgallring, source-kopplade snappunkter, snittkonturer, materialhatch och oförändrade modellobjekt. `item-editor.test.js` skyddar asynkron versionssparning: aktuell version används, urval meddelas efter lyckad lagring och ett lagringsfel behåller utkastet och återaktiverar kontrollerna. Referensens befintliga avbrotts-, ersättnings- och återställningsscenarier följer workerens nya importägare.

Webbläsarkontroll 2026-10-11 i separat localhost-projekt: GA-plan och snitt med återställda IFC-underlag; Single Part med flera vyer, hatch, isolering och växling av profilvisning; Assembly med standardvyer och stycklista; två textstycken, textstorlek och justering; profilparameter, uppdaterade punktuttryck och ångring; skruvbibliotek och placeringsinspektor; Item-redigering, versionssparning och återgång till bibliotek; ramlinje, markeringsgrepp, egenskapscommit och ångra/gör om. Kontrollen fångade fel i GA:s detaljargument och ramrendererns SVG-argument som rättades. Ram- och GA-snittkontrollen upprepades i en ren testflik utan browserfel. Den befintliga Single Part-testritningens överlappande vyer behölls.

### Granskning av modulgränser och livscykel

2026-10-11 kontrollerades de uppdelade modulernas beroenden, modellmutationer, fasta händelsehanterare och stängningsflöden. ESLint skyddar presentationens imports/storage och kvalificerade objektlistmutationer i modell-UI. Reglerna prövades med avsiktligt felaktiga imports, storage-anrop samt `owner.project.objects`-tilldelning och push; ingen extra källtexttestsvit lades till.

Befintliga scenarier kompletterades för verkliga risker: Item-stängning frigör viewport och utkast; sena lagringsresultat/fel påverkar inte en ny session och parallell sparning blockeras; grid-cachen kan byggas och dess klickadresser räknas om efter borttagning/ångring utan att modellobjektens identitet eller data ändras; Single Part-stängning frigör all profil-/assemblygeometri och släpper snitt-/modellreferenser. GA:s befintliga livscykeltest omfattar även egna snappunkter. Referensens befintliga worker-/avbrottstester återanvänds.

Webbläsarkontroll i separat localhost-projekt: bubbelmarkering av stomlinje, borttagning, rätt markering av nästa linje efter omindexering och ångring; Item-utkast som överges och återöppnas från sparad version, noll kvarvarande editorcanvas/fält vid stängning och en enda canvas efter återöppning; Single Part med standardvyer och snitt vid stängning och återöppning. Full regression: 903 tester passerade; lint, formatering och produktionsbygge passerade.

### Parametriska block i modell och ritning

2026-10-11: `blocks.test.js` skyddar uttryck och cykler, punktlåsningar, ogiltig geometri före historik, detached session/ångring, delidentitet och numreringsserier, kompletta instanser vid transformation/kopia, versionskonflikter, självständiga projektsnapshots, plattors plan/tjocklek/materialsida, fixerade insättningsankare, parameterstyrda grepp samt modell-/pappersenheter. Befintliga placerings- och sessionstester kompletterades för ändpunktskommandot och block med dolda medlemmar.

Webbläsarkontroll i separat localhost-testprojekt: 3D-block från en vanlig sweep, parameterändring, versionssparning, fältfokus, punkt-/ankarlåsning, placering från bibliotek, ändpunktsgrepp och ångring. I GA: block från rektangel, parameterändring, hörngrepp, kopia med egna mått, versioner med pappersenheter, placering på blad, pappersgrepp, sparning/återöppning och avmarkering på tomt blad. Versionssparandet validerar instansuppdateringen före bibliotekslagring och bevarar instansmåtten. PDF-exporten renderades med Poppler och kontrollerades visuellt: modell- och pappersblock utan grepp eller preview. Inga browserfel rapporterades. Full regression: 913 tester passerade; lint, formatering och produktionsbygge passerade.

2026-10-12 kompletterades blockkontrollen med `examples/parametric-blocks.json`: stålram med tre profiler och en parametrisk bottenplåt samt motsvarande 2D-kontur och plåttjocklekslinje. Ett beteendescenario kontrollerar samverkande bredd/höjd/djup/tjocklek, bibehållen materialidentitet, oförändrad förankring, vanliga snappsegment, partserier, assemblyns modell- och snapgeometri, 2D-mått och roterad blockinstans. Full regression: 914 tester passerade.

Browserkontroll i separat localhost-projekt: import av exempelbibliotek, direkt val mellan revisioner (ett fel i trädets callback rättades), 3D-testvärden för bredd/höjd/tjocklek, fyrdelsplacering, parametercommit och ångring med återställda mått, placering med synligt S355-material. I båda editorerna verifierades klickbar referensetikett, markerad referens och rätt inspektorfält; 2D-hörnval visade låsningar till Höger/Överkant. En hopfälld referens öppnas av etikettval. Parameterfokus framhävde Höger; en ändrad X-låsning framhävde Vänster och återgick till Höger vid ångring. Inga browserfel rapporterades. Lint, formatering och produktionsbygge passerade.

### Gemensam punktlåsning i blockeditorn

2026-10-12: två scenarier i `blocks.test.js` skyddar flerval med dubbletter, utbyte av en enda axels låsningar, gemensamt ångra/gör om, blandade låsningar, okända punkter/uttryck och icke-plan plåt utan ändrad definition/historik. Frigöring behåller utvärderade koordinater även för insättningsankare och testvärden; övriga axlars låsningar och ursprungsdefinitionen bevaras. Guider verifieras mot verkligt offset och sammanfallande ändpunkter vid noll. Full regression: 916 tester passerade.

Browserkontroll i separat localhost-projekt: 3D-punktval och flerval av tre punkter på stolpe/överliggare, referensval via etikett, gruppoffset, versionssparning och återöppning med bevarade låsningar. I 2D verifierades Shift-klick, nära/överlappande punktmarkörer, gemensam offset, ett ångringssteg/gör om, Frigör med identiska punktkoordinater och ogiltigt uttryck utan ändrad geometri. Inspektorns Blandat/Fri och guideoffset kontrollerades samtidigt. Stängning rensade editorfält och guider. Lint, formatering och produktionsbygge passerade.

### Polysweep och gemensam punktinspektor

2026-10-12: `polysweep.test.js` skyddar tangentbågar och radiegränser, ihålig sammanhängande 3D-geometri, banlängd/mängder, platekontur och area, atomiska radieändringar över flera objekt, ångra/gör om, projektsparning, numrering, transform och flerpunktsflytt. Punktinsättning/borttagning bevarar radiernas index och minsta giltiga punktantal. GA-geometrin byggs med verkliga Plate-/Polysweep-objekt. Full regression: 921 tester passerade.

Browserkontroll i separat localhost-projekt: skapa Polysweep med normal profilkälla och modellens punktplacering, avsluta med Enter och inspektorknapp, Backspace, lägga till/ta bort hörn, markera tre punkter på Plate och Polysweep, gemensam radie och ogiltigt värde med fungerande Återställ, Escape med bevarat objekturval samt återläst lokal sparning. Polysweep numrerades och Single Part/Assembly skapades via befintliga dialoger; Single Part öppnades med verklig böjd profilgeometri och banlängd i materiallistan. Standardvyerna för den stora testdelen behövde skala/placering justeras till bladet, vilket ritningens befintliga varning visade.

### Praktisk Polysweep-kontroll och GA-öppning

2026-10-12: öppning av en ny GA avbröts när vyinspektorn försökte läsa urval innan `ensureGAViews` hade skapat första vyn. `GAViews` har nu ett tomt urval före initiering och återställer urval/ready vid reset. Regressionen i `drawing-geometry-lifecycle.test.js` skyddar både första öppningen och byte till en ny ritning. I separat localhost-projekt mättes bladets centrum efter öppning och återöppning efter zoom: avvikelse −0,25 pixel i X och 0 i Y.

Praktisk kontroll fångade att dubbelklick på en vald punkt tappade gruppurvalet genom dubbelklickets första klick. Punktcontrollern bevarar nu gruppen när en redan vald punkt klickas. Både browserkontroll och ett controller-/geometritest verifierar att två punkter flyttas med samma förskjutning och behåller radierna; browsern verifierade ångring i ett steg. Ett asymmetriskt profiltest jämför verkliga meshkoordinater före/efter 3D-rotation med profilrotation och förskjutet insättningsläge. För stor profil avvisas före projektändring/checkpoint.

Browserkontroll: bredd, profilrotation och insättningsläge på en böjd Polysweep; GA-snitt, skymda kanter och måttsättning med snap; Single Part med uppdaterad profil/materiallista efter omnumrering; Assembly med nytt assembly mark, ingående part mark och stycklista. Skalbyte i Assembly 1:10 → 1:40 verifierade att både innehåll och ram skalas, och att inspektorns bredd/höjd uppdateras till 92,548 × 27,009 mm direkt. `PartSections` synkar inspektorn efter skalbyte. Standardvyerna för testdelen behöver fortsatt användarvald skala/placering för att rymmas på A3. Full regression: 924 tester passerade; lint och formatering passerade.

### Gemensamma tillfälliga mått

2026-10-12: `measurements.test.js` skyddar urval/synlighet/flerval, tangentlängder och radier, assemblyutbredning, Move/Copy med snap/exakt avstånd och avslut, ritformernas verkliga millimeter, fasta skärmmått och läsbar riktning vid omvända linjer. Ett renderer-/PDF-test kör den gemensamma måttpresentationen och verklig `singlePartPDFPage` med ersatt DOM-gräns: hjälplagret tas bort ur kopian, verklig ritgeometri och öppna editorns hjälplager bevaras.

Browserkontroll i separat localhost-projekt: vanlig Sweep med längdmått, Polysweep-sträckor/radier, Move med exakt 1 250 mm och bekräftelse, Copy-preview och Esc, objektmått som försvinner vid två valda delar. I GA skapades och valdes en ritlinje; längdmåttet visade 6 692,3 mm i vy 1:39,8107. Copy-preview visade löst avstånd, därefter exakt 500 mm; efter bekräftelse återstod bara linjelängden. I Single Part valdes en linje i vy 1:10 med 1 420,4 mm. DOM-mätning före/efter zoom visade 11 skärmpixlar och oförändrat måttvärde. Ingen extra inspektorkontroll tillkom och browsern rapporterade inga fel. PDF-byggaren producerade länken Hämta PDF; den nedladdade filen granskades inte i den här kontrollen. Full regression: 931 tester passerade.

## Linjära HUD:ar — kontroll 2026-10-12

Befintliga placeringsscenarier kompletterades med giltiga/ogiltiga vektorer, bevarade avstängda axlar, isolerade stapelutkast, nollvektor, picker utan commit, upprepad kopiering för aktuell markering samt Ångra. Pointer- och tangentbordsrouting skyddar mot oavsiktlig commit och mot att canvasinmatning aktiverar det vanliga längdfältet. Centrala modellflöden, full regression (935 scenarier), lint och produktionsbygge passerade.

I det separata localhost-testprojektet kontrollerades två staplade HUD:ar, numerisk preview, urkopplad Y, exakt XYZ efter flytt, kopia med egen identitet och Y-offset, Ångra, picker på verkliga sweepändpunkter, Esc från fält, stängning av inaktiv rad och bibehållna värden. Teständringarna ångrades. Slutbilden visar två 331 × 38 px rader med fri vyindikator i en smal arbetsyta. Ingen publicering ingår.

## Genomgång av modellens arbetsflöden — 2026-10-12

Sweep, Polysweep och Plate kontrollerades i det separata localhost-testprojektet: fysisk klickmarkering, tomt klick, rektangelurval av fyra objekt, Esc, blandad Sweep/Polysweep-inspektor, profilrotation och Ångra, punktflerval, ogiltig/giltig gemensam radie, Återställ och Ångra. Backspace följt av X-lås och exakt 500 mm kontrollerades under Polysweep-skapande utan att spara utkastet. På en tillfällig XZ-plåt reproducerades felet vid diagonal hörnflytt och verifierades rättningen med förändrade U/V och en enda ångringspost. Testplåten togs bort; modellens fem ursprungliga objekt behölls. Webbläsaren rapporterade inga fel.

Rättningarna skyddas av berörda befintliga scenarier och fyra konkreta tillägg: Polysweep-kedja efter Backspace; pluskontroller som annars träffar riktiga hörn vid låg zoom/vertikala segment; diagonal snap i plåtplanet utan snap till en punkt utanför planet; native griptransaktion och Ångra. Punktinspektorns befintliga controllertest omfattar också Esc från fältet. Centrala modellflöden (152 scenarier) och berörda plan-/plåtspecialister passerade. Ingen ny testsvit för CSS eller källtext lades till.

## Standardiserade kopplingar — 2026-10-12

Det befintliga inspektortestet omfattar alla sex placeringssessioner med riktiga referensobjekt, resolver, genererade delar, modell-editor och projektets historik. Referensval och preview får inte ändra projekt/historik; explicit bekräftelse ger en ångringspost och Ångra återställer ursprungsobjekten. Dubbletter, fel objekttyp och otillåten avstyvningsprofil lämnar sessionen orörd. Ett parameterberoendescenario verifierar fristående skruv- och längdsnapshots samt hål-/brickval. Befintliga schema-/kopierings-/geometritester kontrollerar att alla parametrar finns exakt en gång och att kopierade egenskaper behåller målets referenser och identitet.

Browserkontrollen kördes på separat port 5174 med sju testprofiler och ett importerat testskruvbibliotek. Alla sex typer kontrollerades med referensval, preview, Skapa/Enter och Ångra. Fit stannade vid sju objekt efter två klick, skapade sitt åttonde objekt först vid bekräftelse och återställdes med Ångra. Ogiltig spalt, Återställ, fel balkände med efterföljande rättning, bibliotek öppnat från kopplingsfältet, Avancerat, plåttjocklek/hål, avstyvningens andra punkt och modellens genererade delar kontrollerades. Två ändplåtar användes för modifiering och egenskapskopiering av tjocklek 24 mm med ett ångringssteg. Testunderlaget återställdes; sista osparade Balkskarv-previewn avslutades med Esc och lämnade sju objekt kvar. Inga browserfel rapporterades; geometribibliotekets befintliga BVH-deprecationsvarning förekom.

Centrala modellflöden (160 scenarier) och samtliga berörda kopplingsspecialister (86 scenarier) passerade. Inspektorns kopplingsflöde ingår nu i det centrala urvalet. Lint och formatering passerade. Ingen publicering ingår.

Planöverföring skyddas i `model-placement.test.js`: sexpunktsval och hoverpreview utan commit, degenererade/icke-finita plan, omval/Backspace/Esc, rigid rotation plus translation utan skalning, kopieidentitet, plåtradier och blockram samt en transaktion och ångring. Webbläsarkontroll i separat localhost-testprojekt verifierar snappade hjälppunkter på både XY- och vertikalt målplan, bibehållen balklängd, Flytta/Enter, Kopiera/bock, ångring och gemensam HUD-stapel.

`work-area.test.js` verifierar motstående XY-hörn med ignorerad klickhöjd, absoluta och signerade plushöjder, degenererad rektangel, tvåpunkts-preview utan commit, en checkpoint/ångring, sparad filvalidering, expansionsunion, klippt snap och rektangelmarkering, referensdelars gallring med bevarad full utbredning/CAD-lager samt kompletta assembly- och blockurval. Befintliga referens-, snap-, markerings- och modellflöden behålls.

Webbläsarkontroll i separat localhost-projekt: standardfliken i Settings och felaktig höjdordning, två hörn och Enter, modellklippning/Zoom Extents, IFC-import utanför boxen, Behåll/Utöka vid tändning, referensflytt med expansionsfråga och ångring, återöppning samt klippning av en stomfixture med 461 objekt inklusive instansrendering. Detta är en funktionskontroll, inte ett prestandamått.

2026-10-14: arbetsområdets befintliga tester kompletterades för inpassning till full utbredning, inklusive ett klippt modellobjekt och komplett referensbox, med en ångringspost och återställda höjder. Separat browserprojekt verifierade toppmenyns trepunktsplan, Mot planet, Återställ, två motstående hörn/Enter, Anpassa till allt och Plushöjder till rätt inställningsflik. Inga browserfel. Centrala modellflöden, specialisttest för arbetsområde, lint och produktionsbygge kontrollerades.

Arbetsplansguidens geometritest kontrollerar bibehållen skärmstorlek vid zoom, kameravända axelbokstäver, oförändrat referensplan och frigöring av ersatta geometribuffertar. Browserkontroll i separat testprojekt: trepunktsplan och X/Y/Z-pilar med aktiv klippbox, vy mot planet, återställning och inga renderfel. Klippningen påverkar modellgeometrin men inte arbetsplanets navigationsindikator.

2026-10-15: Item-snabbvalet verifierades i separat browserprojekt med befintligt biblioteksitem: byte via träd och Ångra, mappar som fälls ihop/ut, bevarade grenar efter Esc och återöppning med ArrowDown, sökning på flera ord, val som startar normal placering, skapande i två punkter och Ångra samt öppning av det fulla biblioteket från länken under väljaren. Ett beteendescenario i `items.test.js` skyddar gemensam senaste-revision-/favorit-/sökhierarki och att trädbyggandet inte ändrar biblioteket.

2026-10-15: gemensamma skapa/redigera-fält kontrollerades i separat browserprojekt för Item, Sweep, Plate och Polysweep. Namn, partprefix och startnummer följde med placeringen till det sparade objektet; startnummer 0 avvisades utan historikpost. Profilnamn kunde ändras och ångras, och Escape återställde en obekräftad namnändring. Polysweeps materialfält var aktivt under placering. `inspector-attributes.test.js` skyddar gemensamt lägesval, att andra verktyg inte tolkas som skapande, fristående attribut och oförändrad Item-geometri. Ett nytt modell-/historikscenario verifierar atomiskt skapande med attribut, ogiltig serie före commit, efterföljande redigering utan läckande skapandeförval och Ångra.

## Koordinater och flera baspunkter — 2026-10-15

`coordinates.test.js` ingår i modellens centrala urval. Scenarierna skyddar framåt-/inversomvandling med stora E/N-koordinater, signerade höjder, olika lokala ankare och rotationer; ogiltiga/dubbla identiteter/namn; mm/m och svensk decimalinmatning inklusive Unicode-minus; referensens analytiska axlar och manuella flytt/rotation; lokalt undantag, utbredning och vanlig referenssnap efter baspunktsbyte; projektsparning och Ångra/Gör om; samt en riktig web-ifc-läsning av IFC4 med MapConversion, kartmeter och modellmillimeter. Punktvalets klick-, tangentbords- och avbrottsrouting testas utan modelltransaktion.

Webbläsarkontroll sker i separat localhost-projekt: skapa och namnge två baspunkter, bevara båda vid byte, aktivt val, spara/återöppna, punktval och Escape tillbaka till samma utkast. En syntetisk georefererad IFC med 15° rotation och E/N/H importerades genom den riktiga workern. Befintlig snap från baspunktspickern gav exakt lokal hörnpunkt 900/1800/3600 mm. Byte till andra baspunkten använde arbetsområdets befintliga expansionsfråga och Ångra återställde den första. Detta är funktionskontroll med små fixturer, inte prestandabevis för stora georefererade modeller.

Avslutande browserkontroll omfattade också lokalt referensläge och Ångra med bibehållen aktiv baspunkt, ogiltig koordinattext före commit, borttagning av en inaktiv baspunkt och Ångra samt sparning av en verklig projektfil och återöppning via Arkiv. Filvalideringen bekräftade två baspunkter, aktiv Hus A, EPSG:3006 och referensens källgeoreferering. Inga browserfel rapporterades. Full regression (961 scenarier), lint, formatering och produktionsbygge passerade.

## IFC4-export — 2026-10-15

`ifc-export.test.js` ingår i modellens centrala urval. Samma lilla fixtur innehåller kapad Sweep, cirkulär rörpelare med vriden/förskjuten insättning, rundad plåt med hål, Polysweep, två vridna Items som delar definition, skruv, material och numrerade assemblies. Exporterna läses med riktiga web-ifc: klasser, märken, relationer, material, arbets-RGB/objektfärg, delarnas utbredning, delad representation map utan föräldralösa produktformer och georeferering verifieras. Repetition efter filåterläsning, ändrad geometri och omordning behåller GlobalId; olika förekomster får olika ID. Urval, slutgeometri, avstängda egenskaper/material/assemblies, ogiltig geometri, inaktuell numrering och IFC-klassens draft/commit/Ångra omfattas. Befintligt förbandsexempel skyddar att riktiga kopplade borrhål finns kvar när skruvar utelämnas.

`scripts/validate-ifc-export.py <fil.ifc>` ger oberoende kontroll med IfcOpenShell: IFC-schema, EXPRESS-regler och geometriläsning för samtliga produkter med representation. QA-miljön behöver `ifcopenshell` och `pytest`; dessa är inte produktberoenden. På den exporterade fixturen gav IfcOpenShell 0 schema-/EXPRESS-fel och läsbar geometri för alla 7 delar. Volymen för kapad balk, plåt med hål, Polysweep, Items och skruv stämde med modellens utvärderade geometri. Cirkelprofilen är analytisk i IFC; den oberoende läsarens standardtessellering avvek cirka 0,2 % i beräknad volym från modellens tessellering. Detta är ingen certifiering för MVD eller verifiering i Tekla/Revit.

Separat browserprojekt: öppna fixtur, ändra IFC-klass och Ångra, skapa med vald klass och Ångra, öppna Arkiv-export, kontroll/anmärkningslista, skruvval, georefererad nedladdning och återimport med samma baspunkt. Den nedladdade filens 7 delar, material, märken och assemblyrelationer kontrollerades också oberoende. Tomt markeringsurval gav exportblockering; inställningsfliken och val av slutgeometri behöll dialogramen. Referensen fördubblade inte antalet exporterade delar. Importerade referenser ligger utanför exportens ögonblicksbild.

En kall Node-körning med den befintliga lilla stomfixturen (461 modellobjekt, skruvar undantagna från export) gav 182 delar, 182 assemblies, inga blockerande fel och cirka 34,1 MB på cirka 12 s. IfcOpenShell verifierade alla 182 produktgeometrier med 0 schema-/EXPRESS-fel och 0 geometrifel. Kontrollen hittade först CSG-resttrianglar i två borrade balkar som inte kunde läsas. Exportadaptern svetsar nu meshkoordinater och rensar resttrianglar på 0,0001 mm tolerans. Ett regressionstest på den verkliga problembalken skyddar läsbara ytor, bevarad volym (relativ avvikelse under 0,001 %) och utbredning (under 0,001 mm).

Den stora filen beror på slutgeometri med många borrhål; detta är ett exempel, ingen generell prestandagaranti. Exportdialogen startar därför inte en fullmodellskontroll bara för att den öppnas. Användaren väljer innehåll före Kontrollera/Exportera. Beräkningen kan avbrytas och UI-arbetet ligger utanför workern. Slutkontroll: 967 regressionstester, lint, formatering och produktionsbygge passerade. Den senaste browsernedladdningen verifierades separat med 7 läsbara produktgeometrier och 0 schema-/EXPRESS-fel.

## Referensmarkering och manuellt profilval — 2026-10-15

Befintliga referensscenarier täcker nu helreferens-/objektläge, samma raycast, återställd färg vid lägesbyte och avmarkering, CAD-material utan emissive, dolda referenser och att ett valt IFC-objekt inte aktiverar flytt av hela filen. Konverteringsscenariot omfattar geometrisk identifiering av IPE och en hålprofil, manuellt byte till HEA 220 på fristående utkast, bevarad axel/rotation/källidentitet, validering och en enda modell-editortransaktion med Ångra. Tidigare scenarier skyddar fortfarande att profilnamn/yttermått ensamma inte ger en falsk profilmatchning.

Separat localhost-projekt med två importerade balkar (HEA 200 och IPE 200): båda markerades i helreferensläge, bara en i objektläge. Högerklick öppnade samma konvertering med korrekt profilförslag. Snabblistans sökning/filträd ändrade profil till HEA 220; det fulla profilbiblioteket ändrade utkastet till HEA 240. Avbryt behöll 0 modellobjekt. Bekräftad IPE→HEA-konvertering visade HEA 220 i inspektorn och projektfilens nedladdningsinnehåll, med oförändrad axel [0, 2000, 0]–[5000, 2000, 0] (numeriskt Z-brus under 10⁻¹² mm), bevarad IFC-källidentitet och kvarvarande referens. Ångra återställde 0 modellobjekt. Esc och tomt klick avmarkerade; switchens 36 × 36 px och position var identiska i båda lägena. Inga browserfel. Full regression: 969 tester; lint, formatering och produktionsbygge passerade. Ingen publicering ingick.

## Evidensbaserad profilmatchning — 2026-10-15

`profile-match.test.js` ingår i modellens centrala urval. Nio små metadataexempel från Revit och ett anonymiserat IFC2x3-utdrag skyddar HEA-mått/radier, UPE-namn, VKR/KKR-alias, roterade rektanglar, saknad limträdimension, tvetydiga rörserier, typ- och egenskapskopplingar samt mappade/kapade representationer. Tester skyddar också senaste revision, materialavgränsning, motstridiga godstjocklekar, ofullständiga mått, namn utan geometristöd, mm/m och egenskaper som motsäger profildefinitionen. Verklig web-ifc-tessellering av Revit-HEA 180 ger nu en verifierad biblioteksprofil trots förenklade rundningar; enbart namn får inte utnyttja denna radiebaserade tolerans. Material eller hållfasthetsklass tilldelas inte av matchningen.

Slutkontroll: 975 regressionstester, lint, formatering och produktionsbygge passerade. Hela K-20-V-01.ifc importerades i ett separat browserprojekt utan browserfel. Det anonymiserade HEA-utdraget visade verifierad HEA 180 och anmärkning om förenklad tessellering; manuellt byte till HEA 200, Konvertera, Ångra och Gör om kontrollerades i den vanliga inspektorn. Rörutdraget RO101.6x5 visade CHS/KCKR som alternativa serier och behöll IFC-konturen automatiskt. Den rena metadataanalysen av filens 691 balkar/pelare/stänger gav 398 verifierade, 194 troliga, 4 tvetydiga och 95 utan förslag mot det inbyggda biblioteket. Detta är **inte** konverteringsstatistik eller en granskning av varje objekts slutgeometri. Ingen publicering ingick.

## IFC-geometrikonvertering — 2026-10-15

`reference-conversion.test.js` omfattar nu tre anonymiserade meshutdrag från Revit: rundad UPE, mappad hålprofil och snedkapad I-profil. De provas vid tre generiska placeringar, även cirka 140–158 m från origo. Tester jämför källans och modellens utbredning/volym samt avstånd i båda riktningar mellan meshytorna, med alla trianglars hörn och tyngdpunkter som provpunkter (under 0,05 mm). Originalmesh och konverteringsutkast förblir oförändrade. Separata beteenden skyddar en transaktion för del + kapningar, korrekta mål-ID:n, spara/öppna, Ångra/Gör om, manuellt profilval samt vanliga Move/Copy/Rotate med kapningarna. Avsmalnande och öppna solider avvisas.

`scripts/analyze-ifc-conversion.mjs` kör samma importerade geometri med tom profilkatalog, faktiska världstransformer och modellens riktiga CSG. K-20-V-01.ifc gav 661 av 691 godkända objekt, varav 24 med ändkapningar, jämfört med 455 före ändringen. Alla godkända resultat klarade kontroll av utbredning och volym inklusive den dokumenterade Float32-budgeten. Återstående 30 är uttryckligen avvisade, inte approximerade. Detta verifierar konvertering mot web-ifc-meshen, inte IFC-läsarens tessellering mot originalet i Revit. Detaljer finns i `docs/ifc-conversion.md`.

Browserkontroll i separat localhost-projekt: import av ett snedkapat Revit-utdrag genom den riktiga IFC-workern, objektval, högerklick → Konvertera, verifierad HEA 300, en Sweep med två namngivna Linecut-relationer, Ångra till 6 ursprungliga stomlinjer och Gör om till 9 objekt. Linjär Flytta 500 mm via befintlig HUD bekräftades. Projektfilen skapades genom Spara som, validerades med projektets filvalidator och återöppnades via Arkiv med båda kapningarnas målrelationer kvar. Inga browserfel rapporterades. Full regression, lint, formatering och produktionsbygge passerade.

## Greppurval, dragning och Move — 2026-10-15

Befintliga `grips`, `polysweep`, `model-placement` och `model-selection-controller` skyddar nu grepp på fler än fyra objekt, separat Alt-ruta med Shift/toggle, giltiga och inaktuella punktreferenser, gemensam förflyttning från godtycklig baspunkt utan att ändpunkter kollapsar, blandade punkttyper och bevarade radier. Helt markerad plåt flyttas genom sin frame; partiella hörn begränsas till planet. Placeringstestet kör verklig modell-editor, preview och historik: Move och samma linjära HUD förlänger valda ändpunkter, lämnar övriga punkter orörda och gör en checkpoint per bekräftelse. Ogiltig förkortning avvisas före projekt/historikändring.

`grip-interaction.test.js` kör händelseägaren med uttryckliga adaptrar: enkelklick kontra dragtröskel, snabb release före första pointermove, exakt en commit vid släpp, annan pointer, Alt-routing till gemensam ruta samt avbrott vid Esc, captureförlust, blur och släpp utanför canvas. Testet ingår i det centrala urvalet. Det tidigare dubbelklickstestet har ersatts med det nya punkturvalets beteende.

Browserkontroll i separat projekt med två Sweeps, Polysweep, Plate, hjälplinje och hjälppunkt: sex objekt visar grepp, enkelklick väljer punkt, Polysweep-punkt kan dras, Alt-klick väljer ändpunkter på olika balkar, vanlig Move väljer bas- och målpunkt, Flytta linjärt lägger till exakt 250 i Y och Ångra/Gör om fungerar. Projektfilen från Spara som bekräftade identisk förflyttning för de två valda ändpunkterna, oförändrade startpunkter och oförändrade övriga objekt; bara den tidigare dragna Polysweep-punkten hade ändrats där. Inga browserfel. Alt-rektangelns händelseflöde verifieras i controller-/domäntesterna; browserkontrollen av modifieraren använde Alt-klick.

## Ritningsnummer från part-/assemblymark — 2026-10-15

Befintliga numreringsscenarier skyddar nu både namn och nummer vid skapande, delning, sammanslagning och omnumrering. Spara/öppna och Ångra/Gör om behåller märkena; PDF-filnamnet använder samma nummer. Single Part-numret kan inte längre skrivas över manuellt eller få ett fristående kopienummer. GA:s kopiering och fria namn behålls.

Separat browserprojekt med P100 och A200: en Single Part-post med SP-001/avvikande namn återöppnades med P100 i båda kolumnerna. Båda ritningarna öppnades och visade enbart respektive mark i editorns rubrik. Inga browserfel. Centrala modellflöden, berörda numrerings-/ritningsspecialister och lint passerade.

## Byt part-/assemblymark — 2026-10-15

`mark-change.test.js` ingår i det centrala urvalet. Det skyddar fristående förhandsgranskning, hela typens förekomster, upptagna/ogiltiga märken, inaktuell projektstämpel och no-op utan transaktion. Partbyte för över assemblynycklar och medlemstokens utan att ändra assemblynummer, ritnings-ID, vyer, annoteringar eller revisioner. Manuell reservation följer normal och full omnumrering, även när andra part marks ändras, samt projektfil och Ångra/Gör om. En annan typ får inte ta en manuell reservation från en oförändrad ägare. PDF-filnamnet följer ritningsnumret.

Separat browserprojekt med tre balkar och fyra ritningar: Byt partmark visade två förekomster; P101 blockerades som upptagen och P100→P150 bekräftades. Ångra/Gör om, assemblyns bibehållna giltighet, A200→A250 för två assemblies samt Esc utan commit kontrollerades. Vanlig och full numreringspreview behöll de manuella märkena. Ritningslistan följde båda bytena och assemblybladet visade A250, P150 i stycklistan och totalantal 2. Spara som och återöppning behöll båda märkena. Inga browserfel. Full `npm run check` passerade. Ingen publicering ingick.

## Bevarad numrering efter bearbetning — 2026-10-15

`numbering-retention.test.js` ingår i centrala arbetsflöden. Samma verkliga numrerings-/ritningsplan verifierar längdändring, polygoncut och länkade skruvhål på ensam sweep, samtliga identiska förekomster och delurval i båda objektordningarna. Registerägarskap, part-/assemblygiltighet, ursprungliga ritnings-ID:n, annoteringar, revision, skala, granskningsflagga, PDF-filnamn, filåterläsning, repeterad numrering utan ändring samt Ångra/Gör om kontrolleras. Övriga scenarier täcker majoritetsgren när allt ändras olika, samtidiga delningar/sammanslagningar, uttryckligt ritningsval vid sammanfogning, ändrad serie, nya-nummer-policy, manuella märken, borttagen ägare och relativ ändring inne i flerdelsassemblies. Det tidigare scenariot som krävde ny mark även när alla manuellt numrerade förekomster ändrats har ersatts med oförändrad ägares företräde vid en verklig delning.

Browserkontroll på separat localhost-projekt: en numrerad sweep med SP-/AS-ritningar kapades med befintligt Linecut-verktyg (två punkter, skärsida och bekräftelse). Numreringspreview visade P100→P100 och A200→A200 med ändrade typer. Tilldela behöll de två ritningarna och gav Kontrollera ritning; P100-bladet öppnades med kapad geometri. Testerna verifierar också att ritningsinnehållet bevaras; browserprojektet använde enkla standardblad.

Slutkontroll: den verkliga projektfilen från browserns Spara som lästes med projektvalidatorn. Den innehöll Linecut med rätt mål, P100/A200, samma ritnings-ID:n som före kapningen och båda granskningsflaggorna. Upprepad numrering behöll märkena. Inga browserfel rapporterades. Full `npm run check` med regression, lint, formatering och produktionsbygge passerade. Ingen publicering ingick.

## Stabilitetsgranskning av part-/assemblynumrering — 2026-10-15

Reproducerade och rättade brister:

- Tre detaljtyper med mått 100 / 101,6 / 103,2 och tolerans 1 kunde vid omordning få en ogiltig gemensam mark. Jämförelsen använder profilkonturens koordinater (halva breddskillnaden i detta exempel). Samma risk fanns vid assemblytolerans. Gruppering och registermatchning kontrollerar nu den verkliga representanten och samtliga medlemmar.
- Gemensamma part-/assemblyprefix och befintliga GA-nummer kunde ge nummerkollisioner eller blockera skapande av assemblyritning. Båda områdena samt kvarvarande ritningar reserveras före tilldelning.
- Ett kvarvarande SP-blad vars källa tagits bort kunde förlora sitt nummer till en annan typ vid återanvändning. Ritningen behåller nu reservationen.
- Ett markbyte som återbildar en historisk assemblynyckel kunde ge två registerägare för samma nyckel. Den aktiva ägaren prioriteras och registret förblir entydigt.
- Dialogen kunde använda datorns förval från ett annat projekt i stället för projektets tolerans, samt återaktivera full omnumrering. Projektregler används nu vid öppning; omnumrering är ett engångsval.

`numbering-stability.test.js` ingår i centrala arbetsflöden och skyddar ovanstående samt felaktiga register/tilldelningar och sparade regler. Sex fasta slumpfrön kör 60 ändringssteg vardera (360 steg totalt) på åtta delar. Varje steg varierar geometri, material, serie, återanvändning och modifieringspolicy och verifierar giltig part-/assemblynumrering, unikt registerägarskap, ritningsnummer/-namn, bevarat ritningsinnehåll, oförändrad upprepning och omordning. Projektfiler läses åter under sekvenserna. Befintliga bearbetnings-, delnings-, sammanslagnings-, historik- och ritningsscenarier behålls.

En separat körning på appens syntetiska lilla stomexempel (461 objekt, 454 fysiska delar, 9 parttyper och 9 assemblytyper) verifierade numrering, giltighet, upprepning, omordning och projektfil. Cirka 540 ms sammanlagt i denna Node-körning är ett exempel, inte en generell prestandagaranti.

Browserkontroll på separat localhost-projekt reproducerade även felet med datorns toleransförval. Efter rättning gav återöppnad och omordnad toleransmodell 0 nya / 0 ändrade / 6 oförändrade; bekräftelse skapade ingen ångringspost. Byte till ett annat projekt behöll dess regler. GA P100, Single Part P101/P102 och Assembly P103/P104 visades som fem separata ritningar utan kollision. Inga browserfel. Full `npm run check` med formatering, lint, regression och produktionsbygge passerade.

Detta är kontrollerad regression och syntetiska projektsekvenser. Granskningen är inte en jämförande certifiering mot Tekla eller en verifiering mot många verkliga produktionsprojekt. Ingen publicering ingick.

### Nearest och vinkelrät i modell och ritning

2026-10-15: riktade geometriprov kontrollerar ändliga native-kanter,
IFC-referenskanter, av/på-val, prioritet för exakta punkter, arbetsplan/axellås,
indexerad kontra full snapsökning och perspektivkorrekt punkt på en 3D-kant.
Ritningsflödet kontrollerar raka ritobjekt/modellkonturer, analytiska cirklar och
ändliga bågar samt att Move inte snappar tillbaka till den egna källgeometrin.
Copy får fortsatt snappa mot originalet. Kärntester och full `npm run check`
(formatering, lint, regression, bygge) har körts.

I separat lokalt webbläsarprojekt kontrollerades Nearest på modellkant och
linjeplacering mot motsatt kant. På Single Part, Assembly och GA placerades en
linjes start med Nearest på modellkonturen och slutpunkten vinkelrätt på motsatt
kant: ritningens koordinatfält behöll samma X medan Y gick från +200 till −200.
Befintlig kantsymbol och rätvinkelsymbol används utan text vid markören.
Modellens nya kryssruta och ritningens val under Snappunkter kontrollerades.
Inga konsolfel rapporterades. Detta är funktionsprov i ett litet syntetiskt
projekt; det ersätter inte ett prestandaprov med en stor IFC-referens.

### Prestandajämförelse för referenssnap

2026-10-15: `node scripts/benchmark-reference-snap.mjs` jämför uttömmande och
indexerad sökning på samma deterministiska positioner. `--large` ökar från
20 × 1 000 till 100 × 1 000 syntetiska referensdelar. Varje box har 12 feature-
kanter. Alla fyra kombinationer av Nearest/Vinkelrät körs med hörnsnap på,
uppvärmning per kombination och både utspridda och helt överlappande referenser.
Varje kombination har 240 positioner; valt snapresultat måste vara identiskt
före/efter. Tiderna omfattar `ReferenceModels.candidates` och `resolveSnap`,
inte IFC-läsning, verklig rendering eller DOM.

I det överlappande provet gav båda snapparna på följande modell-p95:
20 000 delar: 3,82 → 0,33 ms; 100 000 delar: 25,04 → 1,78 ms.
Efter optimeringen, båda av/på: 20 000 delar 0,14/0,33 ms,
100 000 delar 0,85/1,78 ms. Ritningens befintliga referensindex och hela
`locateDrawingPoint` kördes med samma geometri; båda på gav p95 0,03 respektive
0,30 ms. Det syntetiska ritningsprovet innehåller överlappande rektangelkonturer,
inte en komplex IFC-snittprojektion. Uppvärmning, GC och körordning påverkar
enskilda värden; små skillnader mellan av/på ska inte tolkas som förbättringar.

`?referenceSnapPerformance=1` aktiverar ett uttryckligt utvecklingstest i en
separat flik. Det kör samma arbetslast (120 positioner) och även appens riktiga
modellpunktval med overlayns DOM-uppdateringar. Syntetiska referenser används
bara synkront under respektive mätning och skrivs aldrig till projekt/lagring.
Projektobjekt, kameran, snapinställningar, baspunkt och referenser återställs.
Webbläsarens överlappande 20 000-prov gav punktval+overlay p95 4,5 → 1,0 ms
med båda snapparna på, jämfört med 0,8 ms efter optimeringen med båda av.
Det inkluderar inte efterföljande layout/paint, preview, GPU, eventkö eller
fysisk musfördröjning; alla 20 000 syntetiska delar renderades inte.

Beteendetester jämför kandidater med uttömmande sökning vid ortografisk och
perspektivkamera, ändrad placering/rotation/skala, synlighet och arbetsområde.
Ett strukturellt prov kontrollerar att en lokal fråga prövar färre än 100 av
1 000 objektgränser och att indexet återanvänds/ersätts med referensens objektlista.
Befintliga import-, återställnings-, borttagnings- och ersättningsprov körs också.

Vanlig webbläsarimport kontrollerades dessutom med en syntetisk IFC om 1 000
verkligt importerade delar (boxar och runda extruderingar). Workerimporten
slutfördes, referensen visades och en native musdragning med profilverktyget
fångade IFC-snappunkter. Inga konsolfel rapporterades. En sista snapmätning på
0,3 ms observerades under dragningen, men det enskilda värdet är inget
percentilmått. Testreferensen togs bort efter kontrollen. Full `npm run check`
passerade efter produktionsändringen.

### Polysweep: flera radiegrepp och insättning

2026-10-15 rättades spärren som gjorde radiefältet inaktivt när ett urval även
innehöll en ändpunkt eller annat grepp utan hörnradie. Domän- och controllerprov
kontrollerar gemensam radie för blandade Plate-/Polysweep-hörn och ändpunkter,
att andra grepp lämnas orörda, atomiskt avvisad ogiltig batch, oförändrat projekt
under preview, en checkpoint vid Modifiera samt Ångra/Gör om.

Ett formulärprov använder den riktiga sweep-formens 3×3-knapp och modell-editorn:
R60 med 100 mm profil tillåter centrum men avvisar en insättning som kollapsar
innerbågen. Knapp/insättningssammanfattning återgår till centrum, felmeddelandet
behålls och ingen historik skapas. R300 tillåter samma byte; punkter och radier
bevaras och save/load samt Ångra kontrolleras.

Separat webbläsarprojekt med två rundade hörn: alla fyra grepp, inklusive båda
ändpunkter, markerades och hörnradier ändrades gemensamt. Modifiera och Ångra
kontrollerades. Efter R60→R300 ändrades 3×3-insättningen till Höger/uppe och
ett rundat hörn flyttades med native drag. Den nedladdningsbara projektlänkens
faktiska JSON kontrollerades: endast punkt 1 flyttad, radier [0,300,300,0],
insättning right/top. Ett avvisat R60-insättningsval verifierades också i UI.
Inga konsolfel rapporterades. Full `npm run check` passerade.

## Skruvinspektorns ändringsflöden

`fastener-edit.test.js` kör den gemensamma utkastberedningen med verklig materialträff och längdberäkning: andra muttern, ändrad skruvdiameter med bibehållet hålspel, ändrat hålspel, nya delningar och borttagna gruppceller. Modell-editor och projekthistorik verifierar atomisk bekräftelse, avvisad placering utan checkpoint, ångra/gör om och omräkning när plåttjocklek/placering ändras. Rutnät, cirkel och fria mönster valideras och sparas/läses tillbaka. Vändning bevarar positioner och borridentiteter även för roterade grupper. Enbart hål behåller borrning utan skruvsolid. För kort manuell längd ger numera en icke-blockerande förbandsvarning, se nedan. De tidigare specialisttesterna för skruvar, förband, gruppkopiering, hålgeometri och kopplingar körs också.

Webbläsarkontroll 2026-10-15 i separat localhost-projekt med två plåtar och testbibliotek: M24 → M20, andra mutter, ändrade delningar, hålspel 2 → 4, manuell för kort längd och återgång till Auto, rutnät → cirkel → fritt samt ångra. En ny skruv placerades med ordinarie punktval och Z-lås. Vändning samt enbart hål och återgång till komplett förband kontrollerades. Exporterade projektdata bekräftade skruvlängder, diametrar, tillbehör och oförändrade borr-ID:n vid vändning; exakt bearbetad geometri var ändlig och gav rätt antal kopplade hål. Kontroll gjordes också av layouten i ordinarie panelbredd och manuellt längdläge. Inga fel rapporterades i den avslutande webbläsarkörningen. `npm run check` passerade. `model-placement.test.js` skyddar att ogiltiga skruvinställningar blockerar punktbekräftelse i stället för att placera det senaste giltiga utkastet.

### Skruvar utanför delarna

`fastener-edit.test.js` verifierar att enskilda skruvar och grupper kan skapas utanför delarna och flyttas in, ut och in igen genom modell-editorn. Hål är inaktiva utanför och återaktiveras med samma identiteter vid materialträff. Ångra/gör om och projektfil skyddar att gamla borrningar inte blir kvar. Befintliga scenarier för materialträff, längd, ogiltiga mönster och hål körs också. Webbläsarprov: linjär flytt utanför plåt, greppdragning tillbaka in samt gruppflytt ut och in. Den sparade projektfilen bekräftade återaktiverad borrning efter greppdragningen. `npm run check` passerade.

### Angiven skruvlängd och utstick före — 2026-10-16

Befintliga skruv-, grupp- och förbandsflöden verifierar nu bibehållen längd när muttrar, hål eller måldelars tjocklek ändras. `fastener-assembly` skyddar fristående instansmått, oförändrat bibliotek, hel-/delgängning, kort skaft, exakt stångutstick och varning som försvinner efter rättning. Bibliotekets egna ogiltiga produktmått avvisas fortsatt. `fastener-edit` kör en 103 mm grupp genom modell-editor, borridentiteter, en checkpoint, ångra/gör om och projektfil. Tester för kopplingarnas separata längdserieberäkning behålls.

Browserprov i separat lokalt projekt: gruppens längd 53 med andra mutter kunde bekräftas trots varning; ångra/gör om och rättning till 103 kontrollerades. Alla åtta sparade skruvar hade längd och helgängning 103 samt båda borrrelationerna. Stångens längd 217 och utstick 5 behölls med varning; rättning till 30 tog bort varningen. Ny skruv med längd 113 skapades med vanligt punktval och Z-lås. Ordinarie panelbredd kontrollerades med gemensamma längd-/utsticksfält. Full regression, lint, formatering och produktionsbygge passerade. Ingen publicering ingick.

### Orbitcentrum på IFC — 2026-10-16

`model-navigation.test.js` kör verklig raycast genom modellens punktcontroller och referenshanterare: närmaste egna/referensyta, omplacerad och roterad referens, referens-/objektläge, placeringslåsning, dold del/referens/grupp, arbetsområdesklippning, tom träff, panorering och touch. Befintliga navigationstester skyddar oförändrad skärmbild när centrum flyttas.

Browserprov med två balkar importerade genom den riktiga IFC-läsaren: Ctrl + mittenknapp gav referensytan som orbitcentrum i båda markeringslägena. Dold referens gav ingen träff. Tillfällig loggning av träffvalet togs bort efter kontrollen. Full `npm run check` passerade; ingen publicering ingick.

### Snapprioritet i modell och ritning — 2026-10-16

Befintliga snap-/ritningsscenarier kompletterades för IFC-kant mot Polar, Nearests 5 px-gräns, Otrack + Polar som exakt tänkt hörn, oförändrade Otrack-ankare efter lång Nearest-hovring, högre prioritet för verkliga punkter samt Ortho. Retentionsprov flyttar mellan närliggande ändpunkter, tar bort geometrin och kontrollerar att en högre prioritetsnivå omedelbart tar över. Hålcentrum behåller sin referens vid sammanfallande projicerad skruvaxel.

`reference-snap-index.test.js` läser den befintliga IFC-fixturen med web-ifc, bygger samma transformerade mesh och featurekanter som importeraren och kör dem genom både `referenceCandidates`/`resolveSnap` och ritningens `locateDrawingPoint`. Verklig tessellerad IFC-kant ger Nearest utan spårning, Polar när den är aktiv och Otrack/Polar-skärning vid förvärvat ankare.

Browserprov i separat lokalt projekt: återställd IFC med två balkar, hjälplinjens Polar 45° intill referenskant samt GA:s Polar-återkoppling med Otrack aktiverat. Ingen ny text vid snapmarkören infördes. Referensbenchmark med 20 000 syntetiska delar kontrollerade identiskt resultat för indexerad och full sökning i alla fyra kombinationer av Nearest/vinkelrät; överlappande modell med båda på gav p95 cirka 0,39 ms. Detta är CPU-sökning, inte IFC-laddning, rendering eller fysisk musfördröjning. Full `npm run check` passerade. Ingen publicering ingick.

### Kantmarkering i transparent visning — 2026-10-16

`model-selection-hit.test.js` ingår i kärnflödet och kör riktiga Three-meshar genom gemensam visningsträff, modellens punktcontroller, referenshanterare och hovercontroller. Det skyddar kantens 6 px-gräns i ortografisk/perspektivkamera vid två zoomnivåer, genomsläpp på transparent yta, oförändrad homogen ytmarkering, frånvaro av triangeldiagonalträffar, skärmavstånd/djup, tät ocklusion, arbetsområde, transformation, instansägarskap, cacheinvalidation och klippning vid kamerans närplan. IFC:s referens-/objektläge använder samma träff; hover återställer färg och orbit träffar fortsatt transparenta ytor. Befintliga navigations-, referenslivscykel- och snapscenarier behålls.

Browserprov i separat localhost-projekt: importerad IFC med två balkar zoomades in så att yta/kant kunde skiljas. Transparent balkmitt gav ingen markering, kant gav rätt IFC-ID och aktiverad konvertering. Hela referensen kunde väljas på kanten och avmarkeras via ytan. Homogen IFC kunde väljas på ytan. Separat plåtprojekt verifierade samma mitt-/kant-/homogenbeteende för egna modellobjekt. Inga browserfel rapporterades. Hover-/orbitbeteendet verifierades i controllerintegration med verklig raycast.

Syntetiskt CPU-prov med 20 referenser × 1 000 delar, 240 frågor efter uppvärmning: sökning och kantval gav p95 cirka 0,10 ms utspritt och 0,20 ms helt överlappande. Detta mäter inte import, materialhighlight, rendering eller musfördröjning. Full `npm run check` passerade. Ingen publicering ingick.

### Kamerastyrning över insättningspunkter och kopplingsikoner — 2026-10-16

`overlay-navigation.test.js` kör markörernas vidarebefordring tillsammans med riktig OrbitControls och modellens pointercontroller. Mitten-/högerknapp samt Ctrl/Meta/Shift verifieras med faktisk kamera- och målpunktsförändring, pointer capture/släpp, inga modell-/verktygskommandon och fortsatt funktion efter ersatta kamerakontroller. Vänsterklick, Alt, touch och andra UI-kontroller lämnas till befintliga ägare. Stationärt högerklick behåller hörnmenyn; högerdrag öppnar ingen meny. Befintliga grepprov skyddar klick/drag, commit och avbrott.

Browserprov i separat projekt: plåtgrepp tog emot vanlig och Ctrl-modifierad mittenknapp med canvasens faktiska pointer capture; vanlig vänsterdragning ändrade hörnet och hörnmenyn visade Ta bort hörn. En verklig Fit-kopplingsikon tog emot samma navigeringsknappar och vanligt vänsterklick öppnade Fit-inspektorn. Tillfällig diagnostik för pointer capture togs bort efter kontrollen. Själva pan-/orbitrörelsen verifieras med riktiga kontroller i integrationstestet. Full `npm run check` passerade. Ingen publicering ingick.

### Arbetsplan med två punkter — 2026-10-16

`work-plane.test.js` skyddar första punkt som origo, exakt vald positiv X-riktning, tidigare Y som orienteringsreferens, ortogonalitet/högerhandsram samt fallback när nya X sammanfaller med tidigare Y. Horisontella/sneda referensramar, vänd riktning, för korta och ogiltiga punkter ingår. Den riktiga arbetsplanscontrollern verifierar två kontra tre punkter, dubblett utan bekräftelse, fristående referensram, kvarvarande aktivt plan vid avbrott och återställning. `model-placement.test.js` verifierar att preview använder samma beräkning utan att ändra aktivt plan eller projekt.

Browserprov i separat projekt med två Sweeps och Fit: Två punkter i befintliga Arbetsplan-gruppen, snap till Sweep-ändpunkt, synlig 2/2-instruktion, avvisad dubblett, förhandsvisade axlar, bekräftelse efter andra punkt, Mot planet, Backspace och Esc med bevarat aktivt plan. Tre punkter krävde fortsatt tredje punkt och Återställ återgick till aktiv nivå. Inga browserfel rapporterades. Full `npm run check` passerade. Ingen publicering ingick.

### Linjär flytt/kopiering i arbetsplan — 2026-10-16

Befintliga `model-placement`, `model-editor`, `model-keyboard` och `fasteners` verifierar automatiskt tvåpunktsstart, lokal projektion och omvandling i sned ram, uttryck med parenteser/decimal-komma, axelkryssrutor under preview och bekräftelse, serieantal och originalurval. Tre kopior får unika identiteter vid Δ/2Δ/3Δ och en checkpoint; sen ogiltig batch avvisas utan projekt-/historikändring. Separata borrmål och manuella skruvlängder behålls per kopia, liksom blockinstanser. Flera valda ändpunkter flyttas lika utan att startpunkterna ändras; ett andra utförande använder uppdaterad geometri. Ogiltiga uttryck, division med noll, ogiltigt antal, avbrott och staplade HUD-rader täcks.

Browserprov i separat projekt: snett arbetsplan valdes från verkliga ändpunkter (X = 0,8/0/0,6). Kopiera linjärt öppnade direkt punktval, accepterade `=2*250`, visade tre kopior och bekräftade dem. En enda Ångra tog bort alla tre; Gör om återställde dem. Alt/Shift-val av två balkändpunkter följdes av linjär dX 100 med dY 50 urkryssad. Exporterad projektfil bekräftade bibehållna startpunkter och ändpunkterna (1080,0,60)/(1080,1000,60), samt kopior vid (400,0,300)/(800,0,600)/(1200,0,900). Picker gav lokal dX 1000 mellan två befintliga sneda ändpunkter utan commit vid andra klicket. Esc behöll HUD-fälten. Full `npm run check` passerade; ingen publicering ingick.

### Skruvbibliotekets grundsortiment — 2026-10-16

`fastener-catalog.test.js` kontrollerar alla åtta storlekar i ISO 4014/4017 och DIN 976-1, separata standardidentiteter, egna revisioner, idempotent komplettering och fristående data. Varje medföljande post placeras och renderas med manuell längd och tillgängliga tillbehör, valideras och följer med genom projektsparning/återläsning. Gänglängdsbanden 125/126/200/201, helgängad instanslängd, för kort längd med passningsvarning samt oförändrade betongförankringsdata täcks.

Browserprov på separat localhost-origin: befintliga egna biblioteksposter fanns kvar bredvid grundsortimentet; ISO 4017 M12 var startval, M8–M36 fanns i dimensioner. Gängstång M24 och manuell längd 203,5, flera muttrar och brickor, byte till träskruv med rensade/inaktiva tillbehör, samt betongmall Ø12 med längd 150 kontrollerades. DIN 976-1 M24 sparades som egen revision 2 med längd/gänglängd 555 och fanns kvar efter omladdning. ISO 4017 M36 placerades via vanliga punktflödet med längd 170, två brickor och mutter; projektets UI-export innehöll just dessa mått och tillbehör. Placeringen låg utanför valt borrmål och visade därför befintlig passningsvarning, men begärd längd behölls. Inga browserfel rapporterades. Full `npm run check` passerade. Ingen publicering ingick.

### Skruvplacering med origo och X-riktning — 2026-10-16

`fastener-placement-frame.test.js` verifierar att punkt två styr mönstrets X och aldrig skaftlängden; skruvaxeln följer normal till horisontellt/snett arbetsplan. Lokala förskjutningar, skruvvinkel, vändning med oförändrade mönsterlägen, bestående skruv-/hålidentiteter, manuell längd, transform, ompassning efter deländring, save/load samt ogiltiga riktningar/layout/mönster täcks. `model-placement.test.js` kör verklig preview, punktkontroller, domänberedning, modell-editor och historik i ett snett fyrskruvsförband: ingen mutation före bekräftelse, ingen extra kontrollfas och en enda Ångra för gruppen.

Browserprov i separat localhost-projekt: två plåtar förvaldes med den övre först. Origo + X-klick skapade sex skruvar med längd 80 och två brickor/mutter, armerade nästa placering och en enda Ångra tog bort hela gruppen. Gör om följdes av gemensam ändring till delning 100/100, längd 90, lokal Y-förskjutning 20 och vändning. Projektets vanliga UI-export bekräftade samma sex skruv-ID:n och tolv hål-ID:n, aktiva hål i båda plåtarna, korrekta värden och den först valda övre plåten som referens. Två upprepade enskilda placeringar behöll längd 80. Byte till plåt återställde de vanliga namn-/metadatafälten.

Ett separat förband roterades 30° runt Y. Arbetsplanet valdes med tre verkliga plåthörn, varefter fyra skruvar placerades med origo/X i planet. UI-exporten verifierade axeln (-0,5, 0, -0,8660254), längd 80 och aktiva hål i båda plåtarna för alla fyra. Inga browserfel rapporterades. Inspektorns gemensamma Objekt-sektion och kompakta fält kontrollerades visuellt. Ingen publicering ingick.

Slutkontroll: `npm run check` passerade efter samtliga ändringar (formatering, lint, full regression och produktionsbygge).

### Skruvlängdens räckvidd genom profilflänsar — 2026-10-17

`fastener-reach.test.js` använder bibliotekets HEA 200, IPE 200, U 200 och VKR 100x100x5. Verkliga materialintervall och borrad CSG-geometri verifierar att kort skruv lämnar bortre flänsen/väggen orörd och tillräcklig längd borrar båda. Gränsvärden med brickor, en/två muttrar, gängstångens utstick, skruv som slutar inne i material respektive luft, för kort första lager och manuellt begränsade hål täcks. Samma preview-/redigeringsberedning, ompassning efter modelländring, sned profil, bestående skruv-/hålidentiteter, modell-editor, historik och save/load ingår. Befintliga förbands-/redigeringstester har uppdaterats där de tidigare förutsatte hål bortom faktisk skruvlängd.

Browserprov i separat localhost-projekt: ISO 4017 M8 genom HEA 200, två brickor och mutter. Längd 40 gav ett lager och håldjup 10; preview med 190 visade varning för delvis nådd bortre fläns, medan 200 gav två lager och rensad varning. UI-export före tillämpning behöll längd 40. Tillämpning av 200 och därefter 40 gav håldjup 190 respektive 10 med samma skruv-/hål-ID:n. Inga browserfel rapporterades. Full `npm run check` passerade. Ingen publicering ingick.

### Rena hål och runda skruvdetaljer — 2026-10-17

`camera-depth.test.js` skyddar djupnoggrannhet under orbit, bibehållen XY-projektion, innehållets alla hörn, avlägsna referensbounds och preview utan ändrad geometri eller sparade bounds. `fastener-system.test.js` verifierar radiella väggnormaler med fortsatt plana ändytor samt att längsgående linjer endast finns vid mutterns sex skarpa hörn. Befintlig förenklad hålvisning, exakt borrgeometri och modellens sessionsflöden ingår i regressionen.

Browserprov i separat projekt med HEA 200 och fyra skruvar: det stjärnformade överlappningsfelet återskapades före ändringen. Efter ändringen visades fyra hela hål vid dold skruv, även efter zoom och i transparent visning. Synliga skruvar/brickor kontrollerades med rena konturer och jämn rund skuggning. Inga browserfel rapporterades. Full `npm run check` passerade. Ingen publicering ingick.

### Gemensamt skruvverktyg, gruppgrepp och preview — 2026-10-17

`fastener-group-grips.test.js` verifierar två gemensamma layoutgrepp för både en och flera skruvar, origo-/riktningsändringar, snett plan, oförändrade delningar och längder, ogiltig riktning utan transaktion, cell-/hålidentiteter, en→flera→en, historik och projektfil. Renderingsprovet kontrollerar att bara nådda lagerytor får konturer och att fristående preview inte ändrar källobjektet. `model-placement.test.js` kör verkliga controllerer för X-grepp genom Move och linjär Move, samt linjär förflyttning via origogrepp: fristående preview, samma skruv-/hål-ID:n och en checkpoint per bekräftelse. Befintliga skapande-, förbands-, snap- och greppflöden ingår i full regression.

Browserprov i separat projekt: en enda Skruvgrupp-knapp, sex skruvar med längd 80 genom två valda plåtar, två brickor och mutter. Skapa-preview rapporterade 2/2 nådda delar. UI-export verifierade sex skruvar med aktiva hål i båda delarna. X-greppet vred mönstret; origogreppet gav samma förflyttning (30,128131, −15,658076, 0) för alla sex, med samma längder och hål-ID:n. Byte till En skruv behöll första cellens identitet; en Ångra återställde alla sex. Separat importerades förbandet roterat 30°: verklig X-dragning behöll skruvaxeln cirka (−0,5, 0, −0,8660254), samtliga identiteter och aktiva hål i båda plåtarna. Gemensam längdredigering, kompakt inspektor efter tillämpning, stängd Objekt-sektion och riktningspilar i SVG-hjälplagret kontrollerades. Inga browserfel rapporterades. Full `npm run check` passerade. Ingen publicering ingick.

### Skrollklick för skruvgruppens delval — 2026-10-17

Skrollklick använder samma bekräftelse som Enter i delvalet. Pointertestet skyddar mot bekräftelse efter panorering (även återdrag till startpunkten), modifierare, avbrott, förlorad pointer capture, verktygsbyte och avinstallation. Navigationstestet använder riktiga OrbitControls för att verifiera fortsatt panorering/orbit och frigjord capture. I separat localhost-flik verifierades att Ctrl + skrollklick behåller delvalet och vanligt skrollklick går vidare till origo/X-riktning utan att skapa objekt.

### Väntande inspektorfält — 2026-10-17

`inspector-field-state.test.js` skyddar separata ändringar, numerisk återgång, kryssrutor/rullistor, dynamiskt ombyggda kontroller, fel och rättning, accepterade basvärden och avinstallation. Modellinspektorns transaktionstest verifierar att valideringsfel och avvisad commit behåller utkastet och inte accepterar fältstatus; ett lyckat nytt försök genomför ändringen. Befintliga punkt-/Polysweep-scenarier använder samma presentationsadapter.

Browserkontroll i separat localhost-projekt: skruvgrupp med två gula fält, återgång till ursprunglig längd, Tillämpa med noll kvarvarande markeringar, ogiltig nollängd/röd ram/spärrad knapp, brickkryssruta och Ångra; vanlig plåttjocklek med gul preview och Escape tillbaka till originalet. GA-vyns placering och skala kontrollerades med verklig tangentbordsinmatning och Tab-bekräftelse. Rich text kontrollerades med ändrad texthöjd och ram i ett nytt textutkast: båda markeringarna kvarstod efter fältbyte och rensades när texten bekräftades. Inga browserfel rapporterades. Bildunderlag ligger i den lokala visualiseringsmappen `pending-inspector`.

Kompletterande browserkontroll: rameditorens X för insättningspunkten blev gul före Ändra insättningspunkt, rensades efter tillämpning och återställdes med Ångra. GA:s ogiltiga undre gräns markerades röd utan accepterad höjdändring och återgång till −1000 rensade fältets väntande/felstatus. Gemensamma hatchfält och Single Part-materiallistans placeringsfält ansluts också till samma fältstatus.

### Skrollklick i modellens punkt- och urvalsverktyg — 2026-10-17

Befintligt pointertest kompletterades för Polysweep, Plate, koppling, tre egenskapskopieringsflöden, arbetsområde, linjära verktyg, plantransform och rotation. Ett byte till annan fas före släpp får inte bekräfta, och panorering tillbaka till startpunkten räknas fortsatt som drag. Navigationstestet kör riktiga OrbitControls för skruvdelval, Polysweep och Plate med både panorering och modifierad orbit. Centrala modellflöden och berörda tangentbords-/pointertester passerade.

Browserkontroll i separat localhost-projekt: Polysweep med tre klickade punkter, Ctrl + skrollklick med fortsatt punktval och vanligt skrollklick som skapade exakt tre hörn; Plate med fyra hörn och skrollklick som skapade exakt fyra hörn. Musen låg utanför den färdiga konturen vid båda bekräftelserna. Ett Ångra tog bort respektive testobjekt. Skrollklick på ett tomt Polysweep-utkast skapade inget objekt och lämnade verktyget aktivt. Inga browserfel rapporterades.

### Gemensamt skrollklick i modell, ritning och profil — 2026-10-17

Ritningens pan-test kör den riktiga pan-adaptern med `DrawingAnnotations` slutföring: polygon med tre hörn/en historikpost, måttpunkter till placering utan commit, transformernas urvalsfas och måttassistentens urval. Modifierare, panorering tillbaka till startpunkten, avbrott och förlorad capture får inte slutföra. Rich text och måttlinjens placering undantas. `section-completion.test.js` kör profileditorns verkliga pointer-/pan-/finish-/historikmetoder: bibehållen kameraförskjutning, oförändrat utkast vid drag, precis ett avslut, Ångra och otillräcklig/reparerad kontur. Modellens befintliga OrbitControls-tester körs efter flytten till den gemensamma gesten.

Browserkontroll i separat localhost-projekt: GA-polygon från tre hörn, Ctrl + skrollklick utan avslut och vanligt skrollklick med exakt tre hörn i den renderade banan; Flytta-urval bekräftat till från-punkt utan faktisk flytt; måttpunkter bekräftade till placering av måttlinjen utan att lägga ut den. I profileditorn verifierades ytterkontur och hålkontur med tre punkter vardera, skrollklick utanför konturen, korrekt area och bibehållen Polylinje efter Ctrl + skrollklick. Inga browserfel rapporterades. Kontrollen fångade också att giltig standardlinjetjocklek 0,22 fick native stepMismatch av ett steg på 0,05; fältet tillåter nu fria giltiga linjetjocklekar enligt dess befintliga min/max och validerare.

## Högerklick under modellverktyg

`next-point-snap.test.js` verifierar exklusiv mittpunkt genom verklig `resolveSnap`, oförändrade projektinställningar, fri punkt med bibehållet axellås, filtrering av referenskandidater samt att preview, missat punktval, högerklick och avbruten pointergest inte förbrukar valet. Ett vanligt punktval konsumerar det och verktygsbyte rensar det. Befintliga placeringsscenarier skyddar att linjär flytt/kopiering och plantransformer bara rapporterar bekräftelseklara utkast efter giltig preview.

Webbläsarprov 2026-10-17 på separat localhost-origin: Polysweep med inaktiv Bekräfta före punktval, tillfällig Mittpunkt, missad träff, snapp till befintlig balks mittpunkt, återgång till vanlig snap för nästa punkt och avslut genom menyn. Flytt bekräftades vid den frysta målpositionen och ångrades i ett steg. Linjär kopiering provades med inaktiv Bekräfta under punktval och aktiv efter numerisk vektor; menybekräftelse skapade kopian och Avbryt lämnade verktyget.

## Ritningar från modellens högerklicksmeny

`drawing-selection.test.js` skyddar gemensamma ritningar för lika delar, assemblykoppling via sekundärdel, deduplicerat flerval, inaktuell numrering, återkoppling efter detaljsplittring, bevarat urval under numrering, avbruten tilldelning och spärr mot att tomt urval blir hela modellen. Domänläsningen muterar varken projekt eller ritningar.

Webbläsarprov 2026-10-17 på separat localhost-origin: onumrerad del → Skapa partritningar → Avbryt utan ritning, därefter Tilldela nummer → skapandelista med Single Part och Markerade objekt → skapa och öppna från menyn. Skapa assemblyritningar numrerade även den fristående delens assembly och återgick till rätt typ/urval. Båda ritningstyperna visades och öppnades från objektmenyn. Ändrad profilbredd markerade båda ritningarna med numrering krävs; assemblyritningens öppningskommando fortsatte efter ny tilldelning.

## Förenklad skruvvisning — 2026-10-17

`fastener-display.test.js` skyddar gemensamma konturer för modell/hover/preview, korrekta världsbounds, separat exakt solid/IFC, öppningar i tillbehör utan skruv, delade mallar, detaljväxling, markering i homogen och transparent översikt samt proxyernas återanslutning. Befintliga tester för skruvlängdens räckvidd genom H/I/U/RHS, kopplade hål, export och centrala modellflöden passerade. `npm run check` passerade.

Återanvändbart belastningsprov: `scripts/benchmark-render.html?fasteners=10000`, även `&zoom=8` för närbild. `fastener-performance.js` bygger 100 kompletta förband med totalt 10 000 M12-skruvar, två brickor och en mutter per skruv, 200 plåtar och 20 000 aktiva kopplade hål. Samma verkliga mesh-, instans- och detaljkod som appen används. Mätning: Chromium 155 på denna Mac, 1200 × 800, pixelRatio 1, 10 uppvärmningsbilder och 120 mätbilder per visningsläge, roterande kamera.

Översikt före → efter: 12 002 400 → 2 042 400 inskickade trianglar och 6 122 400 → 762 400 linjesegment, med sex renderingsanrop. Median bildintervall homogen 16,7 → 16,7 ms, transparent 33,3 → 16,7 ms. CPU-inlämning homogen 5,4 → 7,3 ms och transparent 8,1 → 10,0 ms: färre GPU-primitiver innebär inte lägre CPU-kostnad för detaljpolicyn. Efter ändringen var p95 bildintervall 17,6/16,8 ms. Delade geometribuffertar cirka 133,7 MiB, huvudsakligen plåtar och hål; detta är inte processens eller GPU:ns totala minne. Närbild efter: median 16,7 ms i båda lägen, p95 17,9/18,1 ms; transparent CPU hade enstaka toppar (p95 27,5 ms). Provets bildintervall påverkas av skärm och browser; appöverlägg, snap och händelsehanterare ingår inte. Detta är ingen generell FPS-garanti.

Browserkontroll i separat produktionspreview: sex skruvar genom två plåtar med rena konturer i närbild, transparent markering och ändrad längd 80 → 90 genom samma inspektor; kopplade hål kvar i båda lagren efter Tillämpa. Projektet med samtliga 10 200 objekt öppnades också i vanliga appen, zoomades och växlades mellan transparent/homogen visning. Skruv SK-001 hittades i modellträdet och dess grupp öppnades i inspektorn. Inläsningen av det stora projektet blockerade tillfälligt interaktion; renderingsprovet mäter inte den tiden. Inga konsolfel rapporterades.

### Skruvgrupp på stående yta — 2026-10-17

`fastener-placement-frame.test.js` provar riktig modellpicking mot en stående vald plåt med horisontellt arbetsplan, gruppens axlar, sex skruvar med aktiva hål, oförändrat arbetsplan, uteblivet övertagande från icke vald del samt giltiga orienteringsaxlar på ändyta och sned yta. Befintliga placerings-, grupp- och räckviddstester samt centrala modellflöden passerade.

Browserprov i separat produktionspreview: två stående plåtar valdes, Rutnät 60 × 60 sattes och fyra skruvar skapades genom två klick direkt på plåtytan utan byte av arbetsplan. Sparad projektfil verifierades: layoutens u = X och v = Z, skruvaxlar i Y och åtta aktiva hål. Vändning genom inspektorn och Tillämpa behöll gruppen och båda förbandsdelarnas hål. Transparent visning visade de genomgående skruvarna; inga konsolfel rapporterades.

### Markering av enbart hål — 2026-10-17

`fastener-display.test.js` skyddar en grupp utan skruv, muttrar eller brickor: verklig modellpicking på hålkanter i homogen/transparent visning, lodrät och sned kamera med pixeltolerans, gruppägarens ID, markerade konturer och hover, oförändrade aktiva hål, tom exakt skruvsolid samt fortsatt skymning bakom en täckande plåt. Gemensamma markeringstester skyddar IFC, referenslägen, arbetsområde och instansägare.

Browserprov i separat produktionspreview: sex skruvar genom två plåtar, alla hårdvaruval avstängda i inspektorn och Tillämpa. Efter Esc valdes gruppen direkt genom en hålkant i sned homogen vy; delning X ändrades från 60 60 till 80 80 och tillämpades med sex hålpositioner kvar. Samma kantval öppnade gruppens inspektor i transparent visning. Inga konsolfel rapporterades.

### Synliga och snappbara insättningspunkter under transform — 2026-10-17

`transform-grips.test.js` provar Sweep, Item, hjälplinje, stomlinje, Polysweep, Plate och skruvgrupp genom de befintliga greppdefinitionerna. Move/Copy och linjär/plantransform behåller greppen som passiva markörer utan hörnmeny eller Alt-greppurval; normal redigering återkommer efter kommandot. Verklig modellpicking med tom fysisk snap-bredfas träffar skruvgruppens X-datum utanför kroppens bounds. Dold källa, avslutat kommando och exklusivt annat nästa-punkt-val ger inte den träffen. `grip-interaction.test.js` skyddar att aktiv transform inte konsumerar pointer eller startar greppgest. Befintliga tester för gruppgrepp med Move/linjär Move, panorering och orbit passerade. Full `npm run check` passerade.

Browserprov i separat produktionspreview: sex skruvar markerades, Move visade två passiva insättningspunkter och båda användes som från-/tillpunkt. Sparad modell bekräftade exakt +120 i X för samtliga gruppursprung, oförändrat Y/Z och sex skruvar. En Ångra återställde gruppen; Copy genom samma punkter skapade sex nya skruvar och totalt tolv, med normal greppredigering åter efter commit. Efter Ångra visades även plåtens fyra passiva hörn under Move; Escape och ny markering återställde hörnknapparna. Inga konsolfel rapporterades.

### Rektangelmarkering av enbart hål — 2026-10-18

Felet återskapades med `enclosedSweeps`: en hålgrupp utan skruv, muttrar eller brickor returnerade inga träffar, eftersom dess fysiska visningsgeometri var tom. Samma test skyddar nu omslutande ruta runt en hålförekomst och korsande ruta genom öppningen, medan inaktiva hål fortfarande ger tomt urval. Ett separat missat klickfall återskapades också: mitten av en öppning större än kanttoleransen valde plåten. Testet skyddar nu centrum och inre punkt i opak öppning, bibehållet plåtval bredvid hålet, sned kamera samt skymning bakom annan del. Fysisk hålgrupp förblir utan skruvsolid. Passiva markörer under markeringsrutan skyddas i det befintliga transformgreppstestet inklusive bevarat Alt-rektangelurval. Full `npm run check` passerade.

Browserprov i separat produktionspreview: sex befintliga skruvar genom två plåtar; skruv, båda brickorna och mutter avstängda genom den vanliga inspektorn. I ovanifrånvy med förstoring valde vänster-till-höger-ruta runt en enda hålförekomst hela sexhålsgruppen. En direkt följande höger-till-vänster-ruta genom öppningen valde gruppen tillsammans med de två korsade plåtarna, utan någon modellförflyttning. Markörerna verifierades som två passiva spans. Växling till transparent visning och ny omslutande ruta valde åter enbart hålgruppen. Klick mitt i öppningen kontrollerades också. Inga konsolfel rapporterades.

### Trepunktsplan och fristående skruvgrupper — 2026-10-18

Utökade befintliga grupp-/placeringstester skyddar origo/X/Y, ortogonalisering, kollineära punkter utan commit, tredje klickets enda transaktion, tre gemensamma grepp, Y-vridning, oförändrade delningar/längder, ID:n, projektfil och historik. Verklig picking skyddar Y på stående materialyta med horisontellt arbetsplan, även när beroende preview ersatt plåtens synliga mesh. Manuella grupper provas vid tvärgående och axiell delflytt, återställd kontakt, samtidig grupp-/delflytt samt kopiering. Befintliga komponent-, räckvidds-, borrgeometri- och IFC-tester behålls. Äldre tester som krävde att manuella skruvar följde referensdelen har ändrats till det nya, uttryckligen fristående beteendet.

Browserprov på separat localhost-origin med senaste utvecklingskoden: fyra M12 × 80 på två stående plåtar genom origo/X/Y, sparad fil med u=Y, v=Z, skruvaxel −X och åtta aktiva hål. Flytt av en plåt behöll samtliga huvud-/ändpunkter, plan och tillbehörslägen; dess fyra hål blev inaktiva med oförändrade relationer/ID:n. Tillämpad längd 90 efter delflytten behöll huvudlägen och hål-ID:n. Ångra återställde del och längd. Enbart hål, tre grepp, ljusare hålfyllning och faktisk Y-dragning kontrollerades; Y-dragningen avslutades via samma grepptransaktion. Inga browserfel rapporterades.

Full kontroll i den delade arbetskopian hittade ett separat fel i `instance-batches.test.js` kring transparenta kantmaterial, i andra pågående ändringar. Skruvändringen och tidigare tillhörande hålmarkeringsfixar verifieras därför även i en isolerad kopia av HEAD utan dessa andra ändringar. Ingen publicering ingår.

Slutlig isolerad `npm run check` passerade efter Y-greppets rättning: formatering, lint, full regression och produktionsbygge. Logg: `/tmp/lira-fastener-plane-isolated-final.log`.

### Rättad förväntan för instansrenderade konturer — 2026-10-18

Det återstående felet i `instance-batches.test.js` var en inaktuell förväntan på materialets blandningsflagga. Konturer använder blandning i båda visningslägena; testet verifierar nu effektiv opacitet 1 respektive 0,35, korrekt djupskrivning och överensstämmelse med vanliga objekt genom upprepade lägesbyten. Befintliga kontroller av orbitordning, markering, dolda objekt och återanvänd geometri behålls. Inga renderingsändringar behövdes. Full `npm run check` i den delade arbetskopian passerade: formatering, lint, samtliga regressionstester och produktionsbygge. Logg: `/tmp/lira-render-test-final-check.log`.

### Fri vridning av skruvgruppens plan — 2026-10-18

Den kvarvarande X-låsningen togs bort från både geometri och grepparbetsplan. Befintliga grepp-/pickingtester skyddar fria X-träffar på stående materialytor och bibehållen ogiltighetsvalidering. `fastener-reach.test.js` flyttar en grupp från HEA 200:s fläns till livet och vrider X från horisontellt till vertikalt. Verkliga materialintervall verifierar fyra aktiva hål genom livets 6,5 mm med bibehållna skruv-/hål-ID:n, 30/50-delningar, manuella längder, projektfil och ångra/gör om.

Browserprov på separat localhost-origin: markera gruppens X-grepp, Flytta linjärt med dY = −100 och dZ = 100, bekräfta och spara projektfilen. Gruppens axlar blev u=(0,0,1), v=(−1,0,0) och skruvaxel=(0,1,0). Samtliga fyra M8 × 40 hade ett aktivt lager på 6,5 mm i HEA-livet. Transparent närbild och Ångra/Gör om kontrollerades. Inga browserfel rapporterades.

Slutlig `npm run check` passerade i arbetskopian: formatering, lint, full regression och produktionsbygge. Logg: `/tmp/lira-free-group-final-check.log`. Ingen publicering ingick.

### Homogen skruvhårdvara och 10 000 skruvar — 2026-10-18

`fastener-display.test.js` skyddar homogen hårdvara vid direkt skapande i transparent vy och vid upprepade lägesbyten: skruv, gängstång samt muttrar/brickor utan skaft. Befintliga detalj-/översiktsprov kontrollerar även instansmaterial, oförändrade geometrier, bibehållen markering och att hårdvaran inte transparenssorteras. Opaka ytträffar och den gemensamma kanttoleransen provas på liten översiktsskruv. Hål utan hårdvara och ghost-preview behåller sina tidigare visningsregler. Full `npm run check` passerade, inklusive befintliga borr-, räckvidds- och IFC-tester. Logg: `/tmp/lira-opaque-fasteners-check.log`.

Återanvändbart WebGL-prov: `scripts/benchmark-render.html?fasteners=10000`, samt `&zoom=8` för närbild. Samma modell med 10 000 M12-skruvar, två brickor och en mutter per skruv, 200 plåtar och 20 000 aktiva hål före/efter. Chromium 155 på denna Mac, 1200 × 800 pixlar, pixelkvot 1, 10 uppvärmningsbilder och 120 mätbilder per visningsläge med kamerarörelse. Mätningen omfattar verklig mesh-, detalj- och instansrendering men inte appöverlägg, snap, musinmatning eller total importtid. CPU-inlämning är inte GPU-tid; skärmens uppdateringsfrekvens påverkar bildintervallet. En körning per fall visar inte statistiskt säkerställda generella vinster.

| Vy | Scenläge | Median CPU före → efter | p95 CPU före → efter | Median bildintervall före → efter |
| --- | --- | --- | --- | --- |
| Översikt | Homogen | 9,1 → 9,2 ms | 10,0 → 10,0 ms | 16,7 → 16,7 ms |
| Översikt | Transparent | 9,8 → 9,6 ms | 11,0 → 10,4 ms | 16,7 → 16,7 ms |
| Närbild | Homogen | 7,7 → 8,3 ms | 9,2 → 9,3 ms | 16,7 → 16,7 ms |
| Närbild | Transparent | 9,8 → 7,2 ms | 14,9 → 13,1 ms | 16,7 → 16,7 ms |

Transparent översikts p95 bildintervall 17,3 → 17,6 ms och närbild 17,3 → 16,8 ms. Antal inskickade trianglar, linjer och renderingsanrop behölls: översikt cirka 2,04 miljoner trianglar/762 400 linjesegment/6 anrop; transparent närbild cirka 9,08 miljoner/1,56 miljoner/8 anrop. Delade geometribuffertar cirka 133,7 MiB i båda versionerna; detta är inte total process- eller GPU-minnesanvändning. Benchmarkens nya materialräkning bekräftade 10 000 opaka hårdvaruinstanser och noll transparenta i transparent scen. Rådata ligger i `/Users/andreassvensson/.codex/visualizations/opaque-fasteners/` (`before-overview.json`, `after-overview.json`, `before-close.json`, `after-close.json` och `after-overview-verified.json`).

Browserprov i separat localhost-projekt: sex skruvar genom två transparenta plåtar med homogena skaft, muttrar och brickor; markering direkt på skruvhuvudets yta öppnade hela gruppen. Ändring av längd 80 → 90, Tillämpa och växling homogen/transparent behöll sex skruvar och aktiva hål i båda lagren. Inga browserfel rapporterades. Ingen publicering ingick.

### Hover på hålgrupper utan hårdvara — 2026-10-18

Det vanliga hoverfiltret accepterar nu även skruvgruppens hålägare när skruv, muttrar och brickor är avstängda. Befintligt test i `fastener-display.test.js` går genom riktig picking, hovercontroller, gruppurval och ObjectFeedback i homogen/transparent vy: hålkant lyser upp hela gruppen, konturer finns och hover släpper utanför modellen. Specialisttester för feedback, skruvvisning och modellträffar passerar, liksom lint och kärnflöden.

Browserkontroll med separat tillfällig renderingsharness som använder appens befintliga meshbyggare, picking, hovercontroller och feedback: sex skruvar respektive sex hålförekomster utan hårdvara, homogen/transparent växling och borttagen hover. Sex markerade förekomster övergår till noll utanför gruppen; inga konsolfel. Testharnessen togs bort efter kontrollen. Bild: `/Users/andreassvensson/.codex/visualizations/fastener-hover/holes.png`. Inte publicerat.

### Markeringsrektangel på scrollat Single Part-/Assemblyblad — 2026-10-18

`.sheet-workspace` är nu positioneringsreferens för sin befintliga absoluta markeringsruta. Före rättningen räknades scrollningen in i koordinaterna men rutan placerades relativt ritningskroppen, så den hamnade utanför synlig yta. GA:s arbetsyta var redan positionerad.

Browserkontroll i separat localhost-projekt med Single Part och Assembly: scrollposition 787/475, omslutande och korsande dragning, flera markerade vyer samt dold ruta efter avslut. Vid visuell diagnos behölls tillfälligt den senaste rutan efter pointerup; dess skärmrektangel stämde exakt med dragningen (130,220)–(750,360). Den tillfälliga diagnostikregeln togs bort och dolt sluttillstånd verifierades igen. Inga konsolfel. Lint och riktad formateringskontroll passerade. Ingen modell-/markeringslogik ändrades och inget CSS-implementationstest lades till. Inte publicerat.


### Materiallista borttagen från ritningsinspektorn — 2026-10-18

Single Parts separata Materiallista-sektion och dess formulärsynk har tagits bort; tabellen på bladet renderas fortfarande via befintliga ritningsinställningar. Browserkontroll av P100 i separat lokalt projekt: Ritningsinställningar visar blad/layout, papper, orientering, pappersbibliotek och typsnitt utan Materiallista; bladets tabell finns kvar. Inga konsolfel. Lint och riktad formatering passerade. Inte publicerat.


### Tydligare snapfärg — 2026-10-18

Den gemensamma snapfärgen i `ui/cad-feedback.js` är magenta (#d000b8). SVG-symboler i modell, ritning och rameditor samt canvaseditorns punktsnap använder samma token. Browserkontroll: starta Linje på Single Part och snappa till ändpunkt; samma ändpunktssymbol kontrollerad vid Sweep i modellen. Båda har den nya färgen och inga konsolfel rapporterades. Lint och riktad formatering passerade. Ingen snaplogik eller symbolstorlek ändrad. Inte publicerat.

### Textredigering följer ritningsbladets zoom och panorering — 2026-10-18

Felet återskapades i Single Part: bladbredd 629,289 → 439,039 px medan den öppna textens bredd och font låg kvar på 260 respektive 5,244 px. Richtextcontrollern observerar nu bladets och överläggsvärdens storlek under redigering och följer scrollhändelser i samma värd. Bekräfta, avbryt och dialogstängning kopplar bort storleksobservationen; textinnehållet byggs inte om vid zoom/pan.

Browserprov i separat lokalt projekt, Single Part och GA: zoomkvot 0,697675 gav samma kvot för textstorlek och redigeringsbredd, medan formateringsraden behöll 30 px höjd. Zoom in, fortsatt befintlig textredigering, bekräftelse och återöppning kontrollerades. Vid horisontell panorering flyttades blad och redigeringsruta båda cirka −244 px. Tvåradigt innehåll behölls och sparad SVG-text hade fortsatt texthöjd 3,5 mm. GA verifierade motsvarande zoomkvot och sparad höjd. Inga konsolfel. Befintliga richtexttester, lint och riktad formatering passerade. Inte publicerat.

### Hållista borttagen från ritningsinspektorn — 2026-10-18

Single Part och Assembly skapar inte längre det separata, alltid öppna hålinformationsfältet i inspektorn. Den oanvända DOM-funktionen `updatePartHolePanel` har tagits bort ur `fasteners/drawing.js`; hålschema och snappkandidater används fortsatt av ritningsgeometrin. Browserprov med sex skruvar genom två plåtar: P1 och A1 öppnas utan hållista, hålen finns kvar på bladet och inga konsolfel rapporteras. Befintliga simplified-holes- och joint-workflow-tester, lint och formatering passerade. Inte publicerat.

### Vyernas mittgrepp borttaget — 2026-10-18

Single Part/Assemblys SVG-vygrepp och GA:s HTML-vygrepp skapar bara de åtta befintliga beskärningsgreppen längs kanten. Inspektorns hänvisning till mittgreppet har tagits bort. Ingen vygeometri, skala, flytttransaktion eller beskärningsregel ändrad.

Browserprov på Single Part, Assembly och GA verifierade åtta kantgrepp och inget mittgrepp. Vyposition ändrades via X-fältet och Assemblys östra grepp ändrade bredd från 56 till cirka 72,018 mm. Inga konsolfel. Den övre Flytta-knappen gäller idag ritobjekt, inte vyer; detta har inte utökats inom presentationsändringen. Befintliga drawing-view-actions-, drawing-grip-interaction- och drawing-views-tester samt lint passerade. Inte publicerat.

### Klick–dra–släpp och återanvända vyprojektioner — 2026-10-18

Befintliga grepp- och snitttester har anpassats till dragning: klick utan rörelse startar ingen placering, mittknappen lämnas till navigation, slutpositionen tas från pointerup, Esc återställer, ogiltig ändpunkt avvisas och numeriskt mått under aktivt grepp valideras. Snittets flytt/djup och detaljgräns använder utkast utan sparad vyändring eller projektion under preview; bekräftelse ger en reversibel historikoperation. Full `npm run check` körs med logg `/tmp/lira-drawing-drag-final-check.log`.

Det utökade profilvisningsscenariot skyddar 100 beskärningar utan ny geometri-/snapberäkning, oförändrade kandidatidentiteter, invalidation av ändrat snitt och beroende detalj samt bevarad oberoende vy. GA-scenariot skyddar att bara ändrad vy och dess efterföljare byggs om, utan dubbel uppdatering av den aktiva vyn.

Återanvändbart beräkningsprov: `node scripts/benchmark-view-crop.mjs`, 32 cylindrar/4 096 trianglar, två vyer, 12 ändringar per väg. På denna Mac var median för framtvingad full omräkning 48,74 ms (max 71,92) och med återanvänd projektion 0,0012 ms (max 0,0124). SHA-256 över vektorer och ytor var oförändrad. Detta mäter Node-beräkningen i ett syntetiskt projekt, inte browserns totala interaktionstid, SVG-målning eller import. Rådata: `/tmp/lira-crop-benchmark.json`.

Browserprov i separat lokalt projekt: Single Part, Assembly och GA; vanliga vyer och sektionsvyer. Single Part-sektionens bredd 48 → 64,685 mm, Ångra till 48, Gör om till 64,685, med skala 1:10 bevarad. Klick på grepp och därefter tom yta ändrade inte bredden. Assembly-sektion 48 → 68,023 och Ångra; GA 390 → 369,977 och Ångra, samt GA-sektion 30 → 53,36 och Ångra. Drag i snittdjup på GA ändrade 1 000 → 828,759 mm med Ångra/Gör om. Single Parts snittflyttgrepp återställdes med Ångra; detaljgräns ändrade detaljvybredd 40 → 59,515 mm och Ångra återställde 40. De gemensamma snittgreppens träffytor verifierades till 18 skärmpixlar i båda arbetsytorna. Inga konsolfel rapporterades. Inte publicerat.

### Start utan gammalt gränssnitt — 2026-10-18

`application-startup.test.js` skyddar ordningen återställning → appskapande → första bild → synlig arbetsyta och fel från modulhämtning, återställning eller appskapande. Inget fel får exponera den halvbyggda arbetsytan. Den tidiga CSS-grinden behåller mätbara mått så att kamera/canvas och ribbon byggs med rätt storlek.

Browserprov med tillfällig kopia av verklig index-HTML och sex sekunders startfördröjning visade enbart startytan; det gamla sidhuvudets visibility var hidden med 1 280 px bevarad bredd. Efter start fanns en ribbon, ingen startyta och inget startattribut. Ett avsiktligt loaderfel visade felmeddelande och Ladda om, medan gamla kontroller förblev dolda. Tillfälliga provsidor togs bort efter kontroll. Vanlig dev-start kontrollerades med återställt projekt och Sweep-verktyg.

Produktionsprovet upptäckte en cirkulär väntan mellan entry-filens top-level await och Vites preloadhjälpare i lazy-moduler. Entry-filen startar nu boot-funktionen utan att invänta dess promise; ordning/felhantering finns kvar i boot-modulen. Produktionsstart och efterföljande omladdning verifierades via Vite preview: ribbon synlig, startytan/startattributet borta och inga konsolfel på produktionsorigin. Hela `npm run check` passerade. Full kontrollogg: `/tmp/lira-startup-check.log`. Inte publicerat.

### Stomlinjebubblor på klippt arbetsområde — 2026-10-18

`grid-bubble-size.test.js` verifierar bubblor vid klippta ändar, bevarade originalpunkter, start-/slutval, plushöjdsgränser och återställd full utsträckning utan arbetsområde. Sneda/omvända linjer behåller ändordningen; helt osynliga linjer och ren hörntangering får inga bubblor. Berörda bubbel-, etikett- och arbetsområdestester passerade (17 scenarier), liksom lint. Loggar: `/tmp/lira-work-area-bubbles-tests.log` och `/tmp/lira-work-area-bubbles-lint.log`.

Browserprov i separat lokalt projekt med sju stomlinjer och box −1 500…1 500 i XY: mittlinjerna 2 och B samt den sneda linjen S korsade boxen trots att deras ursprungliga ändpunkter låg utanför. Alla tre fick två bubblor vid de klippta ändarna, medan de övriga fyra linjernas bubblor var dolda. Samma sex bubblor kontrollerades ovanifrån och i 3D. Inga konsolfel. Inte publicerat.

### Strukturerade ritningsmenyer och ritningslista — 2026-10-18

Webbläsarkontroll med ett testprojekt med Single Part P100, Assembly A200 och en ny GA-001. Samtliga visar Ritningslista/dokumentnamn/Till modellen i översta raden samt en enda Spara-knapp. Arkiv, Fler och Spara och till modellen är borttagna från ritningseditorn. Ritning, Ändra, Rita, Annotera, Vyer, Visa och Bibliotek använder samma ribbon.

Verifierat återöppning via Ritningslista med bevarad vyposition: P100 X=28 efter Spara och A200 X=42 efter stängning via listknappen. GA duplicerade en vy, ändrade kopians X till 55 och sparade med Cmd+S; båda vyerna och kopians position fanns kvar efter återöppning. Markera som aktuell gav Aktuell i GA-listan. Till modellen stängde både editor och listdialog. Visa blad/Visa allt och Lägg till vy-menyn fungerade; Spara som ritningsmall öppnade rätt dialog från Bibliotek. Inga JavaScript-fel observerades.

Berörda ritningshanterings-, urvals- och vytester: 22 passerade. Lint, formatering och produktionsbygge kontrolleras för ändringen.


### Ritningslista ovanpå öppen ritning — 2026-10-19

Browserprov med P100, A200 och GA-001: Stäng/Esc i ritningslistan återgår till samma öppna editor. Single Part och GA behöll exakt scrollposition (787/475) och bladbredd (629,289 px); assembly återgick med Esc. P100 → A200 → GA → P100 fungerade utan kvarvarande gammal editor eller konsolfel. Det nya navigationstestet skyddar att close-eventets sparning/resursfrigöring sker före återanvändning av editorn. Berörda navigation-/hanteringstester samt lint passerade. Inte publicerat.

### Blandad rektangelmarkering och bladförflyttning — 2026-10-19

`drawing-mixed-selection.test.js` skyddar ramträff mot tom vyinteriör, omslutning, blandad förflyttning med olika skalor, mått/text, bevarade modellankare när mått följer sin vy, frikopplade ankare vid individuell flytt, kopiering utan dubblerat innehåll, nya identiteter och omkopplade beroende vyer. Befintlig ritningshistorik provas för gemensam Ångra/Gör om.

Browserprov: Single Part och Assembly valde linje med ruta inne i vyn utan markerad ram. Blandat urval med vy, vylinje och fristående linje flyttade samtliga exakt 30 skärmpixlar per axel en gång. Single Part med fyra ritobjekt (vylinje, mått, fristående linje och richtext) plus en vy gav samma 30 px för varje element; Shift-klick tog bort enbart en linje och Esc avmarkerade även vyn. Kopiering gav en vykopia och en kopia per berört ritobjekt; Ångra/Gör om återställde lägena. GA provades med linje i vyn, gemensam flytt från punkter utanför vyn, kopiering med en annotering per vy och ångring. Inga konsolfel. Full kontrollogg: `/tmp/lira-mixed-check.log`. Inte publicerat.

### Sektioner i ritningsinspektorn — 2026-10-19

Browserkontroll på Single Part, Assembly och GA: Vy/Visning/Placering på bladet är gemensamma sektioner; GA har även Avgränsning. Namn och X-position redigerades, Visning fälldes ihop och öppnades igen, och assemblys skala 1:20 bevarades vid återöppning. GA:s snitthöjd ändrades till 1300 och bevarades vid återöppning. Inställningsfliken visade blad- och typsnittsfälten i separata grupper. Richtextens grupperade Bredd ändrades till 85 mm. Måttlinjens punkter kunde minskas från tre till två och punktlistan förblev öppen efter omritning. Inga konsolfel. 34 berörda tester, lint och riktad formateringskontroll passerade. Inga tester för enbart DOM-gruppering tillagda. Inte publicerat.

### Delad typväljare för modell och ritning — 2026-10-19

`drawing-selection-scope.test.js` skyddar Alla/typval, identiteter och aktuella objekt efter en måttavgränsad flytt, återställning av typfilter i historik, nya urval och borttagna medlemmar. Modellens befintliga selection-scope-tester körs med samma byggblock. GA:s befintliga livscykelscenario har utökats till tiden innan även bladobjektet finns; detta fångar startfelet som hittades i browserprovet.

Browserprov på Single Part: fem medlemmar (två linjer, en richtext, en måttkedja och en vy) ger ikoner för Alla/Linjer/Text/Mått/Vyer till vänster om inspektorn. Mått visar bara måttfält och Flytta ändrar bara måttets läge; övriga tre ritobjekt och vyn ligger kvar. Alla återställer fem medlemmar. Text och Vyer visar rätt egenskapspanel. Linjeavgränsad flytt, Alla, Ångra och Alla behåller hela grundurvalet. Måttborttagning lämnar fyra medlemmar; Ångra och Alla återställer fem. Esc rensar bas och aktivt urval även via dialogens nativa cancel. Docken döljs i Ritningsinställningar och återkommer i Egenskaper. Assembly verifierade Mått → Alla med fem medlemmar; ny GA verifierade Linjer/Vyer → Alla med två medlemmar. Full kontrollogg: `/tmp/lira-drawing-scope-check.log`. Inte publicerat.

### Gemensam högerklick på ritning — 2026-10-19

`drawing-context-selection.test.js` skyddar bevarat blandat/typavgränsat urval, nytt mål, tom yta, beroende vyer, minsta vyantal, gemensam borttagning med en ångringspost och avbruten bekräftelse utan historikändring. Måttpunktsborttagning återanvänder inspektorns kontroll, behåller punktreferenser och avvisar färre än två punkter. `drawing-vertex-editing.test.js` provar infogning på närmaste öppna/slutande kant, bevarad källgeometri, hatchning, dublettavvisning och minsta polygonantal. Befintliga meny-/context-click-, ritnings-, transform- och urvalstester ingår i full regression.

Browserprov på Single Part P100, Assembly A200 och GA-001: högerklick på mått i blandat urval behåller vy och övriga ritobjekt; gemensamma kommandon visas och rotation är avstängd när vy ingår. Måttfilter öppnar måttmeny; måttpunkter läggs till/tas bort och borttagning är avstängd vid två punkter. Alla återställer grundurval efter måttändring. Single Part provade gemensam Flytta via menyn, textmeny, ramträffens vykommandon, tomytans Ritningslista och menyavvisning. Assembly verifierade klick utanför menyn utan ändrad markering. Inga JavaScript-fel observerades i dessa flöden.

Den första borttagningskontrollen använde befintlig native confirm och blockerade testwebbläsarens styrning. Menyn använder därefter programmets gemensamma bekräftelsedialog. Den sista webbläsarkontrollen av bekräfta/avbryt samt efterföljande Ångra är ännu inte utförd; motsvarande controllerflöde är verifierat med beteendetest. Full `npm run check` passerade med 1155 tester utan fel samt lint, formatering och produktionsbygge. Logg: `/tmp/lira-drawing-context-final-check.log`. Inte publicerat.

### Lokal axelspårning och gemensam feedback — 2026-10-19

Befintligt snapscenario har utökats med lokal X/Y/Z-spårning och axellås på ett snett arbetsplan, inklusive avvisning av Z för planbundna verktyg. `model-axis-feedback.test.js` skyddar samma arbetsplansbas för skapande, Polysweep, grepp, Move/Copy, oförändrat snapresultat, negativ axelriktning, skillnad mellan sned polar och axel, dolt fritt/noll/ändvy-resultat samt fast storlek på vinkel och linjeförlängning vid zoom.

Browserprov på separat, färsk localhost-origin: Sweep visade X-hjälplinje, axelbokstav och startvinkel; isometrisk vy provade X/Z-lås, manuell längd 1500 och rensning efter bekräftelse. Move visade Y och Copy X; numerisk Copy med avstånd 2000 skapade en kopia och tog bort överlägget. Ett slutpunktsgrepp flyttades med klick–dra–släpp och hjälpgrafiken försvann efter bekräftelse. Ett snett arbetsplan skapades med tre modellpunkter, varefter Sweep, Polysweep, Move, Copy och ett markerat grepp med Move visade automatisk lokal X-riktning. Axelbrickan mätte 21 × 21 px före och efter zoom; Esc tömde lagret. Inga JavaScript-fel rapporterades. Resultatbild: `/tmp/lira-axis-feedback.png`.

Full `npm run check` passerade med 1158 tester utan fel, lint, formatering och produktionsbygge. Logg: `/tmp/lira-axis-check.log`. En första testorigin hade gammal installerad offlinecache och användes inte som bevis för den nya koden; de verkliga proven kördes på en färsk origin. Inte publicerat.

### Turkos Nearest-kant i modell, ritning och IFC — 2026-10-19

Befintliga snap- och ritobjektsscenarier skyddar att den vinnande kanten följer med från native-/IFC-/ritningsgeometri och saknas när mittpunkt, Polar eller Otrack vinner. Referensindexets jämförelser täcker fortsatt kameror, placering, rotation, skalning, synlighet och arbetsområde. `nearest-feedback.test.js` skyddar projicerad/klippt kant utan ändrad källgeometri och samma mål/projektion i den delade målaren, inklusive kurvor och avvisade snaptyper. Det utökade CAD-inställningstestet skyddar att stängda ritningar inte ritas om och att inaktuella kantresultat rensas.

Browserprov på separat localhost med P100, A200 och GA-001 samt importerad `tests/fixtures/reference-box.ifc`: native modellkant visade en turkos linje under Nearest, samma kant behölls vid glidning och försvann utanför snapzonen. IFC-kant i modellen gav samma återkoppling; efter vald baspunkt tog Y-spårning över med noll turkosa kanter. Single Part provade både eget linjeobjekt och projicerad modellkant, Assembly provade linjeobjekt. Aktiverad Polar 45° ersatte kanten med den befintliga polarguiden.

IFC-referensen placerades inom GA-vyn och aktiverades via referensinspektorn. Nearest framhävde exakt den projicerade vänsterkanten. Efter förvärv av IFC-hörnet vann Otrack med grön guide och ingen turkos kant. Avstängd Otrack återgav Nearest, Esc tog bort återkopplingen och avstängd referenssnap gav ingen kant vid samma pekarläge. Resultatbilder: `/tmp/lira-nearest-model.png`, `/tmp/lira-nearest-ifc.png`, `/tmp/lira-nearest-drawing.png`, `/tmp/lira-nearest-ga-ifc.png`.

Provet hittade ett befintligt fel där ändrade delade CAD-inställningar ritade om en stängd Single Part-/Assemblyeditor. Rättningen provades genom Assembly → GA och upprepad Otrack-växling utan nya konsolfel. Tidigare fel låg kvar i webbläsarens historik. Full `npm run check` passerade med 1161 tester utan fel samt lint, formatering och produktionsbygge. Logg: `/tmp/lira-nearest-feedback-final-check.log`. Inte publicerat.
