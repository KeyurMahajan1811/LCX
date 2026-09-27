"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOCUMENT_LABELS, LOAN_DOCUMENT_TYPES, MAX_APPLICANTS, MAX_FILE_BYTES, type LoanDocumentType } from "@/lib/documents";
import { uploadViaPresign } from "@/lib/upload-client";
import { applicantsSchema } from "@/lib/validators";

type ApplicantValues = {
  applicants: { fullName: string; panCard: string; aadhaarCard: string; mobileNo: string; email: string }[];
};

const blank = () => ({ fullName: "", panCard: "", aadhaarCard: "", mobileNo: "", email: "" });

export function NewRequestForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [count, setCount] = useState(1);
  const [files, setFiles] = useState<Partial<Record<LoanDocumentType, File>>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ApplicantValues>({
    resolver: zodResolver(applicantsSchema),
    defaultValues: { applicants: [blank()] },
  });
  const fields = useFieldArray({ control: form.control, name: "applicants" });

  function changeCount(next: number) {
    setCount(next);
    const current = form.getValues("applicants");
    form.setValue(
      "applicants",
      Array.from({ length: next }, (_, index) => current[index] ?? blank()),
    );
  }

  async function goToDocuments() {
    const valid = await form.trigger();
    if (!valid) return;
    setStep(3);
  }

  function chooseFile(type: LoanDocumentType, file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setFileError("Only PDF, JPG, and PNG files are accepted.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("Each file must be 2MB or smaller.");
      return;
    }
    setFiles((current) => ({ ...current, [type]: file }));
  }

  async function submit() {
    if (LOAN_DOCUMENT_TYPES.some((type) => !files[type])) {
      setFileError("Attach all seven documents before submitting.");
      return;
    }
    setSubmitting(true);
    setFileError(null);
    try {
      const documents = [];
      for (const type of LOAN_DOCUMENT_TYPES) {
        const file = files[type];
        if (!file) continue;
        setProgress(`Uploading ${DOCUMENT_LABELS[type]}…`);
        const stored = await uploadViaPresign(file);
        documents.push({ documentType: type, ...stored });
      }
      setProgress("Creating the request…");
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicants: form.getValues("applicants"), documents }),
      });
      const body = (await response.json()) as { requestCode?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not create the request.");
      toast.success(`Request ${body.requestCode} is with the vendor.`);
      router.push("/bank/mailbox");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Submit failed.");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Submit new request</h1>
        <p className="mt-1 text-sm text-muted-foreground">Step {step} of 4. All fields and the seven documents are required.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        {step === 1 && (
          <div className="max-w-sm space-y-3">
            <Label htmlFor="count">Number of applicants</Label>
            <select
              id="count"
              className="h-9 w-full rounded-lg border border-input bg-white px-2 text-sm"
              value={count}
              onChange={(event) => changeCount(Number(event.target.value))}
            >
              {Array.from({ length: MAX_APPLICANTS }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
            <Button onClick={() => setStep(2)}>Continue</Button>
          </div>
        )}
        {step === 2 && (
          <form className="space-y-6" onSubmit={form.handleSubmit(() => setStep(3))}>
            {fields.fields.map((field, index) => (
              <fieldset key={field.id} className="space-y-3 border-t border-border pt-4 first:border-0 first:pt-0">
                <legend className="text-sm font-medium">Applicant {index + 1}</legend>
                <Field label="Full name" error={form.formState.errors.applicants?.[index]?.fullName?.message}>
                  <Input {...form.register(`applicants.${index}.fullName`)} />
                </Field>
                <Field label="PAN card number" error={form.formState.errors.applicants?.[index]?.panCard?.message}>
                  <Input {...form.register(`applicants.${index}.panCard`)} className="uppercase" placeholder="ABCDE1234F" />
                </Field>
                <Field label="Aadhaar card number" error={form.formState.errors.applicants?.[index]?.aadhaarCard?.message}>
                  <Input
                    inputMode="numeric"
                    value={formatGroups(form.watch(`applicants.${index}.aadhaarCard`) ?? "")}
                    onChange={(event) =>
                      form.setValue(`applicants.${index}.aadhaarCard`, event.target.value.replace(/\D/g, "").slice(0, 12), {
                        shouldValidate: true,
                      })
                    }
                    placeholder="XXXX XXXX XXXX"
                  />
                </Field>
                <Field label="Mobile number" error={form.formState.errors.applicants?.[index]?.mobileNo?.message}>
                  <Input {...form.register(`applicants.${index}.mobileNo`)} inputMode="numeric" />
                </Field>
                <Field label="Email" error={form.formState.errors.applicants?.[index]?.email?.message}>
                  <Input type="email" {...form.register(`applicants.${index}.email`)} />
                </Field>
              </fieldset>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" onClick={goToDocuments}>
                Continue
              </Button>
            </div>
          </form>
        )}
        {step === 3 && (
          <div className="space-y-4">
            {LOAN_DOCUMENT_TYPES.map((type) => (
              <div key={type} className="grid gap-2 border-t border-border pt-3 first:border-0 first:pt-0 md:grid-cols-[180px_1fr]">
                <Label>
                  {DOCUMENT_LABELS[type]} <span className="text-destructive">*</span>
                </Label>
                <div>
                  <select className="mb-2 h-8 rounded-lg border border-input bg-white px-2 text-sm" value={type} disabled>
                    <option value={type}>{DOCUMENT_LABELS[type]}</option>
                  </select>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => chooseFile(type, event.target.files?.[0])} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {files[type] ? `${files[type]?.name} · ready` : "PDF, JPG, or PNG. 2MB maximum."}
                  </p>
                </div>
              </div>
            ))}
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={() => {
                  if (LOAN_DOCUMENT_TYPES.some((type) => !files[type])) {
                    setFileError("Attach all seven documents before submitting.");
                    return;
                  }
                  setStep(4);
                }}
              >
                Review
              </Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-4">
            {form.getValues("applicants").map((applicant, index) => (
              <div key={index} className="text-sm">
                <div className="font-medium">Applicant {index + 1}</div>
                <div>{applicant.fullName}</div>
                <div className="text-muted-foreground">{applicant.email} · {applicant.mobileNo}</div>
              </div>
            ))}
            <ul className="text-sm">
              {LOAN_DOCUMENT_TYPES.map((type) => (
                <li key={type}>
                  {DOCUMENT_LABELS[type]}: {files[type]?.name}
                </li>
              ))}
            </ul>
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} disabled={submitting}>
                Back
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>
        {label} <span className="text-destructive">*</span>
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function formatGroups(digits: string) {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
