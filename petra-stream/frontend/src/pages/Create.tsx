
// src/pages/Create.tsx
import React, { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import api from "../lib/api";
import StreamKeyPanel from "../components/StreamKeyPanel";
import { useToast } from "../contexts/ToastContext";
import Player from "../components/Player";
import WebRTCPlayer from "../components/WebRTCPlayer";
import CloudflareIframePlayer from "../components/CloudflareIframePlayer";
import LocalRecorder from "../components/LocalRecorder";
import ChatPanel from "../components/ChatPanel";
import { defaultEmotes } from "../components/chat/emotes";
import WebRTCPublisher from "../components/WebRTCPublisher";
import SignInModal from "../components/SignInModal";
import WalletHelpModal from "../components/WalletHelpModal";
import { AUTH_TOKEN_KEY, getAuthToken, mergeAuthUser, notifyAuthChange, readAuthUser, writeAuth } from "../lib/auth";
import { connectWallet } from "../lib/wallet";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function CreatePage(): JSX.Element {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [screenPlaybackUrl, setScreenPlaybackUrl] = useState("");
  const [cameraPlaybackUrl, setCameraPlaybackUrl] = useState("");
  const [sourceMode, setSourceMode] = useState<"camera" | "screen">("camera");
  const [cameraBroadcasting, setCameraBroadcasting] = useState(false);
  const [screenBroadcasting, setScreenBroadcasting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const [autoPlayback, setAutoPlayback] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkingPlayback, setCheckingPlayback] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [showPublisher, setShowPublisher] = useState(false);
  const [streamerId, setStreamerId] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [tokenGated, setTokenGated] = useState(true);
  const [royaltyPct, setRoyaltyPct] = useState(8);
  const [showWalletHelp, setShowWalletHelp] = useState(false);
  const [registeringWallet, setRegisteringWallet] = useState(false);
  const [showStudioWarning, setShowStudioWarning] = useState(false);
  const [waitingForVideo, setWaitingForVideo] = useState(false);
  const [screenInputStatus, setScreenInputStatus] = useState("");
  const [cameraInputStatus, setCameraInputStatus] = useState("");
  const [iframeSeed, setIframeSeed] = useState(0);
  const [cameraPublishOverride, setCameraPublishOverride] = useState("");
  const [screenPublishOverride, setScreenPublishOverride] = useState("");
  const [cameraWebrtcPlaybackUrl, setCameraWebrtcPlaybackUrl] = useState("");
  const [screenWebrtcPlaybackUrl, setScreenWebrtcPlaybackUrl] = useState("");
  const [cloudflareCustomerCode, setCloudflareCustomerCode] = useState("");
  const [screenInputId, setScreenInputId] = useState("");
  const [cameraInputId, setCameraInputId] = useState("");
  const [screenVideoId, setScreenVideoId] = useState("");
  const [cameraVideoId, setCameraVideoId] = useState("");
  const [cloudflareReady, setCloudflareReady] = useState(false);
  const [lastPlaybackCheck, setLastPlaybackCheck] = useState<{
    ok: boolean;
    status?: number;
    reason?: string;
    at: string;
  } | null>(null);
  const [stats, setStats] = useState<{ viewers: number; tips: number; uptimeSec: number }>({
    viewers: 0,
    tips: 0,
    uptimeSec: 0,
  });
  const [authUser, setAuthUser] = useState(readAuthUser());

  const allowVpsFallback =
    String(import.meta.env.VITE_ALLOW_VPS_FALLBACK || "false").toLowerCase() === "true";
  const ingestUrl = import.meta.env.VITE_INGEST_URL || "";
  const hlsBaseUrl = allowVpsFallback ? import.meta.env.VITE_HLS_BASE_URL || "" : "";
  const webrtcBaseUrl = allowVpsFallback ? import.meta.env.VITE_WEBRTC_PUBLISH_URL || "" : "";
  const allowSharedInputs =
    String(import.meta.env.VITE_ALLOW_SHARED_INPUTS || "false").toLowerCase() === "true";
  const hasCloudflareInputs = Boolean(cloudflareReady);
  const cameraHlsUrl =
    allowSharedInputs || hasCloudflareInputs ? import.meta.env.VITE_HLS_PLAYBACK_URL_CAMERA || "" : "";
  const screenHlsUrl =
    allowSharedInputs || hasCloudflareInputs ? import.meta.env.VITE_HLS_PLAYBACK_URL_SCREEN || "" : "";
  const cameraPublishUrl =
    allowSharedInputs || hasCloudflareInputs ? import.meta.env.VITE_WEBRTC_PUBLISH_URL_CAMERA || "" : "";
  const screenPublishUrl =
    allowSharedInputs || hasCloudflareInputs ? import.meta.env.VITE_WEBRTC_PUBLISH_URL_SCREEN || "" : "";
  const resolvedCameraPublishUrl = cameraPublishOverride || cameraPublishUrl;
  const resolvedScreenPublishUrl = screenPublishOverride || screenPublishUrl;
  const registryAddress = String(import.meta.env.VITE_REGISTRY_ADDRESS || "");
  const requireRegistry = String(import.meta.env.VITE_REQUIRE_STREAMER_REGISTRY || "false").toLowerCase() === "true";
  const requireWallet =
    String(import.meta.env.VITE_REQUIRE_WALLET || "false").toLowerCase() === "true" || requireRegistry;
  const chainId = Number(import.meta.env.VITE_SOMNIA_CHAIN_ID || 2047);
  const chainIdHex = `0x${chainId.toString(16)}`;
  const chainName = String(import.meta.env.VITE_SOMNIA_CHAIN_NAME || "Somnia Testnet");
  const rpcUrl = String(import.meta.env.VITE_SOMNIA_RPC_URL || "");
  const explorerUrl = String(import.meta.env.VITE_SOMNIA_EXPLORER_URL || "");
  const symbol = String(import.meta.env.VITE_SOMNIA_SYMBOL || "SOM");
  const uptimeTimer = useRef<number | null>(null);

  function resetStreamState() {
    setTitle("");
    setDescription("");
    setStreamKey(null);
    setStreamerId("");
    setIsLive(false);
    setPlaybackUrl("");
    setScreenPlaybackUrl("");
    setCameraPlaybackUrl("");
    setScreenWebrtcPlaybackUrl("");
    setCameraWebrtcPlaybackUrl("");
    setScreenPublishOverride("");
    setCameraPublishOverride("");
    setCloudflareCustomerCode("");
    setScreenInputId("");
    setCameraInputId("");
    setScreenVideoId("");
    setCameraVideoId("");
    setPlaybackReady(false);
    setTokenGated(true);
    setSourceMode("camera");
    setIsPrepared(false);
    setShowPublisher(false);
    setLastPlaybackCheck(null);
    setStats({ viewers: 0, tips: 0, uptimeSec: 0 });
  }

  async function loadStreamState(resetOnMissing = false) {
    if (!getAuthToken()) {
      if (resetOnMissing) resetStreamState();
      return;
    }
    try {
      const res = await api.get("/api/streams/me").catch(() => null);
      if (res?.data) {
        setTitle(res.data.title ?? "");
        setDescription(res.data.description ?? "");
        setStreamKey(res.data.streamKey ?? null);
        setStreamerId(String(res.data.streamer ?? res.data.id ?? ""));
        const status = String(res.data.status ?? "");
        setIsLive(status === "online");
        if (typeof res.data.tokenGated === "boolean") {
          setTokenGated(res.data.tokenGated);
        }
        const nextPlayback = sanitizeHlsUrl(String(res.data.playbackUrl ?? "").trim());
        const nextScreen = sanitizeHlsUrl(String(res.data.screenPlaybackUrl ?? "").trim());
        const nextCamera = sanitizeHlsUrl(String(res.data.cameraPlaybackUrl ?? "").trim());
        const nextCustomerCode = String(res.data.cloudflareCustomerCode ?? "").trim();
        const nextScreenInputId = String(res.data.cloudflareScreenInputId ?? "").trim();
        const nextCameraInputId = String(res.data.cloudflareCameraInputId ?? "").trim();
        setPlaybackUrl(nextPlayback || playbackUrl);
        setScreenPlaybackUrl(nextScreen || screenPlaybackUrl || sanitizeHlsUrl(screenHlsUrl));
        setCameraPlaybackUrl(nextCamera || cameraPlaybackUrl || sanitizeHlsUrl(cameraHlsUrl));
        if (nextCustomerCode) setCloudflareCustomerCode(nextCustomerCode);
        if (nextScreenInputId) setScreenInputId(nextScreenInputId);
        if (nextCameraInputId) setCameraInputId(nextCameraInputId);
        setSourceMode(res.data.sourceMode === "screen" ? "screen" : "camera");
        setIsPrepared(!!res.data.streamKey || !!res.data.title || !!res.data.playbackUrl);
        return;
      }
    } catch {
      // ignore
    }
    if (resetOnMissing) resetStreamState();
  }

  async function loadCloudflareInputs() {
    if (!getAuthToken()) return;
    try {
      const res = await api
        .get("/api/streams/inputs", {
          params: { t: Date.now() },
          headers: { "Cache-Control": "no-store" },
        })
        .catch(() => null);
      const data = res?.data;
      if (!data) return;

      const nextScreenPlayback = sanitizeHlsUrl(String(data?.screen?.playbackUrl || "").trim());
      const nextCameraPlayback = sanitizeHlsUrl(String(data?.camera?.playbackUrl || "").trim());
      const nextScreenPublish = String(data?.screen?.publishUrl || "").trim();
      const nextCameraPublish = String(data?.camera?.publishUrl || "").trim();
      const nextScreenWebrtcPlayback = String(data?.screen?.webrtcPlaybackUrl || "").trim();
      const nextCameraWebrtcPlayback = String(data?.camera?.webrtcPlaybackUrl || "").trim();
      const nextCustomerCode = String(data?.customerCode || "").trim();
      const nextScreenInputId = String(data?.screen?.inputId || "").trim();
      const nextCameraInputId = String(data?.camera?.inputId || "").trim();
      const nextScreenVideoId = String(data?.screen?.videoId || "").trim();
      const nextCameraVideoId = String(data?.camera?.videoId || "").trim();
      const nextScreenStatus = String(data?.screen?.status || "").trim();
      const nextCameraStatus = String(data?.camera?.status || "").trim();

      if (nextScreenPlayback) {
        setScreenPlaybackUrl(nextScreenPlayback);
      }
      if (nextCameraPlayback) {
        setCameraPlaybackUrl(nextCameraPlayback);
      }
      if (nextScreenPublish) setScreenPublishOverride(nextScreenPublish);
      if (nextCameraPublish) setCameraPublishOverride(nextCameraPublish);
      if (nextScreenWebrtcPlayback) setScreenWebrtcPlaybackUrl(nextScreenWebrtcPlayback);
      if (nextCameraWebrtcPlayback) setCameraWebrtcPlaybackUrl(nextCameraWebrtcPlayback);
      if (nextCustomerCode) setCloudflareCustomerCode(nextCustomerCode);
      if (nextScreenInputId) setScreenInputId(nextScreenInputId);
      if (nextCameraInputId) setCameraInputId(nextCameraInputId);
      if (nextScreenVideoId) setScreenVideoId(nextScreenVideoId);
      if (nextCameraVideoId) setCameraVideoId(nextCameraVideoId);
      if (nextScreenStatus) setScreenInputStatus(nextScreenStatus);
      if (nextCameraStatus) setCameraInputStatus(nextCameraStatus);

      if (nextScreenPlayback || nextCameraPlayback) {
        const preferred = (sourceMode === "screen" ? nextScreenPlayback : nextCameraPlayback)
          || nextScreenPlayback
          || nextCameraPlayback;
        if (preferred) setPlaybackUrl(preferred);
      }
      const ready = Boolean(
        nextCustomerCode
        || nextScreenPublish
        || nextCameraPublish
        || nextScreenInputId
        || nextCameraInputId
      );
      setCloudflareReady(ready);
      return {
        ready,
        screenPublishUrl: nextScreenPublish,
        cameraPublishUrl: nextCameraPublish,
        screenPlaybackUrl: nextScreenPlayback,
        cameraPlaybackUrl: nextCameraPlayback,
        customerCode: nextCustomerCode,
        screenInputId: nextScreenInputId,
        cameraInputId: nextCameraInputId,
        screenVideoId: nextScreenVideoId,
        cameraVideoId: nextCameraVideoId,
        screenStatus: nextScreenStatus,
        cameraStatus: nextCameraStatus
      };
    } catch {
      setCloudflareReady(false);
      // ignore if Cloudflare inputs are not configured
      return { ready: false };
    }
  }

  useEffect(() => {
    void loadStreamState(true);
    void loadCloudflareInputs();
    return () => {
      if (uptimeTimer.current) window.clearInterval(uptimeTimer.current);
    };
  }, []);


  useEffect(() => {
    const handler = () => {
      setAuthUser(readAuthUser());
      setShowPublisher(false);
      void loadStreamState(true);
      void loadCloudflareInputs();
    };
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, []);

  useEffect(() => {
    if (!getAuthToken()) return;
    if (!showPublisher && !isLive) return;
    let active = true;
    const poll = async () => {
      if (!active) return;
      await loadCloudflareInputs();
    };
    void poll();
    const fastPoll = showPublisher && (!screenVideoId && !cameraVideoId);
    const intervalMs = fastPoll ? 3000 : 10000;
    const timer = window.setInterval(poll, intervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [showPublisher, isLive, screenVideoId, cameraVideoId]);

  useEffect(() => {
    const liveStatuses = new Set(["connected", "live", "live-inprogress"]);
    const nextScreenLive = liveStatuses.has(screenInputStatus.toLowerCase());
    const nextCameraLive = liveStatuses.has(cameraInputStatus.toLowerCase());
    if (nextScreenLive || nextCameraLive) {
      setIframeSeed((s) => s + 1);
    }
  }, [screenInputStatus, cameraInputStatus]);

  useEffect(() => {
    if (!isPrepared) return;
    void updateStreamLayout({ tokenGated });
  }, [tokenGated, isPrepared]);

  function requireAuth(nextMode: "login" | "register" = "login") {
    if (getAuthToken()) return true;
    toast.info("Sign in required", "Create an account or sign in to go live.", 2600);
    setAuthMode(nextMode);
    return false;
  }
  useEffect(() => {
    if (!autoPlayback) return;
    if (streamKey && hlsBaseUrl) {
      setPlaybackUrl(resolvePlaybackUrl(hlsBaseUrl, streamKey));
    }
  }, [streamKey, hlsBaseUrl, autoPlayback]);

  useEffect(() => {
    if (!screenPlaybackUrl && screenHlsUrl) {
      setScreenPlaybackUrl(sanitizeHlsUrl(screenHlsUrl));
    }
    if (!cameraPlaybackUrl && cameraHlsUrl) {
      setCameraPlaybackUrl(sanitizeHlsUrl(cameraHlsUrl));
    }
  }, [screenHlsUrl, cameraHlsUrl, screenPlaybackUrl, cameraPlaybackUrl]);

  useEffect(() => {
    // simple uptime increment while live
    if (isLive) {
      uptimeTimer.current = window.setInterval(() => {
        setStats((s) => ({ ...s, uptimeSec: s.uptimeSec + 1 }));
      }, 1000) as unknown as number;
    } else {
      if (uptimeTimer.current) {
        window.clearInterval(uptimeTimer.current);
        uptimeTimer.current = null;
      }
    }
    return () => {
      if (uptimeTimer.current) window.clearInterval(uptimeTimer.current);
    };
  }, [isLive]);

  function handleAuthFailure() {
    toast.info("Session expired", "Please sign in again to go live.", 3000);
    setAuthMode("login");
  }

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

  async function authenticateWallet(addr: string, signer: ethers.Signer) {
    const currentUser = readAuthUser();
    if (getAuthToken() && currentUser?.address?.toLowerCase() === addr.toLowerCase()) return true;
    try {
      const nonceRes = await api.get("/api/auth/nonce", { params: { address: addr } }).catch(() => null);
      const message = nonceRes?.data?.message;
      if (!message) {
        toast.error("Auth failed", "Missing auth message", 3000);
        return false;
      }
      const signature = await signer.signMessage(message);
      const verifyRes = await api.post("/api/auth/verify", { address: addr, signature }).catch(() => null);
      const token = verifyRes?.data?.token;
      const user = verifyRes?.data?.user;
      if (token) {
        if (user) {
          const merged = mergeAuthUser(currentUser, user);
          writeAuth(merged, token);
        } else {
          localStorage.setItem(AUTH_TOKEN_KEY, token);
          notifyAuthChange();
        }
        toast.success("Authenticated", "Creator actions unlocked", 2500);
        return true;
      }
      toast.error("Auth failed", "No token returned", 3000);
      return false;
    } catch (err) {
      console.error("Auth failed", err);
      toast.error("Auth failed", "Signature rejected", 3000);
      return false;
    }
  }

  async function ensureWalletConnected() {
    try {
      const projectId = String(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "");
      const connection = await connectWallet({
        chainId,
        chainName,
        rpcUrl,
        explorerUrl,
        symbol,
        projectId,
        appName: "Petra Stream",
        appUrl: typeof window !== "undefined" ? window.location.origin : "",
      });
      const provider = connection.provider;
      const signer = connection.signer;
      const addr = connection.address;
      const authed = await authenticateWallet(addr, signer);
      if (!authed) return null;
      return { provider, signer, address: addr };
    } catch (err: any) {
      console.error("Wallet connect failed", err);
      const message = String(err?.message || "");
      if (message.includes("missing_project_id")) {
        toast.error("WalletConnect not configured", "Set VITE_WALLETCONNECT_PROJECT_ID", 4500);
      } else if (message.toLowerCase().includes("no_injected_wallet")) {
        setShowWalletHelp(true);
        toast.error("Wallet not detected", "Install MetaMask or use a wallet-enabled browser", 5000);
      } else if (message.toLowerCase().includes("wrong_network")) {
        toast.error("Wrong network", `Please switch to ${chainName}`, 3500);
      } else {
        toast.error("Connect failed", "See console for details", 4000);
      }
      return null;
    }
  }

  async function ensureStreamerRegistered(signer: ethers.Signer, address: string, force = false) {
    const shouldRegister = force || requireRegistry;
    if (!shouldRegister) return true;
    if (!registryAddress || !ethers.isAddress(registryAddress)) {
      toast.error("Registry missing", "Set VITE_REGISTRY_ADDRESS to enable creator registration.");
      return false;
    }
    try {
      const registry = new ethers.Contract(
        registryAddress,
        [
          "function isRegistered(address) view returns (bool)",
          "function registerStreamer(string metadataURI)",
        ],
        signer
      );
      const registered = await registry.isRegistered(address).catch(() => false);
      if (registered) return true;
      toast.info("Registering streamer", "Confirm the on-chain registration.", 2600);
      const metadata = `petra-stream://streamer/${address}`;
      const tx = await registry.registerStreamer(metadata);
      await tx.wait();
      toast.success("Wallet registered", "Creator profile is now active.", 2600);
      return true;
    } catch (err) {
      console.error("Registration failed", err);
      toast.error("Registration failed", "Please retry or check your wallet.", 3500);
      return false;
    }
  }

  async function ensureWalletReady() {
    const wallet = await ensureWalletConnected();
    if (!wallet) return null;
    const registered = await ensureStreamerRegistered(wallet.signer, wallet.address, requireRegistry);
    if (!registered) return null;
    return wallet;
  }

  async function ensureWalletIfRequired() {
    if (!requireWallet) return true;
    const wallet = await ensureWalletReady();
    return Boolean(wallet);
  }

  async function registerStreamerNow() {
    const wallet = await ensureWalletConnected();
    if (!wallet) return;
    setRegisteringWallet(true);
    try {
      await ensureStreamerRegistered(wallet.signer, wallet.address, true);
    } finally {
      setRegisteringWallet(false);
    }
  }

  async function ensureStreamKey(): Promise<string | null> {
    if (streamKey) return streamKey;
    if (!requireAuth()) return null;
    try {
      const res = await api.post("/api/streams/generate-key");
      const key = res?.data?.key;
      if (!key) {
        toast.error("Stream key unavailable", "Please try again.");
        return null;
      }
      setStreamKey(key);
      return key;
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return null;
      }
      toast.error("Stream key unavailable", "Please sign in and try again.");
      return null;
    }
  }

  async function checkPlaybackUrl(silent = false, overrideUrl?: string) {
    const url = (overrideUrl ?? playbackUrl).trim();
    if (!url) {
      if (!silent) toast.error("Playback URL required", "Set a playback URL first");
      if (!silent) setPlaybackReady(false);
      return false;
    }
    if (!silent) setCheckingPlayback(true);
    try {
      const res = await api.post("/api/streams/playback/check", { playbackUrl: url }).catch(() => null);
      if (res?.data?.ok) {
        if (!silent) toast.success("Playback ready", `HTTP ${res.data.status}`);
        setPlaybackReady(true);
        if (!isLive) setIsLive(true);
        setLastPlaybackCheck({ ok: true, status: res.data.status, at: new Date().toISOString() });
        return true;
      }
      setPlaybackReady(false);
      setLastPlaybackCheck({
        ok: false,
        status: res?.data?.status,
        reason: res?.data?.reason || "No response",
        at: new Date().toISOString(),
      });
      if (!silent) toast.error("Playback not ready", res?.data?.reason || "No response");
      return false;
    } catch (err) {
      console.error(err);
      setPlaybackReady(false);
      setLastPlaybackCheck({
        ok: false,
        reason: (err as any)?.message || "fetch_failed",
        at: new Date().toISOString(),
      });
      if (!silent) toast.error("Playback check failed");
      return false;
    } finally {
      if (!silent) setCheckingPlayback(false);
    }
  }
  function sanitizeHlsUrl(input?: string) {
    const trimmed = (input ?? "").trim();
    if (!trimmed) return "";
    return trimmed.replace(/\?%22%22$/i, "").replace(/\?""$/i, "");
  }
  function extractCustomerCode(url?: string) {
    if (!url) return "";
    const match = url.match(/customer-([a-zA-Z0-9-]+)\.cloudflarestream\.com/);
    return match?.[1] || "";
  }
  function extractInputId(url?: string) {
    if (!url) return "";
    const match = url.match(/cloudflarestream\.com\/([^/]+)\//);
    return match?.[1] || "";
  }
  function normalizeBaseUrl(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed.replace(/^\/+/, "")}`;
  }


  function resolvePlaybackUrl(baseUrl: string, key?: string | null) {
    const base = normalizeBaseUrl(baseUrl);
    if (!base) return "";
    const hasManifest = base.includes("/manifest/") || base.toLowerCase().includes(".m3u8");
    if (hasManifest) return base;
    if (!key) return base;
    return `${base.replace(/\/+$/, "")}/${key}/index.m3u8`;
  }

  function buildWebrtcPublishUrl(key: string | null) {
    if (!key) return "";
    const base = normalizeBaseUrl(webrtcBaseUrl);
    if (!base) return "";
    try {
      const url = new URL(base);
      const basePath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
      const normalizedPath = basePath.toLowerCase();
      const usesWhip =
        normalizedPath.endsWith("/whip") ||
        normalizedPath.endsWith("/whep") ||
        normalizedPath.includes("/whip/");
      const safeKey = encodeURIComponent(key);
      url.pathname = usesWhip ? `${basePath}/${safeKey}` : `${basePath}/${safeKey}/publish`;

      const params = url.searchParams;
      if (!params.has("video-codec")) params.set("video-codec", "h264/90000");
      if (!params.has("audio-codec")) params.set("audio-codec", "opus/48000");
      if (!params.has("video-bitrate")) params.set("video-bitrate", "800");
      if (!params.has("audio-bitrate")) params.set("audio-bitrate", "48");
      if (!params.has("video-framerate")) params.set("video-framerate", "15");
      if (!params.has("video-width")) params.set("video-width", "640");
      if (!params.has("video-height")) params.set("video-height", "360");
      if (!params.has("audio-voice")) params.set("audio-voice", "true");

      return url.toString();
    } catch {
      return "";
    }
  }

  async function updateStreamLayout(next?: {
    sourceMode?: "camera" | "screen";
    screenPlaybackUrl?: string;
    cameraPlaybackUrl?: string;
    playbackUrl?: string;
    tokenGated?: boolean;
  }) {
    const identity = streamerId || authUser?.username || authUser?.address || authUser?.id;
    if (!identity) return;
    const basePlayback = sanitizeHlsUrl((next?.playbackUrl ?? playbackUrl).trim());
    const fallbackCamera = sanitizeHlsUrl(cameraHlsUrl.trim());
    const fallbackScreen = sanitizeHlsUrl(screenHlsUrl.trim());
    const payload = {
      sourceMode: next?.sourceMode ?? sourceMode,
      screenPlaybackUrl:
        sanitizeHlsUrl((next?.screenPlaybackUrl ?? screenPlaybackUrl).trim())
        || fallbackScreen
        || (basePlayback && (next?.sourceMode ?? sourceMode) === "screen" ? basePlayback : undefined),
      cameraPlaybackUrl:
        sanitizeHlsUrl((next?.cameraPlaybackUrl ?? cameraPlaybackUrl).trim())
        || fallbackCamera
        || (basePlayback && (next?.sourceMode ?? sourceMode) === "camera" ? basePlayback : undefined),
      cloudflareCustomerCode: cloudflareCustomerCode || undefined,
      cloudflareScreenInputId: screenInputId || undefined,
      cloudflareCameraInputId: cameraInputId || undefined,
      tokenGated: typeof (next?.tokenGated ?? tokenGated) === "boolean" ? (next?.tokenGated ?? tokenGated) : undefined,
    };
    try {
      await api.post(`/api/streams/${encodeURIComponent(identity)}/update`, payload);
    } catch {
      // ignore update failures to keep streaming flow responsive
    }
  }

  async function startStream(skipWalletCheck = false, overrideKey?: string): Promise<boolean> {
    if (!skipWalletCheck) {
      const ok = await ensureWalletIfRequired();
      if (!ok) return false;
    }
    if (!requireAuth()) return false;
    setLoading(true);
    try {
      const key = overrideKey ?? await ensureStreamKey();
      if (!key) return false;
      const finalTitle = title.trim() || "Live Stream";
      if (!title.trim()) setTitle(finalTitle);
      const fallbackPlaybackUrl =
        sourceMode === "screen"
          ? (sanitizeHlsUrl((screenPlaybackUrl || screenHlsUrl).trim()) || sanitizeHlsUrl((cameraPlaybackUrl || cameraHlsUrl).trim()))
          : (sanitizeHlsUrl((cameraPlaybackUrl || cameraHlsUrl).trim()) || sanitizeHlsUrl((screenPlaybackUrl || screenHlsUrl).trim()));
      const derivedPlaybackUrl =
        (autoPlayback && fallbackPlaybackUrl)
        || (autoPlayback && hlsBaseUrl ? resolvePlaybackUrl(hlsBaseUrl, key) : sanitizeHlsUrl(playbackUrl.trim()));
      const derivedScreenUrl = sanitizeHlsUrl((screenPlaybackUrl || screenHlsUrl || (sourceMode === "screen" ? derivedPlaybackUrl : "")).trim());
      const derivedCameraUrl =
        sanitizeHlsUrl((cameraPlaybackUrl || cameraHlsUrl || (sourceMode === "camera" ? derivedPlaybackUrl : "")).trim());
      if (derivedPlaybackUrl) setPlaybackUrl(derivedPlaybackUrl);
      if (derivedScreenUrl) setScreenPlaybackUrl(derivedScreenUrl);
      if (derivedCameraUrl) setCameraPlaybackUrl(derivedCameraUrl);
      const payload = {
        title: finalTitle,
        description: description.trim(),
        key,
        playbackUrl: derivedPlaybackUrl,
        sourceMode,
        screenPlaybackUrl: derivedScreenUrl || undefined,
        cameraPlaybackUrl: derivedCameraUrl || undefined,
        screenWebrtcPlaybackUrl: screenWebrtcPlaybackUrl || undefined,
        cameraWebrtcPlaybackUrl: cameraWebrtcPlaybackUrl || undefined,
        webrtcPlaybackUrl:
          (sourceMode === "screen" ? screenWebrtcPlaybackUrl : cameraWebrtcPlaybackUrl)
          || screenWebrtcPlaybackUrl
          || cameraWebrtcPlaybackUrl
          || undefined,
        cloudflareCustomerCode: cloudflareCustomerCode || undefined,
        cloudflareScreenInputId: screenInputId || undefined,
        cloudflareCameraInputId: cameraInputId || undefined,
        tokenGated,
      };
      const res = await api.post("/api/streams/start", payload);
      if (res?.data?.streamer || res?.data?.id) {
        setStreamerId(String(res.data.streamer ?? res.data.id));
      }
      if (res?.data?.ok ?? true) {
        toast.success("Stream ready", "Go live in browser or OBS.", 2500);
      } else {
        toast.success("Stream prepared", "Stream details saved.", 2000);
      }
      setIsPrepared(true);
      const ok = await checkPlaybackUrl(true, derivedPlaybackUrl);
      setIsLive(ok);
      return true;
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return false;
      }
      console.error(err);
      toast.error("Failed to prepare stream");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function stopStream() {
    if (!requireAuth()) return;
    setLoading(true);
    try {
      await api.post("/api/streams/stop");
      setIsLive(false);
      setIsPrepared(true);
      setShowPublisher(false);
      toast.info("Stream offline", "You can go live again with the same key.", 2200);
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      console.error(err);
      toast.error("Failed to stop stream");
    } finally {
      setLoading(false);
    }
  }

  async function regenerateKey() {
    const ok = await ensureWalletIfRequired();
    if (!ok) return;
    if (!requireAuth()) return;
    setLoading(true);
    try {
      const res = await api.post("/api/streams/regenerate-key");
      const key = res?.data?.key;
      if (!key) {
        toast.error("Failed to regenerate key", "Please try again.");
        return;
      }
      setStreamKey(key);
      setIsPrepared(true);
      toast.success("Stream key regenerated", undefined, 2000);
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      console.error(err);
      toast.error("Failed to regenerate key");
    } finally {
      setLoading(false);
    }
  }

  async function testPlayback() {
    const ok = await checkPlaybackUrl(false);
    if (ok) setIsLive(true);
  }

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitForInputIds(timeoutMs = 20000) {
    const startedAt = Date.now();
    setWaitingForVideo(true);
    try {
      while (Date.now() - startedAt < timeoutMs) {
        const inputs = await loadCloudflareInputs();
        const inputId =
          sourceMode === "screen"
            ? (inputs?.screenInputId || inputs?.cameraInputId)
            : (inputs?.cameraInputId || inputs?.screenInputId);
        if (inputId) {
          return inputId;
        }
        await delay(2000);
      }
      return "";
    } finally {
      setWaitingForVideo(false);
    }
  }

  async function goLiveInBrowser() {
    const ok = await ensureWalletIfRequired();
    if (!ok) return;
    if (!requireAuth()) return;
    setShowStudioWarning(false);
    let inputs = await loadCloudflareInputs();
    let inputScreenPublish = inputs?.screenPublishUrl?.trim();
    let inputCameraPublish = inputs?.cameraPublishUrl?.trim();
    let publishFromInputs =
      sourceMode === "screen"
        ? (inputScreenPublish || inputCameraPublish)
        : (inputCameraPublish || inputScreenPublish);

    const key = await ensureStreamKey();
    if (!key) return;
    const prepared = await startStream(true, key);
    if (!prepared) return;
    if (!key) return;
    if (!publishFromInputs && !resolvedPublishUrl) {
      // Give Cloudflare a moment to provision the inputs before failing.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await delay(900);
        inputs = await loadCloudflareInputs();
        inputScreenPublish = inputs?.screenPublishUrl?.trim();
        inputCameraPublish = inputs?.cameraPublishUrl?.trim();
        publishFromInputs =
          sourceMode === "screen"
            ? (inputScreenPublish || inputCameraPublish)
            : (inputCameraPublish || inputScreenPublish);
        if (publishFromInputs) break;
      }
    }

    const publishUrl = publishFromInputs || resolvedPublishUrl;
    if (!publishUrl) {
      setShowStudioWarning(true);
      toast.error(
        "Cloudflare inputs not ready",
        "Wait a few seconds and try again."
      );
      return;
    }
    if (window.location.protocol === "https:" && publishUrl.startsWith("http://")) {
      toast.error("Insecure publish URL", "Use an https WebRTC publish endpoint for live sites.");
      return;
    }
    await waitForInputIds(20000);
    setShowPublisher(true);
    toast.info("Browser studio ready", "Allow camera and mic to go live.", 2200);
  }

  async function copyText(label: string, value?: string) {
    if (!value) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied", label, 1800);
    } catch (err) {
      console.error(err);
      toast.error("Copy failed");
    }
  }
  const ingestServer = ingestUrl || "rtmp://165.227.224.72/live";
  const statusLabel = isLive ? "Live" : isPrepared ? "Waiting for live" : "Draft";
  const previewSrc = screenBroadcasting
    ? (screenPlaybackUrl || screenHlsUrl || playbackUrl || undefined)
    : cameraBroadcasting
      ? (cameraPlaybackUrl || cameraHlsUrl || playbackUrl || undefined)
      : sourceMode === "screen"
        ? (screenPlaybackUrl || screenHlsUrl || playbackUrl || undefined)
        : (cameraPlaybackUrl || cameraHlsUrl || playbackUrl || undefined);
  const webrtcPublishUrl = buildWebrtcPublishUrl(streamKey);
  const resolvedPublishUrl =
    sourceMode === "screen"
      ? (resolvedScreenPublishUrl || webrtcPublishUrl || webrtcBaseUrl)
      : (resolvedCameraPublishUrl || webrtcPublishUrl || webrtcBaseUrl);
  const studioUrl = resolvedPublishUrl || webrtcPublishUrl || "";
  const supportsBrowserStudio = Boolean(
    normalizeBaseUrl(resolvedCameraPublishUrl)
    || normalizeBaseUrl(resolvedScreenPublishUrl)
    || normalizeBaseUrl(webrtcPublishUrl)
    || normalizeBaseUrl(webrtcBaseUrl)
  );
  const dualPublishAvailable = Boolean(
    normalizeBaseUrl(resolvedCameraPublishUrl) && normalizeBaseUrl(resolvedScreenPublishUrl)
  );
  const isAuthed = Boolean(getAuthToken());
  const canAttemptBrowserStudio = supportsBrowserStudio || (isAuthed && !allowVpsFallback);
  const chatUser =
    authUser?.displayName || authUser?.username || authUser?.address || authUser?.id || "Creator";
  const streamRoomId =
    streamerId || authUser?.username || authUser?.address || authUser?.id || streamKey || "creator";
  const hasWalletAddress = Boolean(authUser?.address);
  const walletNeeded = requireWallet && !hasWalletAddress;
  const canGoLive = isAuthed && !walletNeeded;
  const readinessLabel = isLive ? "Live to viewers" : isPrepared ? "Waiting for video" : "Not started";
  const statusTone = isLive
    ? "bg-emerald-400/15 text-emerald-200 border-emerald-400/30"
    : isPrepared
      ? "bg-amber-400/10 text-amber-200 border-amber-400/30"
      : "bg-white/5 text-white/70 border-white/10";
  const primaryCtaLabel = isLive
    ? "End stream"
    : canAttemptBrowserStudio
      ? canGoLive
        ? "Start stream"
        : isAuthed
          ? "Connect wallet to go live"
          : "Sign in to go live"
      : canGoLive
        ? "Prepare stream"
        : isAuthed
          ? "Connect wallet to go live"
          : "Sign in to go live";
  const primaryCtaAction = isLive ? stopStream : canAttemptBrowserStudio ? goLiveInBrowser : startStream;
  const broadcastLabel = isLive ? "Broadcast live" : isPrepared ? "Broadcast ready" : "Broadcast idle";
  const showPreview = isLive && playbackReady;
  const detailsPanel = (
    <div className="glass-card p-6 sm:p-8 lg:p-10 rounded-[2.5rem]">
      <div className="mb-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold text-text flex items-center gap-3">
            <span className="text-primary">Stream Details</span>
          </h3>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-white/40 tracking-widest uppercase">
            Autosave on
          </span>
        </div>
        <p className="text-white/40 text-sm font-medium">
          Configure your on-chain broadcast identity.
        </p>
      </div>

      <div className="space-y-8">
        <div className="space-y-3">
          <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
            Broadcast title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl h-14 px-6 text-text font-semibold placeholder:text-white/20 text-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="A cinematic title..."
          />
        </div>
        <div className="space-y-3">
          <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
            Broadcast description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl p-5 text-text font-medium placeholder:text-white/20 min-h-[140px] resize-none leading-relaxed bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Tell your audience what is happening..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
              Category
            </label>
            <div className="relative">
              <select className="w-full rounded-2xl h-12 px-5 appearance-none text-text font-semibold text-sm tracking-wide bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option>Crypto Gaming</option>
                <option>Metaverse Explorers</option>
                <option>DAO Governance</option>
                <option>Creative Arts</option>
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                v
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
              Tags
            </label>
            <input
              className="w-full rounded-2xl h-12 px-5 text-text font-semibold text-sm bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="#web3 #live #nft"
            />
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h4 className="text-xs font-black text-primary uppercase tracking-[0.25em] mb-4">Session</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <div className="text-2xl font-bold text-text">{stats.viewers}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Viewers</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <div className="text-2xl font-bold text-text">{stats.tips}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Tips</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <div className="text-2xl font-bold text-text">{Math.floor(stats.uptimeSec / 60)}m</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Uptime</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => copyText("Playback URL", playbackUrl)}
            className="px-3 py-2 rounded-full border border-white/10 text-xs"
            disabled={!playbackUrl}
          >
            Copy playback link
          </button>
          <button
            onClick={() => copyText("RTMP server URL", ingestServer)}
            className="px-3 py-2 rounded-full border border-white/10 text-xs"
          >
            Copy RTMP info
          </button>
        </div>
      </section>

      <section className="mt-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black text-primary uppercase tracking-[0.25em]">Web3 Monetization</h4>
            <p className="text-[10px] text-white/40 mt-2">
              Wallet connection unlocks creator tools. On-chain registration is optional.
            </p>
          </div>
          {registryAddress && ethers.isAddress(registryAddress) ? (
            <button
              type="button"
              onClick={registerStreamerNow}
              disabled={registeringWallet}
              className="px-3 py-2 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em]"
            >
              {registeringWallet ? "Registering..." : "Register wallet"}
            </button>
          ) : null}
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <h5 className="text-sm font-bold text-text">Token-Gating</h5>
              <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
                Restrict to verified NFT holders
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={tokenGated}
                onChange={(e) => setTokenGated(e.target.checked)}
              />
              <div className="relative h-7 w-14 rounded-full border border-white/10 bg-white/10 transition peer-checked:bg-primary/80 peer-checked:border-primary/60 after:absolute after:left-[4px] after:top-[4px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-7" />
            </label>
          </div>

          <div className="space-y-4 px-1">
            <div className="flex items-center justify-between">
              <label className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
                Creator Royalties
              </label>
              <span className="text-primary font-mono font-black text-xl">{royaltyPct.toFixed(1)}%</span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent"
                style={{ width: `${(royaltyPct / 15) * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={15}
                step={0.5}
                value={royaltyPct}
                onChange={(e) => setRoyaltyPct(Number(e.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
            <div className="flex justify-between text-[9px] text-white/30 font-bold uppercase tracking-widest">
              <span>Min 0%</span>
              <span>Max 15%</span>
            </div>
          </div>
        </div>
      </section>

      <details className="mt-10 border-t border-white/10 pt-8">
        <summary className="cursor-pointer text-sm font-semibold text-text">
          Advanced settings
        </summary>
        <div className="mt-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs subtle">Playback URL (HLS)</label>
                <button
                type="button"
                onClick={() => setAutoPlayback((s) => !s)}
                className="text-xs px-2 py-1 rounded-md border border-white/10"
              >
                {autoPlayback ? "Use custom URL" : "Use auto URL"}
              </button>
            </div>
            <input
              value={playbackUrl}
              onChange={(e) => setPlaybackUrl(e.target.value)}
              className="w-full p-3 mt-2 rounded-xl border border-white/10 bg-white/5 text-text"
              placeholder={autoPlayback ? "Auto-generated from your stream key" : "https://your-cdn/stream.m3u8"}
              disabled={autoPlayback}
            />
              <div className="mt-2">
                <button
                  type="button"
                  onClick={testPlayback}
                  className="px-3 py-2 rounded-md border border-white/10 text-xs"
                  disabled={checkingPlayback}
                >
                  {checkingPlayback ? "Checking..." : "Test playback"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 p-4 bg-white/5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs subtle">Viewer layout</label>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/50">Active source</span>
                  <select
                    value={sourceMode}
                    onChange={(e) => setSourceMode(e.target.value as "camera" | "screen")}
                    className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-text"
                  >
                    <option value="camera">Camera</option>
                    <option value="screen">Screen share</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-white/50">Screen share playback URL (HLS)</label>
                <input
                  value={screenPlaybackUrl}
                  onChange={(e) => setScreenPlaybackUrl(e.target.value)}
                  className="w-full p-2 mt-2 rounded-lg border border-white/10 bg-white/5 text-text text-sm"
                  placeholder="https://your-cdn/screen/index.m3u8"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/50">Creator camera playback URL (HLS)</label>
                <input
                  value={cameraPlaybackUrl}
                  onChange={(e) => setCameraPlaybackUrl(e.target.value)}
                  className="w-full p-2 mt-2 rounded-lg border border-white/10 bg-white/5 text-text text-sm"
                  placeholder="https://your-cdn/camera/index.m3u8"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void updateStreamLayout();
                  }}
                  className="px-3 py-2 rounded-md border border-white/10 text-xs"
                  disabled={!streamerId && !authUser?.username && !authUser?.address && !authUser?.id}
                >
                  Apply layout
                </button>
                <span className="text-[11px] text-white/40">
                  Used for the viewer PiP when screen share is active.
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 p-4 bg-white/5">
            <div className="text-xs subtle">OBS / External encoder</div>
            <div className="mt-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-subtle">Server</span>
                <span className="font-mono text-text">{ingestServer}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-subtle">Stream key</span>
                <span className="font-mono text-text">{streamKey || "generate to see"}</span>
              </div>
            </div>
            <div className="mt-2 text-xs subtle">
              Use OBS if you need advanced scenes, overlays, or desktop capture.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText("RTMP server URL", ingestServer)}
                className="px-3 py-2 rounded-md border border-white/10 text-xs"
              >
                Copy RTMP server
              </button>
              <button
                type="button"
                onClick={() => copyText("Stream key", streamKey ?? "")}
                className="px-3 py-2 rounded-md border border-white/10 text-xs"
                disabled={!streamKey}
              >
                Copy stream key
              </button>
            </div>
          </div>

          <StreamKeyPanel streamKey={streamKey} onRegenerate={regenerateKey} />
          <LocalRecorder />

          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold">Diagnostics</h3>
            <p className="muted text-xs mt-1">Use this to verify stream URLs and auth status.</p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="subtle">Auth</span>
                <span className="text-text">{isAuthed ? "Signed in" : "Signed out"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="subtle">Studio URL</span>
                <span className="font-mono text-[10px] text-text">{studioUrl || "not-set"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="subtle">Playback URL</span>
                <span className="font-mono text-[10px] text-text">{playbackUrl || "not-set"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="subtle">Last check</span>
                <span className="text-text">
                  {lastPlaybackCheck
                    ? `${lastPlaybackCheck.ok ? "OK" : "Fail"}${lastPlaybackCheck.status ? ` (${lastPlaybackCheck.status})` : ""}`
                    : "not-run"}
                </span>
              </div>
            </div>
            {lastPlaybackCheck?.reason ? (
              <div className="mt-2 text-[11px] text-amber-200/80">Reason: {lastPlaybackCheck.reason}</div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={testPlayback}
                className="px-3 py-2 rounded-md border border-white/10 text-xs"
                disabled={checkingPlayback}
              >
                {checkingPlayback ? "Checking..." : "Check playback"}
              </button>
              <button
                type="button"
                onClick={() => copyText("Playback URL", playbackUrl)}
                className="px-3 py-2 rounded-md border border-white/10 text-xs"
                disabled={!playbackUrl}
              >
                Copy HLS URL
              </button>
              <button
                type="button"
                onClick={() => copyText("Studio URL", studioUrl)}
                className="px-3 py-2 rounded-md border border-white/10 text-xs"
                disabled={!studioUrl}
              >
                Copy studio URL
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );

  useEffect(() => {
    if (!isPrepared || !playbackUrl || isLive) return;
    const timer = window.setInterval(async () => {
      const ok = await checkPlaybackUrl(true);
      if (ok) {
        setIsLive(true);
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isPrepared, playbackUrl, isLive]);

  useEffect(() => {
    if (!isLive) {
      setPlaybackReady(false);
      return;
    }
    const url = (previewSrc || "").trim();
    if (!url) {
      setPlaybackReady(false);
      return;
    }
    setPlaybackReady(false);
    const timer = window.setInterval(() => {
      void checkPlaybackUrl(true, url);
    }, 6000);
    void checkPlaybackUrl(true, url);
    return () => window.clearInterval(timer);
  }, [isLive, previewSrc]);

  return (
    <div className="relative overflow-x-hidden create-page">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "rgb(var(--color-bg-rgb))",
            backgroundImage:
              "radial-gradient(at 0% 0%, rgba(0, 163, 255, 0.25) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(124, 255, 109, 0.18) 0px, transparent 55%), radial-gradient(at 50% 50%, rgba(0, 163, 255, 0.12) 0px, transparent 60%)",
          }}
        />
        <div className="absolute top-1/4 -left-64 h-[800px] w-[800px] rounded-full bg-primary/5 blur-[180px]" />
        <div className="absolute bottom-0 -right-64 h-[900px] w-[900px] rounded-full bg-accent/5 blur-[200px]" />
      </div>

      <div className="max-w-[1700px] mx-auto px-6 lg:px-10 py-8 sm:py-10 lg:py-12 space-y-10">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
          <div className="xl:col-span-7 space-y-10">
            <section className="glass-card rounded-[2.5rem] p-6 sm:p-8 space-y-6">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="h-px w-10 bg-primary/60" />
                  <p className="text-primary font-bold tracking-[0.35em] uppercase text-[10px]">
                    Creator Control Room
                  </p>
                </div>
                <h2 className="text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight text-text leading-[1.08]">
                  Build your stream
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary">
                    like a broadcast studio.
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-subtle max-w-2xl leading-relaxed font-medium">
                  Go live with a control room built for creators: instant preview, studio tools, and chat that keeps
                  pace with your audience.
                </p>
                <div className="flex w-full flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      void primaryCtaAction();
                    }}
                    disabled={loading}
                    className="h-14 min-w-[220px] bg-primary text-bg font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-glow-primary flex items-center justify-center gap-3"
                  >
                    {loading ? "Working..." : primaryCtaLabel}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`px-3 py-1.5 rounded-full border ${statusTone}`}>Status: {statusLabel}</span>
                  <span className="px-3 py-1.5 rounded-full border border-white/10 text-white/70">
                    {readinessLabel}
                  </span>
                    {supportsBrowserStudio ? (
                      <span className="px-3 py-1.5 rounded-full border border-white/10 text-white/70">
                        Browser studio ready
                      </span>
                    ) : showStudioWarning ? (
                      <span className="px-3 py-1.5 rounded-full border border-rose-500/30 text-rose-200/80">
                        Browser studio disabled
                      </span>
                    ) : null}
                  </div>
                </div>
                {showStudioWarning && !supportsBrowserStudio ? (
                  <div className="text-xs text-amber-200/80">
                    Cloudflare inputs are not ready yet. Wait a few seconds and try again.
                  </div>
                ) : null}
            </section>

            <section className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3 px-2">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                  <span className="text-sm font-semibold text-text">Live preview</span>
                  <span className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-[0.2em] ${statusTone}`}>
                    {statusLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={testPlayback}
                  className="px-3 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest"
                  disabled={checkingPlayback}
                >
                  {checkingPlayback ? "Checking" : "Refresh status"}
                </button>
              </div>
              <div className="absolute -inset-1.5 rounded-[2.5rem] bg-gradient-to-r from-primary/30 to-accent/30 blur-2xl opacity-40" />
              <div className="relative mt-3 glass-card rounded-[2.5rem] p-3">
                <div className="relative rounded-[2rem] overflow-hidden bg-bg/70">
                  <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-transparent to-bg/20 pointer-events-none" />
                  {showPreview ? (
                    (() => {
                      const webRtcSrc =
                        sourceMode === "screen"
                          ? (screenWebrtcPlaybackUrl || cameraWebrtcPlaybackUrl)
                          : (cameraWebrtcPlaybackUrl || screenWebrtcPlaybackUrl);
                      const previewCustomerCode =
                        cloudflareCustomerCode
                        || extractCustomerCode(screenPublishOverride)
                        || extractCustomerCode(cameraPublishOverride)
                        || extractCustomerCode(screenPlaybackUrl)
                        || extractCustomerCode(cameraPlaybackUrl)
                        || extractCustomerCode(playbackUrl)
                        || extractCustomerCode(screenWebrtcPlaybackUrl)
                        || extractCustomerCode(cameraWebrtcPlaybackUrl);
                    const previewInputId =
                      sourceMode === "screen"
                        ? (screenInputId || cameraInputId)
                        : (cameraInputId || screenInputId);
                    const status =
                      sourceMode === "screen"
                        ? (screenInputStatus || cameraInputStatus)
                        : (cameraInputStatus || screenInputStatus);
                    const liveStatuses = new Set(["connected", "live", "live-inprogress"]);
                    const isLiveInput = liveStatuses.has(String(status || "").toLowerCase());
                    const useIframe = Boolean(previewInputId && previewCustomerCode && isLiveInput);
                    if (useIframe) {
                      return (
                        <CloudflareIframePlayer
                          key={`${previewInputId}-${iframeSeed}`}
                          customerCode={previewCustomerCode}
                          inputId={previewInputId}
                          title={title || "Broadcast preview"}
                          heightClass="aspect-video"
                          autoplay
                          muted
                          controls
                          preload="auto"
                        />
                      );
                    }
                    return (
                      <div className="aspect-video flex items-center justify-center bg-bg/70">
                        <div className="text-center px-6">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                            Preparing Cloudflare preview
                          </div>
                          <div className="mt-2 text-sm text-subtle">
                            {waitingForVideo
                              ? "Waiting for Cloudflare inputs..."
                              : "Waiting for Cloudflare to start the live feed."}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                    <div className="aspect-video flex items-center justify-center bg-bg/70">
                      <div className="text-center px-6">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                          Starting stream
                        </div>
                        <div className="mt-2 text-sm text-subtle">
                          Waiting for Cloudflare to receive your broadcast.
                        </div>
                        <button
                          type="button"
                          onClick={testPlayback}
                          disabled={checkingPlayback}
                          className="mt-4 px-3 py-2 rounded-full border border-white/10 text-[10px] uppercase tracking-widest"
                        >
                          {checkingPlayback ? "Checking..." : "Check playback"}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-bg/60 px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-text">
                    {broadcastLabel}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 px-2 text-xs text-white/60">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2 py-1">
                  <span className="text-[10px] uppercase tracking-[0.2em]">Active source</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceMode("camera");
                      void updateStreamLayout({ sourceMode: "camera" });
                    }}
                    className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] ${sourceMode === "camera" ? "bg-primary text-bg" : "border border-white/10 text-white/70"}`}
                  >
                    Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceMode("screen");
                      void updateStreamLayout({ sourceMode: "screen" });
                    }}
                    className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] ${sourceMode === "screen" ? "bg-primary text-bg" : "border border-white/10 text-white/70"}`}
                  >
                    Screen
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => copyText("Playback URL", playbackUrl)}
                  className="px-3 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest"
                  disabled={!playbackUrl}
                >
                  Copy HLS
                </button>
                <button
                  type="button"
                  onClick={() => copyText("Studio URL", studioUrl)}
                  className="px-3 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest"
                  disabled={!studioUrl}
                >
                  Copy studio URL
                </button>
              </div>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-white/40 text-[9px] uppercase font-bold tracking-[0.2em]">Bitrate output</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-bold font-mono tracking-tight">9,420</span>
                  <span className="text-primary/60 text-xs font-bold uppercase">Kbps</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-white/40 text-[9px] uppercase font-bold tracking-[0.2em]">Stream latency</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-bold font-mono tracking-tight">0.8</span>
                  <span className="text-primary/60 text-xs font-bold uppercase">Sec</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-white/40 text-[9px] uppercase font-bold tracking-[0.2em]">Security protocol</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-lg font-bold font-mono tracking-widest text-emerald-400 uppercase">
                    Encrypted
                  </span>
                </div>
              </div>
            </div>

            <section className="glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Live Studio</h3>
                  <p className="muted text-sm mt-1">Broadcast directly from your browser without leaving the site.</p>
                </div>
                  {supportsBrowserStudio ? (
                    <button
                      className="px-3 py-2 rounded-full border border-white/10 text-xs"
                      onClick={() => {
                        if (showPublisher) {
                          setShowPublisher(false);
                          return;
                        }
                        void goLiveInBrowser();
                      }}
                      disabled={loading}
                    >
                      {showPublisher ? "Hide studio" : "Show studio"}
                    </button>
                  ) : canAttemptBrowserStudio ? (
                    <button
                      className="px-3 py-2 rounded-full border border-white/10 text-xs"
                      onClick={() => {
                        if (showPublisher) {
                          setShowPublisher(false);
                          return;
                        }
                        void goLiveInBrowser();
                      }}
                      disabled={loading}
                    >
                      {showPublisher ? "Hide studio" : "Show studio"}
                    </button>
                  ) : null}
              </div>
              {supportsBrowserStudio ? (
                showPublisher ? (
                  dualPublishAvailable ? (
                    <div className="grid gap-4">
                      <WebRTCPublisher
                        publishUrl={resolvedCameraPublishUrl || webrtcPublishUrl || webrtcBaseUrl}
                        fixedMode="camera"
                        title="Camera studio"
                        disabled={loading}
                        onStarted={() => {
                          setCameraBroadcasting(true);
                          setSourceMode("camera");
                          void updateStreamLayout({ sourceMode: "camera" });
                        }}
                        onStopped={() => setCameraBroadcasting(false)}
                      />
                      <WebRTCPublisher
                        publishUrl={resolvedScreenPublishUrl || webrtcPublishUrl || webrtcBaseUrl}
                        fixedMode="screen"
                        title="Screen studio (PiP)"
                        disabled={loading}
                        onStarted={() => {
                          setScreenBroadcasting(true);
                          setSourceMode("screen");
                          void updateStreamLayout({ sourceMode: "screen" });
                        }}
                        onStopped={() => {
                          setScreenBroadcasting(false);
                          setSourceMode("camera");
                          void updateStreamLayout({ sourceMode: "camera" });
                        }}
                      />
                    </div>
                  ) : (
                    <WebRTCPublisher
                      publishUrl={resolvedPublishUrl}
                      disabled={loading}
                      onModeChange={(mode) => {
                        setSourceMode(mode);
                        void updateStreamLayout({ sourceMode: mode });
                      }}
                    />
                  )
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/70">
                    Click "Start stream" to open the studio controls and choose Camera or Screen.
                  </div>
                )
              ) : showStudioWarning ? (
                <div className="rounded-2xl border border-dashed border-amber-400/30 p-6 text-center text-sm text-amber-200/80">
                  Cloudflare inputs are not ready yet. Wait a few seconds and try again.
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/70">
                  Studio will be ready after inputs are created.
                </div>
              )}
            </section>
          </div>
          <div className="xl:col-span-5">
            <div className="xl:sticky xl:top-28 flex flex-col gap-8">
              <div className="glass-card rounded-3xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] text-white/40 uppercase font-bold tracking-[0.2em]">Broadcast</p>
                    <h3 className="text-lg font-semibold text-text mt-2">
                      {title.trim() ? title : "Untitled broadcast"}
                    </h3>
                    <p className="text-xs text-white/50 mt-2 leading-relaxed">
                      {description.trim()
                        ? description
                        : "Add a description so viewers know what is happening in your stream."}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <span
                      className={`px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${statusTone}`}
                    >
                      {statusLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDetails(true)}
                      className="px-3 py-2 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em]"
                    >
                      Stream details
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-white/50 uppercase tracking-widest">
                    {readinessLabel}
                  </span>
                {streamRoomId ? (
                  <span className="text-[10px] text-white/40">
                    Room: <span className="font-mono text-text">{streamRoomId}</span>
                  </span>
                ) : null}
                <span className="text-[10px] text-white/40">
                  Source: <span className="font-mono text-text">{sourceMode}</span>
                </span>
              </div>
            </div>

              <div className="flex-1 min-h-0 mt-1">
                <ChatPanel
                  streamId={String(streamRoomId)}
                  currentUser={chatUser}
                  variant="creator"
                  showModerationPanel
                  isModerator
                  currentBadges={["owner"]}
                  showTimestamps
                  pinnedNotice="Creator mode: keep chat welcoming while you stream."
                  headerTitle="Studio chat"
                  headerSubtitle="Auto-scroll enabled"
                  autoScrollMode="always"
                  emotes={defaultEmotes}
                  heightClass="min-h-[560px] h-[clamp(560px,72vh,900px)]"
                />
              </div>
            </div>
          </div>
        </div>
        {showDetails ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              aria-label="Close stream details"
              onClick={() => setShowDetails(false)}
            />
            <div className="relative w-full max-w-4xl max-h-[90vh]">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="absolute right-6 top-6 z-10 px-3 py-2 rounded-full border border-white/10 text-xs bg-black/40"
              >
                Close
              </button>
              <div className="max-h-[90vh] overflow-y-auto pt-12">
                {detailsPanel}
              </div>
            </div>
          </div>
        ) : null}
        {authMode && (
          <SignInModal
            defaultMode={authMode}
            onClose={() => setAuthMode(null)}
            onSignedIn={() => setAuthMode(null)}
          />
        )}
        {showWalletHelp ? (
          <WalletHelpModal
            onClose={() => setShowWalletHelp(false)}
            siteUrl={typeof window !== "undefined" ? window.location.origin : "https://petra-stream.digital"}
            chainName={chainName}
          />
        ) : null}
      </div>
    </div>
  );
}
