# Digital Cleaning

Eine mobile Web-App, mit der man Fotos, Screenshots, Downloads, Ordner und E-Mail-Postfächer in kleinen 20-Minuten-Einheiten aufräumt – und dauerhaft in Ordnung hält. Jede Person legt sich ein eigenes Konto an und richtet ihre eigenen Geräte, Postfächer und Ablageorte ein.

## Funktionen

- **Eigenes Konto** für jede Person, Daten strikt getrennt
- **Einrichtung beim ersten Start:** Geräte (Handy, Tablet, Computer oder eigene), was dort aufgeräumt wird, E-Mail-Postfächer und Ablageorte (Google Drive, OneDrive, iCloud, externe Festplatte, eigene …)
- **Einstellungen:** Bereiche hinzufügen, umbenennen, pausieren, entfernen und ihren Rhythmus festlegen; Ablageorte für Dateien und/oder E-Mails pflegen
- 20-Minuten-Timer mit Fortschrittsring, der auch beim Wechsel in die Foto- oder Mail-App und nach einem Neuladen weiterläuft
- Spickkarte mit der Entscheidungsregel und den eigenen Ablageorten – gearbeitet wird direkt in der Foto-, Datei- oder Mail-App, ohne Mitklicken
- nach jeder Einheit zeigt die App den geschafften Zeitraum, z. B. „3 Monate aufgeräumt“; grobe Zahlen sind freiwillig
- **Nächste Handlungen** als Aufgaben mit Wiedervorlage und Anhang (bis 4 MB)
- **Teilen-Knopf** bei Aufgaben – etwa in Google Notizen (Keep); am Computer wird der Text kopiert
- **Kalender-Abo:** persönlicher Link für Google Kalender, Apple Kalender oder Outlook mit geplanten Aufräum-Terminen (Wochentage, Uhrzeit, wöchentlich / alle 2 Wochen / monatlich) und Aufgaben mit Wiedervorlage; erledigte Aufgaben verschwinden beim nächsten Abgleich
- **Fester Serientermin** als einfache Alternative (Google-Kalender-Link oder `.ics`-Datei)
- Verlauf, Wochencheck, CSV-Sicherung
- Konto samt aller Daten jederzeit selbst löschbar
- heller und dunkler Modus, installierbar auf dem Startbildschirm

## Wo die Daten liegen

| Bestandteil | Speicherort |
|---|---|
| Einstellungen, Stände, Einheiten, Aufgaben, Wochenchecks | Netlify Blobs, Store `user-data`, ein Dokument pro Person (`users/<Identity-ID>`) |
| Anhänge | Netlify Blobs, Store `task-attachments` (`<Identity-ID>/<Aufgaben-ID>`) |
| Kalender-Abo-Links | Netlify Blobs, Store `user-data` (`calendar/<geheimer Schlüssel>`) |
| Konten | Netlify Identity |

Eine Google-Cloud-Einrichtung ist nicht mehr nötig.

## Einrichtung bei Netlify

1. Bei Netlify **Add new project → Import an existing project** wählen und dieses Repository verbinden. Build-Einstellungen stehen in `netlify.toml`.
2. **Identity → Enable Identity** öffnen.
3. Unter **Registration preferences** festlegen, wer Konten anlegen darf:
   - **Open** – jede Person kann sich in der App selbst registrieren (empfohlen, wenn andere die App nutzen sollen)
   - **Invite only** – nur eingeladene Personen (**Identity → Invite users**)
4. Optional unter **Project configuration → Environment variables**:

| Variable | Zweck |
|---|---|
| `ALLOWED_EMAILS` | Kommagetrennte Liste von Adressen, die die App nutzen dürfen. Leer lassen = alle registrierten Konten. |
| `LEGACY_IMPORT_EMAIL` | Nur für den Umstieg von der früheren Google-Sheet-Version, siehe unten. |

Bei offener Registrierung verschickt Netlify eine Bestätigungs-E-Mail; erst danach ist das Konto aktiv.

## Umstieg von der früheren Google-Sheet-Version

Die erste Version speicherte alles in einem Google Sheet. Beim ersten Login übernimmt die App diese Daten **einmalig** in den neuen Speicher – samt der ursprünglichen acht Bereiche und Ablageorte –, wenn:

- `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` und `GOOGLE_PRIVATE_KEY` noch gesetzt sind und
- die angemeldete Adresse `LEGACY_IMPORT_EMAIL` entspricht (ersatzweise der alten Variable `ALLOWED_EMAIL`).

Der Import liest das Sheet nur, er verändert es nicht. Er läuft genau einmal. Danach können die Google-Variablen und `ALLOWED_EMAIL` gelöscht werden. **Wichtig:** `ALLOWED_EMAIL` beschränkt den Zugang nicht mehr – dafür gibt es jetzt `ALLOWED_EMAILS` (mit „S“).

## Lokal testen

Node.js 20 oder neuer wird benötigt. Netlify Dev stellt Identity, Functions und Blobs lokal bereit:

```bash
npm install
npm run dev
```

## Datenschutz und Sicherheit

- Jede Anfrage wird über Netlify Identity geprüft; jede Person sieht und ändert ausschließlich ihr eigenes Datendokument und ihre eigenen Anhänge.
- Gleichzeitige Änderungen (z. B. Handy und Tablet) werden sicher zusammengeführt, statt sich zu überschreiben.
- Der Kalender-Abo-Link enthält einen zufälligen, geheimen Schlüssel. Kalender-Apps können sich nicht anmelden, daher ersetzt dieser Schlüssel das Passwort. In den Einstellungen lässt er sich jederzeit erneuern; der alte Link funktioniert dann nicht mehr.
- „Konto und alle Daten löschen“ entfernt Datendokument, Anhänge, Kalender-Link und das Identity-Konto.
- Anhänge werden mit `Content-Disposition: attachment` und `nosniff` ausgeliefert, höchstens 4 MB.
- Schriften werden mit der App ausgeliefert; es gibt keine Verbindung zu Google Fonts.

- Ein kurzer Datenschutzhinweis in einfachen Worten ist auf der Anmeldeseite und in den Einstellungen verlinkt (`src/components/PrivacyNotice.tsx`). Er ist für einen privaten Kreis gedacht und ersetzt keine vollständige Datenschutzerklärung.
- Suchmaschinen werden gebeten, die App nicht aufzunehmen (`robots.txt`, `noindex`).

**Wenn andere die App nutzen:** Wer in Deutschland eine Website für andere betreibt, braucht in der Regel ein Impressum und eine Datenschutzerklärung (u. a. zu Netlify als Hoster und Auftragsverarbeiter). Das ist keine technische, sondern eine rechtliche Frage und sollte vor dem Teilen des Links geklärt werden.

## Funktionsgrenzen

- Eine Website darf aus Sicherheitsgründen nicht selbstständig Fotos, Dateien oder Postfächer durchsuchen und löschen. Digital Cleaning begleitet den Ablauf und speichert den Stand; gearbeitet wird in der jeweiligen App.
- Google Kalender aktualisiert abonnierte Kalender nur alle paar Stunden. Abonnieren lässt sich ein Kalender per Link nur im Browser (calendar.google.com), nicht in der Handy-App.
- Google Notizen bietet für private Konten keine Schnittstelle; der Teilen-Knopf übergibt die Aufgabe über das Teilen-Menü des Geräts.

## Projektstruktur

```text
src/
  App.tsx                      Anmeldeprüfung
  components/                  Ansichten, Einrichtung (Onboarding), Einstellungen, Login, Bausteine
  hooks/useCleaningSession.ts  Timer, im Browser zwischengespeichert
  data.ts                      Vorlagen für die Einrichtung, Vorschlag, Merkmemos
  types.ts                     gemeinsame Datentypen
  lib/settingsSchema.ts        Regeln für Bereiche, Ablageorte, Erinnerungen (App + Server)
  lib/schedule.ts              Terminplanung für Erinnerungen (App + Server)
  lib/ics.ts                   Kalenderdateien (iCalendar)
  lib/settingsContext.tsx      Zugriff auf die Einstellungen in allen Ansichten
  lib/calendar.ts              Google-Kalender-Links, Serientermin, Abo-Link
  lib/share.ts                 Teilen von Aufgaben
  lib/dates.ts                 Datumsfunktionen in lokaler Zeit
  lib/api.ts                   Aufrufe der geschützten Netlify-Funktion
netlify/functions/
  app-data.ts                  geschützte API
  calendar.ts                  Kalender-Abo (über geheimen Link)
  _shared/store.ts             Speicher pro Person, Kalender-Links, Löschen
  _shared/feed.ts              Inhalt des Kalender-Abos
  _shared/legacySheet.ts       einmaliger Import aus der früheren Google-Sheet-Version
netlify.toml                   Build, Weiterleitungen und Sicherheitsheader
```

## Build prüfen

```bash
npm run build
npm audit --omit=dev
```
