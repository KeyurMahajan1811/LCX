import { TradeDesk } from "@/components/trade-desk";

export default async function TradePage({
  params,
}: {
  params: Promise<{ base: string; quote: string }>;
}) {
  const { base, quote } = await params;
  return <TradeDesk base={decodeURIComponent(base).toUpperCase()} quote={decodeURIComponent(quote).toUpperCase()} />;
}
