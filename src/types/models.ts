export type MinorUnits = number;
export type ParticipantId = string;
export type ExpenseId = string;
export type EventId = string;

export interface Participant {
  id: ParticipantId;
  name: string;
}

export interface Event {
  id: EventId;
  name: string;
  createdAt: string;
  participants: Participant[];
  expenses: Expense[];
}

export interface ExpensePayment {
  participantId: ParticipantId;
  amountMinorUnits: MinorUnits;
}

export interface SharedParticipant {
  participantId: ParticipantId;
  weight: number;
}

export interface PersonalCharge {
  participantId: ParticipantId;
  amountMinorUnits: MinorUnits;
}

export interface Expense {
  id: ExpenseId;
  description: string;
  totalAmountMinorUnits: MinorUnits;
  payments: ExpensePayment[];
  sharedParticipants: SharedParticipant[];
  personalCharges: PersonalCharge[];
  createdAt: string;
}

export interface ParticipantBalance {
  participantId: ParticipantId;
  paidMinorUnits: MinorUnits;
  shouldPayMinorUnits: MinorUnits;
  balanceMinorUnits: MinorUnits;
}

export interface SettlementTransfer {
  fromParticipantId: ParticipantId;
  toParticipantId: ParticipantId;
  amountMinorUnits: MinorUnits;
}
