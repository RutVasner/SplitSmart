import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import type { Expense } from '../types/models';
import { formatMoney } from '../utils/formatMoney';

interface ExpenseDeletionDialogProps {
  expense: Expense;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExpenseDeletionDialog({
  expense,
  onConfirm,
  onCancel,
}: ExpenseDeletionDialogProps) {
  const dialogRef = useDialogAccessibility(onCancel);

  return (
    <div className="dialog-backdrop">
      <section
        className="delete-expense-dialog"
        role="alertdialog"
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby="delete-expense-title"
        aria-describedby="delete-expense-description"
      >
        <h2 id="delete-expense-title">למחוק את ההוצאה?</h2>
        <p id="delete-expense-description">
          ההוצאה „{expense.description}” בסך {formatMoney(expense.totalAmountMinorUnits)}
          {' '}תימחק מהאירוע. לא ניתן יהיה לשחזר אותה.
        </p>
        <div className="removal-dialog-actions">
          <button className="secondary" type="button" onClick={onCancel}>ביטול</button>
          <button className="primary delete-expense-confirm" type="button" onClick={onConfirm}>
            מחיקת ההוצאה
          </button>
        </div>
      </section>
    </div>
  );
}
