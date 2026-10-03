# Skruvar, bibliotek och kopplade hål

Alla bibliotekseditorer nås från **Inställningar → Bibliotek**. Den gemensamma
ingången registreras i `src/main.js`; varje bibliotek behåller sin egen editor
och lagring. Nya bibliotek kan läggas till med grupp, namn, beskrivning och
öppningsfunktion. Skruvbiblioteket finns även direkt från skruvplaceringen.

Modulen finns i `src/fasteners/` och ingår i programmets huvudgren.
Bibliotek, geometri, placering och relationsregler är samlade i denna modul.

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
3. Klicka två insättningspunkter i skruvens längdriktning. Första punkten är
   referens för borravståndet, andra punkten anger enbart riktningen. Vanlig snap
   används; punkterna behöver inte ligga på ytor. Efter andra klicket anges
   **Borravstånd från första punkten** i inspectorn. Förhandsvisningen och antalet
   materiallager uppdateras när avståndet ändras. Klicka **Skapa skruv och hål**
   eller tryck Enter i avståndsfältet. Biblioteket anger fysisk skruvlängd.
4. Varje vald del visas med namn och egen håltyp. Nya delkopplingar börjar med
   bibliotekets **Hålstandard** (utan standard används **Ingen borrning**).
   Vid byte av skruv under skapandet hämtas den nya standarden för valda delar.
   Befintliga skruvars hål behålls vid versionsbyte; **Hämta hålstandard från bibliotek**
   ersätter uttryckligen deras värden. Välj förborrning/blindhål eller frigång/genomgående för
   delarna som ska ha hål; övriga valda delar får ingen bearbetning. Öppna
   **Hålmått · mm** för diameter, startläge längs skruvaxeln och djup. Försänkning har
   separat diameter och djup. **Beräkna hål från delarnas ytor** räknar läge och djup
   från delarnas faktiska ytor för frigångshål i den angivna riktningen.
   Välj **Närmaste vägg / fläns**, **Hela profilen** eller **Blindhål från ingångsytan**.
   Startläget räknas från första materialintervallet i skruvens riktning.
   Väggläget stannar vid dess utgångsyta; hela profilen går till sista ytan
   (båda rörväggarna). Blindhål behåller angivet djup och får inte överskrida
   den första väggens tjocklek. Skruvens ändpunkt begränsar inte beräkningen.
   Välj **Manuellt startläge och djup** för fria mått. Äldre placerade hål
   behåller sina manuella mått tills ett automatiskt läge väljs.
   Automatiska hål beräknas vid placering och när skruven sparas i inspectorn.
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

Automatisk dimensionering av skruvar, produktkataloger, skruvmönster, gängor,
automatisk hålmåttsättning på bladet och stora prestandamätningar ingår
inte i denna första implementation. Hålens konturer finns i ritningsgeometrin;
befintliga ritningsverktyg kan användas för lägesmått.

## Insättningspunkter, borravstånd och borrhål som underobjekt

Nya skruvar använder **Borravstånd styr vilka lager som ingår**. Två punkter
anger axeln; ett separat avstånd anger hur långt programmet söker i riktningen
från den första punkten. Inga ytklick eller Alt-val behövs. Punkter och avstånd
kan ändras efteråt i inspectorn. Avmarkera kryssrutan för manuellt axelläge.

Materialintervall inom borravståndet identifieras per vald del. Tomrum räknas
inte som materiallager. Ett kort avstånd kan omfatta en rörvägg, ett längre även
nästa vägg. Delar utanför intervallet behåller delkopplingen men får inga
aktiva automatiska hål. Genomgående hål kräver att avståndet når genom det valda
lagret; ett slut mitt i lagret ger ett fel och kan ersättas med blindhål.

Mutter och brickor placeras vid första och sista ingående materiallagret.
Bibliotekets skruvlängd ändras inte. För kort skruv ger fel. Plana brickors
anliggning på sneda ytor är inte löst av denna placering och måste kontrolleras.
Borravståndet är en separat parameter, inte ett försök att välja närmaste ytor
utifrån de två punkterna. Interna förbandsgränser härleds från materialet.

Borrhålen är parametriska underobjekt i skruvens `holes`-lista, med typen `bore`,
beständigt ID och måldel. De redigeras per del i skruvinspectorn. Geometrin och
Single Part härleds från samma poster. Omordning eller borttagning av ett annat
hål ändrar inte deras identitet; kopiering ger nya ID:n. De är inte separata
objekt i huvudmodellistan. IFC-export ingår inte ännu; underobjekten ger en grund
för att senare exportera hål med stabil identitet och koppling till borrad del.
