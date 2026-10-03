# Skruvar, bibliotek och kopplade hål

Alla bibliotekseditorer nås från **Inställningar → Bibliotek**. Den gemensamma
ingången registreras i `src/main.js`; varje bibliotek behåller sin egen editor
och lagring. Nya bibliotek kan läggas till med grupp, namn, beskrivning och
öppningsfunktion. Skruvbiblioteket finns även direkt från skruvplaceringen.

Modulen finns i `src/fasteners/` och ingår i programmets huvudgren.
Bibliotek, geometri, placering och relationsregler är samlade i denna modul.

## Exempelmodell

**Inställningar → Projekt → Läs in skruvexempel** läser in tre färdiga förband:
trä med frigångshål och förborrning, två plåtar med M12 och brickor på båda sidor,
samt en anslutningsplåt mot RHS med både två rörväggar och endast övre väggen.
Modellen har 17 numrerade objekt, varav 11 skruvar, med fristående material- och
skruvspecifikationer. Ingen biblioteksimport behövs. Måtten är demonstrationsvärden.
Inläsningen ersätter sessionsmodellen och kan ångras som en enda operation.

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

Automatisk dimensionering av skruvar, produktkataloger, skruvmönster, gängor,
automatisk hålmåttsättning på bladet och stora prestandamätningar ingår
inte i denna första implementation. Hålens konturer finns i ritningsgeometrin;
befintliga ritningsverktyg kan användas för lägesmått.

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
