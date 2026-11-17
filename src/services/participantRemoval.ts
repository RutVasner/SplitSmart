import type { Event, Expense, ExpensePayment, ParticipantId } from '../types/models';

export function getParticipantRemovalBlockers(
  event: Event,
  participantId: ParticipantId,
): Expense[] {
  return event.expenses.filter((expense) => {
    const remainingSharedParticipants = expense.sharedParticipants.filter(
      (participant) => participant.participantId !== participantId,
    );
    if (remainingSharedParticipants.length > 0) return false;

    const remainingPersonalTotal = expense.personalCharges
      .filter((charge) => charge.participantId !== participantId)
      .reduce((sum, charge) => sum + charge.amountMinorUnits, 0);

    return remainingPersonalTotal !== expense.totalAmountMinorUnits;
  });
}

export function removeParticipantFromEvent(
  event: Event,
  participantId: ParticipantId,
  replacementPayerId?: ParticipantId,
): Event {
  if (!event.participants.some((participant) => participant.id === participantId)) {
    throw new Error('Cannot remove a participant who is not in the event.');
  }

  const hasPaymentsToReassign = event.expenses.some((expense) =>
    expense.payments.some((payment) => payment.participantId === participantId),
  );
  if (hasPaymentsToReassign) {
    const isValidReplacement = replacementPayerId !== undefined
      && replacementPayerId !== participantId
      && event.participants.some((participant) => participant.id === replacementPayerId);
    if (!isValidReplacement) {
      throw new Error('A valid replacement payer is required to preserve expense payments.');
    }
  }

  if (getParticipantRemovalBlockers(event, participantId).length > 0) {
    throw new Error('Removing this participant would leave an expense partly unallocated.');
  }

  return {
    ...event,
    participants: event.participants.filter((participant) => participant.id !== participantId),
    expenses: event.expenses.map((expense) => ({
      ...expense,
      payments: reassignPayments(expense.payments, participantId, replacementPayerId),
      sharedParticipants: expense.sharedParticipants.filter(
        (participant) => participant.participantId !== participantId,
      ),
      personalCharges: expense.personalCharges.filter(
        (charge) => charge.participantId !== participantId,
      ),
    })),
  };
}

function reassignPayments(
  payments: ExpensePayment[],
  removedParticipantId: ParticipantId,
  replacementPayerId?: ParticipantId,
): ExpensePayment[] {
  const amountsByParticipant = new Map<ParticipantId, number>();

  for (const payment of payments) {
    const participantId = payment.participantId === removedParticipantId
      ? replacementPayerId
      : payment.participantId;
    if (participantId === undefined) {
      throw new Error('A replacement payer is required to preserve expense payments.');
    }
    amountsByParticipant.set(
      participantId,
      (amountsByParticipant.get(participantId) ?? 0) + payment.amountMinorUnits,
    );
  }

  return [...amountsByParticipant].map(([participantId, amountMinorUnits]) => ({
    participantId,
    amountMinorUnits,
  }));
}
