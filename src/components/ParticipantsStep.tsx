import type { Participant } from '../types/models';

interface ParticipantsStepProps {
  participants: Participant[];
  participantName: string;
  weights: Record<string, string>;
  onParticipantNameChange: (name: string) => void;
  onWeightChange: (participantId: string, weight: string) => void;
  onAddParticipant: () => void;
  onRequestRemoveParticipant: (participantId: string) => void;
}

export function ParticipantsStep({
  participants,
  participantName,
  weights,
  onParticipantNameChange,
  onWeightChange,
  onAddParticipant,
  onRequestRemoveParticipant,
}: ParticipantsStepProps) {
  return (
    <section className="card wizard-card participant-card">
      <div className="wizard-card-heading">
        <h2>מי משתתף?</h2>
        <p>הוסיפו לפחות שניים, משקל 2 = חלק כפול בחלוקת ההוצאה.</p>
      </div>
      <div className="row participant-entry">
        <label className="field grow">
          שם משתתף
          <input
            value={participantName}
            onChange={(event) => onParticipantNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onAddParticipant();
            }}
            placeholder="שם המשתתף"
          />
        </label>
        <button className="primary" type="button" onClick={onAddParticipant}>הוסף</button>
      </div>

      {participants.length === 0 ? (
        <p className="empty">עדיין לא נוספו משתתפים.</p>
      ) : (
        <ul className="participant-list">
          {participants.map((participant) => (
            <li key={participant.id}>
              <span className="participant-name">{participant.name}</span>
              <div className="participant-weight">
                <label>משקל</label>
                <input
                  aria-label={`משקל של ${participant.name}`}
                  type="number"
                  min="0.01"
                  step="0.5"
                  value={weights[participant.id] ?? '1'}
                  onChange={(event) => onWeightChange(participant.id, event.target.value)}
                />
              </div>
              <span className="participant-avatar" aria-hidden="true">
                {participant.name.trim().charAt(0)}
              </span>
              <button
                className="danger text-button participant-remove"
                type="button"
                aria-label={`הסר את ${participant.name}`}
                onClick={() => onRequestRemoveParticipant(participant.id)}
              >
                הסר
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
