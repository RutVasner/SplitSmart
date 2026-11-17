import type { Event, Expense } from '../types/models';
import { calculateExpenseCharges, validateExpense } from './expenseCalculator';

export interface SettlementIssue {
  expenseId: string;
  expenseDescription: string;
  message: string;
}

export interface SettlementValidationResult {
  valid: boolean;
  totalPaidMinorUnits: number;
  totalOwedMinorUnits: number;
  differenceMinorUnits: number;
  issues: SettlementIssue[];
}

function sumMinorUnits(values: number[]): number | null {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    total += value;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

export function validateEventSettlement(event: Event): SettlementValidationResult {
  const participantIds = new Set(event.participants.map((participant) => participant.id));
  const issues: SettlementIssue[] = [];
  let totalPaidMinorUnits = 0;
  let totalOwedMinorUnits = 0;

  const addIssue = (expense: Expense, message: string) => {
    issues.push({
      expenseId: expense.id,
      expenseDescription: expense.description,
      message,
    });
  };

  for (const expense of event.expenses) {
    const chargeValidation = validateExpense({ ...expense, payments: [] });
    for (const message of chargeValidation.errors) {
      addIssue(expense, message);
    }

    const invalidPaymentReference = expense.payments.some(
      (payment) => !participantIds.has(payment.participantId),
    );
    const invalidChargeReference = [
      ...expense.sharedParticipants,
      ...expense.personalCharges,
    ].some((entry) => !participantIds.has(entry.participantId));

    if (invalidPaymentReference) {
      addIssue(expense, 'תשלום משויך למשתתף שאינו קיים באירוע.');
    }
    if (invalidChargeReference) {
      addIssue(expense, 'חלוקה או חיוב אישי משויכים למשתתף שאינו קיים באירוע.');
    }
    if (expense.payments.length === 0) {
      addIssue(expense, 'לא צוין מי שילם על ההוצאה.');
    }

    const paymentTotal = sumMinorUnits(
      expense.payments.map((payment) => payment.amountMinorUnits),
    );
    if (paymentTotal === null) {
      addIssue(expense, 'סכומי התשלומים אינם תקינים או גדולים מדי.');
    } else {
      totalPaidMinorUnits += paymentTotal;
      if (!Number.isSafeInteger(totalPaidMinorUnits)) {
        addIssue(expense, 'סך התשלומים באירוע גדול מדי לחישוב מדויק.');
        totalPaidMinorUnits -= paymentTotal;
      }
      if (paymentTotal !== expense.totalAmountMinorUnits) {
        addIssue(expense, 'סך התשלומים אינו תואם לסכום ההוצאה.');
      }
    }

    const canCalculateCharges = chargeValidation.valid && !invalidChargeReference;
    if (!canCalculateCharges) continue;

    const charges = calculateExpenseCharges(expense);
    const chargeTotal = sumMinorUnits(
      charges.map((charge) => charge.amountOwedMinorUnits),
    );
    if (chargeTotal === null) {
      addIssue(expense, 'סכומי החיובים אינם תקינים או גדולים מדי.');
      continue;
    }

    totalOwedMinorUnits += chargeTotal;
    if (!Number.isSafeInteger(totalOwedMinorUnits)) {
      addIssue(expense, 'סך החיובים באירוע גדול מדי לחישוב מדויק.');
      totalOwedMinorUnits -= chargeTotal;
      continue;
    }
    if (chargeTotal !== expense.totalAmountMinorUnits) {
      addIssue(
        expense,
        `החיובים מסתכמים ב־${chargeTotal} אגורות, אך סכום ההוצאה הוא ${expense.totalAmountMinorUnits} אגורות.`,
      );
    }
  }

  const differenceMinorUnits = totalPaidMinorUnits - totalOwedMinorUnits;
  if (differenceMinorUnits !== 0) {
    issues.push({
      expenseId: '',
      expenseDescription: 'סיכום האירוע',
      message: `סך התשלומים וסך החיובים אינם שווים. ההפרש הוא ${Math.abs(differenceMinorUnits)} אגורות.`,
    });
  }

  return {
    valid: issues.length === 0,
    totalPaidMinorUnits,
    totalOwedMinorUnits,
    differenceMinorUnits,
    issues,
  };
}
