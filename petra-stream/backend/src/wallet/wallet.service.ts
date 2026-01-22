import { Injectable, Logger } from '@nestjs/common';
import { Contract, Interface, JsonRpcProvider, WebSocketProvider, ZeroAddress, formatUnits, isAddress, parseUnits } from 'ethers';
import prisma from '../prisma/client';

type BalanceSnapshot = {
  address: string;
  token: string;
  tokenAddress: string;
  symbol: string;
  decimals: number;
  balanceRaw: bigint;
  balance: string;
  minWithdrawRaw: bigint;
  minWithdraw: string;
  tipFeeBps: number;
  withdrawFeeBps: number;
  registered: boolean;
  source: 'chain' | 'ledger';
  withdrawMode: 'full' | 'partial';
  vaultAddress?: string;
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private provider: JsonRpcProvider | WebSocketProvider | null = null;
  private vaultContract: Contract | null = null;
  private registryContract: Contract | null = null;

  private vaultAbi = [
    'function balanceOf(address streamer, address token) view returns (uint256)',
    'function withdraw(address token)'
  ];

  private registryAbi = [
    'function isRegistered(address streamer) view returns (bool)'
  ];

  private resolveRpcUrl() {
    return (
      process.env.SOMNIA_HTTP ||
      process.env.SOMNIA_TEST_HTTP ||
      process.env.SOMNIA_RPC_URL ||
      process.env.SOMNIA_WS ||
      process.env.SOMNIA_TEST_WS ||
      ''
    );
  }

  private getProvider() {
    if (this.provider) return this.provider;
    const rpcUrl = this.resolveRpcUrl();
    if (!rpcUrl) return null;
    this.provider = rpcUrl.startsWith('ws')
      ? new WebSocketProvider(rpcUrl)
      : new JsonRpcProvider(rpcUrl);
    return this.provider;
  }

  private getVaultAddress() {
    return process.env.VAULT_ADDRESS || '';
  }

  private getRegistryAddress() {
    return process.env.REGISTRY_ADDRESS || '';
  }

  private getVaultContract() {
    if (this.vaultContract) return this.vaultContract;
    const provider = this.getProvider();
    const vault = this.getVaultAddress();
    if (!provider || !vault || !isAddress(vault)) return null;
    this.vaultContract = new Contract(vault, this.vaultAbi, provider);
    return this.vaultContract;
  }

  private getRegistryContract() {
    if (this.registryContract) return this.registryContract;
    const provider = this.getProvider();
    const registry = this.getRegistryAddress();
    if (!provider || !registry || !isAddress(registry)) return null;
    this.registryContract = new Contract(registry, this.registryAbi, provider);
    return this.registryContract;
  }

  private resolveTokenAddress(token?: string) {
    const resolved = token || this.defaultToken();
    if (!resolved || resolved === 'native') return ZeroAddress;
    return isAddress(resolved) ? resolved : ZeroAddress;
  }

  private tokenSymbol() {
    return process.env.SOMNIA_SYMBOL || 'SOM';
  }

  private tokenDecimals() {
    const raw = Number(process.env.TOKEN_DECIMALS ?? 18);
    return Number.isFinite(raw) && raw > 0 ? raw : 18;
  }

  private tipFeeBps() {
    const raw = Number(process.env.TIP_FEE_BPS ?? 300);
    return Number.isFinite(raw) && raw >= 0 ? raw : 300;
  }

  private withdrawFeeBps() {
    const raw = Number(process.env.WITHDRAW_FEE_BPS ?? 500);
    return Number.isFinite(raw) && raw >= 0 ? raw : 500;
  }

  private minWithdrawUsd() {
    const raw = Number(process.env.MIN_WITHDRAW_USD ?? 5);
    return Number.isFinite(raw) && raw > 0 ? raw : 5;
  }

  private usdRate() {
    const raw = Number(process.env.SOM_USD_RATE ?? 1);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }

  private treasuryAddress() {
    return process.env.TREASURY_ADDRESS || 'treasury';
  }

  private defaultToken() {
    return process.env.DEFAULT_TOKEN || 'native';
  }

  private minWithdrawRaw(decimals: number) {
    const scale = 1_000_000;
    const rateScaled = BigInt(Math.round(this.usdRate() * scale));
    const usdScaled = BigInt(Math.round(this.minWithdrawUsd() * scale));
    if (rateScaled <= 0n) return 0n;
    const base = 10n ** BigInt(decimals);
    return (usdScaled * base) / rateScaled;
  }

  private async getBalanceRaw(address: string, token: string) {
    const id = `${address}_${token}`;
    const row = await prisma.balance.findUnique({ where: { id } }).catch(() => null);
    if (!row?.amount) return 0n;
    return BigInt(row.amount.toString());
  }

  private async getLedgerSnapshot(address: string, token?: string): Promise<BalanceSnapshot> {
    const resolvedToken = token || this.defaultToken();
    const decimals = this.tokenDecimals();
    const balanceRaw = await this.getBalanceRaw(address, resolvedToken);
    const minWithdrawRaw = this.minWithdrawRaw(decimals);
    return {
      address,
      token: resolvedToken,
      tokenAddress: this.resolveTokenAddress(resolvedToken),
      symbol: this.tokenSymbol(),
      decimals,
      balanceRaw,
      balance: formatUnits(balanceRaw, decimals),
      minWithdrawRaw,
      minWithdraw: formatUnits(minWithdrawRaw, decimals),
      tipFeeBps: this.tipFeeBps(),
      withdrawFeeBps: this.withdrawFeeBps(),
      registered: false,
      source: 'ledger',
      withdrawMode: 'partial'
    };
  }

  async getSnapshot(address: string, token?: string): Promise<BalanceSnapshot> {
    const resolvedToken = token || this.defaultToken();
    const decimals = this.tokenDecimals();
    const minWithdrawRaw = this.minWithdrawRaw(decimals);
    const addressValid = isAddress(address);
    const tokenAddress = this.resolveTokenAddress(resolvedToken);
    const vault = this.getVaultContract();
    const registry = this.getRegistryContract();

    if (!addressValid || !vault) {
      return this.getLedgerSnapshot(address, resolvedToken);
    }

    let registered = true;
    if (registry) {
      registered = await registry.isRegistered(address).catch(() => false);
    }

    let balanceRaw: bigint;
    try {
      balanceRaw = await vault.balanceOf(address, tokenAddress);
    } catch (err) {
      this.logger.warn('vault balance lookup failed', err as any);
      return this.getLedgerSnapshot(address, resolvedToken);
    }

    return {
      address,
      token: resolvedToken,
      tokenAddress,
      symbol: this.tokenSymbol(),
      decimals,
      balanceRaw: BigInt(balanceRaw.toString()),
      balance: formatUnits(balanceRaw, decimals),
      minWithdrawRaw,
      minWithdraw: formatUnits(minWithdrawRaw, decimals),
      tipFeeBps: this.tipFeeBps(),
      withdrawFeeBps: this.withdrawFeeBps(),
      registered,
      source: 'chain',
      withdrawMode: 'full',
      vaultAddress: this.getVaultAddress()
    };
  }

  async withdraw(address: string, amount: string, token?: string) {
    const snapshot = await this.getSnapshot(address, token);
    if (snapshot.source !== 'chain' || !snapshot.vaultAddress || !isAddress(snapshot.vaultAddress)) {
      return { ok: false, reason: 'vault_not_configured', snapshot };
    }
    if (!snapshot.registered) {
      return { ok: false, reason: 'not_registered', snapshot };
    }
    if (snapshot.balanceRaw <= 0n) {
      return { ok: false, reason: 'insufficient_balance', snapshot };
    }
    if (snapshot.balanceRaw < snapshot.minWithdrawRaw) {
      return { ok: false, reason: 'below_minimum', snapshot };
    }

    let amountRaw = parseUnits(amount || '0', snapshot.decimals);
    if (amountRaw <= 0n) {
      amountRaw = snapshot.balanceRaw;
    }
    if (snapshot.withdrawMode === 'full' && amountRaw !== snapshot.balanceRaw) {
      return { ok: false, reason: 'withdraw_full_only', snapshot };
    }
    if (amountRaw > snapshot.balanceRaw) {
      return { ok: false, reason: 'insufficient_balance', snapshot };
    }

    const iface = new Interface(['function withdraw(address token)']);
    const data = iface.encodeFunctionData('withdraw', [snapshot.tokenAddress]);

    return {
      ok: true,
      type: 'contract',
      to: snapshot.vaultAddress,
      data,
      value: '0',
      token: snapshot.token,
      tokenAddress: snapshot.tokenAddress,
      symbol: snapshot.symbol,
      amount: formatUnits(amountRaw, snapshot.decimals),
      amountRaw: amountRaw.toString(),
      balance: snapshot.balance,
      withdrawMode: snapshot.withdrawMode
    };
  }
}
