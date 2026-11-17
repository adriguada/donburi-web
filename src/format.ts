const priceFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function formatPrice(price: number): string {
  return priceFormatter.format(price);
}
