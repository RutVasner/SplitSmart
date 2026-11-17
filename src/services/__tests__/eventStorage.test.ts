import { describe, expect, it } from 'vitest';
import { isValidEventData } from '../eventStorage';

const validEvent = {
  id: 'event-1',
  name: 'Dinner',
  createdAt: '2026-11-11T12:00:00.000Z',
  participants: [{ id: 'participant-1', name: 'Dana' }],
  expenses: [
    {
      id: 'expense-1',
      description: 'Taxi',
      totalAmountMinorUnits: 1000,
      payments: [{ participantId: 'participant-1', amountMinorUnits: 1000 }],
      sharedParticipants: [{ participantId: 'participant-1', weight: 1 }],
      personalCharges: [],
      createdAt: '2026-11-11T12:00:00.000Z',
    },
  ],
};

describe('isValidEventData', () => {
  it('accepts a complete event with valid expenses', () => {
    expect(isValidEventData(validEvent)).toBe(true);
  });

  it('rejects values that are not event objects', () => {
    expect(isValidEventData(null)).toBe(false);
    expect(isValidEventData('event')).toBe(false);
    expect(isValidEventData({ ...validEvent, participants: 'not-an-array' })).toBe(false);
  });

  it('rejects expenses with invalid amounts or weights', () => {
    const invalidAmount = {
      ...validEvent,
      expenses: [{
        ...validEvent.expenses[0],
        totalAmountMinorUnits: -100,
      }],
    };
    const invalidWeight = {
      ...validEvent,
      expenses: [{
        ...validEvent.expenses[0],
        sharedParticipants: [{ participantId: 'participant-1', weight: 0 }],
      }],
    };

    expect(isValidEventData(invalidAmount)).toBe(false);
    expect(isValidEventData(invalidWeight)).toBe(false);
  });

  it('rejects participant references that do not belong to the event', () => {
    const eventWithDanglingReference = {
      ...validEvent,
      expenses: [{
        ...validEvent.expenses[0],
        sharedParticipants: [{ participantId: 'missing-participant', weight: 1 }],
      }],
    };

    expect(isValidEventData(eventWithDanglingReference)).toBe(false);
  });

  it('rejects duplicate participant and expense ids', () => {
    const duplicateParticipants = {
      ...validEvent,
      participants: [
        ...validEvent.participants,
        { id: 'participant-1', name: 'Another name' },
      ],
    };
    const duplicateExpenses = {
      ...validEvent,
      expenses: [
        ...validEvent.expenses,
        { ...validEvent.expenses[0] },
      ],
    };

    expect(isValidEventData(duplicateParticipants)).toBe(false);
    expect(isValidEventData(duplicateExpenses)).toBe(false);
  });
});
