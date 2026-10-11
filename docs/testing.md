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
