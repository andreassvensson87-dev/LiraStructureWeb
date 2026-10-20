# Modellförslag till LiraStructures – version 2 (läser även version 1)

## Uppdrag till ChatGPT

Bearbeta användarens bifogade ritningar och modeller här i ChatGPT och leverera en nedladdningsbar `<projektnamn>.lira-import.json` som kan läsas av LiraStructures. AI-paketet är en instruktion och ett bibliotek, inte filen som ska importeras. Resultatfilen ska endast innehålla fälten i `schema`; kopiera inte med paketets `instructions`, `profiles`, `materials`, exempel eller annan metadata. Exempelobjekten är formatillustrationer och får aldrig läggas till användarens modell utan stöd i dennes underlag.

1. Inventera bifogade filer, ritningsnummer, revisioner, sidor och vilken del av byggnaden användaren vill modellera. Använd senaste uttryckligen angivna revision. Fråga vid motstridiga underlag; kombinera inte revisioner i tysthet.
2. Fastställ enheter, lokalt origo, X/Y-riktning och höjdnollpunkt. Ange dessa i svaret så att användaren kan granska placeringen. Om modellen ska passa en befintlig modell behöver användaren ange motsvarande lokala koordinater. AI-paketet innehåller inte det befintliga projektets geometri eller origo.
3. Läs plan, elevationer, sektioner och detaljmått tillsammans. Skriftliga mått går före mätning i bilden. Skilj överkant, underkant och centrumlinje; räkna om till profilens insättningslinje med verkliga profilmått. Härled inte pelartoppar eller balkcentrum enbart från en planritning. Skala inte en bild utan verifierad skala/referensmått. Vid bildmätning ska metod och osäkerhet redovisas per objekt i `assumptions`.
4. Skapa en objekttabell med källhänvisning, profil/material, start/slut eller plåtkontur och kvarstående frågor. Ställ samlade, konkreta frågor när avgörande information saknas. Är allt entydigt får du skapa filen direkt. Ett rimligt, uttryckligen godkänt antagande ska fortfarande dokumenteras i filen.
5. Modellera bara det som stöds: raka biblioteksprofiler, plana plåtar, Fit mellan raka profiler samt linje- och polygonskärningar enligt version 2 nedan. Redovisa alla utelämnade delar, hål, kapningar och kopplingar separat i svaret. Utelämnade bearbetningar ska märkas som förenkling i `assumptions`; dölj inte förenklingen. Ändra inte en böjd eller sammansatt del till en rak del utan användarens beslut.
6. Skriv filen med ett tillgängligt fil-/kodverktyg, läs tillbaka den och kontrollera att den är giltig JSON och följer schemat. Kontrollera även unika id:n, exakta biblioteksnamn, ändpunkter/längder, profilriktningar, höjder och plåttjocklekens sida. Ange vilka kontroller du faktiskt har utfört. Påstå inte att filen provats i appen om detta inte har gjorts.
7. Lämna en nedladdningslänk till JSON-filen och en kort sammanställning: antal per objekttyp, koordinatsystem, kvarstående antaganden, utelämnade delar och hur den importeras via Arkiv → Importera AI-modell. Leverera inte bara kod i ett kodblock. Om nedladdningsbara filer inte kan skapas i aktuell ChatGPT-session, säg det uttryckligen och erbjud komplett JSON som användaren kan spara själv.

### Läsa källfiler

PDF: kontrollera både renderade sidor och läsbar text när verktygen medger det. Ange faktisk sidposition i `source.page`, även när tryckt ritningssidnummer skiljer sig. Skannade/otydliga mått ska inte behandlas som säkra.

IFC: använd en faktisk IFC-läsare om den finns tillgänglig. Hantera placeringarnas hierarki, enheter, lokala axlar och geometri. Behåll ursprungligt GlobalId i `source.elementId`. Importera endast element som verkligen kan beskrivas med v1-formatet. Ett namn som innehåller en profilbeteckning bevisar inte elementets geometri.

DWG/DXF: kontrollera att ett fungerande läsverktyg finns innan du lovar tolkning. En 2D-linje räcker inte för att avgöra 3D-höjd eller profil. Om DWG inte kan läsas, be om DXF eller måttsatt PDF; om IFC inte kan läsas, be om en läsbar export med geometri och placeringar. Påstå aldrig att en fil har lästs när verktygsstöd saknas.

### Bibliotek och saknade namn

Paketets `profiles` och `materials` är en biblioteksögonblicksbild. Använd exakt `name` i resultatfilen; lägg inte till definitioner eller interna biblioteks-id:n i objekten. Finns profil eller material inte i listan: fråga användaren. Föreslå att biblioteket kompletteras i LiraStructures och att ett nytt AI-paket hämtas. Byt inte till en närliggande storlek eller stålsort. Om användaren vill ha en delimport ska uteslutna delar redovisas tydligt. Parametrar och `boundsMm`, när de finns i paketet, beskriver profilens tvärsnitt i mm och får användas för omräkning från kantmått till insättningslinje.

## Arbetsflöde

Öppna Arkiv → Importera AI-modell. Hämta **AI-paket** i fönstrets vanliga menyblock. Paketet innehåller denna instruktion, JSON-schema, en exempelmodell och namn/identiteter för appens aktuella profiler och material. Ge paketet och källunderlagen till ChatGPT. Ingen AI-tjänst anropas av appen.

Be ChatGPT: ”Analysera underlagen enligt instruktionen i detta AI-paket. Fråga efter information som saknas. Skapa sedan en nedladdningsbar .lira-import.json-fil enligt schemat. Ange alla kvarstående antaganden per objekt och behåll stabila importId och objekt-id vid rättningar.”

Välj resultatfilen eller dra den till modellvyn. Granska tabell och förhandsvisning, kryssa ur delar och kontrollera antaganden. Profil och material kan väljas från appens befintliga biblioteksväljare om ett namn saknas eller är tvetydigt. Bekräfta med Importera valda. Avbryt/Esc tar bort förslaget. Importen skapar vanliga modellobjekt med ett ångringssteg och ändrar inga befintliga delar, ritningar eller projektinställningar.

## Instruktion till den som skapar filen

- Returnera ren UTF-8 JSON i en fil med ändelsen `.lira-import.json`, utan Markdown eller körbar kod. Högst 10 MB och 1 000 objekt.
- Använd `format: "lira-model-import"`, `version: 2`, `units: "mm"`, `coordinates: "local-z-up"`.
- `importId` identifierar samma modellförslag även efter rättningar. Varje del har ett unikt, stabilt `id`. Återimport av redan inlagda id:n blockeras, även efter spara/öppna. Detta är en tilläggsimport, inte synkronisering eller uppdatering. Ångra importen innan korrigerade delar importeras på nytt. Nya delar i samma förslag kan importeras senare.
- Ange `name`, exakt biblioteksnamn i `material` och en `source` med `file`. Lägg vid behov till `page` (1-baserat), `detail` och `elementId` (t.ex. IFC GlobalId). Källhänvisningar är text, inte inbäddade källfiler.
- Ange valfri `ifcClass` för delens roll enligt appens befintliga IFC-klasser: exempelvis `IfcColumn` för pelare, `IfcBeam` för balkar och `IfcPlate` för plåt. Både balkar och pelare är vanliga `sweep`-objekt; IFC-klassen ändrar inte geometrin. Utan fältet används objekttypens vanliga förval, vilket för Sweep är `IfcBeam`. Klass ska därför anges uttryckligen för pelare. Ogiltiga klasser avvisas av modellens befintliga validering; inga roller härleds automatiskt ur objektnamn.
- Använd endast namn från paketets bibliotek. Namn matchas utan skillnad på stora/små bokstäver och blanksteg. Familj, liknande storlek eller materialtyp räcker inte. `S355` ersätts exempelvis inte automatiskt med `S355J2`.
- Samtliga längder och koordinater anges i millimeter, vinklar i grader. Z är uppåt. Rita i projektets lokala koordinatsystem. Inga georefererade koordinater eller automatiska enhetsbyten stöds. Koordinater måste ligga inom ±10 000 000 mm.
- Saknade/antagna uppgifter ska anges i `assumptions`, högst 20 texter à 500 tecken per objekt. Sådana delar är förvalda tillsammans med övriga giltiga delar. Appen visar en gemensam sammanfattning av de valda delarnas antaganden före slutlig import; inga separata godkännanderutor behövs. Om placering, profil eller dimensioner inte går att fastställa till ett meningsfullt förslag, fråga användaren innan filen skapas. Gissa inte dolda kopplingar, hål eller kapningar.
- Använd IFC-/CAD-läsverktyg för exakta geometrier när de finns tillgängliga. PDF-plan, sektioner, mått och texter måste läsas tillsammans. Filen är ett modellförslag, inte ett intyg om underlagets fullständighet eller bärförmåga.

## Sweep – rak profil

Obligatoriska fält: `id`, `type: "sweep"`, `name`, `profile`, `material`, `start`, `end`, `source`. Start och slut är `[x,y,z]` på profilens insättningslinje; minst 1 mm avstånd. Profilen kommer från biblioteket med senaste tillgängliga revision och sparas som en fristående definitionsögonblicksbild på objektet.

`rotation` är profilrotation i grader, standard 0, enligt högerhandsregeln kring start→slut. `profileUp` är valfri referensriktning för profilhöjden; standard `[0,0,1]`. LiraStructures beräknar tvärsnittsaxlar enligt sin vanliga Sweep-regel. Om längdaxeln är parallell med referensriktningen används befintlig reservriktning: lokal breddaxel blir global X för en lodrät del. Använd en uttrycklig icke-parallell `profileUp` om orienteringen är viktig.

Insättningen använder bibliotekets profilankare med vanlig centrerad placering. V1 har inga extra insättningsoffsets eller alternativa kantjusteringar. Ändpunkterna är ämnets ändar före Fit och skärningar. Beskriv bearbetningar som separata objekt; flytta inte dessutom ämnesändarna för samma Fit. Profilens rundningar kommer från biblioteket; AI ska inte skriva egna triangelnät.

## Plate – plan plåts grundform

Obligatoriska fält: `id`, `type: "plate"`, `name`, `material`, `frame`, `polygon`, `thickness`, `side`, `source`.

`frame` innehåller `origin: [x,y,z]` i mm samt ortogonala enhetsvektorer `u` och `v`. `polygon` innehåller 3–1 000 lokala `[u,v]`-koordinater i mm. Världspunkt = origin + u × lokalX + v × lokalY. Upprepa inte första hörnet sist. Konturen ska vara enkel, sluten och utan korsningar. Normal = u × v. `side` är `positive`, `negative` eller `center`, och anger om tjockleken ligger på normalens positiva sida, negativa sida eller symmetriskt om planet. Tjockleken är 1–10 000 mm. Grundkonturen innehåller inga hålslingor; utskärningar beskrivs som separata polygoncut. Krökta plåtar och sammansatta grundkonturer stöds inte.

## Fit och skärningar – version 2

Använd `version: 2` när bearbetningar finns. Version 1 fortsätter att läsas för äldre filer med enbart sweep och plate. Alla delar och bearbetningar ligger i samma `objects`-lista, i valfri ordning. Även bearbetningar har `id`, `name`, `source` och vid behov `assumptions`, men INTE `material`, `profile` eller `ifcClass`.

Referenserna är de externa `id` som står på delar i samma fil. Appen mappar dem till sina interna id:n. Referera aldrig till interna id:n, skärningar, andra Fit eller delar som inte finns i filen. Version 2 stöder bearbetning av nyimporterade delar i samma batch, inte uppdatering av tidigare importerade delar. Väljs en nödvändig del bort markeras beroendet som olöst; återvälj delen eller välj bort bearbetningen. Bortvalda bearbetningar påverkar inte förhandsvisningen eller den importerade geometrin.

### Fit – mot del eller gering

Fält: `type: "fit"`, `references: ["P01", "B01"]`, `mode: "abut"` eller `"miter"`, `endA: "start"` eller `"end"`, `endB: "start"` eller `"end"`, `gap` i mm (0–1000). Båda referenserna måste vara raka sweeps med olika längdriktningar. Appen använder den befintliga Fit-kopplingen, som följer delarna när de redigeras.

För `abut` är första referensen den genomgående delen, andra referensen den inkommande delen som ändanpassas. `endB` anger dess anslutna ända; `endA` anges också men kapar inte den genomgående delen. Anslutningen måste ligga längs den genomgående sweepen. Fit använder den genomgående profilens yttre tvärsnittsgräns och väljer sidan från inkommande delens riktning. Det är INTE ett val av en godtycklig namngiven flänsyta. Säkerställ därför profilrotation och läge i underlaget så att denna sida motsvarar önskad anslutning. Saknas tvärgående profilöverlappning redovisas en varning bland antagandena.

För `miter` geras de två angivna ändarna med ett gemensamt plan; gap fördelas mellan dem. Parallella delar och godtyckligt fristående Fit-plan stöds inte av den befintliga Fit-funktionen. Använd `linecut` för ett uttryckligt kapplan. Skapa inte flera motstridiga Fit på samma ända.

### Linecut – oändligt kapplan

Fält: `type: "linecut"`, `targets: ["B01"]`, `frame` med `origin`, `u`, `v`, `polygon` med exakt två lokala `[u,v]`-punkter samt `side: "positive"` eller `"negative"`. Ramens u/v är ortogonala enhetsvektorer, punkterna minst 1 mm isär. Samma ramregler och koordinatgränser som för Plate gäller.

Skärlinjen i världen har riktning d = u*(x2-x1) + v*(y2-y1). Kapplanets normal är normalize(d × (u × v)). `positive` tar bort sidan i denna normals riktning, `negative` den motsatta. Verktygets ändliga visningsrektangel begränsar INTE kapplanet.

Exempel: `frame: {"origin":[0,0,0],"u":[1,0,0],"v":[0,0,1]}`, `polygon: [[0,3340],[6000,3340]]`, `side: "negative"` tar bort material över Z=3340. Beräkna och kontrollera den borttagna sidan; omvänd punktordning ändrar tecknet.

### Polygoncut – urklinkning eller utskärning

Fält: `type: "polygoncut"`, `targets: ["B01"]`, `frame`, `polygon` (3–1000 punkter), `thickness` och `side` enligt Plate. Denna volym SUBTRAHERAS från målobjekten. `positive`/`negative`/`center` anger verktygets extrusionssida längs u × v, inte vilket material som behålls. Material behövs inte för ett skärverktyg.

För en öppen urklinkning ska verktyget gå utanför delens ända och yttre yta. Vid genomgående skärning ska djupet täcka hela delens bredd. Beskriv överskjutningen uttryckligen i källhänvisningen. Enbart tangerande verktyg kan ge otydlig boolesk geometri; använd en liten dokumenterad överskjutning. Skapa inte fristående plåt i stället för skärverktyg.

Paketets exempel visar två HEA 200-pelare och en IPE 300-balk, två Fit med 5 mm spalt samt en öppen urklinkning 200 × 80 mm. Exemplet är syntetiskt; återanvänd aldrig dess geometri som fakta om användarens modell.

## Begränsningar och kontroll

Schemafilen beskriver strukturen; appen kontrollerar också native geometri, bibliotek, referenser, dubbletter och granskningsbeslut. Okända fält och objekttyper avvisas. Felaktiga objektrader undantas. En vald bearbetning med bortvald referens blockerar importen tills urvalet rättats. Filer med fel version/enhet eller dubbla externa id:n stoppas helt. Import är fortfarande tillägg, inte synkronisering. Alla valda delar och bearbetningar importeras i en transaktion som kan ångras i ett steg.

Ritningstolkningen görs i ChatGPT med de verktyg som faktiskt finns i den sessionen. Appen anropar ingen AI-tjänst. Skruvar, automatiska förband, böjda profiler och generell IFC-konvertering ingår inte i detta importformat. Befintlig IFC-konvertering är ett separat flöde. Geometrin från Fit/skärningar ska granskas i appen; formatet är inte ett intyg om bärförmåga eller tillverkning.
