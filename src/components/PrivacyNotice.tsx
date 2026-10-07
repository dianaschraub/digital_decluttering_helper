import { useState } from 'react'
import { Modal } from './ui'

// Datenschutzhinweis in einfachen Worten für einen privaten Kreis aus Familie und Freunden.
// Kein vollständiges Rechtsdokument – bei öffentlichem Angebot durch eine geprüfte
// Datenschutzerklärung ersetzen (siehe README).
export function PrivacyNotice() {
  return (
    <div className="privacy-text">
      <p>Diese App ist ein privates Angebot für Familie und Freunde. Hier steht kurz und ehrlich, was mit deinen Daten passiert.</p>

      <h3>Was gespeichert wird</h3>
      <ul>
        <li>deine E-Mail-Adresse und dein Passwort (nur verschlüsselt) für die Anmeldung</li>
        <li>deine Bereiche, Ablageorte, Stände, Einheiten, Aufgaben, Notizen und Erinnerungs-Einstellungen</li>
        <li>Anhänge, die du selbst zu Aufgaben hochlädst</li>
      </ul>
      <p>Deine Fotos, Dateien und E-Mails selbst sieht die App nicht – sie merkt sich nur, bis wohin du aufgeräumt hast.</p>

      <h3>Wo die Daten liegen</h3>
      <p>Bei Netlify (Netlify, Inc., USA), einem Anbieter für Web-Apps. Die Verbindung ist verschlüsselt.</p>

      <h3>Wer sie sieht</h3>
      <p>In der App siehst nur du deine Daten – andere Nutzerinnen und Nutzer haben keinen Zugriff darauf. Die Person, die diese App betreibt, hat als Verwalterin technisch Zugriff auf den Speicher bei Netlify.</p>

      <h3>Was es nicht gibt</h3>
      <p>Keine Werbung, kein Tracking, keine Analyse-Werkzeuge. Es wird nur das Cookie gesetzt, das für die Anmeldung nötig ist. Die Schriften werden mit der App ausgeliefert, nicht von Google geladen.</p>

      <h3>Kalender-Abo</h3>
      <p>Wer deinen Abo-Link kennt, kann die geplanten Termine und Titel deiner Wiedervorlagen sehen. Teile ihn daher nicht. In den Einstellungen kannst du ihn jederzeit erneuern.</p>

      <h3>Bitte beachten</h3>
      <p>Lade keine sensiblen Daten anderer Menschen hoch – etwa Unterlagen mit Schüler-, Gesundheits- oder Kundendaten.</p>

      <h3>Löschen</h3>
      <p>Unter Einstellungen → Konto kannst du dein Konto mit allen Daten und Anhängen jederzeit selbst und endgültig löschen.</p>

      <p className="small muted">Fragen? Wende dich an die Person, die dir den Link zur App gegeben hat.</p>
    </div>
  )
}

/** Textknopf „Datenschutz“, der den Hinweis in einem Dialog öffnet. */
export function PrivacyLink({ className = 'text-button subtle' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>Datenschutz</button>
      {open && <Modal title="Datenschutz" onClose={() => setOpen(false)}><PrivacyNotice /><button type="button" className="button primary full" onClick={() => setOpen(false)}>Schließen</button></Modal>}
    </>
  )
}
