import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join(__dirname, "data", "vaccines.json");
    const file = fs.readFileSync(filePath, "utf-8");
    const vaccines = JSON.parse(file);

    await prisma.vaccineCatalog.createMany({
        data: vaccines,
        skipDuplicates: true,
    });

    console.log("✅ VaccineCatalog seed completed");
}

main()
    .catch((e) => {
        console.error("❌ Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
