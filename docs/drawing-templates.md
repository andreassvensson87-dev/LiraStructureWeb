# Ritningsmallar från DXF

De medföljande mallarna installeras i det lokala ram-, layout- och
ritningsinställningsbiblioteket vid första start. Befintliga bibliotek och
förval behålls. Utan tidigare förval används A3. Installation sker en gång,
så senare redigeringar och borttagningar av mallarna bevaras.

- **Mall A1**: 841 × 594 mm, liggande, med Rithuvud_A1.
- **Mall A3**: 420 × 297 mm, liggande, med Rithuvud_A3_A4.
- **Mall A4**: 210 × 297 mm, stående, med Rithuvud_A3_A4.

Välj en mall under Ritningsinställningar vid skapandet eller välj motsvarande
Layout på ett befintligt ritningsblad. Block och layouter kan redigeras i
Ram-editor. Nya vyer och kommandot Ordna vyer använder ramens marginaler.
Nya GA-vyer lämnar plats för rithuvudet. Befintliga vyplaceringar behålls.

DXF-filerna innehåller TEXT-platshållare. Dessa har kopplats till projektets
namn, nummer och beställare samt ritningsnummer, namn, kategori, datum, revision,
ändringskommentar, ritad av och granskad av. Status, handling, kontaktperson
och ansvarig part kan redigeras i ritningshanterarens attributkolumner.
Skala och format hämtas automatiskt; olika vyskalor visas som **Enl. vyer**.
Ritningsnamnet radbryts inom innehållsfältet och långa värden får mindre text
för att rymmas. Samma SVG-rendering används på bladet och i PDF-exporten.

Originalen finns i `assets/drawing-templates/`. Kör `npm run templates:import`
för att återskapa `src/bundled-drawing-templates.js` efter ändringar i DXF-filerna.
