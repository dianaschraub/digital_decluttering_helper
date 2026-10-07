# Digital Cleaning – Netlify & Google Sheet

Eine private, mobile Web-App, mit der du Bilder, Screenshots, Downloads und zwei E-Mail-Postfächer in kleinen 20-Minuten-Einheiten aufräumst. Der Bearbeitungsstand jedes Bereichs wird zentral in einem Google Sheet gespeichert und ist auf Handy und Tablet identisch.

## Funktionen

- acht getrennte Bereiche für Handy, Tablet, Essener Postfach und WEB.DE
- 20-Minuten-Timer mit Fortschrittsring, der auch beim Wechsel in die Foto- oder Mail-App und nach einem Neuladen weiterläuft
- Bearbeitung von den ältesten Dateien nach vorn, mit sichtbarem Rückstand je Bereich
- Vorschlag des Bereichs, der gemessen an seinem Rhythmus am stärksten überfällig ist
- Entscheidungen **Löschen** oder **Einsortieren** mit passender Zielauswahl für Dateien bzw. E-Mails, inklusive **Rückgängig**
- bei E-Mails zusätzlich **Unter 2 Minuten erledigt** und **Nächste Handlung**
- eigener Monats- oder Tagesstand je Bereich
- Aufgaben und Wiedervorlagen mit Erledigt-Schaltfläche
- private Bild- und Dateianhänge bis 4 MB
- Verlauf, Wochencheck, Merkmemos und CSV-Sicherung
- vorbereitete Übergabe an Google Kalender
- privater Zugang über Netlify Identity
- heller und dunkler Modus (folgt der Systemeinstellung)
- installierbar auf dem Startbildschirm (Android und iOS)

## Wo die Daten liegen

| Bestandteil | Speicherort |
|---|---|
| Bearbeitungsstände | Google Sheet, Tab `progress` |
| Cleaning-Einheiten | Google Sheet, Tab `sessions` |
| Aufgaben und Wiedervorlagen | Google Sheet, Tab `tasks` |
| Wochenchecks | Google Sheet, Tab `weekly_checks` |
| Datei- und Bildanhänge | privater Netlify-Blob-Speicher |
| Programmcode | GitHub |
| Website | Netlify |

Die vier Tabellenblätter und ihre Spaltenüberschriften werden beim ersten erfolgreichen Zugriff automatisch angelegt. Für Anhänge wird Netlify Blobs verwendet, weil Dienstkonten in einem persönlichen Google Drive nicht in jedem Kontotyp zuverlässig eigene Dateien speichern können. Die Links zwischen Aufgabe und Anhang stehen weiterhin im Google Sheet.

## 1. GitHub-Repository anlegen

Der Code liegt im Repository `dianaschraub/digital_decluttering_helper`. Für ein neues, leeres Repository geht das Hochladen so:

```bash
git init
git add .
git commit -m "Digital Cleaning mit Netlify und Google Sheet"
git branch -M main
git remote add origin https://github.com/dianaschraub/digital_decluttering_helper.git
git push -u origin main
```

## 2. Google Sheet vorbereiten

1. In Google Sheets eine **leere Tabelle** anlegen, beispielsweise `Digital Cleaning Daten`.
2. Aus der Tabellenadresse die ID kopieren. Bei
   `https://docs.google.com/spreadsheets/d/ABC123/edit` ist `ABC123` die Sheet-ID.
3. Noch keine Tabellenblätter oder Spalten anlegen; das erledigt die App automatisch.

## 3. Google-Dienstkonto erstellen

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt auswählen oder anlegen.
2. Unter **APIs & Dienste → Bibliothek** die **Google Sheets API** aktivieren.
3. Unter **IAM & Verwaltung → Dienstkonten** ein Dienstkonto anlegen.
4. Für dieses Dienstkonto einen JSON-Schlüssel erstellen und herunterladen.
5. Aus der JSON-Datei werden später nur diese beiden Werte benötigt:
   - `client_email`
   - `private_key`
6. Das zuvor angelegte Google Sheet über **Teilen** für die `client_email` des Dienstkontos als **Bearbeiter** freigeben.

Die JSON-Datei und der private Schlüssel dürfen niemals in GitHub hochgeladen werden.

## 4. Mit Netlify verbinden

1. Bei Netlify **Add new project → Import an existing project** auswählen.
2. Das GitHub-Repository verbinden.
3. Netlify liest `netlify.toml` automatisch. Die Werte sind bereits eingetragen:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. Unter **Project configuration → Environment variables** diese Werte anlegen:

| Variable | Wert |
|---|---|
| `GOOGLE_SHEET_ID` | ID der Google-Tabelle |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` aus der JSON-Datei |
| `GOOGLE_PRIVATE_KEY` | vollständiger `private_key` einschließlich BEGIN/END-Zeilen |
| `ALLOWED_EMAIL` | deine E-Mail-Adresse für Netlify Identity (**Pflicht**) |

Beim Private Key dürfen echte Zeilenumbrüche oder die Zeichenfolge `\n` verwendet werden. Keine dieser Variablen in `netlify.toml` oder GitHub eintragen.

## 5. Privaten Zugang einrichten

1. Im Netlify-Projekt **Identity → Enable Identity** öffnen.
2. Unter den Registrierungseinstellungen **Invite only** wählen.
3. Unter **Identity → Users → Invite users** deine eigene E-Mail-Adresse einladen.
4. Die Einladungs-E-Mail öffnen und in der App ein persönliches Passwort festlegen.

Die Netlify-Funktion akzeptiert zusätzlich nur die Adresse aus `ALLOWED_EMAIL`. Selbst wenn versehentlich ein zweites Identity-Konto angelegt würde, könnte dieses nicht auf die Tabelle oder Anhänge zugreifen. Ist `ALLOWED_EMAIL` nicht gesetzt, verweigert die Funktion jeden Zugriff.

Die Daten im Sheet hängen nicht an der internen Netlify-Benutzer-ID. Wird dein Identity-Konto gelöscht und neu eingeladen, bleiben alle bisherigen Stände, Aufgaben und Anhänge sichtbar.

## 6. Erster Start

Nach dem ersten Login lädt die App die Daten. Dabei entstehen im leeren Google Sheet automatisch:

```text
progress
sessions
tasks
weekly_checks
```

Falls die App meldet, dass der Google-Sheet-Speicher noch nicht eingerichtet ist, prüfe:

- Ist die Google Sheets API aktiviert?
- Ist das Sheet für die Dienstkonto-E-Mail als Bearbeiter freigegeben?
- Stimmt `GOOGLE_SHEET_ID`?
- Wurde der vollständige Private Key bei Netlify eingetragen?
- Wurde nach Änderungen an den Variablen ein neuer Deploy gestartet?

## Lokal testen

Node.js 20 oder neuer wird benötigt. Netlify Dev stellt Identity, Functions und Blobs lokal bereit:

```bash
npm install
cp .env.example .env
npm run dev
```

Die Werte in `.env` werden nicht nach GitHub hochgeladen. Identity funktioniert vollständig erst, nachdem das Projekt einmal mit Netlify verbunden und Identity dort aktiviert wurde.

## Datenschutz und Sicherheit

- Google-Zugangsdaten werden nur serverseitig in Netlify Functions verwendet.
- Der Browser erhält weder den Private Key noch direkten Schreibzugriff auf das Google Sheet.
- Jede Funktionsanfrage wird über Netlify Identity geprüft.
- `ALLOWED_EMAIL` ist Pflicht und beschränkt den Zugriff auf genau ein Konto.
- Schriften werden mit der App ausgeliefert; es gibt keine Verbindung zu Google Fonts.
- Anhänge liegen in einem privaten Store und werden nur nach erfolgreicher Anmeldung ausgegeben.
- Dateien werden beim Herunterladen mit `Content-Disposition: attachment` und `nosniff` ausgeliefert.
- Die App akzeptiert Anhänge bis 4 MB. Das liegt unter Netlifys effektiver Grenze für binäre Function-Uploads.

Bei beruflichen Dokumenten mit Schüler- oder Personendaten muss unabhängig von der technischen Absicherung geprüft werden, ob die Musikschule diese externe Speicherung erlaubt.

## Wichtige Funktionsgrenze

Eine Website darf aus Sicherheitsgründen nicht selbstständig deine Handyfotos, Downloads oder E-Mail-Postfächer durchsuchen und löschen. Digital Cleaning begleitet deshalb den Ablauf und speichert deinen Stand; die eigentliche Entscheidung führst du in der jeweiligen Foto-, Datei- oder E-Mail-App aus.

Die Kalender-Schaltfläche öffnet nur einen vorbereiteten Google-Kalender-Termin. Die App erhält keinen dauerhaften Kalenderzugriff.

## Projektstruktur

```text
src/
  App.tsx                 Anmeldeprüfung
  components/             Ansichten (Heute, Bereiche, Aufgaben, Verlauf), Login, Bausteine
  hooks/useCleaningSession.ts  Timer und Zähler, im Browser zwischengespeichert
  data.ts                 Bereiche, Rhythmen, Ablageziele, Merkmemos und Vorschlag
  types.ts                gemeinsame Datentypen
  lib/dates.ts            Datumsfunktionen in lokaler Zeit
  lib/api.ts              Aufrufe der geschützten Netlify-Funktion
  lib/auth.ts             Netlify-Identity-Anmeldung
  lib/calendar.ts         Google-Kalender-Übergabe
  lib/export.ts           CSV-Sicherung
netlify/functions/
  app-data.ts             geschützte API und Anhangspeicher
  _shared/sheets.ts       Google-Sheet-Zugriff und Tabellenaufbau
netlify.toml              Build, Functions und Sicherheitsheader
```

## Anpassen

- **Bereiche, Rhythmus und Farben:** `src/data.ts`, Liste `AREAS`. `intervalDays` steuert, wann ein Bereich als überfällig gilt.
- **Ablageziele:** `src/data.ts`, Liste `DESTINATIONS`. Über `kinds` legst du fest, ob ein Ziel bei Dateien (`files`), E-Mails (`email`) oder beiden erscheint.
- **App-Symbol:** `public/icon.svg`; die PNG-Varianten (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) bei Änderungen neu exportieren.

## Build prüfen

```bash
npm run build
npm audit --omit=dev
```
