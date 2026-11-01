# Spruch-Bingo 🎮

Online-Multiplayer-Bingo für 2 bis 30 Freunde. Keine Datenbank und keine npm-Abhängigkeiten nötig.

## Lokal starten

1. Node.js 20 oder neuer installieren.
2. Diesen Ordner öffnen.
3. In einem Terminal `npm start` ausführen.
4. `http://localhost:3000` im Browser öffnen.

## Kostenlos oder günstig online bereitstellen

1. Den gesamten Projektordner in ein neues GitHub-Repository hochladen (Dateien `server.js`, `package.json` und Ordner `public`).
2. Auf [render.com](https://render.com/) einen neuen **Web Service** erstellen und das Repository auswählen.
3. Runtime: **Node**, Start Command: `npm start`. Build Command kann leer bleiben oder `npm install` sein.
4. Nach dem Bereitstellen die angezeigte öffentliche HTTPS-Adresse öffnen. Raum erstellen und **Einladungslink kopieren**.

**Achtung:** Auf Render können kostenlose Dienste bei Inaktivität einschlafen. Nach einem Neustart sind Räume und Spielstände weg. Für lange, zuverlässige Abende einen Dienst verwenden, der wach bleibt, und ggf. eine Persistenz ergänzen. Alle Felder liegen momentan nur im Server-Arbeitsspeicher.

## Spielregeln

- Host erstellt Sitzung mit Namen; Freunde treten über Link/Code bei.
- Jeder füllt sein eigenes 3×3-Feld mit neun Sprüchen aus oder würfelt aus einem gemeinsamen Pool beliebig oft neu. Der Host darf den Pool bearbeiten.
- Host startet erst, wenn alle neun Felder bei jedem Spieler gefüllt sind.
- **60 Minuten** laufen serverseitig ab Start. Ein gehörtes Wort/Satz wird auf dem eigenen Feld angeklickt.
- Erste vollständige Reihe, Spalte oder Diagonale gewinnt unmittelbar. Alle Teilnehmer erhalten einen Gong und eine Sprachausgabe (nach Klick auf **Ton aktivieren**).
- Zeit abgelaufen ohne Bingo: Alarm und Spielende; Host kann nächste Runde starten.
- Audio kann durch stummgeschaltete Tabs, Browsersparmodi, mobile Hintergrundbeschränkungen oder Betriebssysteme unterdrückt werden. Browser-Tab offen halten und einmal Ton aktivieren.
- Es gibt keine Loginpflicht; Spieler können sich nach einem Neuladen auf demselben Browser wieder verbinden (lokale Kennung). Sitzungen werden nach 24 Stunden ohne aktive Verbindungen gelöscht.

## Technik

Node.js HTTP-Server, Server-Sent Events (SSE) für sofortige Updates, HTML/CSS/JavaScript; Timer und Bingo-Prüfung auf dem Server. Spieler sehen nur ihr eigenes Feld, nicht die Sprüche der anderen.
