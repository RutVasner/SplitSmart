import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import type { Expense, Participant } from '../types/models';

interface ParticipantRemovalDialogProps {
  participant: Participant;
  replacementPayerId: string;
  participants: Participant[];
  paidExpensesCount: number;
  affectedExpensesCount: number;
  blockedExpenses: Expense[];
  onReplacementChange: (participantId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ParticipantRemovalDialog({
  participant,
  replacementPayerId,
  participants,
  paidExpensesCount,
  affectedExpensesCount,
  blockedExpenses,
  onReplacementChange,
  onConfirm,
  onCancel,
}: ParticipantRemovalDialogProps) {
  const dialogRef = useDialogAccessibility(onCancel);
  const replacementParticipants = participants.filter(
    (candidate) => candidate.id !== participant.id,
  );
  const requiresReplacement = paidExpensesCount > 0;
  const canConfirm = blockedExpenses.length === 0
    && (!requiresReplacement || replacementPayerId !== '');

  return (
    <div className="dialog-backdrop">
      <section
        className="participant-removal-dialog"
        role="alertdialog"
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby="participant-removal-title"
        aria-describedby="participant-removal-description"
      >
        <h2 id="participant-removal-title">הסרת {participant.name}</h2>
        <p id="participant-removal-description">
          ההסרה תשפיע על {affectedExpensesCount} הוצאות שבהן המשתתף מופיע כתשלום, בחלוקה או בחיוב אישי.
          חלקו וחיוביו יוסרו והחלוקה תחושב מחדש לפי המשתתפים והחיובים שנותרו.
          {requiresReplacement && ' סכומי התשלומים יועברו למשתתף שתבחרו.'}
        </p>

        {requiresReplacement && (
          <label className="field removal-replacement-field">
            {participant.name} שילם/ה ב־{paidExpensesCount} הוצאות.
            בחירת מחליף תשמור את סכומי התשלומים:
            <select
              autoFocus
              value={replacementPayerId}
              onChange={(event) => onReplacementChange(event.target.value)}
            >
              <option value="">יש לבחור משתתף</option>
              {replacementParticipants.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))}
            </select>
          </label>
        )}

        {blockedExpenses.length > 0 && (
          <div className="removal-blockers" role="alert">
            <strong>לא ניתן להסיר עדיין.</strong>
            <p>
              ההוצאות הבאות יאבדו חלק מהסכום בלי חלוקה שנותרה. ערכו אותן תחילה והקצו את
              מלוא הסכום למשתתפים הנותרים:
            </p>
            <ul>
              {blockedExpenses.map((expense) => (
                <li key={expense.id}>{expense.description}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="removal-dialog-actions">
          <button className="secondary" type="button" onClick={onCancel}>ביטול</button>
          <button
            className="primary danger-action"
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            הסרה והמשך
          </button>
        </div>
      </section>
    </div>
  );
}
