"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { formatWhen } from "@/lib/dates";
import { DOCUMENT_LABELS } from "@/lib/documents";
import type { AppRole, CanonicalStatus } from "@/lib/status";

type Doc = { id: string; documentType: string; fileName: string; version: number };
type Row = {
  id: string;
  requestCode: string;
  status: CanonicalStatus;
  createdAt: string;
  updatedAt: string;
  bankName: string;
  applicantLabel: string;
  documents: Doc[];
};

async function downloadDocument(requestId: string, docId: string) {
  const response = await fetch(`/api/requests/${requestId}/documents/${docId}/download`);
  const body = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !body.url) return;
  window.open(body.url, "_blank", "noopener,noreferrer");
}

async function loadRequests(): Promise<Row[]> {
  const response = await fetch("/api/requests");
  const body = (await response.json()) as { data?: Row[]; error?: string };
  if (!response.ok) throw new Error(body.error || "Could not load the mailbox.");
  return body.data ?? [];
}

export function Mailbox({ role }: { role: AppRole }) {
  const query = useQuery({ queryKey: ["requests"], queryFn: loadRequests });
  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const detailBase = role === "VENDOR" ? "/vendor/requests" : "/bank/requests";

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const shared: ColumnDef<Row>[] = [
      ...(role === "VENDOR"
        ? [{ accessorKey: "bankName", header: "Bank", cell: ({ getValue }) => getValue<string>() } satisfies ColumnDef<Row>]
        : []),
      { accessorKey: "applicantLabel", header: "Full name" },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ getValue }) => formatWhen(getValue<string>()),
        filterFn: (row, id, value: { from?: string; to?: string }) => {
          const time = new Date(row.getValue<string>(id)).getTime();
          if (value?.from && time < new Date(value.from).getTime()) return false;
          if (value?.to && time > new Date(`${value.to}T23:59:59`).getTime()) return false;
          return true;
        },
      },
      { accessorKey: "requestCode", header: "Request ID" },
      {
        id: "documents",
        header: "Documents",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex max-w-xs flex-wrap gap-1">
            {row.original.documents.slice(0, 4).map((document) => (
              <button
                key={document.id}
                type="button"
                className="rounded bg-accent px-1.5 py-0.5 text-[11px] text-primary hover:bg-[#d6e6ff]"
                onClick={() => downloadDocument(row.original.id, document.id)}
              >
                {DOCUMENT_LABELS[document.documentType] ?? document.documentType}
                {document.version > 1 ? ` v${document.version}` : ""}
              </button>
            ))}
            {row.original.documents.length > 4 && (
              <span className="text-[11px] text-muted-foreground">+{row.original.documents.length - 4}</span>
            )}
          </div>
        ),
      },
      {
        id: "action",
        header: "Action",
        enableSorting: false,
        cell: ({ row }) => (
          <Link href={`${detailBase}/${row.original.id}`} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
            Open
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue<CanonicalStatus>()} role={role} />,
        filterFn: (row, id, value: string) => !value || row.getValue(id) === value,
      },
    ];
    return shared;
  }, [detailBase, role]);

  const table = useReactTable({
    data: query.data ?? [],
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: (row, _columnId, filter) => {
      const needle = String(filter).toLowerCase();
      const blob = `${row.original.applicantLabel} ${row.original.requestCode} ${row.original.bankName}`.toLowerCase();
      return blob.includes(needle);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const statusValue = (table.getColumn("status")?.getFilterValue() as string) ?? "";
  const dateValue = (table.getColumn("updatedAt")?.getFilterValue() as { from?: string; to?: string }) ?? {};

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mailbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === "VENDOR"
            ? "Every bank settlement currently with the vendor desk. Completed and cancelled requests stay here."
            : "Settlement requests for your bank. Older completed files stay searchable."}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-end">
          <label className="flex-1 text-xs text-muted-foreground">
            Search
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Name, request ID, bank"
              className="mt-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Status
            <select
              className="mt-1 h-8 w-full rounded-lg border border-input bg-white px-2 text-sm text-foreground"
              value={statusValue}
              onChange={(event) => table.getColumn("status")?.setFilterValue(event.target.value || undefined)}
            >
              <option value="">All statuses</option>
              <option value="PENDING_AT_VENDOR">Pending at vendor</option>
              <option value="PENDING_AT_BANK">Pending at bank</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            From
            <Input
              type="date"
              className="mt-1"
              value={dateValue.from ?? ""}
              onChange={(event) =>
                table.getColumn("updatedAt")?.setFilterValue({ ...dateValue, from: event.target.value || undefined })
              }
            />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <Input
              type="date"
              className="mt-1"
              value={dateValue.to ?? ""}
              onChange={(event) =>
                table.getColumn("updatedAt")?.setFilterValue({ ...dateValue, to: event.target.value || undefined })
              }
            />
          </label>
        </div>
        {query.isLoading && <p className="px-4 py-10 text-sm text-muted-foreground">Loading the mailbox…</p>}
        {query.isError && <p className="px-4 py-10 text-sm text-destructive">{(query.error as Error).message}</p>}
        {query.data && table.getRowModel().rows.length === 0 && (
          <p className="px-4 py-10 text-sm text-muted-foreground">No requests match this view.</p>
        )}
        {query.data && table.getRowModel().rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-accent text-left text-xs text-muted-foreground">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id} className="border-b border-border">
                    {group.headers.map((header) => (
                      <th key={header.id} className="px-3 py-2 font-medium">
                        {header.column.getCanSort() ? (
                          <button type="button" className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span>{header.column.getIsSorted() === "asc" ? "↑" : header.column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/80 hover:bg-accent/60">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-3 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
