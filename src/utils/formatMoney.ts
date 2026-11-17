const ilsFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

export function formatMoney(minorUnits: number): string {
  return ilsFormatter.format(minorUnits / 100);
}
