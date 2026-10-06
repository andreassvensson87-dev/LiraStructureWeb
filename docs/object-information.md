# Materialförslag och objektinformation

Markera ett eller flera objekt och välj **Information** i modellens
högerklicksmeny. En separat läsdialog visar identitet, profil, material,
geometri och mängder. Informationen räknas vid öppning och lagras inte som
ytterligare projektdata. Ingen mängdlista eller nya informationsfält i inspectorn införs.

Profilens uttryckliga hållfasthetsklass ger materialförslag från materialbiblioteket.
Vid ny profil väljs ett entydigt förslag automatiskt, tills användaren själv väljer
material (även Inget material). Flera möjliga stålsorter visas som valbara förslag.
Dimensioner utan angiven träklass får ingen antagen hållfasthetsklass. Befintligt
material på ett modellobjekt behålls vid profilbyte; ett objekt utan material får
ett entydigt förslag. Materialförslag kan också tillämpas på flera markerade objekt.

Beräkningar använder mm internt och redovisar volym i m³ samt vikt i kg:

- Sweep: fysisk tvärsnittsarea × axellängd.
- Plate: konturarea inklusive konturoffset × tjocklek.
- Cirkel och cirkulärt rör: analytisk cirkel-/ringarea.
- Bearbetade objekt: nettovolym från den fysiska geometrin inklusive skärningar
  och kopplade borrhål. Modellens triangulering begränsar noggrannheten.
- Vikt: nettovolym × valt materials densitet. Profilens nominella densitet
  används endast när material saknas och anges uttryckligen i dialogen.
- Massa per meter gäller oskuren sweep med valt material, oberoende av katalogmassan.

Visningsläget exakt/schematiskt och kameran påverkar inte beräkningen. Rundningar
följer den gemensamma fysiska profilkonturen. Profilbibliotekets beräknade massa
och Tibnors katalogmassa förblir profiluppgifter; materialvalet ändrar inte dem.
Objekt som saknar både material och profildensitet får ingen beräknad vikt. Skär- och
hjälpobjekt har identitet/koordinater i dialogen, men räknas inte som fysiska delar.
Skruvar redovisar ungefärlig volym från modellgeometrin, utan gängmodellering;
faktisk produktvikt kan därför avvika.
