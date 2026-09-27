import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import S3rver from "s3rver";

const directory = process.env.S3_DATA_DIR || "/tmp/lcx-object-store";
fs.mkdirSync(directory, { recursive: true });
const cors = path.join(path.dirname(fileURLToPath(import.meta.url)), "s3-cors.xml");

const server = new S3rver({
  port: Number(process.env.S3_PORT || 4569),
  address: "0.0.0.0",
  silent: false,
  directory,
  resetOnClose: false,
  allowMismatchedSignatures: false,
  configureBuckets: [
    {
      name: process.env.S3_BUCKET || "lcx-documents",
      configs: [fs.readFileSync(cors)],
    },
  ],
});

server.run().then(() => {
  console.log(`Object store listening on ${process.env.S3_PORT || 4569}`);
});
