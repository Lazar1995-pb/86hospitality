import { NewInvoicePageClient } from "./new-invoice-page-client";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return <NewInvoicePageClient saveError={params?.error} />;
}
