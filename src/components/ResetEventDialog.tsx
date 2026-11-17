import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

interface ResetEventDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetEventDialog({ onConfirm, onCancel }: ResetEventDialogProps) {
  const dialogRef = useDialogAccessibility(onCancel);

  return (
    <div className="dialog-backdrop">
      <section
        className="reset-event-dialog"
        role="alertdialog"
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby="reset-event-title"
        aria-describedby="reset-event-description"
      >
        <h2 id="reset-event-title">להתחיל חישוב חדש?</h2>
        <p id="reset-event-description">
          הפעולה תמחק את שם האירוע, המשתתפים וההוצאות, וגם את השמירה המקומית בדפדפן.
          לא ניתן יהיה לשחזר את הנתונים לאחר האיפוס.
        </p>
        <div className="removal-dialog-actions">
          <button className="secondary" type="button" onClick={onCancel}>ביטול</button>
          <button className="primary reset-event-confirm" type="button" onClick={onConfirm}>
            מחיקת האירוע והתחלה מחדש
          </button>
        </div>
      </section>
    </div>
  );
}
