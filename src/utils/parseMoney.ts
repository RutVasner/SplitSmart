export function parseMoneyToMinorUnits(value: string): number | null {
  const normalizedValue = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d*)?$/.test(normalizedValue)) {
    return null;
  }

  const amount = Number(normalizedValue);
  const minorUnits = Math.round(amount * 100);
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}
