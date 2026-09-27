import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertFileAllowed, safeFileName } from "@/lib/documents";

function client() {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: endpoint || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function bucket() {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET is not configured.");
  return name;
}

export function objectKeyFor(userId: string, fileName: string) {
  return `uploads/${userId}/${crypto.randomUUID()}/${safeFileName(fileName)}`;
}

export function ownsKey(userId: string, key: string) {
  return key.startsWith(`uploads/${userId}/`) && !key.includes("..");
}

export async function presignUpload(input: {
  userId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}) {
  assertFileAllowed(input.contentType, input.fileSizeBytes);
  const key = objectKeyFor(input.userId, input.fileName);
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.fileSizeBytes,
  });
  const url = await getSignedUrl(client(), command, { expiresIn: 300 });
  return { url, key };
}

export async function presignDownload(key: string) {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(client(), command, { expiresIn: 300 });
}

export async function assertStoredObject(key: string, maxBytes: number) {
  const head = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  const size = head.ContentLength ?? 0;
  if (size <= 0 || size > maxBytes) {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })).catch(() => undefined);
    throw new Error("The uploaded file is missing or larger than 2MB.");
  }
  return size;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
