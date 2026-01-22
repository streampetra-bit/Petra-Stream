import React from "react";

type WalletHelpModalProps = {
  onClose: () => void;
  siteUrl: string;
  chainName?: string;
};

export default function WalletHelpModal({
  onClose,
  siteUrl,
  chainName,
}: WalletHelpModalProps): JSX.Element {
  const safeUrl = siteUrl || "https://petra-stream.digital";
  const metamaskDeepLink = `https://metamask.app.link/dapp/${safeUrl.replace(/^https?:\/\//, "")}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-8"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 2rem)" }}
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative bg-surface/95 text-text rounded-xl w-full max-w-md p-6 glass-card max-h-[calc(100vh-8rem)] overflow-y-auto"
        role="document"
        aria-labelledby="wallet-help-title"
      >
        <h3 id="wallet-help-title" className="text-lg font-semibold text-primary">
          Wallet required to go live
        </h3>
        <p className="text-sm subtle mt-1">
          Connect a Somnia compatible wallet to stream and earn on-chain.
        </p>

        <div className="mt-4 space-y-3 text-sm text-white/70">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.25em] text-white/40 font-bold">Step 1</div>
            <p className="mt-1">
              Install MetaMask (or any EVM wallet) and enable {chainName || "Somnia"}.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.25em] text-white/40 font-bold">Step 2</div>
            <p className="mt-1">
              Open this page in a wallet-enabled browser and connect your wallet.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-md border border-white/10 text-xs"
          >
            Install MetaMask
          </a>
          <a
            href={metamaskDeepLink}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-md border border-white/10 text-xs"
          >
            Open in MetaMask
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(safeUrl)}
            className="px-4 py-2 rounded-md border border-white/10 text-xs"
          >
            Copy site link
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md border">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
