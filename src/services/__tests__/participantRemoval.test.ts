import { describe, expect, it } from 'vitest';
import type { Event } from '../../types/models';
import {
  getParticipantRemovalBlockers,
  removeParticipantFromEvent,
} from '../participantRemoval';

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    name: 'Dinner',
    createdAt: '2026-11-13T10:00:00.000Z',
    participants: [
      { id: 'dana', name: 'Dana' },
      { id: 'yael', name: 'Yael' },
      { id: 'noa', name: 'Noa' },
    ],
    expenses: [
      {
        id: 'meal',
        description: 'Meal',
        totalAmountMinorUnits: 3000,
        payments: [{ participantId: 'dana', amountMinorUnits: 3000 }],
        sharedParticipants: [
          { participantId: 'dana', weight: 1 },
          { participantId: 'yael', weight: 1 },
          { participantId: 'noa', weight: 1 },
        ],
        personalCharges: [{ participantId: 'dana', amountMinorUnits: 600 }],
        createdAt: '2026-11-13T10:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('removeParticipantFromEvent', () => {
  it('reassigns payment amounts and preserves the expense total', () => {
    const event = removeParticipantFromEvent(createEvent(), 'dana', 'yael');
    const expense = event.expenses[0];

    expect(event.participants.map((participant) => participant.id)).toEqual(['yael', 'noa']);
    expect(expense.payments).toEqual([
      { participantId: 'yael', amountMinorUnits: 3000 },
    ]);
    expect(expense.payments.reduce((sum, payment) => sum + payment.amountMinorUnits, 0))
      .toBe(3000);
    expect(expense.sharedParticipants.map((participant) => participant.participantId))
      .toEqual(['yael', 'noa']);
    expect(expense.personalCharges).toEqual([]);
  });

  it('combines reassigned payments with payments already made by the replacement', () => {
    const event = createEvent({
      expenses: [{
        ...createEvent().expenses[0],
        payments: [
          { participantId: 'dana', amountMinorUnits: 2000 },
          { participantId: 'yael', amountMinorUnits: 1000 },
        ],
      }],
    });

    const result = removeParticipantFromEvent(event, 'dana', 'yael');
    expect(result.expenses[0].payments).toEqual([
      { participantId: 'yael', amountMinorUnits: 3000 },
    ]);
  });

  it('does not require a replacement when the participant did not pay', () => {
    const result = removeParticipantFromEvent(createEvent(), 'yael');
    expect(result.participants.map((participant) => participant.id)).toEqual(['dana', 'noa']);
  });

  it('requires a valid different participant when payments need reassignment', () => {
    expect(() => removeParticipantFromEvent(createEvent(), 'dana')).toThrow(
      'A valid replacement payer is required',
    );
    expect(() => removeParticipantFromEvent(createEvent(), 'dana', 'dana')).toThrow(
      'A valid replacement payer is required',
    );
  });

  it('blocks removal if it leaves a personal-only expense partly unallocated', () => {
    const event = createEvent({
      expenses: [{
        ...createEvent().expenses[0],
        totalAmountMinorUnits: 1000,
        payments: [{ participantId: 'dana', amountMinorUnits: 1000 }],
        sharedParticipants: [],
        personalCharges: [
          { participantId: 'dana', amountMinorUnits: 400 },
          { participantId: 'yael', amountMinorUnits: 600 },
        ],
      }],
    });

    expect(getParticipantRemovalBlockers(event, 'dana')).toEqual(event.expenses);
    expect(() => removeParticipantFromEvent(event, 'dana', 'yael')).toThrow(
      'leave an expense partly unallocated',
    );
  });

  it('allows removal when remaining shared participants can absorb the shared remainder', () => {
    const event = removeParticipantFromEvent(createEvent(), 'dana', 'yael');
    expect(getParticipantRemovalBlockers(createEvent(), 'dana')).toEqual([]);
    expect(event.expenses[0].sharedParticipants).toHaveLength(2);
  });
});
