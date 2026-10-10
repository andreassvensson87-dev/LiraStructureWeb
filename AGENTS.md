# LiraStructureWeb

Läs `docs/architecture.md` och `docs/testing.md` innan arkitektur- eller editorändringar.

## Ansvar

- Domänregler, geometri och objekttyper ska fungera utan DOM, browser storage och UI-controllerer.
- UI visar tillstånd och rapporterar avsikter. Modelländringar går genom `src/app/model-editor.js`, som validerar innan projekt och historik ändras. Lägg inte egna `project.objects`-mutationer i UI eller `main.js`.
- Import, återställning och migrering är projektoperationer och ska behålla sina uttryckliga transaktioner.
- Alla 3D-modellobjekt använder befintlig markering, `resolveSnap`, transformverktyg, handtag och inspektorns transaktioner. Skapa inte en separat editor eller snapmotor för en ny objekttyp.
- Objekttypens regler hör till objektdefinitionen. Registrera nya typer i objekttypsregistret.
- Ändra inte placeringen av kontroller och lägg inte till nya synliga kontroller utanför användarens begärda förändring. Utgå från befintligt UI och samma inställningskälla.
- `main.js` är en ren startfil: stilar, projektåterställning och start av appen. `src/app/model-application.js` skapar beroenden och kopplar controllerer. Lägg inga händelsehanterare eller modellregler där. Flytta beteende med tydligt ägarskap, inte enbart för att minska radantalet.
- Varje controller tar uttryckliga beroenden och callbacks. Appens `actions` och `controllers` är lokala kopplingar för den aktuella appinstansen, inte globala tjänster. En action har en ägare. Domänkoden får inte använda dessa kopplingar.

- Menyer och biblioteksfönster ska använda `src/ui/` enligt `docs/ui.md`. Arbetsyteadaptrar beskriver grupper och placering; behåll befintliga kommandoägare, kontrollernas identitet och aktiv/disabled-status. Skapa inte en separat UI-fabrik för varje editor.

## Verifiering

- För små, reversibla presentationsändringar räcker relevant webbläsarkontroll och lint. Skriv inte test som bara kontrollerar en CSS-klass eller kopierar implementationen.
- Använd `npm test` för modellens centrala arbetsflöden. Kör berörda specialisttester vid domänändringar.
- `npm run check` kör lint, formatering, full regression och produktionsbygge inför publicering.
- Ett nytt test ska skydda ett konkret beteende eller en verklig felrisk. Återanvänd befintliga scenarier när de täcker samma krav.
- Berörda användarflöden ska också verifieras i webbläsaren. Ett stort antal gröna tester är inte bevis för korrekt UX.
