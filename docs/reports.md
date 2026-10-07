# Rapporter

Öppna **Rapporter** bredvid **Ritningar** i toppmenyn. Första rapporttypen är
ritningsförteckning. Rapporten hämtar aktuella ritningar från projektet och uppdaterar
förhandsvisningen när urval, sortering eller kolumner ändras.

## Layout och rapportyta

I layouteditorn kan en layout användas för ritningar, rapporter eller båda.
Blockbiblioteket är gemensamt. Placera ramar, logotyp och informationsblock precis
som i en ritningslayout.

Den färdiga mallen **Ritningsförteckning · A4 med sidhuvud** använder layouten
**A4 · rapport med sidhuvud**: originalblocket `Ritram_A4` och
`Rithuvud_A3_A4` placerat överst. Rapportytan börjar 61 mm från överkanten och
är 174 × 223 mm. Samma layout används på fortsättningssidorna och kan ändras i
layoutbiblioteket. Mallen läggs till en gång; efterföljande egna ändringar behålls.

Lägg till en **rapportyta** med två klick eller ange dess position och storlek i
millimeter. Positionen mäts från papperets övre vänstra hörn. Ytan måste ligga inom
papperet och vara minst 30 × 30 mm. Den streckade markeringen är en hjälp i editorn
och kommer inte med i exporten.

Rapportvyn har separata layoutval för första sidan och fortsättningssidorna. När
rapportytan är full fortsätter tabellen automatiskt på nästa sida. Kolumnrubriker
upprepas. Vanliga rader hålls samman; en rad som är högre än hela rapportytan kan
fortsätta över flera sidor. Texten radbryts och radhöjden anpassas till innehållet.

Block kan använda följande automatiska attribut:

| Attribut | Innehåll |
| --- | --- |
| `report.title` | Rapportens titel |
| `report.pageNumber` | Aktuellt sidnummer |
| `report.pageCount` | Totalt antal sidor |
| `report.rowCount` | Antal ritningar i urvalet |

Projektattribut fungerar också i rapportblock. Ritningsspecifika attribut saknar
en enskild ritning i rapportens sidlayout; använd dem som tabellkolumner.

## Kolumner och mallar

Välj attribut, ändra rubrik, lägg till eller ta bort kolumner och flytta dem i
ordningen. Bredden anger kolumnens relativa andel av rapportytan. Välj ritningstyp,
sök i kolumnernas innehåll och välj sorteringsattribut.

Förteckningens status och handling visar förkortningen efter `|`, exempelvis `G1`
och `BH`. Övriga värden visas som text. Ritningarnas egna block behåller sina
befintliga regler för fulltext och förkortningar.

**Spara mall…** sparar kolumner, urval, sortering, texthöjd och layoutval.
Rapportmallar och layoutbibliotek sparas lokalt i webbläsaren, liksom det befintliga
blockbiblioteket. Layouter som används av en sparad rapportmall räknas som använda
i biblioteket.

## Projektets rapporter och sidhuvud

Ange titel, rapportnummer, datum, revision, status och handlingstyp under
**Rapportegenskaper**. Status och handling använder samma val som ritningar,
inklusive flerval om attributet har konfigurerats för det. Sidhuvudet visar full
text utan förkortningen efter `|`.

**Spara rapport i projektet** sparar rapportegenskaper, kolumner, urval,
sortering, tabellutseende samt en kopia av layouter och använda block. Välj en
sparad rapport i **Rapport** för att öppna den igen, eller **Ny rapport** för en
ny rapport med de aktuella mallinställningarna. Spara därefter själva projektfilen
via **Arkiv → Spara projekt**. Rapporterna följer med i `.lira.json` och behöver
inte samma lokala bibliotek när filen öppnas i en annan webbläsare.

Tabellens innehåll hämtas från projektets aktuella ritningar när rapporten öppnas
eller uppdateras. Sidindelning och sidantal beräknas på nytt. Sparade rapporter är
alltså återanvändbara rapportdefinitioner, inte frysta dokument för tidigare
leveranser. PDF-exporten kan användas för att bevara en utgiven version.

Rapportattributen `report.number`, `report.date`, `report.revision`,
`report.issueStatus`, `report.documentType` och `report.pageLabel` kan placeras i
egna block. Befintliga ritningsblock får motsvarande rapportegenskaper i sina
ritningsfält. Den medföljande A4-mallen visar titel och **Sida N av M** i
innehållsfältet och rapportnummer, datum och revision i sina ordinarie fält.
Bibliotekets originalblock ändras inte.

Under **Tabellutseende** väljer du Arial, Times eller Courier för innehåll och
rubriker, separata textstorlekar, feta rubriker, text- och bakgrundsfärger samt
växelvis radfärg. Du kan också ändra linjefärg och linjetjocklek (0 döljer
linjerna), radavstånd och cellmarginaler i X och Y. Varje kolumn har ett val för
vänster-, mitt- eller högerjustering som gäller både rubrik och innehåll.
Sidindelningen räknas om efter dessa inställningar. Tabellutseendet sparas med
rapportmallen och används i PDF-exporten. CSV innehåller fortsatt bara data.

## Export

PDF använder samma sidor och layout som förhandsvisningen. CSV exporterar aktuellt
urval och kolumner med semikolon och UTF-8 för öppning i Excel. CSV innehåller data,
inte sidlayout. Native Excel- och Word-export ingår inte i denna första version.

## Material- och mängdförteckning

Välj **Material- och mängdförteckning** i Rapporttyp och exempelvis mallen
**Materialförteckning · A4 med sidhuvud**. Standardkolumnerna är part mark, antal,
material, profil, styckelängd i mm och totalvikt i kg. Även totallängd i m,
styckevikt, volym i m³ och numreringsstatus kan läggas till som kolumner.

Rapporten hämtar fysiska delar från hela modellen. Hjälpobjekt, skärverktyg och
komponenternas styrande objekt räknas inte som delar; deras genererade fysiska
delar räknas. Skruvobjekt kan väljas separat med Deltyp. Ett skruvobjekt räknas som
en del även om det innehåller mutter och brickor.

Identiska numrerade delar ger en rad per part mark. Delar som saknar giltig
numrering visas fortfarande, med **Ej numrerad** eller **kontroll krävs**.
Ändrade delar med samma gamla mark slås inte ihop om deras aktuella former skiljer
sig. Rapporten ändrar inte modellens numrering.

Vikten följer samma regler som objektinspektorn: nettovolym efter hål och urtag
gånger materialets densitet, med profildensitet som reserv när material saknas.
Meshberäknade mängder visas med **ca**. Okända vikter visas som ett streck;
summeringar med saknad densitet visar känd vikt **+ okänd**. Summering sker före
avrundning. Styckelängd är axellängd för profiler och skruvar; för plåt är den
polygonens längsta utbredning. Styckelängd och styckevikt summeras inte i
summeringsraderna.

Välj gruppering efter material eller profil och slå på/av delsummor och
totalsumma. Sökning och Deltyp avgränsar både tabellen och summorna. Numeriska
kolumner sorteras numeriskt. Gruppering, urval och summeringar sparas i mallar och
projektets rapporter och används vid PDF- och CSV-export.
