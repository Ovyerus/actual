export type RedbarkConnection = {
  id: string;
  provider: string;
  category: 'banking' | 'brokerage';
  institutionId: string;
  institutionName: string;
  institutionLogo: string | null;
  status: string;
  lastRefreshedAt: string | null;
  createdAt: string;
};

export type RedbarkAccount = {
  id: string;
  connectionId: string;
  provider: string;
  name: string;
  type: string;
  institutionName: string | null;
  accountNumber: string | null;
  currency: string;
};

export type RedbarkBalance = {
  accountId: string;
  currentBalance: string | null;
  availableBalance: string | null;
  currency: string | null;
};

export type RedbarkTransaction = {
  id: string;
  accountId: string;
  accountName: string;
  status: string;
  date: string;
  description: string;
  amount: string;
  direction: 'credit' | 'debit';
  category: string | null;
  merchantName: string | null;
};

export async function redbarkFetch<T>(
  apiKey: string,
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
  attempt: number = 0,
): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    if (response.status === 429 && attempt === 0) {
      const retryAfter = response.headers.get('Retry-After');
      await new Promise(resolve =>
        setTimeout(resolve, parseInt(retryAfter || '1', 10) * 1000),
      );
      return redbarkFetch(apiKey, baseUrl, path, query, attempt + 1);
    }

    if (response.status === 499 && attempt === 0) {
      return redbarkFetch(apiKey, baseUrl, path, query, attempt + 1);
    }

    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    const error = new Error(body.error?.message || `Redbark ${path} failed`);
    (error as { status?: number }).status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

export async function fetchAllPages<T>(
  apiKey: string,
  baseUrl: string,
  path: string,
  baseQuery: Record<string, string>,
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const page = await redbarkFetch<{
      data: T[];
      pagination?: { hasMore: boolean };
    }>(apiKey, baseUrl, path, {
      ...baseQuery,
      limit: String(limit),
      offset: String(offset),
    });

    results.push(...(page.data || []));

    if (!page.pagination?.hasMore) {
      break;
    }

    offset += limit;
  }

  return results;
}

export function normalizeRedbarkAccount(
  account: RedbarkAccount,
  balance: RedbarkBalance | undefined,
) {
  const currentBalance = decimalToInteger(balance?.currentBalance);
  const availableBalance = decimalToInteger(balance?.availableBalance);

  return {
    account_id: account.id,
    connectionId: account.connectionId,
    name: account.name,
    official_name: account.name,
    institution: account.institutionName,
    mask: account.accountNumber,
    balance: currentBalance ?? 0,
    balance_current: currentBalance,
    balance_available: availableBalance,
    currency: account.currency,
  };
}

export function decimalToInteger(
  amount: string | null | undefined,
): number | null {
  if (amount == null) return null;
  const sign = amount.startsWith('-') ? -1 : 1;
  const parts = amount.replace('-', '').split('.');
  const whole = parts[0] || '0';
  const fraction = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  return sign * parseInt(whole + fraction, 10);
}
