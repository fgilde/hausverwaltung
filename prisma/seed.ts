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
  await prisma.lease.create({
    data: {
      tenantId: tenant.id,
      unitId: units[0].id,
      startDate: new Date("2024-01-01"),
      rentCold: 780.0,
      renters: { create: { tenantId: tenant.id, personId: person.id } },
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

  console.log("Seed fertig. Admin: admin@havewa.de/admin · Mieter: mieter@havewa.de/mieter · Eigentümer: eigentuemer@havewa.de/eigentuemer");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
