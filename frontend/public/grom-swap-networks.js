/* Selected LI.FI mainnets. Metadata and seed contracts verified against
 * /v1/chains and /v1/tokens on 2026-11-01; prices are always fetched live.
 * Keep Arc's RPC native precision (18) separate from its USDC ERC-20 (6). */
(function (root) {
  'use strict';
  const chains = [
  {
    "id": 4663,
    "key": "robinhood",
    "name": "Robinhood Chain",
    "short": "Robinhood",
    "color": "#CCFF00",
    "logoURI": "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/robinhood.svg",
    "wallet": {
      "chainId": "0x1237",
      "blockExplorerUrls": [
        "https://robin.etherscan.io/"
      ],
      "chainName": "Robinhood Chain",
      "nativeCurrency": {
        "name": "Ether",
        "symbol": "ETH",
        "decimals": 18
      },
      "rpcUrls": [
        "https://rpc.mainnet.chain.robinhood.com/"
      ]
    },
    "tokens": [
      {
        "symbol": "ETH",
        "address": "0x0000000000000000000000000000000000000000",
        "decimals": 18,
        "name": "ETH",
        "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
        "verificationStatus": "unverified"
      },
      {
        "symbol": "USDG",
        "address": "0x0A3B763d66c0e8c7555c986A3701E1DC1Bf3954F",
        "decimals": 6,
        "name": "Paxos USDG",
        "logoURI": "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/unknown.svg",
        "verificationStatus": "verified"
      },
      {
        "symbol": "WETH",
        "address": "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
        "decimals": 18,
        "name": "Wrapped Ether",
        "logoURI": "https://static.debank.com/image/uni_token/logo_url/uni/48bfb74adddd170e936578aec422836d.png",
        "verificationStatus": "verified"
      },
      {
        "symbol": "USDe",
        "address": "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34",
        "decimals": 18,
        "name": "USDe",
        "logoURI": "https://static.debank.com/image/eth_token/logo_url/0x4c9edd5852cd905f086c759e8383e09bff1e68b3/734064e545eabfc501b9d0e752644b7d.png",
        "verificationStatus": "verified"
      }
    ],
    "defaultTo": "USDE",
    "wrapped": "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"
  },
  {
    "id": 999,
    "key": "hyperevm",
    "name": "HyperEVM",
    "short": "HyperEVM",
    "color": "#50D2C1",
    "logoURI": "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/hyperevm.svg",
    "wallet": {
      "chainId": "0x3e7",
      "blockExplorerUrls": [
        "https://hyperevmscan.io/"
      ],
      "chainName": "HyperEVM",
      "nativeCurrency": {
        "name": "HYPE",
        "symbol": "HYPE",
        "decimals": 18
      },
      "rpcUrls": [
        "https://rpc.hyperliquid.xyz/evm",
        "https://rpc.hyperlend.finance",
        "https://hyperliquid-json-rpc.stakely.io",
        "https://hyperliquid.drpc.org",
        "https://rpc.hypurrscan.io"
      ]
    },
    "tokens": [
      {
        "symbol": "HYPE",
        "address": "0x0000000000000000000000000000000000000000",
        "decimals": 18,
        "name": "HYPE",
        "logoURI": "https://static.debank.com/image/hyper_token/logo_url/hyper/0b3e288cfe418e9ce69eef4c96374583.png",
        "verificationStatus": "verified"
      },
      {
        "symbol": "USDC",
        "address": "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
        "decimals": 6,
        "name": "USDC",
        "logoURI": "https://static.debank.com/image/coin/logo_url/usdc/e87790bfe0b3f2ea855dc29069b38818.png",
        "verificationStatus": "verified"
      },
      {
        "symbol": "WHYPE",
        "address": "0x5555555555555555555555555555555555555555",
        "decimals": 18,
        "name": "Wrapped HYPE",
        "logoURI": "https://static.debank.com/image/hyper_token/logo_url/0x5555555555555555555555555555555555555555/752e760ec0b1a17b81c7535e09e76ef8.png",
        "verificationStatus": "verified"
      }
    ],
    "defaultTo": "USDC",
    "wrapped": "0x5555555555555555555555555555555555555555"
  },
  {
    "id": 143,
    "key": "monad",
    "name": "Monad",
    "short": "Monad",
    "color": "#836EF9",
    "logoURI": "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/monad.svg",
    "wallet": {
      "chainId": "0x8f",
      "blockExplorerUrls": [
        "https://monadscan.com/"
      ],
      "chainName": "Monad",
      "nativeCurrency": {
        "name": "MON",
        "symbol": "MON",
        "decimals": 18
      },
      "rpcUrls": [
        "https://rpc.monad.xyz",
        "https://rpc1.monad.xyz",
        "https://rpc2.monad.xyz",
        "https://rpc3.monad.xyz",
        "https://rpc4.monad.xyz",
        "https://rpc-mainnet.monadinfra.com"
      ]
    },
    "tokens": [
      {
        "symbol": "MON",
        "address": "0x0000000000000000000000000000000000000000",
        "decimals": 18,
        "name": "Monad",
        "logoURI": "https://static.debank.com/image/monad_token/logo_url/monad/9df1611d238781f78045fba9101359a3.png",
        "verificationStatus": "flagged"
      },
      {
        "symbol": "USDC",
        "address": "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
        "decimals": 6,
        "name": "USD Coin",
        "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
        "verificationStatus": "verified"
      },
      {
        "symbol": "WMON",
        "address": "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
        "decimals": 18,
        "name": "Wrapped Monad",
        "logoURI": "https://static.debank.com/image/ink_token/logo_url/0xfbbf3f86a29467f3866d0ab37b8c72b5ca1b159f/d75d4109e99126aa282e2da1e5267db7.png",
        "verificationStatus": "verified"
      }
    ],
    "defaultTo": "USDC",
    "wrapped": "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A"
  },
  {
    "id": 5042,
    "key": "arc",
    "name": "Arc",
    "short": "Arc",
    "color": "#89AFFF",
    "logoURI": "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arc.svg",
    "wallet": {
      "chainId": "0x13b2",
      "blockExplorerUrls": [
        "https://explorer.arc.io"
      ],
      "chainName": "Arc",
      "nativeCurrency": {
        "name": "USDC",
        "symbol": "USDC",
        "decimals": 18
      },
      "rpcUrls": [
        "https://rpc.drpc.mainnet.arc.io",
        "https://rpc.mainnet.arc.io",
        "https://rpc.quicknode.mainnet.arc.io"
      ]
    },
    "tokens": [
      {
        "symbol": "USDC",
        "address": "0x3600000000000000000000000000000000000000",
        "decimals": 6,
        "name": "USDC",
        "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
        "verificationStatus": "verified"
      },
      {
        "symbol": "EURC",
        "address": "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1",
        "decimals": 6,
        "name": "Eurc",
        "logoURI": "https://static.debank.com/image/eth_token/logo_url/0x1abaea1f7c830bd89acc67ec4af516284b1bc33c/790d0c3a6da87111b66255c0d57108fa.png",
        "verificationStatus": "verified"
      },
      {
        "symbol": "WETH",
        "address": "0x128cC466B61f542da60c70e3aA11c10e19B84EDB",
        "decimals": 18,
        "name": "Wrapped Ether",
        "verificationStatus": "verified"
      }
    ],
    "defaultTo": "EURC",
    "wrapped": "0x128cC466B61f542da60c70e3aA11c10e19B84EDB"
  },
  {
    "id": 9745,
    "key": "plasma",
    "name": "Plasma",
    "short": "Plasma",
    "color": "#63D7BB",
    "logoURI": "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/plasma.svg",
    "wallet": {
      "chainId": "0x2611",
      "blockExplorerUrls": [
        "https://plasmascan.to/"
      ],
      "chainName": "Plasma",
      "nativeCurrency": {
        "name": "XPL",
        "symbol": "XPL",
        "decimals": 18
      },
      "rpcUrls": [
        "https://rpc.plasma.to"
      ]
    },
    "tokens": [
      {
        "symbol": "XPL",
        "address": "0x0000000000000000000000000000000000000000",
        "decimals": 18,
        "name": "Plasma",
        "logoURI": "https://s2.coinmarketcap.com/static/img/coins/64x64/36645.png",
        "verificationStatus": "flagged"
      },
      {
        "symbol": "USDT0",
        "address": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
        "decimals": 6,
        "name": "USD₮0",
        "logoURI": "https://static.debank.com/image/ink_token/logo_url/0x0200c29006150606b650577bbe7b6248f58470c1/8bba37fddc2774e06a94b8952e3e3ad7.png",
        "verificationStatus": "verified"
      },
      {
        "symbol": "WXPL",
        "address": "0x6100E367285b01F48D07953803A2d8dCA5D19873",
        "decimals": 18,
        "name": "Wrapped Plasma",
        "logoURI": "https://s2.coinmarketcap.com/static/img/coins/64x64/36645.png",
        "verificationStatus": "verified"
      }
    ],
    "defaultTo": "USDT0",
    "wrapped": "0x6100E367285b01F48D07953803A2d8dCA5D19873"
  },
  {
    "id": 196,
    "key": "xlayer",
    "name": "X Layer",
    "short": "X Layer",
    "color": "#FFFFFF",
    "logoURI": "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/xlayer.svg",
    "wallet": {
      "chainId": "0xc4",
      "blockExplorerUrls": [
        "https://www.oklink.com/xlayer/",
        "https://www.okx.com/web3/explorer/xlayer/"
      ],
      "chainName": "X Layer Mainnet",
      "nativeCurrency": {
        "name": "OKB",
        "symbol": "OKB",
        "decimals": 18
      },
      "rpcUrls": [
        "https://rpc.xlayer.tech/",
        "https://xlayerrpc.okx.com"
      ]
    },
    "tokens": [
      {
        "symbol": "OKB",
        "address": "0x0000000000000000000000000000000000000000",
        "decimals": 18,
        "name": "OKB",
        "logoURI": "https://static.debank.com/image/xlayer_token/logo_url/0xe538905cf8410324e03a5a23c1c177a474d59b2b/b58d6980429c56560d9241765bdf9c2b.png",
        "verificationStatus": "verified"
      },
      {
        "symbol": "USDC",
        "address": "0xB6CEceAB302E2E4948951eE7843FC24E92933061",
        "decimals": 6,
        "name": "USDC",
        "logoURI": "https://static.debank.com/image/xlayer_token/logo_url/0xb6ceceab302e2e4948951ee7843fc24e92933061/511c3401e4cf1db72608249c7d5a01e6.png",
        "verificationStatus": "verified"
      },
      {
        "symbol": "WOKB",
        "address": "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
        "decimals": 18,
        "name": "Wrapped OKB",
        "logoURI": "https://static.debank.com/image/xlayer_token/logo_url/0xe538905cf8410324e03a5a23c1c177a474d59b2b/b58d6980429c56560d9241765bdf9c2b.png",
        "verificationStatus": "unverified"
      }
    ],
    "defaultTo": "USDC",
    "wrapped": "0xe538905cf8410324e03A5A23C1c177a474D59b2b"
  }
].map(chain => ({ ...chain, nativeToken: chain.tokens[0] }));
  const byId = Object.fromEntries(chains.map(chain => [chain.id, chain]));
  root.GromSwapNetworks = Object.freeze({ chains, byId });
})(typeof window !== 'undefined' ? window : globalThis);
