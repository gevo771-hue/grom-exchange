// The reviewed amounts and account must still match after the wallet returns
// from a network switch or allowance confirmation.
const same = (left, right) => typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
const address = value => /^0x[\da-f]{40}$/i.test(value || '');
const zero = '0x' + '0'.repeat(40);
export function validateEarnQuote(order, q, preview) {
  const step = q?.lifi, action = step?.action, tx = step?.transactionRequest;
  const input = q?.input, output = q?.output;
  const withdraw = order.side === 'withdraw';
  if (!input || !output || !address(order.account) || !Number.isFinite(q.expiresAt) || q.expiresAt <= Date.now() ||
      q.feeBps !== 20 || !action || !tx || !address(tx.to) || same(tx.to,zero) || !/^0x(?:[a-f\d]{2}){4,}$/i.test(tx.data) ||
      !same(input.address, withdraw ? order.address : order.payToken) || !same(output.address, withdraw ? order.payToken : order.address) ||
      Number(input.chainId) !== Number(withdraw ? order.chain : order.payChain) || Number(output.chainId) !== Number(withdraw ? order.payChain : order.chain) ||
      Number(action.fromChainId) !== input.chainId || Number(action.toChainId) !== output.chainId || Number(tx.chainId) !== input.chainId ||
      !same(action.fromAddress, order.account) || !same(action.toAddress, order.account) || (tx.from && !same(tx.from, order.account)) ||
      !same(action.fromToken?.address,input.address) || !same(action.toToken?.address,output.address) ||
      action.fromToken.decimals !== input.decimals || action.toToken.decimals !== output.decimals) throw Error('Quote no longer matches this order');
  const [whole, fraction = ''] = order.amount.split('.');
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 36 || fraction.length > input.decimals) throw Error('Invalid token precision');
  const units = BigInt(whole + fraction.padEnd(input.decimals, '0'));
  if (units <= 0n || units !== BigInt(action.fromAmount) || BigInt(step.estimate.toAmountMin) <= 0n) throw Error('Invalid route amounts');
  if (preview && (BigInt(step.estimate.toAmountMin) < BigInt(preview.lifi.estimate.toAmountMin) ||
      BigInt(tx.value || 0) > BigInt(preview.lifi.transactionRequest.value || 0))) throw Error('Route changed. Review a new quote');
  return units;
}

export async function submitEarnOrder(order, reviewed, wallet, getQuote, stillCurrent) {
  validateEarnQuote(order, reviewed);
  const provider = wallet.provider();
  if (!provider) throw Error('Connect a wallet');
  const chain = reviewed.input.chainId;
  const verifySigner = async () => {
    const [accounts, id] = await Promise.all([provider.request({method:'eth_accounts'}), provider.request({method:'eth_chainId'})]);
    if (!stillCurrent() || wallet.provider() !== provider || !same(accounts?.[0], order.account) || Number(id) !== chain) throw Error('Wallet or network changed');
  };
  await wallet.switchChain(provider, chain);
  await verifySigner();
  let fresh = await getQuote(order);
  const units = validateEarnQuote(order, fresh, reviewed);
  const native = same(fresh.input.address, zero);
  if (!native) {
    const spender = fresh.lifi.estimate.approvalAddress;
    if (!address(spender) || same(spender,zero)) throw Error('Invalid allowance recipient');
    if (await wallet.allowance(provider, fresh.input.address, order.account, spender, chain) < units) {
      await verifySigner();
      await wallet.approve(provider, fresh.input.address, spender, order.account, chain, units, verifySigner);
      fresh = await getQuote(order);
      validateEarnQuote(order, fresh, reviewed);
      if (!same(spender,fresh.lifi.estimate.approvalAddress)) throw Error('Allowance recipient changed. Review again');
    }
  }
  const tx = fresh.lifi.transactionRequest;
  wallet.checkValue({ isNative: native, amountIn: units, txValue: tx.value || '0x0', fromSym: fresh.input.symbol,
    amtHumanStr: order.amount, decimals: fresh.input.decimals });
  await verifySigner();
  validateEarnQuote(order, fresh, reviewed);
  return wallet.send(provider, { from: order.account, to: tx.to, data: tx.data, value: tx.value || '0x0' }, 180000, chain, { action: 'tx', expectedWei: native ? units.toString() : '0', verify: async () => {
    await verifySigner(); validateEarnQuote(order, fresh, reviewed);
  } });
}
