import { describe, expect, it } from 'vitest';
import { parseMoneyToMinorUnits } from '../parseMoney';

describe('parseMoneyToMinorUnits', () => {
  it('parses decimal amounts into integer minor units', () => {
    expect(parseMoneyToMinorUnits('24.15')).toBe(2415);
    expect(parseMoneyToMinorUnits('24,15')).toBe(2415);
    expect(parseMoneyToMinorUnits('0.01')).toBe(1);
  });

  it('rounds fractions smaller than a minor unit', () => {
    expect(parseMoneyToMinorUnits('1.239')).toBe(124);
  });

  it('rejects empty, malformed, negative, and unsafe amounts', () => {
    expect(parseMoneyToMinorUnits('')).toBeNull();
    expect(parseMoneyToMinorUnits('  ')).toBeNull();
    expect(parseMoneyToMinorUnits('1.2.3')).toBeNull();
    expect(parseMoneyToMinorUnits('-1')).toBeNull();
    expect(parseMoneyToMinorUnits('999999999999999999')).toBeNull();
  });
});
