# Numrering

**Numrering** i menyraden öppnar en egen modul med två flikar:

- **Inställningar:** välj detaljer, assemblies eller båda. Ange prefix och startnummer för nya Sweep-, Plate- och assemblytyper.
- **Förhandsgranskning:** grupperad lista med status, objekt, antal, tidigare nummer och föreslaget nummer. Filter visar nya, ändrade och oförändrade objekt. Klick på raden eller objektnamnet markerar gruppens objekt i modellen.

Resultatraderna är kompakta, med 24 px radhöjd och fast tabellhuvud vid
rullning. En liten pil fäller ut berörda objekt och eventuella ändringsorsaker.
Detaljraden skapas först när pilen används, så även stora listor förblir täta.
Zoomikonen på raden visar gruppens objekt i modellen. Klick på ett objekt i
detaljlistan markerar och zoomar till just det objektet. Förhandsgranskningen
fälls då undan till en liten panel; **Tillbaka till listan** återställer samma
lista, filter och ritningsval. **Visa modellen** fäller undan listan utan att
ändra kameran. Modellen kan granskas men inte redigeras medan dialogen är öppen.

Ändrade rader kan visa en kort orsak: geometri/profil,
material, hålbild, bearbetning eller insättning. Flera orsaker kan visas
samtidigt. Assemblies visar även ändrad huvuddel, antal delar och delarnas
placering eller orientering. Orsakerna jämför de lagrade numreringsnycklarna
med dagens nycklar och följer därmed numreringens befintliga jämförelseregler.
Nya och oförändrade rader visar bara berörda objekt i detaljlistan. Äldre nycklar som inte
går att tolka redovisas som saknade tidigare jämförelsedata.

Numreringen gäller hela modellen. Oförändrade typer behåller sina tidigare nummer. Prefix och startnummer gäller nya typer; befintliga registrerade nummer återanvänds när samma typ återkommer. Objektens individuella beteckningar i modellträdet är separata från tillverkningsnumren.

Detaljer jämförs med befintliga `partKey`: geometri, profil, material och bearbetningar. Assemblies jämförs även utifrån huvuddel och delarnas relativa placering. Jämförelsereglerna är fasta i denna version. Sammanfattningen räknar enskilda detaljer och assemblyinstanser; tabellen grupperar lika resultat.

Inga nummer eller ritningar ändras under förhandsgranskningen. **Avbryt**, stängknappen och Escape lämnar projektet orört. **Tilldela nummer** tillämpar både numrering och eventuella ritningsändringar med en enda historikcheckpoint. Hela tilldelningen kan ångras och göras om. De senast tilldelade inställningarna sparas lokalt i webbläsaren; projektets nummerregister följer med projektfilen.

Vid sammanslagning av typer med flera ritningar visas ett val under tabellen. Tilldelning är blockerad tills en ritning valts för varje berörd grupp. Övriga ritningar i gruppen tas bort från den aktiva listan. Befintliga ritningsflöden för detaljsplittringar, assemblysplittringar, referenser och granskning återanvänds. Förhandsgranskningar som blivit inaktuella kan inte tilldelas; förhandsgranska igen.

De tidigare knapparna **Numrera detaljer** och **Numrera assemblies** öppnar samma modul med respektive typ vald.

## Kod

- `src/numbering/plan.js`: validering, frikopplad plan, grupperat resultat och atomisk tilldelningspatch. Inga DOM- eller lagringsberoenden.
- `src/numbering/ui.js` och `ui.css`: dialog, inställningar, filter, ritningsval och tillgängliga flikar.
- `src/main.js`: modellanslutning, historikcheckpoint, markering och menyradsknapp.
- Befintliga `part-marks.js`, `single-part-drawings.js` och `assembly-numbering.js`: jämförelse och ritningshantering. Nummerserier är valfria argument; befintliga anrop behåller tidigare förval.

`tests/numbering.test.js` täcker förhandsgranskning utan mutation, nummerserier, splittringar, ritningsval, typval, inaktuella planer, inställningsvalidering samt projektfil och historik. `artifacts/numbering-preview-test.lira.json` är en verifieringsmodell med samtliga statusar och konflikter för både detalj- och assemblyritningar.
