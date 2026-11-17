import type { Participant } from '../types/models';
import { formatMoney } from '../utils/formatMoney';
import { parseMoneyToMinorUnits } from '../utils/parseMoney';

interface ExpenseEntryStepProps {
  participants: Participant[];
  expenseCount: number;
  totalAmountMinorUnits: number;
  description: string;
  amount: string;
  payerId: string;
  sharedIds: string[];
  personalCharges: Record<string, string>;
  weights: Record<string, string>;
  isEditing: boolean;
  onDescriptionChange: (description: string) => void;
  onAmountChange: (amount: string) => void;
  onPayerChange: (participantId: string) => void;
  onWeightChange: (participantId: string, weight: string) => void;
  onPersonalChargeChange: (participantId: string, amount: string) => void;
  onToggleShared: (participantId: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ExpenseEntryStep({
  participants,
  expenseCount,
  totalAmountMinorUnits,
  description,
  amount,
  payerId,
  sharedIds,
  personalCharges,
  weights,
  isEditing,
  onDescriptionChange,
  onAmountChange,
  onPayerChange,
  onWeightChange,
  onPersonalChargeChange,
  onToggleShared,
  onSubmit,
  onCancel,
}: ExpenseEntryStepProps) {
  const totalMinorUnits = parseMoneyToMinorUnits(amount);
  const parsedPersonalCharges = Object.values(personalCharges)
    .filter((rawAmount) => rawAmount.trim())
    .map(parseMoneyToMinorUnits);
  const hasInvalidPersonalCharge = parsedPersonalCharges.some(
    (amount) => amount === null,
  );
  const personalTotalMinorUnits = parsedPersonalCharges.reduce<number>(
    (sum, amount) => sum + (amount ?? 0),
    0,
  );
  const sharedAmountMinorUnits = totalMinorUnits === null
    || hasInvalidPersonalCharge
    || !Number.isSafeInteger(personalTotalMinorUnits)
    ? null
    : totalMinorUnits - personalTotalMinorUnits;

  return (
    <section className="card wizard-card expense-manager-card">
      <div className="wizard-card-heading expense-manager-heading">
        <div>
          <h2>הוצאות האירוע</h2>
          <p>{expenseCount} הוצאות · סך הכול {formatMoney(totalAmountMinorUnits)}</p>
        </div>
      </div>

      {participants.length < 1 ? (
        <p className="empty">יש להוסיף משתתפים לפני הוספת הוצאה.</p>
      ) : (
        <div className="expense-manager-content">
          <form
            className="expense-form"
            noValidate
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              onSubmit();
            }}
          >
            <h3>{isEditing ? 'עריכת הוצאה' : 'הוספת הוצאה'}</h3>
            <div className="expense-grid">
              <label className="field">
                תיאור
                <input
                  value={description}
                  onChange={(event) => onDescriptionChange(event.target.value)}
                  placeholder="לדוגמה: ארוחת ערב"
                />
              </label>
              <label className="field">
                סכום בשקלים
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => onAmountChange(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="field">
                מי שילם?
                <select value={payerId} onChange={(event) => onPayerChange(event.target.value)}>
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>{participant.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="shares">
              <legend>מי משתתף בחלוקה?</legend>
              {participants.map((participant) => (
                <div className="share-row" key={participant.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={sharedIds.includes(participant.id)}
                      onChange={() => onToggleShared(participant.id)}
                    />
                    {participant.name}
                  </label>
                  <label className="weight-field">
                    משקל
                    <input
                      type="number"
                      min="0.01"
                      step="0.5"
                      aria-label={`משקל חלוקה של ${participant.name}`}
                      value={weights[participant.id] ?? '1'}
                      disabled={!sharedIds.includes(participant.id)}
                      onChange={(event) => onWeightChange(participant.id, event.target.value)}
                    />
                  </label>
                </div>
              ))}
            </fieldset>

            <fieldset className="personal-charges">
              <legend>חיובים אישיים (לא חובה)</legend>
              <p>החיובים האישיים כלולים בסכום ההוצאה, והיתרה מתחלקת בין המשתתפים שסומנו.</p>
              <div className="personal-charge-list">
                {participants.map((participant) => (
                  <label className="personal-charge-row" key={participant.id}>
                    <span>{participant.name}</span>
                    <span className="personal-charge-input">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={personalCharges[participant.id] ?? ''}
                        aria-label={`חיוב אישי של ${participant.name}`}
                        placeholder="0.00"
                        onChange={(event) =>
                          onPersonalChargeChange(participant.id, event.target.value)
                        }
                      />
                      <span aria-hidden="true">₪</span>
                    </span>
                  </label>
                ))}
              </div>
              {sharedAmountMinorUnits !== null && (
                <p className={`shared-amount ${sharedAmountMinorUnits < 0 ? 'negative' : ''}`}>
                  נותר לחלוקה משותפת: {formatMoney(sharedAmountMinorUnits)}
                </p>
              )}
            </fieldset>

            <div className="expense-form-actions">
              <button className="primary expense-submit" type="submit">
                {isEditing ? 'שמור שינויים' : 'הוסף הוצאה'}
              </button>
              {isEditing && (
                <button className="secondary expense-cancel" type="button" onClick={onCancel}>
                  ביטול
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
