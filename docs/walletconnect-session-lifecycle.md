# WalletConnect session restoration

GROM uses one SignClient and one Core per page. Its custom storage adapter writes
all Core records (session, pairing, encryption keychain, expiry state) to
origin-local browser storage under `wc@2:grom:kv:`. It avoids IndexedDB, whose
initialization previously stalled with some extensions. Storage failures are
reported rather than silently falling back to memory.

Boot and swap silently restore the matching, unexpired session before proposing
a new pairing. The saved address is only portfolio identity; it is never enough
to pretend there is a signing session. Initialization and reconnect no longer
purge saved sessions or create another Core after a short timer. A 20-second
caller timeout leaves the same initialization running, so the next attempt can
reuse it. An actual initialization rejection permits retry with the same durable
store. A relay error is not treated as proof that a session expired.

The previous memory-only implementation did not persist its session keys.
Those lost sessions require one new wallet connection. Once connected with this
version, reloads should restore the same signing topic without another dApp
connection prompt. Cleared browser data, explicit wallet disconnection and
expired sessions still require a new connection.

Live sibling sessions are preserved when another tab connects. A deletion event
only clears the provider for that event's topic and cannot clear a replacement
provider. Provider readiness also checks the SDK store and expiry, rather than
trusting a cached account address. The wallet menu distinguishes an active
connection from a saved portfolio address and offers a connection-only recovery
action, which does not submit a swap.

For requests sent through SignClient, the wallet coach is triggered by the SDK's
`session_request_sent` event for the matching topic, chain, method and parameters.
Invoking `request()` alone does not establish that relay preparation has finished.
Settlement removes listeners and cancels a delayed wallet wake. iOS Trust opens
with the native `trust://` scheme, with no pairing URI and no `open_url` website
navigation. In-app and desktop users are not redirected to Trust's website.

## Verification

`backend/test/walletconnect-session-persistence.test.js` initializes independent
instances of the shipped SDK's session store and crypto service with a shared
browser-storage fixture. After recreating storage and Core, it restores the
session and decrypts a test payload with the original session key. Additional
tests cover account matching, expired sessions, a slow single-flight initializer,
failed initialization preserving keys and swap restore failure never proposing
a new pairing. No wallet/network transaction is sent by these tests.

`backend/test/walletconnect-request-dispatch.test.js` covers delayed dispatch,
pre-dispatch errors, unrelated events, rejection before wallet wake, native Trust
links, live sibling preservation and stale/expired provider rejection.

For live acceptance: connect Trust once, reload GROM, enter a small swap amount,
and check that the CTA says Swap and no fresh pairing is proposed. The user
starts and approves the real transaction. Token approval or gas funding may
still require separate confirmations; session restoration does not bypass them.
