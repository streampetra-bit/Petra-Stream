// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { readAuthUser } from "../lib/auth";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
  icon: React.ReactNode;
};

type StatItem = {
  label: string;
  value: string;
  delta?: string;
  showDelta?: boolean;
  accent: string;
  glow: string;
  icon: React.ReactNode;
  valueSuffix?: string;
};

type DashboardProfile = {
  name: string;
  role: string;
  avatar: string;
  followers: number;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    active: true,
    icon: (
      <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-8h8V3h-8v10z" />
      </svg>
    ),
  },
  {
    label: "Stream Manager",
    href: "/create",
    icon: (
      <svg className="h-5 w-5 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A2 2 0 0122 9.618v4.764a2 2 0 01-2.447 1.894L15 14M4 6v12a2 2 0 002 2h10" />
      </svg>
    ),
  },
  {
    label: "NFT Studio",
    href: "/create",
    icon: (
      <svg className="h-5 w-5 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10v10H7z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h4v4H3zM17 17h4v4h-4z" />
      </svg>
    ),
  },
  {
    label: "Analytics",
    href: "/dashboard",
    icon: (
      <svg className="h-5 w-5 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 19V5m5 14V9m5 10V3m5 16v-6" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg className="h-5 w-5 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2h-2a2 2 0 01-2-2v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2v-2a2 2 0 012-2h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 008.6 4.6a1.65 1.65 0 001-1.51V3a2 2 0 012-2h2a2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9c.05.26.08.52.08.8 0 .28-.03.54-.08.8z" />
      </svg>
    ),
  },
];

const BASE_STATS: StatItem[] = [
  {
    label: "Total earnings (SOL)",
    value: "452.85",
    delta: "+15.2%",
    accent: "text-primary",
    glow: "bg-primary/10",
    valueSuffix: "SOL",
    icon: (
      <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-2.5 0-4 1-4 2.5S9.5 13 12 13s4 1 4 2.5S14.5 18 12 18m0-10V6m0 12v-2" />
      </svg>
    ),
  },
  {
    label: "Viewer growth",
    value: "+12,482",
    delta: "+2.1%",
    accent: "text-pink-400",
    glow: "bg-pink-500/10",
    icon: (
      <svg className="h-6 w-6 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 2c1.66 0 3-1.34 3-3S9.66 7 8 7s-3 1.34-3 3 1.34 3 3 3zm8 2h3a3 3 0 013 3v1H13v-1a3 3 0 013-3zm-8 1h4a3 3 0 013 3v1H5v-1a3 3 0 013-3z" />
      </svg>
    ),
  },
];

const RETENTION_BARS = [0.5, 0.75, 0.65, 1, 0.75, 0.5, 0.66];

const NFT_ITEMS = [
  {
    title: "360 No-Scope Clutch",
    rarity: "Legendary",
    price: "2.45 SOL",
    status: "List on market",
    tag: "text-pink-400",
    action: "bg-primary hover:bg-primary/90 text-bg",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCGyNbPqNPmDATHXCKU5R62YgSzy6lKtPzEHRFZ93aqVsShvbMBtIzgS7H6QXc2h5ciu3N28XaUBDxe-QHk9wEMZMKGQ8qAk4RIRHupswBogJDk4bnZNR70nkVtdBVbL9UZ-VmsU7oX_ny2k5TIMosYOmZHv25K9a8G0d3GLY2z7ukOQoD4w2ohf9jhMphQCBG_6LRwXJ2wB76vzMGSKPv0354r9CsNwPOP8eAR1auMHO45_8nGDXxj8SudL3N6SiWSSF_z3_9LmI8",
  },
  {
    title: "12 Kill Streak - Solo",
    rarity: "Rare",
    price: "0.82 SOL",
    status: "Listed for 1.2 SOL",
    tag: "text-blue-400",
    action: "bg-white/5 hover:bg-white/10 text-text border border-white/10",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAUAmGFGbuYbRhLzgAxKk_tg94ZrBSj54C1CfHZRAOyHYLEdxt5Ix8rsLbpA8sqflnMmtTBXcgSk0F03Ie9iUXo7NOQfhDuTyHyHsyoSfLowzLS3Drar0oCExNHcVrU5SxtND0PqntdhytlkXQUowgD9193uWwttp9NpZRL61NT9L1f-Eh73KQVPTKN-JLC9qFgY-ZWEl0zPwaUs7l6nxXdz1uHgzbbvY3KSMwfw7X1rD4P99l6II9y92CMBYcdk4Zl9JiKQJQScpU",
  },
  {
    title: "Perfect Timing Combo",
    rarity: "Common",
    price: "0.15 SOL",
    status: "List on market",
    tag: "text-emerald-400",
    action: "bg-primary hover:bg-primary/90 text-bg",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDMPQXXomrCUhywOolc13C1U0yU_vSXPDl6POGIQkxCFP0gJJxrvXoK056Tra0Ru_g76PSexO6oaVKr0_koeTHDau3vMeMfn1kpkeFNE5Ou-s4rBs2y5f3_Prg9qP_4kLlkVElU7m4olWB_opgGcpaLFUW4DTwixkEXco9WJaG22Whad6PjDu-LTQowDwDbdqqfx61A6gy0TdlFYH6wIkJrsDVkk2gpnf4VVhnIi6v0zjlzfLecB0DPyeMoIhrot8CLgiqHqBklZ9g",
  },
];

const ACTIVITY = [
  {
    title: "CryptoWhale sent 500 bits",
    time: "2 minutes ago",
    tone: "text-primary",
    icon: (
      <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21s-7-4.35-7-10a4 4 0 017-2 4 4 0 017 2c0 5.65-7 10-7 10z" />
      </svg>
    ),
  },
  {
    title: "NFTHunter bought Clip #402",
    time: "12 minutes ago",
    tone: "text-pink-400",
    icon: (
      <svg className="h-4 w-4 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h18v4H3zM5 7v14h14V7" />
      </svg>
    ),
  },
  {
    title: "SolanaKing subscribed (Tier 3)",
    time: "24 minutes ago",
    tone: "text-blue-400",
    icon: (
      <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
      </svg>
    ),
  },
];

const DEFAULT_PROFILE: DashboardProfile = {
  name: "Ariana Wells",
  role: "Lead Creator",
  avatar:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCBIy49bC6J1_AOuZzPm2dHZwjNxT4pYjdQ7n5K1UwPm3jJuDpQhJqYU6aKGmE1n7E-5avZiIFqYGOVTeVtjynD_0PeL5H34gcw5yY2L6TLzJFGAwjQcBic1scWk0JF9cpw7D4tV2bCfArwA_cFM5_wCSb687yyDWhP3DL9B2oExY1u5RGKV2eFxE1cbThXr8jvOodzerHsBKk87lF7OoLQn-kcrT6Ho6pXbopWlp2Uo82onEPLqLqD8KWSNtRNdQL0Dlocp05QgA8",
  followers: 0,
};

const FOLLOWER_STAT: Omit<StatItem, "value"> = {
  label: "Followers",
  accent: "text-blue-400",
  glow: "bg-blue-500/10",
  showDelta: false,
  icon: (
    <svg className="h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 2c1.66 0 3-1.34 3-3S9.66 7 8 7s-3 1.34-3 3 1.34 3 3 3zm8 2h3a3 3 0 013 3v1H13v-1a3 3 0 013-3zm-8 1h4a3 3 0 013 3v1H5v-1a3 3 0 013-3z" />
    </svg>
  ),
};

const formatCount = (value: number) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return value.toString();
};

export default function Dashboard(): JSX.Element {
  const initialAuthUser = readAuthUser();
  const [authUser, setAuthUser] = useState(initialAuthUser);
  const [profile, setProfile] = useState<DashboardProfile>(() => ({
    ...DEFAULT_PROFILE,
    name: initialAuthUser?.displayName || initialAuthUser?.username || DEFAULT_PROFILE.name,
  }));

  useEffect(() => {
    const refresh = () => setAuthUser(readAuthUser());
    window.addEventListener("auth-changed", refresh);
    return () => window.removeEventListener("auth-changed", refresh);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const target = authUser.username || authUser.address || authUser.id;
    if (!target) return;
    let active = true;
    api
      .get(`/api/users/${encodeURIComponent(target)}`)
      .then((res) => {
        if (!active) return;
        const user = res?.data ?? {};
        setProfile((prev) => ({
          ...prev,
          name: user.displayName || user.username || user.address || prev.name,
          avatar: user.avatar || prev.avatar,
          followers: typeof user.followers === "number" ? user.followers : prev.followers,
        }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authUser]);

  const stats = useMemo<StatItem[]>(
    () => [
      ...BASE_STATS,
      {
        ...FOLLOWER_STAT,
        value: formatCount(profile.followers),
      },
    ],
    [profile.followers]
  );

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-white/10 bg-bg/80 px-5 py-6">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center shadow-glow-primary">
                <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v18m-7-7h14" />
                </svg>
              </div>
              <div className="text-xl font-extrabold tracking-tight">Petra Stream</div>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                    item.active
                      ? "bg-primary/10 text-text border-l-4 border-primary"
                      : "text-subtle hover:text-text hover:bg-white/5"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-4">
            <div className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-subtle">
                Connected wallet
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h14a3 3 0 013 3v6a3 3 0 01-3 3H3z" />
                    <circle cx="17" cy="13" r="1.5" />
                  </svg>
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-mono text-subtle truncate">0x71C...8e42</div>
                  <div className="text-sm font-bold text-text">124.50 SOL</div>
                </div>
              </div>
              <button className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold text-text hover:bg-white/10 transition">
                Withdraw funds
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <button className="w-full flex items-center gap-3 px-2 py-2 text-subtle hover:text-text transition">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M12 14a4 4 0 10-4-4" />
                </svg>
                Support
              </button>
              <button className="w-full flex items-center gap-3 px-2 py-2 text-subtle hover:text-rose-400 transition">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17l5-5m0 0l-5-5m5 5H9a6 6 0 000 12h3" />
                </svg>
                Log out
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-bg/80 backdrop-blur-xl px-4 sm:px-6 py-4 flex flex-wrap items-center gap-4 justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-4">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-text hover:bg-white/10 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>

              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10 w-full max-w-xl">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z"
                    />
                  </svg>
                </div>
                <input
                  className="w-full bg-transparent border-none text-sm text-text placeholder:text-white/40 focus:ring-0"
                  placeholder="Search clips, on-chain sales, and creator signals..."
                  type="text"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
              <Link
                to="/create"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-bg shadow-glow-primary hover:brightness-110 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
                </svg>
                Go live
              </Link>
              <Link to="/profile/me" className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                <div
                  className="h-10 w-10 rounded-full border-2 border-primary/40 bg-center bg-cover"
                  style={{ backgroundImage: `url(${profile.avatar})` }}
                />
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-text">{profile.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-subtle">{profile.role}</span>
                </div>
              </Link>
            </div>
          </header>

          <div className="p-6 lg:p-8 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Dashboard overview</h2>
                <p className="text-subtle text-sm lg:text-base">Real-time performance analytics and Web3 earnings.</p>
              </div>
              <div className="flex gap-3">
                <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-text hover:bg-white/10 transition">
                  Last 30 days
                </button>
                <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-text hover:bg-white/10 transition">
                  Export
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.map((stat) => (
                <div key={stat.label} className="glass-card rounded-xl p-6 relative overflow-hidden">
                  <div className={`absolute -right-6 -top-6 h-32 w-32 rounded-full blur-3xl ${stat.glow}`} />
                  <div className="flex flex-col gap-4 relative">
                    <div className="flex items-center justify-between">
                      <p className="text-subtle text-sm font-medium">{stat.label}</p>
                      <div className="transition-transform group-hover:scale-110">{stat.icon}</div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold tracking-tight">
                        {stat.value}{" "}
                        {stat.valueSuffix && <span className={`text-lg font-semibold ${stat.accent}`}>{stat.valueSuffix}</span>}
                      </h3>
                      {stat.showDelta !== false && stat.delta && (
                        <p className="text-emerald-400 text-sm font-bold flex items-center gap-1 mt-1">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12l5-5 5 5 5-5" />
                          </svg>
                          {stat.delta}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-xl p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-subtle text-xs font-bold uppercase tracking-[0.3em]">Revenue forecast</p>
                    <h4 className="text-xl font-bold mt-1">$12,450.00</h4>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold text-subtle bg-white/5">Daily</span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold text-primary bg-primary/20 border border-primary/30">
                      Weekly
                    </span>
                  </div>
                </div>
                <div className="h-48 w-full">
                  <svg viewBox="-3 0 478 150" width="100%" height="100%" preserveAspectRatio="none" fill="none">
                    <path
                      d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25V149H326.769H0V109Z"
                      fill="url(#chart_grad)"
                    />
                    <path
                      d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25"
                      stroke="rgb(var(--color-primary-rgb))"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="chart_grad" x1="236" x2="236" y1="1" y2="149" gradientUnits="userSpaceOnUse">
                        <stop stopColor="rgb(var(--color-primary-rgb))" stopOpacity="0.3" />
                        <stop offset="1" stopColor="rgb(var(--color-primary-rgb))" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="flex justify-between text-[10px] font-bold tracking-[0.3em] uppercase text-subtle">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
              </div>

              <div className="glass-card rounded-xl p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-subtle text-xs font-bold uppercase tracking-[0.3em]">Viewer retention</p>
                    <h4 className="text-xl font-bold mt-1">
                      85% <span className="text-xs text-emerald-400">+3.2%</span>
                    </h4>
                  </div>
                  <span className="text-subtle">...</span>
                </div>
                <div className="flex-1 grid grid-cols-7 gap-3 items-end h-40 pb-4">
                  {RETENTION_BARS.map((height, idx) => (
                    <div
                      key={idx}
                      className={`rounded-t-sm border-t-2 ${
                        idx === 3 ? "bg-primary border-primary/60 shadow-glow-primary" : "bg-primary/20 border-primary"
                      }`}
                      style={{ height: `${height * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-bold tracking-[0.3em] uppercase text-subtle">
                  <span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span><span>W6</span><span>W7</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-xl font-bold">Recent clips and NFTs</h3>
                <Link to="/profile/me" className="text-primary text-sm font-bold inline-flex items-center gap-2 hover:underline">
                  View all assets
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-6-6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {NFT_ITEMS.map((item) => (
                  <div key={item.title} className="glass-card rounded-xl overflow-hidden border border-white/10 hover:border-primary/40 transition">
                    <div className="aspect-video relative overflow-hidden">
                      <div
                        className="absolute inset-0 bg-center bg-cover transition-transform duration-500 hover:scale-110"
                        style={{ backgroundImage: `url(${item.image})` }}
                      />
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-[10px] font-bold flex items-center gap-1">
                        <span className={`text-[10px] ${item.tag}`}>●</span>
                        {item.rarity}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent flex items-end p-4">
                        <p className="text-sm font-bold truncate">{item.title}</p>
                      </div>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-subtle">Floor price</span>
                        <span className="font-bold text-text">{item.price}</span>
                      </div>
                      <button className={`w-full py-2 rounded-lg text-xs font-bold transition ${item.action}`}>
                        {item.status}
                      </button>
                    </div>
                  </div>
                ))}

                <div className="rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 hover:border-primary transition-all bg-white/5">
                  <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                    <svg className="h-5 w-5 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold">Mint new highlight</p>
                    <p className="text-xs text-subtle">Capture from live stream</p>
                  </div>
                </div>
              </div>
            </div>

            <footer className="mt-auto border-t border-white/10 pt-8 pb-10 flex flex-wrap items-center justify-between gap-6 text-xs">
              <div className="flex flex-wrap items-center gap-6 text-subtle">
                <span className="font-bold uppercase tracking-[0.3em]">(c) 2024 Stream3 Protocol</span>
                <div className="flex gap-4">
                  <a className="hover:text-text" href="#">Terms</a>
                  <a className="hover:text-text" href="#">Privacy</a>
                  <a className="hover:text-text" href="#">API Specs</a>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 uppercase tracking-[0.3em] font-bold text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Network secure
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-subtle uppercase tracking-[0.3em] font-bold text-[10px]">
                  Gas: 0.0002 SOL
                </div>
              </div>
            </footer>
          </div>
        </main>

        <aside className="hidden xl:flex w-80 flex-col border-l border-white/10 bg-bg/70 px-6 py-8 gap-8 overflow-y-auto">
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Live activity</h4>
            <div className="space-y-6">
              {ACTIVITY.map((item) => (
                <div key={item.title} className="flex gap-4 relative">
                  <div className="absolute left-4 top-10 bottom-0 w-px bg-white/10" />
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${item.tone} border-current bg-white/5`}>
                    {item.icon}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm">{item.title}</p>
                    <p className="text-xs text-subtle">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto glass-card rounded-xl p-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-subtle">Upcoming mint</p>
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-lg bg-center bg-cover"
                style={{
                  backgroundImage:
                    "url(https://lh3.googleusercontent.com/aida-public/AB6AXuBpbz82uOpIlg4jlPI78Z3uWJBso-zVPkPN8UVioDFfIp3fwcI5_N51fuUvuofY-dTvedjCpFSoXiKDCwIya1xKQMo01b5_IcXnvBQuaRQFMvR4837a14SZJomJenGVHLlK6mVtpY0S02uHGUVdZMtqKIlMIl0H1nzIGiAHi2UiXJvJJ6SLt_vSz1WcYb7nvVMW4QFlnU-Qt8aXtSNdP4Kj8Q9Zrl_HiuOx6Y2gOa34rehiT8frS7N39pFWB-OxjTieozPvjWuhxpg)",
                }}
              />
              <div>
                <p className="text-sm font-bold">Genesis Pass v2</p>
                <p className="text-xs text-emerald-400">Starts in 2h 45m</p>
              </div>
            </div>
            <button className="w-full rounded-lg bg-white text-bg py-2 text-xs font-bold hover:bg-primary hover:text-bg transition">
              Set reminder
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
