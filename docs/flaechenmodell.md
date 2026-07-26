# Flächenmodell — Design-Vorschlag

_Status: Entwurf zur Diskussion. Noch nicht implementiert._

## Problem

Aktuell hat jede Einheit (`Unit`) **eine feste Fläche** (`Unit.area`). Für
Gewerbeobjekte (z. B. Lagerhalle) passt das nicht: Dort wird **Fläche in m²**
aus einem Gesamtpool vermietet, die sich **unterjährig ändert** (Mieter bucht
dazu / gibt ab), und ein Teil steht **leer**. Der Schmerzpunkt der Kunden:
*„Die Summe stimmt nie."* — belegte + leere Flächen ergeben nicht die
Gesamtfläche, und die Betriebskosten-Umlage wird dadurch falsch.

## Ziele

1. Fläche als **zeitraum-genaue Teilflächen** je Vertrag modellieren (von–bis).
2. **Leerstand** automatisch als eigener Posten führen → Summe = Gesamtfläche **immer**.
3. Umlage **m²·Tage-gewichtet** (unterjährige Änderungen korrekt).
4. Aktive **Validierung/Warnung** bei Summenabweichung, mit Option „Rest = Leerstand".
5. Rückwärtskompatibel: Wohnobjekte nutzen weiter die feste `Unit.area`.

## Datenmodell (Vorschlag)

Zwei neue Konzepte, additiv zum Bestehenden:

```
Property.totalArea      Decimal?   // Gesamtfläche des Flächenpools (Gewerbe)
Property.areaModel      Boolean    // true = Flächenmodell aktiv (statt feste Unit.area)

model AreaAllocation {            // Teilflächen-Zuordnung über Zeit
  id         String
  tenantId   String
  propertyId String               // Flächenpool
  leaseId    String?              // zugeordneter Vertrag; null = Leerstand
  area       Decimal              // m²
  from       DateTime
  to         DateTime?            // offen = bis auf Weiteres
}
```

- Ein Vertrag kann **mehrere** `AreaAllocation`-Zeilen haben (Nachbuchungen).
- **Leerstand** = automatisch erzeugte/gepflegte Zeilen mit `leaseId = null`,
  sodass zu **jedem Zeitpunkt** `Σ area = Property.totalArea`.

## Umlage-Logik (m²·Tage)

Die vorhandene Verteilerschlüssel-Engine (`lib/allocation`) kennt bereits einen
`timeFactor` (0..1). Für das Flächenmodell wird pro Abrechnungszeitraum je
Teilnehmer das **Flächen-Zeit-Integral** gebildet:

```
gewicht(teilnehmer) = Σ  area_i · (überlappende_Tage_i / Tage_im_Zeitraum)
```

- Beispiel Lagerhalle 1000 m², Abrechnung 2026:
  - Mieter A: 200 m² ganzjährig → 200 · 365/365 = 200
  - Mieter B: 300 m² ab 01.07. → 300 · 184/365 ≈ 151,2
  - Leerstand: 500 m² ganzjährig + 300 m² Jan–Jun → variabel, Rest zu 1000
  - Die Summe der Gewichte entspricht immer 1000 m²·(anteilig) → Umlage geht auf.
- **Leerstandskosten** trägt der Eigentümer: separate Zeile in der Abrechnung
  (analog immoware „Leerstand VE01").

## UI (Vorschlag)

- Objekt-Einstellung: „Flächenmodell aktivieren" + `totalArea`.
- Auf der Einheit/dem Pool: Zeitstrahl der Teilflächen (Vertrag + Leerstand).
- Erfassungsdialog: „Fläche zubuchen/abgeben ab Datum".
- **Summenanzeige** wie MEA-Prüfung: `Σ belegt + leer = Gesamtfläche` mit ✓/✗
  und Button „Differenz automatisch als Leerstand buchen".

## Offene Fragen (an dich)

1. Gilt das **nur für Gewerbe** oder auch Wohnobjekte mit variabler Fläche?
2. Sollen Teilflächen an der **Einheit** hängen oder direkt am **Objekt-Pool**
   (Lagerhalle ohne feste Einheiten)?
3. Wird pro Teilfläche ein **eigener m²-Preis** gebraucht (Miete), oder nur für
   die NK-Umlage relevant?
4. Reicht **Tages**-Genauigkeit, oder werden Monatsscheiben gebraucht?

## Umsetzungsschritte (wenn abgestimmt)

1. Schema: `Property.totalArea/areaModel` + `AreaAllocation` + Migration.
2. `lib/allocation/area-time.ts`: m²·Tage-Gewichtung (reine Funktion + Tests).
3. `buildStatement` um Flächenmodell-Pfad erweitern (Leerstand als Teilnehmer).
4. UI: Pool-Einstellung, Teilflächen-Zeitstrahl, Zubuchen/Abgeben, Summen-Check.
5. Validierung + Tests (Summe = Gesamtfläche, unterjährige Änderung, Leerstand).
