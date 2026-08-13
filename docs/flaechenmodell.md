# Flächenmodell — Spec (abgestimmt)

_Status: abgestimmt (Antworten eingearbeitet), bereit zur Umsetzung._

## Problem

Aktuell hat jede Einheit (`Unit`) **eine feste Fläche** (`Unit.area`). Für
**Gewerbeobjekte** (z. B. Lagerhalle) passt das nicht: Dort wird **Fläche in m²**
aus einem Gesamtpool vermietet, die sich **unterjährig ändert** (Mieter bucht
dazu / gibt ab), und ein Teil steht **leer**. Schmerzpunkt: *„Die Summe stimmt
nie."* — belegte + leere Fläche ergibt nicht die Gesamtfläche, die
Betriebskosten-Umlage wird falsch.

## Entscheidungen (abgestimmt)

1. **Nur Gewerbe.** Wohnobjekte behalten die feste `Unit.area`. Aktivierung je Objekt.
2. **Teilflächen hängen direkt am Objekt-Pool** (keine festen Einheiten nötig).
   Summe der Teilflächen darf die **Objekt-Gesamtfläche nicht übersteigen**.
3. **Außenstellplätze** (o. Ä.) werden **separat** ausgewiesen und **dürfen** die
   Gesamtfläche übersteigen. NK-Umlage bemisst sich an den **Objekt-m²**, NICHT an
   Gesamt inkl. Außenflächen.
4. **Eigener m²-Preis je Teilfläche** möglich (Miete). Die **NK-Umlage** erfolgt
   ausschließlich nach **m²** (nicht nach Preis).
5. **Granularität:** monatlich/halbmonatlich genügt; tagesgenau als Option
   (intern rechnen wir tagesgenau, UI erfasst Monatsscheiben).
6. **Leerstand** wird automatisch als eigener Posten geführt → Summe = Gesamtfläche
   zu jedem Zeitpunkt; Leerstandskosten trägt der Eigentümer.

## Datenmodell (additiv, rückwärtskompatibel)

```
Property.totalArea    Decimal?   // Gesamtfläche des Pools (Gewerbe)
Property.areaModel    Boolean @default(false)  // Flächenmodell aktiv

model AreaAllocation {           // Teilfläche über Zeit (am Objekt-Pool)
  id          String
  tenantId    String
  propertyId  String             // Pool
  leaseId     String?            // zugeordneter Vertrag; null = Leerstand
  label       String?            // z. B. "Halle Nord", "Außenstellplatz 3"
  area        Decimal            // m²
  pricePerSqm Decimal?           // eigener Miet-m²-Preis (optional)
  outdoor     Boolean @default(false)  // Außenfläche: zählt NICHT zur Pool-Summe/NK
  from        DateTime
  to          DateTime?          // offen = bis auf Weiteres
}
```

- Ein Vertrag kann **mehrere** `AreaAllocation`-Zeilen haben (Nachbuchungen).
- **Leerstand** = automatisch gepflegte Zeilen mit `leaseId = null`, sodass zu
  jedem Zeitpunkt `Σ area (nicht-outdoor) = Property.totalArea`.
- `outdoor`-Zeilen sind reine Miet-/Ausweiszeilen, gehen **nicht** in NK-Umlage
  und nicht in die Pool-Summenprüfung ein.

## Umlage-Logik (m²·Tage)

Die Verteilerschlüssel-Engine (`lib/allocation`) kennt bereits `timeFactor` (0..1).
Neu: `lib/allocation/area-time.ts` bildet je Teilnehmer das **Flächen-Zeit-Integral**:

```
gewicht(teilnehmer) = Σ  area_i · (überlappende_Tage_i / Tage_im_Zeitraum)
```

Beispiel Lagerhalle 1000 m², Abrechnung 2026:
- Mieter A: 200 m² ganzjährig → 200 · 365/365 = 200
- Mieter B: 300 m² ab 01.07. → 300 · 184/365 ≈ 151,2
- Leerstand: Rest, sodass Σ = 1000 (·anteilig) → Umlage geht immer auf.

Leerstand ist ein eigener Teilnehmer (Eigentümer). Reine Funktion → voll testbar.

## Miete (Sollstellung)

- Kaltmiete je Vertrag = Σ (`area_i · pricePerSqm_i`) der aktiven Teilflächen
  (inkl. Außen). Fällt in den bestehenden Sollstellungslauf.
- Ändert sich eine Teilfläche unterjährig, wird die Sollstellung ab dem
  Wirksamkeitsmonat neu berechnet (Monatsscheibe).

## Leerstand ↔ Mietinteressenten (Leasing-Pipeline)

Separates, kleineres Feature (kann parallel/danach):
- Ansicht „Leerstand": aktueller **und künftiger** Leerstand (aus `to`-Daten der
  Teilflächen bzw. auslaufender Verträge).
- Gegenüberstellung mit `Person.type = INTERESSENT` (Adressbuch) inkl. gesuchter
  Fläche → Vorschlag „vor Übergabe weitervermieten" (nahtlos, ohne Leerstands-Lücke).

## UI

- Objekt-Einstellung: „Flächenmodell aktivieren" + `totalArea` (nur bei Gewerbe).
- Objekt-Detail: Zeitstrahl/Tabelle der Teilflächen (Vertrag + Leerstand + Außen),
  Summen-Check `Σ Pool = Gesamtfläche` mit ✓/✗ (wie MEA-Prüfung) + Button
  „Differenz als Leerstand buchen".
- Dialog „Fläche zubuchen/abgeben ab Datum" (Monatswahl), optional m²-Preis.

## Umsetzungsschritte

1. Schema: `Property.totalArea/areaModel` + `AreaAllocation` + Migration.
2. `lib/allocation/area-time.ts`: m²·Tage-Gewichtung (reine Funktion + Tests:
   ganzjährig, unterjähriger Wechsel, Leerstand-Rest, Außen ausgeschlossen).
3. `buildStatement` um Flächenmodell-Pfad erweitern (Leerstand als Teilnehmer,
   NK nur Pool-m²).
4. Sollstellung: Miete aus m²·Preis je Teilfläche (Monatsscheibe).
5. UI: Pool-Einstellung, Teilflächen-Tabelle, Zubuchen/Abgeben, Summen-Check.
6. Leasing-Pipeline (Leerstand ↔ Interessenten) als Folgeschritt.
7. Validierung + Tests durchgängig.
