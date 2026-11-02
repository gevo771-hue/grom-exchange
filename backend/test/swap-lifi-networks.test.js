import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL('../../frontend/public/' + name, import.meta.url), 'utf8');
const wallet = read('grom-wallet.js');
const zero = '0x' + '0'.repeat(40), account = '0x' + 'a'.repeat(40);
function setup() {
  const calls = [];
  const c = vm.createContext({
    window: {}, GW_META_NATIVE: '0x' + 'e'.repeat(40), GW_LIFI_ZERO: zero,
    GW_LIFI_SOL_CHAIN: 1151111081099710, GW_TRON_CHAIN_ID: 728126428,
    gwTryBackendLifiQuote: async q => { calls.push(q); return {}; },
    gwSwapSlippageFraction: () => .005, currentChainId: 1,
  });
  vm.runInContext(read('grom-swap-networks.js'), c);
  c.GW_EXTRA_EVM_BY_ID = c.window.GromSwapNetworks.byId;
  c.GW_EXTRA_EVM_CHAINS = c.window.GromSwapNetworks.chains;
  vm.runInContext(wallet.match(/^const GW_OC_SWAP = \{[\s\S]*?^\};/m)[0], c);
  c.GW_EVM_CHAIN_PARAMS = Object.fromEntries(c.GW_EXTRA_EVM_CHAINS.map(v => [v.id, v.wallet]));
  for (const name of ['gwDsNormSym','gwResolveEvmToken','gwParseAmountToUnits','gwAmtToBaseUnits','gwLifiQuote','gwChainGasSymbol','gwEnsureChain','gwOcUiSym','gwUsesGasBalance']) {
    const marker = 'function ' + name + '(';
    const start = wallet.lastIndexOf('\n', wallet.indexOf(marker)) + 1;
    vm.runInContext(wallet.slice(start, wallet.indexOf('\n}', start) + 2), c);
  }
  return {c, calls};
}
test('Robinhood native ETH and explicitly picked WETH have distinct labels and quote addresses', async () => {
  const {c,calls} = setup();
  c.gwGetActiveUiChainId = () => 4663;
  for (const symbol of ['ETH','WETH']) {
    const q = await c.gwLifiQuote({chainId:4663,fromSym:c.gwDsNormSym(symbol),toSym:'USDE',amtNum:'0.01',account});
    assert.equal(q._gromFromAmount, '10000000000000000');
    assert.equal(c.gwOcUiSym(4663, symbol), symbol);
  }
  assert.equal(calls[0].fromToken, zero);
  assert.equal(calls[1].fromToken.toLowerCase(), '0x0bd7d308f8e1639fab988df18a8011f41eacad73');
  c.gwGetActiveUiChainId = () => 1;
  assert.equal(c.gwDsNormSym('WETH'), 'ETH'); // legacy behavior
});
test('Arc USDC uses six decimals for LI.FI while wallet gas has eighteen', async () => {
  const {c,calls} = setup();
  const q = await c.gwLifiQuote({chainId:5042,toChainId:4663,fromSym:'USDC',toSym:'ETH',amtNum:'0.25',account});
  assert.equal(c.GW_EVM_CHAIN_PARAMS[5042].nativeCurrency.decimals, 18);
  assert.equal(calls[0].fromToken.toLowerCase(), '0x3600000000000000000000000000000000000000');
  assert.equal(calls[0].toToken, zero);
  assert.equal(q._gromFromAmount, '250000');
  assert.equal(c.gwUsesGasBalance(5042, c.gwResolveEvmToken(5042,'USDC','from')), true);
});
test('unknown wallet network is added, switched and verified without sending a transaction', async () => {
  const {c} = setup();
  for (const chain of c.GW_EXTRA_EVM_CHAINS) {
    let current = '0x1', added = false;
    const calls = [];
    await c.gwEnsureChain({request: async ({method, params}) => {
      calls.push(method);
      if (method === 'eth_chainId') return current;
      if (method === 'wallet_addEthereumChain') {
        assert.equal(params[0].chainId, '0x'+chain.id.toString(16)); added = true; return;
      }
      assert.equal(method, 'wallet_switchEthereumChain');
      if (!added) throw Object.assign(new Error('unknown chain'), {code:4902});
      current = params[0].chainId;
    }}, chain.id);
    assert.deepEqual(calls, ['eth_chainId','wallet_switchEthereumChain','wallet_addEthereumChain','wallet_switchEthereumChain','eth_chainId']);
  }
});
