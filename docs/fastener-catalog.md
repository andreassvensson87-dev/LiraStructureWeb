# Skruvbibliotekets grundsortiment

`src/fasteners/default-catalog.js` bygger fristående biblioteksversioner för ISO 4014, ISO 4017 och DIN 976-1, M8/M10/M12/M16/M20/M24/M30/M36, klass 8.8, obehandlat. `standard-dimensions.js` äger nominella grovgängade mått för huvud, ISO 4032-mutter (klass 8) och ISO 7089-bricka. Detta är modelleringsdata, inte produktcertifiering eller hållfasthetsberäkning. SB/HV/HR ingår inte.

Bibliotekets controller lägger till saknade standardidentiteter vid läsning. Befintliga egna poster och användarens revisioner behålls. Grundsortimentet kräver ingen import eller lokal lagring för att synas. Redigering, import/export, träd, val av standard/dimension och placerade definitionsögonblicksbilder använder befintligt biblioteksflöde.

En post per diameter har en startlängd; manuell instanslängd ändrar inte biblioteket. Helgängad ISO 4017 och gängstång följer instanslängden. ISO 4014:s gänglängd b är 2d+6 för L ≤125, 2d+12 för L ≤200 och 2d+25 över 200 mm. För kort längd visas med befintlig passningsvarning; begärd längd skrivs inte om. Muttrar och brickor följer befintliga förbandsval, utstick och placeringsregler.

Träskruv Ø4/5/6/8/10 och betongskruv Ø8/10/12 är uttryckligen märkta **modellmallar**. Mått för huvud och betongförankring är exempelvärden; de påstår ingen produktstandard, hållfasthetsklass, ETA eller tillverkare. Träskruvsmallarna har ingen automatisk förborrning. Betongmallarnas förankrings-/borrdata redigeras i befintligt bibliotek efter vald produkt. Manuell längd ändrar inte dessa produktberoende uppgifter. Brickor/muttrar erbjuds bara när posten har motsvarande mått; försänkt träskruv har inga planbrickor.

## Måttunderlag

Kontrollerat 2026-10-16. ISO-mått används uttryckligen; exempelvis M10 har nyckelvidd 16 och M12 18, inte de äldre DIN-måtten 17/19. ISO 4032-muttertjocklekar skiljer också från DIN 934.

- [Fabory, ISO 4014 CAD-mått och gänglängdsband](https://fabory.partcommunity.com/3d-cad-models/?info=fabory%2F1_bolts_and_hex_cap_screws%2Fiso_4014.prj&languageIso=de)
- [Fabory, katalog med ISO 4017/4032-mått](https://s3-eu-west-1.amazonaws.com/fab-prod-media-bin/documents/small-Book-fr-FR.pdf)
- [Böllhoff, ISO 4032 måttblad](https://eshop.boellhoff.de/out/media/pdf/ISO_4032_Stahl_8___en.pdf)
- [Bossard, brickor ISO 7089](https://www.bossard.com/eshop/dk-da/skiver/skiver-flad-uden-facet/skiver-uden-facet-til-skruer-op-til-kvalitetsklasse-88/p/20734/)
- [Fabory, DIN 976-1 gängstång](https://www.fabory.com/en_GB/Fasteners/Threaded-Rods-and-Studbolts/Threaded-rods/c/010904)
