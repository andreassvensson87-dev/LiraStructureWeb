# Komponenter och kopplingar

Verktygsgruppen **Kopplingar** innehåller **Fit** och **Komponentbibliotek**.
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

Första versionen kräver icke parallella axlar som möts inom 1 mm. Genomgående
anslutningar ska ligga inom första sweepens längd. Den använder plana kapytor,
inte konturanpassad urtagning runt rundprofiler, liv eller tidigare bearbetningar.

Biblioteket visar även planerade fotplåtar, pelare–balk, balk–balk och skarvar.
Dessa är ännu inte implementerade. Komponenttypen är avsedd att senare utökas med
fler definitioner, parametrar och genererade plåtar/skruvar.

Hover och markering använder en gemensam feedbackyta utan att ändra objektets material.
Vanlig hover är gul och en markerad del behåller sin gröna markering. Vid Fit följer
hover färgen för nästa referens: blå för första och orange för andra. Valda referenser
behåller en transparent färgyta och en kontur. Hover och tangentbordsfokus på en
referensrad i inspektorn förstärker samma objekt i modellen.
