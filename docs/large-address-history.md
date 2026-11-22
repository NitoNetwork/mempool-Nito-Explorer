# Exact large-address history

Nito ElectrumX exposes bounded transparent-history pages through
`blockchain.nito.scripthash.get_history_page`. The explorer verifies the exact
entry count and one chain tip across every page. It never raises ElectrumX's
global response-size limit and never turns an incomplete scan into address
statistics.

## Persistent accounting cache

Schema 111 creates `address_stats_cache`, and additive schema 112 adds shared
history cursors and the cache-tip metadata needed by older schema-111 copies.
Histories with at least 1,000
confirmed entries are persisted only after the full history scan, exact integer
accounting, and mempool accounting have completed. The threshold prevents
arbitrary valid-address probes from growing SQL. A row records the history
fingerprint and the Core tip hash and height used for the calculation.

After a restart, the explorer can reuse confirmed statistics only when Core
proves that the stored tip is still on the active chain. It then processes only
confirmed entries above that height and recalculates the complete mutable
mempool portion. If the stored tip is no longer an active ancestor, the cache
is not reused and the explorer performs a full exact scan.

Deep transaction-page cursors returned to visitors are stored in the bounded
`address_history_cursors` cache so another backend process, or the same backend
after a restart, can resume without rescanning from the newest transaction.
Only histories with at least 1,000 confirmed entries use this table, and cursor
rows expire after 30 days.

## Prewarming before public traffic

A previously unseen address with a very large history can require many local
Core transaction reads. Prewarm known high-activity addresses after the
database migration and ElectrumX upgrade, but before routing public traffic to
the new backend:

1. Call the backend's local `/api/address/<address>` endpoint without a proxy
   timeout and wait for an HTTP 200 response with `stats_complete: true`.
2. Verify the persisted row:

   ```sql
   SELECT scripthash, tip_height, tip_hash,
          JSON_UNQUOTE(JSON_EXTRACT(chain_stats, '$.tx_count')) AS confirmed_txs,
          JSON_UNQUOTE(JSON_EXTRACT(mempool_stats, '$.tx_count')) AS mempool_txs,
          updated_at
     FROM address_stats_cache
    WHERE scripthash = '<64-character-scripthash>';
   ```

3. Ask Core for `getblockhash(tip_height)` and require it to equal the stored
   `tip_hash`. Repeat the local address request and confirm the exact same
   accounting is returned from the cache.

Do not expose a row created at an unverified tip, copy cache rows between
networks, or seed partial/fabricated totals. A prewarm failure leaves no new
completed cache row and must be diagnosed before traffic is switched.
