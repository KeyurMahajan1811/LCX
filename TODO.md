# Branding before production

- Replace the BoM placeholder mark with the official Bank of Maharashtra logo asset.
- Confirm the exact brand hex codes. The POC uses approximate maroon `#7A0C2E` and gold `#D9A441`.
- Point `S3_*` at a real bucket (AWS S3, Cloudflare R2, or similar) with no lifecycle expiration or delete rules. Storage-class transitions are acceptable later. Deletion is not.
