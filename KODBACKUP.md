# LiraStructure – säkerhetskopia av utvecklingsprojektet

Hämta [source-backup.zip](source-backup.zip) med GitHubs **Download raw file**.
Paketet innehåller 195 filer: källkod, tester, byggskript, ikoner,
paketlås och dokumentation. Snapshot: 2026-09-29.

## Återställ på en ny dator

1. Installera Node.js 22 eller senare, inklusive npm.
2. Packa upp ZIP-filen och öppna terminalen i mappen `LiraStructureWeb`.
3. Kör `npm ci`.
4. Kör `npm run check` för formatering, lint, tester och produktionsbygge.
5. Kör `npm run dev` och öppna adressen som skrivs ut.

`npm run build` återskapar appfilerna i `dist/`. Publicerad webbapp:
https://andreassvensson87-dev.github.io/LiraStructureWeb/

Modeller, ritningar och bibliotek i webbläsarens lagring ingår inte i kodbackupen.
`node_modules` och `dist` återskapas med kommandona ovan.

Backupen är en ögonblicksbild. Uppdatera ZIP-filen vid framtida kodändringar;
GitHubs commit-historik behåller tidigare versioner. Ingen automatisk
säkerhetskopiering av lokala ändringar är aktiverad.

SHA-256 för `source-backup.zip`:
`0fe7e385a3a0b67ebcef31f4d40d2efbd653b0a47cea25dcdff83ed493c956e4`
