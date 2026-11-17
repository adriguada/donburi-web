const priceFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function formatPrice(price: number): string {
  return priceFormatter.format(price);
}

export function spicinessLabel(level: number): string {
  return level === 1 ? "1 guindilla" : `${level} guindillas`;
}
