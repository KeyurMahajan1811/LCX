# Branding before production

- Replace the BoM placeholder mark with the official Bank of Maharashtra logo asset.
- The interface uses the modernized palette: Cyber Cobalt `#0066FF`, Electric Ice `#EBF3FF`, Ink Deep `#0B0F19`, Ghost White `#F4F6FA`, Glacial Border `#E4E9F2`, and Mint Glow `#00C48C`.
- Point `S3_*` at a real bucket (AWS S3, Cloudflare R2, or similar) with no lifecycle expiration or delete rules. Storage-class transitions are acceptable later. Deletion is not.
