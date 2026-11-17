// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

async function openParticipantsStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('שם האירוע'), 'Weekend trip');
  await user.click(screen.getByRole('button', { name: 'שמור שם' }));
  await user.click(screen.getByRole('button', { name: /הבא/ }));
}

async function addParticipant(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.type(screen.getByLabelText('שם משתתף'), name);
  await user.click(screen.getByRole('button', { name: 'הוסף' }));
  expect(screen.getByRole('list').textContent).toContain(name);
}

async function openExpenseStep(user: ReturnType<typeof userEvent.setup>) {
  await openParticipantsStep(user);
  await addParticipant(user, 'Dana');
  await addParticipant(user, 'Yael');
  await user.click(screen.getByRole('button', { name: /הבא/ }));
}

async function fillExpense(
  user: ReturnType<typeof userEvent.setup>,
  description: string,
  amount: string,
) {
  await user.type(screen.getByLabelText('תיאור'), description);
  await user.type(screen.getByLabelText('סכום בשקלים'), amount);
}

describe('SplitSmart user flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('requires an event name before moving to participants', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /הבא/ }));

    const validationPopup = screen.getByRole('alert');
    expect(within(validationPopup).getByText('יש לשמור תחילה שם אירוע.')).toBeTruthy();
    expect(validationPopup.classList.contains('wizard-toast')).toBe(true);
    expect(screen.getByRole('heading', { name: 'פרטי האירוע' })).toBeTruthy();

    await user.type(screen.getByLabelText('שם האירוע'), 'Weekend trip');
    await user.click(screen.getByRole('button', { name: 'שמור שם' }));
    expect(screen.getByRole('status').textContent).toContain('שם האירוע עודכן');
    await user.click(screen.getByRole('button', { name: /הבא/ }));

    expect(screen.getByRole('heading', { name: 'מי משתתף?' })).toBeTruthy();
  });

  it('shows a toast when moving forward without participants', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openParticipantsStep(user);

    await user.click(screen.getByRole('button', { name: /הבא/ }));

    const validationPopup = screen.getByRole('alert');
    expect(within(validationPopup).getByText('יש להוסיף לפחות משתתף אחד.')).toBeTruthy();
    expect(validationPopup.classList.contains('wizard-toast')).toBe(true);
  });

  it('applies the same prerequisites to direct step navigation and allows empty expenses', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^שלב 5:/ }));
    expect(screen.getByRole('heading', { name: 'פרטי האירוע' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('יש לשמור תחילה שם אירוע.');

    await user.type(screen.getByLabelText('שם האירוע'), 'Weekend trip');
    await user.click(screen.getByRole('button', { name: 'שמור שם' }));
    await user.click(screen.getByRole('button', { name: /^שלב 2:/ }));
    expect(screen.getByRole('heading', { name: 'מי משתתף?' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^שלב 4:/ }));
    expect(screen.getByRole('heading', { name: 'מי משתתף?' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('יש להוסיף לפחות משתתף אחד.');

    await addParticipant(user, 'Dana');
    await user.click(screen.getByRole('button', { name: /^שלב 4:/ }));
    expect(screen.getByRole('heading', { name: 'סיכום ההוצאות' })).toBeTruthy();
    expect(screen.getByText('עדיין לא נוספו הוצאות לאירוע.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^שלב 1:/ }));
    expect(screen.getByRole('heading', { name: 'פרטי האירוע' })).toBeTruthy();
  });

  it('shows a toast when saving an event name succeeds or fails validation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'שמור שם' }));
    const validationPopup = screen.getByRole('alert');
    expect(within(validationPopup).getByText('לא ניתן לשמור את שם האירוע')).toBeTruthy();
    expect(within(validationPopup).getByText('יש להזין שם אירוע.')).toBeTruthy();

    await user.type(screen.getByLabelText('שם האירוע'), 'Weekend trip');
    await user.click(screen.getByRole('button', { name: 'שמור שם' }));

    const successToast = screen.getByRole('status');
    expect(within(successToast).getByText('שם האירוע עודכן')).toBeTruthy();
    expect(within(successToast).getByText('Weekend trip')).toBeTruthy();
  });

  it('shows a toast and persistent warning when saving to local storage fails', async () => {
    const user = userEvent.setup();
    render(<App />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    await user.type(screen.getByLabelText('שם האירוע'), 'Weekend trip');
    await user.click(screen.getByRole('button', { name: 'שמור שם' }));

    const failureToast = screen.getByText('השמירה נכשלה').closest<HTMLElement>('.wizard-toast');
    expect(failureToast).not.toBeNull();
    if (!failureToast) throw new Error('Storage failure toast is missing.');
    expect(within(failureToast).getByText('השמירה נכשלה')).toBeTruthy();
    expect(failureToast.classList.contains('wizard-toast')).toBe(true);
    expect(screen.getByText(/האירוע נשמר רק בזיכרון/)).toBeTruthy();
  });

  it('labels successful actions as memory-only when saving is disabled', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('splitsmart-event-v1', '{invalid');
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'המשך עם אירוע חדש ללא שמירה' }));
    await user.type(screen.getByLabelText('שם האירוע'), 'Weekend trip');
    await user.click(screen.getByRole('button', { name: 'שמור שם' }));

    const memoryOnlyToast = screen.getByText('שם האירוע עודכן — בזיכרון בלבד')
      .closest<HTMLElement>('.wizard-toast');
    expect(memoryOnlyToast).not.toBeNull();
    if (!memoryOnlyToast) throw new Error('Memory-only toast is missing.');
    expect(within(memoryOnlyToast).getByText('שם האירוע עודכן — בזיכרון בלבד')).toBeTruthy();
    expect(within(memoryOnlyToast).getByText(/לא יישמרו בסגירת העמוד/)).toBeTruthy();
    expect(screen.getByText(/האירוע נשמר רק בזיכרון/)).toBeTruthy();
    expect(window.localStorage.getItem('splitsmart-event-v1')).toBe('{invalid');
  });

  it('toggles the floating scroll control between bottom and top', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'גלילה לתחתית העמוד' }));

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
    expect(screen.getByRole('button', { name: 'גלילה לראש העמוד' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'גלילה לראש העמוד' }));

    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: 'smooth',
    });
    expect(screen.getByRole('button', { name: 'גלילה לתחתית העמוד' })).toBeTruthy();
  });

  it('adds a participant and rejects a duplicate name', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openParticipantsStep(user);

    await addParticipant(user, 'Dana');
    await user.type(screen.getByLabelText('שם משתתף'), 'Dana');
    await user.click(screen.getByRole('button', { name: 'הוסף' }));

    const duplicateNamePopup = screen.getByRole('alert');
    expect(within(duplicateNamePopup).getByText('לא ניתן להוסיף משתתף')).toBeTruthy();
    expect(within(duplicateNamePopup).getByText('משתתף עם שם זה כבר קיים.')).toBeTruthy();
    expect(duplicateNamePopup.classList.contains('wizard-toast')).toBe(true);
    expect(duplicateNamePopup.closest('footer')).toBeTruthy();
    expect(screen.getByRole('list').textContent?.match(/Dana/g)).toHaveLength(1);
  });

  it('shows a success toast after adding a participant', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openParticipantsStep(user);

    await addParticipant(user, 'Dana');

    const successToast = screen.getByRole('status');
    expect(within(successToast).getByText('המשתתף נוסף')).toBeTruthy();
    expect(within(successToast).getByText('Dana')).toBeTruthy();
  });

  it('traps focus in the participant dialog and restores it after Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openParticipantsStep(user);
    await addParticipant(user, 'Dana');
    await addParticipant(user, 'Yael');

    const removeButton = screen.getByRole('button', { name: 'הסר את Dana' });
    await user.click(removeButton);

    const dialog = screen.getByRole('alertdialog');
    const cancelButton = within(dialog).getByRole('button', { name: 'ביטול' });
    const confirmButton = within(dialog).getByRole('button', { name: 'הסרה והמשך' });
    expect(document.activeElement).toBe(cancelButton);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(confirmButton);
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(cancelButton);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(removeButton);
  });

  it('shows a styled popup when adding a participant without a name', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openParticipantsStep(user);

    await user.click(screen.getByRole('button', { name: 'הוסף' }));

    const validationPopup = screen.getByRole('alert');
    expect(within(validationPopup).getByText('לא ניתן להוסיף משתתף')).toBeTruthy();
    expect(within(validationPopup).getByText('יש להזין שם משתתף.')).toBeTruthy();
    expect(validationPopup.classList.contains('wizard-toast')).toBe(true);
    expect(validationPopup.closest('footer')).toBeTruthy();
  });

  it('rejects a non-positive expense split weight', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openExpenseStep(user);
    await fillExpense(user, 'Taxi', '30');

    await user.clear(screen.getByLabelText('משקל חלוקה של Dana'));
    await user.type(screen.getByLabelText('משקל חלוקה של Dana'), '0');
    await user.click(screen.getByRole('button', { name: 'הוסף הוצאה' }));

    expect(screen.getByRole('alert').textContent).toContain(
      'משקל חלוקה חייב להיות מספר חיובי.',
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(window.localStorage.getItem('splitsmart-event-v1')).not.toContain('"description":"Taxi"');
  });

  it('shows a popup when an expense is submitted without required details', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openExpenseStep(user);

    await user.click(screen.getByRole('button', { name: 'הוסף הוצאה' }));

    const validationPopup = screen.getByRole('alert');
    expect(within(validationPopup).getByText('לא ניתן להוסיף את ההוצאה')).toBeTruthy();
    expect(within(validationPopup).getByText('יש להזין תיאור להוצאה.')).toBeTruthy();
    expect(validationPopup.classList.contains('wizard-toast')).toBe(true);
    expect(window.localStorage.getItem('splitsmart-event-v1')).not.toContain('"expenses":[{');
  });

  it('adds an expense with personal charges and preserves them when editing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openExpenseStep(user);
    await fillExpense(user, 'Dinner', '100');
    await user.type(screen.getByLabelText('חיוב אישי של Dana'), '20');

    expect(screen.getByText(/נותר לחלוקה משותפת:.*80/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'הוסף הוצאה' }));
    const expenseAddedToast = await screen.findByRole('status');
    expect(within(expenseAddedToast).getByText('ההוצאה נוספה')).toBeTruthy();
    expect(expenseAddedToast.classList.contains('wizard-toast')).toBe(true);
    expect(expenseAddedToast.closest('footer')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /הבא/ }));
    const summary = screen.getByRole('heading', { name: 'סיכום ההוצאות' }).closest('section');
    expect(summary).not.toBeNull();
    if (!summary) throw new Error('Expense summary section is missing.');
    expect(within(summary).getByText('Dinner')).toBeTruthy();
    expect(within(summary).getByText(/חיובים אישיים: Dana/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'עריכת הוצאה Dinner' }));
    expect((screen.getByLabelText('חיוב אישי של Dana') as HTMLInputElement).value)
      .toBe('20.00');
    await user.clear(screen.getByLabelText('תיאור'));
    await user.type(screen.getByLabelText('תיאור'), 'Dinner updated');
    await user.clear(screen.getByLabelText('חיוב אישי של Dana'));
    await user.type(screen.getByLabelText('חיוב אישי של Dana'), '25');
    await user.click(screen.getByRole('button', { name: 'שמור שינויים' }));

    expect(await screen.findByText('ההוצאה עודכנה')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /הבא/ }));
    const updatedSummary = screen.getByRole('heading', { name: 'סיכום ההוצאות' })
      .closest('section');
    expect(updatedSummary).not.toBeNull();
    if (!updatedSummary) throw new Error('Updated expense summary section is missing.');
    expect(within(updatedSummary).getByText('Dinner updated')).toBeTruthy();
    expect(within(updatedSummary).getByText(/חיובים אישיים: Dana.*25/)).toBeTruthy();
  });

  it('asks for confirmation before deleting an expense from the summary', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openExpenseStep(user);
    await fillExpense(user, 'Taxi', '30');
    await user.click(screen.getByRole('button', { name: 'הוסף הוצאה' }));
    await user.click(screen.getByRole('button', { name: /הבא/ }));
    const summary = screen.getByRole('heading', { name: 'סיכום ההוצאות' }).closest('section');
    expect(summary).not.toBeNull();
    if (!summary) throw new Error('Expense summary section is missing.');

    await user.click(screen.getByRole('button', { name: 'הסרת הוצאה Taxi' }));
    const deletionDialog = screen.getByRole('alertdialog');
    expect(within(deletionDialog).getByText(/ההוצאה „Taxi” בסך/)).toBeTruthy();
    expect(document.activeElement).toBe(
      within(deletionDialog).getByRole('button', { name: 'ביטול' }),
    );
    expect(window.localStorage.getItem('splitsmart-event-v1')).toContain('"description":"Taxi"');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'הסרת הוצאה Taxi' }));

    await user.click(screen.getByRole('button', { name: 'הסרת הוצאה Taxi' }));
    const reopenedDialog = screen.getByRole('alertdialog');
    await user.click(within(reopenedDialog).getByRole('button', { name: 'ביטול' }));
    expect(within(summary).getByText('Taxi')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'הסרת הוצאה Taxi' }));
    await user.click(screen.getByRole('button', { name: 'מחיקת ההוצאה' }));

    expect(within(summary).queryByText('Taxi')).toBeNull();
    expect(window.localStorage.getItem('splitsmart-event-v1')).not.toContain('"description":"Taxi"');
    const deletionToast = screen.getByRole('status');
    expect(within(deletionToast).getByText('ההוצאה נמחקה')).toBeTruthy();
    expect(within(deletionToast).getByText('Taxi')).toBeTruthy();
  });

  it('clears event data and local storage after confirming a new calculation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openParticipantsStep(user);
    await addParticipant(user, 'Dana');
    await addParticipant(user, 'Yael');
    await user.type(screen.getByLabelText('שם משתתף'), 'Unfinished participant');
    await user.click(screen.getByRole('button', { name: /הבא/ }));
    await fillExpense(user, 'Taxi', '30');
    await user.click(screen.getByRole('button', { name: 'הוסף הוצאה' }));
    await fillExpense(user, 'Unfinished expense', '12');
    await user.click(screen.getByRole('button', { name: /הבא/ }));
    await user.click(screen.getByRole('button', { name: /הבא/ }));

    const savedBeforeReset = JSON.parse(
      window.localStorage.getItem('splitsmart-event-v1') ?? 'null',
    );
    expect(savedBeforeReset.expenses).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'חישוב חדש' }));
    const resetTrigger = screen.getByRole('button', { name: 'חישוב חדש' });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText(/לא ניתן יהיה לשחזר/)).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'ביטול' }),
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(resetTrigger);
    await user.click(resetTrigger);
    await user.click(screen.getByRole('button', { name: 'מחיקת האירוע והתחלה מחדש' }));

    expect(window.localStorage.getItem('splitsmart-event-v1')).toBeNull();
    expect(screen.getByRole('heading', { name: 'פרטי האירוע' })).toBeTruthy();
    expect((screen.getByLabelText('שם האירוע') as HTMLInputElement).value).toBe('');

    await user.type(screen.getByLabelText('שם האירוע'), 'Fresh calculation');
    await user.click(screen.getByRole('button', { name: 'שמור שם' }));
    await user.click(screen.getByRole('button', { name: /הבא/ }));
    expect((screen.getByLabelText('שם משתתף') as HTMLInputElement).value).toBe('');
    await addParticipant(user, 'Fresh participant');
    await user.click(screen.getByRole('button', { name: /הבא/ }));
    expect((screen.getByLabelText('תיאור') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('סכום בשקלים') as HTMLInputElement).value).toBe('');
  });

  it('keeps event data when starting a new calculation is cancelled', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openParticipantsStep(user);
    await addParticipant(user, 'Dana');
    await addParticipant(user, 'Yael');
    await user.click(screen.getByRole('button', { name: /התחשבנות/ }));
    const savedEvent = window.localStorage.getItem('splitsmart-event-v1');

    await user.click(screen.getByRole('button', { name: 'חישוב חדש' }));
    await user.click(screen.getByRole('button', { name: 'ביטול' }));

    expect(window.localStorage.getItem('splitsmart-event-v1')).toBe(savedEvent);
    expect(screen.getByRole('heading', { name: 'יתרות והסדרים' })).toBeTruthy();
  });
});
