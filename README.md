# LiraStructure Web — Sweep

Lokal, nedskalad prototyp med raka profilsweeps, Plate och separata skärobjekt. Vanilla JavaScript, Three.js och Vite.

## Kör

Skruvmodulen med träskruv, skruv med mutter och kopplade hål beskrivs i
[docs/fasteners.md](docs/fasteners.md).

```sh
npm ci
npm run dev
```

`npm run build` bygger till `dist/`. `npm test` kör regressionstester för geometri, modellverktyg, historik och ritningar.

Kör `npm run check` före ändringar lämnas vidare: formatering, lint, tester och produktionsbygge kontrolleras även av CI. Modulansvar och regler för vidareutveckling finns i [ARCHITECTURE.md](ARCHITECTURE.md).

## Items från STEP

Välj **Skapa → Item** för biblioteket, STEP-import och punkteditorn. Se [docs/items.md](docs/items.md).

## Omfattning

- Skapa sweep genom två klick i XY-planet på startpunktens Z-nivå (fri placering eller valbar snapp), eller genom exakta XYZ-koordinater.
- Rektangulärt massivt tvärsnitt, rektangulärt hålprofil och förenklat I-tvärsnitt. Mått i mm, rotation i grader.
- Markera i 3D eller objektlista, ändra egenskaper, ta bort, ångra/gör om.
- Stomlinjer med ändbubblor (1, 2, 3 / A, B, C), egna modellobjekt med redigerbara ändpunkter och vanlig modellsnappning. Stomlinjeändringar ingår i ångra/gör om. Visa allt omfattar både stomlinjer och sweeps.
- Ortografisk kamera i alla vyer, med orbit, panorering, zoom, ovanifrån och anpassa vy.

Spara och öppna projekt under Inställningar → Projekt. `.lira.json` innehåller objekt, använda material-/profil-/skruvvärden, hål, nivåer, numrering, ritningar och snapinställningar. Öppna ingår i ångra/gör om. Geometri och kameravy härleds på nytt; ingen automatisk sparning eller molnlagring finns. Formatet är separat från Mac-appens projektfiler. Tvärsnittsbiblioteket sparas separat lokalt och kan importeras/exporteras. Inga verifierade standardprofiler medföljer. Ingen dimensioneringsberäkning.

[examples/forbandstest.lira.json](examples/forbandstest.lira.json) innehåller ett isolerat förband från stomexemplet: ändplåt, I-balk, skruv med två brickor och mutter samt två redigerbara Single Part-ritningar. Öppna filen via Inställningar → Projekt för att kontrollera hål och detaljritningar.

## Assemblyritningar

[examples/assemblytest.lira.json](examples/assemblytest.lira.json) innehåller balk, ändplåt och skruv med en sparad assembly och ritningen A-001. Öppna projektet via Inställningar → Projekt och välj A-001 under Ritningar.

Knappen **Skapa ritningar** öppnar en gemensam lista för **Single Part** och **Assembly**. Filtrera med **Ritningstyp** och välj **Markerade objekt** eller **Hela modellen** under **Urval**. Varje typ visas en gång med antal i urval/modell och befintlig ritning. **Numrera** uppdaterar detalj- och assemblynumreringen; välj sedan typer och skapa ritningarna tillsammans. Ritningsmallar gäller Single Part, medan valda ritningsinställningar används för båda typerna. **Hantera assemblies** i den gemensamma listan används för att skapa och redigera grupper; dess ritningsknappar öppnar den gemensamma listan med Assembly-filtret. Samma lista finns under **Ritningar → Ny ritning → Single Part / Assembly**.

Markera minst två fysiska delar med Shift-klick i modellen eller modellistan och välj **Skapa ritningar → Hantera assemblies**. Ange namn och huvuddel, och välj **Skapa assembly från markering**. Huvuddelen bestämmer ritningens lokala riktning. Varje del kan ingå i en assembly; skärningar och hjälpobjekt ingår inte som delar.

Välj **Skapa ritning…** i assemblylistan eller öppna **Skapa ritningar** och filtrera på Assembly. Uppdatera numreringen med **Numrera** om någon rad visar att numrering krävs. Lika tillverkningsdelar delar detaljnummer; profil, material och bearbetning ingår i jämförelsen. Ritningsnamnet följer Part mark för Single Part och Assembly mark för Assembly. Assemblyritningens nummer följer också Assembly mark. Assemblyns beskrivande namn är separat och ändrar inte ritningsnamnet. Ritningsnamnet uppdateras vid omnumrering, delning, sammanslagning och inläsning av tidigare projekt. Tidigare projekt med AS-nummer uppdateras vid inläsning. Välj **Numrera assemblies** för likhetsnumrering. Lika grupper delar A-nummer, namn och en ritning; jämförelsen omfattar tillverkningsdelar och deras placering/riktning relativt huvuddelen. Flyttade eller roterade kopior kan därför dela typ. Den gemensamma ritningslistans numreringsknapp uppdaterar både detalj- och assemblytyper. Ändrade grupper får nya typnummer, medan tidigare nummer reserveras. Vid delning kopieras ritningsredigeringarna till den nya typen och flaggas för granskning. Vid sammanslagning av flera ritningar måste du välja vilken som ska behållas; Avbryt lämnar numreringen oförändrad. Delarnas detaljnummer används i stycklistan och vid Part mark på snappunkter i vyerna. Modellobjektens beteckningar är separata från detaljnumreringen, så exempelvis modellobjekt B-025 kan ha detaljnummer B-001.

Assemblybladet visar Top, Front, sidovy och snitt A–A. Vyer, skala, snitt, detaljvyer och mått redigeras i samma ritningsredigerare som Single Part. Bladet visar antal assemblies av typen, och stycklistan visar delar per assembly. Stycklistan grupperar lika numrerade delar och visar profil/namn, material och antal inom assemblyn. Placering och synlighet ändras under **Stycklista** i ritningsinspectorn. **Redigera stycklista…** öppnar en editor för kolumnrubriker, synlighet, ordning, bredder, textstorlek och sortering. Du kan lägga till egna textkolumner och ändra profil/namn samt material på ritningen. Detaljnummer och antal följer modellen och kan inte skrivas över. Radtexter knyts till tillverkningsdelen och gäller ritningen; en ändrad tillverkningsdel får en ny rad utan tidigare textändringar. **Spara stycklista** tillämpar ändringarna, medan Avbryt behåller tidigare värden. **Återställ radtexter** tar bort egna celltexter. Allt följer med projektfilen och ritningens vanliga sparning och ångraflöde. Långa texter klipps till tabellcellen; större blad eller ändrad skala/placering kan behövas för stora sammanställningar.

Under **Redigera assembly** kan du ändra namn, lägga till delar, ta bort delar från gruppen och välja en annan huvuddel. Lägg till en del från väljaren eller använd modellens markering med **Lägg till markerade delar**. Ändringarna lagras först när du väljer **Spara assembly**; Avbryt lämnar gruppen och ritningen oförändrade. Minst en del krävs, huvuddelen måste ingå och en del kan inte samtidigt tillhöra två grupper. Namnbyte gäller alla instanser av samma numrerade typ. Ändrat medlemskap eller huvuddel kräver ny assemblynumrering; ritningsredigeringar följer med för granskning. Ritningen har samma nummer och namn som assemblyn. Befintliga vyer behåller sin riktning vid byte av huvuddel, medan nya standardvyer följer den nya huvuddelen. Mått till borttagna delar behålls med brutna referenser för manuell granskning. Ritningen får status **Kontrollera ritning** efter ändrat medlemskap eller huvuddel.

Välj **Assembly** under **Gruppera modell** i modellistan för att se gruppens delar. **Markera hela** väljer hela assemblyn, även när sökningen bara visar en del av den. Shift-klick lägger till eller tar bort gruppen ur markeringen. Sökningen stöder också A-nummer och assemblynamn.

Assemblies, ritningsredigeringar och stycklistans placering sparas i `.lira.json` och omfattas av ångra/gör om. Modelländringar flaggar ritningen för granskning. Om en ingående del tas bort behålls gruppen och ritningen med status att källan saknas; Ångra kan återställa delen eller Redigera assembly kan ta bort den saknade referensen. Byte av en borttagen huvuddel använder ritningens senast sparade koordinatsystem; äldre ritningar utan den uppgiften kräver att huvuddelen återställs först. **Ta bort assembly** tar bort gruppen och behåller den gemensamma ritningen så länge typen har andra instanser; den sista gruppen tar även bort ritningen. Borttagningen behåller modelldelarna och deras Single Part-ritningar. Automatisk assemblyidentifiering och svetsbeteckningar ingår ännu inte.

`src/sweep.js` separerar geometri och validering från UI. Orienteringen följer `ProfileSweepEntity.localFrame()` i Mac-appen: Z upp, profil-X via längdaxel × Z, med X som reserv vid vertikal axel. Profilens placering styrs av insättningspunkten och 3×3-väljaren.

## Snappning

- Ändpunkter snappar i 3D till exakta XYZ-värden (även annan höjd); därefter prioriteras stomlinjekorsningar, riktningsstyrning och sist valfria rutsteg i arbetsplanet (av som standard).
- XYZ aktiverar automatisk riktningssnappning från startpunkten i skärmens närhet av respektive axel. Polar väljs i 15°, 30°, 45° eller 90° och gäller XY-planet genom startpunkten.
- Efter första punkten låser tangenterna eller knapparna X/Y/Z en axel. Tryck samma igen för att låsa upp. Exakt snappning till objekt får aldrig bryta en explicit låsning.
- Riktningarnas längd följer musen kontinuerligt. Om Rutnätsnap aktiveras avrundas längden med valt steg; exakta ändpunkter/korsningar avrundas inte. En axel sedd rakt framifrån kan inte få en längd från musen: byt vy (t.ex. 3D för Z) eller ange koordinater.
- Markör och text visar aktiv snapp; en streckad hjälplinje visas vid riktningssnappning. Escape avbryter.

## Exakt längd under ritning

Välj startpunkt, peka ut riktningen med musen (fri, polar eller XYZ) och börja skriva en längd i mm. Enter skapar sweepen. Längdfältet kan också klickas. Riktning och tecken fryses när inmatningen börjar; musrörelser ändrar då inte riktningen. Töm fältet för att återgå till att peka ut en riktning, eller tryck Escape för att avbryta. Decimalpunkt och decimalkomma stöds. Längden måste vara minst 1 mm och avrundas inte till 100 mm. Vid explicit axellåsning utan utpekad riktning används axelns positiva riktning.

## Flytta, kopiera och ändra ändpunkter

Markera en sweep, välj Flytta eller Kopiera i verktygslådan och klicka en baspunkt. Klicka en målpunkt eller använd X/Y/Z/polar och skriv ett exakt avstånd följt av Enter. Profil, rotation och insättningsläge följer med. Kopian får en egen identitet.

Klicka på den markerade sweepens startcirkel eller slutfyrkant för att flytta bara den punkten. Klicka målpunkt eller ange riktning och avstånd. Den andra ändpunkten ligger kvar. Punkten flyttas med klick–klick (inte drag). Escape avbryter förhandsvisningen, och färdiga ändringar kan ångras/göras om. Kameran behålls. Flytt till nollängd eller utanför modellens koordinatgränser avvisas.

Stomlinjesnappning använder linjernas verkliga XYZ-position (stomlinjeobjektens höjd), även vid Flytta/Kopiera eller ändpunktsflytt från annan höjd. Bas- och målpunkt ger då en verklig 3D-förflyttning. X/Y-låsning tillåter inte en träff på en annan höjd. Ingen dold projektion till startpunktens Z används.

## Multimarkering

Shift-klick på en sweep eller i objektlistan lägger till/tar bort den i markeringen. Välj Ruta och dra en ruta: vänster till höger ger en blå ruta som väljer helt inneslutna sweeps; höger till vänster ger en grön streckad ruta som även väljer sweeps som rutan skär. Ruta förblir aktiv för fler markeringar tills du byter verktyg eller trycker Escape. Shift-dra fungerar direkt och lägger till träffarna i markeringen. Vanlig vänsterdragning behåller orbit. Flytta/Kopiera använder en gemensam bas- och målpunkt för hela markeringen; exakt avstånd och axellås fungerar som tidigare. Ta bort markerade eller Delete tar bort gruppen. Varje gruppändring är ett ångringssteg. Escape avbryter förhandsvisningen. Egenskaper och klickbara ändpunkter visas vid enkelmarkering.

## Rotation

Markera en eller flera sweeps och välj Rotera. Klicka referenslinjens startpunkt och slutpunkt med hörn-, ändpunkts- eller stomlinjesnap. X/Y/Z kan låsa riktningen efter första punkten. Linjen måste vara minst 1 mm lång och kan luta fritt i 3D. Hela markeringen roterar runt den oändliga axel som punkterna definierar.

Efter andra punkten visas en ring runt referenslinjen. Dra ringen eller skriv en exakt vinkel nederst (även negativa vinklar och decimalkomma). Enter eller Rotera bekräftar; Escape avbryter. Ny referenslinje låter dig välja om båda punkterna och återställer förhandsvinkeln. Punkternas ordning bestämmer axelns positiva riktning enligt högerhandsregeln. När ringen ses rakt från sidan används musens rörelse åt höger/uppåt för positiv vinkel.

Vinkelsnap är 15° som standard och kan ändras eller stängas av under Inställningar → Snappning. Exakt inmatning påverkas inte av vinkelsnap. Hela profilens orientering och excentriska insättningsläge följer rotationen. Grupprotation är ett gemensamt ångringssteg.


## Plate

Plate är en separat objekttyp med en sluten polygon i lokala U/V-koordinater, ett ortonormalt arbetsplan (origo, U och V), tjocklek och placering relativt planet. Polygon och plan lagras separat från triangulerad visningsgeometri. Denna extrusion kan senare återanvändas för Polygoncut; materialsubtraktion är ännu inte implementerad.

Välj Plate i verktygslådan och arbetsplan i sidopanelen: XY, XZ eller YZ genom första hörnet, alternativt tre snappade punkter som definierar ett valfritt plan. Vid trepunktsplan är planpunkterna separata från polygonens hörn. Klicka hörnen och avsluta med Enter, Slut polygon eller klick på första hörnet. Backspace tar bort senaste hörnet under ritning, Escape avbryter. Tjocklek och centrerad/positiv/negativ placering förhandsvisas medan du ritar. Den gröna pilen visar planets positiva normal. X/Y/Z-lås och polar arbetar inom planet; verkliga snappunkter utanför planet väljs inte och projiceras inte dolt.

Markera en Plate och klicka ett hörn i modellen eller dess nummer i sidopanelen för att flytta hörnet med snap i samma plan. Du kan också redigera lokala U/V-koordinater, tjocklek och placering och välja Uppdatera Plate. Kameran behålls. Självkorsande polygoner, nollängdskanter och degenererade plan avvisas. Konkava polygoner stöds; hål i polygoner ingår inte i denna första version.

Flytta, kopiera, rotation runt tvåpunktsaxel, markering, hörnsnap, ta bort och ångra/gör om fungerar även för grupper med både Plate och sweep.


## Inspector

Högerpanelen har flikarna Egenskaper och Modell. Utan markering visas modellistan; Sweep/Plate öppnar egenskaper för det nya objektet. Markering i modellen öppnar egenskaper, medan klick/Shift-klick i modellistan behåller listan så att flera objekt kan väljas. Namn och typ visas vid enkelmarkering. Koordinater och polygonhörn ligger under Geometri, som kan fällas ut. Klick på en ändpunkt eller ett Plate-hörn öppnar dess geometrifält under flyttningen.

Befintliga objekt förhandsvisas direkt vid fältredigering. Enter eller att lämna ett text-/talfält bekräftar; val i en rullista bekräftas vid valet. Escape återställer en pågående fältändring. Ogiltiga värden avvisas. En bekräftad ändring är ett ångringssteg, och kameran behålls. Skapa sweep och Slut polygon finns kvar vid skapande; befintliga objekt har ingen Uppdatera-knapp.

Flera sweeps delar profil-, dimensions-, rotations- och insättningsfält. Flera Plates delar tjocklek och placering. Olika värden visas som Blandat, och ändring av ett fält gäller hela gruppen i ett ångringssteg. Blandade Plate/sweep-grupper visar att geometriegenskaperna skiljer sig; gruppens flytt, kopiering, rotation och borttagning finns fortsatt tillgängliga.


## Polygoncut

Markera en eller flera sweeps/Plates och välj Cut. Rita en plan polygon med samma arbetsplan och snap som Plate, ange skärdjup och sida, och bekräfta med Enter eller Slut polygon. Skärresultatet förhandsvisas tillsammans med en genomskinlig orange skärvolym. Bara de valda målobjekten påverkas. Skärvolymen är en separat polygoncut-post med mål-ID:n; originalens profil, polygon och mått bevaras.

Markera ett mål och öppna skärningen under Skärningar i inspectorn, eller välj den i Modell. Djup, sida och polygonhörn redigeras direkt; Flytta och Rotera kan ändra skärvolymens läge. Skärvolymen är fixerad i modellens koordinater: flytt av enbart målobjektet flyttar inte skärvolymen. Markera båda för gemensam flytt/rotation. En kopia av enbart ett mål får dess ursprungsgeometri; kopiering av en skärvolym behåller dess målreferenser. Borttagning av skärningen återställer materialet. Borttagning av sista målet tar även bort dess överblivna skärningar. Ångra/gör om återställer hela relationen.

Geometrisk subtraktion använder three-bvh-csg 0.0.18 (MIT). Nya kantkorsningar ger snappunkter och skurna ytor används vid markering. Triangelindelningens kollineära mellanpunkter filtreras från hörnsnap. Helt bortskurna mål finns kvar i modellistan. Testerna täcker volym, hel borttagning, hålprofiler, flera mål, ändrat djup samt återställning. CSG-kärnans numeriska begränsningar gäller fortfarande för svåra sammanfallande ytor; misslyckade beräkningar ska avvisas före bekräftelse.

Polygoncut visas alltid med orange konturlinjer, även genom målobjekten. Klick nära en konturlinje markerar skärningen; markeringen visar även genomskinlig skärvolym och redigerbara polygonhörn. Området innanför konturen fångar inte klick på underliggande objekt. Linjernas klicktolerans är 7 skärmpixlar oberoende av zoom. Markeringsruta kan också välja skärningar.


## Linecut

Linecut är en egen objekttyp (`type: linecut`) med namn, två lokala punkter (`polygon` med exakt två U/V-par), arbetsplan, skärsida och mål-ID:n. Den har ingen tjocklek och inget material. Välj en eller flera sweeps och Linecut. Välj XY/XZ/YZ genom första punkten eller ett arbetsplan genom tre punkter; klicka sedan snittlinjens två punkter och sidan som ska tas bort. Enter bekräftar. Skärsidan kan även väljas i inspectorn. Escape avbryter.

Det oändliga snittplanet går genom linjen och arbetsplanets normal. På vald sida tas allt material bort. Internt byggs ett halvrymdsverktyg utifrån varje måls aktuella utbredning, så att förlängda sweeps fortfarande kapas. Den orange rektangeln är endast en visning av snittplanet; dess storlek begränsar inte skärningen. Pilen visar sidan som tas bort. Linje och kontur är klickbara. Två punktmarkörer låter dig flytta snittlinjens punkter med snap i arbetsplanet. Hela objektet kan flyttas eller roteras.

Linecut syns i modellistan, målobjektets Skärningar och sin egen inspector. Skärsida och punktkoordinater redigeras med direkt förhandsvisning. Originalet återställs när Linecut tas bort. Ångra/gör om omfattar både objekt och målrelationer. Linecut använder samma fasta modellkoordinater som Polygoncut; välj både mål och skärning om de ska flyttas tillsammans.

## Tvärsnittsbibliotek och 2D-editor

Öppna **Tvärsnittsbibliotek** under Sweep i inspectorn. Rita en ytterkontur med Polylinje eller Rektangel och lägg till slutna hål med Hål. Snap omfattar hörn, mittpunkter och origo; Ortho och Polar styr riktningen från senaste punkten. Ange exakta X/Y-koordinater eller peka ut en riktning och ange Längd. Enter sluter en polylinje. Markera och dra hörn, markera flera med ruta/Shift, eller ändra en vald punkts koordinatuttryck. Mitten/höger musknapp panorerar; mushjulet zoomar mot pekaren. Ångra/gör om finns i editorn.

Parametrar anges en per rad, exempelvis `B = 200`, `H = 300`, `tf = 12`. En vald punkt kan få koordinatuttryck som `B/2` och `H/2-tf`. Mallarna B × H och I-profil har redan kopplade koordinater. Parametrar kan bero på varandra; cirkulära samband och ogiltig geometri avvisas. Numerisk koordinatinmatning under ritning utvärderar uttrycket till en punkt; bindningar redigeras sedan via X-/Y-uttryck. Dragning av en punkt ersätter dess uttryck med fasta koordinater. Detta är en första editor med raka segment, inte en generell geometrisk constraint-solver; bågar, radier och automatisk måttsättning återstår. I-mallen har skarpa hörn och är inte en standardverifierad HEA.

Profiler sparar namn, familj, standard, källa, densitet, parametrar, konturer, insättningspunkt och separata katalogvärden. Beräknade värden är area, tyngdpunkt, Ix/Iy/Ixy kring tyngdpunkten, elastiska böjmotstånd och massa per meter. Enheter visas i gränssnittet. Katalogvärden är manuellt angivna och påverkar inte geometrin. Man kan namnge egna poster exempelvis HEA200, men ansvarar för inmatad geometri och katalogkälla. Ingen dimensioneringskontroll görs.

**Spara version** bevarar äldre versioner. **Ny variant** ger en separat profilidentitet. **Använd på sweep** sparar aktuell version och tilldelar den till markerade sweeps, eller väljer den för nästa sweep. Modellen bär en egen kopia av profilgeometrin, beräknade värden och katalogdata; biblioteksändringar ändrar inte befintliga sweeps automatiskt. Profilen fungerar med insättningsläge, rotation, hörnsnap och skärningar.

Biblioteket lagras som schema 1 i `localStorage` under `lirastructure.sections.v1`, per webbläsare och webbplatsadress. Exportera JSON för en separat säkerhetskopia eller överföring. Import validerar hela filen före sparande och slår ihop versioner; konflikter med samma profil-ID/version avvisas. Detta sparar biblioteket, inte modellens objekt.

## Snabbformer i inspectorn

Tvärsnitt har två ingångar: **Form** för mått per sweep och **Bibliotek** för sparade profilversioner. Form omfattar rektangel, rektangulärt rör, cirkel, cirkulärt rör, likbent triangel och den tidigare förenklade I-profilen. Cirkel använder diameter; rör visar även godstjocklek; triangeln använder bas och höjd. Ändringar förhandsvisas och bekräftas med Enter eller när fältet lämnas, med ångra/gör om. Byte från biblioteksprofil till Form väljer rektangel med samma yttermått; välj sedan önskad form.

Runda tvärsnitt trianguleras med 96 segment. Snappningen använder fyra kvadrantpunkter per ändkontur, även på rörets insida, för att undvika snapp till varje tesselleringspunkt. 3×3-insättningen utgår från tvärsnittets omslutande rektangel. Triangelns mittläge är mitten av dess bas/höjd-utbredning, inte tyngdpunkten. Formdefinitioner och normalisering finns i `src/profile-forms.js`.

## Parametriska profiltypmallar

Välj H, I, L, U eller C med läppar i 2D-editorns Profiltyp. Valet bygger en ny parametrisk grundkontur; befintlig kontur ersätts och katalogvärden töms, med Ångra som återställning. H och I använder samma raka I-geometri men separata bibliotekskategorier. U är en öppen kanal och C har inåtriktade läppar. Ange storleksnamn och valfritt familjenamn, ändra måttfälten och spara. Ny variant kopierar parametrarna till en separat storlek.

Höjd och bredd visas som måttlinjer; tjocklekar och läpplängd som separata klickbara måttetiketter. Klick fokuserar rätt måttfält. Ogiltiga tjocklekar och överlappande läppar blockerar sparande. Mallarnas definitioner finns i `src/section-templates.js`. Övrig behåller konturen med fri parameter- och punktredigering. Dessa mallar har skarpa hörn, inga radier eller lutande flänsar, och är inte verifierade standardprofiler.

## Runda sweeps: visning, snap och återanvändning

Snabbformernas cirkel/rör och oförändrade cirkelmallar från biblioteket använder samma runda geometri. Mantelytan har radiella normaler (omvända på rörets insida), medan ändytorna behåller plana normaler. Oskurna runda sweeps visar ändkonturer utan longitudinella segmentlinjer; skurna objekt behåller den allmänna kantvisningen för att inte dölja skärkanter.

Kvadranterna räknas exakt från radierna i profilens lokala koordinater och följer rotation/insättningsläge. Innerkonturen får egna fyra punkter. Modifierade biblioteksprofiler känns bara igen som cirklar om de faktiska konturerna fortfarande stämmer; annars används deras riktiga polygonhörn. Skurna objekt använder fortsatt skärresultatets hörn.

En begränsad cache (32 radiekombinationer) återanvänder lokal triangulering och normaler för alla längder och orienteringar. Varje objekt får en egen kopia före transformering och CSG, så mesh-disponering inte förstör cachen. Detta är återanvändning av CPU-beräkning, inte GPU-instancing; minnesåtgången för varje modellobjekt kvarstår. Ingen storskalig prestandamätning är genomförd i detta steg.

## Individuella snapval

Inställningar → Snappning har separata val för ändpunkter/insättningspunkter, profilhörn, cirkelkvadranter, stomlinjer, stomlinjekorsningar, rutnätsnap och automatisk XYZ-riktning. Polar och rotationssnap har Av i sina vinkelval. Rutnätsnap är av som standard; påslagen använder den angivet steg (0,001–100 000 mm). Fri XY-placering är oavrundad, och andra arbetsplan använder sina lokala U/V-koordinater för valbara rutsteg. Explicit axellås ligger kvar även om automatisk riktningssnap är av.

Rita, flytta, kopiera, rotationsaxel och punktredigering använder samma snapfunktion. Tillämpa sparar valen för sessionen och ingår i ångra/gör om; Avbryt lämnar aktiva val oförändrade. 2D-profileditorn har fortfarande egna ritinställningar.

## Mittpunkt och vinkelrät snap

Inställningar → Snappning har separata val för Mittpunkter och Vinkelrät mot axel eller kant, båda på som standard. Mittpunkter visas som trianglar; vinkelrät snap som rätvinkelmarkering. Svepets insättningsaxel och raka geometrikanter används som mål. Oskurna cirklar/rör använder axeln, inte tesselleringskanterna. Plate har även sina referenskonturer. Skurna objekt använder resultatets geometrikanter; kollineära delsegment slås ihop före mittpunktsberäkning.

Vinkelrät snap kräver en startpunkt och beräknar dess ortogonala projektion i 3D på ett ändligt segment. Förlängningar och sammanfallande start-/målpunkter fångas inte. Båda funktionerna respekterar arbetsplan och explicita axellås och fungerar genom den gemensamma snapfunktionen vid ritning, flytt, kopiering och punktredigering. Segmentlistan återanvänds tills objektet eller dess skärningar ändras.

## Materialbibliotek

Material och färg i inspectorn gäller nya och markerade sweeps/Plates, även flermarkering. Biblioteket har fasta kategorier Stål, Betong, Isolering, Trä och Övrigt. Skapa egna namngivna material med densitet (kg/m³) och standardfärg. Inga standardklassers materialegenskaper förifylls. Materialfärgen används när objektet inte har egen färg; markeringens gröna färg och förhandsvisningar behåller sin funktion. Skärobjekt tilldelas inget material.

Biblioteket lagras som schema 1 under `lirastructure.materials.v1` i localStorage och kan exporteras/importeras i JSON. Import valideras före skrivning, sammanfogar versioner och avvisar konflikter. Redigering sparar en ny version. Objekt lagrar en egen materialkopia med ID, revision, kategori, namn, densitet och färg; bibliotekets ändringar påverkar därför inte gamla objekt automatiskt. Välj den nya versionen i inspectorn för att uppdatera. Objektändringar omfattas av modellens ångra/gör om; biblioteksändringar bevaras som versioner. Densiteten är förberedd på objektnivå för framtida viktberäkning; ingen ny viktberäkning eller strukturell materialmodell ingår ännu.

## Hjälplinjer och hjälppunkter

Välj Hjälppunkt eller Hjälplinje i verktygslådans grupp Hjälp. En punkt placeras med ett klick, en ändlig linje med två. Verktygen använder modellens snap och aktiva arbetsplan. Efter linjens första punkt fungerar polar, axellås och exakt längdinmatning. XYZ kan också anges i inspectorn.

Hjälpobjekten visas som kryss respektive streckade linjer. Markera dem i modellen eller modellträdet för att redigera koordinater, flytta insättningspunkter, kopiera, rotera eller ta bort. Ändringar ingår i ångra/gör om. Visa hjälpobjekt i vykontrollerna döljer eller visar dem gemensamt; dolda hjälpobjekt snappar inte. De ingår inte i material, partnumrering, GA eller Single Part.

Verktygslådan har fasta grupper: Markera, Skapa, Bearbeta, Ändra och Hjälp. Hovra eller klicka för att öppna gruppen åt höger. Verktygen ligger i fast ordning; gruppens symbol ändras inte med valet. Tab når grupperna, högerpil öppnar verktygen och Escape stänger undermenyn.

Redigeringsgrepp visas för 1–4 markerade objekt, och döljs vid 5 eller fler. Sammanfallande insättningspunkter på markerade objekt får ett gemensamt grepp och flyttas tillsammans med klick–klick. Under ritning och flytt döljs befintliga objekts grepp; snap fungerar fortfarande och endast pågående verktygs punkter visas. Plate-hörn måste ligga kvar i respektive plans yta.

I GA och Single Part visar inspectorn endast anteckningens egenskaper när en måttkedja eller part mark är vald. Högerklicka på måttkedjan och välj Lägg till måttpunkt (finns även i inspectorn), klicka flera punkter med snap och avsluta med Escape. Högerklick på ett måttpunktsgrepp ger Ta bort måttpunkt; minst två punkter måste finnas kvar.

### Modellkopplade mått och part marks
Nya måttpunkter som snappas till objekt får en modellreferens. Referenserna används
av både GA och Single Part och följer flytt och måttändringar när ritningen byggs
om. Single Part använder den aktuella detaljens lokala koordinater, även efter
kloning av en ritning vid omnumrering. Uppdatera numreringen efter en detaljändring
innan Single Part-ritningen öppnas igen.

Inspektorn visar antalet kopplade punkter. Fria punkter och äldre mått kopplas inte
automatiskt: klicka på fästpunkten och välj en snappunkt för att koppla om den.
Tillagda delmått får samma referenshantering. GA-planens stomlinjer kan också
refereras; ändras antalet stomlinjer måste kopplingen kontrolleras.

Försvinner källan eller ändras den projicerade geometrins struktur så att hörnet
inte säkert kan identifieras behålls senast kända punkt med ett orange utropstecken.
Inspektorn visar den brutna kopplingen. Koppla om genom att flytta fästpunkten.
Part marks kan följa en punkt inom objektets utbredning; i GA kontrolleras även att
fästpunkten fortfarande träffar objektet. Fria punkter på snittets stom-/höjdlinjer
är ännu inte associativa.

### Gemensamma snitt och detaljhänvisningar
GA-snitt och detaljer sparar definitioner i modellkoordinater tillsammans med den
vy som äger sektions-/detaljbilden. Projektets ritningar bildar ett gemensamt
register: en annan GA-vy visar automatiskt hänvisningen när riktning, nivåintervall
och visningsområde passar. Markeringen anger beteckning och ursprungsritningens
nummer. Under **Hänvisningar** i vyinspektorn går varje markering att dölja separat.
Redigera snittlinjen eller detaljområdet på ursprungsritningen; hänvisningar på
andra blad beräknas från samma definition när bladet öppnas. Tas ägarvyn eller
ritningen bort försvinner också dess hänvisningar. En detalj från ett snitt behåller
kopplingen till snittet och följer ändringar i dess läge och riktning.

Single Parts tidigare fasta A–A konverteras till samma sektionstyp som nya snitt.
Den får snittdjup, riktningsbyte, flytt och beskärningsgrepp. Befintligt vy-id och
mått behålls; koordinaterna för mått i den äldre sektionsvyn migreras en gång.
Snittets blickriktning styr fram/bak och vänster/höger; sektionsbilden hålls upprätt.
Single Part-definitioner sprids inte till GA.

Single Part visar sektionsmarkeringen enbart i ursprungsvyn. Sektionens
uppåtriktning följer ursprungsvyns uppåtriktning projicerad i snittplanet.
Om denna ligger längs blickriktningen används ursprungsvyns normal i stället.
Ingen global Z-uppriktning används för Single Part.
GA behåller sin tidigare orientering och sina hänvisningar mellan ritningar.
Äldre Single Part-vyer och mått räknas om en gång. Osäkra punktkopplingar i roterade
sektioner markeras för omkoppling i stället för att tilldelas ett annat hörn.

## Git, säkerhetskopiering och automatisk publicering

Webbapp: https://andreassvensson87-dev.github.io/LiraStructureWeb/
Källkod: https://github.com/andreassvensson87-dev/LiraStructureWeb

Projektets källkod ligger direkt i arkivets rot. Git-historiken bevarar tidigare
releasefiler och kodbackuper. `dist/`, `node_modules`, lokala skärmbilder och
`.env`-filer ingår inte i Git.

### Arbeta och publicera

```sh
git status
git add <filer-som-du-vill-spara>
git commit -m "Beskriv ändringen"
git push
```

Push till `main` sparar koden på GitHub och startar `.github/workflows/deploy.yml`.
GitHub Actions testar och bygger appen, och publicerar enbart `dist/` via GitHub
Pages. Pull requests kontrolleras utan publicering. Om kontrollerna misslyckas
ligger den tidigare publicerade versionen kvar. Följ körningen under **Actions**.
GitHub Pages använder **GitHub Actions** som källa, inte en mapp i `main`.

### Återställ på en ny dator

Installera Git och Node.js 22 eller senare (inklusive npm):

```sh
git clone https://github.com/andreassvensson87-dev/LiraStructureWeb.git
cd LiraStructureWeb
npm ci
npm run check
npm run dev
```

Ingen separat ZIP-backup eller manuell uppladdning behövs längre. Lokala ändringar
är dock inte säkerhetskopierade förrän de har committats och pushats.
Modeller, ritningar och bibliotek i webbläsarens lagring ingår inte i kodbackupen.

### Installerbar webbapp

Manifest, ikoner och offlinecache ingår i produktionsbygget. Appadressen och
installationen behålls. Offline fungerar efter första lyckade cacheinstallationen.
Webbläsarens lagring kan rensas och ersätter inte projektbackuper.

Modeller och ritningar finns fortfarande endast i sessionen. Appuppdateringar
väntar tills alla appfönster har stängts och laddar inte om pågående modellarbete.

Inspektorns paneler **Egenskaper**, **Modell**, **Filter** och **Referenser** väljs med ikonerna längs högerkanten. Håll musen över en ikon för panelens namn. Upp-/nedpil växlar panel när ikonremsan har fokus.

Den nedre menyn innehåller **Assembly / Part** för markeringsläge och **Vy** för kameravyer, arbetsplan och hjälpobjekt. Part är standard; Assembly väljer alla befintliga medlemmar i samma assembly vid klick eller rutmarkering. Delar utan assembly markeras som vanligt. Shift-klick växlar hela assemblyn i markeringen. Växeln påverkar markering i modellen och modellistan, medan verktygens val av referensdelar behåller sitt tidigare beteende. Skruvgrupper hålls samman i båda lägena.

## Mus och trackpad

Under **Inställningar → Navigering → Inmatningsenhet** väljer du **Mus med scrollhjul** eller **Trackpad** och klickar på **Tillämpa**. Musläget behåller scrollhjulszoom; nedtryckt scrollhjul och drag panorerar både modellen och ritningsbladen. Med Trackpad panorerar tvåfingersscroll och nypgester zoomar. Samma val gäller 3D-modellen, Single Part/Assembly/GA-blad samt profil- och ram/layouteditorerna. Valet sparas i webbläsaren på enheten och följer inte med projektfilen. Avbryt lämnar tidigare val oförändrat. I neutralt läge markerar vänsterklick och vänsterdrag rektangelmarkerar. Shift lägger till i markeringen. Vänster till höger väljer helt inneslutna objekt; höger till vänster väljer även objekt som korsas. Orbit i 3D-vyn sker med Ctrl + nedtryckt scrollhjul (eller Ctrl + högerklick) och drag.

I samma flik finns **Zoomhastighet**, från 25 % till 400 % med 100 % som standard. Hastigheten gäller scrollhjulszoom och trackpadens nypgest i modellen och editorerna, medan panorering behåller sin hastighet. **Återställ zoomhastighet** sätter reglaget till 100 %; välj **Tillämpa** för att spara.

Markera objekt i modellen och använd **Ctrl+M** för Flytta, **Ctrl+C** för Kopiera och **Ctrl+R** för Rotera. På Mac fungerar även Cmd. Kortkommandona startar samma verktyg som knapparna och kan växla mellan verktygen. Textfält behåller sina vanliga kortkommandon; modellkommandona är avstängda i dialoger. Escape avbryter verktyget.

För markerade sweeps flyttar **Shift+piltangent** insättningspunkten ett steg i profilens 3 × 3-ruta, med stopp vid kanten. **Shift+mellanslag** roterar profilen 90° runt längdaxeln. Samma kortkommandon används på Mac och Windows. Vid flerval ändras varje sweep från sitt eget läge; ett valt sweep-urval i inspektören kan också användas. Ändringen bekräftas direkt och går att ångra. Dessa kortkommandon är avstängda vid modellering, aktiva verktyg, dialoger och inmatning i textfält.

Stomlinjer är egna, icke-fysiska modellobjekt. Markera linjen eller bubblan i vanligt modelläge och ändra beteckning, serie, bubblor, ändpunkter, längd och vinkel i inspektorn. Modellens vanliga Flytta, Kopiera, Rotera, ändpunktshandtag, snappning och Polar används även för stomlinjer. Skapa nya via Hjälpgeometri → Stomlinjer. Snapinställningar ligger kvar i Settings. Äldre stomlinjer konverteras till objekt vid öppning; de deltar inte i part- eller assemblynumrering. Settings → Stomlinjer styr bara bubbelvisning och textstorlek.

Koordinatindikatorn ligger fast nere till höger i modellvyn och visar globala XYZ-riktningar när kameran roteras. Indikatorn är liten, utan bakgrund eller förklarande text. Klicka på en axelbubbla (+X, +Y eller +Z) för att se modellen från den sidan. Axelvyerna behåller zoom och kamerans målpunkt. Ett valt arbetsplan visas fortfarande med sin lokala indikator i modellen.


Numreringsdialogen öppnar på **Numrering**, med förhandsgranskning före tilldelning. **Inställningar** är flik två. Part-inspektorn visar **Part mark** samt **Prefix** och **Startnummer** på en alltid synlig rad under **Numrering**. Assembly-inspektorn visar motsvarande uppgifter för assemblyn. Assemblyserien redigeras direkt i Assembly-lägets inspektor; äldre grupper använder huvuddelens serie tills en egen serie anges. P / 100 ger P100, P101 och uppåt; lika detaljer inom samma serie delar mark. Olika serier hålls isär, även vid lika geometri. Varje kombination av prefix och startnummer har egen progression: P/100 fortsätter på P101 även om P/3000 redan används. Överlappande serier med samma prefix hoppar över upptagna nummer.

Inställningarna styr om allt ska numreras om från start, om lediga gamla nummer får återanvändas, hur nya och ändrade detaljtyper jämförs med tidigare typer, hål- och namnjämförelse samt måttolerans och assemblyns placeringstolerans i mm. Noll ger exakt jämförelse. Assemblies numreras efter detaljerna och jämför delarnas part marks, antal, huvuddel, orientering och relativa placering. Ändrade part marks kräver därför kontroll av assemblynumreringen. Vid enbart assemblynumrering måste detaljerna först ha giltiga marks. Tilldelningen kan ångras och nummerserierna sparas i projektfilen.


I **Assembly**-läget visar inspektorn assemblyprefix, startnummer och ingående delar med objektbeteckning och part mark. Huvuddelen har en diskret färgad ram. Klick på en rad markerar delen i modellen, ◇ gör delen till huvuddel och × tar delen ur assemblyn utan att ta bort modellobjektet. Välj en annan huvuddel innan den nuvarande tas ur. En fristående part är en assembly med sig själv som huvuddel; vid numrering sparas även dessa grupper. Serie- och medlemsändringar kan ångras och gör tidigare assemblynumrering ogiltig tills den kontrollerats igen.
