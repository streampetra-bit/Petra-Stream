// src/pages/NFTStudio.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import Player from "../components/Player";
import WalletHelpModal from "../components/WalletHelpModal";
import { useToast } from "../contexts/ToastContext";
import api from "../lib/api";
import { getAuthToken, readAuthUser } from "../lib/auth";

declare global {
  interface Window {
    ethereum?: any;
  }
}

type Attribute = { trait_type: string; value: string };
type MintRecord = {
  tokenId?: string;
  title: string;
  txHash: string;
  tokenUri: string;
  coverUrl?: string;
  mediaUrl?: string;
  mintedAt: string;
};

const FALLBACK_IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">' +
  '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">' +
  '<stop offset="0%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#22c55e"/>' +
  "</linearGradient></defs>" +
  '<rect width="800" height="450" fill="url(#g)"/>' +
  '<text x="50%" y="50%" fill="#ffffff" font-family="Arial" font-size="32" text-anchor="middle" dominant-baseline="middle">' +
  "Petra Stream Clip</text></svg>";

function toBase64Json(value: unknown) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `data:application/json;base64,${btoa(binary)}`;
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function NFTStudio(): JSX.Element {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [series, setSeries] = useState("");
  const [tags, setTags] = useState("highlight, live");
  const [attributes, setAttributes] = useState<Attribute[]>([{ trait_type: "", value: "" }]);
  const [activePlaybackUrl, setActivePlaybackUrl] = useState("");
  const [showWalletHelp, setShowWalletHelp] = useState(false);
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState<MintRecord[]>(() => {
    try {
      const raw = localStorage.getItem("nft_studio_mints");
      return raw ? (JSON.parse(raw) as MintRecord[]) : [];
    } catch {
      return [];
    }
  });
  const [authUser, setAuthUser] = useState(readAuthUser());

  const chainId = Number(import.meta.env.VITE_SOMNIA_CHAIN_ID || 2047);
  const chainIdHex = `0x${chainId.toString(16)}`;
  const chainName = String(import.meta.env.VITE_SOMNIA_CHAIN_NAME || "Somnia Testnet");
  const rpcUrl = String(import.meta.env.VITE_SOMNIA_RPC_URL || "");
  const explorerUrl = String(import.meta.env.VITE_SOMNIA_EXPLORER_URL || "");
  const symbol = String(import.meta.env.VITE_SOMNIA_SYMBOL || "SOM");
  const registryAddress = String(import.meta.env.VITE_REGISTRY_ADDRESS || "");
  const clipNftAddress = String(import.meta.env.VITE_CLIP_NFT_ADDRESS || "");

  useEffect(() => {
    const handler = () => setAuthUser(readAuthUser());
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, []);

  useEffect(() => {
    if (!getAuthToken()) return;
    let active = true;
    api
      .get("/api/streams/me")
      .then((res) => {
        if (!active) return;
        const url = String(res?.data?.playbackUrl || "");
        if (url) {
          setActivePlaybackUrl(url);
          setMediaUrl((prev) => prev || url);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("nft_studio_mints", JSON.stringify(minted.slice(0, 20)));
    } catch {
      // ignore storage errors
    }
  }, [minted]);

  const metadata = useMemo(() => {
    const cleanedTitle = title.trim() || "Untitled Highlight";
    const cleanedDescription =
      description.trim() || "A Petra Stream highlight captured live on Somnia.";
    const tagList = parseTags(tags);
    const filteredAttributes = attributes
      .map((attr) => ({ trait_type: attr.trait_type.trim(), value: attr.value.trim() }))
      .filter((attr) => attr.trait_type && attr.value);
    const extraAttributes = [
      series.trim() ? { trait_type: "Series", value: series.trim() } : null,
      ...tagList.map((tag) => ({ trait_type: "Tag", value: tag })),
    ].filter(Boolean) as Attribute[];

    const payload: Record<string, unknown> = {
      name: cleanedTitle,
      description: cleanedDescription,
      image: coverUrl.trim() || `data:image/svg+xml;base64,${btoa(FALLBACK_IMAGE_SVG)}`,
    };
    const media = mediaUrl.trim();
    if (media) payload.animation_url = media;
    if (typeof window !== "undefined") payload.external_url = window.location.origin;
    const mergedAttributes = [...filteredAttributes, ...extraAttributes];
    if (mergedAttributes.length) payload.attributes = mergedAttributes;
    if (authUser?.username || authUser?.address) {
      payload.properties = {
        creator: authUser.username || authUser.address,
        platform: "Petra Stream",
      };
    }
    return payload;
  }, [title, description, coverUrl, mediaUrl, series, tags, attributes, authUser]);

  const tokenUri = useMemo(() => toBase64Json(metadata), [metadata]);

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
          const params: any = {
            chainId: chainIdHex,
            chainName,
            rpcUrls: [rpcUrl],
            nativeCurrency: { name: chainName, symbol, decimals: 18 },
          };
          if (explorerUrl) params.blockExplorerUrls = [explorerUrl];
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [params],
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

  async function ensureStreamerRegistered(signer: ethers.Signer, address: string) {
    if (!registryAddress || !ethers.isAddress(registryAddress)) return true;
    try {
      const registry = new ethers.Contract(
        registryAddress,
        ["function isRegistered(address) view returns (bool)", "function registerStreamer(string metadataURI)"],
        signer
      );
      const registered = await registry.isRegistered(address).catch(() => false);
      if (registered) return true;
      toast.info("Registering streamer", "Confirm the on-chain registration.", 2600);
      const metadataUri = `petra-stream://streamer/${address}`;
      const tx = await registry.registerStreamer(metadataUri);
      await tx.wait();
      toast.success("Wallet registered", "Creator profile is now active.", 2600);
      return true;
    } catch (err) {
      console.error("Registration failed", err);
      toast.error("Registration failed", "Please retry or check your wallet.", 3500);
      return false;
    }
  }

  async function copyValue(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied", label, 1800);
    } catch (err) {
      console.error(err);
      toast.error("Copy failed");
    }
  }

  function updateAttribute(index: number, next: Attribute) {
    setAttributes((prev) => prev.map((attr, idx) => (idx === index ? next : attr)));
  }

  function removeAttribute(index: number) {
    setAttributes((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addAttribute() {
    setAttributes((prev) => [...prev, { trait_type: "", value: "" }]);
  }

  function useActiveStream() {
    if (!activePlaybackUrl) {
      toast.info("No live stream detected", "Start a stream to use the live source.", 2400);
      return;
    }
    setMediaUrl(activePlaybackUrl);
    toast.success("Stream source added", "Using your active playback URL.", 2000);
  }

  async function handleMint() {
    if (!title.trim()) {
      toast.error("Title required", "Name your highlight before minting.");
      return;
    }
    if (!mediaUrl.trim() && !coverUrl.trim()) {
      toast.error("Media required", "Add a clip URL or a cover image first.");
      return;
    }
    if (!clipNftAddress || !ethers.isAddress(clipNftAddress)) {
      toast.error("NFT contract missing", "Set VITE_CLIP_NFT_ADDRESS in frontend env.");
      return;
    }
    const wallet = await ensureWalletConnected();
    if (!wallet) return;
    const registered = await ensureStreamerRegistered(wallet.signer, wallet.address);
    if (!registered) return;
    setMinting(true);
    try {
      toast.info("Confirm mint", "Approve the transaction in your wallet.", 2600);
      const contract = new ethers.Contract(
        clipNftAddress,
        [
          "function mint(address to, string tokenURI) returns (uint256)",
          "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
        ],
        wallet.signer
      );
      const tx = await contract.mint(wallet.address, tokenUri);
      const receipt = await tx.wait();
      const iface = new ethers.Interface([
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      ]);
      let tokenId: string | undefined;
      for (const log of receipt.logs) {
        if (String(log.address).toLowerCase() !== clipNftAddress.toLowerCase()) continue;
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "Transfer") {
            tokenId = parsed.args?.tokenId?.toString();
            break;
          }
        } catch {
          // ignore non-matching logs
        }
      }
      const record: MintRecord = {
        tokenId,
        title: title.trim(),
        txHash: tx.hash,
        tokenUri,
        coverUrl: coverUrl.trim() || undefined,
        mediaUrl: mediaUrl.trim() || undefined,
        mintedAt: new Date().toISOString(),
      };
      setMinted((prev) => [record, ...prev].slice(0, 20));
      toast.success("Highlight minted", tokenId ? `Token #${tokenId}` : "Transaction confirmed", 2600);
    } catch (err) {
      console.error(err);
      toast.error("Mint failed", "Check your wallet or try again.", 3000);
    } finally {
      setMinting(false);
    }
  }

  const previewTitle = title.trim() || "Untitled Highlight";
  const previewSubtitle = description.trim() || "Highlight preview";
  const previewPoster = coverUrl.trim() || `data:image/svg+xml;base64,${btoa(FALLBACK_IMAGE_SVG)}`;
  const canMint = Boolean(title.trim()) && (Boolean(mediaUrl.trim()) || Boolean(coverUrl.trim())) && !minting;

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "rgb(var(--color-bg-rgb))",
            backgroundImage:
              "radial-gradient(at 0% 10%, rgba(0, 163, 255, 0.2) 0px, transparent 55%), radial-gradient(at 100% 0%, rgba(124, 255, 109, 0.18) 0px, transparent 45%), radial-gradient(at 50% 100%, rgba(0, 163, 255, 0.12) 0px, transparent 60%)",
          }}
        />
        <div className="absolute top-1/3 -left-72 h-[820px] w-[820px] rounded-full bg-primary/5 blur-[180px]" />
        <div className="absolute bottom-0 -right-72 h-[880px] w-[880px] rounded-full bg-accent/5 blur-[200px]" />
      </div>

      <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-10 space-y-10">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-subtle">NFT Studio</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold">Mint stream highlights on Somnia</h1>
            <p className="text-sm text-subtle max-w-2xl">
              Package your best moments into on-chain collectibles. Attach metadata, preview the clip, and mint a
              highlight in a few clicks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-subtle">
              Network: {chainName}
            </div>
            <button
              onClick={useActiveStream}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-text hover:bg-white/10 transition"
            >
              Use active stream
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-7 space-y-6">
            <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Clip composer</h2>
                  <p className="text-xs text-subtle">Build the metadata for your next NFT drop.</p>
                </div>
                <button
                  onClick={() => copyValue("Token URI", tokenUri)}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 transition"
                >
                  Copy token URI
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">Title</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-2xl h-12 px-5 bg-white/5 border border-white/10 text-text font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Legendary play, final boss, speedrun..."
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-2xl p-4 bg-white/5 border border-white/10 text-text text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Describe the moment, the context, and the community reaction."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">Cover image URL</label>
                  <input
                    value={coverUrl}
                    onChange={(event) => setCoverUrl(event.target.value)}
                    className="w-full rounded-2xl h-12 px-5 bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">Clip media URL</label>
                  <input
                    value={mediaUrl}
                    onChange={(event) => setMediaUrl(event.target.value)}
                    className="w-full rounded-2xl h-12 px-5 bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="https://.../clip.m3u8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">Series</label>
                  <input
                    value={series}
                    onChange={(event) => setSeries(event.target.value)}
                    className="w-full rounded-2xl h-12 px-5 bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Season 01, Episode 04"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">Tags</label>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    className="w-full rounded-2xl h-12 px-5 bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="highlight, speedrun"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">Attributes</label>
                  <button
                    onClick={addAttribute}
                    className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition"
                  >
                    Add attribute
                  </button>
                </div>
                <div className="space-y-3">
                  {attributes.map((attr, index) => (
                    <div key={`attr-${index}`} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <input
                        value={attr.trait_type}
                        onChange={(event) => updateAttribute(index, { ...attr, trait_type: event.target.value })}
                        className="sm:col-span-5 rounded-xl h-10 px-4 bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="Trait"
                      />
                      <input
                        value={attr.value}
                        onChange={(event) => updateAttribute(index, { ...attr, value: event.target.value })}
                        className="sm:col-span-6 rounded-xl h-10 px-4 bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="Value"
                      />
                      <button
                        onClick={() => removeAttribute(index)}
                        className="sm:col-span-1 rounded-xl h-10 border border-white/10 text-xs hover:bg-white/10 transition"
                        aria-label="Remove attribute"
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">Metadata summary</h3>
                  <p className="text-xs text-subtle">This is what will be embedded into the on-chain token URI.</p>
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-subtle">
                  On-chain ready
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-xs text-subtle">
                  <span className="uppercase tracking-[0.2em]">Name</span>
                  <span className="text-text font-semibold truncate max-w-[240px]">{previewTitle}</span>
                </div>
                <div className="text-xs text-subtle">
                  <span className="uppercase tracking-[0.2em]">Description</span>
                  <p className="mt-2 text-text text-sm">{previewSubtitle}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-subtle">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="uppercase tracking-[0.2em] text-[10px]">Cover image</div>
                    <div className="mt-2 text-text text-xs truncate">{coverUrl.trim() || "Auto-generated"}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="uppercase tracking-[0.2em] text-[10px]">Clip URL</div>
                    <div className="mt-2 text-text text-xs truncate">{mediaUrl.trim() || "Not set"}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {(series.trim() ? [series.trim()] : []).map((item) => (
                    <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-subtle">
                      Series: {item}
                    </span>
                  ))}
                  {parseTags(tags).map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-subtle">
                      {tag}
                    </span>
                  ))}
                </div>
                {attributes.some((attr) => attr.trait_type.trim() && attr.value.trim()) ? (
                  <div className="text-xs text-subtle">
                    <div className="uppercase tracking-[0.2em] text-[10px]">Attributes</div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {attributes
                        .filter((attr) => attr.trait_type.trim() && attr.value.trim())
                        .map((attr, index) => (
                          <div
                            key={`${attr.trait_type}-${attr.value}-${index}`}
                            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                          >
                            <div className="text-[10px] uppercase tracking-[0.2em]">{attr.trait_type}</div>
                            <div className="text-xs text-text">{attr.value}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="lg:col-span-5 space-y-6">
            <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Live preview</h3>
                  <p className="text-xs text-subtle">See exactly what collectors will discover.</p>
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-subtle">
                  {clipNftAddress && ethers.isAddress(clipNftAddress) ? "Contract ready" : "No contract"}
                </div>
              </div>

              <Player
                src={mediaUrl.trim() || undefined}
                poster={previewPoster}
                title={previewTitle}
                heightClass="h-[240px] sm:h-[320px]"
                autoPlay={false}
                startMuted
              />

              <div className="space-y-2">
                <h4 className="text-xl font-bold">{previewTitle}</h4>
                <p className="text-sm text-subtle">{previewSubtitle}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-subtle">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="uppercase tracking-[0.2em] text-[10px]">Creator</div>
                  <div className="mt-2 text-text font-semibold truncate">
                    {authUser?.displayName || authUser?.username || authUser?.address || "Unverified"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="uppercase tracking-[0.2em] text-[10px]">Royalty</div>
                  <div className="mt-2 text-text font-semibold">Custom</div>
                </div>
              </div>

              <button
                onClick={handleMint}
                disabled={!canMint}
                className="w-full h-14 rounded-2xl bg-primary text-bg font-bold uppercase tracking-[0.2em] disabled:opacity-60"
              >
                {minting ? "Minting..." : "Mint highlight"}
              </button>
              <div className="text-[10px] text-subtle">
                Minting uses your wallet and stores metadata directly on-chain. Set VITE_CLIP_NFT_ADDRESS to enable.
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Recent mints</h3>
                <span className="text-[10px] uppercase tracking-[0.3em] text-subtle">{minted.length} items</span>
              </div>
              {minted.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-subtle">
                  Minted highlights will appear here.
                </div>
              ) : (
                <div className="space-y-4">
                  {minted.map((item, index) => (
                    <div
                      key={`${item.txHash}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs text-subtle">
                        <span className="uppercase tracking-[0.2em]">Token</span>
                        <span className="text-text font-semibold">{item.tokenId ? `#${item.tokenId}` : "Pending"}</span>
                      </div>
                      <div className="text-sm font-semibold text-text">{item.title}</div>
                      <div className="text-[10px] text-subtle">
                        {new Date(item.mintedAt).toLocaleString()}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => copyValue("Token URI", item.tokenUri)}
                          className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition"
                        >
                          Copy URI
                        </button>
                        {explorerUrl ? (
                          <a
                            href={`${explorerUrl.replace(/\/$/, "")}/tx/${item.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition"
                          >
                            View tx
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

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
