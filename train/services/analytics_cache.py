"""In-process TTL cache for DHIS2/KHIS analytics results.

Keeps repeat (or cross-tab) queries fast by avoiding a second round-trip to
the external DHIS2/KHIS servers within a short window.  Keys are normalized
(dx, ou, pe, coc) tuples, so the same logical query always hits the same
entry regardless of list ordering.  Only NON-EMPTY results are cached so a
transient network failure or a "no data reported yet" response is never
frozen; the next identical request simply tries the server again.

This is a server-side performance cache only - it does NOT change any JSON
schema and it does NOT implement client-side sticky caching.  Each blueprint
request still runs end-to-end; only identical upstream analytics queries made
within the TTL are answered from memory.

Safe to use under Flask's threaded dev server (mutex-protected).
"""
from __future__ import annotations

import copy
import threading
import time
from typing import Any, Hashable

_CACHE: dict[Hashable, tuple[float, Any]] = {}
_LOCK = threading.Lock()

# Seconds an entry stays valid (5 minutes).  Monthly reporting cadence means
# a 5-minute staleness window is imperceptible; keeping it short avoids ever
# serving yesterday's "current month" after a rollover.
DEFAULT_TTL = 300.0

# Empty/"no data" responses are cached for only this long.  They usually mean
# the upstream server has no rows yet for that period, but a transient network
# failure must not be frozen long either - a short TTL keeps repeat requests
# fast while staying fresh enough to pick up newly reported data.
EMPTY_TTL = 45.0

# Hard cap so a long-running server cannot grow unbounded.
_MAX_ENTRIES = 2048


def _normalize(value: Any) -> Any:
    """Normalize list/set/tuple args to a deterministic joined string."""
    if isinstance(value, (list, set, tuple)):
        parts = [str(x) for x in value]
        return ";".join(sorted(parts))
    if value is None:
        return ""
    return str(value)


def make_key(dx_ids: Any, ou_id: Any, pe: Any = "LAST_MONTH", coc_ids: Any = None, namespace: str = "") -> Hashable:
    """Build a normalized cache key for an analytics query.

    ``namespace`` distinguishes different DHIS2 servers (KHIS vs CHAK) that
    may legitimately share OU/DE identifiers, preventing cross-server
    collisions in the single shared cache.
    """
    return (
        namespace or "",
        _normalize(dx_ids),
        _normalize(ou_id),
        _normalize(pe),
        _normalize(coc_ids),
    )


def get(key: Hashable):
    """Return cached value (deep copy) or None if missing/expired."""
    with _LOCK:
        item = _CACHE.get(key)
        if item is None:
            return None
        expires_at, value = item
        if time.monotonic() > expires_at:
            del _CACHE[key]
            return None
    # Deep copy so callers can freely mutate what they receive.
    return copy.deepcopy(value)


def store(key: Hashable, value: Any, ttl: float = DEFAULT_TTL) -> None:
    """Store a result.

    Empty/falsy results are cached with a short TTL (EMPTY_TTL) rather than
    skipped, so a warm repeat of a query that currently returns no rows does
    not need another upstream round trip, yet will still refresh quickly once
    data appears.
    """
    if not value:
        ttl = min(ttl, EMPTY_TTL)
    with _LOCK:
        if len(_CACHE) >= _MAX_ENTRIES:
            # Cheap sweep of expired entries before evicting anything new.
            now = time.monotonic()
            stale = [k for k, (exp, _) in _CACHE.items() if now > exp]
            for k in stale:
                del _CACHE[k]
            # If still at cap, drop the whole cache (simple, rare).
            if len(_CACHE) >= _MAX_ENTRIES:
                _CACHE.clear()
        _CACHE[key] = (time.monotonic() + ttl, value)


def clear() -> None:
    """Drop all cached analytics results (used by tests/admin)."""
    with _LOCK:
        _CACHE.clear()


def size() -> int:
    with _LOCK:
        return len(_CACHE)
