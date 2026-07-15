import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.create({
    data: { name: "Muster Hausverwaltung GmbH" },
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "admin@havewa.de",
      name: "Admin",
      passwordHash: await bcrypt.hash("admin", 10),
      role: "ADMIN",
      locale: "de",
    },
  });

  // Mietobjekt
  const mietProp = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: "Wohnanlage Lindenstraße",
      street: "Lindenstraße 12",
      zip: "10115",
      city: "Berlin",
      type: "WOHNEN",
      management: "MIET",
      buildings: {
        create: {
          tenantId: tenant.id,
          name: "Haus A",
          units: {
            create: [
              { tenantId: tenant.id, label: "EG links", type: "WOHNUNG", area: 62.5, rooms: 2 },
              { tenantId: tenant.id, label: "EG rechts", type: "WOHNUNG", area: 74.0, rooms: 3 },
              { tenantId: tenant.id, label: "1. OG links", type: "WOHNUNG", area: 62.5, rooms: 2 },
              { tenantId: tenant.id, label: "Stellplatz 1", type: "STELLPLATZ", area: 12.0 },
            ],
          },
        },
      },
    },
    include: { buildings: { include: { units: true } } },
  });

  // WEG-Objekt
  const wegProp = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: "WEG Parkblick",
      street: "Am Park 5",
      zip: "80331",
      city: "München",
      type: "WOHNEN",
      management: "WEG",
      buildings: {
        create: {
          tenantId: tenant.id,
          name: "Hauptgebäude",
          units: {
            create: [
              { tenantId: tenant.id, label: "Whg 1", type: "WOHNUNG", area: 88.0, rooms: 3, mea: 340 },
              { tenantId: tenant.id, label: "Whg 2", type: "WOHNUNG", area: 95.0, rooms: 4, mea: 360 },
              { tenantId: tenant.id, label: "Whg 3", type: "WOHNUNG", area: 78.0, rooms: 3, mea: 300 },
            ],
          },
        },
      },
    },
    include: { buildings: { include: { units: true } } },
  });

  // Ein Mieter + Vertrag auf erster Einheit (Rest = Leerstand)
  const units = mietProp.buildings[0].units;
  const person = await prisma.person.create({
    data: { tenantId: tenant.id, firstName: "Erika", lastName: "Mustermann", email: "erika@example.de" },
  });
  const lease1 = await prisma.lease.create({
    data: {
      tenantId: tenant.id,
      unitId: units[0].id,
      startDate: new Date("2024-01-01"),
      rentCold: 780.0,
      personCount: 2,
      renters: { create: { tenantId: tenant.id, personId: person.id } },
      components: {
        create: [
          { tenantId: tenant.id, type: "NEBENKOSTEN", amount: 120.0 },
          { tenantId: tenant.id, type: "HEIZKOSTEN", amount: 90.0 },
        ],
      },
      deposit: { create: { tenantId: tenant.id, type: "BAR", amount: 2340.0, receivedDate: new Date("2024-01-05") } },
    },
  });

  // Portal-Mieter: User an Erika koppeln
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "mieter@havewa.de",
      name: "Erika Mustermann",
      passwordHash: await bcrypt.hash("mieter", 10),
      role: "MIETER",
      personId: person.id,
    },
  });

  // WEG-Eigentümer + Portal-User
  const owner = await prisma.person.create({
    data: { tenantId: tenant.id, firstName: "Klaus", lastName: "Eigner", email: "klaus@example.de" },
  });
  const wegUnit = wegProp.buildings[0].units[0];
  await prisma.owner.create({
    data: { tenantId: tenant.id, personId: owner.id, unitId: wegUnit.id, share: 1000 },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "eigentuemer@havewa.de",
      name: "Klaus Eigner",
      passwordHash: await bcrypt.hash("eigentuemer", 10),
      role: "EIGENTUEMER",
      personId: owner.id,
    },
  });

  // Zweiter Mieter + Vertrag (Auslastung > 1)
  const person2 = await prisma.person.create({
    data: { tenantId: tenant.id, firstName: "Max", lastName: "Schneider", email: "max@example.de", phone: "030 1234567" },
  });
  await prisma.lease.create({
    data: {
      tenantId: tenant.id,
      unitId: units[1].id,
      startDate: new Date("2023-06-01"),
      rentCold: 910.0,
      personCount: 3,
      renters: { create: { tenantId: tenant.id, personId: person2.id } },
      components: { create: [{ tenantId: tenant.id, type: "NEBENKOSTEN", amount: 150.0 }, { tenantId: tenant.id, type: "HEIZKOSTEN", amount: 110.0 }] },
    },
  });

  // Zähler + Stände (Wärme/Warmwasser) für HeizkostenV-Umlage im Abrechnungsjahr 2025
  for (const [i, u] of [units[0], units[1]].entries()) {
    for (const type of ["WAERME", "WASSER_WARM"] as const) {
      const base = type === "WAERME" ? 1200 : 40;
      const usage = type === "WAERME" ? 900 + i * 400 : 30 + i * 20;
      await prisma.meter.create({
        data: {
          tenantId: tenant.id,
          unitId: u.id,
          type,
          serialNo: `${type}-${1000 + i}`,
          readings: {
            create: [
              { tenantId: tenant.id, date: new Date("2025-01-01"), value: base },
              { tenantId: tenant.id, date: new Date("2025-12-31"), value: base + usage },
            ],
          },
        },
      });
    }
  }

  // Betriebskosten 2025 (inkl. Heizung → 30/70-Split)
  await prisma.costEntry.createMany({
    data: [
      { tenantId: tenant.id, propertyId: mietProp.id, year: 2025, type: "HEIZUNG", amount: 8400, method: "CONSUMPTION", umlagefaehig: true },
      { tenantId: tenant.id, propertyId: mietProp.id, year: 2025, type: "WASSER", amount: 2100, method: "PERSONS", umlagefaehig: true },
      { tenantId: tenant.id, propertyId: mietProp.id, year: 2025, type: "MUELL", amount: 1200, method: "UNITS", umlagefaehig: true },
      { tenantId: tenant.id, propertyId: mietProp.id, year: 2025, type: "GRUNDSTEUER", amount: 1800, method: "AREA", umlagefaehig: true },
      { tenantId: tenant.id, propertyId: mietProp.id, year: 2025, type: "VERSICHERUNG", amount: 1400, method: "AREA", umlagefaehig: true },
      { tenantId: tenant.id, propertyId: mietProp.id, year: 2025, type: "HAUSWART", amount: 2400, method: "AREA", umlagefaehig: false },
    ],
  });

  // Konto + Sollstellungen (bezahlt / offen / überfällig)
  const account = await prisma.account.create({
    data: { tenantId: tenant.id, name: "Mietkonto", type: "BANK", iban: "DE02120300000000202051" },
  });
  const paidCharge = await prisma.charge.create({
    data: { tenantId: tenant.id, leaseId: lease1.id, type: "MIETE", period: new Date("2026-06-01"), dueDate: new Date("2026-06-03"), amount: 990.0, description: "Miete Juni 2026" },
  });
  await prisma.payment.create({
    data: { tenantId: tenant.id, accountId: account.id, chargeId: paidCharge.id, date: new Date("2026-06-02"), amount: 990.0, direction: "EINGANG", reference: "Miete 06/2026" },
  });
  await prisma.charge.create({
    data: { tenantId: tenant.id, leaseId: lease1.id, type: "MIETE", period: new Date("2026-07-01"), dueDate: new Date("2026-07-03"), amount: 990.0, description: "Miete Juli 2026" },
  });
  const overdue = await prisma.charge.create({
    data: { tenantId: tenant.id, leaseId: lease1.id, type: "NEBENKOSTEN", period: new Date("2026-04-01"), dueDate: new Date("2026-04-15"), amount: 210.0, description: "NK-Nachzahlung 2025" },
  });
  await prisma.dunningNotice.create({
    data: { tenantId: tenant.id, chargeId: overdue.id, level: 1, fee: 5.0, note: "1. Mahnung" },
  });

  // SEPA-Mandat
  await prisma.sepaMandate.create({
    data: { tenantId: tenant.id, personId: person.id, iban: "DE02100100100006820101", mandateRef: "MND-0001", signedDate: new Date("2024-01-10") },
  });

  // Instandhaltung: Handwerker, Tickets, Wartung (eine überfällig)
  const contractor = await prisma.contractor.create({
    data: { tenantId: tenant.id, name: "Sanitär Berg GmbH", trade: "Sanitär/Heizung", email: "service@berg-shk.de", phone: "030 555123" },
  });
  await prisma.ticket.createMany({
    data: [
      { tenantId: tenant.id, propertyId: mietProp.id, unitId: units[0].id, contractorId: contractor.id, title: "Heizung wird nicht warm", description: "Thermostat prüfen", status: "IN_ARBEIT", priority: "HOCH" },
      { tenantId: tenant.id, propertyId: mietProp.id, title: "Treppenhauslicht defekt", status: "OFFEN", priority: "MITTEL" },
      { tenantId: tenant.id, propertyId: mietProp.id, unitId: units[1].id, title: "Fenster undicht", status: "OFFEN", priority: "NIEDRIG" },
    ],
  });
  await prisma.maintenanceContract.createMany({
    data: [
      { tenantId: tenant.id, propertyId: mietProp.id, contractorId: contractor.id, title: "Heizungswartung jährlich", intervalMonths: 12, nextDue: new Date("2026-06-01") },
      { tenantId: tenant.id, propertyId: mietProp.id, title: "Rauchmelder-Prüfung", intervalMonths: 12, nextDue: new Date("2026-09-15") },
    ],
  });

  // WEG: Wirtschaftsplan, Rücklage, Versammlung + Beschluss
  await prisma.economicPlan.create({
    data: { tenantId: tenant.id, propertyId: wegProp.id, year: 2026, totalAmount: 36000, note: "Wirtschaftsplan 2026" },
  });
  await prisma.costEntry.createMany({
    data: [
      { tenantId: tenant.id, propertyId: wegProp.id, year: 2025, type: "HAUSWART", amount: 6000, method: "MEA", umlagefaehig: true },
      { tenantId: tenant.id, propertyId: wegProp.id, year: 2025, type: "VERSICHERUNG", amount: 4200, method: "MEA", umlagefaehig: true },
      { tenantId: tenant.id, propertyId: wegProp.id, year: 2025, type: "GARTENPFLEGE", amount: 2400, method: "MEA", umlagefaehig: true },
    ],
  });
  const reserve = await prisma.reserve.create({
    data: { tenantId: tenant.id, propertyId: wegProp.id, name: "Erhaltungsrücklage" },
  });
  await prisma.reserveTransaction.createMany({
    data: [
      { tenantId: tenant.id, reserveId: reserve.id, date: new Date("2026-01-31"), amount: 12000, note: "Zuführung Jahresanfang" },
      { tenantId: tenant.id, reserveId: reserve.id, date: new Date("2026-05-20"), amount: -3500, note: "Dachreparatur" },
    ],
  });
  const meeting = await prisma.meeting.create({
    data: {
      tenantId: tenant.id,
      propertyId: wegProp.id,
      title: "Ordentliche Eigentümerversammlung 2026",
      date: new Date("2026-07-22"),
      location: "Gemeinschaftsraum, Am Park 5",
      status: "GEPLANT",
      agendaItems: {
        create: [
          { tenantId: tenant.id, position: 1, title: "Begrüßung und Feststellung der Beschlussfähigkeit" },
          { tenantId: tenant.id, position: 2, title: "Genehmigung der Jahresabrechnung 2025" },
          { tenantId: tenant.id, position: 3, title: "Beschluss Wirtschaftsplan 2026" },
          { tenantId: tenant.id, position: 4, title: "Fassadensanierung — Angebote" },
        ],
      },
    },
  });
  await prisma.resolution.create({
    data: {
      tenantId: tenant.id, propertyId: wegProp.id, meetingId: meeting.id, number: 1,
      title: "Genehmigung Jahresabrechnung 2025", text: "Die Jahresabrechnung 2025 wird genehmigt.",
      date: new Date("2026-07-22"), result: "ANGENOMMEN", votesYes: 3, votesNo: 0, votesAbstain: 0,
    },
  });

  // Kalender-Termine (aktueller Monat: Juli 2026)
  await prisma.appointment.createMany({
    data: [
      { tenantId: tenant.id, title: "Wohnungsübergabe EG rechts", type: "BESICHTIGUNG", start: new Date("2026-07-18T10:00:00Z"), location: "Lindenstraße 12", propertyId: mietProp.id },
      { tenantId: tenant.id, title: "Eigentümerversammlung Parkblick", type: "VERSAMMLUNG", start: new Date("2026-07-22T18:00:00Z"), location: "Am Park 5", propertyId: wegProp.id },
      { tenantId: tenant.id, title: "Heizungswartung", type: "WARTUNG", start: new Date("2026-07-25T09:00:00Z"), propertyId: mietProp.id },
      { tenantId: tenant.id, title: "Frist Betriebskostenabrechnung 2025", type: "FRIST", start: new Date("2026-07-31T00:00:00Z") },
    ],
  });

  // Dashboard-Aufgaben
  await prisma.task.createMany({
    data: [
      { tenantId: tenant.id, title: "Nebenkostenabrechnung 2025 versenden", dueDate: new Date("2026-07-31") },
      { tenantId: tenant.id, title: "Angebote Fassadensanierung einholen", dueDate: new Date("2026-08-10") },
      { tenantId: tenant.id, title: "Heizungswartung beauftragen" },
    ],
  });

  // Dokumente (inkl. E-Rechnung mit extrahierten Feldern)
  await prisma.document.createMany({
    data: [
      { tenantId: tenant.id, propertyId: mietProp.id, name: "Mietvertrag Mustermann.pdf", category: "VERTRAG", mime: "application/pdf", size: 245000, storageKey: "seed-vertrag.pdf" },
      { tenantId: tenant.id, propertyId: mietProp.id, name: "Heizkostenrechnung 2025 (ZUGFeRD)", category: "ERECHNUNG", mime: "application/xml", size: 18400, storageKey: "seed-erechnung.xml", eInvoice: true, invoiceNo: "RE-2026-0042", invoiceTotal: 8400.0 },
      { tenantId: tenant.id, propertyId: wegProp.id, name: "Protokoll ETV 2025.pdf", category: "PROTOKOLL", mime: "application/pdf", size: 512000, storageKey: "seed-protokoll.pdf" },
    ],
  });

  // Postausgang
  await prisma.emailMessage.createMany({
    data: [
      { tenantId: tenant.id, toAddress: "erika@example.de", subject: "Ihre Betriebskostenabrechnung 2025", body: "Sehr geehrte Frau Mustermann,\nanbei Ihre Abrechnung …", status: "GESENDET", sentAt: new Date("2026-07-14T08:30:00Z") },
      { tenantId: tenant.id, toAddress: "max@example.de", subject: "Zahlungserinnerung NK-Nachzahlung", body: "Sehr geehrter Herr Schneider,\nwir bitten um Ausgleich …", status: "ENTWURF" },
    ],
  });

  // Änderungsprotokoll (Beispiel-Historie)
  await prisma.auditLog.createMany({
    data: [
      { tenantId: tenant.id, userName: "Admin", action: "CREATE", entity: "Property", entityId: mietProp.id, summary: "Wohnanlage Lindenstraße", createdAt: new Date("2026-07-10T09:00:00Z") },
      { tenantId: tenant.id, userName: "Admin", action: "CREATE", entity: "Lease", summary: "Vertrag EG links — Mustermann", createdAt: new Date("2026-07-10T09:15:00Z") },
      { tenantId: tenant.id, userName: "Admin", action: "UPDATE", entity: "CostEntry", summary: "Heizkosten 2025 auf 8.400 € korrigiert", createdAt: new Date("2026-07-12T14:20:00Z") },
      { tenantId: tenant.id, userName: "Admin", action: "CREATE", entity: "Appointment", summary: "Eigentümerversammlung Parkblick", createdAt: new Date("2026-07-13T11:05:00Z") },
      { tenantId: tenant.id, userName: "Admin", action: "DELETE", entity: "Ticket", summary: "Doppeltes Ticket entfernt", createdAt: new Date("2026-07-14T16:40:00Z") },
    ],
  });

  console.log("Seed fertig. Admin: admin@havewa.de/admin · Mieter: mieter@havewa.de/mieter · Eigentümer: eigentuemer@havewa.de/eigentuemer");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
