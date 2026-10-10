# Lokal autosparning och återställning

Appen sparar projektets färdiga objekt, item-geometrier, stomlinjer, nivåer, projektinformation, numrering, ritningar, rapporter och referensdata i IndexedDB. Ändringar samlas under cirka 500 ms och skrivs i ordning. Statusraden visar när projektet är sparat och visar ett fel om lagringen misslyckas. Arkiv → Spara projekt ger fortfarande en fristående projektfil.

Vid omladdning återställs flikens projekt. När appen öppnas igen utan en tidigare fliksession återställs den senast aktiva lokala kopian. Varje flik har en egen kopia; en duplicerad flik får en egen kopia av källflikens projekt när Web Locks stöds. Föregående lyckade sparning behålls som reserv och används om den senaste kopian inte går att läsa. En oläsbar kopia skrivs inte över av en tom modell. Ett medvetet Nytt projekt eller Öppna projekt tillåter sparning av det valda projektet igen.

Uppdatera appen avslutar inspector-redigeringen och väntar tills autosparningen är klar innan den aktiverar uppdateringen. Ett lagringsfel stoppar uppdateringen. Vid vanlig omladdning eller stängning varnar webbläsaren om en sparning ännu väntar; appen försöker också slutföra sparning när sidan lämnas eller göms. Ett plötsligt avbrott kan förlora ändringar från det korta intervallet före senaste lyckade sparning.

Kopiorna tillhör samma webbläsarprofil och webbplatsadress. De är inte molnlagring; radering av webbplatsdata raderar även lokala kopior. Kameraläge, markeringar, pågående ritverktyg, osparade editorutkast och ångrahistorik ingår inte. Innan första uppdateringen från en version som saknar autosparning behöver användaren spara projektfilen manuellt.
