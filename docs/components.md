# Komponenter och kopplingar

Verktygsgruppen **Kopplingar** innehåller **Fit**, **Fotplåt**, **Avstyvning** och **Komponentbibliotek**.
Starta Fit, klicka på första sweepen nära anslutningen och sedan på den andra.
Ändarna väljs från klickpunkterna och en Fit skapas direkt med gerning och nollspalt.
Första referensen markeras i blått och andra i orange. Escape avbryter placeringen.

En klickbar kedjesymbol visas vid kopplingen och följer den när vyn panoreras,
roteras eller zoomas. Klicka på symbolen för att visa kopplingens egenskaper i
inspektorn. Samma egenskaper visas om komponenten markeras i modellträdet.
Symbolen motsvarar 200 mm i modellen och krymper med zoom och avstånd, med
maxstorlek 28 skärmpixlar i närbild. Den tonas bort mellan 16 och 8 pixlar och
döljs helt under 8 pixlar, även när kopplingen är vald. Modellträdet ger fortsatt
åtkomst till kopplingen i översiktsvyer.

Ändra utförande eller spalt i inspektorn. Förhandsvisningen uppdateras direkt, men
ändringarna sparas först med **Modifiera**. **Återställ** eller Escape återgår till
den sparade kopplingen. Byte av markering lämnar också osparade parametrar.
**Anslutna ändar** innehåller manuellt ändval och **Byt referensobjekt** visar val
av sweeps. **Byt ordning** växlar vilken sweep som är genomgående.

Inspektorns gemensamma kopplingsram finns i `src/components/definitions.js`.
Varje kopplingstyp definierar standardvärden, referensroller, parameterfält och en
resolver. Den gemensamma UI:n hanterar referenser, fristående parameterutkast,
förhandsvisning, Modifiera och återställning. Kedjesymbolerna är separata från
materialgeometrin och ska inte synas som kapplan eller ingå i ritningsgeometrin.

Fit är ett eget `component`-objekt med `kind: fit`. Referenser och parametrar
sparas i projektet; kapplan räknas om från referensobjektens aktuella definitioner.
Den anslutna änden förlängs eller kapas utan att skriva över sweepens ursprungliga
start- och slutpunkter. Borttagning av Fit återställer därmed grundgeometrin.
Borttagning av en refererad sweep tar också bort kopplingen. Kopiering av sweeps
och komponent tillsammans kopplar den nya komponenten till de nya objekten.

- **Gerning:** båda sweeps kapas med ett gemensamt vinkelbisekterande plan.
  Spalten delas lika på de två delarna.
- **Genomgående:** första sweepen behålls och andra ansluter mot en plan yttersida
  av första profilens omslutande tvärsnitt. Hela spalten ligger på anslutande del.

Fit kräver icke parallella axlar. Axlarna kan vara förskjutna i 3D även när profilerna
inte överlappar. Inspektorn visar då **Ingen gemensam kontaktyta**, utan att hindra
förhandsvisning eller Modifiera. Informationen bygger på profilernas yttre tvärsnitt
i riktningen vinkelrät mot båda axlarna, inte på en hållfasthetsbedömning. Gerningen ligger
mellan axlarnas närmaste punkter; objekten flyttas inte till samma plan. Genomgående
anslutningar ska ligga inom första sweepens längd och kapar mot första objektets
faktiska yttersida. Fit använder plana kapytor,
inte konturanpassad urtagning runt rundprofiler, liv eller tidigare bearbetningar.

Fotplåt (`kind: baseplate`) är den första komponenten med genererade fysiska delar.
Starta **Fotplåt**, klicka på en pelare och kontrollera förhandsvisningen i inspektorn.
**Skapa fotplåt** sparar komponenten, plåten, hålen och eventuella ankarskruvar i en
transaktion. Senare ändringar sparas med **Modifiera**. Klick på en genererad plåt
eller ankarskruv visar samma komponentinspektor.

Plåtens översida ligger horisontellt vid pelarens nedre ände, med valfri nivåjustering.
Lutande pelare kapas mot samma plan. Bredd och längd kan följa profilens utstick
eller anges som fasta mått. Plåtrotation och skruvmönstrets rotation anges separat.
Plåten ligger helt under anslutningsplanet; kapningen ändrar inte pelarens sparade
start- och slutpunkter.

Förankringen väljs ur det egna skruvbiblioteket: gängstång med mutter och valbar
bricka/dubbel mutter, eller betongskruv med produktens förankrings- och borrdata.
Biblioteksversionen sparas i komponenten. Rader, kolumner, avstånd och håldiameter
styr mönstret. För gängstång anges djupet under plåtens undersida; återstående längd
sticker upp ovanför plåten, där muttrar och bricka placeras mot plåten. Betongskruvens
produktdjup måste rymmas under plåten. Endast hål i stålplåten skapas: betongen är
inte ett refererat objekt i denna första version. Placeringarna kontrolleras mot
plåtkanter, pelarens omslutande tvärsnitt och tillbehörens storlek. Dessa är
geometriska kontroller, utan bärförmågeberäkning.

Genererade delar har `generatedBy` och stabila identiteter utifrån komponentens id.
Vid ändringar räknas deras geometri om och detaljnumreringen kräver kontroll när
mått eller hål ändras. Flytt och rotation av komponenten eller dess delar sker via
pelaren. Kopiering av pelaren tar med fotplåten och skapar egna del- och hålidentiteter.
Borttagning av komponenten, en genererad del eller pelaren tar bort hela fotplåten
och återställer kapningen. Separata skruvförband på plåten följer plåtens rörelse;
deras plåtreferenser tas bort om fotplåten tas bort. Ångra/Gör om och projektfiler
hanterar hela komponenten tillsammans.

Biblioteket visar fortsatt planerade pelare–balk, balk–balk och skarvar.
Gemensamma definitioner, ägarskap och parameterutkast kan återanvändas för dessa.

Hover och markering använder en gemensam feedbackyta utan att ändra objektets material.
Vanlig hover är gul och en markerad del behåller sin gröna markering. Vid Fit följer
hover färgen för nästa referens: blå för första och orange för andra. Valda referenser
behåller en transparent färgyta och en kontur. Hover och tangentbordsfokus på en
referensrad i inspektorn förstärker samma objekt i modellen.

## Avstyvningsplåtar

**Kopplingar → Avstyvning** skapar ett `component`-objekt med `kind: stiffener`.
Klicka först på en H-, I- eller U-profil och sedan på platsen längs samma objekt.
Klickpunkten projiceras till profilens längdaxel. Kontrollera plåtarna i
förhandsvisningen och klicka **Skapa avstyvning**. Klick på kopplingssymbolen
eller en genererad plåt öppnar samma komponentinspektor med **Modifiera**.

H/I har val för positiv profilsida, negativ profilsida eller ett plåtpar. U har
alltid en plåt inne i profilen. Plåtarna ligger vinkelrätt mot längdaxeln och
centreras i den valda stationen. Ange plåttjocklek, passningsspalt och extra
hörnurtag. Avstånd kan mätas från start- eller slutpunkten och behålls från vald
ände när längden ändras. Hela plåttjockleken måste ligga inom objektets längd.

Konturen följer den sparade profilens faktiska innerflänsar, liv och radier,
även för U/UPN med lutande flänsar. U-profiler med rundade flänskanter får en
indragen fri plåtkant före flänskantsradien. Mycket korta bågsegment ersätts
med kordor inne i den fria konturen. Extra hörnurtag gör diagonala urtag vid
liv/flänshörnen; profilradierna hanteras redan automatiskt vid noll extra urtag.

Avstyvningen kapar inte balken eller pelaren. Genererade plåtar får stabila
identiteter, delnumrering och samma ägarskap som fotplåten. De följer flytt,
rotation, ändrad profil och profilplacering. Kopiering av referensobjektet tar
med dess avstyvningar. Borttagning av en plåt tar bort dess avstyvningskomponent
med plåtparet. Ångra/Gör om och projektfiler hanterar hela komponenten tillsammans.

Första versionen omfattar en avstyvning eller ett plåtpar per komponent.
Upprepade avstyvningar och svetsobjekt ingår inte ännu. Konturpassningen utgår
från det obearbetade tvärsnittet; placering vid befintliga urtag eller Fit-kapplan
behöver granskas i modellen. Komponenten gör geometrisk passning utan dimensionering.

## Ändplåt

**Kopplingar → Ändplåt** skapar ett `component`-objekt med `kind: endplate`.
Klicka nära önskad ände av en balk eller pelare, kontrollera förhandsvisningen
och klicka **Skapa ändplåt**. Objektände kan också ändras i inspektorn. Klick
på kopplingssymbolen eller plåten öppnar komponentens **Modifiera**-flöde.

Plåten ligger vinkelrätt mot längdaxeln. Spalten mäts utåt från objektänden
till plåtens insida; hela plåttjockleken ligger utanför objektet. Måtten följer
profilens tvärsnitt med angivet utstick, eller anges som fast bredd och höjd.
Plåtrotationen sker kring längdaxeln. Även roterade och förskjutna profiler
får en centrerad plåt som täcker tvärsnittet. För små fasta mått blockeras.

Den genererade plåten får stabil identitet, delnumrering och samma ägarskap
som fotplåtar och avstyvningar. Den följer ändrad profil, flytt och rotation.
Kopiering av referensobjektet tar med ändplåten. Borttagning av en plåt eller
dess referensobjekt tar bort komponenten. Ångra/Gör om och projektfiler
hanterar komponenten tillsammans.

Samma objektände kan inte samtidigt ha ändplåt, fotplåt eller en kapande Fit.
Första versionen skapar själva plåten, utan skruvar eller svetsobjekt.

## Skruvad ändplåtskoppling

**Kopplingar → Ändplåtskoppling** skapar ett `component`-objekt med
`kind: boltedEndplate`. Välj först pelaren och sedan balken nära anslutningsänden.
Inspektorn visar plåt, skruvar och hål i förhandsvisningen. Klicka **Skapa
ändplåtskoppling**. Symbolen, plåten och skruvarna öppnar samma inspektor för
**Modifiera** och **Återställ**.

Första versionen gäller H/I-balk vinkelrätt mot en H/I-pelarfläns med plan insida
(HEA, HEB och IPE; lutande innerflänsar kräver ett annat tillbehör). Båda
pelarflänsarna och balkens båda ändidentiteter stöds. Referenserna kan tillsammans
roteras och flyttas fritt i rymden. Pelarens profilrotation bestämmer flänsens
riktning. Balkens nominella ändpunkter behålls; ett komponentägt kapplan förlänger
eller kortar geometrin till plåtens utsida. Spalten ligger mellan plåt och pelare.
Plåten följer det faktiska balktvärsnittet, även vid förskjuten profilplacering.

Plåttjocklek, utstick eller fasta mått, spalt, skruvrader, kolumner, avstånd,
förskjutning, håldiameter, minsta kantavstånd och fri plats vid tillbehör styrs i
inspektorn. Skruven väljs ur det egna biblioteket. ISO 4014 och ISO 4017 fungerar
med mutter och valbara brickor. Automatisk längd väljer kortaste tillgängliga
längd som rymmer förband, mutter, brickor och extra längd, med muttern på gängan.
Vald serie sparas som bibliotekssnapshots i komponenten och följer projektfilen.
Manuellt läge behåller vald bibliotekslängd och kontrollerar dess passning.

Varje skruv äger två separata hål: ett genom plåten och ett genom den valda
pelarflänsen. Bakre flänsen borras inte. Skruvhuvudets fria cirkel kontrolleras
mot balkens verkliga liv, flänsar och radier. Mutter och bricka kräver plan
flänsyta fri från pelarliv och radier. Kantavstånd kontrolleras på plåt och
pelarfläns. För långa skruvar som når motsatt pelarfläns stoppas. Befintliga
linjära kapningar vid pelarhålen kontrolleras. Övriga urtag och intilliggande
delar behöver granskas i modellen. Detta är geometrisk passning, utan
bärförmågeberäkning; svetsobjekt ingår inte ännu.

Plåt, skruvar och hål har stabila identiteter och gemensamt ägarskap. En ändring
räknar om hela kopplingen, inklusive borrhål och balkkapning. Flytt och rotation
via genererade delar flyttar båda referensobjekten tillsammans. Kopiering av
båda referenserna tar med en egen koppling; kopiering av bara ena objektet
skapar ingen ny koppling. Borttagning av en genererad del eller en referens tar
bort kopplingen och dess bearbetningar. Ångra/Gör om och projektfiler hanterar
hela kopplingen. En kapande Fit, fotplåt eller annan ändplåt på samma balkände
blockeras.

## Kompakt kopplingsinspektor

Alla kopplingar använder samma avsnittsramverk. Plåt och skruvmönster visas
först. Placering, skruvlängd, passning, hål och tillbehör fälls ut vid behov,
med typberoende avsnitt för Fit, avstyvning och fotplåt. Avsnitt utan relevanta
fält döljs, till exempel förankringsdetaljer när fotplåten saknar skruvar.
Öppna avsnitt behålls när samma koppling modifieras. Referenser och genererade
delar finns under **Referenser och delar**; referensbyten visas efter **Byt
referensobjekt**. Objektnamnet har ett eget hopfällbart avsnitt.

Rubriken visar kopplingstyp och beteckning, följt av en kort sammanfattning av
plåtmått och faktiskt använda skruvlängder. Enheter samlas vid avsnittsrubrikerna
och huvudvalen ligger i två kolumner. Automatiskt skruvlängdsläge visar en
post per skruvserie i väljaren, med standard, diameter och produktuppgifter
som skiljer serierna åt. Manuellt läge visar bibliotekets enskilda längder.
Bibliotekssnapshots och samtliga kopplingsparametrar behålls i projektfilen.

## Balkskarv

`beamSplice` ansluter två raka H-/I-profiler med två lika stora ändplåtar och en gemensam skruvgrupp. Starta **Balkskarv**, klicka nära första balkänden och sedan nära den mötande änden på andra balken. Inspektorn visar en förhandsvisning innan **Skapa balkskarv** sparar kopplingen.

Referenslinjerna ska vara kollineära och de valda ändarna ska möta varandra. Ändarnas mittpunkt bestämmer skarvens läge; balkarnas nominella ändpunkter ändras inte. Båda balkarna kapas eller förlängs till respektive plåts utsida. Spalten mäts mellan plåtarna. Plåtmåtten utgår från båda profilernas verkliga konturer och placering, så olika profilstorlekar kan anslutas med gemensamma plåtar.

Kopplingen använder bibliotekets skruvserie och sparade längdvarianter. Automatisk längd täcker två plåttjocklekar, spalt, valda brickor, mutter och extra längd. Hål skapas i båda plåtarna. Kantavstånd, överlappande tillbehör och fri plats mot båda balkarnas liv, flänsar och radier kontrolleras före sparning. Detta är geometriska kontroller; komponenten utför ingen bärförmågedimensionering.

Två plåtar och skruvarna ägs av kopplingen och behåller sina identiteter vid modifiering. Flytt och rotation av kopplingen följer båda balkarna. Kopiering av båda referensbalkarna kopierar även skarven och skapar egna plåtar, skruvar och hål. Borttagning av kopplingen återställer balkarnas geometri; borttagning av en referens tar bort den beroende kopplingen. Projektfilen innehåller skruvsnapshotar och kan återställa genererade delar utan det externa biblioteket.

Vinklade skarvar och förskjutna referenslinjer stöds inte i första versionen. Plåttjockleken är gemensam för båda plåtarna.

# Kopiera egenskaper mellan kopplingar

Alla kopplingstyper har kompakta egenskapsrader och kryssrutor direkt vid de parametrar som kan kopieras. Markera källkopplingen, välj egenskaper och klicka **Kopiera till andra…**. Klicka på andra kopplingars symboler av samma typ eller genererade delar för att välja mål; ett andra klick avmarkerar. **Modifiera** eller Enter uppdaterar hela målgruppen i en transaktion. Escape eller Avbryt avslutar utan ändringar; Ångra återställer hela kopieringen.

Referensobjekt, namn och objektidentitet kopieras aldrig. Anslutna ändar, referensände, avstånd längs profilen, spalt, förskjutningar och lokala rotationer kan kopieras men är avbockade från början. Kopiering stöds för Fit, fotplåt, avstyvning, ändplåt, ändplåtskoppling och balkskarv, mellan kopplingar av samma typ. Målets egna profiler styr de automatiska plåtmåtten. Skruvvalet inkluderar seriens sparade längdalternativ, så att automatisk längd kan väljas för målens förband. Plåtar, skruvar och hål räknas om och geometrin kontrolleras före publicering; ett fel stoppar hela målgruppen. Modifiera eller återställ osparade ändringar i källkopplingen innan kopieringen startas.
