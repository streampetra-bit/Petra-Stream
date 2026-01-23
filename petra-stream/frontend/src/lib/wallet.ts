import { BrowserProvider, ethers } from "ethers";
import EthereumProvider from "@walletconnect/ethereum-provider";

type WalletConnectOptions = {
  chainId: number;
  chainName: string;
  rpcUrl?: string;
  explorerUrl?: string;
  symbol: string;
  projectId?: string;
  appName?: string;
  appUrl?: string;
  appIcon?: string;
};

export type WalletConnection = {
  provider: BrowserProvider;
  signer: ethers.Signer;
  address: string;
  kind: "injected" | "walletconnect";
  rawProvider: any;
  disconnect?: () => Promise<void>;
};

let wcProvider: EthereumProvider | null = null;

async function ensureInjectedNetwork(opts: WalletConnectOptions) {
  const injected = (window as any).ethereum;
  if (!injected) return false;
  const chainIdHex = `0x${opts.chainId.toString(16)}`;
  try {
    const current = await injected.request({ method: "eth_chainId" });
    if (String(current).toLowerCase() === chainIdHex.toLowerCase()) return true;
    try {
      await injected.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
      return true;
    } catch (switchErr: any) {
      if (switchErr?.code === 4902) {
        if (!opts.rpcUrl) return false;
        const params: any = {
          chainId: chainIdHex,
          chainName: opts.chainName,
          rpcUrls: [opts.rpcUrl],
          nativeCurrency: { name: opts.chainName, symbol: opts.symbol, decimals: 18 },
        };
        if (opts.explorerUrl) params.blockExplorerUrls = [opts.explorerUrl];
        await injected.request({
          method: "wallet_addEthereumChain",
          params: [params],
        });
        return true;
      }
      return false;
    }
  } catch {
    return false;
  }
}

async function connectInjected(opts: WalletConnectOptions): Promise<WalletConnection> {
  const injected = (window as any).ethereum;
  if (!injected) {
    throw new Error("no_injected_wallet");
  }
  const ok = await ensureInjectedNetwork(opts);
  if (!ok) {
    throw new Error("wrong_network");
  }
  await injected.request({ method: "eth_requestAccounts" });
  const provider = new BrowserProvider(injected, "any");
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address, kind: "injected", rawProvider: injected };
}

async function connectWalletConnect(opts: WalletConnectOptions): Promise<WalletConnection> {
  if (!opts.projectId) {
    throw new Error("missing_project_id");
  }
  if (!wcProvider) {
    wcProvider = await EthereumProvider.init({
      projectId: opts.projectId,
      chains: [opts.chainId],
      optionalChains: [opts.chainId],
      showQrModal: true,
      rpcMap: opts.rpcUrl ? { [opts.chainId]: opts.rpcUrl } : undefined,
      metadata: {
        name: opts.appName || "Petra Stream",
        description: "Cinematic Web3 streaming",
        url: opts.appUrl || (typeof window !== "undefined" ? window.location.origin : ""),
        icons: [opts.appIcon || ""].filter(Boolean),
      },
    });
  }

  await wcProvider.connect();
  const provider = new BrowserProvider(wcProvider, "any");
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return {
    provider,
    signer,
    address,
    kind: "walletconnect",
    rawProvider: wcProvider,
    disconnect: async () => {
      try {
        await wcProvider?.disconnect();
      } catch {}
      wcProvider = null;
    },
  };
}

export async function connectWallet(opts: WalletConnectOptions): Promise<WalletConnection> {
  try {
    if ((window as any).ethereum) {
      return await connectInjected(opts);
    }
  } catch (err: any) {
    const message = String(err?.message || "");
    if (!message.toLowerCase().includes("no_injected_wallet")) {
      // fall through to walletconnect for common extension failures
    }
  }
  return connectWalletConnect(opts);
}

export async function disconnectWallet() {
  if (wcProvider) {
    try {
      await wcProvider.disconnect();
    } catch {}
    wcProvider = null;
  }
}
