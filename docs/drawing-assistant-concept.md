# Koncept: semiautomatisk måttassistent i LiraStructure

Underlag: `(EZSetup) Assistenten v2.cs`. Detta är ett koncept för nästa steg, inte en aktiverad funktion.

## Andemeningen i C#-assistenten

Användaren väljer vad som ska måttsättas och klickar var måtten ska hamna. Assistenten samlar punkter ur modellen i den aktuella ritningsvyns koordinatsystem och skapar måttserier. Den automatiserar punktinsamlingen, medan användaren styr omfattning och placering.

* **Huvudmått:** välj en referensdetalj; ytterpunkterna för detaljerna i dess vy ger totalmått i X och Y.
* **Delmått:** välj detaljer och skruvgrupper, därefter referensdetaljen. Referensdetaljens ytterpunkter kombineras med valda detaljers min/max och skruvarnas centrum. Detaljer och skruvar behandlas som separata måttserier.
* **Pilmått / kombinerade mått:** samma grundprincip men detaljernas startläge används i stället för båda ytterkanterna, och Teklas måttstil byts. De exakta stildefinitionerna finns inte i C#-filen; det går därför inte att fastställa hela deras utseende enbart från koden.
* **Prefab BS:** mått till valda Brep-objekts insättningspunkter tillsammans med referensdetaljens ytterpunkter.
* **Placering:** klick ovanför/under detaljen skapar horisontella mått, klick till höger/vänster skapar vertikala mått. Ett klick utanför ett hörn kan skapa båda. Den hårdkodade distansen 200 är modellavstånd, inte ett generellt pappersavstånd.

Snitt, detaljer, ändring av snittlängd och egenkontroll är andra funktioner i filen och bör hållas åtskilda från måttassistenten. Cut-funktionerna finns i koden men är inte kopplade till någon måttknapp i fönstret.

## Föreslaget flöde

1. Öppna **Mått → Assistent**. Första versionen erbjuder **Huvudmått** och **Delmått**, båda som kedjemått.
2. Välj detaljer i en ritningsvy. I delmått kan hålcentrum inkluderas. För huvudmått kan omfattningen vara valda detaljer eller hela vyn; omfattningen ska vara uttrycklig.
3. Välj referensdetalj eller använd markerad detalj. Förhandsvisningen markerar alla insamlade måttpunkter och visar vilka objekt de kommer från.
4. Klicka för att välja sida och avstånd. Horisontell/vertikal riktning kan föreslås från klicket; fri riktning anges uttryckligen. Ett hörnklick får visa två måttserier som förslag.
5. Granska förslaget, slå av oönskade punkter eller hela serier och tryck **Skapa mått**. Esc avbryter utan att skapa objekt. Allt som skapas i en körning ska kunna ångras tillsammans.

## Anpassning till LiraStructure

Utgå från ritningsvyns projicerade modellgeometri och befintliga kandidatpunkter (`annotation-references.js`), inte globala X/Y eller skärmens bounding box. Min/max väljs längs den aktuella måttaxeln. Sortera punkterna och slå ihop sammanfallande projektioner med tolerans, så att nollmått försvinner. Hål måttsätts endast om de hör till valda detaljer och syns i den aktuella vyn.

Spara förslaget som vanliga `dimension`-objekt med `points`, `axis`, `line`, `view` och `references`. Behåll modellkoppling till hörn, hål och referenspunkter så att befintlig uppdatering av mått kan användas. En bruten koppling ska visas tydligt, inte döljas genom ett tyst fel. Ett omkörnings-ID kan senare låta användaren ersätta assistentens tidigare serier utan att ändra manuella mått.

Avstånd och separation mellan serier anges i **mm på papperet**, oberoende av vyskala. Detaljkanter och hål får skilda kedjor med exempelvis 8 mm mellan raderna. Undvik kolliderande etiketter och låt användaren justera före skapandet. Någon modelltransformation behöver inte ändras globalt.

## Etapper

1. Huvudmått i horisontell/vertikal riktning, punktförslag, placeringsklick, godkännande och gemensam ångring.
2. Delmått för valda detaljer och synliga hål, separat radplacering och möjlighet att utesluta punkter.
3. Fri riktning och insättningspunkter för prefab. Pilmått/kombinerade stilar kan utredas efter att Teklas stilfiler finns som referens; den manuella menyn behåller bara kedjemått.
4. Uppdatering och ersättning av tidigare assistentmått. Manipulering av ritobjekt utvecklas separat och stegvis.
