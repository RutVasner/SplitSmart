interface EventDetailsStepProps {
  eventName: string;
  onEventNameChange: (name: string) => void;
  onSave: () => void;
}

export function EventDetailsStep({
  eventName,
  onEventNameChange,
  onSave,
}: EventDetailsStepProps) {
  return (
    <section className="card wizard-card">
      <div className="wizard-card-heading">
        <h2>פרטי האירוע</h2>
      </div>
      <div className="row">
        <label className="field grow">
          שם האירוע
          <input
            value={eventName}
            onChange={(event) => onEventNameChange(event.target.value)}
            placeholder="לדוגמה: טיול סוף השבוע"
          />
        </label>
        <button className="primary" type="button" onClick={onSave}>שמור שם</button>
      </div>
    </section>
  );
}
