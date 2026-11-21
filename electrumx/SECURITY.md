# Security Policy

See https://github.com/spesmilo/electrum/blob/master/SECURITY.md

## Unconfirmed transaction trust boundary

Electrum clients before 4.8.3 were vulnerable to a malicious server replacing a
just-broadcast transaction and inducing the user to fee-bump the replacement
([CVE-2026-117601 / GHSA-6jp4-8v48-cc5v](https://github.com/spesmilo/electrum/security/advisories/GHSA-6jp4-8v48-cc5v)).  The fix is client-side: before an
unconfirmed transaction is accepted into wallet history or used as an RBF
template, the wallet must verify every signature that spends a wallet-owned
transparent output and re-check the intended outputs and amounts.

This server mirrors the mempool accepted by its configured Nito Core and does
not hold wallet keys or decide which inputs belong to a wallet.  Adding wallet
signature validation here would not protect a client connected to a different
malicious server and would violate the server-only trust boundary.  Wallets must
therefore implement the equivalent of Electrum 4.8.3 commit
[`90fe308`](https://github.com/spesmilo/electrum/commit/90fe30822561e515a9d2d6e5a352cc07780999eb) locally;
operators should still secure and monitor the Core-to-ElectrumX connection.
