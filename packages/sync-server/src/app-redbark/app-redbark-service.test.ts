import { describe, it, expect } from 'vitest';

import {
  decimalToInteger,
  normalizeRedbarkAccount,
} from './app-redbark-service';

describe('decimalToInteger', () => {
  it('converts positive decimals to cents', () => {
    expect(decimalToInteger('1234.56')).toBe(123456);
  });

  it('converts negative decimals to cents', () => {
    expect(decimalToInteger('-45.50')).toBe(-4550);
  });

  it('handles whole dollars', () => {
    expect(decimalToInteger('100')).toBe(10000);
  });

  it('returns null for null input', () => {
    expect(decimalToInteger(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(decimalToInteger(undefined)).toBeNull();
  });
});

describe('normalizeRedbarkAccount', () => {
  it('maps balances and account fields', () => {
    const account = {
      id: 'acc-1',
      connectionId: 'conn-1',
      provider: 'fiskil',
      name: 'Everyday',
      type: 'transaction',
      institutionName: 'Westpac',
      accountNumber: 'xxxx1234',
      currency: 'AUD',
    };

    const balance = {
      accountId: 'acc-1',
      currentBalance: '1234.56',
      availableBalance: '1200.00',
      currency: 'AUD',
    };

    const result = normalizeRedbarkAccount(account, balance);

    expect(result.account_id).toBe('acc-1');
    expect(result.connectionId).toBe('conn-1');
    expect(result.balance_current).toBe(123456);
    expect(result.balance_available).toBe(120000);
    expect(result.currency).toBe('AUD');
  });

  it('handles missing balance', () => {
    const account = {
      id: 'acc-1',
      connectionId: 'conn-1',
      provider: 'fiskil',
      name: 'Everyday',
      type: 'transaction',
      institutionName: 'Westpac',
      accountNumber: 'xxxx1234',
      currency: 'AUD',
    };

    const result = normalizeRedbarkAccount(account, undefined);

    expect(result.balance).toBe(0);
    expect(result.balance_current).toBeNull();
    expect(result.balance_available).toBeNull();
  });

  it('handles null balance fields', () => {
    const account = {
      id: 'acc-1',
      connectionId: 'conn-1',
      provider: 'fiskil',
      name: 'Everyday',
      type: 'transaction',
      institutionName: 'Westpac',
      accountNumber: 'xxxx1234',
      currency: 'AUD',
    };

    const balance = {
      accountId: 'acc-1',
      currentBalance: null,
      availableBalance: null,
      currency: 'AUD',
    };

    const result = normalizeRedbarkAccount(account, balance);

    expect(result.balance_current).toBeNull();
    expect(result.balance_available).toBeNull();
  });
});
