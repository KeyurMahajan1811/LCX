import { RequestDetail } from "@/components/request-detail";

export default async function BankRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetail id={id} role="BANK_OFFICIAL" />;
}
