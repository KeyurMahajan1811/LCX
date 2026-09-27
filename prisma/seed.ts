import { DocumentType, PrismaClient } from "@prisma/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const pdf = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "S3RVER",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "S3RVER",
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const loanDocs: DocumentType[] = [
  "DOCUMENT_1",
  "DOCUMENT_2",
  "DOCUMENT_3",
  "DOCUMENT_4",
  "DOCUMENT_5",
  "DOCUMENT_6",
  "DOCUMENT_7",
];

async function store(key: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET || "lcx-documents",
      Key: key,
      Body: pdf,
      ContentType: "application/pdf",
    }),
  );
  return key;
}

async function main() {
  const password = await bcrypt.hash("LCX-demo-2026", 10);
  await prisma.actionMessage.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.document.deleteMany();
  await prisma.applicant.deleteMany();
  await prisma.loanRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.bank.deleteMany();

  const bank = await prisma.bank.create({ data: { name: "Bank of Maharashtra" } });
  const priya = await prisma.user.create({
    data: {
      name: "Priya Kulkarni",
      email: "priya.kulkarni@mahabank.example",
      passwordHash: password,
      role: "BANK_OFFICIAL",
      bankId: bank.id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Amit Deshmukh",
      email: "amit.deshmukh@mahabank.example",
      passwordHash: password,
      role: "BANK_OFFICIAL",
      bankId: bank.id,
    },
  });
  const sandeep = await prisma.user.create({
    data: {
      name: "Sandeep S.",
      email: "sandeep@loanchallanx.example",
      passwordHash: password,
      role: "VENDOR",
    },
  });
  await prisma.user.create({
    data: {
      name: "Neha Rao",
      email: "neha.rao@loanchallanx.example",
      passwordHash: password,
      role: "VENDOR",
    },
  });

  async function documentsFor(ownerId: string, prefix: string, extra?: { type: DocumentType; role: "BANK_OFFICIAL" | "VENDOR"; version: number }) {
    const rows = [];
    for (const type of loanDocs) {
      const key = await store(`seed/${prefix}/${type.toLowerCase()}.pdf`);
      rows.push({
        documentType: type,
        fileUrl: key,
        fileName: `${type.toLowerCase()}.pdf`,
        fileSizeKb: 1,
        uploadedById: ownerId,
        uploadedByRole: "BANK_OFFICIAL" as const,
        version: 1,
      });
    }
    if (extra) {
      const key = await store(`seed/${prefix}/${extra.type.toLowerCase()}-v${extra.version}.pdf`);
      rows.push({
        documentType: extra.type,
        fileUrl: key,
        fileName: `${extra.type.toLowerCase()}-v${extra.version}.pdf`,
        fileSizeKb: 1,
        uploadedById: extra.role === "VENDOR" ? sandeep.id : priya.id,
        uploadedByRole: extra.role,
        version: extra.version,
      });
    }
    return rows;
  }

  await prisma.loanRequest.create({
    data: {
      requestCode: "LCX-2026-00001",
      bankId: bank.id,
      createdById: priya.id,
      status: "PENDING_AT_VENDOR",
      applicantCount: 1,
      applicants: {
        create: {
          sequenceNo: 1,
          fullName: "Rajesh Patil",
          panCard: "ABCDE1234F",
          aadhaarCard: "123412341234",
          mobileNo: "9876543210",
          email: "rajesh.patil@example.com",
        },
      },
      documents: { create: await documentsFor(priya.id, "00001") },
      statusHistory: {
        create: {
          toStatus: "PENDING_AT_VENDOR",
          changedById: priya.id,
          changedByRole: "BANK_OFFICIAL",
          note: "Request submitted",
        },
      },
    },
  });

  await prisma.loanRequest.create({
    data: {
      requestCode: "LCX-2026-00002",
      bankId: bank.id,
      createdById: priya.id,
      status: "PENDING_AT_BANK",
      applicantCount: 2,
      applicants: {
        create: [
          {
            sequenceNo: 1,
            fullName: "Sunita Joshi",
            panCard: "PQRSX6789L",
            aadhaarCard: "567856785678",
            mobileNo: "9123456780",
            email: "sunita.joshi@example.com",
          },
          {
            sequenceNo: 2,
            fullName: "Manoj Joshi",
            panCard: "LMNOP2345K",
            aadhaarCard: "901290129012",
            mobileNo: "9988776655",
            email: "manoj.joshi@example.com",
          },
        ],
      },
      documents: { create: await documentsFor(priya.id, "00002") },
      actions: {
        create: {
          fromRole: "VENDOR",
          message: "RBI has asked for a clearer copy of Document 2.",
        },
      },
      statusHistory: {
        create: [
          {
            toStatus: "PENDING_AT_VENDOR",
            changedById: priya.id,
            changedByRole: "BANK_OFFICIAL",
            note: "Request submitted",
          },
          {
            fromStatus: "PENDING_AT_VENDOR",
            toStatus: "PENDING_AT_BANK",
            changedById: sandeep.id,
            changedByRole: "VENDOR",
            note: "RBI has asked for a clearer copy of Document 2.",
          },
        ],
      },
    },
  });

  await prisma.loanRequest.create({
    data: {
      requestCode: "LCX-2026-00003",
      bankId: bank.id,
      createdById: priya.id,
      status: "COMPLETED",
      applicantCount: 1,
      applicants: {
        create: {
          sequenceNo: 1,
          fullName: "Kavita More",
          panCard: "ZZZZZ9999Z",
          aadhaarCard: "111122223333",
          mobileNo: "9811111111",
          email: "kavita.more@example.com",
        },
      },
      documents: {
        create: await documentsFor(priya.id, "00003", { type: "FINAL_CHALLAN", role: "VENDOR", version: 1 }),
      },
      statusHistory: {
        create: [
          {
            toStatus: "PENDING_AT_VENDOR",
            changedById: priya.id,
            changedByRole: "BANK_OFFICIAL",
            note: "Request submitted",
          },
          {
            fromStatus: "PENDING_AT_VENDOR",
            toStatus: "COMPLETED",
            changedById: sandeep.id,
            changedByRole: "VENDOR",
            note: "Final challan uploaded",
          },
        ],
      },
    },
  });

  await prisma.loanRequest.create({
    data: {
      requestCode: "LCX-2026-00004",
      bankId: bank.id,
      createdById: priya.id,
      status: "CANCELLED",
      applicantCount: 1,
      applicants: {
        create: {
          sequenceNo: 1,
          fullName: "Imran Shaikh",
          panCard: "ABCDE9999A",
          aadhaarCard: "444455556666",
          mobileNo: "9765432109",
          email: "imran.shaikh@example.com",
        },
      },
      documents: { create: await documentsFor(priya.id, "00004") },
      actions: {
        create: { fromRole: "BANK_OFFICIAL", message: "Borrower withdrew the settlement." },
      },
      statusHistory: {
        create: [
          {
            toStatus: "PENDING_AT_VENDOR",
            changedById: priya.id,
            changedByRole: "BANK_OFFICIAL",
            note: "Request submitted",
          },
          {
            fromStatus: "PENDING_AT_VENDOR",
            toStatus: "CANCELLED",
            changedById: priya.id,
            changedByRole: "BANK_OFFICIAL",
            note: "Borrower withdrew the settlement.",
          },
        ],
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
