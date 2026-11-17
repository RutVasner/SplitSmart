import type { Expense } from '../types/models';
import { formatMoney } from '../utils/formatMoney';

interface ExpenseSummaryStepProps {
  expenses: Expense[];
  participantById: Map<string, string>;
  totalAmountMinorUnits: number;
  onEdit: (expense: Expense) => void;
  onRemove: (expenseId: string) => void;
}

export function ExpenseSummaryStep({
  expenses,
  participantById,
  totalAmountMinorUnits,
  onEdit,
  onRemove,
}: ExpenseSummaryStepProps) {
  return (
    <section className="card wizard-card expense-review-card">
      <div className="wizard-card-heading">
        <h2>סיכום ההוצאות</h2>
        <p>בדקו את ההוצאות לפני המעבר להתחשבנות.</p>
      </div>
      <div className="expense-review-total">
        <span>{expenses.length} הוצאות</span>
        <strong>{formatMoney(totalAmountMinorUnits)}</strong>
      </div>
      {expenses.length === 0 ? (
        <p className="empty">עדיין לא נוספו הוצאות לאירוע.</p>
      ) : (
        <ul className="expense-review-list">
          {expenses.map((expense) => (
            <li key={expense.id}>
              <div className="expense-review-details">
                <div className="expense-review-heading">
                  <strong>{expense.description}</strong>
                  <strong>{formatMoney(expense.totalAmountMinorUnits)}</strong>
                </div>
                <p>
                  תשלומים: {expense.payments.map((payment) =>
                    `${participantById.get(payment.participantId) ?? 'משתתף לא ידוע'} — ${formatMoney(payment.amountMinorUnits)}`,
                  ).join(' · ') || 'לא צוינו'}
                </p>
                <p>
                  חלוקה משותפת: {expense.sharedParticipants.map((participant) =>
                    participantById.get(participant.participantId) ?? 'משתתף לא ידוע',
                  ).join(', ') || 'אין משתתפים'}
                </p>
                {expense.personalCharges.length > 0 && (
                  <p>
                    חיובים אישיים: {expense.personalCharges.map((charge) =>
                      `${participantById.get(charge.participantId) ?? 'משתתף לא ידוע'} — ${formatMoney(charge.amountMinorUnits)}`,
                    ).join(' · ')}
                  </p>
                )}
              </div>
              <div className="expense-review-actions">
                <button
                  className="expense-icon-button"
                  type="button"
                  aria-label={`עריכת הוצאה ${expense.description}`}
                  title="עריכת הוצאה"
                  onClick={() => onEdit(expense)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m15 5 4 4M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
                  </svg>
                </button>
                <button
                  className="expense-icon-button danger"
                  type="button"
                  aria-label={`הסרת הוצאה ${expense.description}`}
                  title="הסרת הוצאה"
                  onClick={() => onRemove(expense.id)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
