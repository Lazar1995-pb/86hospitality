export type DashboardCurrency = "EUR" | "RSD" | "USD" | "GBP" | "CHF";

export const dashboardCurrencies: DashboardCurrency[] = [
  "EUR",
  "RSD",
  "USD",
  "GBP",
  "CHF",
];

const symbolCurrencies: Record<"EUR" | "USD" | "GBP", string> = {
  EUR: "EUR",
  GBP: "GBP",
  USD: "USD",
};

export function formatMoney(value: number, currency: DashboardCurrency) {
  const roundedValue = Number.isFinite(value) ? value : 0;

  if (currency === "RSD" || currency === "CHF") {
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(roundedValue)} ${currency}`;
  }

  return new Intl.NumberFormat("en-US", {
    currency: symbolCurrencies[currency],
    maximumFractionDigits: 0,
    style: "currency",
  }).format(roundedValue);
}
