# Skruvar, bibliotek och kopplade hål

Alla bibliotekseditorer nås från **Inställningar → Bibliotek**. Den gemensamma
ingången registreras i `src/main.js`; varje bibliotek behåller sin egen editor
och lagring. Nya bibliotek kan läggas till med grupp, namn, beskrivning och
öppningsfunktion. Skruvbiblioteket finns även direkt från skruvplaceringen.

Modulen finns i `src/fasteners/`. Den är ett avgränsat försök på grenen
`feature/screws-and-holes`, i arbetskopian `LiraStructureWeb-screws`.

## Användning

1. Öppna **Inställningar → Bibliotek → Skruvar**. Skapa egna poster för träskruv eller
   skruv med mutter. Ange diameter, längd under huvud och huvudmått. För skruv med
   mutter anges också mutterns nyckelvidd och tjocklek; nominell diameter är samma
   som skruvens. Biblioteket innehåller inga verifierade standardprodukter.
2. Markera delarna som ska förbindas. Välj **Skapa → Skruv**. Delarna läggs till
   i kopplingslistan. Fler delar kan läggas till i dialogen.
3. Välj biblioteksversion och ange skruvens punkt under huvudet samt en
   riktningspunkt. Avståndet mellan punkterna bestämmer riktningen; bibliotekets
   längd bestämmer skaftets längd. Alternativt välj **Placera med två klick** och
   använd modellens snap. Försänkta huvuden sträcker sig bakom referenspunkten;
   hålets startläge kan därför behöva vara negativt.
4. Välj ingen borrning, förborrning/blindhål eller frigång/genomgående för varje
   del. Ange håldiameter, startläge längs skruvaxeln och djup. Försänkning har
   separat diameter och djup. **Beräkna genomgående hål** räknar läge och djup
   från delarnas faktiska ytor för frigångshål i den angivna riktningen.
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
Grundprogrammet finns kvar i den ursprungliga arbetskopian. Försöket kan skrotas
genom att inte föra in grenen. Ingen migrering av gamla projektformat ingår.

Automatisk dimensionering av skruvar, produktkataloger, skruvmönster, gängor,
automatisk hålmåttsättning på bladet och stora prestandamätningar ingår
inte i denna första implementation. Hålens konturer finns i ritningsgeometrin;
befintliga ritningsverktyg kan användas för lägesmått.
