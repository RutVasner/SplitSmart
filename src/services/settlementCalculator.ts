import type {
  Event,
  MinorUnits,
  ParticipantBalance,
  ParticipantId,
  SettlementTransfer,
} from '../types/models';
import { calculateExpenseCharges } from './expenseCalculator';

export function calculateParticipantBalances(
  event: Event,
): ParticipantBalance[] {
  const paidTotals = new Map<ParticipantId, MinorUnits>();
  const owedTotals = new Map<ParticipantId, MinorUnits>();

  for (const participant of event.participants) {
    paidTotals.set(participant.id, 0);
    owedTotals.set(participant.id, 0);
  }

  for (const expense of event.expenses) {
    for (const payment of expense.payments) {
      if (!paidTotals.has(payment.participantId)) {
        continue;
      }

      const currentPaid = paidTotals.get(payment.participantId) ?? 0;
      paidTotals.set(
        payment.participantId,
        currentPaid + payment.amountMinorUnits,
      );
    }

    const charges = calculateExpenseCharges(expense);
    for (const charge of charges) {
      if (!owedTotals.has(charge.participantId)) {
        continue;
      }

      const currentOwed = owedTotals.get(charge.participantId) ?? 0;
      owedTotals.set(
        charge.participantId,
        currentOwed + charge.amountOwedMinorUnits,
      );
    }
  }

  return event.participants.map((participant) => {
    const paidMinorUnits = paidTotals.get(participant.id) ?? 0;
    const shouldPayMinorUnits = owedTotals.get(participant.id) ?? 0;

    return {
      participantId: participant.id,
      paidMinorUnits,
      shouldPayMinorUnits,
      balanceMinorUnits: paidMinorUnits - shouldPayMinorUnits,
    };
  });
}

export function createSettlementTransfers(
  balances: ParticipantBalance[],
): SettlementTransfer[] {
  const compareByAbsoluteBalance = (
    first: ParticipantBalance,
    second: ParticipantBalance,
  ): number => {
    const balanceDifference =
      Math.abs(second.balanceMinorUnits) - Math.abs(first.balanceMinorUnits);

    if (balanceDifference !== 0) {
      return balanceDifference;
    }

    return first.participantId.localeCompare(second.participantId);
  };

  const creditors = balances
    .filter((balance) => balance.balanceMinorUnits > 0)
    .sort(compareByAbsoluteBalance)
    .map((balance) => ({
      participantId: balance.participantId,
      remainingMinorUnits: balance.balanceMinorUnits,
    }));

  const debtors = balances
    .filter((balance) => balance.balanceMinorUnits < 0)
    .sort(compareByAbsoluteBalance)
    .map((balance) => ({
      participantId: balance.participantId,
      remainingMinorUnits: -balance.balanceMinorUnits,
    }));

  const transfers: SettlementTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (
    creditorIndex < creditors.length &&
    debtorIndex < debtors.length
  ) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];

    const amountMinorUnits = Math.min(
      debtor.remainingMinorUnits,
      creditor.remainingMinorUnits,
    );

    if (amountMinorUnits > 0) {
      transfers.push({
        fromParticipantId: debtor.participantId,
        toParticipantId: creditor.participantId,
        amountMinorUnits,
      });
    }

    debtor.remainingMinorUnits -= amountMinorUnits;
    creditor.remainingMinorUnits -= amountMinorUnits;

    if (debtor.remainingMinorUnits === 0) {
      debtorIndex += 1;
    }

    if (creditor.remainingMinorUnits === 0) {
      creditorIndex += 1;
    }
  }

  return transfers;
}
