// src/pages/NFTGallery.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import WalletHelpModal from "../components/WalletHelpModal";
import { useToast } from "../contexts/ToastContext";
import api from "../lib/api";

declare global {
  interface Window {
    ethereum?: any;
  }
}

type MintRecord = {
  tokenId?: string;
  title: string;
  txHash: string;
  tokenUri: string;
  coverUrl?: string;
  mediaUrl?: string;
  mintedAt: string;
  creatorAddress?: string;
  creatorName?: string;
};

type GalleryItem = MintRecord & {
  description?: string;
  image?: string;
};

type ListingState = {
  seller?: string;
  priceWei?: bigint;
  price?: string;
};

const FALLBACK_IMAGE =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">' +
      '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">' +
      '<stop offset="0%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#22c55e"/>' +
      "</linearGradient></defs>" +
      '<rect width="800" height="450" fill="url(#g)"/>' +
      '<text x="50%" y="50%" fill="#ffffff" font-family="Arial" font-size="28" text-anchor="middle" dominant-baseline="middle">' +
      "Petra Stream Gallery</text></svg>"
  );

function decodeTokenUri(tokenUri: string) {
  const prefix = "data:application/json;base64,";
  if (!tokenUri.startsWith(prefix)) return null;
  try {
    const json = atob(tokenUri.slice(prefix.length));
    return JSON.parse(json) as { image?: string; description?: string };
  } catch {
    return null;
  }
}

function loadMints(): MintRecord[] {
  try {
    const raw = localStorage.getItem("nft_studio_mints");
    return raw ? (JSON.parse(raw) as MintRecord[]) : [];
  } catch {
    return [];
  }
}

export default function NFTGallery(): JSX.Element {
  const toast = useToast();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [showWalletHelp, setShowWalletHelp] = useState(false);
  const [giftTarget, setGiftTarget] = useState<GalleryItem | null>(null);
  const [buyTarget, setBuyTarget] = useState<GalleryItem | null>(null);
  const [listingTarget, setListingTarget] = useState<GalleryItem | null>(null);
  const [recipient, setRecipient] = useState("");
  const [offerAmount, setOfferAmount] = useState("0.25");
  const [listPrice, setListPrice] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [listings, setListings] = useState<Record<string, ListingState>>({});

  const clipNftAddress = String(import.meta.env.VITE_CLIP_NFT_ADDRESS || "");
  const marketplaceAddress = String(import.meta.env.VITE_CLIP_MARKETPLACE_ADDRESS || "");
  const vaultAddress = String(import.meta.env.VITE_VAULT_ADDRESS || "");
  const chainId = Number(import.meta.env.VITE_SOMNIA_CHAIN_ID || 2047);
  const chainIdHex = `0x${chainId.toString(16)}`;
  const chainName = String(import.meta.env.VITE_SOMNIA_CHAIN_NAME || "Somnia Testnet");
  const rpcUrl = String(import.meta.env.VITE_SOMNIA_RPC_URL || "");
  const symbol = String(import.meta.env.VITE_SOMNIA_SYMBOL || "SOM");

  useEffect(() => {
    let active = true;
    const local = loadMints();
    const normalize = (source: MintRecord[]) => {
      const deduped = new Map<string, MintRecord>();
      source.forEach((mint) => {
        const key = mint.txHash || mint.tokenId || mint.mintedAt;
        if (!deduped.has(key)) {
          deduped.set(key, mint);
        }
      });
      return Array.from(deduped.values()).map((mint) => {
        const mintedAt = mint.mintedAt || (mint as any).createdAt || new Date().toISOString();
        const meta = decodeTokenUri(mint.tokenUri);
        return {
          ...mint,
          mintedAt,
          description: meta?.description,
          image: mint.coverUrl || meta?.image,
        };
      });
    };

    api
      .get("/api/nfts?limit=24")
      .then((res) => {
        if (!active) return;
        const remote = Array.isArray(res?.data) ? res.data : res?.data?.items;
        const combined = [...(remote || []), ...local];
        setItems(normalize(combined));
      })
      .catch(() => {
        if (!active) return;
        setItems(normalize(local));
      });
    return () => {
      active = false;
    };
  }, []);

  const marketplaceReady = marketplaceAddress && ethers.isAddress(marketplaceAddress);
  const vaultReady = vaultAddress && ethers.isAddress(vaultAddress);

  async function refreshListings() {
    if (!rpcUrl || !marketplaceReady) return;
    const withTokens = items.filter((item) => item.tokenId);
    if (!withTokens.length) return;
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const market = new ethers.Contract(
        marketplaceAddress,
        ["function listings(uint256) view returns (address seller, uint256 price)"],
        provider
      );
      const updates = await Promise.all(
        withTokens.map(async (item) => {
          const tokenId = BigInt(item.tokenId || "0");
          const listing = await market.listings(tokenId);
          if (!listing || listing.seller === ethers.ZeroAddress || listing.price === 0n) {
            return { tokenId: item.tokenId || "", listing: undefined };
          }
          return {
            tokenId: item.tokenId || "",
            listing: {
              seller: listing.seller as string,
              priceWei: listing.price as bigint,
              price: ethers.formatEther(listing.price as bigint),
            },
          };
        })
      );
      const next: Record<string, ListingState> = {};
      updates.forEach((entry) => {
        if (entry.listing && entry.tokenId) {
          next[entry.tokenId] = entry.listing;
        }
      });
      setListings(next);
    } catch (err) {
      console.error("Failed to load listings", err);
    }
  }

  useEffect(() => {
    refreshListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, marketplaceAddress, rpcUrl]);

  const stats = useMemo(() => {
    const mintedCount = items.length;
    const creatorCount = new Set(items.map((item) => item.creatorAddress).filter(Boolean)).size;
    return {
      mintedCount,
      creatorCount,
      rewards: mintedCount * 12,
    };
  }, [items]);

  async function ensureSomniaNetwork() {
    if (!window.ethereum) return false;
    try {
      const current = await window.ethereum.request({ method: "eth_chainId" });
      if (String(current).toLowerCase() === chainIdHex.toLowerCase()) return true;
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainIdHex }],
        });
        return true;
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          if (!rpcUrl) {
            toast.error("Missing RPC URL", "Set VITE_SOMNIA_RPC_URL in frontend env", 4000);
            return false;
          }
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex,
                chainName,
                rpcUrls: [rpcUrl],
                nativeCurrency: { name: chainName, symbol, decimals: 18 },
              },
            ],
          });
          return true;
        }
        toast.error("Wrong network", `Please switch to ${chainName}`, 3500);
        return false;
      }
    } catch (err) {
      console.error("Network check failed", err);
      return false;
    }
  }

  async function ensureWalletConnected() {
    if (!window.ethereum) {
      setShowWalletHelp(true);
      toast.error("Wallet not detected", "Install MetaMask or use a wallet-enabled browser", 5000);
      return null;
    }
    const ok = await ensureSomniaNetwork();
    if (!ok) return null;
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      return { provider, signer, address };
    } catch (err) {
      console.error("Wallet connect failed", err);
      toast.error("Connect failed", "See console for details", 4000);
      return null;
    }
  }

  async function submitGift() {
    if (!giftTarget) return;
    if (!giftTarget.tokenId) {
      toast.error("Token not ready", "Mint confirmation still pending.");
      return;
    }
    if (!clipNftAddress || !ethers.isAddress(clipNftAddress)) {
      toast.error("Missing NFT contract", "Set VITE_CLIP_NFT_ADDRESS.");
      return;
    }
    if (vaultReady) {
      if (!giftTarget.creatorAddress || !ethers.isAddress(giftTarget.creatorAddress)) {
        toast.error("Creator wallet missing", "Ask the creator to connect their wallet.");
        return;
      }
    } else if (!ethers.isAddress(recipient)) {
      toast.error("Invalid address", "Enter a valid wallet address.");
      return;
    }
    const wallet = await ensureWalletConnected();
    if (!wallet) return;
    setSubmitting(true);
    try {
      const tokenId = BigInt(giftTarget.tokenId);
      if (vaultReady) {
        const nft = new ethers.Contract(
          clipNftAddress,
          [
            "function getApproved(uint256) view returns (address)",
            "function isApprovedForAll(address owner, address operator) view returns (bool)",
            "function setApprovalForAll(address operator, bool approved)",
          ],
          wallet.signer
        );
        const approvedForAll = await nft.isApprovedForAll(wallet.address, vaultAddress);
        const approvedForToken = await nft.getApproved(tokenId);
        if (!approvedForAll && approvedForToken.toLowerCase() !== vaultAddress.toLowerCase()) {
          const approvalTx = await nft.setApprovalForAll(vaultAddress, true);
          await approvalTx.wait();
        }
        const vault = new ethers.Contract(
          vaultAddress,
          ["function giftNFT(address nftContract, uint256 tokenId, address streamer)"],
          wallet.signer
        );
        const tx = await vault.giftNFT(clipNftAddress, tokenId, giftTarget.creatorAddress);
        await tx.wait();
        toast.success("Gift recorded", "On-chain gift sent to the creator.", 2600);
      } else {
        const contract = new ethers.Contract(
          clipNftAddress,
          ["function safeTransferFrom(address from, address to, uint256 tokenId)"],
          wallet.signer
        );
        const tx = await contract.safeTransferFrom(wallet.address, recipient, tokenId);
        await tx.wait();
        toast.success("Gift sent", "NFT transferred successfully.", 2600);
      }
      setGiftTarget(null);
      setRecipient("");
    } catch (err) {
      console.error(err);
      toast.error("Gift failed", "Make sure you own this NFT.", 3500);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOffer() {
    if (!buyTarget) return;
    if (!buyTarget.creatorAddress || !ethers.isAddress(buyTarget.creatorAddress)) {
      toast.error("Creator address missing", "Ask the creator to connect a wallet.");
      return;
    }
    const wallet = await ensureWalletConnected();
    if (!wallet) return;
    setSubmitting(true);
    try {
      const value = ethers.parseEther(offerAmount || "0");
      if (value <= 0n) {
        toast.error("Invalid amount", "Enter a positive amount.");
        return;
      }
      const tx = await wallet.signer.sendTransaction({
        to: buyTarget.creatorAddress,
        value,
      });
      await tx.wait();
      toast.success("Offer sent", "Creator received your purchase request.", 2600);
      setBuyTarget(null);
    } catch (err) {
      console.error(err);
      toast.error("Offer failed", "Try again or check your wallet.", 3500);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitListing() {
    if (!listingTarget) return;
    if (!listingTarget.tokenId) {
      toast.error("Token not ready", "Mint confirmation still pending.");
      return;
    }
    if (!marketplaceReady) {
      toast.error("Marketplace missing", "Set VITE_CLIP_MARKETPLACE_ADDRESS.");
      return;
    }
    if (!clipNftAddress || !ethers.isAddress(clipNftAddress)) {
      toast.error("NFT contract missing", "Set VITE_CLIP_NFT_ADDRESS.");
      return;
    }
    const wallet = await ensureWalletConnected();
    if (!wallet) return;
    setSubmitting(true);
    try {
      const tokenId = BigInt(listingTarget.tokenId);
      const nft = new ethers.Contract(
        clipNftAddress,
        [
          "function ownerOf(uint256) view returns (address)",
          "function isApprovedForAll(address owner, address operator) view returns (bool)",
          "function setApprovalForAll(address operator, bool approved)",
        ],
        wallet.signer
      );
      const owner = await nft.ownerOf(tokenId);
      if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        toast.error("Not owner", "Connect the wallet that owns this NFT.");
        return;
      }
      const approved = await nft.isApprovedForAll(wallet.address, marketplaceAddress);
      if (!approved) {
        const approvalTx = await nft.setApprovalForAll(marketplaceAddress, true);
        await approvalTx.wait();
      }
      const priceWei = ethers.parseEther(listPrice || "0");
      if (priceWei <= 0n) {
        toast.error("Invalid price", "Enter a listing price.");
        return;
      }
      const market = new ethers.Contract(
        marketplaceAddress,
        ["function list(uint256 tokenId, uint256 price)"],
        wallet.signer
      );
      const tx = await market.list(tokenId, priceWei);
      await tx.wait();
      toast.success("Listed for sale", "Buyers can now purchase this NFT.", 2600);
      setListingTarget(null);
      await refreshListings();
    } catch (err) {
      console.error(err);
      toast.error("Listing failed", "Check approvals and try again.", 3500);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelListing() {
    if (!listingTarget?.tokenId || !marketplaceReady) return;
    const wallet = await ensureWalletConnected();
    if (!wallet) return;
    setSubmitting(true);
    try {
      const tokenId = BigInt(listingTarget.tokenId);
      const market = new ethers.Contract(
        marketplaceAddress,
        ["function cancel(uint256 tokenId)"],
        wallet.signer
      );
      const tx = await market.cancel(tokenId);
      await tx.wait();
      toast.success("Listing canceled", "Your NFT is no longer for sale.", 2400);
      setListingTarget(null);
      await refreshListings();
    } catch (err) {
      console.error(err);
      toast.error("Cancel failed", "Check your wallet and try again.", 3000);
    } finally {
      setSubmitting(false);
    }
  }

  async function buyNow(item: GalleryItem) {
    if (!item.tokenId) return;
    if (!marketplaceReady) {
      toast.error("Marketplace missing", "Set VITE_CLIP_MARKETPLACE_ADDRESS.");
      return;
    }
    const listing = listings[item.tokenId];
    if (!listing?.priceWei) {
      toast.error("Not listed", "This NFT is not listed for sale.");
      return;
    }
    const wallet = await ensureWalletConnected();
    if (!wallet) return;
    setSubmitting(true);
    try {
      const tokenId = BigInt(item.tokenId);
      const market = new ethers.Contract(
        marketplaceAddress,
        ["function buy(uint256 tokenId) payable"],
        wallet.signer
      );
      const tx = await market.buy(tokenId, { value: listing.priceWei });
      await tx.wait();
      toast.success("Purchase complete", "NFT transferred to your wallet.", 2600);
      await refreshListings();
    } catch (err) {
      console.error(err);
      toast.error("Purchase failed", "Try again or check your wallet.", 3500);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-bg text-text overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(at 0% 0%, rgba(14, 165, 233, 0.18) 0px, transparent 55%), radial-gradient(at 100% 15%, rgba(34, 197, 94, 0.15) 0px, transparent 55%)",
          }}
        />
      </div>

      <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-10 space-y-10">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-subtle">NFT Gallery</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold">Collect, gift, and celebrate creator highlights</h1>
            <p className="text-sm text-subtle max-w-2xl">
              Explore minted stream moments, celebrate creators with NFT gifts, and support their drops directly on
              Somnia.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em] text-subtle">
              {stats.mintedCount} highlights
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em] text-subtle">
              {stats.creatorCount} creators
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em] text-subtle">
              {stats.rewards} reward points
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 glass-card rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Creator drops</h2>
                <p className="text-xs text-subtle">Gift or sponsor a creator to unlock community badges.</p>
              </div>
            </div>
            {!marketplaceReady && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-xs text-subtle">
                Marketplace not configured. Set <span className="text-text">VITE_CLIP_MARKETPLACE_ADDRESS</span> to
                enable buy and listing actions.
              </div>
            )}

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-subtle">
                Minted highlights will appear here once creators mint their first NFT.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {items.map((item, index) => {
                  const listing = item.tokenId ? listings[item.tokenId] : undefined;
                  const isListed = Boolean(listing?.priceWei && listing.priceWei > 0n);
                  const buyLabel = isListed ? `Buy now ${listing?.price ?? ""} ${symbol}` : "Make offer";
                  return (
                    <div key={`${item.txHash}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
                      <img
                        src={item.image || FALLBACK_IMAGE}
                        alt={item.title}
                        className="h-48 w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]">
                        {item.tokenId ? `#${item.tokenId}` : "Pending"}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-semibold text-text">{item.title}</div>
                      <div className="text-xs text-subtle line-clamp-2">
                        {item.description || "A Petra Stream highlight minted on Somnia."}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-subtle">
                        <span>
                          {item.creatorName || item.creatorAddress || "Creator"}
                        </span>
                        <span>{new Date(item.mintedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-[11px] text-subtle">
                        {isListed ? `Listed for ${listing?.price ?? "?"} ${symbol}` : "Not listed yet"}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                        <button
                          onClick={() => {
                            setGiftTarget(item);
                            setRecipient("");
                          }}
                          className="h-10 rounded-xl border border-white/10 text-xs font-semibold hover:bg-white/10 transition"
                        >
                          Gift NFT
                        </button>
                        <button
                          onClick={() => {
                            setListingTarget(item);
                            setListPrice(listing?.price || "1");
                          }}
                          className="h-10 rounded-xl border border-white/10 text-xs font-semibold hover:bg-white/10 transition"
                        >
                          List for sale
                        </button>
                        <button
                          onClick={() => {
                            if (isListed) {
                              buyNow(item);
                              return;
                            }
                            setBuyTarget(item);
                            setOfferAmount("0.25");
                          }}
                          className="h-10 rounded-xl bg-primary text-bg text-xs font-semibold"
                        >
                          {buyLabel}
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="text-lg font-bold">Creator rewards</h3>
              <p className="text-xs text-subtle">
                Each gift or purchase boosts a creator's streak. Top supporters unlock profile badges and featured
                placement.
              </p>
              <div className="space-y-3 text-xs text-subtle">
                <div className="flex items-center justify-between">
                  <span>Gifting streak</span>
                  <span className="font-semibold text-text">+{stats.mintedCount * 2} pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Collector level</span>
                  <span className="font-semibold text-text">{Math.max(1, stats.mintedCount)} / 10</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Network</span>
                  <span className="font-semibold text-text">{chainName}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-subtle">
                Gifts transfer ownership on-chain. Purchase offers send {symbol} to the creator as a pledge. A full
                marketplace flow is coming next.
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="text-lg font-bold">Featured perks</h3>
              <ul className="space-y-3 text-xs text-subtle">
                <li className="flex items-center justify-between">
                  <span>Creator spotlight</span>
                  <span className="text-text font-semibold">Active</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Community raffle</span>
                  <span className="text-text font-semibold">Next drop</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Badge tier</span>
                  <span className="text-text font-semibold">Bronze</span>
                </li>
              </ul>
            </div>
          </aside>
        </section>
      </div>

      {giftTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-bg p-6 space-y-4">
            <div className="text-lg font-bold">Gift NFT</div>
            <p className="text-xs text-subtle">
              {vaultReady
                ? "Send this NFT into the Petra Vault so the gift shows up in activity and balances."
                : "Transfer this NFT directly to a fan or creator wallet."}
            </p>
            {vaultReady ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-subtle">
                Creator wallet:{" "}
                <span className="font-mono text-text">
                  {giftTarget.creatorAddress || "Missing"}
                </span>
              </div>
            ) : (
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-text"
                placeholder="Recipient wallet address"
              />
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setGiftTarget(null)}
                className="flex-1 h-11 rounded-xl border border-white/10 text-xs font-semibold"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={submitGift}
                disabled={submitting}
                className="flex-1 h-11 rounded-xl bg-primary text-bg text-xs font-semibold disabled:opacity-60"
                type="button"
              >
                {submitting ? "Sending..." : vaultReady ? "Gift via vault" : "Send gift"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {buyTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-bg p-6 space-y-4">
            <div className="text-lg font-bold">Purchase offer</div>
            <p className="text-xs text-subtle">
              Send a {symbol} offer to <span className="text-text font-semibold">{buyTarget.creatorName || "creator"}</span>.
            </p>
            <input
              value={offerAmount}
              onChange={(event) => setOfferAmount(event.target.value)}
              className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-text"
              placeholder={`Amount in ${symbol}`}
            />
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-subtle">
              Offers are direct on-chain pledges. Creator must finalize the transfer manually until marketplace is live.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBuyTarget(null)}
                className="flex-1 h-11 rounded-xl border border-white/10 text-xs font-semibold"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={submitOffer}
                disabled={submitting}
                className="flex-1 h-11 rounded-xl bg-primary text-bg text-xs font-semibold disabled:opacity-60"
                type="button"
              >
                {submitting ? "Sending..." : "Send offer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {listingTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-bg p-6 space-y-4">
            <div className="text-lg font-bold">List NFT for sale</div>
            <p className="text-xs text-subtle">
              List <span className="text-text font-semibold">{listingTarget.title}</span> on the Petra marketplace.
            </p>
            {listingTarget.tokenId && listings[listingTarget.tokenId] ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-subtle">
                Current listing: {listings[listingTarget.tokenId]?.price} {symbol}
              </div>
            ) : null}
            <input
              value={listPrice}
              onChange={(event) => setListPrice(event.target.value)}
              className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-text"
              placeholder={`Price in ${symbol}`}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setListingTarget(null)}
                className="flex-1 h-11 rounded-xl border border-white/10 text-xs font-semibold"
                type="button"
              >
                Close
              </button>
              {listingTarget.tokenId && listings[listingTarget.tokenId] ? (
                <button
                  onClick={cancelListing}
                  disabled={submitting}
                  className="flex-1 h-11 rounded-xl border border-rose-500/40 text-rose-300 text-xs font-semibold disabled:opacity-60"
                  type="button"
                >
                  {submitting ? "Working..." : "Cancel listing"}
                </button>
              ) : null}
              <button
                onClick={submitListing}
                disabled={submitting}
                className="flex-1 h-11 rounded-xl bg-primary text-bg text-xs font-semibold disabled:opacity-60"
                type="button"
              >
                {submitting ? "Listing..." : "List now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showWalletHelp ? (
        <WalletHelpModal
          onClose={() => setShowWalletHelp(false)}
          siteUrl={typeof window !== "undefined" ? window.location.origin : "https://petra-stream.digital"}
          chainName={chainName}
        />
      ) : null}
    </div>
  );
}
