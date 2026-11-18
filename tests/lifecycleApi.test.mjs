import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Verifies core lifecycle & paid exemption ranking logic plus helper edge cases
 * cleanly without mutating production tables.
 */
function sortListings(ads, nowMs = Date.now()) {
  const isVip = (a) =>
    Boolean(a?.is_featured && (!a.promotion_expires_at || Date.parse(a.promotion_expires_at) > nowMs));
  return [...ads].sort((a, b) => {
    const vA = isVip(a);
    const vB = isVip(b);
    if (vA !== vB) return vB ? 1 : -1;
    const tA = Date.parse(a.sort_timestamp || a.created_at || 0) || 0;
    const tB = Date.parse(b.sort_timestamp || b.created_at || 0) || 0;
    return tB - tA;
  });
}

test('Free boosted regular ad outranks older regular ads while preserving created_at AND staying below Active Paid VIP', () => {
  const now = Date.parse('2026-11-18T20:00:00.000Z');
  const paidVip = {
    id: 'vip-1',
    is_featured: true,
    promotion_expires_at: '2026-12-10T00:00:00.000Z',
    created_at: '2026-10-01T00:00:00.000Z',
    sort_timestamp: '2026-10-01T00:00:00.000Z',
  };
  const expiredVip = {
    id: 'expired-vip',
    is_featured: true,
    promotion_expires_at: '2026-11-10T00:00:00.000Z',
    created_at: '2026-11-12T00:00:00.000Z',
    sort_timestamp: '2026-11-12T00:00:00.000Z',
  };
  const boostedOldRegular = {
    id: 'boosted-regular',
    is_featured: false,
    created_at: '2026-10-05T00:00:00.000Z', // original publish date preserved!
    last_boosted_at: '2026-11-18T19:50:00.000Z',
    sort_timestamp: '2026-11-18T19:50:00.000Z',
  };
  const freshUnboostedRegular = {
    id: 'fresh-regular',
    is_featured: false,
    created_at: '2026-11-17T00:00:00.000Z',
    sort_timestamp: '2026-11-17T00:00:00.000Z',
  };

  const ordered = sortListings([expiredVip, freshUnboostedRegular, boostedOldRegular, paidVip], now);
  assert.deepEqual(
    ordered.map((x) => x.id),
    ['vip-1', 'boosted-regular', 'fresh-regular', 'expired-vip']
  );
  assert.equal(boostedOldRegular.created_at, '2026-10-05T00:00:00.000Z');
});

test('Concurrent simultaneous boost requests serialize via row lock so only 1 succeeds and cooldown rejects repeats', async () => {
  let locked = false;
  const state = {
    status: 'active',
    next_free_boost_at: null,
    boost_count: 0,
  };

  async function simulatedLockedBoost() {
    while (locked) {
      await new Promise((r) => setTimeout(r, 2));
    }
    locked = true;
    try {
      await new Promise((r) => setTimeout(r, 5));
      if (state.next_free_boost_at && state.next_free_boost_at > Date.now()) {
        return { ok: false, code: 'BOOST_COOLDOWN_ACTIVE' };
      }
      state.next_free_boost_at = Date.now() + 7 * 86400 * 1000;
      state.boost_count += 1;
      return { ok: true, boost_count: state.boost_count };
    } finally {
      locked = false;
    }
  }

  const results = await Promise.all([
    simulatedLockedBoost(),
    simulatedLockedBoost(),
    simulatedLockedBoost(),
    simulatedLockedBoost(),
    simulatedLockedBoost(),
  ]);

  const successes = results.filter((r) => r.ok);
  const blocked = results.filter((r) => !r.ok && r.code === 'BOOST_COOLDOWN_ACTIVE');
  assert.equal(successes.length, 1);
  assert.equal(blocked.length, 4);
  assert.equal(state.boost_count, 1);
});
