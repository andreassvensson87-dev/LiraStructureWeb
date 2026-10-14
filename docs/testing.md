# Teststrategi

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
