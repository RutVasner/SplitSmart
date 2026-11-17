import { describe, expect, it } from 'vitest';
import {
  calculateParticipantBalances,
  createSettlementTransfers,
} from '../settlementCalculator';
import type { Event, ParticipantBalance } from '../../types/models';

function createEvent(expenses: Event['expenses']): Event {
  return {
    id: 'event-1',
    name: 'Test event',
    createdAt: '2026-11-04T00:00:00.000Z',
    participants: [
      { id: 'rut', name: 'Ruth' },
      { id: 'dana', name: 'Dana' },
      { id: 'rachel', name: 'Rachel' },
      { id: 'participant-4', name: 'Participant 4' },
      { id: 'participant-5', name: 'Participant 5' },
    ],
    expenses,
  };
}

describe('calculateParticipantBalances', () => {
  it('calculates the restaurant example balances', () => {
    const event = createEvent([
      {
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
        createdAt: '2026-11-04T00:00:00.000Z',
      },
    ]);

    const balances = calculateParticipantBalances(event);

    expect(balances).toEqual([
      {
        participantId: 'rut',
        paidMinorUnits: 15000,
        shouldPayMinorUnits: 10120,
        balanceMinorUnits: 4880,
      },
      {
        participantId: 'dana',
        paidMinorUnits: 35000,
        shouldPayMinorUnits: 11320,
        balanceMinorUnits: 23680,
      },
      {
        participantId: 'rachel',
        paidMinorUnits: 0,
        shouldPayMinorUnits: 10320,
        balanceMinorUnits: -10320,
      },
      {
        participantId: 'participant-4',
        paidMinorUnits: 0,
        shouldPayMinorUnits: 9120,
        balanceMinorUnits: -9120,
      },
      {
        participantId: 'participant-5',
        paidMinorUnits: 0,
        shouldPayMinorUnits: 9120,
        balanceMinorUnits: -9120,
      },
    ]);

    const totalPaid = balances.reduce((sum, balance) => sum + balance.paidMinorUnits, 0);
    const totalOwed = balances.reduce((sum, balance) => sum + balance.shouldPayMinorUnits, 0);
    const totalBalance = balances.reduce((sum, balance) => sum + balance.balanceMinorUnits, 0);

    expect(totalPaid).toBe(50000);
    expect(totalOwed).toBe(50000);
    expect(totalBalance).toBe(0);
  });

  it('returns zero balances for an event without expenses', () => {
    const event = createEvent([]);

    expect(calculateParticipantBalances(event)).toEqual([
      { participantId: 'rut', paidMinorUnits: 0, shouldPayMinorUnits: 0, balanceMinorUnits: 0 },
      { participantId: 'dana', paidMinorUnits: 0, shouldPayMinorUnits: 0, balanceMinorUnits: 0 },
      { participantId: 'rachel', paidMinorUnits: 0, shouldPayMinorUnits: 0, balanceMinorUnits: 0 },
      { participantId: 'participant-4', paidMinorUnits: 0, shouldPayMinorUnits: 0, balanceMinorUnits: 0 },
      { participantId: 'participant-5', paidMinorUnits: 0, shouldPayMinorUnits: 0, balanceMinorUnits: 0 },
    ]);
  });

  it('sums payments and owed amounts across multiple expenses', () => {
    const event = createEvent([
      {
        id: 'expense-1',
        description: 'Taxi',
        totalAmountMinorUnits: 1000,
        payments: [
          { participantId: 'rut', amountMinorUnits: 400 },
          { participantId: 'rut', amountMinorUnits: 600 },
        ],
        sharedParticipants: [
          { participantId: 'rut', weight: 1 },
          { participantId: 'dana', weight: 1 },
        ],
        personalCharges: [],
        createdAt: '2026-11-04T00:00:00.000Z',
      },
      {
        id: 'expense-2',
        description: 'Food',
        totalAmountMinorUnits: 2000,
        payments: [{ participantId: 'dana', amountMinorUnits: 2000 }],
        sharedParticipants: [{ participantId: 'dana', weight: 1 }],
        personalCharges: [{ participantId: 'rachel', amountMinorUnits: 500 }],
        createdAt: '2026-11-04T00:01:00.000Z',
      },
    ]);

    const balances = calculateParticipantBalances(event);
    const byId = new Map(balances.map((balance) => [balance.participantId, balance]));

    expect(byId.get('rut')).toEqual({
      participantId: 'rut',
      paidMinorUnits: 1000,
      shouldPayMinorUnits: 500,
      balanceMinorUnits: 500,
    });
    expect(byId.get('dana')).toEqual({
      participantId: 'dana',
      paidMinorUnits: 2000,
      shouldPayMinorUnits: 2000,
      balanceMinorUnits: 0,
    });
    expect(byId.get('rachel')).toEqual({
      participantId: 'rachel',
      paidMinorUnits: 0,
      shouldPayMinorUnits: 500,
      balanceMinorUnits: -500,
    });

    const totalPaid = balances.reduce((sum, balance) => sum + balance.paidMinorUnits, 0);
    const totalOwed = balances.reduce((sum, balance) => sum + balance.shouldPayMinorUnits, 0);
    expect(totalPaid).toBe(totalOwed);
  });

  it('includes participants who only appear in personal charges', () => {
    const event = createEvent([
      {
        id: 'expense-personal',
        description: 'Personal only',
        totalAmountMinorUnits: 3000,
        payments: [{ participantId: 'rut', amountMinorUnits: 3000 }],
        sharedParticipants: [],
        personalCharges: [{ participantId: 'rachel', amountMinorUnits: 3000 }],
        createdAt: '2026-11-04T00:00:00.000Z',
      },
    ]);

    const rachel = calculateParticipantBalances(event)
      .find((balance) => balance.participantId === 'rachel');

    expect(rachel).toEqual({
      participantId: 'rachel',
      paidMinorUnits: 0,
      shouldPayMinorUnits: 3000,
      balanceMinorUnits: -3000,
    });
  });

  it('includes every event participant and ignores outside identifiers', () => {
    const event: Event = {
      id: 'event-small',
      name: 'Small event',
      createdAt: '2026-11-04T00:00:00.000Z',
      participants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      expenses: [
        {
          id: 'expense-outside',
          description: 'Outside identifiers',
          totalAmountMinorUnits: 100,
          payments: [
            { participantId: 'a', amountMinorUnits: 100 },
            { participantId: 'outside', amountMinorUnits: 999 },
          ],
          sharedParticipants: [
            { participantId: 'a', weight: 1 },
            { participantId: 'outside', weight: 1 },
          ],
          personalCharges: [{ participantId: 'outside', amountMinorUnits: 1 }],
          createdAt: '2026-11-04T00:00:00.000Z',
        },
      ],
    };

    expect(calculateParticipantBalances(event)).toEqual([
      {
        participantId: 'a',
        paidMinorUnits: 100,
        shouldPayMinorUnits: 50,
        balanceMinorUnits: 50,
      },
      {
        participantId: 'b',
        paidMinorUnits: 0,
        shouldPayMinorUnits: 0,
        balanceMinorUnits: 0,
      },
    ]);
  });
});

function createBalance(
  participantId: string,
  balanceMinorUnits: number,
): ParticipantBalance {
  return {
    participantId,
    paidMinorUnits: balanceMinorUnits > 0 ? balanceMinorUnits : 0,
    shouldPayMinorUnits: balanceMinorUnits < 0 ? -balanceMinorUnits : 0,
    balanceMinorUnits,
  };
}

describe('createSettlementTransfers', () => {
  it('creates deterministic transfers for the restaurant example', () => {
    const balances = [
      createBalance('rut', 4880),
      createBalance('dana', 23680),
      createBalance('rachel', -10320),
      createBalance('participant-4', -9120),
      createBalance('participant-5', -9120),
    ];

    expect(createSettlementTransfers(balances)).toEqual([
      { fromParticipantId: 'rachel', toParticipantId: 'dana', amountMinorUnits: 10320 },
      { fromParticipantId: 'participant-4', toParticipantId: 'dana', amountMinorUnits: 9120 },
      { fromParticipantId: 'participant-5', toParticipantId: 'dana', amountMinorUnits: 4240 },
      { fromParticipantId: 'participant-5', toParticipantId: 'rut', amountMinorUnits: 4880 },
    ]);
  });

  it('matches one debtor with one creditor', () => {
    const balances = [
      createBalance('creditor', 2500),
      createBalance('debtor', -2500),
    ];

    expect(createSettlementTransfers(balances)).toEqual([
      { fromParticipantId: 'debtor', toParticipantId: 'creditor', amountMinorUnits: 2500 },
    ]);
  });

  it('matches multiple debtors with one creditor', () => {
    const balances = [
      createBalance('creditor', 10000),
      createBalance('small-debtor', -3000),
      createBalance('large-debtor', -7000),
    ];

    expect(createSettlementTransfers(balances)).toEqual([
      { fromParticipantId: 'large-debtor', toParticipantId: 'creditor', amountMinorUnits: 7000 },
      { fromParticipantId: 'small-debtor', toParticipantId: 'creditor', amountMinorUnits: 3000 },
    ]);
  });

  it('matches one debtor with multiple creditors', () => {
    const balances = [
      createBalance('small-creditor', 3000),
      createBalance('large-creditor', 7000),
      createBalance('debtor', -10000),
    ];

    expect(createSettlementTransfers(balances)).toEqual([
      { fromParticipantId: 'debtor', toParticipantId: 'large-creditor', amountMinorUnits: 7000 },
      { fromParticipantId: 'debtor', toParticipantId: 'small-creditor', amountMinorUnits: 3000 },
    ]);
  });

  it('returns no transfers when all balances are zero', () => {
    const balances = [
      createBalance('a', 0),
      createBalance('b', 0),
      createBalance('c', 0),
    ];

    expect(createSettlementTransfers(balances)).toEqual([]);
  });

  it('sorts equal balances by participantId deterministically', () => {
    const balances = [
      createBalance('z-debtor', -5000),
      createBalance('z-creditor', 5000),
      createBalance('a-debtor', -5000),
      createBalance('a-creditor', 5000),
    ];

    expect(createSettlementTransfers(balances)).toEqual([
      { fromParticipantId: 'a-debtor', toParticipantId: 'a-creditor', amountMinorUnits: 5000 },
      { fromParticipantId: 'z-debtor', toParticipantId: 'z-creditor', amountMinorUnits: 5000 },
    ]);
  });
});
