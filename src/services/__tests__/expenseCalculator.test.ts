import { describe, expect, it } from 'vitest';
import { calculateExpenseCharges, validateExpense } from '../expenseCalculator';
import type { Expense } from '../../types/models';

describe('calculateExpenseCharges', () => {
  it('calculates the restaurant example without payments affecting charges', () => {
    const expense: Expense = {
      id: 'expense-restaurant',
      description: 'Restaurant',
      totalAmountMinorUnits: 50000,
      payments: [
        { participantId: 'rut', amountMinorUnits: 15000 },
        { participantId: 'dana', amountMinorUnits: 35000 },
      ],
      sharedParticipants: [
        { participantId: 'rut', weight: 1 },
        { participantId: 'dana', weight: 1 },
        { participantId: 'rachel', weight: 1 },
        { participantId: 'participant-4', weight: 1 },
        { participantId: 'participant-5', weight: 1 },
      ],
      personalCharges: [
        { participantId: 'rut', amountMinorUnits: 1000 },
        { participantId: 'dana', amountMinorUnits: 2200 },
        { participantId: 'rachel', amountMinorUnits: 1200 },
      ],
      createdAt: '2026-11-02T20:00:00.000Z',
    };

    const charges = calculateExpenseCharges(expense);

    expect(charges).toEqual([
      { participantId: 'rut', amountOwedMinorUnits: 10120 },
      { participantId: 'dana', amountOwedMinorUnits: 11320 },
      { participantId: 'rachel', amountOwedMinorUnits: 10320 },
      { participantId: 'participant-4', amountOwedMinorUnits: 9120 },
      { participantId: 'participant-5', amountOwedMinorUnits: 9120 },
    ]);

    const totalOwed = charges.reduce(
      (sum, charge) => sum + charge.amountOwedMinorUnits,
      0,
    );
    expect(totalOwed).toBe(expense.totalAmountMinorUnits);
  });

  it('splits a shared expense without personal charges', () => {
    const expense: Expense = {
      id: 'expense-shared',
      description: 'Shared expense',
      totalAmountMinorUnits: 3000,
      payments: [],
      sharedParticipants: [
        { participantId: 'a', weight: 1 },
        { participantId: 'b', weight: 1 },
        { participantId: 'c', weight: 1 },
      ],
      personalCharges: [],
      createdAt: '2026-11-02T20:00:00.000Z',
    };

    expect(calculateExpenseCharges(expense)).toEqual([
      { participantId: 'a', amountOwedMinorUnits: 1000 },
      { participantId: 'b', amountOwedMinorUnits: 1000 },
      { participantId: 'c', amountOwedMinorUnits: 1000 },
    ]);
  });

  it('uses personal charges only when there is no shared amount', () => {
    const expense: Expense = {
      id: 'expense-personal',
      description: 'Personal charges only',
      totalAmountMinorUnits: 4400,
      payments: [],
      sharedParticipants: [],
      personalCharges: [
        { participantId: 'a', amountMinorUnits: 1500 },
        { participantId: 'b', amountMinorUnits: 2900 },
      ],
      createdAt: '2026-11-02T20:00:00.000Z',
    };

    expect(calculateExpenseCharges(expense)).toEqual([
      { participantId: 'a', amountOwedMinorUnits: 1500 },
      { participantId: 'b', amountOwedMinorUnits: 2900 },
    ]);
  });

  it('adds personal charges for non-shared participants to the shared split', () => {
    const expense: Expense = {
      id: 'expense-personal-and-shared',
      description: 'Shared meal and personal drink',
      totalAmountMinorUnits: 5000,
      payments: [{ participantId: 'a', amountMinorUnits: 5000 }],
      sharedParticipants: [
        { participantId: 'a', weight: 1 },
        { participantId: 'b', weight: 1 },
      ],
      personalCharges: [{ participantId: 'c', amountMinorUnits: 1000 }],
      createdAt: '2026-11-02T20:00:00.000Z',
    };

    expect(calculateExpenseCharges(expense)).toEqual([
      { participantId: 'a', amountOwedMinorUnits: 2000 },
      { participantId: 'b', amountOwedMinorUnits: 2000 },
      { participantId: 'c', amountOwedMinorUnits: 1000 },
    ]);
  });

  it('assigns one remainder agorot at a time in sharedParticipant order', () => {
    const expense: Expense = {
      id: 'expense-remainder',
      description: 'Expense with a remainder',
      totalAmountMinorUnits: 100,
      payments: [],
      sharedParticipants: [
        { participantId: 'first', weight: 1 },
        { participantId: 'second', weight: 1 },
        { participantId: 'third', weight: 1 },
      ],
      personalCharges: [],
      createdAt: '2026-11-02T20:00:00.000Z',
    };

    expect(calculateExpenseCharges(expense)).toEqual([
      { participantId: 'first', amountOwedMinorUnits: 34 },
      { participantId: 'second', amountOwedMinorUnits: 33 },
      { participantId: 'third', amountOwedMinorUnits: 33 },
    ]);

    const totalOwed = calculateExpenseCharges(expense).reduce(
      (sum, charge) => sum + charge.amountOwedMinorUnits,
      0,
    );
    expect(totalOwed).toBe(100);
  });

  it('splits shared costs according to participant weights', () => {
    const expense: Expense = {
      id: 'expense-weighted',
      description: 'Weighted expense',
      totalAmountMinorUnits: 100,
      payments: [{ participantId: 'a', amountMinorUnits: 100 }],
      sharedParticipants: [
        { participantId: 'a', weight: 1 },
        { participantId: 'b', weight: 2 },
        { participantId: 'c', weight: 1 },
      ],
      personalCharges: [],
      createdAt: '2026-11-02T20:00:00.000Z',
    };

    expect(calculateExpenseCharges(expense)).toEqual([
      { participantId: 'a', amountOwedMinorUnits: 25 },
      { participantId: 'b', amountOwedMinorUnits: 50 },
      { participantId: 'c', amountOwedMinorUnits: 25 },
    ]);
  });

  it('validates totals and weights', () => {
    const expense: Expense = {
      id: 'expense-invalid',
      description: 'Invalid expense',
      totalAmountMinorUnits: 1000,
      payments: [{ participantId: 'a', amountMinorUnits: 900 }],
      sharedParticipants: [{ participantId: 'b', weight: 0 }],
      personalCharges: [{ participantId: 'b', amountMinorUnits: 1200 }],
      createdAt: '2026-11-02T20:00:00.000Z',
    };

    expect(validateExpense(expense).valid).toBe(false);
    expect(() => calculateExpenseCharges(expense)).toThrow();
  });
});
