# Items från STEP

Items är fasta leverantörsobjekt. Välj **Skapa → Item** för att öppna biblioteket i appens befintliga dialogstil.

## Medföljande Sectional Railing

Katalogen innehåller de 68 STEP-filerna från den delade mappen, uppdelade efter originalets mappträd. Öppna **Skapa → Item**: katalogen läggs till automatiskt första gången. Befintliga versioner, egna items och favoriter bevaras; tidigare importerade filer flyttas till motsvarande undermapp utan duplicering. Katalogen läses först när biblioteket öppnas och finns med i appens offline-cache. Referenspunkterna är initialt föreslagna från geometrins omslutande box och kan justeras i item-editorn.

## Bibliotek

Markera en mapp och släpp `.step` / `.stp` i rutan överst i vänstermenyn, eller välj **Välj filer**. Flera filer importeras i turordning till den markerade mappen. Importen kan avbrytas; redan färdiga filer behålls. Samma STEP-fil hoppas över om den redan finns i mappen. Gränsen är 50 MB per STEP-fil och en miljon hörnpunkter efter triangulering.

Skapa undermappar med **Ny mapp**, sök på namn/artikelnummer, sortera tabellen och markera favoriter. Högerpanelen visar geometri och uppgifter. **Exportera bibliotek** och **Importera bibliotek** flyttar hela biblioteket, inklusive mappar, geometri och versioner, som JSON. Biblioteket sparas lokalt i webbläsarens IndexedDB och är separat från projektet.

## Enkel item-editor

**Redigera item** öppnar en lokal 3D-vy. Ange **Startpunkt** och **Slutpunkt** via XYZ eller genom att välja i vyn. Dessa punkter definierar insättningspunkt och riktning, inte en skalning av objektet. STEP-koordinater och mått läses i millimeter.

Lägg till tillfälliga **Hjälplinjer** med två klick eller koordinater. Snap fungerar mot geometrins kantpunkter/mittpunkter, hjälplinjernas ändpunkter/mittpunkter och korsningar. Arbetsplan XY/XZ/YZ och dess läge ger stöd när punkten ligger utanför objektet. Hjälplinjerna kan döljas/rensas och försvinner när editorn stängs. De sparas aldrig i bibliotek eller modell.

**Spara version** skapar en ny biblioteksversion. Redan placerade items behåller sin tidigare version. **Testa placering** sparar versionen och aktiverar placering i modellen.

## Modell

**Använd item** aktiverar placering: klicka startpunkt och därefter riktning, eller ange koordinater i inspektorn. Avståndet till det andra klicket ändrar inte storleken. Itemets referenslängd och geometri förblir fasta. Rotation i inspektorn vrider runt referenslinjen. Flytt av startpunkten förflyttar hela itemet; flytt av slutpunkten ändrar riktningen.

Modellsnap använder start/slut och referenslinjen, med omslutande box som tillval i editorn. Detaljerade trianglar skapar inte tusentals snappunkter. Items stöder ordinarie markering, flytt, kopiering, rotation, ångra/gör om, material och numrering. **Byt item** ersätter ett markerat item med en vald biblioteksversion.

Projektfilen innehåller varje använd item-version en gång. Projektet kan öppnas på en annan dator utan att det lokala biblioteket finns. STEP importeras som triangulerad, fast geometri; originalets parametriska CAD-historik redigeras inte här.

## Mappar och val i modellen

Sectional Railing ligger under huvudmappen Weland. Befintliga bibliotek får denna struktur en gång, utan att item-versioner ändras. Mappar kan fällas ihop, döpas om och flyttas till en annan huvudmapp eller undermapp. Ny undermapp utgår från markerad mapp; översta nivån kan väljas i dialogen. Tomma mappar kan tas bort. Mappvalet i artikelns egenskaper flyttar alla dess versioner. Import går till markerad mapp och visar hela sökvägen.

Skapa → Item öppnar item-valet i modellens egenskapspanel. Välj en mapp för att visa enbart dess direkt placerade items, alla items eller favoriter. Mappvalet i inspektorn sparas lokalt och återställs nästa gång. Välj en undermapp för att se dess innehåll och sök på namn, artikelnummer, leverantör eller mappnamn. Flera sökord måste alla matcha. Klicka på ett item för att placera det, eller Byt item för ett markerat objekt. Hantera bibliotek öppnar biblioteket och editorn. Modellvalet visar 30 träffar per sida och biblioteket 100 för att hålla listorna hanterbara även med tusentals items. Geometrierna ligger fortfarande i ett samlat lokalt bibliotek; detta är inte en fjärrkatalog med strömmande geometri.
