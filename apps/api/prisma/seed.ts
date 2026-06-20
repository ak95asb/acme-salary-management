import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const DEPARTMENTS = [
  "Engineering", "Product", "Design", "Sales", "Marketing", "Finance",
  "HR", "Operations", "Customer Success", "Legal", "Data Science",
  "DevOps", "QA", "Support", "Business Development",
];

const COUNTRIES = ["US", "IN", "GB", "DE", "CA", "AU", "FR", "SG", "JP", "BR", "NL", "SE", "PL", "MX", "ZA"];

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  US: "USD", IN: "INR", GB: "GBP", DE: "EUR", CA: "CAD", AU: "AUD",
  FR: "EUR", SG: "SGD", JP: "JPY", BR: "BRL", NL: "EUR", SE: "SEK",
  PL: "PLN", MX: "MXN", ZA: "ZAR",
};

const SALARY_RANGE: Record<string, [number, number]> = {
  Engineering: [80000, 200000], Product: [90000, 190000], Design: [70000, 150000],
  Sales: [60000, 180000], Marketing: [55000, 130000], Finance: [70000, 160000],
  HR: [50000, 110000], Operations: [45000, 100000], "Customer Success": [45000, 90000],
  Legal: [90000, 200000], "Data Science": [85000, 210000], DevOps: [80000, 180000],
  QA: [60000, 130000], Support: [35000, 75000], "Business Development": [65000, 160000],
};

const JOB_TITLES: Record<string, string[]> = {
  Engineering: ["Software Engineer", "Senior Engineer", "Staff Engineer", "Principal Engineer", "Engineering Manager"],
  Product: ["Product Manager", "Senior PM", "Principal PM", "Director of Product"],
  Design: ["UX Designer", "UI Designer", "Product Designer", "Design Lead"],
  Sales: ["SDR", "Account Executive", "Senior AE", "Sales Manager", "VP Sales"],
  Marketing: ["Marketing Specialist", "Content Manager", "Growth Manager", "Marketing Director"],
  Finance: ["Financial Analyst", "Senior Analyst", "Finance Manager", "Controller"],
  HR: ["HR Specialist", "HR Business Partner", "Recruiter", "HR Manager"],
  Operations: ["Operations Analyst", "Operations Manager", "Director Operations"],
  "Customer Success": ["CSM", "Senior CSM", "CS Manager", "VP Customer Success"],
  Legal: ["Legal Counsel", "Senior Counsel", "VP Legal", "General Counsel"],
  "Data Science": ["Data Analyst", "Data Scientist", "Senior Data Scientist", "ML Engineer"],
  DevOps: ["DevOps Engineer", "Senior DevOps", "SRE", "Platform Engineer"],
  QA: ["QA Engineer", "Senior QA", "QA Lead", "QA Manager"],
  Support: ["Support Specialist", "Senior Support", "Support Lead"],
  "Business Development": ["BD Manager", "Senior BD", "Partnerships Manager"],
};

const FIRST_NAMES = [
  "Emma","Liam","Olivia","Noah","Ava","Ethan","Sophia","Mason","Isabella","James",
  "Mia","Benjamin","Charlotte","Lucas","Amelia","Henry","Harper","Alexander","Evelyn","Michael",
  "Abigail","Daniel","Emily","Matthew","Elizabeth","Owen","Avery","Aiden","Sofia","Sebastian",
  "Ella","Jack","Madison","Samuel","Scarlett","David","Victoria","Carter","Aria","Wyatt",
  "Aarav","Aisha","Arjun","Fatima","Muhammad","Yuki","Kenji","Priya","Rahul","Wei",
  "Lin","Chen","Mei","Yuna","Soo","Min","Ji","Hyun","Tae","Jae",
  "Dmitri","Anastasia","Nikolai","Ivan","Katya","Sergio","Maria","Carlos","Ana","Ahmed",
  "Sara","Hassan","Nadia","Omar","Leila","Kaveh","Zara","Ravi","Sunita","Grace",
  "Riley","Ryan","Layla","Nathan","Leo","Julian","Grayson","Penelope","Chloe","Ella",
  "Sofia","Aria","Scarlett","Violet","Aurora","Madison","Luna","Stella","Zoey","Nora",
];

const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Wilson","Taylor",
  "Anderson","Thomas","Jackson","White","Harris","Martin","Thompson","Young","Allen","King",
  "Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker",
  "Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Gonzalez","Lopez","Perez","Turner",
  "Kumar","Sharma","Patel","Singh","Gupta","Das","Mehta","Nair","Iyer","Reddy",
  "Chen","Wang","Li","Zhang","Liu","Yang","Huang","Wu","Zhou","Sun",
  "Kim","Lee","Park","Choi","Jung","Kang","Cho","Yoon","Lim","Han",
  "Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann",
  "Silva","Santos","Oliveira","Costa","Ferreira","Souza","Rodrigues","Almeida","Carvalho","Gomes",
  "Martinez","Rodriguez","Fernandez","Sanchez","Ramirez","Cruz","Morales","Reyes","Vargas","Castro",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
  console.log("Starting seed...");

  const users = [
    { email: "admin@acme.com", password: "Admin@12345", role: "SYSTEM_ADMIN", label: "SYSTEM_ADMIN" },
    { email: "hradmin@acme.com", password: "HrAdmin@12345", role: "HR_ADMIN", label: "HR_ADMIN" },
    { email: "viewer@acme.com", password: "Viewer@12345", role: "HR_VIEWER", label: "HR_VIEWER" },
  ];

  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
      await prisma.user.create({
        data: { email: u.email, passwordHash: await bcrypt.hash(u.password, 12), role: u.role, isActive: true },
      });
      console.log(`  Created ${u.label}: ${u.email} / ${u.password}`);
    }
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@acme.com" } });

  const settings = [
    { key: "salary_alert_threshold_pct", value: "50" },
    { key: "audit_retention_days", value: "365" },
    { key: "s3_archive_bucket", value: "" },
    { key: "s3_archive_prefix", value: "audit-archive/" },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log("  System settings upserted.");

  const TOTAL = 10_000;
  const BATCH = 500;
  const existing = await prisma.employee.count();

  if (existing >= TOTAL) {
    console.log(`  Already have ${existing} employees, skipping.`);
  } else {
    console.log(`  Seeding ${TOTAL} employees in batches of ${BATCH}...`);
    const startDate = new Date("2010-01-01");
    const endDate = new Date("2024-12-31");

    for (let b = 0; b < TOTAL / BATCH; b++) {
      const employeeRows: Array<{
        employeeCode: string;
        firstName: string;
        lastName: string;
        email: string;
        department: string;
        jobTitle: string;
        country: string;
        status: string;
        startDate: Date;
      }> = [];

      const salaryMeta: Array<{
        code: string;
        amount: string;
        currencyCode: string;
        payFrequency: string;
        startDate: Date;
      }> = [];

      for (let i = 0; i < BATCH; i++) {
        const idx = b * BATCH + i + 1;
        const firstName = pick(FIRST_NAMES);
        const lastName = pick(LAST_NAMES);
        const department = pick(DEPARTMENTS);
        const country = pick(COUNTRIES);
        const jobTitle = pick(JOB_TITLES[department] ?? ["Specialist"]);
        const empStartDate = randomDate(startDate, endDate);
        const status = Math.random() > 0.08 ? "ACTIVE" : "INACTIVE";
        const [min, max] = SALARY_RANGE[department] ?? [40000, 120000];
        const amount = randomInt(min, max);
        const currencyCode = CURRENCY_BY_COUNTRY[country] ?? "USD";
        const code = `EMP${String(idx).padStart(6, "0")}`;

        employeeRows.push({
          employeeCode: code,
          firstName,
          lastName,
          email: `${firstName.toLowerCase().replace(/[^a-z]/g, "")}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}.${idx}@acme-corp.com`,
          department,
          jobTitle,
          country,
          status,
          startDate: empStartDate,
        });

        salaryMeta.push({
          code,
          amount: String(amount),
          currencyCode,
          payFrequency: Math.random() > 0.3 ? "ANNUAL" : "MONTHLY",
          startDate: empStartDate,
        });
      }

      await prisma.employee.createMany({ data: employeeRows });

      const codes = employeeRows.map((e) => e.employeeCode);
      const created = await prisma.employee.findMany({
        where: { employeeCode: { in: codes } },
        select: { id: true, employeeCode: true },
      });
      const codeToId = new Map(created.map((e) => [e.employeeCode, e.id]));

      const salaryRows = salaryMeta
        .map((s) => {
          const empId = codeToId.get(s.code);
          if (!empId) return null;
          return {
            employeeId: empId,
            amount: s.amount,
            currencyCode: s.currencyCode,
            payFrequency: s.payFrequency,
            effectiveDate: s.startDate,
            createdBy: admin.id,
          };
        })
        .filter(Boolean) as Array<{
          employeeId: string;
          amount: string;
          currencyCode: string;
          payFrequency: string;
          effectiveDate: Date;
          createdBy: string;
        }>;

      await prisma.salaryRecord.createMany({ data: salaryRows });

      if ((b + 1) % 4 === 0) {
        console.log(`    → ${(b + 1) * BATCH} / ${TOTAL}`);
      }
    }
    console.log(`  Done! Seeded ${TOTAL} employees.`);
  }

  console.log("\nSeed complete.");
  console.log("Credentials:");
  console.log("  admin@acme.com     / Admin@12345    (SYSTEM_ADMIN)");
  console.log("  hradmin@acme.com   / HrAdmin@12345  (HR_ADMIN)");
  console.log("  viewer@acme.com    / Viewer@12345   (HR_VIEWER)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
