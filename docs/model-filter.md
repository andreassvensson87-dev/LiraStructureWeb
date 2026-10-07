# Modellfilter

Filter-fliken i modellinspektorn styr enbart modellobjektens synlighet. Ritningar, rapporter, objektens färger och projektdata ändras inte.

Sökningen kräver att alla sökord finns i namn, beteckning, objekttyp, material eller profil. Flerval använder eller inom en filtergrupp och och mellan grupper. Antalen vid filterval tar hänsyn till övriga grupper, vilket gör alternativa val möjliga även när ett filter redan är aktivt. Val som saknas i modellen ligger kvar med noll träffar.

Grupperna är objekttyp, material, profil, nivå och prefix (under Fler egenskaper). Objekttyp följer appens befintliga typer. Nivå beräknas från närmaste nivå till den lägsta insättningspunkten; det är inte en sparad nivåtillhörighet. Vyfiltret kontrollerar objektets utbredning mot kamerans synfält och uppdateras vid zoom och navigering. Det testar inte om objektet skyms av andra objekt.

Dolda objekt och inställningen för hjälpobjekt respekteras också. Markera träffar markerar de synliga träffarna. Visa alla återställer både filter och manuellt dold synlighet. Att visa eller välja ett filtrerat objekt från modellträdet återställer filtret så att objektet kan visas.

Sparade filter finns lokalt i `lirastructure.model-filters.v1`, kan återanvändas i andra projekt och sparar sökord, flerval och vyalternativ. Att spara ett valt filter uppdaterar det, medan ändrade filterval blir ett eget filter. Aktiva filter återställs när ett annat projekt öppnas; biblioteket behålls.
