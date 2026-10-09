function toCents(amount) {
  return Math.round((Number(amount) || 0) * 100);
}

function fromCents(amount) {
  return amount / 100;
}

function getLedgerGroup(type) {
  if (type === 'lent' || type === 'lent_returned') return 'lent';
  if (type === 'borrowed' || type === 'borrowed_repaid') return 'borrowed';
  return null;
}

function getLedgerDeltaCents(type, amount) {
  if (type === 'lent' || type === 'borrowed') return toCents(amount);
  if (type === 'lent_returned' || type === 'borrowed_repaid') return -toCents(amount);
  return 0;
}

export function getLentBorrowedOutstandingCents(transactions, group, person) {
  const personKey = person?.trim().toLocaleLowerCase();
  if (!personKey) return 0;
  return transactions.reduce((total, transaction) => {
    if (
      getLedgerGroup(transaction.type) !== group
      || transaction.person?.trim().toLocaleLowerCase() !== personKey
    ) return total;
    return total + getLedgerDeltaCents(transaction.type, transaction.amount);
  }, 0);
}

export function findNegativeLentBorrowedBalance(transactions, affectedPeople) {
  return affectedPeople.find(({ group, person }) => (
    getLentBorrowedOutstandingCents(transactions, group, person) < 0
  )) || null;
}

export function validateLedgerChange(transactions, candidate, excludeId) {
  const existing = excludeId
    ? transactions.find((transaction) => transaction.id === excludeId)
    : null;
  const candidateTransactions = transactions.filter((transaction) => transaction.id !== excludeId);
  if (candidate) candidateTransactions.push(candidate);

  const affectedPeople = new Map();
  for (const transaction of [candidate, existing]) {
    const group = transaction && getLedgerGroup(transaction.type);
    const person = transaction?.person?.trim();
    if (!group || !person) continue;
    affectedPeople.set(`${group}:${person.toLocaleLowerCase()}`, { group, person });
  }

  const negativeBalance = findNegativeLentBorrowedBalance(candidateTransactions, [...affectedPeople.values()]);
  if (negativeBalance) {
    return {
      success: false,
      errors: [`This change exceeds ${negativeBalance.person}'s outstanding ${negativeBalance.group} balance.`],
    };
  }
  return { success: true, errors: [] };
}

export function getLentBorrowedLedger(transactions) {
  const lentMap = new Map();
  const borrowedMap = new Map();

  transactions.forEach((transaction) => {
    const person = (transaction.person || '').trim();
    if (!person) return;
    const key = person.toLocaleLowerCase();
    const amount = toCents(transaction.amount);

    if (transaction.type === 'lent') {
      if (!lentMap.has(key)) lentMap.set(key, { person, lent: 0, returned: 0 });
      lentMap.get(key).lent += amount;
    } else if (transaction.type === 'lent_returned') {
      if (!lentMap.has(key)) lentMap.set(key, { person, lent: 0, returned: 0 });
      lentMap.get(key).returned += amount;
    } else if (transaction.type === 'borrowed') {
      if (!borrowedMap.has(key)) borrowedMap.set(key, { person, borrowed: 0, repaid: 0 });
      borrowedMap.get(key).borrowed += amount;
    } else if (transaction.type === 'borrowed_repaid') {
      if (!borrowedMap.has(key)) borrowedMap.set(key, { person, borrowed: 0, repaid: 0 });
      borrowedMap.get(key).repaid += amount;
    }
  });

  const toReceive = Array.from(lentMap.values()).map((data) => {
    const remaining = Math.max(0, data.lent - data.returned);
    return {
      person: data.person,
      lent: fromCents(data.lent),
      returned: fromCents(data.returned),
      remaining: fromCents(remaining),
      status: remaining === 0 ? 'completed' : data.returned > 0 ? 'partial' : 'pending',
    };
  }).filter((entry) => entry.lent > 0);

  const toPay = Array.from(borrowedMap.values()).map((data) => {
    const remaining = Math.max(0, data.borrowed - data.repaid);
    return {
      person: data.person,
      borrowed: fromCents(data.borrowed),
      repaid: fromCents(data.repaid),
      remaining: fromCents(remaining),
      status: remaining === 0 ? 'completed' : data.repaid > 0 ? 'partial' : 'pending',
    };
  }).filter((entry) => entry.borrowed > 0);

  return { toReceive, toPay };
}
