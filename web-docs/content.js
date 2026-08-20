// Doku-Inhalte DE/EN. window.DOCS[sectionId] = { de: "<html>", en: "<html>" }
window.DOCS = {

overview: {
  de: `
    <h1>HaVeWa — Dokumentation</h1>
    <p class="lead">HaVeWa ist eine vollständige Immobilienverwaltung für <strong>Miet- und WEG-Verwaltung</strong> in einem System — mehrsprachig (DE/EN), mandantenfähig, mit REST-API und MCP-Server für KI-Agenten.</p>
    <p>Diese Doku führt durch alle Bereiche: Objekte und Einheiten anlegen, Mieter und Verträge verwalten, Betriebskosten und WEG abrechnen, Dokumente und Instandhaltung, Portale für Mieter und Eigentümer sowie Betrieb und Installation.</p>
    <h3>Für wen?</h3>
    <ul>
      <li><strong>Verwalter/Buchhaltung</strong> — die volle Verwalter-App.</li>
      <li><strong>Mieter/Eigentümer</strong> — ein schlankes Self-Service-Portal.</li>
      <li><strong>Entwickler/KI</strong> — REST-API + MCP zum Lesen und Verwalten des Bestands.</li>
    </ul>
    <div class="tip">Neu hier? Weiter mit <a href="#start">Erste Schritte</a> und den <a href="#concepts">Grundbegriffen</a>.</div>`,
  en: `
    <h1>HaVeWa — Documentation</h1>
    <p class="lead">HaVeWa is a complete property-management system for <strong>rental and HOA (WEG)</strong> administration — bilingual (DE/EN), multi-tenant, with a REST API and MCP server for AI agents.</p>
    <p>This guide covers every area: creating properties and units, managing tenants and leases, service-charge and HOA statements, documents and maintenance, tenant/owner portals, plus hosting and installation.</p>
    <h3>Who is it for?</h3>
    <ul>
      <li><strong>Managers/accounting</strong> — the full manager app.</li>
      <li><strong>Tenants/owners</strong> — a lightweight self-service portal.</li>
      <li><strong>Developers/AI</strong> — REST API + MCP to read and manage the portfolio.</li>
    </ul>
    <div class="tip">New here? Continue with <a href="#start">Getting started</a> and the <a href="#concepts">Core concepts</a>.</div>`
},

start: {
  de: `
    <h2>Erste Schritte</h2>
    <p>Am einfachsten läuft HaVeWa als Docker-Container mit einer PostgreSQL-Datenbank. Beim ersten Start passiert eines von dreien:</p>
    <ol>
      <li><strong>Demo-Daten</strong> (<code>SEED_DEMO=true</code>): ein Beispiel-Mandant wird angelegt. Login <code>admin@havewa.app</code> / <code>admin</code>.</li>
      <li><strong>Direkt-Einrichtung</strong> (<code>ADMIN_EMAIL</code> + <code>ADMIN_PASSWORD</code>): Mandant + Admin werden angelegt, der Wizard entfällt.</li>
      <li><strong>Wizard</strong> (nichts gesetzt): beim ersten Login führt ein Assistent durch Mandant, Admin und Theme-Farbe.</li>
    </ol>
    <h3>Schnellstart (Docker Compose)</h3>
    <pre><code>git clone https://github.com/fgilde/hausverwaltung.git &amp;&amp; cd hausverwaltung
cp .env.prod.example .env   # DB_PASSWORD, AUTH_SECRET, DOMAIN setzen
docker compose -f docker-compose.prod.yml up -d --build</code></pre>
    <p>Danach die Ersteinrichtung unter <code>https://&lt;DOMAIN&gt;/setup</code> abschließen. Fertige Wege für Unraid, Umbrel und Proxmox stehen unter <a href="#deploy">Installation &amp; Hosting</a>.</p>
    <div class="tip">Zum Ausprobieren genügt lokal <code>SEED_DEMO=true</code> — dann sind Objekte, Verträge und ein Gewerbe-Flächenmodell schon befüllt.</div>`,
  en: `
    <h2>Getting started</h2>
    <p>The easiest way to run HaVeWa is as a Docker container with a PostgreSQL database. On first start one of three things happens:</p>
    <ol>
      <li><strong>Demo data</strong> (<code>SEED_DEMO=true</code>): a sample tenant is created. Login <code>admin@havewa.app</code> / <code>admin</code>.</li>
      <li><strong>Direct setup</strong> (<code>ADMIN_EMAIL</code> + <code>ADMIN_PASSWORD</code>): tenant + admin are created and the wizard is skipped.</li>
      <li><strong>Wizard</strong> (nothing set): on first login an assistant walks you through tenant, admin and theme colour.</li>
    </ol>
    <h3>Quick start (Docker Compose)</h3>
    <pre><code>git clone https://github.com/fgilde/hausverwaltung.git &amp;&amp; cd hausverwaltung
cp .env.prod.example .env   # set DB_PASSWORD, AUTH_SECRET, DOMAIN
docker compose -f docker-compose.prod.yml up -d --build</code></pre>
    <p>Then finish setup at <code>https://&lt;DOMAIN&gt;/setup</code>. Ready-made paths for Unraid, Umbrel and Proxmox are under <a href="#deploy">Install &amp; hosting</a>.</p>
    <div class="tip">To just try it out locally set <code>SEED_DEMO=true</code> — properties, leases and a commercial area model come pre-filled.</div>`
},

concepts: {
  de: `
    <h2>Grundbegriffe</h2>
    <table>
      <tr><th>Begriff</th><th>Bedeutung</th></tr>
      <tr><td>Mandant</td><td>Ein abgeschlossener Datenraum (z. B. eine Hausverwaltung). Alle Daten sind mandanten-getrennt.</td></tr>
      <tr><td>Objekt</td><td>Eine Liegenschaft (Adresse). Verwaltungsart <em>Miet</em> oder <em>WEG</em>.</td></tr>
      <tr><td>Gebäude / Einheit</td><td>Ein Objekt enthält Gebäude, ein Gebäude Einheiten (Wohnung, Gewerbe, Stellplatz …).</td></tr>
      <tr><td>Person</td><td>Kontakt im Adressbuch (Mieter, Eigentümer, Interessent, Handwerker …).</td></tr>
      <tr><td>Mietvertrag</td><td>Verknüpft Einheit ↔ Mieter, mit Kaltmiete, Nebenkosten-Vorauszahlung, Laufzeit.</td></tr>
      <tr><td>Sollstellung</td><td>Eine Forderung (z. B. Monatsmiete). Zahlungen werden dagegen verbucht.</td></tr>
      <tr><td>Verteilerschlüssel</td><td>Regel, wie Kosten umgelegt werden: Fläche, Einheiten, Personen, MEA, Verbrauch.</td></tr>
      <tr><td>MEA</td><td>Miteigentumsanteile (Tausendstel) — Basis der WEG-Umlage.</td></tr>
    </table>
    <h3>Rollen</h3>
    <p><strong>Administrator</strong> und <strong>Verwalter</strong> sehen die volle App, <strong>Buchhaltung</strong> die Finanzbereiche. <strong>Mieter</strong>, <strong>Eigentümer</strong> und <strong>Handwerker</strong> landen im Portal. Rollen werden unter <em>Einstellungen → Benutzer</em> vergeben.</p>`,
  en: `
    <h2>Core concepts</h2>
    <table>
      <tr><th>Term</th><th>Meaning</th></tr>
      <tr><td>Tenant (Mandant)</td><td>An isolated data space (e.g. one property manager). All data is tenant-separated.</td></tr>
      <tr><td>Property</td><td>A real-estate object (address). Management type <em>rental</em> or <em>HOA</em>.</td></tr>
      <tr><td>Building / unit</td><td>A property holds buildings, a building holds units (flat, commercial, parking …).</td></tr>
      <tr><td>Person</td><td>Address-book contact (tenant, owner, prospect, contractor …).</td></tr>
      <tr><td>Lease</td><td>Links unit ↔ tenant, with base rent, service-charge prepayment, term.</td></tr>
      <tr><td>Charge</td><td>A receivable (e.g. monthly rent). Payments are booked against it.</td></tr>
      <tr><td>Distribution key</td><td>How costs are allocated: area, units, persons, co-ownership share, consumption.</td></tr>
      <tr><td>MEA</td><td>Co-ownership shares (per mille) — basis of HOA allocation.</td></tr>
    </table>
    <h3>Roles</h3>
    <p><strong>Administrator</strong> and <strong>Manager</strong> see the full app, <strong>Accounting</strong> the finance areas. <strong>Tenant</strong>, <strong>Owner</strong> and <strong>Contractor</strong> land in the portal. Roles are assigned under <em>Settings → Users</em>.</p>`
},

properties: {
  de: `
    <h2>Objekte &amp; Einheiten</h2>
    <p>Unter <em>Objekte</em> legst du Liegenschaften an (Name, Adresse, Typ, Verwaltungsart Miet/WEG). Auf der Objekt-Detailseite folgen <strong>Gebäude</strong> und darunter <strong>Einheiten</strong>.</p>
    <h3>Einheit</h3>
    <ul>
      <li>Bezeichnung, Typ (Wohnung, Gewerbe, Stellplatz, Keller, Sonstiges), Fläche (m²), Zimmer.</li>
      <li><strong>MEA</strong> (Tausendstel) für WEG-Objekte.</li>
      <li>Zähler (Strom, Wasser, Wärme …) mit Ablesungen — Basis für die Verbrauchsumlage.</li>
    </ul>
    <p>In der Einheiten-Liste siehst du je Einheit den <strong>aktuellen Mieter</strong> und den Vermietungsstatus; bei Leerstand kannst du direkt „Mieter zuordnen".</p>
    <div class="warn">Beim <strong>Bearbeiten</strong> der Einheit bleibt die Gebäude-Zuordnung fix — Felder wie Fläche lassen sich jederzeit ändern.</div>
    <h3>Import/Export</h3>
    <p>Einheiten und Objekte lassen sich als CSV exportieren und importieren (siehe <a href="#io">Import &amp; Export</a>).</p>`,
  en: `
    <h2>Properties &amp; units</h2>
    <p>Under <em>Properties</em> you create objects (name, address, type, management rental/HOA). The property detail page holds <strong>buildings</strong> and, below them, <strong>units</strong>.</p>
    <h3>Unit</h3>
    <ul>
      <li>Label, type (flat, commercial, parking, cellar, other), area (m²), rooms.</li>
      <li><strong>MEA</strong> (per mille) for HOA properties.</li>
      <li>Meters (electricity, water, heat …) with readings — basis for consumption allocation.</li>
    </ul>
    <p>The units list shows each unit's <strong>current tenant</strong> and occupancy status; for vacant units you can "assign tenant" right there.</p>
    <div class="warn">When <strong>editing</strong> a unit the building assignment stays fixed — fields like area can be changed any time.</div>
    <h3>Import/export</h3>
    <p>Units and properties can be exported and imported as CSV (see <a href="#io">Import &amp; export</a>).</p>`
},

people: {
  de: `
    <h2>Personen &amp; Adressbuch</h2>
    <p>Alle Kontakte liegen unter <em>Personen</em>, gruppiert nach Kontaktart: Mieter, Eigentümer, <strong>Interessent</strong>, Handwerker, Makler, Bank, Sonstige. Über die Gruppen-Filter findest du z. B. schnell alle Mietinteressenten.</p>
    <ul>
      <li>Interessenten mit Notiz (Mietgesuch) tauchen in der <a href="#leasing">Vermarktung</a> auf.</li>
      <li>Personen können mit einem Portal-Zugang verknüpft werden (Einstellungen → Benutzer).</li>
      <li>CSV-Import fürs Adressbuch: Spalten <code>firstName, lastName</code> Pflicht, optional <code>email, phone, type, note</code>.</li>
    </ul>`,
  en: `
    <h2>People &amp; address book</h2>
    <p>All contacts live under <em>People</em>, grouped by contact type: tenant, owner, <strong>prospect</strong>, contractor, broker, bank, other. Group filters let you quickly find, say, all prospective tenants.</p>
    <ul>
      <li>Prospects with a note (housing request) show up in <a href="#leasing">Leasing</a>.</li>
      <li>People can be linked to a portal login (Settings → Users).</li>
      <li>Address-book CSV import: columns <code>firstName, lastName</code> required, optional <code>email, phone, type, note</code>.</li>
    </ul>`
},

leases: {
  de: `
    <h2>Mietverträge</h2>
    <p>Ein Vertrag verbindet eine <strong>Einheit</strong> mit einem oder mehreren <strong>Mietern</strong>. Er trägt Kaltmiete, Nebenkosten-/Heizkosten-Vorauszahlung (als Miet-Bestandteile), Laufzeit, Personenzahl und Kündigungsfrist.</p>
    <h3>Anlegen &amp; zuordnen</h3>
    <ul>
      <li>Aus der Einheit heraus: „Mieter zuordnen" (Einheit vorbelegt).</li>
      <li>Aus der Person heraus: „Vertrag anlegen" (Person vorbelegt).</li>
      <li>Mehrere Mieter je Vertrag über „Mieter hinzufügen".</li>
    </ul>
    <h3>Staffel- und Indexmiete</h3>
    <p>Mietanpassungen werden geplant (Staffel oder Index) und per Klick <strong>angewandt</strong> — die Kaltmiete des Vertrags wird gesetzt und die Anpassung als erledigt markiert.</p>
    <h3>Kaution</h3>
    <p>Kaution je Vertrag (Bar, Bürgschaft, verpfändet, Kautionskonto) inkl. optionaler Verzinsung und Verknüpfung zu einem Konto.</p>`,
  en: `
    <h2>Leases</h2>
    <p>A lease links a <strong>unit</strong> to one or more <strong>tenants</strong>. It carries base rent, service-charge/heating prepayment (as rent components), term, occupant count and notice period.</p>
    <h3>Create &amp; assign</h3>
    <ul>
      <li>From a unit: "assign tenant" (unit prefilled).</li>
      <li>From a person: "create lease" (person prefilled).</li>
      <li>Multiple tenants per lease via "add tenant".</li>
    </ul>
    <h3>Stepped &amp; index rent</h3>
    <p>Rent adjustments are planned (stepped or index) and <strong>applied</strong> with one click — the lease's base rent is set and the adjustment marked done.</p>
    <h3>Deposit</h3>
    <p>Deposit per lease (cash, guarantee, pledged, deposit account) incl. optional interest and a link to an account.</p>`
},

area: {
  de: `
    <h2>Flächenmodell (Gewerbe)</h2>
    <p>Für Gewerbeobjekte, in denen <strong>Fläche aus einem Pool</strong> vermietet wird (z. B. Lagerhalle), aktivierst du am Objekt das Flächenmodell und setzt die <strong>Gesamtfläche</strong>.</p>
    <h3>Teilflächen</h3>
    <ul>
      <li>Teilflächen hängen direkt am Objekt (keine festen Einheiten nötig), mit m², optionalem <strong>€/m²-Preis</strong> und Zeitraum (von–bis).</li>
      <li>Ein Mieter (Person) oder ein Label wird zugeordnet; ohne Zuordnung zählt die Fläche als <strong>Leerstand</strong>.</li>
      <li><strong>Außenflächen</strong> (z. B. Stellplätze) werden separat ausgewiesen und zählen nicht zur Pool-Summe/NK.</li>
    </ul>
    <h3>Warum „die Summe stimmt immer"</h3>
    <p>Die Umlage ist <strong>m²·Tage-gewichtet</strong>: belegte Fläche·Zeit + Leerstand·Zeit = Gesamtfläche·Zeit. Unterjährige Zu-/Abgänge werden korrekt anteilig verteilt; der Leerstand trägt seinen Anteil (Eigentümer).</p>
    <h3>Miete</h3>
    <p>Beim <a href="#finance">Sollstellungslauf</a> wird je aktiver Teilfläche mit €/m² automatisch die Monatsmiete (Fläche · Preis) erzeugt.</p>
    <div class="tip">Auf der Objekt-Detailseite siehst du Pool/belegt/Leerstand mit ✓/✗ und die Jahres-Flächenabrechnung mit Jahres-Auswahl.</div>`,
  en: `
    <h2>Area model (commercial)</h2>
    <p>For commercial objects where <strong>area is let from a pool</strong> (e.g. a warehouse), enable the area model on the property and set the <strong>total area</strong>.</p>
    <h3>Sub-areas</h3>
    <ul>
      <li>Sub-areas attach directly to the property (no fixed units needed), with m², an optional <strong>€/m² price</strong> and a period (from–to).</li>
      <li>A tenant (person) or a label is assigned; without one the area counts as <strong>vacancy</strong>.</li>
      <li><strong>Outdoor areas</strong> (e.g. parking) are shown separately and excluded from the pool total / service charges.</li>
    </ul>
    <h3>Why "the total always adds up"</h3>
    <p>Allocation is <strong>m²·days weighted</strong>: occupied area·time + vacancy·time = total area·time. Mid-year changes are prorated correctly; vacancy carries its share (owner).</p>
    <h3>Rent</h3>
    <p>During the <a href="#finance">charge run</a> each active sub-area with a €/m² price gets its monthly rent (area · price) automatically.</p>
    <div class="tip">The property detail page shows pool/occupied/vacancy with ✓/✗ and the annual area statement with a year selector.</div>`
},

finance: {
  de: `
    <h2>Konten, Sollstellung, Zahlungen</h2>
    <p>Unter <em>Finanzen</em> verwaltest du Konten, erzeugst Sollstellungen und verbuchst Zahlungen. Positiv = Guthaben, negativ = Nachzahlung.</p>
    <h3>Kontenrahmen</h3>
    <p>Beim Ersteinrichten wird ein <strong>Standard-Kontenrahmen</strong> angelegt (Giro, Kaution, Rücklage, Mieteinnahmen, Betriebskosten, Instandhaltung, Verwaltung). Fehlt er, legt ihn ein Button auf der Finanzen-Seite an.</p>
    <h3>Sollstellungslauf</h3>
    <p>Monat wählen → für alle aktiven Verträge wird die Miet-Sollstellung (Kaltmiete + Bestandteile) erzeugt, Doppelbuchungen werden übersprungen. Flächenmodell-Objekte werden mit einbezogen.</p>
    <h3>Zahlungen &amp; Bank-Import</h3>
    <ul>
      <li>Zahlungen manuell einer Sollstellung zuordnen.</li>
      <li><strong>camt.053</strong>-Import: Kontoauszug einlesen, Eingänge werden offenen Posten automatisch zugeordnet (Betragsabgleich).</li>
    </ul>`,
  en: `
    <h2>Accounts, charges, payments</h2>
    <p>Under <em>Finances</em> you manage accounts, generate charges and book payments. Positive = credit, negative = arrears.</p>
    <h3>Chart of accounts</h3>
    <p>On first setup a <strong>default chart of accounts</strong> is created (bank, deposit, reserve, rent income, operating costs, maintenance, admin). If missing, a button on the finances page creates it.</p>
    <h3>Charge run</h3>
    <p>Pick a month → the rent charge (base rent + components) is generated for all active leases; duplicates are skipped. Area-model properties are included.</p>
    <h3>Payments &amp; bank import</h3>
    <ul>
      <li>Assign payments to a charge manually.</li>
      <li><strong>camt.053</strong> import: read a bank statement; incoming payments are auto-matched to open items (by amount).</li>
    </ul>`
},

dunning: {
  de: `
    <h2>Mahnwesen</h2>
    <p>Überfällige, nicht voll bezahlte Sollstellungen werden gemahnt — objektübergreifend unter <em>Mahnwesen</em>. Der <strong>Mahnlauf</strong> erzeugt für jede überfällige Forderung die nächste Mahnstufe (max. 3) inkl. Mahngebühr.</p>
    <p>Einzelne Mahnungen lassen sich als PDF drucken oder als E-Mail an den Mieter erzeugen.</p>`,
  en: `
    <h2>Dunning</h2>
    <p>Overdue, not fully paid charges are dunned — across properties under <em>Dunning</em>. The <strong>dunning run</strong> creates the next level (max 3) incl. a fee for every overdue receivable.</p>
    <p>Individual reminders can be printed as PDF or generated as an email to the tenant.</p>`
},

statements: {
  de: `
    <h2>Betriebskostenabrechnung</h2>
    <p>Unter <em>Abrechnungen</em> erfasst du je Objekt/Jahr Kostenpositionen (BetrKV) und legst sie per <strong>Verteilerschlüssel</strong> auf die Einheiten um.</p>
    <h3>Verteilerschlüssel</h3>
    <table>
      <tr><th>Schlüssel</th><th>Verteilung nach</th></tr>
      <tr><td>Fläche</td><td>m² der Einheit</td></tr>
      <tr><td>Einheiten</td><td>gleich je Einheit</td></tr>
      <tr><td>Personen</td><td>Personenzahl</td></tr>
      <tr><td>MEA</td><td>Miteigentumsanteile</td></tr>
      <tr><td>Verbrauch</td><td>gemessene Zählerdifferenz</td></tr>
    </table>
    <div class="warn">Steht „Verbrauch", sind aber keine Zählerstände hinterlegt, fällt die Position automatisch auf <strong>Fläche</strong> zurück.</div>
    <h3>HeizkostenV</h3>
    <p>Heiz-/Warmwasserkosten werden nach HeizkostenV aufgeteilt: standardmäßig <strong>30 % nach Fläche, 70 % nach Verbrauch</strong>. Der Verbrauchsanteil ist einstellbar — als Mandanten-Standard (Einstellungen → Erweitert) und je Kostenposition; 100 % = rein nach gemessenem Verbrauch. Unterjährige Ableseperioden werden per <strong>Gradtagszahl (§9b)</strong> auf einen Jahreswert hochgerechnet.</p>
    <h3>Grundsteuer &amp; Versicherung</h3>
    <p>Diese liegen als Referenz in eigenen Reitern und lassen sich per „Als Kosten buchen" direkt als Kostenposition ins Abrechnungsjahr übernehmen.</p>`,
  en: `
    <h2>Service-charge statements</h2>
    <p>Under <em>Statements</em> you record cost items per property/year (German BetrKV) and allocate them to units by <strong>distribution key</strong>.</p>
    <h3>Distribution keys</h3>
    <table>
      <tr><th>Key</th><th>Allocated by</th></tr>
      <tr><td>Area</td><td>unit m²</td></tr>
      <tr><td>Units</td><td>equal per unit</td></tr>
      <tr><td>Persons</td><td>occupant count</td></tr>
      <tr><td>MEA</td><td>co-ownership share</td></tr>
      <tr><td>Consumption</td><td>metered difference</td></tr>
    </table>
    <div class="warn">If "consumption" is chosen but no meter readings exist, the item falls back to <strong>area</strong> automatically.</div>
    <h3>Heating costs ordinance</h3>
    <p>Heating/hot-water costs are split per the German ordinance: by default <strong>30% by area, 70% by consumption</strong>. The consumption share is configurable — as a tenant default (Settings → Advanced) and per cost item; 100% = purely by metered consumption. Part-year reading periods are extrapolated to a full year via <strong>degree-days (§9b)</strong>.</p>
    <h3>Property tax &amp; insurance</h3>
    <p>These sit as a reference in their own tabs and can be pulled into the statement year directly via "book as cost".</p>`
},

weg: {
  de: `
    <h2>WEG-Verwaltung</h2>
    <p>Für WEG-Objekte bildet HaVeWa den Wirtschaftsplan, das Hausgeld und die Jahresabrechnung nach <strong>Miteigentumsanteilen (MEA)</strong> ab.</p>
    <ul>
      <li><strong>Wirtschaftsplan</strong> (§28): Gesamtkosten je Jahr → Hausgeld je Eigentümer nach MEA, monatlich = /12.</li>
      <li><strong>Erhaltungsrücklage</strong> mit Zu-/Entnahmen und Saldo.</li>
      <li><strong>Jahresabrechnung</strong> + Vermögensbericht.</li>
      <li>MEA-Prüfung: Summe der Anteile wird gegen die Objekt-Sollsumme (Tausendstel) validiert (✓/✗).</li>
    </ul>`,
  en: `
    <h2>HOA management</h2>
    <p>For HOA properties HaVeWa models the economic plan, the monthly fee and the annual statement by <strong>co-ownership shares (MEA)</strong>.</p>
    <ul>
      <li><strong>Economic plan</strong> (§28): total yearly costs → fee per owner by MEA, monthly = /12.</li>
      <li><strong>Maintenance reserve</strong> with contributions/withdrawals and balance.</li>
      <li><strong>Annual statement</strong> + asset report.</li>
      <li>MEA check: the sum of shares is validated against the property target (per mille) (✓/✗).</li>
    </ul>`
},

meetings: {
  de: `
    <h2>Versammlungen &amp; Beschlüsse</h2>
    <p>Unter <em>Versammlungen</em> planst du Eigentümerversammlungen mit Tagesordnung (TOPs) und protokollierst <strong>Beschlüsse</strong>. Jeder Beschluss erhält eine fortlaufende Nummer je Objekt — die <strong>Beschlusssammlung nach §24 Abs. 7 WEG</strong>.</p>
    <p>Erfasst werden Titel, Text, Datum, Ergebnis (angenommen/abgelehnt/vertagt) und die Stimmen (Ja/Nein/Enthaltung).</p>`,
  en: `
    <h2>Meetings &amp; resolutions</h2>
    <p>Under <em>Meetings</em> you plan owners' meetings with an agenda and record <strong>resolutions</strong>. Each resolution gets a running number per property — the <strong>resolution register (§24 WEG)</strong>.</p>
    <p>Captured: title, text, date, result (accepted/rejected/deferred) and votes (yes/no/abstain).</p>`
},

documents: {
  de: `
    <h2>Dokumente</h2>
    <p>Unter <em>Dokumente</em> legst du Dateien ab (Verträge, Rechnungen, Protokolle, Abrechnungen), verknüpfst sie mit Objekt/Einheit/Person und filterst nach Kategorie. Eine Inline-Vorschau ist eingebaut.</p>
    <p><strong>E-Rechnungen</strong> (ZUGFeRD/XRechnung, XML-Syntaxen) werden beim Upload automatisch ausgelesen (Rechnungsnummer, Betrag). Ablage GoBD-orientiert.</p>`,
  en: `
    <h2>Documents</h2>
    <p>Under <em>Documents</em> you store files (contracts, invoices, minutes, statements), link them to property/unit/person and filter by category. An inline preview is built in.</p>
    <p><strong>E-invoices</strong> (ZUGFeRD/XRechnung XML syntaxes) are parsed on upload (invoice number, total). Storage is GoBD-oriented.</p>`
},

tickets: {
  de: `
    <h2>Instandhaltung</h2>
    <p>Unter <em>Instandhaltung</em> verwaltest du Tickets (Störung, Schaden, Wartung …) mit Status (offen, in Arbeit, wartend, erledigt), Priorität, Zuständigkeit, Fälligkeit/Wiedervorlage und <strong>Zeiterfassung</strong>.</p>
    <ul>
      <li><strong>Handwerker</strong> als Kontakte, <strong>Wartungsverträge</strong> mit Intervall und nächster Fälligkeit („fortschreiben").</li>
      <li>Schadensmeldungen aus dem Portal landen hier als Ticket (Kategorie Störung) — der/die Verwalter werden benachrichtigt.</li>
      <li>Statusänderung benachrichtigt den meldenden Mieter im Portal.</li>
    </ul>`,
  en: `
    <h2>Maintenance</h2>
    <p>Under <em>Maintenance</em> you manage tickets (fault, damage, servicing …) with status (open, in progress, waiting, done), priority, assignee, due/follow-up date and <strong>time tracking</strong>.</p>
    <ul>
      <li><strong>Contractors</strong> as contacts, <strong>service contracts</strong> with interval and next-due ("advance").</li>
      <li>Issues reported from the portal arrive here as a ticket (category fault) — managers get notified.</li>
      <li>A status change notifies the reporting tenant in the portal.</li>
    </ul>`
},

leasing: {
  de: `
    <h2>Vermarktung</h2>
    <p>Die Seite <em>Vermarktung</em> stellt <strong>Leerstand</strong> und auslaufende Verträge den <strong>Mietinteressenten</strong> gegenüber — damit sich künftiger Leerstand vor Übergabe nahtlos weitervermieten lässt.</p>
    <ul>
      <li>Aktuell leere Einheiten und freie Fläche (Flächenmodell).</li>
      <li>Verträge, die in ≤ 90 Tagen auslaufen.</li>
      <li>Interessenten aus dem Adressbuch inkl. Gesuch-Notiz und Kontakt.</li>
    </ul>`,
  en: `
    <h2>Leasing</h2>
    <p>The <em>Leasing</em> page contrasts <strong>vacancy</strong> and expiring leases with <strong>prospective tenants</strong> — so upcoming vacancy can be re-let seamlessly before handover.</p>
    <ul>
      <li>Currently vacant units and free area (area model).</li>
      <li>Leases expiring within ≤ 90 days.</li>
      <li>Prospects from the address book incl. their request note and contact.</li>
    </ul>`
},

portals: {
  de: `
    <h2>Portale</h2>
    <p>Mieter und Eigentümer bekommen ein eigenes, schlankes Portal (Login mit ihrem Personen-verknüpften Zugang). Dort sehen sie nur ihre Daten:</p>
    <ul>
      <li><strong>Mieter</strong>: eigene Mietverhältnisse, offene Posten, Beschlüsse, Dokumente, <strong>Schaden melden</strong> und der Status eigener Meldungen.</li>
      <li><strong>Eigentümer</strong>: eigene Einheiten, Beschlüsse und Dokumente (lesend).</li>
    </ul>
    <p>Zugänge legt der Verwalter unter <em>Einstellungen → Benutzer</em> an und verknüpft sie mit einer Person.</p>`,
  en: `
    <h2>Portals</h2>
    <p>Tenants and owners get their own lightweight portal (login via their person-linked account). They only see their own data:</p>
    <ul>
      <li><strong>Tenant</strong>: own leases, open items, resolutions, documents, <strong>report an issue</strong> and the status of their reports.</li>
      <li><strong>Owner</strong>: own units, resolutions and documents (read-only).</li>
    </ul>
    <p>The manager creates logins under <em>Settings → Users</em> and links them to a person.</p>`
},

notifications: {
  de: `
    <h2>Benachrichtigungen</h2>
    <p>Oben rechts zeigt eine <strong>Glocke</strong> ungelesene Hinweise mit Zähler. Ereignisse erzeugen In-App-Benachrichtigungen an die betroffenen Nutzer:</p>
    <ul>
      <li>Meldet ein Mieter einen Schaden, werden alle Verwalter benachrichtigt (Klick → Instandhaltung).</li>
      <li>Ändert sich der Status einer Meldung, wird der meldende Mieter im Portal benachrichtigt.</li>
    </ul>
    <p>Klick markiert gelesen und springt zum Ziel; „Alle gelesen" leert den Zähler.</p>`,
  en: `
    <h2>Notifications</h2>
    <p>Top right a <strong>bell</strong> shows unread hints with a counter. Events create in-app notifications for the affected users:</p>
    <ul>
      <li>When a tenant reports an issue, all managers are notified (click → Maintenance).</li>
      <li>When a report's status changes, the reporting tenant is notified in the portal.</li>
    </ul>
    <p>Clicking marks it read and jumps to the target; "mark all read" clears the counter.</p>`
},

ai: {
  de: `
    <h2>KI-Assistent</h2>
    <p>Der Assistent im Dashboard beantwortet Fragen zum Bestand. Anbieter frei wählbar unter <em>Einstellungen → KI &amp; API</em>:</p>
    <ul>
      <li><strong>Anthropic (Claude)</strong> oder ein beliebiger <strong>OpenAI-kompatibler</strong> Endpunkt (OpenAI, OpenRouter, Groq, Ollama …) via Base-URL + Modell.</li>
      <li>Ohne Schlüssel liefert der Assistent eine regelbasierte Kennzahlen-Zusammenfassung.</li>
    </ul>
    <p>Für echtes Lesen/Bearbeiten durch KI-Agenten siehe <a href="#api">API &amp; MCP</a>.</p>`,
  en: `
    <h2>AI assistant</h2>
    <p>The dashboard assistant answers questions about your portfolio. Provider is free to choose under <em>Settings → AI &amp; API</em>:</p>
    <ul>
      <li><strong>Anthropic (Claude)</strong> or any <strong>OpenAI-compatible</strong> endpoint (OpenAI, OpenRouter, Groq, Ollama …) via base URL + model.</li>
      <li>Without a key the assistant returns a rule-based metrics summary.</li>
    </ul>
    <p>For real read/write by AI agents see <a href="#api">API &amp; MCP</a>.</p>`
},

api: {
  de: `
    <h2>API &amp; MCP</h2>
    <p>Jeder Benutzer erzeugt persönliche <strong>API-Tokens</strong> unter <em>Einstellungen → KI &amp; API</em> (Admins auch für andere). Authentifizierung per <code>Authorization: Bearer &lt;token&gt;</code>. Aller Zugriff ist auf den Mandanten des Tokens beschränkt.</p>
    <h3>REST-API</h3>
    <ul>
      <li>Basis <code>/api/v1</code> — Lesen und Schreiben über alle Module (Objekte, Einheiten, Verträge, Finanzen, Versammlungen, Beschlüsse, Dokumente, WEG, Versicherung, Grundsteuer …).</li>
      <li>Operationen (Sollstellungslauf, Mahnlauf, Mietanpassung anwenden, Bank-Import, E-Mail senden, Dokument-Upload).</li>
      <li>Interaktive Referenz (Scalar) unter <code>/api-reference</code>, OpenAPI unter <code>/api/v1/openapi.json</code>.</li>
    </ul>
    <h3>MCP-Server</h3>
    <p>Unter <code>/api/mcp</code> (Model Context Protocol). Claude Desktop, ChatGPT o. Ä. verbinden, damit eine KI den Bestand <strong>lesen und verwalten</strong> kann. Die genauen URLs und eine fertige Client-Konfiguration zeigt die Einstellungsseite.</p>
    <pre><code>{ "mcpServers": { "havewa": {
  "url": "https://DEINE-DOMAIN/api/mcp",
  "headers": { "Authorization": "Bearer DEIN_TOKEN" }
} } }</code></pre>`,
  en: `
    <h2>API &amp; MCP</h2>
    <p>Every user creates personal <strong>API tokens</strong> under <em>Settings → AI &amp; API</em> (admins also for others). Auth via <code>Authorization: Bearer &lt;token&gt;</code>. All access is scoped to the token's tenant.</p>
    <h3>REST API</h3>
    <ul>
      <li>Base <code>/api/v1</code> — read and write across all modules (properties, units, leases, finances, meetings, resolutions, documents, HOA, insurance, property tax …).</li>
      <li>Operations (charge run, dunning run, apply rent adjustment, bank import, send email, upload document).</li>
      <li>Interactive reference (Scalar) at <code>/api-reference</code>, OpenAPI at <code>/api/v1/openapi.json</code>.</li>
    </ul>
    <h3>MCP server</h3>
    <p>At <code>/api/mcp</code> (Model Context Protocol). Connect Claude Desktop, ChatGPT etc. so an AI can <strong>read and manage</strong> the portfolio. The exact URLs and a ready-to-paste client config are on the settings page.</p>
    <pre><code>{ "mcpServers": { "havewa": {
  "url": "https://YOUR-DOMAIN/api/mcp",
  "headers": { "Authorization": "Bearer YOUR_TOKEN" }
} } }</code></pre>`
},

io: {
  de: `
    <h2>Import &amp; Export</h2>
    <h3>CSV</h3>
    <ul>
      <li><strong>Export</strong> auf den Listen: Objekte, Einheiten, Personen, Tickets, offene Posten.</li>
      <li><strong>Import</strong>: Personen, Objekte, Einheiten (Objekt per Name, Gebäude wird bei Bedarf angelegt). Ungültige Zeilen werden übersprungen. Trenner „;" oder „,".</li>
    </ul>
    <h3>Buchhaltung &amp; Bank</h3>
    <ul>
      <li><strong>DATEV</strong>: Buchungsstapel im EXTF-Format (Format 700).</li>
      <li><strong>SEPA</strong>: Lastschriften als pain.008.</li>
      <li><strong>camt.053</strong>: Kontoauszug importieren mit Auto-Zuordnung.</li>
    </ul>`,
  en: `
    <h2>Import &amp; export</h2>
    <h3>CSV</h3>
    <ul>
      <li><strong>Export</strong> on the lists: properties, units, people, tickets, open items.</li>
      <li><strong>Import</strong>: people, properties, units (property by name, building created if needed). Invalid rows are skipped. Delimiter ";" or ",".</li>
    </ul>
    <h3>Accounting &amp; bank</h3>
    <ul>
      <li><strong>DATEV</strong>: posting batch in EXTF format (format 700).</li>
      <li><strong>SEPA</strong>: direct debits as pain.008.</li>
      <li><strong>camt.053</strong>: import a bank statement with auto-matching.</li>
    </ul>`
},

deploy: {
  de: `
    <h2>Installation &amp; Hosting</h2>
    <p>HaVeWa läuft als Docker-Image (<code>ghcr.io/fgilde/hausverwaltung:latest</code>) mit PostgreSQL. Migrationen und der optionale Bootstrap laufen beim Start automatisch.</p>
    <h3>Umgebungsvariablen</h3>
    <table>
      <tr><th>Variable</th><th>Zweck</th></tr>
      <tr><td><code>DATABASE_URL</code></td><td>Postgres-Verbindung</td></tr>
      <tr><td><code>AUTH_SECRET</code></td><td>Session-Secret (<code>openssl rand -base64 32</code>)</td></tr>
      <tr><td><code>SEED_DEMO</code></td><td><code>true</code> = Demo-Daten beim ersten Start</td></tr>
      <tr><td><code>ADMIN_EMAIL</code> / <code>ADMIN_PASSWORD</code></td><td>Admin direkt anlegen (Wizard entfällt)</td></tr>
      <tr><td><code>TENANT_NAME</code></td><td>Name der Hausverwaltung</td></tr>
    </table>
    <h3>Heimserver</h3>
    <ul>
      <li><strong>Unraid</strong>: Docker-Template <code>deploy/unraid/havewa.xml</code> + Postgres aus Community Apps.</li>
      <li><strong>Umbrel</strong>: App-Definition unter <code>deploy/umbrel/</code>.</li>
      <li><strong>Proxmox VE</strong>: Einzeiler auf dem Host legt einen Debian-LXC an:</li>
    </ul>
    <pre><code>bash -c "$(wget -qO- https://raw.githubusercontent.com/fgilde/hausverwaltung/main/deploy/proxmox/install.sh)"</code></pre>
    <p>Details in der <a href="https://github.com/fgilde/hausverwaltung#readme" target="_blank" rel="noreferrer">README</a>.</p>`,
  en: `
    <h2>Install &amp; hosting</h2>
    <p>HaVeWa runs as a Docker image (<code>ghcr.io/fgilde/hausverwaltung:latest</code>) with PostgreSQL. Migrations and the optional bootstrap run automatically on start.</p>
    <h3>Environment variables</h3>
    <table>
      <tr><th>Variable</th><th>Purpose</th></tr>
      <tr><td><code>DATABASE_URL</code></td><td>Postgres connection</td></tr>
      <tr><td><code>AUTH_SECRET</code></td><td>Session secret (<code>openssl rand -base64 32</code>)</td></tr>
      <tr><td><code>SEED_DEMO</code></td><td><code>true</code> = demo data on first start</td></tr>
      <tr><td><code>ADMIN_EMAIL</code> / <code>ADMIN_PASSWORD</code></td><td>create admin directly (skip wizard)</td></tr>
      <tr><td><code>TENANT_NAME</code></td><td>property-management name</td></tr>
    </table>
    <h3>Home servers</h3>
    <ul>
      <li><strong>Unraid</strong>: Docker template <code>deploy/unraid/havewa.xml</code> + Postgres from Community Apps.</li>
      <li><strong>Umbrel</strong>: app definition under <code>deploy/umbrel/</code>.</li>
      <li><strong>Proxmox VE</strong>: one-liner on the host creates a Debian LXC:</li>
    </ul>
    <pre><code>bash -c "$(wget -qO- https://raw.githubusercontent.com/fgilde/hausverwaltung/main/deploy/proxmox/install.sh)"</code></pre>
    <p>Details in the <a href="https://github.com/fgilde/hausverwaltung#readme" target="_blank" rel="noreferrer">README</a>.</p>`
},

faq: {
  de: `
    <h2>FAQ</h2>
    <h3>Miete oder WEG — beides?</h3>
    <p>Ja. Pro Objekt wählst du die Verwaltungsart. Miet- und WEG-Objekte laufen im selben Mandanten nebeneinander.</p>
    <h3>Kann ich ohne Internet/Cloud betreiben?</h3>
    <p>Ja — komplett selbst gehostet (Docker, Unraid, Umbrel, Proxmox). Es werden keine externen Dienste benötigt; KI und E-Mail sind optional.</p>
    <h3>Sind meine Daten getrennt?</h3>
    <p>Ja, alles ist mandanten-getrennt; API/MCP-Zugriff ist auf den Mandanten des Tokens beschränkt.</p>
    <h3>Wo ändere ich Sprache/Design?</h3>
    <p>Sprache oben rechts (DE/EN). Theme-Farbe und Logo unter <em>Einstellungen → Allgemein</em>.</p>
    <h3>Etwas fehlt oder klemmt?</h3>
    <p>Bitte ein <a href="https://github.com/fgilde/hausverwaltung/issues" target="_blank" rel="noreferrer">GitHub-Issue</a> öffnen.</p>`,
  en: `
    <h2>FAQ</h2>
    <h3>Rental or HOA — both?</h3>
    <p>Yes. You pick the management type per property. Rental and HOA properties live side by side in one tenant.</p>
    <h3>Can I run it without internet/cloud?</h3>
    <p>Yes — fully self-hosted (Docker, Unraid, Umbrel, Proxmox). No external services required; AI and email are optional.</p>
    <h3>Is my data separated?</h3>
    <p>Yes, everything is tenant-separated; API/MCP access is scoped to the token's tenant.</p>
    <h3>Where do I change language/theme?</h3>
    <p>Language top right (DE/EN). Theme colour and logo under <em>Settings → General</em>.</p>
    <h3>Something missing or broken?</h3>
    <p>Please open a <a href="https://github.com/fgilde/hausverwaltung/issues" target="_blank" rel="noreferrer">GitHub issue</a>.</p>`
}

};
