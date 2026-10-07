# Attributbibliotek

Öppna **Inställningar → Bibliotek → Attribut**. Här visas alla inbyggda och egna
ritningsattribut med namn, stabil nyckel, datatyp, tillämpliga ritningstyper,
källa, redigerbarhet och eventuella vallistor. Sök på namn, nyckel, typ eller val.

Välj ett attribut för att redigera dess definition. **Nytt attribut** skapar ett
eget attribut med en stabil `custom.`-nyckel. Egna attribut kan ges datatyperna
Text, Datum, Tal, **Val (ett)** och **Flerval** samt begränsas till GA, Single Part
eller Assembly. Inbyggda identiteter, källor och tillämpningsområden är fasta.
Redigerbara textfält såsom status, handling, kontaktperson och ansvarig part kan
växlas mellan text, val och flerval. Nummer, namn och revisionsfält behåller
sina befintliga typer och regler.

Skriv vallistor med ett alternativ per rad. Status och handling har en första
uppsättning alternativ som kan ändras. **Val (ett)** visas som en vallista i
ritningshanteraren. **Flerval** visas som en lista där flera alternativ kan
markeras med Ctrl/Cmd. Lägg till attributets kolumn under **Kolumner** i
ritningshanteraren för att ange värdet.

Tidigare ritningsvärden behålls även om en vallista ändras. Flerval sparas som
arrayer i projektfilen och visas som kommaseparerad text i rithuvuden och PDF.
Biblioteksdefinitionerna sparas lokalt i webbläsaren. Ram-editorn använder samma
register och länkar till biblioteket för hantering av definitioner.

Standardlistorna för status, handling och ritningskategori följer den bifogade
Tekla-konfigurationen (5, 8 respektive 9 val). Status och handling behåller
koderna efter `|` i det sparade valet. På ritningen och i PDF visas texten före
strecket. De automatiska kolumnerna **Status · förkortning** och
**Handling · förkortning** visar koderna i ritningsförteckningen. De kan aktiveras
under **Kolumner** i ritningshanteraren. Ett val uppdaterar både text och kod.
Egna val kan använda samma format `Beskrivning | KOD`. Val utan streck visas
i sin helhet och får ingen kod. Kategorier med kommatecken är ett sammanhängande alternativ.
Ritningskategori är ett separat redigerbart attribut (`drawing.category`),
kopplat till kategorifältet i de medföljande rithuvudena. Ritningstypen GA/SP/AS
behåller sin betydelse. Tidigare installationer får listorna och kopplingen
uppdaterade en gång; senare egna ändringar i biblioteket bevaras.
