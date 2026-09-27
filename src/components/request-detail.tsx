"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAadhaar, formatWhen } from "@/lib/dates";
import { DOCUMENT_LABELS, LOAN_DOCUMENT_TYPES, MAX_FILE_BYTES, type LoanDocumentType } from "@/lib/documents";
import type { AppRole, CanonicalStatus } from "@/lib/status";
import { uploadViaPresign } from "@/lib/upload-client";

type Detail = {
  id: string;
  requestCode: string;
  status: CanonicalStatus;
  createdAt: string;
  updatedAt: string;
  bankName: string;
  createdBy: string;
  applicants: { sequenceNo: number; fullName: string; panCard: string; aadhaarCard: string; mobileNo: string; email: string }[];
  documents: { id: string; documentType: string; fileName: string; fileSizeKb: number; version: number; uploadedByRole: string; uploadedAt: string }[];
  statusHistory: { id: string; fromStatus: string | null; toStatus: string; changedByRole: string; note: string | null; changedAt: string }[];
  actions: { id: string; fromRole: string; message: string; createdAt: string }[];
};

export function RequestDetail({ id, role }: { id: string; role: AppRole }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const response = await fetch(`/api/requests/${id}`);
      const body = (await response.json()) as { data?: Detail; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Could not load this request.");
      return body.data;
    },
  });
  const [note, setNote] = useState("");
  const [replacements, setReplacements] = useState<Partial<Record<LoanDocumentType, File>>>({});
  const [challan, setChallan] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const back = role === "VENDOR" ? "/vendor/mailbox" : "/bank/mailbox";

  async function refresh() {
    await client.invalidateQueries({ queryKey: ["request", id] });
    await client.invalidateQueries({ queryKey: ["requests"] });
  }

  async function download(docId: string) {
    const response = await fetch(`/api/requests/${id}/documents/${docId}/download`);
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) {
      toast.error(body.error || "Download failed.");
      return;
    }
    window.open(body.url, "_blank", "noopener,noreferrer");
  }

  async function saveDocument(file: File, documentType: string) {
    if (file.size > MAX_FILE_BYTES) throw new Error("Each file must be 2MB or smaller.");
    const stored = await uploadViaPresign(file);
    const response = await fetch(`/api/requests/${id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentType, ...stored }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(body.error || "Could not save the document.");
  }

  async function advance(intent: "advance" | "complete") {
    setBusy(true);
    setError(null);
    try {
      if (intent === "advance" && note.trim().length < 5) throw new Error("Write at least a short note.");
      if (role === "BANK_OFFICIAL") {
        for (const type of LOAN_DOCUMENT_TYPES) {
          const file = replacements[type];
          if (file) await saveDocument(file, type);
        }
      }
      if (intent === "complete") {
        if (!challan) throw new Error("Choose the final challan file.");
        await saveDocument(challan, "FINAL_CHALLAN");
      }
      if (intent === "advance") {
        const message = await fetch(`/api/requests/${id}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: note.trim() }),
        });
        const messageBody = (await message.json()) as { error?: string };
        if (!message.ok) throw new Error(messageBody.error || "Could not save the note.");
      }
      const status = await fetch(`/api/requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, note: note.trim() || undefined }),
      });
      const statusBody = (await status.json()) as { error?: string };
      if (!status.ok) throw new Error(statusBody.error || "Could not update the status.");
      toast.success(intent === "complete" ? "Request completed." : "Request sent back.");
      setNote("");
      setReplacements({});
      setChallan(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/requests/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not cancel.");
      toast.success("Request cancelled. The documents stay on file.");
      setCancelOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed.");
    } finally {
      setBusy(false);
    }
  }

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading the request…</p>;
  if (query.isError || !query.data) return <p className="text-sm text-destructive">{(query.error as Error)?.message || "Not found."}</p>;
  const request = query.data;
  const open = request.status === "PENDING_AT_VENDOR" || request.status === "PENDING_AT_BANK";
  const myTurn =
    (role === "VENDOR" && request.status === "PENDING_AT_VENDOR") ||
    (role === "BANK_OFFICIAL" && request.status === "PENDING_AT_BANK");

  return (
    <div className="space-y-4">
      <Link href={back} className="text-sm text-muted-foreground hover:text-foreground">
        Back to mailbox
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{request.requestCode}</h1>
          <p className="text-sm text-muted-foreground">
            {request.bankName} · opened by {request.createdBy} · {formatWhen(request.createdAt)}
          </p>
        </div>
        <StatusBadge status={request.status} role={role} />
      </div>

      <Panel title="Applicants">
        <div className="grid gap-3 md:grid-cols-2">
          {request.applicants.map((applicant) => (
            <div key={applicant.sequenceNo} className="rounded-lg bg-accent p-3 text-sm">
              <div className="font-medium">Applicant {applicant.sequenceNo}</div>
              <div>{applicant.fullName}</div>
              <div className="text-muted-foreground">PAN {applicant.panCard}</div>
              <div className="text-muted-foreground">Aadhaar {formatAadhaar(applicant.aadhaarCard)}</div>
              <div className="text-muted-foreground">{applicant.mobileNo} · {applicant.email}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Documents">
        <ul className="divide-y divide-border text-sm">
          {request.documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium">
                  {DOCUMENT_LABELS[document.documentType] ?? document.documentType} · v{document.version}
                </div>
                <div className="text-xs text-muted-foreground">
                  {document.fileName} · {document.fileSizeKb} KB · {document.uploadedByRole} · {formatWhen(document.uploadedAt)}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => download(document.id)}>
                Download
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Status history">
          <ol className="space-y-3 text-sm">
            {request.statusHistory.map((entry) => (
              <li key={entry.id}>
                <div className="font-medium">
                  {entry.fromStatus ? `${entry.fromStatus} → ` : ""}
                  {entry.toStatus}
                </div>
                <div className="text-xs text-muted-foreground">
                  {entry.changedByRole} · {formatWhen(entry.changedAt)}
                </div>
                {entry.note && <p className="mt-1">{entry.note}</p>}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Messages">
          {request.actions.length === 0 && <p className="text-sm text-muted-foreground">No queries yet.</p>}
          <ul className="space-y-3 text-sm">
            {request.actions.map((action) => (
              <li key={action.id} className="rounded-lg bg-accent p-3">
                <div className="text-xs text-muted-foreground">
                  {action.fromRole} · {formatWhen(action.createdAt)}
                </div>
                <p className="mt-1">{action.message}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {myTurn && role === "VENDOR" && (
        <Panel title="Your turn">
          <div className="space-y-3">
            <Label htmlFor="query">Query for the bank</Label>
            <textarea id="query" value={note} onChange={(event) => setNote(event.target.value)} className="min-h-24 w-full rounded-lg border border-input bg-white p-2 text-sm" placeholder="What did RBI ask for?" />
            <Button disabled={busy} onClick={() => advance("advance")}>
              Raise query
            </Button>
            <div className="border-t border-border pt-3">
              <Label htmlFor="challan">Final challan</Label>
              <Input id="challan" type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1" onChange={(event) => setChallan(event.target.files?.[0] ?? null)} />
              <Button className="mt-2" disabled={busy} onClick={() => advance("complete")}>
                Upload final challan and complete
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {myTurn && role === "BANK_OFFICIAL" && (
        <Panel title="Your turn">
          <div className="space-y-3">
            <Label htmlFor="reply">Reply to the vendor</Label>
            <textarea id="reply" value={note} onChange={(event) => setNote(event.target.value)} className="min-h-24 w-full rounded-lg border border-input bg-white p-2 text-sm" />
            <p className="text-xs text-muted-foreground">Replace any document RBI asked for. Older versions stay on the request.</p>
            {LOAN_DOCUMENT_TYPES.map((type) => (
              <label key={type} className="block text-xs text-muted-foreground">
                {DOCUMENT_LABELS[type]}
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setReplacements((current) => ({ ...current, [type]: file }));
                }} />
              </label>
            ))}
            <Button disabled={busy} onClick={() => advance("advance")}>
              Send documents back
            </Button>
          </div>
        </Panel>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {open && (
        <Button variant="destructive" onClick={() => setCancelOpen(true)}>
          Cancel request
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {request.requestCode}?</DialogTitle>
            <DialogDescription>The request stays in both mailboxes and every document remains downloadable.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="reason">Reason</Label>
          <textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-20 w-full rounded-lg border border-input p-2 text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep it open
            </Button>
            <Button variant="destructive" disabled={busy} onClick={cancel}>
              Cancel request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}
