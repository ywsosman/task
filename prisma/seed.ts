import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  for (const prefix of ["SVI", "SVO", "SVT"]) {
    await prisma.numberSequence.upsert({
      where: { prefix },
      update: {},
      create: { prefix, lastNo: 0 },
    });
  }

  const groups = [
    { code: "RAW", name: "Raw Materials" },
    { code: "FIN", name: "Finished Goods" },
    { code: "PKG", name: "Packaging" },
  ];
  for (const group of groups) {
    await prisma.group.upsert({ where: { code: group.code }, update: {}, create: group });
  }

  const units = [
    { code: "PCS", name: "Piece" },
    { code: "BX", name: "Box" },
    { code: "KG", name: "Kilogram" },
  ];
  for (const unit of units) {
    await prisma.unit.upsert({ where: { code: unit.code }, update: {}, create: unit });
  }

  const warehouses = [
    { store: "MAIN", name: "Main Warehouse" },
    { store: "NORTH", name: "North Branch" },
    { store: "SOUTH", name: "South Branch" },
  ];
  for (const warehouse of warehouses) {
    await prisma.warehouse.upsert({
      where: { store: warehouse.store },
      update: {},
      create: warehouse,
    });
  }

  const box = await prisma.unit.findUniqueOrThrow({ where: { code: "BX" } });
  const piece = await prisma.unit.findUniqueOrThrow({ where: { code: "PCS" } });
  const kilogram = await prisma.unit.findUniqueOrThrow({ where: { code: "KG" } });
  const raw = await prisma.group.findUniqueOrThrow({ where: { code: "RAW" } });
  const finished = await prisma.group.findUniqueOrThrow({ where: { code: "FIN" } });
  const packaging = await prisma.group.findUniqueOrThrow({ where: { code: "PKG" } });

  const products = [
    {
      sku: "SKU-1001",
      nameEn: "Olive Oil 1L",
      nameAr: "زيت زيتون 1 لتر",
      unitId: box.id,
      groupId: finished.id,
      unitCost: 50,
    },
    {
      sku: "SKU-1002",
      nameEn: "Sugar 25kg Sack",
      nameAr: "سكر كيس 25 كجم",
      unitId: kilogram.id,
      groupId: raw.id,
      unitCost: 30,
    },
    {
      sku: "SKU-1003",
      nameEn: "Cardboard Box Large",
      nameAr: "صندوق كرتون كبير",
      unitId: piece.id,
      groupId: packaging.id,
      unitCost: 5,
    },
  ];
  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }

  console.log("Seed complete: 3 groups, 3 units, 3 warehouses, 3 products.");
  console.log("Stock starts at zero - use the UI or the API to post an SVI voucher.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
