# Profilförslag från referenser

## Ansvar och kontrakt

- `references/ifc-profile-data.js` läser IFC via ett uttryckligt API-/modellhandtag. Den följer typkopplingar, utvalda egenskaper, `SweptArea`, mappade representationer och första operanden i kapningar. Den normaliserar längder till mm och levererar endast serialiserbara uppgifter. Ingen biblioteksprofil väljs där.
- `references/profile-match.js` tar uppgifterna och bibliotekets profiler och gör hela bedömningen utan IFC-API, DOM, storage eller projektmutation. `profile-match-names.js` äger namnnormalisering/uttryckliga alias; `profile-match-geometry.js` äger konturjämförelse och rotation.
- `references/conversion.js` kopplar matchningsresultatet till det fristående konverteringsutkastet. Geometrivalideringen får fortfarande avvisa objekt som inte kan konverteras korrekt. UI visar resultatet och rapporterar manuellt profilval; först Konvertera ger en modell-editortransaktion.

Indata till `matchLibraryProfile(evidence, profiles)`:

```js
{
  names: ['SB04- HEA 180', 'HEA 180'],
  material: 'Default Steel', // stöd för avgränsning, aldrig materialtilldelning
  profiles: [{ kind: 'i', name: 'SB04- HEA 180',
    dimensions: { B: 180, H: 171, tw: 6, tf: 9.5, R: 15 } }],
  hints: { B: 180, H: 171 }, // egenskapsvärden är svagare än profildefinitionen
  warnings: [],
  geometry: { loops, properties } // valfri återvunnen kontur, i mm
}
```

Resultatet har `status` (`verified`, `probable`, `ambiguous`, `none`), `suggestion`, högst fem rangordnade `alternatives`, `reasons`, `warnings` och relevanta `conflicts`. Förslag innehåller sektionsögonblicksbild, rotation när konturen har verifierats, måttavvikelser och kontur-/areaavvikelse. Poängen är intern rangordning, inte en sannolikhet. Vid tvetydighet är `suggestion` null. Geometrisk profilidentitet intygar inte hållfasthetsklass eller material.

## Regler som ska bevaras

Senaste biblioteksrevisionen jämförs. Projektprefix, blanksteg, ×/x och decimalkomma normaliseras. VKRK/VKRR och KKRK/KKRR har uttryckliga namnregler; VKR och KKR slås inte ihop. Rör med lika geometri men okänd tillverkningsserie kan därför ge flera alternativ. Rektangulära tvärsnitt kan ha omkastade bredd-/höjdaxlar. Saknade dimensioner ersätts inte med närmaste storlek.

Ursprungliga profilmått och typ måste stämma för ett parameterbaserat verifierat förslag. Namn ensamma ger högst ett troligt förslag. Utan metadata gäller fortsatt strikt konturjämförelse. Vid namnstödd jämförelse tillåts en separat begränsad tesselleringstolerans. Vissa web-ifc-tolkningar av IFC2x3 återger ett rotfillet med en enda kord: endast en verifierad ursprunglig radie tillåter dess geometriska felomslutning. Yttermåtten kontrolleras fortfarande separat. Fel radie, godstjocklek eller solidform ska inte döljas av en generell stor tolerans.

Verifierade förslag med verifierad konturrotation kan fylla utkastets profil. Troliga och tvetydiga förslag kräver manuellt val; den återvunna IFC-konturen behålls under tiden. Skalning i en mappad representation och okänd enhet nedgraderar säkerheten. Motstridiga egenskapsmått rapporteras i stället för att skriva över den ursprungliga profildefinitionen.

## Fler exempel och finjustering

Kör `node scripts/analyze-ifc-profiles.mjs fil.ifc rapport.json` för en läsande rapport över balkar, pelare och stänger med det inbyggda biblioteket. Rapporten är uttryckligen **en metadataanalys**, inte ett mått på hur många objekt som går att konvertera. Den innehåller underlag, beslut, alternativ, avvikelser och konflikter. Ingen mesh eller triangulering behövs för rapporten.

För ett nytt fall: kontrollera den verkliga profilen och vilken information IFC-filen faktiskt ger. Lägg ett litet anonymiserat exempel med förväntat beslut i `tests/fixtures/revit-profile-evidence.json`, eller en ny motsvarande fixturfil. När läsning eller tessellering är själva felrisken behövs även ett litet IFC-utdrag. Ändra rätt lager: nya IFC-fält i adaptern, nya alias i namnreglerna, bedömning/toleranser i matchningsmodulen. Behåll ett negativt exempel som skyddar mot den närmast liggande felmatchningen.

`tests/fixtures/revit-profile-sample.ifc` innehåller nio anonymiserade exempel från användarens Revit-fil, inklusive ursprungliga profildefinitioner, mappning och kapning. Personer/organisationer, filhuvud, globala objektidentiteter och byggnadsplaceringar har ersatts; hela byggnadsmodellen ingår inte. Tester använder alltid dessa lokala fixturer, aldrig användarens ursprungliga filsökväg.

IFC-parametrarnas betydelse följer exempelvis buildingSMARTs [IfcIShapeProfileDef](https://standards.buildingsmart.org/IFC/RELEASE/IFC2x3/TC1/HTML/ifcprofileresource/lexical/ifcishapeprofiledef.htm).
