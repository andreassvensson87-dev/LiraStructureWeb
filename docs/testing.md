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
