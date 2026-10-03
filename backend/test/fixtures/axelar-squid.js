// Shape verified against Axelar searchGMP and Arbitrum eth_getTransactionReceipt.
// Synthetic hashes/accounts keep the regression fixture independent of user data.
export const sourceHash = `0x${'a'.repeat(64)}`;
export const destinationHash = `0x${'b'.repeat(64)}`;
export const payloadHash = `0x${'c'.repeat(64)}`;
export const account = `0x${'1'.repeat(40)}`;
export const router = '0xce16f69375520ab01377ce7b88f5ba8c48f8d666';
export const executedTopic = '0x7c3aa10c5d96985be6de7d2e6fa79bdef95a95a9cb272f4113b3fe1ca89fedae';
export const failedTopic = '0xdd7b1484db8d21f4fbda2407f2920037dc379dd66e18b0851aa9d6c14ef493b9';
export function axelarPayload() {
  return { data: [{
    status: 'executed', simplified_status: 'received',
    call: {
      transactionHash: sourceHash,
      transaction: { hash: sourceHash, from: account, chainId: 1 },
      returnValues: { payloadHash, destinationContractAddress: router },
    },
    executed: {
      sourceTransactionHash: sourceHash,
      transactionHash: destinationHash,
      transaction: { hash: destinationHash, to: router, chainId: 42161 },
    },
  }] };
}
export function squidReceipt(partial = false) {
  return {
    transactionHash: destinationHash, to: router, status: '0x1',
    logs: [{ address: router, data: partial ? `0x${'0'.repeat(128)}` : '0x',
      topics: partial ? [failedTopic, payloadHash, `0x${'0'.repeat(24)}${account.slice(2)}`] : [executedTopic, payloadHash] }],
  };
}
export function swapOp() {
  return { id: 'OP-AX', stage: 'unknown', hash: sourceHash, account, bridge: 'squid', fromChainId: 1, toChainId: 42161 };
}
