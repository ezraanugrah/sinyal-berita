"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity, ArrowDown, ArrowRight, ArrowUp, Bookmark, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Cloud, CloudOff, ExternalLink,
  Globe2, Grid2X2, Heart, LayoutGrid, List, LoaderCircle, LogOut, Menu,
  Newspaper, Plus, RefreshCw, Search, Settings2, SlidersHorizontal, Sparkles,
  Star, Sun, Moon, Trash2, TrendingUp, X,
} from "lucide-react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, normalizeSettings } from "@/lib/settings";
import { scoreArticles } from "@/lib/relevance";
import type { Article, Interaction, ScoredArticle, Settings, Topic } from "@/lib/types";

type Tab = "personal" | "recent" | "saved";
const SETTINGS_KEY = "sinyal:settings:v1";
const FEEDBACK_KEY = "sinyal:interactions:v1";
const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CAN_SYNC = Boolean(PROJECT_URL && PROJECT_KEY);

function localRead<T,>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

function relativeDate(date: string) {
  const d = new Date(date);
  if (!Number.isFinite(d.valueOf())) return "Baru saja";
  const diffHrs = Math.round((Date.now() - d.valueOf()) / 3600000);
  if (diffHrs < 1) return "Baru saja";
  if (diffHrs < 24) return `${diffHrs} jam lalu`;
  return `${Math.round(diffHrs / 24)} hari lalu`;
}
function dateHeading() {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
}
function countRated(map: Record<string, Interaction>) {
  return Object.values(map).filter((f) => f.rating !== null).length;
}
function CircleIcon({ children }: { children: ReactNode }) { return <span className="circle-icon">{children}</span>; }

function NewsCard({ article, mode, rating, saved, onRate, onSave, topicLabel }: {
  article: ScoredArticle;
  mode: "grid" | "list";
  rating: number | null;
  saved: boolean;
  onRate: (rating: number) => void;
  onSave: () => void;
  topicLabel: string;
}) {
  return <article className={`news-card ${mode === "list" ? "news-card-list" : ""}`}>
    <div className="article-top">
      <div className="article-source"><span className="source-dot" />{article.source}<span className="middle-dot">·</span><span>{relativeDate(article.date)}</span></div>
      <button className={`bookmark-btn ${saved ? "is-saved" : ""}`} type="button" aria-label={saved ? "Hapus dari tersimpan" : "Simpan berita"} title={saved ? "Hapus dari tersimpan" : "Simpan berita"} onClick={onSave}><Bookmark size={17} fill={saved ? "currentColor" : "none"}/></button>
    </div>
    <div className="article-body">
      <span className="topic-tag">{topicLabel}</span>
      <h3 className="article-title"><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title} <ExternalLink size={14} className="article-external"/></a></h3>
    </div>
    <div className="article-bottom">
      <div className="rate-area"><span className="rate-label">Nilai berita</span>
        <div className="rating-stars" role="group" aria-label="Beri penilaian 1 hingga 5">
          {[1,2,3,4,5].map((n) => <button key={n} type="button" aria-label={`Beri nilai ${n} dari 5`} title={`${n} dari 5`} onClick={() => onRate(n)} className={rating !== null && n <= rating ? "star-active" : ""}><Star size={17} fill={rating !== null && n <= rating ? "currentColor" : "none"}/></button>)}
        </div>
      </div>
      <div className="match-pill" title="Skor kecocokan relatif berdasarkan minat Anda"><Sparkles size={13}/> {article.relevance} <span>/ 99</span></div>
    </div>
  </article>;
}

export default function Home() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [interactions, setInteractions] = useState<Record<string, Interaction>>({});
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState<Tab>("personal");
  const [activeTopic, setActiveTopic] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refetch, setRefetch] = useState(0);
  const lastFetchTime = useMemo(() => ({ at: 0 }), []);
  const [fetchError, setFetchError] = useState("");
  const [notice, setNotice] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [email, setEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const client = useMemo<SupabaseClient | null>(() => CAN_SYNC ? createClient(PROJECT_URL!, PROJECT_KEY!, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }) : null, []);

  useEffect(() => {
    setSettings(normalizeSettings(localRead(SETTINGS_KEY, DEFAULT_SETTINGS)));
    setInteractions(localRead(FEEDBACK_KEY, {}));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(FEEDBACK_KEY, JSON.stringify(interactions));
  }, [interactions, hydrated]);

  useEffect(() => {
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); });
    client.auth.getUser().then(({ data }) => setUser(data.user));
    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!client || !user || !hydrated) { setCloudReady(false); return; }
    setCloudReady(false);
    let cancelled = false;
    (async () => {
      const [prefsResult, ratingResult] = await Promise.all([
        client.from("reader_settings").select("settings").eq("user_id", user.id).maybeSingle(),
        client.from("reader_interactions").select("article_id,title,url,date,source,topic,rating,saved,updated_at").eq("user_id", user.id).limit(3000),
      ]);
      if (cancelled) return;
      if (prefsResult.error || ratingResult.error) {
        setNotice("Sinkronisasi belum aktif. Pastikan file schema.sql sudah dijalankan di Supabase.");
        return;
      }
      const remoteSettings = prefsResult.data?.settings;
      if (remoteSettings) setSettings(normalizeSettings(remoteSettings));
      else await client.from("reader_settings").upsert({ user_id: user.id, settings: localRead(SETTINGS_KEY, DEFAULT_SETTINGS), updated_at: new Date().toISOString() });
      const fromLocal = localRead<Record<string, Interaction>>(FEEDBACK_KEY, {});
      const remote = (ratingResult.data ?? []) as Interaction[];
      const merged = { ...fromLocal };
      for (const interaction of remote) merged[interaction.article_id] = interaction;
      setInteractions(merged);
      const remoteIds = new Set(remote.map((r) => r.article_id));
      const missing = Object.values(fromLocal).filter((r) => !remoteIds.has(r.article_id));
      if (missing.length) {
        await client.from("reader_interactions").upsert(missing.map((r) => ({ ...r, user_id: user.id })), { onConflict: "user_id,article_id" });
      }
      if (!cancelled) { setCloudReady(true); setNotice("Preferensi sudah tersinkron antarperangkat."); }
    })();
    return () => { cancelled = true; };
  }, [client, user?.id, hydrated]);

  useEffect(() => {
    if (!cloudReady || !client || !user) return;
    const t = setTimeout(() => { void client.from("reader_settings").upsert({ user_id: user.id, settings, updated_at: new Date().toISOString() }); }, 800);
    return () => clearTimeout(t);
  }, [settings, user, cloudReady, client]);

  const enabledTopics = useMemo(() => settings.topics.filter((t) => t.enabled), [settings.topics]);
  const topicsQuery = useMemo(() => JSON.stringify(enabledTopics.map(({id, query}) => ({id, query})).slice(0, 12)), [enabledTopics]);

  useEffect(() => {
    const controller = new AbortController();
    const topicPayload = JSON.parse(topicsQuery);
    if (!topicPayload.length) { setArticles([]); setLoading(false); setFetchError(""); return; }
    setLoading(true);
    setFetchError("");
    fetch("/api/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics: topicPayload }), signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Tidak dapat memuat berita.");
        if (!controller.signal.aborted) {
          setArticles(data.articles ?? []);
          lastFetchTime.at = Date.now();
          setFetchError(data.failures?.length ? `${data.failures.length} topik tidak dapat diambil. Silakan coba perbarui.` : data.articles?.length ? "" : "Feed tidak mengembalikan berita. Coba ubah kata kunci.");
        }
      }).catch((err: unknown) => {
        if (!controller.signal.aborted) setFetchError(err instanceof Error ? err.message : "Gagal memuat berita.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [topicsQuery, refetch, lastFetchTime]);

  // Tab yang dibiarkan terbuka semalaman memuat ulang feed saat dibuka lagi.
  useEffect(() => {
    const refreshIfStale = () => {
      if (!document.hidden && Date.now() - lastFetchTime.at > 30 * 60 * 1000) {
        lastFetchTime.at = Date.now();
        setRefetch((x) => x + 1);
      }
    };
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => document.removeEventListener("visibilitychange", refreshIfStale);
  }, [lastFetchTime]);

  const updateSettings = useCallback((change: (p: Settings) => Settings) => setSettings((prev) => change(prev)), []);
  const changeTopic = useCallback((id: string, change: Partial<Topic>) => {
    updateSettings((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === id ? { ...t, ...change } : t) }));
  }, [updateSettings]);
  const shiftTopic = useCallback((id: string, direction: -1 | 1) => {
    updateSettings((prev) => {
      const topics = [...prev.topics];
      const i = topics.findIndex((t) => t.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= topics.length) return prev;
      [topics[i], topics[j]] = [topics[j], topics[i]];
      return { ...prev, topics };
    });
  }, [updateSettings]);

  const saveInteraction = useCallback((article: Article, patch: Partial<Interaction>) => {
    const previous = interactions[article.id];
    const newRecord: Interaction = {
      ...previous,
      article_id: article.id, title: article.title, url: article.url, date: article.date,
      source: article.source, topic: article.topic,
      rating: previous?.rating ?? null, saved: previous?.saved ?? false,
      ...patch, updated_at: new Date().toISOString(),
    };
    setInteractions((prev) => ({ ...prev, [article.id]: newRecord }));
    if (client && user && cloudReady) {
      void client.from("reader_interactions").upsert({ ...newRecord, user_id: user.id }, { onConflict: "user_id,article_id" }).then(({ error }) => {
        if (error) setNotice("Penilaian tersimpan di perangkat, tetapi gagal tersinkron. Periksa koneksi.");
      });
    }
  }, [client, user, cloudReady, interactions]);

  const scored = useMemo(() => scoreArticles(articles, interactions, settings), [articles, interactions, settings]);
  const savedBacklog = useMemo((): ScoredArticle[] => {
    const currentIds = new Set(scored.map((a) => a.id));
    const records = Object.values(interactions).filter((i) => i.saved && !currentIds.has(i.article_id) && i.url?.startsWith("https://"));
    return scoreArticles(records.map((i) => ({ id: i.article_id, title: i.title, url: i.url, date: i.date, source: i.source, topic: i.topic, description: "" })), interactions, settings);
  }, [scored, interactions, settings]);
  const displayed = useMemo(() => {
    let collection = tab === "saved" ? [...scored, ...savedBacklog].filter((a) => interactions[a.id]?.saved) : [...scored];
    if (activeTopic !== "all") collection = collection.filter((a) => a.topic === activeTopic);
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase();
      collection = collection.filter((a) => `${a.title} ${a.source}`.toLocaleLowerCase().includes(q));
    }
    const sorter = tab === "recent" || settings.sort === "recent";
    collection.sort((a, b) => sorter
      ? new Date(b.date).getTime() - new Date(a.date).getTime()
      : b.relevance - a.relevance || new Date(b.date).getTime() - new Date(a.date).getTime());
    return collection;
  }, [tab, scored, savedBacklog, activeTopic, search, interactions, settings.sort]);
  const topicName = (id: string) => settings.topics.find((t) => t.id === id)?.label || id;
  const ratingsCount = countRated(interactions);
  const savedCount = Object.values(interactions).filter((x) => x.saved).length;
  const avgMatch = displayed.length ? Math.round(displayed.slice(0, 10).reduce((acc, x) => acc + x.relevance, 0) / Math.min(10, displayed.length)) : 0;

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!client || !email.trim()) return;
    setLoginLoading(true);
    setLoginMessage("");
    const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    setLoginLoading(false);
    setLoginMessage(error ? error.message : "Tautan masuk dikirim ke email Anda. Buka email tersebut pada perangkat ini.");
  }
  async function logout() {
    if (!client) return;
    await client.auth.signOut();
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(FEEDBACK_KEY);
    setSettings(DEFAULT_SETTINGS);
    setInteractions({});
    setCloudReady(false);
    setUser(null);
    setSyncOpen(false);
  }
  function addTopic(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newTopic.trim().slice(0, 40);
    const query = (newQuery.trim() || name).slice(0, 120);
    if (!name || query.length < 2 || settings.topics.length >= 12) return;
    const id = `custom-${Date.now().toString(36)}`;
    updateSettings((p) => ({ ...p, topics: [...p.topics, { id, label: name, query, enabled: true, weight: 3 }] }));
    setNewTopic(""); setNewQuery(""); setActiveTopic("all");
  }
  const navItems = [
    { id: "personal" as const, label: "Untuk Anda", icon: Sparkles },
    { id: "recent" as const, label: "Terbaru", icon: Clock3 },
    { id: "saved" as const, label: "Tersimpan", icon: Bookmark },
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-show" : ""}`}>
      <div className="brand"><span className="brand-symbol"><Activity size={23} strokeWidth={2.9}/></span><span className="brand-word">sinyal<span className="brand-dot">.</span><small>YOUR NEWS, YOUR WAY</small></span><button className="mobile-close icon-btn" onClick={() => setMobileNav(false)} aria-label="Tutup menu"><X size={20}/></button></div>
      <div className="sidebar-content">
        <div className="nav-label">RUANG BACA</div>
        <nav className="main-nav" aria-label="Menu utama">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-button ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); setActiveTopic("all"); setMobileNav(false); }}><Icon size={18}/><span>{item.label}</span>{item.id === "saved" && savedCount > 0 && <span className="nav-count">{savedCount}</span>}</button>; })}</nav>
        <div className="sidebar-section-heading"><span className="nav-label">TOPIK PILIHAN</span><button className="mini-icon-btn" aria-label="Atur topik" onClick={() => { setConfigOpen(true); setMobileNav(false); }}><Plus size={18}/></button></div>
        <nav className="topic-nav" aria-label="Filter berdasarkan topik"><button className={`topic-nav-item ${activeTopic === "all" ? "selected" : ""}`} onClick={() => { setActiveTopic("all"); setMobileNav(false); }}><span className="topic-bullet muted"/> Semua topik</button>{enabledTopics.map((t, idx) => <button className={`topic-nav-item ${activeTopic === t.id ? "selected" : ""}`} key={t.id} onClick={() => { setActiveTopic(t.id); setMobileNav(false); }}><span className={`topic-bullet bullet-${idx % 6}`}/><span className="topic-text">{t.label}</span></button>)}</nav>
      </div>
      <div className="sidebar-footer"><button className="sidebar-bottom-btn" onClick={() => setConfigOpen(true)}><Settings2 size={18}/> Personalisasi <ChevronRight size={16}/></button><button className="sidebar-bottom-btn" onClick={() => setSyncOpen(true)}>{user ? <Cloud size={18}/> : <CloudOff size={18}/>} {user ? "Sinkronisasi aktif" : "Sinkronkan perangkat"} <ChevronRight size={16}/></button><div className="sidebar-credit">SINYAL / <span>EDISI PERSONAL</span></div></div>
    </aside>
    {mobileNav && <button className="sidebar-backdrop" onClick={() => setMobileNav(false)} aria-label="Tutup menu"/>}
    <main className="workspace">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle icon-btn" onClick={() => setMobileNav(true)} aria-label="Buka menu"><Menu size={22}/></button><span className="breadcrumbs">Ruang baca <ChevronRight size={14}/><strong>{tab === "personal" ? "Untuk Anda" : tab === "recent" ? "Terbaru" : "Tersimpan"}</strong></span></div><div className="topbar-actions"><button className="sync-status" onClick={() => setSyncOpen(true)} title="Pengaturan sinkronisasi"><span className={`status-dot ${cloudReady ? "online" : ""}`}/><span>{cloudReady ? "Tersinkron" : "Mode lokal"}</span></button><button className="icon-btn theme-control" onClick={() => updateSettings((p) => ({...p, theme: p.theme === "dark" ? "light" : "dark"}))} title="Ganti tema" aria-label="Ganti tema">{settings.theme === "dark" ? <Sun size={19}/> : <Moon size={19}/>}</button><button className="icon-btn" onClick={() => setConfigOpen(true)} title="Pengaturan" aria-label="Pengaturan"><Settings2 size={19}/></button></div></header>
      <div className="content-wrap">
        <section className="welcome-block"><div className="date-label" suppressHydrationWarning><span className="live-dot"/> {dateHeading()}</div><div className="welcome-title-row"><div><h1>{tab === "personal" ? <>Berita yang <em>berarti.</em></> : tab === "recent" ? <>Tetap <em>terhubung.</em></> : <>Bacaan <em>tersimpan.</em></>}</h1><p className="subtitle">{tab === "personal" ? "Lebih banyak yang Anda suka. Lebih sedikit yang tak relevan." : tab === "recent" ? "Headline terbaru dari topik yang Anda pilih." : "Artikel yang ingin Anda baca kembali, di satu tempat."}</p></div><button className="refresh-btn" onClick={() => setRefetch((p) => p + 1)} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""}/> <span>Perbarui</span></button></div></section>
        <section className="stat-grid" aria-label="Ringkasan aktivitas"><div className="stat-card"><div className="stat-label"><Newspaper size={16}/> Headline tersedia</div><div className="stat-value">{loading && !articles.length ? "—" : articles.length}<span className="stat-aside">berita</span></div></div><div className="stat-card"><div className="stat-label"><Star size={16}/> Sudah Anda nilai</div><div className="stat-value">{ratingsCount}<span className="stat-aside">judul</span></div></div><div className="stat-card featured"><div className="stat-label"><TrendingUp size={16}/> Kecocokan teratas</div><div className="stat-value">{avgMatch}<span className="stat-aside">/ 99</span></div><span className="stat-sparkle"><Sparkles size={28}/></span></div></section>
        <section className="headline-section"><div className="section-header"><div><div className="section-kicker">DIPILIH UNTUK ANDA <span className="line"/></div><h2>{activeTopic === "all" ? "Headline pilihan" : topicName(activeTopic)}</h2></div><button className="filter-btn" onClick={() => setConfigOpen(true)}><SlidersHorizontal size={16}/> Preferensi</button></div>
          <div className="toolbar"><div className="search-holder"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul atau sumber..." aria-label="Cari headline"/>{search && <button onClick={() => setSearch("")} title="Hapus pencarian" aria-label="Hapus pencarian"><X size={15}/></button>}</div><div className="toolbar-right"><label className="sort-control">Urutkan <select value={tab === "recent" ? "recent" : settings.sort} disabled={tab === "recent"} onChange={(e) => updateSettings((p) => ({ ...p, sort: e.target.value === "recent" ? "recent" : "relevant" }))}><option value="relevant">Paling cocok</option><option value="recent">Paling baru</option></select><ChevronDown size={14}/></label><div className="layout-picker" role="group" aria-label="Tampilan"><button className={settings.layout === "grid" ? "chosen" : ""} onClick={() => updateSettings((p) => ({ ...p, layout: "grid" }))} title="Tampilan kartu" aria-label="Tampilan kartu"><Grid2X2 size={16}/></button><button className={settings.layout === "list" ? "chosen" : ""} onClick={() => updateSettings((p) => ({ ...p, layout: "list" }))} title="Tampilan daftar" aria-label="Tampilan daftar"><List size={17}/></button></div></div></div>
          {notice && <div className="info-banner"><CircleHelp size={17}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Tutup pemberitahuan"><X size={17}/></button></div>}
          {fetchError && <div className="warning-banner"><Globe2 size={17}/>{fetchError}<button type="button" onClick={() => setRefetch((x) => x + 1)}>Coba lagi</button></div>}
          <div className="result-header"><span>{loading ? "Mengambil headline terbaru..." : `${displayed.length} headline ditemukan`}</span><span>Skor <Sparkles size={12}/> adalah perkiraan relevansi personal</span></div>
          {loading && !articles.length ? <div className={`articles ${settings.layout === "list" ? "as-list" : settings.columns === 3 ? "three-col" : ""}`}>{Array.from({length:6}, (_, i) => <div className="skeleton-card" key={i}><div className="skeleton short"/><div className="skeleton label"/><div className="skeleton title"/><div className="skeleton title last"/><div className="skeleton bottom"/></div>)}</div>
          : displayed.length === 0 ? <div className="empty-state"><CircleIcon><Newspaper size={27}/></CircleIcon><h3>{tab === "saved" ? "Belum ada artikel tersimpan" : "Belum ada berita yang cocok"}</h3><p>{tab === "saved" ? "Tekan ikon bookmark pada berita untuk menyimpannya." : "Coba hilangkan pencarian, pilih topik lain, atau perbarui feed."}</p><button onClick={() => { setSearch(""); setActiveTopic("all"); if (tab === "saved") setTab("personal"); else setRefetch((n) => n+1); }}>Lihat headline <ArrowRight size={16}/></button></div>
          : <div className={`articles ${settings.layout === "list" ? "as-list" : settings.columns === 3 ? "three-col" : ""}`}>
            {displayed.map((article) => <NewsCard key={article.id} article={article} mode={settings.layout} topicLabel={topicName(article.topic)} rating={interactions[article.id]?.rating ?? null} saved={Boolean(interactions[article.id]?.saved)} onRate={(rating) => saveInteraction(article, { rating: interactions[article.id]?.rating === rating ? null : rating })} onSave={() => saveInteraction(article, { saved: !interactions[article.id]?.saved })}/>)}
          </div>}
          <footer className="page-footer"><span><Activity size={15}/> SINYAL — PERSONAL NEWS READER</span><span>Berita bersumber dari Google News RSS. Selalu cek artikel asli.</span></footer>
        </section>
      </div>
    </main>
    {configOpen && <div className="modal-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfigOpen(false); }}><section className="settings-panel" role="dialog" aria-modal="true" aria-label="Pengaturan personalisasi"><div className="panel-header"><div><span className="section-kicker">KONTROL ANDA</span><h2>Personalisasi</h2><p>Atur apa yang ingin Anda lihat.</p></div><button className="icon-btn" onClick={() => setConfigOpen(false)} aria-label="Tutup pengaturan"><X size={21}/></button></div><div className="panel-body"><h3>Topik berita <span>{settings.topics.length} / 12</span></h3><p className="panel-description">Aktifkan, pindahkan urutan, dan atur prioritas. Semakin tinggi prioritas, semakin besar pengaruh topik dalam skor.</p><div className="settings-topics">{settings.topics.map((t, i) => <div className={`settings-topic ${!t.enabled ? "disabled-topic" : ""}`} key={t.id}><div className="topic-main"><label className="topic-toggle"><input type="checkbox" checked={t.enabled} onChange={(e) => changeTopic(t.id, {enabled: e.target.checked})}/><span className="toggle-slider"/></label><div className="settings-topic-name"><strong>{t.label}</strong><span title={t.query}>{t.query}</span></div><div className="reorder-controls"><button title="Naikkan topik" aria-label={`Naikkan ${t.label}`} disabled={i === 0} onClick={() => shiftTopic(t.id, -1)}><ArrowUp size={15}/></button><button title="Turunkan topik" aria-label={`Turunkan ${t.label}`} disabled={i === settings.topics.length - 1} onClick={() => shiftTopic(t.id, 1)}><ArrowDown size={15}/></button></div>{t.id.startsWith("custom-") && <button className="delete-topic" title="Hapus topik" aria-label={`Hapus ${t.label}`} onClick={() => updateSettings((p) => ({ ...p, topics: p.topics.filter((x) => x.id !== t.id) }))}><Trash2 size={15}/></button>}</div><div className="weight-row"><span>Prioritas</span><input aria-label={`Prioritas ${t.label}`} disabled={!t.enabled} type="range" min="0" max="5" step="1" value={t.weight} onChange={(e) => changeTopic(t.id, {weight: Number(e.target.value)})}/><strong>{t.weight}/5</strong></div></div>)}</div>
            <form className="add-topic-form" onSubmit={addTopic}><strong><Plus size={16}/> Tambah topik sendiri</strong><input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} maxLength={40} placeholder="Nama topik, misalnya Energi" aria-label="Nama topik baru" required/><input value={newQuery} onChange={(e) => setNewQuery(e.target.value)} maxLength={120} placeholder="Kata kunci pencarian RSS (opsional)" aria-label="Kata kunci berita"/><button disabled={!newTopic.trim() || settings.topics.length >= 12} type="submit">Tambah topik <Plus size={15}/></button></form>
            <div className="panel-separator"/><h3>Tampilan berita</h3><p className="panel-description">Pilih bentuk daftar dan lebar kartu sesuai kenyamanan membaca.</p><div className="setting-line"><span>Mode tampilan</span><div className="seg-buttons"><button className={settings.layout === "grid" ? "on" : ""} onClick={() => updateSettings((p) => ({...p, layout:"grid"}))}><LayoutGrid size={15}/> Kartu</button><button className={settings.layout === "list" ? "on" : ""} onClick={() => updateSettings((p) => ({...p, layout:"list"}))}><List size={15}/> Daftar</button></div></div><div className="setting-line"><span>Kolom di laptop</span><div className="seg-buttons"><button className={settings.columns === 2 ? "on" : ""} onClick={() => updateSettings((p) => ({...p, columns: 2}))}>2</button><button className={settings.columns === 3 ? "on" : ""} onClick={() => updateSettings((p) => ({...p, columns: 3}))}>3</button></div></div><div className="setting-line"><span>Tema</span><div className="seg-buttons"><button className={settings.theme === "dark" ? "on" : ""} onClick={() => updateSettings((p) => ({...p, theme: "dark"}))}><Moon size={15}/> Gelap</button><button className={settings.theme === "light" ? "on" : ""} onClick={() => updateSettings((p) => ({...p, theme: "light"}))}><Sun size={15}/> Terang</button></div></div><p className="panel-note"><Heart size={15}/> Setiap rating 1–5 memengaruhi skor topik, sumber dan kata kunci headline berikutnya. Skor ini bukan hasil AI berbayar.</p></div><div className="panel-footer"><button className="primary-btn" onClick={() => setConfigOpen(false)}>Selesai <Check size={17}/></button></div></section></div>}
    {syncOpen && <div className="modal-layer center-modal" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSyncOpen(false); }}><section className="sync-panel" role="dialog" aria-modal="true" aria-label="Sinkronisasi"><div className="sync-panel-header"><span className="sync-icon"><Cloud size={24}/></span><button className="icon-btn" onClick={() => setSyncOpen(false)} aria-label="Tutup sinkronisasi"><X size={20}/></button></div><h2>Berita mengikuti Anda.</h2><p className="sync-description">Dengan sinkronisasi, rating, bookmark dan pengaturan tetap sama di laptop dan ponsel.</p>{!CAN_SYNC ? <div className="sync-callout"><strong>Mode lokal aktif</strong><span>Aplikasi sudah dapat dipakai. Untuk mengaktifkan sinkronisasi, buat project Supabase, jalankan <code>supabase/schema.sql</code>, dan masukkan dua environment variable di Vercel. Petunjuk lengkap ada di README.</span></div> : user ? <div className="sync-callout success"><Check size={19}/><div><strong>{cloudReady ? "Sinkronisasi aktif" : "Menghubungkan..."}</strong><span>Masuk sebagai {user.email}</span></div></div> : <form onSubmit={login} className="login-form"><label htmlFor="login-email">Alamat email Anda</label><input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" required/><button type="submit" disabled={loginLoading}>{loginLoading ? "Mengirim tautan..." : "Kirim tautan masuk"} <ArrowRight size={16}/></button>{loginMessage && <p className="login-feedback">{loginMessage}</p>}</form>}{user && <button className="logout-btn" onClick={logout}><LogOut size={16}/> Keluar dari akun</button>}<p className="privacy-note">Data penilaian milik masing-masing akun dan dilindungi kebijakan akses database (RLS).</p></section></div>}
    <nav className="bottom-tabbar" aria-label="Navigasi ponsel">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setActiveTopic("all"); }}><Icon size={20} fill={item.id === "saved" && tab === "saved" ? "currentColor" : "none"}/><span>{item.label}</span></button>; })}<button onClick={() => setConfigOpen(true)}><Settings2 size={20}/><span>Atur</span></button></nav>
  </div>;
}
