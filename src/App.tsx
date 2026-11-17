import { useEffect, useMemo, useState } from 'react';
import {
  EventDetailsStep,
  ExpenseDeletionDialog,
  ExpenseEntryStep,
  ExpenseSummaryStep,
  ParticipantRemovalDialog,
  ParticipantsStep,
  ResetEventDialog,
  SettlementStep,
} from './components';
import type { Event, Expense, Participant } from './types/models';
import {
  calculateParticipantBalances,
  createSettlementTransfers,
} from './services/settlementCalculator';
import { validateEventSettlement } from './services/settlementValidation';
import {
  clearStoredEvent,
  createEmptyEvent,
  loadEvent,
  saveEvent,
  type StorageStatus,
} from './services/eventStorage';
import {
  getParticipantRemovalBlockers,
  removeParticipantFromEvent,
} from './services/participantRemoval';
import { parseMoneyToMinorUnits } from './utils/parseMoney';

const STEPS = [
  { title: 'אירוע', hint: 'שם והגדרות', icon: 'event' },
  { title: 'משתתפים', hint: 'מי חלק מהקבוצה', icon: 'participants' },
  { title: 'הוצאות', hint: 'הוספה וניהול', icon: 'expenses' },
  { title: 'סיכום הוצאות', hint: 'בדיקת הפרטים', icon: 'summary' },
  { title: 'התחשבנות', hint: 'יתרות והעברות', icon: 'settlement' },
] as const;

type CommitResult = 'saved' | 'memory-only' | 'failed';

function WizardStepIcon({ icon }: { icon: (typeof STEPS)[number]['icon'] }) {
  return (
    <svg
      className="step-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === 'event' && (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
        </>
      )}
      {icon === 'participants' && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19v-1.5A5.5 5.5 0 0 1 9 12a5.5 5.5 0 0 1 5.5 5.5V19zM16 5.5a3 3 0 0 1 0 5.8M17 13a4.5 4.5 0 0 1 3.5 4.4V19h-4" />
        </>
      )}
      {icon === 'expenses' && (
        <>
          <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z" />
          <path d="M9 8h6M9 12h6M9 16h2" />
        </>
      )}
      {icon === 'summary' && (
        <>
          <path d="M7 4.5h10a2 2 0 0 1 2 2v13H5v-13a2 2 0 0 1 2-2z" />
          <path d="M9 4.5v-1h6v1M8.5 11.5l2 2 5-5M8.5 17h7" />
        </>
      )}
      {icon === 'settlement' && (
        <>
          <path d="M4 8h15M15.5 4.5 19 8l-3.5 3.5M20 16H5M8.5 12.5 5 16l3.5 3.5" />
        </>
      )}
    </svg>
  );
}

function App() {
  const [initialLoad] = useState(loadEvent);
  const [event, setEvent] = useState<Event>(initialLoad.event);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>(initialLoad.status);
  const [eventName, setEventName] = useState(initialLoad.event.name);
  const [participantName, setParticipantName] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [payerId, setPayerId] = useState(initialLoad.event.participants[0]?.id ?? '');
  const [sharedIds, setSharedIds] = useState<string[]>(
    initialLoad.event.participants.map((participant) => participant.id),
  );
  const [personalCharges, setPersonalCharges] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [replacementPayerId, setReplacementPayerId] = useState('');
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
  const [wizardToast, setWizardToast] = useState<{
    id: string;
    title: string;
    description: string;
    kind: 'success' | 'warning' | 'error';
  } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [scrollTarget, setScrollTarget] = useState<'bottom' | 'top'>('bottom');

  function commitEvent(nextEvent: Event): CommitResult {
    setEvent(nextEvent);
    if (storageStatus.kind !== 'ready') return 'memory-only';
    try {
      saveEvent(nextEvent);
      return 'saved';
    } catch {
      setStorageStatus({
        kind: 'memory-only',
      });
      setWizardToast({
        id: crypto.randomUUID(),
        title: 'השמירה נכשלה',
        description: 'השינויים נשארו בזיכרון, אך לא יישמרו בסגירת העמוד.',
        kind: 'error',
      });
      return 'failed';
    }
  }

  function showCommitToast(
    result: CommitResult,
    title: string,
    description: string,
  ) {
    if (result === 'failed') return;

    setWizardToast({
      id: crypto.randomUUID(),
      title: result === 'saved' ? title : `${title} — בזיכרון בלבד`,
      description: result === 'saved'
        ? description
        : `${description} השינויים לא יישמרו בסגירת העמוד.`,
      kind: result === 'saved' ? 'success' : 'warning',
    });
  }

  useEffect(() => {
    if (!wizardToast) return;

    const timeoutId = window.setTimeout(() => {
      setWizardToast(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [wizardToast]);

  useEffect(() => {
    function updateScrollTarget() {
      setScrollTarget(window.scrollY > 24 ? 'top' : 'bottom');
    }

    window.addEventListener('scroll', updateScrollTarget, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollTarget);
  }, []);

  const settlementValidation = useMemo(
    () => validateEventSettlement(event),
    [event],
  );
  const balances = useMemo(
    () => settlementValidation.valid ? calculateParticipantBalances(event) : [],
    [event, settlementValidation.valid],
  );
  const transfers = useMemo(
    () => createSettlementTransfers(balances),
    [balances],
  );
  const participantById = useMemo(
    () => new Map(
      event.participants.map((participant) => [participant.id, participant.name]),
    ),
    [event.participants],
  );
  const totalExpensesMinorUnits = useMemo(
    () => event.expenses.reduce(
      (sum, expense) => sum + expense.totalAmountMinorUnits,
      0,
    ),
    [event.expenses],
  );
  const participantBeingRemoved = event.participants.find(
    (participant) => participant.id === removingParticipantId,
  );
  const expenseBeingDeleted = event.expenses.find(
    (expense) => expense.id === deletingExpenseId,
  );
  const needsStorageRecovery = storageStatus.kind === 'invalid'
    || storageStatus.kind === 'unavailable';

  function applyLoadedEvent(loadedEvent: Event) {
    setEvent(loadedEvent);
    setEventName(loadedEvent.name);
    setParticipantName('');
    setPayerId(loadedEvent.participants[0]?.id ?? '');
    setSharedIds(loadedEvent.participants.map((participant) => participant.id));
    setPersonalCharges({});
    setWeights({});
    setExpenseDescription('');
    setExpenseAmount('');
    setEditingExpenseId(null);
    setDeletingExpenseId(null);
    setRemovingParticipantId(null);
    setReplacementPayerId('');
    setCurrentStep(0);
    setFormError('');
  }

  function saveEventName() {
    const name = eventName.trim();
    if (!name) {
      setFormError('');
      setWizardToast({
        id: crypto.randomUUID(),
        title: 'לא ניתן לשמור את שם האירוע',
        description: 'יש להזין שם אירוע.',
        kind: 'error',
      });
      return;
    }
    const result = commitEvent({
      ...event,
      name,
      createdAt: event.createdAt || new Date().toISOString(),
    });
    setFormError('');
    showCommitToast(result, 'שם האירוע עודכן', name);
  }

  function addParticipant() {
    const name = participantName.trim();
    if (!name) {
      setFormError('');
      setWizardToast({
        id: crypto.randomUUID(),
        title: 'לא ניתן להוסיף משתתף',
        description: 'יש להזין שם משתתף.',
        kind: 'error',
      });
      return;
    }
    if (event.participants.some((participant) => participant.name === name)) {
      setFormError('');
      setWizardToast({
        id: crypto.randomUUID(),
        title: 'לא ניתן להוסיף משתתף',
        description: 'משתתף עם שם זה כבר קיים.',
        kind: 'error',
      });
      return;
    }

    const participant: Participant = { id: crypto.randomUUID(), name };
    const result = commitEvent({
      ...event,
      participants: [...event.participants, participant],
    });
    setSharedIds((current) => [...current, participant.id]);
    setWeights((current) => ({ ...current, [participant.id]: '1' }));
    if (!payerId) setPayerId(participant.id);
    setParticipantName('');
    setFormError('');
    showCommitToast(result, 'המשתתף נוסף', name);
  }

  function requestRemoveParticipant(participantId: string) {
    const hasPayments = event.expenses.some((expense) =>
      expense.payments.some((payment) => payment.participantId === participantId),
    );
    const replacement = event.participants.find(
      (participant) => participant.id !== participantId,
    );
    setRemovingParticipantId(participantId);
    setReplacementPayerId(hasPayments ? replacement?.id ?? '' : '');
  }

  function confirmRemoveParticipant() {
    if (!removingParticipantId) return;

    commitEvent(removeParticipantFromEvent(
      event,
      removingParticipantId,
      replacementPayerId || undefined,
    ));
    const participantId = removingParticipantId;
    setSharedIds((current) => current.filter((id) => id !== participantId));
    setWeights((current) => {
      const { [participantId]: _removedWeight, ...remainingWeights } = current;
      return remainingWeights;
    });
    setPersonalCharges((current) => {
      const { [participantId]: _removedCharge, ...remainingCharges } = current;
      return remainingCharges;
    });
    if (payerId === participantId) {
      setPayerId(
        replacementPayerId
        || event.participants.find((participant) => participant.id !== participantId)?.id
        || '',
      );
    }
    setRemovingParticipantId(null);
    setReplacementPayerId('');
    setFormError('');
  }

  function cancelRemoveParticipant() {
    setRemovingParticipantId(null);
    setReplacementPayerId('');
  }

  function toggleSharedParticipant(participantId: string) {
    setSharedIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
  }

  function addExpense() {
    function rejectExpense(message: string) {
      setFormError('');
      setWizardToast({
        id: crypto.randomUUID(),
        title: 'לא ניתן להוסיף את ההוצאה',
        description: message,
        kind: 'error',
      });
    }

    const description = expenseDescription.trim();
    const totalAmountMinorUnits = parseMoneyToMinorUnits(expenseAmount);

    if (!description) {
      rejectExpense('יש להזין תיאור להוצאה.');
      return;
    }
    if (totalAmountMinorUnits === null || totalAmountMinorUnits <= 0) {
      rejectExpense('יש להזין סכום חיובי תקין.');
      return;
    }
    if (!payerId) {
      rejectExpense('יש לבחור מי שילם.');
      return;
    }
    const sharedParticipants = [];
    for (const participantId of sharedIds) {
      const rawWeight = weights[participantId] ?? '1';
      const weight = Number(rawWeight);
      if (!rawWeight.trim() || !Number.isFinite(weight) || weight <= 0) {
        rejectExpense('משקל חלוקה חייב להיות מספר חיובי.');
        return;
      }
      sharedParticipants.push({ participantId, weight });
    }

    const expensePersonalCharges = [];
    for (const [participantId, rawAmount] of Object.entries(personalCharges)) {
      if (!rawAmount.trim()) continue;
      const amountMinorUnits = parseMoneyToMinorUnits(rawAmount);
      if (amountMinorUnits === null) {
        const participantName = event.participants.find(
          (participant) => participant.id === participantId,
        )?.name ?? '';
        rejectExpense(`יש להזין סכום תקין לחיוב האישי של ${participantName}.`);
        return;
      }
      if (amountMinorUnits > 0) {
        expensePersonalCharges.push({ participantId, amountMinorUnits });
      }
    }

    const personalTotalMinorUnits = expensePersonalCharges.reduce(
      (sum, charge) => sum + charge.amountMinorUnits,
      0,
    );
    if (!Number.isSafeInteger(personalTotalMinorUnits)) {
      rejectExpense('סכום החיובים האישיים גדול מדי.');
      return;
    }
    if (personalTotalMinorUnits > totalAmountMinorUnits) {
      rejectExpense('סכום החיובים האישיים לא יכול לעלות על סכום ההוצאה.');
      return;
    }
    if (sharedParticipants.length === 0 && personalTotalMinorUnits !== totalAmountMinorUnits) {
      rejectExpense('יש לבחור משתתפים לחלוקה או להזין חיובים אישיים שסכומם מכסה את כל ההוצאה.');
      return;
    }

    const existingExpense = editingExpenseId
      ? event.expenses.find((item) => item.id === editingExpenseId)
      : undefined;
    const expense: Expense = {
      id: existingExpense?.id ?? crypto.randomUUID(),
      description,
      totalAmountMinorUnits,
      payments: [{ participantId: payerId, amountMinorUnits: totalAmountMinorUnits }],
      sharedParticipants,
      personalCharges: expensePersonalCharges,
      createdAt: existingExpense?.createdAt ?? new Date().toISOString(),
    };

    let result: CommitResult;
    if (existingExpense) {
      result = commitEvent({
        ...event,
        expenses: event.expenses.map((item) =>
          item.id === existingExpense.id ? expense : item,
        ),
      });
    } else {
      result = commitEvent({ ...event, expenses: [...event.expenses, expense] });
    }

    showCommitToast(
      result,
      existingExpense ? 'ההוצאה עודכנה' : 'ההוצאה נוספה',
      description,
    );
    setEditingExpenseId(null);
    setExpenseDescription('');
    setExpenseAmount('');
    setPersonalCharges({});
    setFormError('');
  }

  function editExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setExpenseDescription(expense.description);
    setExpenseAmount((expense.totalAmountMinorUnits / 100).toFixed(2));
    setPayerId(expense.payments[0]?.participantId ?? event.participants[0]?.id ?? '');
    setSharedIds(expense.sharedParticipants.map((participant) => participant.participantId));
    setPersonalCharges(Object.fromEntries(
      expense.personalCharges.map((charge) => [
        charge.participantId,
        (charge.amountMinorUnits / 100).toFixed(2),
      ]),
    ));
    setWeights((current) => ({
      ...current,
      ...Object.fromEntries(
        expense.sharedParticipants.map((participant) => [
          participant.participantId,
          String(participant.weight),
        ]),
      ),
    }));
    setFormError('');
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelExpenseEdit() {
    setEditingExpenseId(null);
    setExpenseDescription('');
    setExpenseAmount('');
    setPersonalCharges({});
    setFormError('');
  }

  function removeExpense(expenseId: string) {
    const deletedExpense = event.expenses.find((expense) => expense.id === expenseId);
    if (!deletedExpense) return;

    const result = commitEvent({
      ...event,
      expenses: event.expenses.filter((expense) => expense.id !== expenseId),
    });
    showCommitToast(result, 'ההוצאה נמחקה', deletedExpense.description);
    if (editingExpenseId === expenseId) {
      cancelExpenseEdit();
    }
    setDeletingExpenseId(null);
  }

  function getStepNavigationError(targetStep: number): string | null {
    if (targetStep >= 1 && !event.name.trim()) {
      return 'יש לשמור תחילה שם אירוע.';
    }
    if (targetStep >= 2 && event.participants.length === 0) {
      return 'יש להוסיף לפחות משתתף אחד.';
    }
    return null;
  }

  function navigateToStep(targetStep: number) {
    if (targetStep > currentStep) {
      const navigationError = getStepNavigationError(targetStep);
      if (navigationError) {
        setFormError('');
        setWizardToast({
          id: crypto.randomUUID(),
          title: 'לא ניתן לעבור לשלב זה',
          description: navigationError,
          kind: 'error',
        });
        return;
      }
    }

    setFormError('');
    setCurrentStep(targetStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToNextStep() {
    navigateToStep(Math.min(currentStep + 1, STEPS.length - 1));
  }

  function goToPreviousStep() {
    navigateToStep(Math.max(currentStep - 1, 0));
  }

  function jumpToStep(step: number) {
    navigateToStep(step);
  }

  function retryStorageLoad() {
    const result = loadEvent();
    applyLoadedEvent(result.event);
    setStorageStatus(result.status);
  }

  function continueWithoutSaving() {
    setStorageStatus({ kind: 'memory-only' });
  }

  function startWithEmptyEvent() {
    try {
      clearStoredEvent();
      const emptyEvent = createEmptyEvent();
      applyLoadedEvent(emptyEvent);
      setStorageStatus({ kind: 'ready' });
    } catch {
      setStorageStatus({
        kind: 'unavailable',
        message: 'לא ניתן לנקות את הנתונים השמורים. הם לא שונו.',
      });
    }
  }

  function resetEventMemory() {
    try {
      const emptyEvent = createEmptyEvent();
      clearStoredEvent();
      applyLoadedEvent(emptyEvent);
      setStorageStatus({ kind: 'ready' });
      setWizardToast(null);
      setResetConfirmationOpen(false);
      setDeletingExpenseId(null);
    } catch {
      setFormError('איפוס האירוע נכשל. נסו שוב.');
    }
  }

  return (
    <main className="app-shell" tabIndex={-1}>
      <header className="app-header">
        <img
          className="app-logo"
          src="/splitsmart-logo.png"
          alt="SplitSmart — חלוקת הוצאות בין משתתפים"
        />
      </header>

      {needsStorageRecovery ? (
        <section className="card storage-recovery" role="alert">
          <h2>בעיה בנתונים השמורים</h2>
          <p>{storageStatus.message}</p>
          {storageStatus.kind === 'invalid' ? (
            <button className="primary" type="button" onClick={startWithEmptyEvent}>
              מחיקת הנתונים הפגומים והתחלה מחדש
            </button>
          ) : (
            <button className="primary" type="button" onClick={retryStorageLoad}>
              נסה לטעון שוב
            </button>
          )}
          <button className="secondary" type="button" onClick={continueWithoutSaving}>
            המשך עם אירוע חדש ללא שמירה
          </button>
        </section>
      ) : (
        <>
          <nav className="wizard-progress" aria-label="שלבי ההקמה">
            {STEPS.map((step, index) => (
              <button
                type="button"
                key={step.title}
                className={`wizard-step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'complete' : ''}`}
                onClick={() => jumpToStep(index)}
                aria-current={index === currentStep ? 'step' : undefined}
                aria-label={`שלב ${index + 1}: ${step.title} — ${step.hint}`}
                title={step.title}
              >
                <WizardStepIcon icon={step.icon} />
                <span className="step-number">{index < currentStep ? '✓' : index + 1}</span>
                <span className="step-copy"><strong>{step.title}</strong><small>{step.hint}</small></span>
              </button>
            ))}
          </nav>

          {currentStep === 0 && (
            <EventDetailsStep
              eventName={eventName}
              onEventNameChange={setEventName}
              onSave={saveEventName}
            />
          )}
          {currentStep === 1 && (
            <ParticipantsStep
              participants={event.participants}
              participantName={participantName}
              weights={weights}
              onParticipantNameChange={setParticipantName}
              onWeightChange={(participantId, weight) =>
                setWeights((current) => ({ ...current, [participantId]: weight }))
              }
              onAddParticipant={addParticipant}
              onRequestRemoveParticipant={requestRemoveParticipant}
            />
          )}
          {currentStep === 2 && (
            <ExpenseEntryStep
              participants={event.participants}
              expenseCount={event.expenses.length}
              totalAmountMinorUnits={totalExpensesMinorUnits}
              description={expenseDescription}
              amount={expenseAmount}
              payerId={payerId}
              sharedIds={sharedIds}
              personalCharges={personalCharges}
              weights={weights}
              isEditing={editingExpenseId !== null}
              onDescriptionChange={setExpenseDescription}
              onAmountChange={setExpenseAmount}
              onPayerChange={setPayerId}
              onWeightChange={(participantId, weight) =>
                setWeights((current) => ({ ...current, [participantId]: weight }))
              }
              onPersonalChargeChange={(participantId, amount) =>
                setPersonalCharges((current) => ({ ...current, [participantId]: amount }))
              }
              onToggleShared={toggleSharedParticipant}
              onSubmit={addExpense}
              onCancel={cancelExpenseEdit}
            />
          )}
          {currentStep === 3 && (
            <ExpenseSummaryStep
              expenses={event.expenses}
              participantById={participantById}
              totalAmountMinorUnits={totalExpensesMinorUnits}
              onEdit={editExpense}
              onRemove={setDeletingExpenseId}
            />
          )}
          {currentStep === 4 && (
            <SettlementStep
              balances={balances}
              transfers={transfers}
              participantById={participantById}
              validation={settlementValidation}
            />
          )}

          {participantBeingRemoved && removingParticipantId && (
            <ParticipantRemovalDialog
              participant={participantBeingRemoved}
              participants={event.participants}
              replacementPayerId={replacementPayerId}
              paidExpensesCount={event.expenses.filter((expense) =>
                expense.payments.some(
                  (payment) => payment.participantId === removingParticipantId,
                ),
              ).length}
              affectedExpensesCount={event.expenses.filter((expense) =>
                expense.payments.some(
                  (payment) => payment.participantId === removingParticipantId,
                ) || expense.sharedParticipants.some(
                  (item) => item.participantId === removingParticipantId,
                ) || expense.personalCharges.some(
                  (charge) => charge.participantId === removingParticipantId,
                ),
              ).length}
              blockedExpenses={getParticipantRemovalBlockers(event, removingParticipantId)}
              onReplacementChange={setReplacementPayerId}
              onConfirm={confirmRemoveParticipant}
              onCancel={cancelRemoveParticipant}
            />
          )}

          {expenseBeingDeleted && (
            <ExpenseDeletionDialog
              expense={expenseBeingDeleted}
              onConfirm={() => removeExpense(expenseBeingDeleted.id)}
              onCancel={() => setDeletingExpenseId(null)}
            />
          )}

          {resetConfirmationOpen && (
            <ResetEventDialog
              onConfirm={resetEventMemory}
              onCancel={() => setResetConfirmationOpen(false)}
            />
          )}

          {storageStatus.kind === 'memory-only' && (
            <div className="error wizard-error" role="alert">
              האירוע נשמר רק בזיכרון הדפדפן. הנתונים יימחקו בסגירת העמוד.
            </div>
          )}
          {formError && <div className="error wizard-error" role="alert">{formError}</div>}

          <footer className={`wizard-actions ${currentStep === STEPS.length - 1 ? 'wizard-actions-final' : ''}`}>
            {wizardToast && (
              <div
                className={`wizard-toast wizard-toast-${wizardToast.kind}`}
                role={wizardToast.kind === 'success' ? 'status' : 'alert'}
                aria-live={wizardToast.kind === 'success' ? 'polite' : 'assertive'}
                key={wizardToast.id}
              >
                <span aria-hidden="true">{wizardToast.kind === 'success' ? '✓' : '!'}</span>
                <div>
                  <strong>{wizardToast.title}</strong>
                  <p>{wizardToast.description}</p>
                </div>
                <button
                  type="button"
                  className="expense-popup-dismiss"
                  aria-label="סגירת הודעת האישור"
                  onClick={() => setWizardToast(null)}
                >
                  ×
                </button>
              </div>
            )}
            <button
              type="button"
              className="secondary"
              onClick={goToPreviousStep}
              disabled={currentStep === 0}
            >
              הקודם
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button type="button" className="primary" onClick={goToNextStep}>הבא</button>
            ) : (
              <div className="wizard-end-actions">
                <button type="button" className="primary" onClick={() => jumpToStep(0)}>
                  חזרה להתחלה
                </button>
                <button
                  type="button"
                  className="secondary reset-memory-button"
                  onClick={() => setResetConfirmationOpen(true)}
                >
                  חישוב חדש
                </button>
              </div>
            )}
          </footer>
        </>
      )}
      <button
        className="scroll-to-bottom"
        type="button"
        aria-label={scrollTarget === 'bottom' ? 'גלילה לתחתית העמוד' : 'גלילה לראש העמוד'}
        title={scrollTarget === 'bottom' ? 'גלילה לתחתית' : 'גלילה לראש העמוד'}
        onClick={() => {
          const targetTop = scrollTarget === 'bottom'
            ? document.documentElement.scrollHeight
            : 0;
          setScrollTarget(scrollTarget === 'bottom' ? 'top' : 'bottom');
          window.scrollTo({ top: targetTop, behavior: 'smooth' });
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {scrollTarget === 'bottom'
            ? <path d="M12 4v15M5.5 13.5 12 20l6.5-6.5" />
            : <path d="M12 20V5M5.5 10.5 12 4l6.5 6.5" />}
        </svg>
      </button>
    </main>
  );
}

export default App;
