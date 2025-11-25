// src/components/WalletConnect.tsx
import React, { useEffect, useState, useRef } from 'react';
import { ethers } from 'ethers';
import { useToast } from '../contexts/ToastContext';

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
  const mounted = useRef(true);
  const toast = useToast();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Initialize provider if injected
  useEffect(() => {
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum, 'any');
      setProvider(p);

      // If user already connected before, try to read address (non-throwing)
      p.getSigner().getAddress()
        .then((addr) => {
          if (!mounted.current) return;
          setAddress(addr);
        })
        .catch(() => {
          // ignore: not connected
        });
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

  // Listen for account changes (MetaMask / wallets can emit this)
  useEffect(() => {
    const handler = (accounts: string[]) => {
      if (!mounted.current) return;
      if (Array.isArray(accounts) && accounts.length > 0) {
        setAddress(accounts[0]);
        toast.info('Account changed', accounts[0], 3000);
      } else {
        // disconnected
        setAddress(null);
        setBalance(null);
      }
    };

    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('accountsChanged', handler);
      window.ethereum.on?.('chainChanged', () => {
        const p = new ethers.BrowserProvider(window.ethereum, 'any');
        setProvider(p);
        toast.info('Network changed', undefined, 2500);
      });
    }

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handler);
      }
    };
  }, [toast]);

  async function connect() {
    if (!window.ethereum) {
      toast.error('Wallet not detected', 'Install MetaMask or use a wallet-enabled browser', 5000);
      return;
    }

    try {
      setLoading(true);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const p = new ethers.BrowserProvider(window.ethereum, 'any');
      setProvider(p);
      const signer = await p.getSigner();
      const addr = await signer.getAddress();
      if (!mounted.current) return;
      setAddress(addr);

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
      <button
        onClick={connect}
        className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg"
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
    );
  }

  // Connected view
  return (
    <div className="relative inline-flex items-center gap-3">
      <button
        onClick={() => setMenuOpen((s) => !s)}
        aria-expanded={menuOpen}
        className="inline-flex items-center gap-3 rounded-lg px-3 py-1.5 bg-surface border"
        aria-label="Account menu"
        // explicit border color to avoid @apply border-white/... issues in CSS processing
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-8 h-8 rounded-full neon-ring flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' }}
        >
          <span className="text-xs font-mono text-bg">{shortAddr.slice(0, 2)}</span>
        </div>

        <div className="text-left">
          <div className="text-sm font-medium text-text">{shortAddr}</div>
          <div className="text-xs subtle">{balance ? `${balance} ETH` : '— ETH'}</div>
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 text-subtle transition-transform ${menuOpen ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L10 5.414 5.707 9.707A1 1 0 114.293 8.293l5-5A1 1 0 0110 3z" clipRule="evenodd" />
        </svg>
      </button>

      {/* dropdown menu */}
      {menuOpen && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-lg backdrop-blur-sm shadow-lg z-50"
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
              href={`https://etherscan.io/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="block px-3 py-2 rounded-md hover:bg-surface/80 transition text-text text-sm"
            >
              View on Etherscan
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
