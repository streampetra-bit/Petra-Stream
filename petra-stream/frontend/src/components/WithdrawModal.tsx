import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ethers } from "ethers";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";

type BalancePayload = {
  balance: string;
  minWithdraw: string;
  symbol: string;
  withdrawFeeBps: number;
  withdrawMode?: "full" | "partial";
  registered?: boolean;
  source?: string;
  tokenAddress?: string;
  vaultAddress?: string;
};

export default function WithdrawModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<BalancePayload | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setTimeout(() => dialogRef.current?.querySelector("input")?.focus(), 50);
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get("/api/wallet/balance")
      .then((res) => {
        if (!active) return;
        if (res?.data?.balance != null) {
          setBalance({
            balance: res.data.balance,
            minWithdraw: res.data.minWithdraw,
            symbol: res.data.symbol,
            withdrawFeeBps: res.data.withdrawFeeBps ?? 500,
            withdrawMode: res.data.withdrawMode ?? "partial",
            registered: res.data.registered,
            source: res.data.source,
            tokenAddress: res.data.tokenAddress,
            vaultAddress: res.data.vaultAddress,
          });
        }
      })
      .catch((err) => {
        if (err?.response?.status === 401) {
          toast.info("Sign in required", "Sign in to view balances.", 3000);
          return;
        }
        toast.error("Balance unavailable", "Sign in to view balances.", 3000);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    if (balance?.withdrawMode === "full" && balance?.balance != null) {
      setAmount(balance.balance);
    }
  }, [balance?.withdrawMode, balance?.balance]);

  const normalizedAmount = amount.trim();
  const amountIsNumber = /^\d+(\.\d+)?$/.test(normalizedAmount);
  const numericAmount = amountIsNumber ? Number(normalizedAmount) : 0;
  const minWithdrawValue = Number(balance?.minWithdraw ?? 0);
  const balanceValue = Number(balance?.balance ?? 0);
  const requiresFullWithdraw = balance?.withdrawMode === "full";
  const effectiveAmount = requiresFullWithdraw ? balance?.balance ?? "" : normalizedAmount;
  const effectiveAmountIsNumber = /^\d+(\.\d+)?$/.test(effectiveAmount);
  const effectiveNumeric = effectiveAmountIsNumber ? Number(effectiveAmount) : 0;
  const belowMinimum =
    effectiveAmountIsNumber &&
    Number.isFinite(minWithdrawValue) &&
    effectiveNumeric > 0 &&
    effectiveNumeric < minWithdrawValue;
  const exceedsBalance =
    effectiveAmountIsNumber &&
    Number.isFinite(balanceValue) &&
    effectiveNumeric > 0 &&
    effectiveNumeric > balanceValue;
  const feeRate = (balance?.withdrawFeeBps ?? 0) / 10000;
  const estimatedFee = Number.isFinite(effectiveNumeric) ? effectiveNumeric * feeRate : 0;
  const estimatedPayout = Number.isFinite(effectiveNumeric) ? Math.max(0, effectiveNumeric - estimatedFee) : 0;
  const canSubmit =
    effectiveAmountIsNumber &&
    effectiveNumeric > 0 &&
    !belowMinimum &&
    !exceedsBalance &&
    !loading &&
    balance?.registered !== false;
  const inlineError = !effectiveAmount
    ? ""
    : !effectiveAmountIsNumber
      ? "Enter a valid number."
      : balance?.registered === false
        ? "Wallet not registered on-chain."
      : belowMinimum
        ? `Minimum withdrawal is ${balance?.minWithdraw ?? "--"} ${balance?.symbol ?? ""}.`
        : exceedsBalance
          ? "Amount exceeds available balance."
          : "";

  const submit = async () => {
    if (balance?.registered === false) {
      toast.error("Not registered", "Register your wallet on-chain before withdrawing.");
      return;
    }
    if (!effectiveAmountIsNumber || effectiveNumeric <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (belowMinimum) {
      toast.error("Amount below minimum", `Minimum is ${balance?.minWithdraw ?? "--"} ${balance?.symbol ?? ""}.`);
      return;
    }
    if (exceedsBalance) {
      toast.error("Insufficient balance", "Reduce the amount to continue.");
      return;
    }
    setLoading(true);
    try {
      if (!window.ethereum) {
        toast.error("Wallet not detected", "Connect a wallet to withdraw funds.");
        return;
      }
      const res = await api.post("/api/wallet/withdraw", { amount: effectiveAmount });
      const payload = res?.data;
      if (!payload?.ok) {
        const reason = payload?.reason || "Withdrawal failed";
        toast.error("Withdrawal failed", reason, 3500);
        return;
      }
      if (payload.type !== "contract") {
        toast.error("Withdrawal failed", "Unsupported withdrawal mode.");
        return;
      }
      toast.info("Submitting withdrawal...", undefined, 3000);
      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: payload.to,
        data: payload.data,
        value: payload.value ? ethers.parseEther(String(payload.value)) : undefined,
      });
      toast.info("Waiting for confirmation...", undefined, 0);
      await tx.wait();
      toast.success(
        "Withdrawal submitted",
        `On-chain withdrawal sent${payload.amount ? ` (${payload.amount} ${payload.symbol})` : ""}.`,
        4000
      );
      onClose();
    } catch (err: any) {
      if (err?.response?.status === 401) {
        toast.info("Sign in required", "Sign in to withdraw funds.", 3000);
        return;
      }
      toast.error("Withdrawal failed", err?.message || "Request failed", 3500);
    } finally {
      setLoading(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-8"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 2rem)" }}
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative bg-surface/95 text-text rounded-xl w-full max-w-md p-6 glass-card max-h-[calc(100vh-8rem)] overflow-y-auto"
        role="document"
        aria-labelledby="withdraw-modal-title"
      >
        <h3 id="withdraw-modal-title" className="text-lg font-semibold text-primary">
          Withdraw funds
        </h3>
        <p className="text-sm subtle mt-1">
          Withdraw to your connected wallet. A withdrawal fee applies.
        </p>

        <div className="mt-4 grid gap-2">
          <label className="text-xs subtle">
            Amount ({balance?.symbol ?? "SOM"})
          </label>
          <input
            value={requiresFullWithdraw ? balance?.balance ?? "" : amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 border rounded bg-bg/30 text-text"
            inputMode="decimal"
            aria-label="Withdrawal amount"
            disabled={requiresFullWithdraw}
          />
          <div className="text-xs subtle">
            Available: {balance?.balance ?? "--"} {balance?.symbol ?? ""}
          </div>
          <div className="text-xs subtle">
            Minimum: {balance?.minWithdraw ?? "--"} {balance?.symbol ?? ""}
          </div>
          {inlineError ? <div className="text-xs text-rose-200/80">{inlineError}</div> : null}
          {requiresFullWithdraw ? (
            <div className="text-xs text-amber-200/80">
              On-chain vault withdrawals send your full available balance.
            </div>
          ) : null}
        </div>

        <div className="mt-4 text-xs subtle">
          Fee ({Math.round((balance?.withdrawFeeBps ?? 0) / 100)}%): {estimatedFee.toFixed(4)}{" "}
          {balance?.symbol ?? ""}
        </div>
        <div className="text-xs subtle">
          Estimated payout: {estimatedPayout.toFixed(4)} {balance?.symbol ?? ""}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md border" disabled={loading}>
            Cancel
          </button>
          <button onClick={submit} className="px-4 py-2 btn-primary rounded-md" disabled={!canSubmit}>
            {loading ? "Processing..." : "Withdraw"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
