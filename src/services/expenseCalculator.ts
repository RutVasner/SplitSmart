import type {
  Expense,
  MinorUnits,
  ParticipantId,
} from '../types/models';

export interface ParticipantCharge {
  participantId: ParticipantId;
  amountOwedMinorUnits: MinorUnits;
}

export interface ExpenseValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateExpense(expense: Expense): ExpenseValidationResult {
  const errors: string[] = [];
  const isValidMinorUnits = (amount: number): boolean =>
    Number.isInteger(amount) && amount >= 0;

  if (!isValidMinorUnits(expense.totalAmountMinorUnits)) {
    errors.push('Total amount must be a non-negative integer in minor units.');
  }

  const personalTotal = expense.personalCharges.reduce((sum, charge) => {
    if (!isValidMinorUnits(charge.amountMinorUnits)) {
      errors.push(`Invalid personal charge for participant "${charge.participantId}".`);
    }
    return sum + charge.amountMinorUnits;
  }, 0);

  if (isValidMinorUnits(expense.totalAmountMinorUnits) && personalTotal > expense.totalAmountMinorUnits) {
    errors.push('Personal charges cannot exceed the total expense amount.');
  }

  if (expense.payments.length > 0) {
    const paymentTotal = expense.payments.reduce((sum, payment) => {
      if (!isValidMinorUnits(payment.amountMinorUnits)) {
        errors.push(`Invalid payment for participant "${payment.participantId}".`);
      }
      return sum + payment.amountMinorUnits;
    }, 0);

    if (
      isValidMinorUnits(expense.totalAmountMinorUnits)
      && paymentTotal !== expense.totalAmountMinorUnits
    ) {
      errors.push('Payment amounts must add up to the total expense amount.');
    }
  }

  for (const participant of expense.sharedParticipants) {
    if (!Number.isFinite(participant.weight) || participant.weight <= 0) {
      errors.push(`Invalid weight for participant "${participant.participantId}".`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidExpense(expense: Expense): void {
  const result = validateExpense({ ...expense, payments: [] });
  if (!result.valid) {
    throw new Error(result.errors.join(' '));
  }
}

export function calculateExpenseCharges(
  expense: Expense,
): ParticipantCharge[] {
  assertValidExpense(expense);

  const personalTotals = new Map<ParticipantId, MinorUnits>();

  for (const charge of expense.personalCharges) {
    personalTotals.set(
      charge.participantId,
      (personalTotals.get(charge.participantId) ?? 0) + charge.amountMinorUnits,
    );
  }

  const personalTotal = [...personalTotals.values()].reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const sharedAmount = expense.totalAmountMinorUnits - personalTotal;

  const sharedWeights = new Map<ParticipantId, number>();
  const sharedOrder: ParticipantId[] = [];
  for (const participant of expense.sharedParticipants) {
    if (!sharedWeights.has(participant.participantId)) {
      sharedWeights.set(participant.participantId, 0);
      sharedOrder.push(participant.participantId);
    }
    sharedWeights.set(
      participant.participantId,
      (sharedWeights.get(participant.participantId) ?? 0) + participant.weight,
    );
  }

  const charges = new Map<ParticipantId, MinorUnits>();
  const totalWeight = [...sharedWeights.values()].reduce((sum, weight) => sum + weight, 0);

  if (totalWeight > 0 && sharedAmount > 0) {
    let assignedAmount = 0;
    const portions = sharedOrder.map((participantId, index) => {
      const weight = sharedWeights.get(participantId) ?? 0;
      const exactPortion = sharedAmount * weight / totalWeight;
      const amount = Math.floor(exactPortion);
      assignedAmount += amount;
      return { participantId, amount, remainder: exactPortion - amount, index };
    });

    for (const portion of portions) {
      charges.set(portion.participantId, portion.amount);
    }

    const remainingAmount = sharedAmount - assignedAmount;
    const sortedByRemainder = [...portions].sort((first, second) => {
      const remainderDifference = second.remainder - first.remainder;
      if (Math.abs(remainderDifference) > Number.EPSILON) {
        return remainderDifference;
      }
      return first.index - second.index;
    });

    for (let index = 0; index < remainingAmount; index += 1) {
      const portion = sortedByRemainder[index % sortedByRemainder.length];
      charges.set(
        portion.participantId,
        (charges.get(portion.participantId) ?? 0) + 1,
      );
    }
  }

  for (const [participantId, personalAmount] of personalTotals) {
    charges.set(
      participantId,
      (charges.get(participantId) ?? 0) + personalAmount,
    );
  }

  const orderedParticipantIds = [
    ...sharedOrder,
    ...expense.personalCharges.map((charge) => charge.participantId),
  ].filter(
    (participantId, index, participants) => participants.indexOf(participantId) === index,
  );

  return orderedParticipantIds.map((participantId) => ({
    participantId,
    amountOwedMinorUnits: charges.get(participantId) ?? 0,
  }));
}
