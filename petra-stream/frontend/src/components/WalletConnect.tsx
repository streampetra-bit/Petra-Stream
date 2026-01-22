// src/components/WalletConnect.tsx
import React, { useEffect, useState, useRef } from 'react';
import { ethers } from 'ethers';
import api from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { AUTH_TOKEN_KEY, clearAuth, notifyAuthChange, writeAuth } from '../lib/auth';
import WalletHelpModal from './WalletHelpModal';

declare global {
  interface Window { ethereum?: any }
}

export default function WalletConnect(): JSX.Element {
  const [address, setAddress] = useState<string | null>(null);
  const [shortAddr, setShortAddr] = useState<string>('');
  const [balance, setBalance] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWalletHelp, setShowWalletHelp] = useState(false);
  const mounted = useRef(true);
  const toast = useToast();

  const chainId = Number(import.meta.env.VITE_SOMNIA_CHAIN_ID || 2047);
  const chainIdHex = `0x${chainId.toString(16)}`;
  const chainName = String(import.meta.env.VITE_SOMNIA_CHAIN_NAME || 'Somnia Testnet');
  const rpcUrl = String(import.meta.env.VITE_SOMNIA_RPC_URL || '');
  const explorerUrl = String(import.meta.env.VITE_SOMNIA_EXPLORER_URL || '');
  const symbol = String(import.meta.env.VITE_SOMNIA_SYMBOL || 'SOM');

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function ensureSomniaNetwork() {
    if (!window.ethereum) return false;
    try {
      const current = await window.ethereum.request({ method: 'eth_chainId' });
      if (String(current).toLowerCase() === chainIdHex.toLowerCase()) return true;
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }]
        });
        return true;
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          if (!rpcUrl) {
            toast.error('Missing RPC URL', 'Set VITE_SOMNIA_RPC_URL in frontend env', 4000);
            return false;
          }
          const params: any = {
            chainId: chainIdHex,
            chainName,
            rpcUrls: [rpcUrl],
            nativeCurrency: { name: chainName, symbol, decimals: 18 }
          };
          if (explorerUrl) params.blockExplorerUrls = [explorerUrl];
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [params]
          });
          return true;
        }
        toast.error('Wrong network', `Please switch to ${chainName}`, 3500);
        return false;
      }
    } catch (err) {
      console.error('Network check failed', err);
      return false;
    }
  }

  async function authenticate(addr: string, signer: ethers.Signer) {
    try {
      const nonceRes = await api.get('/api/auth/nonce', { params: { address: addr } }).catch(() => null);
      const message = nonceRes?.data?.message;
      if (!message) {
        toast.error('Auth failed', 'Missing auth message', 3000);
        return;
      }
      const signature = await signer.signMessage(message);
      const verifyRes = await api.post('/api/auth/verify', { address: addr, signature }).catch(() => null);
      const token = verifyRes?.data?.token;
      const user = verifyRes?.data?.user;
      if (token) {
        if (user) {
          writeAuth(user, token);
        } else {
          localStorage.setItem(AUTH_TOKEN_KEY, token);
          notifyAuthChange();
        }
        toast.success('Authenticated', 'Creator actions unlocked', 2500);
      } else {
        toast.error('Auth failed', 'No token returned', 3000);
      }
    } catch (err) {
      console.error('Auth failed', err);
      toast.error('Auth failed', 'Signature rejected', 3000);
    }
  }

  // Initialize provider if injected
  useEffect(() => {
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum, 'any');
      setProvider(p);

      // If user already connected before, try to read address (non-throwing)
      (async () => {
        try {
          const signer = await p.getSigner();
          const addr = await signer.getAddress();
          if (!mounted.current) return;
          setAddress(addr);
        } catch {
          // ignore: not connected
        }
      })();
    }
  }, []);

  // When address or provider changes, refresh short address + balance
  useEffect(() => {
    if (!address) {
      setShortAddr('');
      setBalance(null);
      return;
    }

    setShortAddr(`${address.slice(0, 6)}...${address.slice(-4)}`);

    (async () => {
      if (!provider) return;
      try {
        const bal = await provider.getBalance(address);
        if (!mounted.current) return;
        const eth = ethers.formatEther(bal);
        const parsed = parseFloat(eth);
        setBalance(isFinite(parsed) ? parsed.toFixed(4) : null);
      } catch (err) {
        console.error('Balance fetch failed', err);
        setBalance(null);
      }
    })();
  }, [address, provider]);

  // Listen for account and chain changes
  useEffect(() => {
    const handler = (accounts: string[]) => {
      if (!mounted.current) return;
      if (Array.isArray(accounts) && accounts.length > 0) {
        setAddress(accounts[0]);
        clearAuth();
        toast.info('Account changed', accounts[0], 3000);
      } else {
        // disconnected
        setAddress(null);
        setBalance(null);
        clearAuth();
      }
    };
    const onChainChanged = () => {
      const p = new ethers.BrowserProvider(window.ethereum, 'any');
      setProvider(p);
      toast.info('Network changed', undefined, 2500);
      clearAuth();
    };

    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('accountsChanged', handler);
      window.ethereum.on('chainChanged', onChainChanged);
    }

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handler);
        window.ethereum.removeListener('chainChanged', onChainChanged);
      }
    };
  }, [toast]);

  async function connect() {
    if (!window.ethereum) {
      toast.error('Wallet not detected', 'Install MetaMask or use a wallet-enabled browser', 5000);
      setShowWalletHelp(true);
      return;
    }

    try {
      setLoading(true);
      const ok = await ensureSomniaNetwork();
      if (!ok) return;
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const p = new ethers.BrowserProvider(window.ethereum, 'any');
      setProvider(p);
      const signer = await p.getSigner();
      const addr = await signer.getAddress();
      if (!mounted.current) return;
      setAddress(addr);
      await authenticate(addr, signer);

      const bal = await p.getBalance(addr);
      if (!mounted.current) return;
      const eth = ethers.formatEther(bal);
      setBalance(parseFloat(eth).toFixed(4));
      toast.success('Connected', `${addr.slice(0, 6)}...${addr.slice(-4)}`, 3000);
    } catch (err) {
      console.error('Wallet connect failed', err);
      toast.error('Connect failed', 'See console for details', 4000);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  function disconnect() {
    setAddress(null);
    setBalance(null);
    setProvider(null);
    setMenuOpen(false);
    clearAuth();
    toast.info('Disconnected', undefined, 2500);
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setMenuOpen(false);
      toast.success('Copied', 'Address copied to clipboard', 2000);
    } catch (err) {
      console.error('copy failed', err);
      toast.error('Copy failed', undefined, 2000);
    }
  }

  if (!address) {
    return (
      <>
        <button
          onClick={connect}
          className="btn-primary inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-lg"
          aria-label="Connect wallet"
        >
          {loading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.16"></circle>
              <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"></path>
            </svg>
          ) : null}
          <span>Connect Wallet</span>
        </button>
        {showWalletHelp ? (
          <WalletHelpModal
            onClose={() => setShowWalletHelp(false)}
            siteUrl={typeof window !== 'undefined' ? window.location.origin : 'https://petra-stream.digital'}
            chainName={chainName}
          />
        ) : null}
      </>
    );
  }

  // Connected view
  return (
    <div className="relative inline-flex w-full sm:w-auto items-center gap-3">
      <button
        onClick={() => setMenuOpen((s) => !s)}
        aria-expanded={menuOpen}
        className="inline-flex w-full sm:w-auto items-center justify-between gap-3 rounded-lg px-3 py-1.5 bg-surface border"
        aria-label="Account menu"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-8 h-8 rounded-full neon-ring flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' }}
        >
          <span className="text-xs font-mono text-bg">{shortAddr.slice(0, 2)}</span>
        </div>

        <div className="text-left min-w-0">
          <div className="text-sm font-medium text-text truncate">{shortAddr}</div>
          <div className="text-xs subtle">{balance ? `${balance} ${symbol}` : `-- ${symbol}`}</div>
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 text-subtle transition-transform ${menuOpen ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L10 5.414 5.707 9.707A1 1 0 114.293 8.293l5-5A1 1 0 0110 3z" clipRule="evenodd" />
        </svg>
      </button>

      {/* dropdown menu */}
      {menuOpen && (
        <div
          className="fixed left-4 right-4 bottom-4 max-h-[60vh] overflow-y-auto rounded-lg backdrop-blur-sm shadow-lg z-50 sm:absolute sm:left-auto sm:right-0 sm:bottom-auto sm:mt-2 sm:w-48"
          style={{ background: 'rgb(var(--color-surface-rgb) / 0.95)', borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1 }}
        >
          <div className="p-2">
            <button
              onClick={copyAddress}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-surface/80 transition text-text text-sm"
            >
              Copy address
            </button>

            <a
              href={`${explorerUrl || 'https://etherscan.io'}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="block px-3 py-2 rounded-md hover:bg-surface/80 transition text-text text-sm"
            >
              View on Explorer
            </a>

            <button
              onClick={disconnect}
              className="w-full mt-1 text-left px-3 py-2 rounded-md hover:bg-red-600/20 transition text-sm text-text"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
