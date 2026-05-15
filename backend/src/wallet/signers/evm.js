import { ethers } from 'ethers';
import crypto from 'node:crypto';
import config from '../../config/index.js';

const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)', 'function decimals() view returns (uint8)'];
const NATIVE_ASSET_BY_NETWORK = { ETH: 'ETH', ARB: 'ETH', BASE: 'ETH', MATIC: 'MATIC', BSC: 'BNB' };

export function getEvmProvider(network) {
  const rpc = config.signers.evm.rpcByNetwork[network];
  if (!rpc) throw new Error(`evm_rpc_missing:${network}`);
  return new ethers.JsonRpcProvider(rpc);
}

function dryHash() {
  return `0x${crypto.randomBytes(32).toString('hex')}`;
}

export async function signAndBroadcastEvm({ asset, network, to, amount, hotWallet, dryRun = config.signers.dryRun }) {
  if (dryRun) {
    return { txHash: dryHash(), nonce: 0, dryRun: true, hotWallet: hotWallet?.address || null };
  }
  if (!config.signers.evm.privateKey) throw new Error('evm_private_key_missing');
  const provider = getEvmProvider(network);
  const wallet = new ethers.Wallet(config.signers.evm.privateKey, provider);
  const nonce = await provider.getTransactionCount(wallet.address, 'pending');
  const feeData = await provider.getFeeData();

  const native = NATIVE_ASSET_BY_NETWORK[network];
  if (asset === native) {
    const tx = {
      to,
      nonce,
      value: ethers.parseEther(String(amount)),
      maxFeePerGas: feeData.maxFeePerGas ?? undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
      gasPrice: feeData.gasPrice ?? undefined,
    };
    const gas = await provider.estimateGas({ ...tx, from: wallet.address });
    const sent = await wallet.sendTransaction({ ...tx, gasLimit: gas * 12n / 10n });
    return { txHash: sent.hash, nonce };
  }

  const contractAddress = config.signers.evm.contracts?.[network]?.[asset];
  if (!contractAddress) throw new Error(`evm_contract_missing:${network}:${asset}`);
  const contract = new ethers.Contract(contractAddress, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const value = ethers.parseUnits(String(amount), decimals);
  const gas = await contract.transfer.estimateGas(to, value);
  const sent = await contract.transfer(to, value, {
    nonce,
    gasLimit: gas * 12n / 10n,
    maxFeePerGas: feeData.maxFeePerGas ?? undefined,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
    gasPrice: feeData.gasPrice ?? undefined,
  });
  return { txHash: sent.hash, nonce };
}

export async function getEvmConfirmations({ network, txHash }) {
  if (config.signers.dryRun) return config.signers.confirmations[network] || 12;
  const provider = getEvmProvider(network);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return 0;
  if (receipt.status === 0) {
    const err = new Error('evm_tx_reverted');
    err.reverted = true;
    throw err;
  }
  const block = await provider.getBlockNumber();
  return Math.max(block - Number(receipt.blockNumber) + 1, 0);
}
