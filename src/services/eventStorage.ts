import { validateExpense } from './expenseCalculator';
import type {
  Event,
  Expense,
  ExpensePayment,
  Participant,
  PersonalCharge,
  SharedParticipant,
} from '../types/models';

export const STORAGE_KEY = 'splitsmart-event-v1';

export type StorageStatus =
  | { kind: 'ready' }
  | { kind: 'memory-only' }
  | { kind: 'invalid'; message: string }
  | { kind: 'unavailable'; message: string };

export interface EventLoadResult {
  event: Event;
  status: StorageStatus;
}

export function createEmptyEvent(): Event {
  return {
    id: crypto.randomUUID(),
    name: '',
    createdAt: new Date().toISOString(),
    participants: [],
    expenses: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isMinorUnits(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isParticipant(value: unknown): value is Participant {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && typeof value.name === 'string';
}

function isExpensePayment(value: unknown): value is ExpensePayment {
  return isRecord(value)
    && isNonEmptyString(value.participantId)
    && isMinorUnits(value.amountMinorUnits);
}

function isSharedParticipant(value: unknown): value is SharedParticipant {
  return isRecord(value)
    && isNonEmptyString(value.participantId)
    && typeof value.weight === 'number'
    && Number.isFinite(value.weight)
    && value.weight > 0;
}

function isPersonalCharge(value: unknown): value is PersonalCharge {
  return isRecord(value)
    && isNonEmptyString(value.participantId)
    && isMinorUnits(value.amountMinorUnits);
}

function isExpense(value: unknown): value is Expense {
  if (!isRecord(value)) {
    return false;
  }

  const payments = value.payments;
  const sharedParticipants = value.sharedParticipants;
  const personalCharges = value.personalCharges;
  if (
    !isNonEmptyString(value.id)
    || typeof value.description !== 'string'
    || !isMinorUnits(value.totalAmountMinorUnits)
    || typeof value.createdAt !== 'string'
    || !Array.isArray(payments)
    || !Array.isArray(sharedParticipants)
    || !Array.isArray(personalCharges)
  ) {
    return false;
  }

  const validPayments = payments.filter(isExpensePayment);
  const validSharedParticipants = sharedParticipants.filter(isSharedParticipant);
  const validPersonalCharges = personalCharges.filter(isPersonalCharge);
  if (
    validPayments.length !== payments.length
    || validSharedParticipants.length !== sharedParticipants.length
    || validPersonalCharges.length !== personalCharges.length
  ) {
    return false;
  }

  const expense: Expense = {
    id: value.id,
    description: value.description,
    totalAmountMinorUnits: value.totalAmountMinorUnits,
    payments: validPayments,
    sharedParticipants: validSharedParticipants,
    personalCharges: validPersonalCharges,
    createdAt: value.createdAt,
  };
  return validateExpense(expense).valid;
}

export function isValidEventData(value: unknown): value is Event {
  if (!isRecord(value)) {
    return false;
  }

  const participants = value.participants;
  const expenses = value.expenses;
  if (
    !isNonEmptyString(value.id)
    || typeof value.name !== 'string'
    || typeof value.createdAt !== 'string'
    || !Array.isArray(participants)
    || !Array.isArray(expenses)
  ) {
    return false;
  }

  const validParticipants = participants.filter(isParticipant);
  const validExpenses = expenses.filter(isExpense);
  if (
    validParticipants.length !== participants.length
    || validExpenses.length !== expenses.length
  ) {
    return false;
  }

  const participantIds = new Set(validParticipants.map((participant) => participant.id));
  const expenseIds = validExpenses.map((expense) => expense.id);

  if (
    participantIds.size !== validParticipants.length
    || new Set(expenseIds).size !== expenseIds.length
  ) {
    return false;
  }

  return validExpenses.every((expense) =>
    [...expense.payments, ...expense.sharedParticipants, ...expense.personalCharges]
      .every((entry) => participantIds.has(entry.participantId))
  );
}

export function loadEvent(): EventLoadResult {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      event: createEmptyEvent(),
      status: {
        kind: 'unavailable',
        message: 'לא ניתן לקרוא את הנתונים השמורים בדפדפן.',
      },
    };
  }

  if (stored === null) {
    return { event: createEmptyEvent(), status: { kind: 'ready' } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return {
      event: createEmptyEvent(),
      status: {
        kind: 'invalid',
        message: 'הנתונים השמורים אינם בפורמט תקין. הם לא נמחקו.',
      },
    };
  }

  if (!isValidEventData(parsed)) {
    return {
      event: createEmptyEvent(),
      status: {
        kind: 'invalid',
        message: 'מבנה הנתונים השמורים אינו תקין. הם לא נמחקו.',
      },
    };
  }

  return { event: parsed, status: { kind: 'ready' } };
}

export function saveEvent(event: Event): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
}

export function clearStoredEvent(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
