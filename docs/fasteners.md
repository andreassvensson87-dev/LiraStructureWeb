# Skruvar, bibliotek och kopplade hål

Alla bibliotekseditorer nås från **Inställningar → Bibliotek**. Den gemensamma
ingången registreras i `src/main.js`; varje bibliotek behåller sin egen editor
och lagring. Nya bibliotek kan läggas till med grupp, namn, beskrivning och
öppningsfunktion. Skruvbiblioteket finns även direkt från skruvplaceringen.

Modulen finns i `src/fasteners/` och ingår i programmets huvudgren.
Bibliotek, geometri, placering och relationsregler är samlade i denna modul.

## Gemensam grund för stålförband

Biblioteket stöder träskruv, skruv med mutter, gängstång utan huvud och betongskruv.
Skruv med sexkantshuvud kan klassas som ISO 4014 eller ISO 4017. Gänglängd från
spetsen och valfri stigning lagras separat: ISO 4014 behöver en ogängad skaftdel,
ISO 4017 och gängstänger är helgängade. Hållfasthetsklass, ytbehandling,
tillverkare och artikelnummer kan sparas och tillverkare/artikel ingår i sökningen.
Måtten anges av användaren; standardvalet fyller inte en verifierad måttabell.
Gängorna visas med förenklat skaft, utan tung spiralgeometri.

Betongskruvens `anchor` lagrar förankringsdjup, borrdiameter och borrdjup för vald
produkt. Dessa är separata från frigångshålets `holeDefaults` i stålplåten.
Förankringsdata visas i inspektorn men skapar ännu inte automatiskt ett separat
betongborrhål och används inte för bärförmågeberäkning.

Ett förband kan ha en explicit `accessories`-lista med muttrar och brickor.
Varje läge mäts från skaftets start längs axeln; tillbehören använder förbandets
sparade mutter- och brickmått. Inspektorn kan lägga till, flytta och ta bort dem.
Gängstångens `startAllowance` ger utstick före första materialytan, så att muttrar
och brickor kan ligga på båda sidor om en plåt. Ogiltiga lägen, överlappande
tillbehör och muttrar utanför gängad del stoppas innan förbandet sparas.

Den gemensamma läsningen och valideringen finns i `src/fasteners/accessories.js`
och används av geometri, placering och detaljidentitet. Kopplingsgeneratorer kan
skapa samma objekt utan en separat modell för skruvar. Äldre `nutOffset` och
`washers` läses fortsatt; deras detaljidentitet behålls. Placerade förband äger en
specifikationskopia och ändras inte av en ny biblioteksversion. Import jämför
versionsinnehåll oberoende av JSON-fältordning och stoppar verkliga konflikter.

## Exempelmodell

**Inställningar → Projekt → Läs in skruvexempel** läser in tre färdiga förband:
trä med frigångshål och förborrning, två plåtar med M12 och brickor på båda sidor,
samt en anslutningsplåt mot RHS med både två rörväggar och endast övre väggen.
Modellen har 17 numrerade objekt, varav 11 skruvar, med fristående material- och
skruvspecifikationer. Ingen biblioteksimport behövs. Måtten är demonstrationsvärden.
Inläsningen ersätter sessionsmodellen och kan ångras som en enda operation.

## Stommodell för prestandatest

**Inställningar → Projekt → Storlek → Läs in stommodell** skapar en stålstomme
med pelare, I-balkar, förbandsplåtar, M20-skruvar, brickor, bjälklag, väggpaneler
samt grundplintar och fotplåtar. Varje balk har två skruvförband med fyra skruvar
per ände. Hålen bearbetar både plåten och balkflänsarna.

| Storlek         | Mått      | Plan | Objekt | Skruvar | Borrhål |
| --------------- | --------- | ---- | ------ | ------- | ------- |
| Liten           | 18 × 12 m | 2    | 454    | 272     | 544     |
| Stor            | 30 × 24 m | 3    | 1 881  | 1 176   | 2 352   |
| Prestandamodell | 48 × 36 m | 4    | 5 522  | 3 520   | 7 040   |

Identiska balkförband delar förberäknad bearbetad geometri vid inläsningen.
Varje del, skruv och borrhål har ändå egen identitet. Ändrade hålkopplingar
invaliderar den förberedda geometrin.

Statusraden visar uppbyggnadstiden för modellskapande och scenens geometri,
inte ett FPS-mått. Rotera, zooma, markera, isolera, redigera och skapa ritningar
för att testa andra arbetsmoment. Numrering körs separat för dessa modeller.
Måtten och förbanden är demonstrationer; inga konstruktionsberäkningar görs.

## Användning

1. Öppna **Inställningar → Bibliotek → Skruvar**. Skapa egna poster för träskruv eller
   skruv med mutter. Ange diameter, längd under huvud och huvudmått. För skruv med
   mutter anges också mutterns nyckelvidd och tjocklek; nominell diameter är samma
   som skruvens. Under **Hålstandard** väljs ingen borrning, förborrning/blindhål
   eller frigång/genomgående, med diameter och djup samt valfri försänkning.
   Dessa mått är egna värden, inte automatiskt dimensionerade rekommendationer.
   Biblioteket innehåller inga verifierade standardprodukter.
2. Välj **Skapa → Skruv** och bibliotekspost i inspectorn. Klicka på delarna
   direkt i modellen; de markeras och visas under **Objekt i förbandet**.
   Ett nytt klick på en vald del tar bort den. Tryck **Enter** för att bekräfta
   och börja placera. Minst en del måste väljas. **Escape** avbryter.
3. Klicka två punkter längs skruvaxeln. Punkterna anger riktningen och får ligga
   utanför materialet. Programmet hittar ytorna i de uttryckligen valda delarna,
   placerar huvud, mutter och brickor och visar förbandet. Bekräfta med **Skapa
   skruv och hål** eller Enter. Biblioteket anger fysisk skruvlängd; för kort
   skruv ger ett fel med möjlighet att välja en längre post.
4. Valda delar visas som hopfällda rader med håltyp och diameter. Bibliotekets
   hålstandard används automatiskt. Öppna en rad för egna hålmått eller **Närmaste
   vägg / fläns** för endast en rörvägg. **Hela profilen** omfattar båda väggarna.
   Träskruvens automatiska hål begränsas av materialet och skaftets längd.
   Blindhålets biblioteksdjup är ett maximalt djup och kortas vid materialets slut.
   Manuella start- och djupmått är en uttrycklig överstyrning.
   Under **Begränsa vilka lager som ingår** finns en valfri söklängd som mäts
   från första materialytan, oberoende av klickpunktens avstånd. Väggar som
   träffas tas med i sin helhet. Delar bortom denna begränsning behåller sin
   koppling men får inga aktiva automatiska hål.
5. Skapa skruven. Vid markering redigeras skruven direkt i inspectorn med
   utfällbara grupper för placering och hål. Klicka **Spara skruv och hål** för
   att tillämpa ändringarna. En markerad del
   visar också sina skruvkopplingar. Hålen visas i 3D och Single Part. Ritnings-
   inspectorn visar hålmått och centrum i detaljens lokala koordinater.

Biblioteket lagras separat i webbläsaren och kan exporteras/importeras som JSON.
Redigering skapar en ny version. Placerade skruvar lagrar egna kopior av sina
biblioteksposter och ändras först när en annan version väljs för skruven.
Modellen och ritningarna är fortfarande sessionsdata.

## Relationsregler

- Skruv och mutter är ett modellobjekt. Mutterns läge längs skaftet kan ändras.
  Visningsgeometrin har skaft, huvud, mutter och valbara plana brickor med hål;
  inga gängor. Ange brickans innerdiameter, ytterdiameter och tjocklek i
  biblioteket, och välj **Under huvud** och/eller **Vid mutter** i inspectorn.
  Brickan under huvudet börjar vid skruvens referenspunkt och bygger inåt längs
  skaftet. Brickan vid muttern ligger direkt framför muttern. Mutterläge och
  hålstart mäts fortfarande från under huvudet; bricktjocklek kan därför kräva
  ändrade lägen. Plan bricka under huvudet kräver cylinder- eller sexkantshuvud.
- Hål är parametrisk bearbetningsinformation på skruven, med måldelens ID.
  Modellens gemensamma geometriutvärdering subtraherar dessa volymer från delen.
  Hål skapar inga separata skärvolymer i modellträdet.
- Skruven följer sin valda referensdels lokala ram vid flytt och rotation.
  En explicit flytt/rotation av skruven i samma operation har företräde så att
  den inte flyttas två gånger. Övriga delar är inte mekaniskt låsta till förbandet.
  Flyttas de separat måste hålens läge kontrolleras.
- Kopiering av delar och skruvar tillsammans kopplar om skruvkopiornas referenser
  till kopierade delar. En ensam skruvkopia behåller sina delreferenser. Kopiering
  av enbart en del skapar inte automatiskt nya skruvar eller deras hål.
- Borttagning av skruven återställer materialet. Borttagning av en del tar bort
  dess koppling; försvinner referensdelen väljs nästa kvarvarande del. Skruven
  blir fristående om ingen delkoppling finns kvar. Modelländringar ingår i ångra/
  gör om; bibliotekets versionshistorik lagras separat.
- Håldiameter, djup, läge, riktning och försänkning ingår i detaljens
  tillverkningsidentitet. Uppdatera numreringen före ändrade Single Part-ritningar.

## Avgränsning och återställning

Modulen har små anslutningar i objekttypsregistret, modellens geometriutvärdering,
numrering, transformationer/grepp, borttagning, verktygslåda och Single Part.
Geometri och relationsregler är separerade från UI och bibliotekslagring.
Integrationen har en separat merge-commit som vid behov kan återställas med
`git revert -m 1 <merge-commit>`. Tidigare biblioteksversioner finns kvar i
webbläsarens separata lagring. Ingen migrering av gamla projektformat ingår.

Bärförmågedimensionering av skruvar, produktkataloger, spiralformade gängor,
automatisk hålmåttsättning på bladet och stora prestandamätningar ingår
inte i denna första implementation. Hålens konturer finns i ritningsgeometrin;
befintliga ritningsverktyg kan användas för lägesmått.

## Visuella förbandsval och automatisk längd

Inspektorns schematiska bild och kryssrutor väljer brickor och muttrar vid
materialytorna. Gängstång kan ha mutter på båda sidor och extra mutter på
slutsidan. Manuella tillbehörslägen finns under avancerade val; äldre förband
behåller sina manuella lägen tills användaren väljer visuella förbandsval.

Skruv med mutter kan automatiskt välja kortaste passande bibliotekslängd med
plats för material, valda tillbehör och extra utstick. Muttrarna måste ligga på
gängad del. Samma serie kräver samma diameter, standard, huvud, mutter, bricka,
gängstigning, tillverkare, hållfasthetsklass och ytbehandling. Egna produkter
utan standard grupperas med bibliotekets fält **Serie**, annars med eget id.
Inga nya produktlängder eller mått uppfinns. Gängstång och betongskruv behåller
manuellt längdval.

Förbandet sparar valen i `assembly`, längdläget i `lengthMode` och en kopia av
seriens tillgängliga specifikationer i `lengthOptions`. Ändrad materialtjocklek
räknar om lägen och längd från dessa kopior även utan lokalt bibliotek. Vid
redigering kan nya biblioteksalternativ läggas till. Om ingen längd passar visas
ett fel före sparande. Det här väljer geometrisk längd och kontrollerar
muttrarnas placering; det beräknar inte förbandets bärförmåga.

## Skruvgrupper

**Skapa → Skruvgrupp** återanvänder skruvverktygets flöde: välj delarna,
bekräfta med Enter, klicka första skruvens insättningspunkt och därefter en
riktningspunkt längs skruvaxeln. Mönstret visas i modellen före bekräftelse.
Inspektorn har antal rader/kolumner, positiva X/Y-avstånd och rotation kring
skruvaxeln. Första skruven är mönstrets hörn; X är modellens X-riktning
projicerad på gruppplanet när det är möjligt, Y är vinkelrät mot X och axeln.
En schematisk mönsterbild markerar första skruven i grönt. Högst 100 skruvar
kan ingå i en grupp.

Klick på en skruv markerar gruppens alla skruvar och öppnar deras gemensamma
inspektor. **Modifiera skruvgrupp** sparar mönster, skruvspecifikation, tillbehör
och hålval i en transaktion. En befintlig enskild skruv kan göras till grupp med
inspektorns kryssruta. Befintliga rad/kolumn-positioner behåller skruv- och
borrhåls-ID:n när mönstret ändras; nytillkomna får nya ID:n och borttagna
positioner förlorar sina hål. Flytt, rotation, kopiering och borttagning gäller
hela gruppen. Kopior får ett separat grupp-ID. Referensdelens transformation
flyttar även gruppens koordinatsystem.

Varje position räknas mot materialet där dess axel passerar och kan välja en
annan bibliotekslängd. Valda delar som en position missar behålls som referenser
men borras inte där. En position som inte träffar något material, eller saknar
passande skruvlängd, stoppar hela ändringen och anger rad/kolumn. Ändring av
materialet räknar om de berörda skruvarna även efter att projektet öppnats igen.

Modellen består fortsatt av vanliga skruvobjekt med egna hål för geometri,
numrering och ritningar. `group` lagrar gemensamma mönsterdata och varje skruvs
rad/kolumn. Projektinläsningen avvisar ofullständiga eller motsägande grupper.
Gruppen är ett geometriskt mönster; kantavstånd och förbandets bärförmåga
kontrolleras inte automatiskt.

## Automatisk placering och borrhål som underobjekt

Nya skruvar söker längs hela axeln i valda delar. Klickavståndet begränsar inte
sökningen. Skruvaxeln måste skära varje vald del; ett verkligt missat objekt
anges i felmeddelandet. Tomrum räknas inte som materiallager. Valfri söklängd
mäts från första materialytan och väljer kompletta lager. För träskruv gäller
också skaftets fysiska räckvidd. Ingen automatisk längdändring görs.

Mutter och brickor placeras vid första och sista ingående materiallagret.
Plana brickors anliggning på sneda ytor måste fortfarande kontrolleras.
Punkter, brickor och särskilda hålinställningar kan ändras i inspectorn.

Borrhålen är parametriska underobjekt i skruvens `holes`-lista, med typen `bore`,
beständigt ID och måldel. De redigeras per del i skruvinspectorn. Geometrin och
Single Part härleds från samma poster. Omordning eller borttagning av ett annat
hål ändrar inte deras identitet; kopiering ger nya ID:n. De är inte separata
objekt i huvudmodellistan. IFC-export ingår inte ännu; underobjekten ger en grund
för att senare exportera hål med stabil identitet och koppling till borrad del.

Modellvyn visar borrhålen som förenklade mörka volymer med 24 segment. Delens
visningsgeometri borras inte ur; vanliga skärningar behålls. Volymerna följer
materiallagren och lämnar profilernas hålrum fria. De är visningsmarkeringar:
markering och klick använder delens förenklade kropp, så ett klick genom ett
visat hål kan välja delen. Transparent visning visar även hålvolymen inne i delen.
Ritningar och snitt använder fortfarande exakt borrad geometri som beräknas
separat vid behov. Hål bidrar bara med centrum till snap i modellvyn och
ritningarnas punktunderlag; konturernas trianguleringspunkter används inte.

Identiska skruvar återanvänder en lokal geometrimall och renderas som instanser
när modellen är stor. Placering, färg, val och detaljvisning vid zoom gäller
fortfarande per skruv. Hålmarkeringarna grupperas i en gemensam geometri med
separata triangelområden per del. Dolda delar får degenererade trianglar och
transparent visning sorterar områdena efter kameradjup. En håldiameterändring
uppdaterar bara berörda områden när antalet trianglar är oförändrat; förändrade
former eller objektantal bygger om grupperna. Ritningsgeometrin och hålens
centrumreferenser använder samma modellvärden som tidigare.

Vid modelländringar ligger återanvända scenobjekt kvar på samma förälder.
Endast ändrade eller borttagna objekt kopplas ur, och nya objekt läggs till.
Det undviker att en liten förbandsändring kopplar ur och återansluter hela
modellen. Modellens objektordning behålls även vid flytt och ångra/gör om.
Objektlistan återanvänder också sina rader och grupper när beteckning, namn,
typ, material, profilnamn och objektordning är oförändrade. Urval och
synlighetsknappar uppdateras ändå. Sökning, gruppering och ändrade listuppgifter
bygger om listan; en håldiameterändring behåller dess DOM och scrolläge.

## Kontrollerat projektflöde

Automatiska förband räknas om mot hela den föreslagna ändringen när skruven,
anslutna delar eller skärningar ändras. Håldjup och mutter-/brickläge följer
materiallagren. Referensdelens flytt och rotation bär skruvens insättningsaxel;
explicit skruvflytt har företräde. Om axeln missar en vald del eller skruven blir
för kort avvisas ändringen innan den sparas. Manuella hål behåller sina mått.

Single Part visar centrumkors i vyer vinkelräta mot hålen. Måttkedjor kan snappa
till dessa centrum med referenser till hålens beständiga ID, oberoende av hålets
triangulering och diameter. Borttagna hål ger brutna måttreferenser. Automatisk
hålmåttsättning och diametertext på själva bladet återstår; diameter, håldjup
och lokala centrumkoordinater visas i ritningsinspectorns hållista.

Inställningar → Projekt har Spara projekt och Öppna projekt. Projektfilerna
innehåller skruvspecifikationerna som faktiskt används, underobjektens ID:n och
ritningarnas redigerbara data. Filen valideras före inläsning. Öppna kan ångras.
Separata oanvända bibliotek, referens-IFC-filer och kameravy ingår inte.

`tests/joint-workflow.test.js` täcker lager och brickor, tjockleksändring,
flytt/rotation, kopiering, borttagning, numreringsstatus, borrkonturer,
centrumreferenser, filåteröppning och ångra/gör om. En isolerad koppling från
stomexemplet kontrolleras också genom projektfil och detaljritningsdata.

## Detaljnivå i modellvyn

Skruvar behåller sin tidiga visningsgräns på 1,5 skärmpixlar. Små
hålmarkeringar döljs under 1,5 pixlar och återkommer vid 2,5 pixlar. För delar
med flera hål används den största håldiametern, inklusive försänkning, för
hela delens markering. Centrumreferenserna finns kvar i snapunderlaget.

Balkar och pelare med mer än tolv trianglar växlar till en enkel lokal
omslutande låda när tvärsnittets största yttermått understiger sex pixlar.
Full profil återkommer vid nio pixlar. Olika gränser vid in- och utzoomning
motverkar flimmer. Enstaka valda objekt visas med full detalj. Vanliga
skärningar och redigeringsförhandsvisningar behåller sin detaljerade geometri.

Översiktsformerna delar geometrimallar och renderas som instanser i större
modeller. Dolda instanser och hålområden skickas inte till rendering.
Växlingen beräknas om när zoom, fönsterhöjd, urval eller modell ändras; ren
kamerarotation kräver ingen ny detaljnivåkontroll. Objektval, snap och
ritningar använder fortfarande sitt befintliga geometriunderlag.

## Mätning av verkliga förbandsändringar

I utvecklingsservern aktiverar `/?performance=1` en lokal mätpanel efter klick
på Spara skruv och hål, Ångra eller Gör om. Den mäter från klickhanteraren till nästa WebGL-inlämning,
inklusive validering, modelltransaktion, historik, scenobjekt, snapindex,
objektlista och övrig UI. Nästa animationscallback redovisas separat som en
ungefärlig möjlighet att visa den nya bilden, inte som GPU-slutförande eller
fysisk bildpresentation. Inmatningens tidigare förhandsvisning ingår inte.
Mätningen aktiveras inte i produktionsbygget.

Den 4 oktober 2026 kontrollerades fem ändringar av första hålets diameter
22/24 mm på SK-001 i stresstestets 19 212 objekt, homogen översiktsvy vid
1280 × 720. Medianen från sparaklick till WebGL-inlämning sjönk från 357 till
246 ms efter återanvändning av objektlistan. Listans median sjönk från 81 till
4 ms. Nästa bildgräns sjönk från 417 till 293 ms. Historiksnapshotten var
därefter största uppmätta delkostnaden, cirka 93 ms. Ångra och gör om
kontrollerades separat i samma appmodell. Råvärden finns lokalt i
`artifacts/interaction-app-before.json` och `artifacts/interaction-app-after.json`.

Historiken återanvänder nu egna frysta objektkopior mellan steg. Ett innehålls-
fingeravtryck kontrolleras vid varje snapshot, även för nästlade ändringar
på samma levande objekt. Specifikationer, material och profildata delar sina
ägda kopior. Övriga projektvärden kopieras fortfarande. Vid ångra/gör om
återanvänds endast levande objekt vars kontrollerade kopia är exakt den som
ska återställas; ändrade objekt får nya muterbara kopior. Historikdata lämnas
aldrig som muterbara modellvärden. Full modellinläsning förbereder kopiecachen,
vilket ger extra uppbyggnad där och gör första redigeringen snabbare.

En ny jämförelse samma dag med fem sparanden gav median 81 → 69 ms för
historiken och 206 → 186 ms från klick till WebGL-inlämning. Ångra av sista
håldiameterändringen tog 6119 → 243 ms i appen. Antalet nya scenobjekt sjönk
från 19 212 till 3, med 19 209 återanvända objekt. Gör om kontrollerades till
263 ms och återställde Ø24 efter att ångra återställt Ø22. Dessa enskilda
återställningsmätningar är inte medianer. Råvärden finns i
`artifacts/history-app-before.json` och `artifacts/history-app-after.json`.

## Historik under längre sessioner

Historikens objektlistor delar nu frysta block med 128 objekt mellan steg.
Endast block som ändras får nya referenslistor. Snapshotten behåller sitt gränssnitt med en fryst
objektarray; arrayen skapas först när en läsare behöver den.

`npm run benchmark:history -- --size stress --edits 100 --output artifacts/history-memory-after.json`
kör 200 verkliga håldiameterändringar i 19 212 objekt med 100 historiksteg,
ångrar och gör om alla 100 steg och kontrollerar att en ny gren rensar gör om.
Minnet mäts efter två explicita skräpinsamlingar i Node/V8. DOM, rendering,
GPU och webbläsarens totala processminne ingår inte.

Den 4 oktober 2026 sjönk kvarvarande JavaScript-heap efter 100 ändringar
från cirka 146 till 132 MiB. Ytterligare 100 ändringar höll samma nivå med
100 sparade steg. Efter att historiken släppts återstod cirka 58 MiB,
jämfört med 57 MiB för modellen före historikens uppbyggnad. Processens RSS
behöver inte minska samtidigt som JavaScript-värden frigörs. Råvärden finns i
`artifacts/history-memory-before.json` och `artifacts/history-memory-after.json`.
Medianen för checkpoint var 79 → 80 ms, ångra 88 → 89 ms och gör om
87 → 89 ms i samma Node-test. Minnesvinsten innebär alltså ingen uppmätt
CPU-förbättring; svarstiderna ligger nära föregående version.

## Minnestest av modellvyn

`/?memory=1` i utvecklingsservern visar ett separat test för en tom testflik.
Knappen ersätter modellen och kör samma validerade skruvsparande,
modelltransaktion, historikåterställning, UI-uppdatering och WebGL-rendering
som appen. Testet gör 600 håldiameterändringar, 100 ångra, 100 gör om och
åtta modellinläsningar. Tre byten tillbaka till stresstestets 19 212 objekt
följs av 100 ändringar vardera, så att tidigare modeller lämnar historiken.
Sist läses den lilla modellen med 454 objekt in och historiken fylls med
100 små ändringar. Testet finns bara i utvecklingsservern.

Testet den 4 oktober 2026 hittade cirka 1 426 636 800 byte upprepade
geometribuffertar för skruvar. Visningen delade redan lokala mallar, men
displaycachen byggde dessutom en separat geometri i världskoordinater per
skruv. Cachen behåller nu mall, placering och omslutande låda. Fulla
världskoordinater skapas först när en läsare behöver dem. Objektvalets
första kontroll och snapindexets skärmavgränsning använder lådan. Exakt
ytval, ritningsgeometri och vanliga skärningar behåller sina geometrier.

I samma två fullständiga appkörningar sjönk Chrome-mätningen direkt efter
stor modellinläsning från 2046 till 678 MiB. Efter de tre stora modellbytena
låg den nya versionen på 695, 695 respektive 711 MiB. Uppladdade
WebGL-geometrier höll sig på 48 vid skruvredigering och gick ner till 33
för den lilla modellen. Antalet shaderprogram höll sig på fem och antalet
texturer på noll. Modellflikens observerade process-RSS-topp sjönk från
4827 till 2584 MiB, ungefär 4,7 till 2,5 GiB.

Chrome `performance.memory` är en ungefärlig mätning med naturlig
skräpinsamling. Ingen insamling tvingades fram. RSS inkluderar processens
residenta minne och eventuellt delade sidor; delad GPU-process och
webbläsarens övriga processer ingår inte. Processerna identifierades genom
minnesökningen vid känd modellinläsning, eftersom en ny IAB-panelprocess
kan vara en annan process än innehållets renderer. Den första RSS-loggen
började efter initial inläsning. OS-loggarnas och sidans tidsstämplar är
inte tillräckligt synkroniserade för att fördela RSS på enskilda steg.

Efter sista bytet till liten modell var Chrome-mätningen fortfarande
751 MiB efter fem sekunders vila. Det bevisar varken läcka eller fullständig
frigöring utan en jämförelse efter skräpinsamling. Testet visar återhämtning
och stabila grafikresurser under de körda modellflödena, men verifierar inte
alla IFC-, referensmodell- eller ritningsflöden eller obegränsat långa sessioner.
Rårapporter finns i `artifacts/browser-memory-before.json`,
`artifacts/browser-memory-after.json`, `artifacts/browser-test-renderer-memory.json`
och `artifacts/browser-renderer-memory-final.json`.

## Minnestest av IFC-referenser

`/?referenceMemory=1` i utvecklingsservern kör referensimport i en tom
testflik med den riktiga web-ifc-läsaren i en Worker. En syntetisk IFC4
på 4 663 299 byte innehåller 18 000 lådor och 2 000 cirkulära extruderingar
med olika placeringar. Åtta importer följs vardera av hörnsnap, dölj/visa,
transparens och borttagning. Testet kontrollerar dessutom avbrott efter
första mottagna geometrin, felaktig IFC, borttagning under import och
byte av pågående import. Referenserna lägger inga objekt eller steg i
modellens historik. Det vanliga filväljarflödet kontrollerades separat
med den lilla IFC-fixturen.

Testet den 4 oktober 2026 hittade att borttagning av den synliga referensen
inte stoppade en pågående ersättningsimport. Importen kunde därför lägga
tillbaka modellen efter borttagningen. Borttagning avslutar nu Workern och
frigör både väntande och synliga geometrier/material. Ett sent Worker-fel
från en ersatt import ignoreras också, så att det inte avbryter den nya.
Separata regressionstester verifierar dessa livscykler och sena filinläsningar.

Efter rättningen klarade alla åtta importer testet. Import och första
hörnsnap tog 1,26–1,39 sekunder per stor modell på testdatorn. Antalet
uppladdade WebGL-geometrier gick från 20 012 tillbaka till 12 efter varje
borttagning; shaderprogram gick tillbaka till tre och texturer var noll.
Workern och listan över väntande geometrier var tomma efter slutförd,
avbruten eller borttagen import.

Rendererprocessens RSS samplades varje sekund, från cirka 255 MiB före
testet till en observerad topp på 2089 MiB (2,04 GiB). Sista provet före
testfliken stängdes var 757 MiB. Chrome-heapen återhämtade sig under
upprepningarna, bland annat till 102 MiB efter sjunde borttagningen.
Efter sista borttagningen och fem sekunders vila låg den på 567 MiB.
Ingen skräpinsamling tvingades fram, så detta verifierar resursavveckling
och återhämtning i körningen, men inte fullständig RAM-återlämning eller
läckfrihet under obegränsat långa sessioner. Dold referens behåller sin
geometri i RAM för att snabbt kunna visas igen.

Chrome-heapen är ungefärlig och omfattar inte Worker-heapen. Process-RSS
omfattar även Worker/native-minne men inte den delade GPU-processen.
En liten syntetisk fil med många delar representerar inte alla komplexa
Tekla-exporter, IFC2x3-filer eller georefererade projekt. Råvärden och
testbilder finns i `artifacts/reference-memory-before.json`,
`artifacts/reference-memory-after.json`, `artifacts/reference-renderer-memory.json`
och `artifacts/reference-file-picker.png`. Testpanelen följer inte med
i produktionsbygget.
