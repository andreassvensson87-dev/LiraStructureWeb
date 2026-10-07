# Konvertera IFC-objekt

Klicka på ett IFC-objekt i modellvyn. Det markeras och öppnas under
**Referenser**. Välj **Konvertera markerat IFC-objekt…**.
Förhandsgranskningen visar bara det markerade objektet med typ och resultat.
Klicka **Konvertera valda** för att skapa modellobjektet.
Utan markerat IFC-objekt är konverteringsknappen avstängd. Markering av ett
modellobjekt eller klick i tom yta tar bort IFC-markeringen.
Referensen behålls och alla skapade objekt kan ångras i ett steg.

Första versionen stöder raka, slutna extrusioner med konstant tvärsnitt:

- IFC Beam, Column, Member och BuildingElementProxy blir Sweep med egen profil.
- IFC Plate blir Plate med kontur, tjocklek och arbetsplan.
- Sweep-profiler kan ha genomgående längsgående hål.

Konturen återskapas från IFC-triangelnätet och följer dess detaljnivå;
rundningar följer alltså IFC-filens tessellering. Placering och riktning
behålls. Geometrin kontrolleras mot båda ändytorna, sidoytorna och solidens
volym. Konverteringen ersätter inte objekt med förenklade omslutande lådor.
Numerisk tolerans för punktmatchning är 0,02 mm.

Kapningar, böjda former, öppna nät, flera geometridelar per IFC-objekt,
Plate med hål och övriga IFC-typer redovisas med en orsak och hoppas över.
Geometri med över 20 000 vertexposter eller mer än 64 ytriktningar hoppas
också över. Profilen måste klara programmets vanliga validering.

Material och materialkvalitet överförs inte i denna version. Ange rätt
material i inspektorn efter konverteringen. De skapade objekten är vanliga
modellobjekt som kan redigeras, numreras, sparas och användas i ritningar.
Källfil, IFC GlobalId och ExpressId sparas på objektet. GlobalId (eller
filnamn + ExpressId när GlobalId saknas) förhindrar oavsiktlig dubbelimport.
Detta är en engångskonvertering; ändringar i referensfilen synkroniserar inte
redan konverterade objekt.

HEA-profiler identifieras mot de 24 inbyggda storlekarna HEA 100–1000.
Konverteringen jämför hela tvärsnittskonturen, inklusive liv, flänsar och
radier, i båda riktningarna (högst 0,03 mm avvikelse), samt area. Matchande
objekt får biblioteksprofilens namn och parametrar med bibehållen rotation.
Enbart ett HEA-namn eller motsvarande yttermått räcker inte. Om IFC-filens
kontur avviker, exempelvis på grund av en annan tessellering av rundningar,
behålls den egna IFC-profilen. Material tilldelas inte av profilmatchningen.
