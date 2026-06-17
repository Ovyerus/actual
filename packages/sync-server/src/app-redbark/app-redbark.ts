import express from 'express';

import { handleError } from '#app-gocardless/util/handle-error';
import { SecretName, secretsService } from '#services/secrets-service';
import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';

import {
  decimalToInteger,
  fetchAllPages,
  normalizeRedbarkAccount,
  normalizeRedbarkTransaction,
  redbarkFetch,
} from './app-redbark-service';
import type {
  RedbarkAccount,
  RedbarkBalance,
  RedbarkConnection,
  RedbarkTransaction,
} from './app-redbark-service';

const app = express();
export { app as handlers };

app.use(requestLoggerMiddleware);
app.use(express.json());
app.use(validateSessionMiddleware);

const BASE_URL = 'https://api.redbark.com';

app.post(
  '/status',
  handleError(async (_req, res) => {
    const apiKey = secretsService.get(SecretName.redbark_apiKey);
    if (!apiKey) {
      res.send({
        status: 'ok',
        data: { configured: false },
      });
      return;
    }

    const response = await fetch(`${BASE_URL}/v1/connections`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (response.status === 401) {
      res.send({
        status: 'ok',
        data: {
          configured: false,
          error_type: 'INVALID_ACCESS_TOKEN',
          error_code: 'INVALID_ACCESS_TOKEN',
        },
      });
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      res.send({
        status: 'ok',
        data: {
          configured: false,
          error_type: 'SERVER_DOWN',
          error_code: 'SERVER_DOWN',
          reason: body.error?.message,
        },
      });
      return;
    }

    res.send({
      status: 'ok',
      data: { configured: true },
    });
  }),
);

app.post(
  '/accounts',
  handleError(async (_req, res) => {
    const apiKey = secretsService.get(SecretName.redbark_apiKey);
    if (!apiKey) {
      res.send({
        status: 'ok',
        data: {
          configured: false,
          error_type: 'INVALID_ACCESS_TOKEN',
          error_code: 'INVALID_ACCESS_TOKEN',
        },
      });
      return;
    }

    const connections: RedbarkConnection[] =
      await redbarkFetch<{
        data: RedbarkConnection[];
      }>(apiKey, BASE_URL, '/v1/connections').then(r => r.data);

    const bankingConnectionIds = new Set(
      connections.filter(c => c.category === 'banking').map(c => c.id),
    );

    const accounts: RedbarkAccount[] = await fetchAllPages(
      apiKey,
      BASE_URL,
      '/v1/accounts',
      {},
    );

    const bankingAccounts = accounts.filter(a =>
      bankingConnectionIds.has(a.connectionId),
    );

    const balanceMap = new Map<string, RedbarkBalance>();
    if (bankingAccounts.length > 0) {
      const accountIds = bankingAccounts.map(a => a.id).join(',');
      const balances: RedbarkBalance[] = await redbarkFetch<{
        data: RedbarkBalance[];
      }>(apiKey, BASE_URL, '/v1/balances', { accountIds }).then(r => r.data);

      for (const balance of balances) {
        balanceMap.set(balance.accountId, balance);
      }
    }

    const normalizedAccounts = bankingAccounts.map(account =>
      normalizeRedbarkAccount(account, balanceMap.get(account.id)),
    );

    res.send({
      status: 'ok',
      data: { accounts: normalizedAccounts },
    });
  }),
);

app.post(
  '/transactions',
  handleError(async (req, res) => {
    const { accountId, bankId, startDate, includeBalance = true } = req.body;
    const apiKey = secretsService.get(SecretName.redbark_apiKey);

    if (!apiKey) {
      res.send({
        status: 'ok',
        data: {
          error_type: 'INVALID_ACCESS_TOKEN',
          error_code: 'INVALID_ACCESS_TOKEN',
          reason: 'Redbark API key is not configured.',
        },
      });
      return;
    }

    // Find the account's currency so transaction amounts are tagged correctly.
    const allAccounts: RedbarkAccount[] = await fetchAllPages(
      apiKey,
      BASE_URL,
      '/v1/accounts',
      {},
    );
    const account = allAccounts.find(a => a.id === accountId);
    const accountCurrency = account?.currency ?? 'AUD';

    const transactions: RedbarkTransaction[] = await fetchAllPages(
      apiKey,
      BASE_URL,
      '/v1/transactions',
      {
        connectionId: bankId,
        accountId,
        from: startDate,
      },
    );

    const normalizedTransactions = transactions.map(transaction =>
      normalizeRedbarkTransaction(transaction, accountCurrency),
    );

    let balances: Array<{
      balanceAmount: { amount: string; currency: string };
      balanceType: 'expected' | 'interimAvailable';
      referenceDate: string;
    }> = [];

    if (includeBalance) {
      const balanceData = await redbarkFetch<{ data: RedbarkBalance[] }>(
        apiKey,
        BASE_URL,
        '/v1/balances',
        { accountIds: accountId },
      ).then(r => r.data);

      const balance = balanceData[0];
      if (balance && balance.currentBalance != null) {
        const referenceDate = new Date().toISOString().split('T')[0];
        balances = [
          {
            balanceAmount: {
              amount: balance.currentBalance,
              currency: balance.currency || 'AUD',
            },
            balanceType: 'expected',
            referenceDate,
          },
          {
            balanceAmount: {
              amount: balance.availableBalance ?? balance.currentBalance,
              currency: balance.currency || 'AUD',
            },
            balanceType: 'interimAvailable',
            referenceDate,
          },
        ];
      }
    }

    const startingBalance = includeBalance
      ? (decimalToInteger(balances[0]?.balanceAmount.amount) ?? 0)
      : 0;

    res.send({
      status: 'ok',
      data: {
        balances,
        startingBalance,
        transactions: {
          all: normalizedTransactions,
          booked: normalizedTransactions.filter(t => t.booked),
          pending: normalizedTransactions.filter(t => !t.booked),
        },
      },
    });
  }),
);
