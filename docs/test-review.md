# Testgranskning 2026-10-09

## Omfattning

Hela sviten inventerades utifrån testfallens namn, förekomst av assertioner och modulberoenden. Import-/exportgrafen från `main.js`, dynamiska literalimporter och worker-URL:er kontrollerades mot modulerna som testerna importerar. Överlappande områden nedan jämfördes i testkoden, inklusive de kvarvarande scenarierna som ska skydda samma beteende.

Detta är en relevans- och överlappsgranskning. Ingen fullständig mutationsanalys har gjorts och inte varje återstående assertion har bedömts individuellt. Att alla tester går igenom är inte ett bevis på att varje test fångar ett verkligt fel. Testantalet används inte som mål för rensningen.

## Borttagna testfall och kvarvarande skydd

| Borttaget | Skäl | Kvarvarande kontroll |
| --- | --- | --- |
| `model-tools`: enkel relativ flytt | Dubblerad translation | `transform` går nu via `transformCandidates` och kontrollerar både ändpunkter, källans orördhet, profilplacering, flytt/kopiering och punktredigering |
| `numbering`: ångra och filrundtur | Samma projekttransaktion testas i det sammanhängande numreringsflödet | `numbering-workflow` jämför nu hela återlästa projektet och verifierar både undo och redo |
| `assembly-numbering`: äldre namn efter namnändring | Samma `updateAssembly`-beteende finns redan | `assemblies` testar namnändring, bevarade referenser och uppgradering av äldre ritningsidentitet; `numbering-workflow` testar beskrivande assemblynamn separat från mark |
| `selection-appearance`: exakt följd av klassuppdateringar i modellträdet | Låser antal/ordning av interna anrop | `model-tree` verifierar att rätt rader markeras, gruppmarkering fungerar och befintliga rader/expanderingsläge bevaras |
| `inspector-attributes`: likadana sektionsdefinitioner/custom-widget | Låser schemats interna layout | Inspektorns transaktioner och egenskapskopiering verifierar riktiga fältändringar, mål, geometri och undantag för genererade delar |

Två blockgeneratorer som enbart användes av tester (`frame-title-example` och `frame-revision-example`) flyttades från `src/` till `tests/fixtures/frame-blocks.js`. Revisions-, layout- och DXF-beteendetester behölls. Inga andra direkt testimporterade `src`-moduler var frikopplade från appens analyserade importgraf.

## Förbättrade assertioner

- Objekttypsregistret behöver stödja äldre och explicit sweep samt skydda typkontraktet. Ett exakt ordnat register över alla typer behövs inte: en ny registrerad typ ska inte automatiskt göra testet rött.
- Markeringsutseende kontrollerar nu att markering skiljer sig från objektets färg och att avmarkering återställer färgen. Hårdkodade gröna/grå färgnummer togs bort; geometri, transparens och materialbevarande verifieras fortfarande.
- Komponentschemat kontrollerar att alla parametrar förekommer en gång. Kravet på ett exakt internt DOM-id togs bort.
- Ett nytt integrationstest använder den utbrutna placeringscontrollern, riktiga förhandsvisningar, modell-editorn och historiken. Det skyddar att exakt avstånd bara förhandsvisar, ogiltig inmatning inte ändrar modellen, snapmål finns kvar under flytt och flytt/kopiering ger en ångrapost per commit.

## Varför specialisttester behölls

| Område | Felrisk som motiverar testerna |
| --- | --- |
| Geometri och profilkataloger | Volym, slutna kroppar, radier, enheter, excentricitet och olika profilers särskilda regler |
| Kopplingar och skruvar | Ägande, regenerering, gängor, håldjup, kantavstånd, kopiering och radering av beroenden |
| Numrering och assemblies | Serie/prefix, återanvändning, tolerans, huvuddel, medlemsplacering, delmark och ritningskonflikter |
| Projekt/historik/återställning | Datadelning, ogiltiga filer, skadad storage, samtidiga skrivningar och förlust av användararbete |
| Snap/markering/navigation | Pixelavstånd, lås, arbetsplan, höjd, olika pekare och borttappad pointer capture |
| Ritningar och rapporter | Projektion, skalor, referenser, klippning, revisioner, pagination och export |
| Bibliotek/import/referenser/PWA | Snapshotversioner, filenheter, placering, offlinecache, installation och uppdatering efter sparning |

Liknande kontroller på olika nivåer behölls när de skyddar olika kopplingar: till exempel ren zoomberäkning och faktisk OrbitControls-zoom, eller numreringsnyckel och ritningsskapande. Tester som läser källfiler för att köra service worker i VM testar faktiskt beteende; de är inte textmatchning mot implementationen. Testfall utan assertion i sin egen callback kan använda hjälpfunktioner med geometrikontroller och har inte tagits bort automatiskt.

## Verifiering

Fem överlappande/interna testfall togs bort och ett placeringsflöde tillkom: 856 → 852 tester. Den mindre kärnsviten omfattar 115 tester. Full regression och kärnsvit körs separat; full regression ska fortsätta köras före publicering. Tidigare borttagna tester för den övergivna stomlinjeeditorn ingår inte i dessa fem.

## Uppföljning av main-uppdelningen 2026-10-10

Två integrationstester tillkom för sessionens nya modulgräns: redigering/radering med validering och ångra/gör om, samt meshåteranvändning/frigöring och uppdaterat snapindex. De kör verklig modell-editor, historik, meshgeometri och snapindex med en ersatt UI-gräns. Sviten omfattar nu 854 tester, varav 117 i kärnurvalet. Detta är tillkommande beteendeskydd för refaktoreringen, inte en ny fullständig granskning av alla assertioner.
