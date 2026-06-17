import { describe, it, expect, afterEach, vi } from 'vitest';

import {
  decimalToInteger,
  fetchAllPages,
  normalizeRedbarkAccount,
  normalizeRedbarkTransaction,
} from './app-redbark-service';

const API_KEY = 'test-key';
const BASE_URL = 'https://api.redbark.com';

function mockFetchResponse(data: unknown, status = 200) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(data), { status }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchAllPages', () => {
  it('collects results across multiple pages', async () => {
    mockFetchResponse({
      data: [{ id: 'a' }, { id: 'b' }],
      pagination: { hasMore: true },
    });
    mockFetchResponse({
      data: [{ id: 'c' }],
      pagination: { hasMore: false },
    });

    const results = await fetchAllPages<{ id: string }>(
      API_KEY,
      BASE_URL,
      '/v1/items',
      {},
    );

    expect(results).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('handles a single page', async () => {
    mockFetchResponse({
      data: [{ id: 'x' }],
      pagination: { hasMore: false },
    });

    const results = await fetchAllPages<{ id: string }>(
      API_KEY,
      BASE_URL,
      '/v1/items',
      {},
    );

    expect(results).toEqual([{ id: 'x' }]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeRedbarkAccount', () => {
  it('normalises brokerage accounts correctly', () => {
    const account = {
      id: 'acc-2',
      connectionId: 'conn-2',
      provider: 'fiskil',
      name: 'Trading Account',
      type: 'brokerage',
      institutionName: 'CommSec',
      accountNumber: 'xxxx5678',
      currency: 'AUD',
    };

    const balance = {
      accountId: 'acc-2',
      currentBalance: '50000.00',
      availableBalance: '50000.00',
      currency: 'AUD',
    };

    const result = normalizeRedbarkAccount(account, balance);

    expect(result.account_id).toBe('acc-2');
    expect(result.name).toBe('Trading Account');
    expect(result.official_name).toBe('Trading Account');
    expect(result.institution).toBe('CommSec');
    expect(result.mask).toBe('xxxx5678');
    expect(result.balance_current).toBe(5000000);
    expect(result.balance_available).toBe(5000000);
    expect(result.currency).toBe('AUD');
  });
});

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

describe('normalizeRedbarkTransaction', () => {
  it('uses merchantName as payee and puts category in category field', () => {
    const transaction = {
      id: 'txn-1',
      accountId: 'acc-1',
      accountName: 'Everyday',
      status: 'posted',
      date: '2026-03-12',
      description: 'Woolworths Sydney',
      amount: '-45.50',
      direction: 'debit' as const,
      category: 'FOOD_AND_DRINK',
      merchantName: 'Woolworths',
    };

    const result = normalizeRedbarkTransaction(transaction, 'AUD');

    expect(result.date).toBe('2026-03-12');
    expect(result.payeeName).toBe('Woolworths');
    expect(result.notes).toBe('Woolworths Sydney');
    expect(result.category).toBe('FOOD_AND_DRINK');
    expect(result.transactionAmount).toEqual({
      amount: '-45.50',
      currency: 'AUD',
    });
    expect(result.transactionId).toBe('txn-1');
    expect(result.booked).toBe(true);
  });

  it('falls back to description when merchantName is absent', () => {
    const transaction = {
      id: 'txn-2',
      accountId: 'acc-1',
      accountName: 'Everyday',
      status: 'posted',
      date: '2026-03-11',
      description: 'Salary Payment',
      amount: '3500.00',
      direction: 'credit' as const,
      category: null,
      merchantName: null,
    };

    const result = normalizeRedbarkTransaction(transaction, 'AUD');

    expect(result.payeeName).toBe('Salary Payment');
    expect(result.notes).toBe('Salary Payment');
    expect(result.category).toBeUndefined();
  });
});
