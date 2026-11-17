import { describe, expect, it } from 'vitest';
import type { Event } from '../../types/models';
import { validateEventSettlement } from '../settlementValidation';

function createEvent(expenses: Event['expenses']): Event {
  return {
    id: 'event-1',
    name: 'Test event',
    createdAt: '2026-11-15T10:00:00.000Z',
    participants: [
      { id: 'dana', name: 'Dana' },
      { id: 'yael', name: 'Yael' },
    ],
    expenses,
  };
}

function createExpense(
  overrides: Partial<Event['expenses'][number]> = {},
): Event['expenses'][number] {
  return {
    id: 'meal',
    description: 'Meal',
    totalAmountMinorUnits: 1000,
    payments: [{ participantId: 'dana', amountMinorUnits: 1000 }],
    sharedParticipants: [
      { participantId: 'dana', weight: 1 },
      { participantId: 'yael', weight: 1 },
    ],
    personalCharges: [],
    createdAt: '2026-11-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('validateEventSettlement', () => {
  it('accepts a fully balanced event', () => {
    const result = validateEventSettlement(createEvent([createExpense()]));

    expect(result).toMatchObject({
      valid: true,
      totalPaidMinorUnits: 1000,
      totalOwedMinorUnits: 1000,
      differenceMinorUnits: 0,
      issues: [],
    });
  });

  it('reports expenses without a recorded payment', () => {
    const result = validateEventSettlement(createEvent([
      createExpense({ payments: [] }),
    ]));

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      expenseDescription: 'Meal',
      message: 'לא צוין מי שילם על ההוצאה.',
    }));
  });

  it('reports a payment total that does not match the expense', () => {
    const result = validateEventSettlement(createEvent([
      createExpense({ payments: [{ participantId: 'dana', amountMinorUnits: 900 }] }),
    ]));

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      expenseDescription: 'Meal',
      message: 'סך התשלומים אינו תואם לסכום ההוצאה.',
    }));
    expect(result.differenceMinorUnits).toBe(-100);
  });

  it('reports an expense whose personal charges leave an unallocated remainder', () => {
    const result = validateEventSettlement(createEvent([
      createExpense({
        sharedParticipants: [],
        personalCharges: [{ participantId: 'dana', amountMinorUnits: 700 }],
      }),
    ]));

    expect(result.valid).toBe(false);
    expect(result.totalOwedMinorUnits).toBe(700);
    expect(result.issues.some((issue) =>
      issue.expenseDescription === 'Meal'
      && issue.message.includes('חיובים מסתכמים ב־700'),
    )).toBe(true);
  });

  it('reports references to participants outside the event', () => {
    const result = validateEventSettlement(createEvent([
      createExpense({
        sharedParticipants: [{ participantId: 'unknown', weight: 1 }],
      }),
    ]));

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      message: 'חלוקה או חיוב אישי משויכים למשתתף שאינו קיים באירוע.',
    }));
  });

  it('checks balances across multiple individually valid expenses', () => {
    const result = validateEventSettlement(createEvent([
      createExpense(),
      createExpense({
        id: 'taxi',
        description: 'Taxi',
        totalAmountMinorUnits: 500,
        payments: [{ participantId: 'yael', amountMinorUnits: 500 }],
        sharedParticipants: [{ participantId: 'dana', weight: 1 }],
      }),
    ]));

    expect(result).toMatchObject({
      valid: true,
      totalPaidMinorUnits: 1500,
      totalOwedMinorUnits: 1500,
      differenceMinorUnits: 0,
    });
  });
});
