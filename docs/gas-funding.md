# EVM gas funding

Instant Swap checks the live signer's source-chain native balance before requesting a transaction. Native input value is kept separate from the fee reserve. A recent matching quote supplies the reserve estimate; the fallback floor is $0.20.

When funding is necessary:

1. Use spare input-token balance on the same network only if there is already enough native gas to pay for the refuel, including possible approval. Preserve the amount entered for the main swap. Require enough native output for the main fee reserve.
2. Otherwise quote native donors on supported EVM networks, preferring inexpensive networks over Ethereum mainnet. A donor can use another native asset only through a real bridge/swap into the execution network's native asset, for example BNB → ETH. It does not directly pay another network's gas.
3. Refuse routes without an executable, fee-verified quote, sufficient minimum native delivery, donor gas reserve, or an affordable budget. No same-chain fallback at zero native gas.

Funding input targets $1.25 and funding input plus quoted fees must fit within $2. Native-unit caps remain in force. Keep at least $0.80 on the donor after quoted fees. Final network fees are shown by the wallet and may change.

Funding uses the existing signing provider. Wallet approval remains with the user. Funding and the main swap each have their own transaction and history entry. Quote identity, recipient, native token markers, budget, and the original form selection are checked again before signing. No automatic venue retries after funding simulation fails or a funding transaction reverts.

For a donor bridge, the open page waits up to three minutes for both a terminal successful bridge delivery and a fresh sufficient source-chain gas balance. It then restores the original swap intent and prepares the main swap. If the pair, amount, source network or account changes, it stops for review. If delivery is delayed, preserve the submitted funding hash and monitor in the background. After reload or a delayed completion, the user starts the main swap again; never send a second funding transaction while the original is unresolved. Partial delivery, refund and failure do not execute the main swap.

## Limits

This is refueling, not gasless execution. A normal ERC-20 swap with zero native balance cannot fund its own initial transaction. If there is no funded donor and no native dust, the user still needs a gasless provider or a native deposit. Mainnet fees can make a $2 funding budget unusable. Tron and Solana retain their separate refuel paths.

An eventual token-paid route needs a backend integration with a gasless provider and its enabled account/key, authenticated quotes, fee disclosure, allowance/permit capability checks and relay-status recovery. GROM currently has no configured 0x Gasless key. Do not expose a secret key in the frontend or claim all tokens can swap gaslessly: initial approvals may still need native gas for tokens without a usable permit or existing allowance.

Official references:
- https://docs.0x.org/evm/gasless-api/introduction
- https://docs.0x.org/docs/introduction/quickstart/getting-started
- https://help.li.fi/hc/en-us/articles/13304979742363-Who-pays-for-gas-cost-on-the-source-and-destination-chains

## Validation

`backend/test/swap-gas-funding.test.js` exercises the actual funding functions, quote refresh checks in the real executor, and monitor handoff. Local browser preview uses an explicitly seeded test funding operation and cannot establish a successful real wallet transaction. A live Trust Wallet funding and main-swap test still requires the user's confirmations.
