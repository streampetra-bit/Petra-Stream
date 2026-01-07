// src/components/TipModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { ethers } from 'ethers';
import api from '../lib/api';
import { useToast } from '../contexts/ToastContext';

declare global {
  interface Window { ethereum?: any }
}

export default function TipModal({
  streamer,
  onClose,
  onTipped,
}: {
  streamer: string;
  onClose: () => void;
  onTipped: () => void;
}) {
  const [amount, setAmount] = useState('0.01');
  const [loading, setLoading] = useState(false);
  const [memo, setMemo] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    // focus first input
    setTimeout(() => dialogRef.current?.querySelector('input')?.focus(), 50);
  }, []);

  function validateAmount(val: string) {
    try {
      const parsed = parseFloat(val);
      if (!isFinite(parsed) || parsed <= 0) return false;
      return true;
    } catch {
      return false;
    }
  }

  async function sendTip() {
    if (!validateAmount(amount)) {
      toast.error('Invalid amount', 'Enter a numeric amount greater than 0', 3500);
      return;
    }
    if (!window.ethereum) {
      toast.error('Wallet not detected', 'Please install a wallet to send tips', 5000);
      return;
    }

    setLoading(true);
    const notifyId = toast.info('Preparing tip...', undefined, 0);

    try {
      // Ask backend for optional optimized payload
      const resp = await api.post(`/api/streams/${streamer}/tip`, { amount, memo }).catch(() => null);

      const provider = new ethers.BrowserProvider(window.ethereum, 'any');
      const signer = await provider.getSigner();

      let tx;
      if (resp?.data?.type === 'contract') {
        // backend provided contract call info: to, data, value
        const to = resp.data.to;
        const data = resp.data.data;
        const value = resp.data.value ? resp.data.value : undefined;
        toast.info('Submitting contract tip...', undefined, 3000);
        tx = await signer.sendTransaction({
          to,
          data,
          value: value ? ethers.parseEther(String(value)) : undefined,
        });
      } else {
        // fallback: native transfer
        toast.info('Sending native tip...', undefined, 3000);
        tx = await signer.sendTransaction({
          to: streamer,
          value: ethers.parseEther(amount),
        });
      }

      toast.info('Waiting for confirmation...', undefined, 0);
      await tx.wait();
      toast.success('Tip sent', 'Thanks for supporting the streamer!', 4000);
      onTipped();
      onClose();
    } catch (err: any) {
      console.error('Tip failed', err);
      toast.error('Tip failed', err?.message || 'Transaction failed', 6000);
    } finally {
      setLoading(false);
      // remove the "preparing" toast if it's still present by clearing all (simple)
      // you could remove by id if you prefer; our toast API supports remove but we kept it simple.
      // toast.clear() // optional
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative bg-surface/95 text-text rounded-xl w-full max-w-md p-6 glass-card"
        role="document"
        aria-labelledby="tip-modal-title"
      >
        <h3 id="tip-modal-title" className="text-lg font-semibold text-primary">
          Send a tip
        </h3>
        <p className="text-sm subtle mt-1">Support the streamer with a native token gift.</p>

        <div className="mt-4 grid gap-2">
          <label className="text-xs subtle">Amount (ETH)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 border rounded bg-bg/30 text-text"
            inputMode="decimal"
            aria-label="Amount in ETH"
          />

          <label className="text-xs subtle mt-2">Memo (optional)</label>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full p-3 border rounded bg-bg/30 text-text"
            aria-label="Memo"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md border" disabled={loading}>
            Cancel
          </button>
          <button onClick={sendTip} className="px-4 py-2 btn-primary rounded-md" disabled={loading}>
            {loading ? 'Sending...' : 'Send Tip'}
          </button>
        </div>
      </div>
    </div>
  );
}
