export async function uploadViaPresign(file: File) {
  const response = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSizeBytes: file.size,
    }),
  });
  const body = (await response.json()) as { url?: string; key?: string; error?: string };
  if (!response.ok || !body.url || !body.key) throw new Error(body.error || "Could not start the upload.");
  const put = await fetch(body.url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed for ${file.name}.`);
  return {
    fileKey: body.key,
    fileName: file.name,
    fileSizeKb: Math.max(1, Math.ceil(file.size / 1024)),
  };
}
