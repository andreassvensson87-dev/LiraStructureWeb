# Teststrategi

Testantalet är inget kvalitetsmått. Vi kontrollerar beteenden och felrisker, inte hur många gröna rader körningen ger.

- `npm test`: ett mindre urval centrala modellflöden — objekt, verktyg, snap, inspektor, historik, projektåterställning och numrering. Lämpligt för löpande modelleringsarbete.
- `node --test tests/<område>.test.js`: specialisttester för den ändrade funktionen. Rita, importera och exportera har andra felrisker än modellens vanligaste kommandon.
- `npm run test:all`: hela regressionen, inklusive ritningar, referenser, kataloger och export.
- `npm run check`: formatering, lint, full regression och produktionsbygge. GitHub använder detta före publicering.

Arkitekturgränser bevakas av ESLint i stället för tester som söker efter text i källfiler. Modellens UI och app-adaptrar får inte skriva objektlistan direkt; modell-editorn äger validering och checkpoint. Objektdefinitioner, verktygsregler och projektmoduler får inte använda DOM eller browser storage. `main.js` får bara ladda stilar och starta appen. App-kopplingen får inte äga UI-händelser.

De centrala testerna omfattar också sessionens koppling till modell-editor, historik, rendering och snapindex. UI-gränsen ersätts i dessa tester; komplett uppstart, dialoger och input kontrolleras i webbläsaren.

Behåll tester för geometri, numrering, beroende objekt, save/load, ångra/gör om och verkliga regressioner. Ta bort tester för övergiven kod. Slå inte ihop oberoende beteenden enbart för att sänka räknaren. Radera inte specialisttester bara för att de inte behövs vid varje UI-ändring.

Se `docs/test-review.md` för den genomförda granskningens omfattning och beslut.

Små ändringar av text eller layout verifieras i webbläsaren. Nya tester ska fånga ett konkret fel, inte spegla implementationen eller kontrollera att en viss sträng finns i en fil. Test som kör en worker eller en service worker via VM är beteendetest, även när det läser källfilen.
