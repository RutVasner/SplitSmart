import type { ParticipantBalance, SettlementTransfer } from '../types/models';
import type { SettlementValidationResult } from '../services/settlementValidation';
import { formatMoney } from '../utils/formatMoney';

interface SettlementStepProps {
  balances: ParticipantBalance[];
  transfers: SettlementTransfer[];
  participantById: Map<string, string>;
  validation: SettlementValidationResult;
}

export function SettlementStep({
  balances,
  transfers,
  participantById,
  validation,
}: SettlementStepProps) {
  return (
    <section className="card wizard-card">
      <div className="wizard-card-heading">
        <h2>יתרות והסדרים</h2>
      </div>
      {!validation.valid ? (
        <div className="settlement-validation-error" role="alert">
          <h3>לא ניתן להציג התחשבנות תקינה</h3>
          <p>
            סך התשלומים שניתן לאמת: {formatMoney(validation.totalPaidMinorUnits)}
            {' · '}
            סך החיובים שניתן לאמת: {formatMoney(validation.totalOwedMinorUnits)}
          </p>
          <p>תקנו את הנתונים הבאים וחזרו למסך זה:</p>
          <ul>
            {validation.issues.map((issue, index) => (
              <li key={`${issue.expenseId}-${index}`}>
                <strong>{issue.expenseDescription}:</strong> {issue.message}
              </li>
            ))}
          </ul>
          <strong className="settlement-difference">
            הפרש נטו: {formatMoney(Math.abs(validation.differenceMinorUnits))}
          </strong>
        </div>
      ) : balances.length === 0 ? (
        <p className="empty">היתרות יופיעו לאחר הוספת משתתפים והוצאות.</p>
      ) : (
        <>
          <div className="balance-grid">
            {balances.map((balance) => (
              <div className="balance" key={balance.participantId}>
                <strong>{participantById.get(balance.participantId)}</strong>
                <span className={balance.balanceMinorUnits >= 0 ? 'positive' : 'negative'}>
                  {balance.balanceMinorUnits >= 0 ? '+' : ''}{formatMoney(balance.balanceMinorUnits)}
                </span>
                <small>
                  שילם {formatMoney(balance.paidMinorUnits)} · צריך {formatMoney(balance.shouldPayMinorUnits)}
                </small>
              </div>
            ))}
          </div>

          {transfers.length > 0 && (
            <div className="transfers">
              <h3>תשלומים מומלצים</h3>
              {transfers.map((transfer, index) => (
                <div
                  className="transfer"
                  key={`${transfer.fromParticipantId}-${transfer.toParticipantId}-${index}`}
                >
                  <span>
                    <strong>{participantById.get(transfer.fromParticipantId)}</strong>
                    {' מעביר/ה ל־'}
                    <strong>{participantById.get(transfer.toParticipantId)}</strong>
                  </span>
                  <strong>{formatMoney(transfer.amountMinorUnits)}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
