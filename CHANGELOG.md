# Changelog

Alle nennenswerten Änderungen an HaVeWa. Docker-Images tragen die Version aus `package.json`
plus Build-Nummer (z. B. `0.4.1.160`), dazu `0.4.1`, `0.4` und `latest`.

## 0.4.1 – 2026-11-28

### Update-Hinweise
- Vor dem Update sichern (`deploy/backup.sh`). Neue Migrationen laufen beim Start automatisch.
- Betriebskostenabrechnung: Umlage nach Personen rechnet tagesgenau je Mietverhältnis (#90). Bei
  Ein- oder Auszug mitten im Monat zählt der Zeitanteil nach Tagen statt nach vollen Monaten (#108).
  Abrechnungen mit Mieterwechsel oder Leerstand können deshalb anders ausfallen als vorher.
  Verträge an Monatsgrenzen rechnen unverändert.
- Der Sollstellungslauf stellt angebrochene Monate anteilig nach Tagen (#108).
- Bankimport ordnet Eingänge nur noch automatisch zu, wenn Betrag und Zahler passen (#92).

### Abrechnung
- Einzelabrechnung je Mietverhältnis als PDF mit allen Kostenarten, Schlüsseln, Verteilungsgrundlagen,
  Zeitanteil und Ergebnis; ersetzt die Druckansicht und hängt an der Mail an Mieter (#94, #102)
- Personenzahl mit Änderungen im laufenden Vertrag, Personenzahl 0 möglich (#90, #104)
- Kostenpositionen auf Einheitstypen beschränken, nachträglich bearbeiten (#105, #97)
- Tagesgenauer Zeitanteil bei Mieterwechsel im Monat (#108)
- Betriebskostenpauschale ohne Jahresabrechnung (#110)
- WEG-Vermögensbericht zeigt den Rücklagenstand zum Jahresende (#91)

### Miete und Finanzen
- Mietbestandteile mit „gültig ab/bis“, Vorauszahlung ab Datum ändern (#87, #88)
- Anteilige Miete bei Ein-/Auszug im Monat, Kaltmiete und Nebenkosten auf Wunsch als getrennte Sollstellungen (#108, #109)
- Vorhandene Bankbuchung einer Sollstellung zuordnen, Hinweis wenn der Sollstellungslauf nichts anlegt (#106)
- camt.053-Import überspringt bereits gebuchte Umsätze (#92)
- Steuer: Anlage-V-Übersicht je Objekt und Jahr mit CSV und Druckansicht, AfA am Objekt, Kostenart Schuldzinsen (#103)

### Verwaltung
- Einheitentyp „Zimmer“ (#107)
- Zentrale Notizen mit Formatierung, Anheften und Zuordnung (#89)
- Dokumente an Mietvertrag, Ticket, Wartungsvertrag, Versicherung, Kostenposition oder Notiz (#99)
- Handwerker und Wartungsverträge bearbeitbar (#97)
- Schadensmeldungen: Verlauf, Handwerkertermin und Nachricht an den Melder im Portal (#100)
- Vorlagen mit Formatierung und Überschriften (#98)
- E-Mail-Benachrichtigungen einzeln schaltbar (#80)
- Dokumente bis 100 MB (#85)

### API, Login, Betrieb
- API: `externalId` bei Zahlungen für wiederholbare Importe, PATCH als Teil-Update, mehr Felder beim Lesen (#111)
- Dokumente per API/MCP umhängen, umbenennen, löschen (#86)
- Nur SSO (`AUTH_PASSWORD_LOGIN=false`) und automatische SSO-Weiterleitung (`OIDC_AUTO_LOGIN=true`) (#101)
- OIDC sendet `state` (#112)
- `deploy/backup.sh`: Sicherung mit Testwiederherstellung, Wiederherstellen, Verschlüsselung, Aufbewahrung (#82)

## 0.4.0 – 2026-10-02

- Versionierte Docker-Images (`0.4.0.<build>`, `0.4.0`, `0.4`)
- Finanzen in Tabs mit Seitenumbruch, Bank-Sync mit täglichem Abgleich (Enable Banking)
- Kommunikation: Posteingang per IMAP, Konversationen, Anhänge übernehmen, E-Mail-Verlauf je Kontakt
- WEG: Untergemeinschaften, MEA mit Nachkommastellen, Eigentümeranteile
- Mietverhältnisse je Zeitraum in der Abrechnung (Mieterwechsel im Jahr), anteilige Vorauszahlungen
- Wohnungsgeberbestätigung, gebündelte Mahnungen, Serienmail mit Anhängen
- Kontobewegungen mit Notizen und Belegen, CSV-Import mit Zuordnungsassistent, Postausgang
- Dokumentvorschau, Mehrfachmandanten mit Instanz-Admin, optionaler OIDC/SSO-Login
- Portugiesisch (pt-BR) als Sprache registriert, Dunkelmodus-Korrekturen

## 0.3.0 – 2026-08-16

Erste getaggte Version.

- Miet- und WEG-Verwaltung: Objekte, Einheiten, Personen, Mietverträge, Sollstellungen, Mahnwesen
- Betriebskostenabrechnung (BetrKV, HeizkostenV mit einstellbarem Verbrauchsanteil, Gradtagszahlen)
- Flächenmodell für Gewerbe (m²·Tage), Leerstand und Interessenten
- Kaution, Versicherungen, Grundsteuer, Zensus, Tickets, Kalender, Dokumente, Vorlagen, Zusatzfelder
- DATEV-Export, CSV-Import und -Export
- REST-API mit Bearer-Token, OpenAPI-Referenz und MCP-Server, KI-Assistent mit mehreren Anbietern
- Mieter- und Eigentümerportal, Benachrichtigungen, Audit-Log, DE/EN
