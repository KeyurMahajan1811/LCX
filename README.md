# LoanChallanX (LCX)

Web desk that replaces the WhatsApp handoff between Bank of Maharashtra officials and the vendor team while an RBI home-loan settlement challan is prepared.

Bank officials submit applicants and seven documents. The vendor mailbox shows every bank (the POC seeds only Bank of Maharashtra). Status labels flip with the viewer: the party who must act next sees **Action Required**. Documents stay in object storage with no expiry rules, including after completion or cancellation.

## Run locally

PostgreSQL and an S3-compatible store are required. This environment uses local Postgres and [s3rver](https://github.com/jamhall/s3rver) so presigned uploads work without AWS credentials. Production should point `S3_*` at AWS S3, Cloudflare R2, or similar, with no lifecycle delete rules.

```bash
cp .env.example .env
npm install
npm run s3
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://127.0.0.1:38421](http://127.0.0.1:38421).

Demo password for every seed user: `LCX-demo-2026`

- Bank official: `priya.kulkarni@mahabank.example` (also `amit.deshmukh@mahabank.example`)
- Vendor: `sandeep@loanchallanx.example` (also `neha.rao@loanchallanx.example`)

## Checks

```bash
npm test
npm run lint
```
