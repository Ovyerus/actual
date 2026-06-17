export type SyncServerRedbarkAmount = {
  amount: string;
  currency: string;
};

export type SyncServerRedbarkBalance = {
  balanceAmount: SyncServerRedbarkAmount;
  balanceType: 'expected' | 'interimAvailable';
  referenceDate: string;
};

export type SyncServerRedbarkAccount = {
  account_id: string;
  connectionId: string;
  name: string;
  official_name: string;
  institution?: string;
  mask?: string;
  balance: number;
  balance_current?: number;
  balance_available?: number;
  currency: string;
};

export type SyncServerRedbarkTransaction = {
  date: string;
  payeeName: string;
  notes?: string;
  transactionAmount: SyncServerRedbarkAmount;
  transactionId: string;
  booked: boolean;
};
