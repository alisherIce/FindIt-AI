import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  FileImage,
  Filter,
  Laptop,
  LogOut,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UploadCloud,
  Wallet,
  X,
} from "lucide-react";

type ItemType = "lost" | "found";

type Item = {
  id: string;
  item_type: ItemType;
  title: string;
  category: string;
  campus: string;
  location: string;
  description: string;
  image_filename: string;
  status: string;
  owner_id: string | null;
  created_at: string;
};

type Match = Item & { visual_similarity: number };
type CurrentUser = { id: string; email: string };

const categoryIcons: Record<string, typeof Package> = {
  electronics: Laptop,
  accessories: Wallet,
  documents: FileImage,
  books: BookOpen,
};

function iconForCategory(category: string) {
  const key = category.toLowerCase();
  const match = Object.entries(categoryIcons).find(([name]) => key.includes(name));
  return match?.[1] ?? Package;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    const detail = body.detail || body.message;
    if (Array.isArray(detail)) return detail.map((entry) => entry.msg || "Invalid input").join(" ");
    return detail || "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [token, setToken] = useState(() => localStorage.getItem("findit_access_token") ?? "");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [pendingReportType, setPendingReportType] = useState<ItemType | null>(null);
  const [filter, setFilter] = useState<"all" | ItemType>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<ItemType>("lost");
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [matchesFor, setMatchesFor] = useState<Item | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    title: "",
    category: "Electronics",
    campus: "Gachon University",
    location: "",
    description: "",
  });

  async function loadItems() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/items?limit=100");
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to FindIt AI.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        setCurrentUser(await response.json());
      })
      .catch(() => {
        localStorage.removeItem("findit_access_token");
        setToken("");
        setCurrentUser(null);
      });
  }, [token]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const typeMatches = filter === "all" || item.item_type === filter;
      const textMatches =
        !term ||
        [item.title, item.category, item.campus, item.location, item.description]
          .some((value) => value.toLowerCase().includes(term));
      return typeMatches && textMatches;
    });
  }, [items, filter, search]);

  const lostCount = items.filter((item) => item.item_type === "lost").length;
  const foundCount = items.filter((item) => item.item_type === "found").length;

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startReport(type: ItemType) {
    setReportType(type);
    setForm({
      title: "",
      category: "Electronics",
      campus: "Gachon University",
      location: "",
      description: "",
    });
    setSelectedFile(null);
    setShowReport(true);
  }

  function openReport(type: ItemType) {
    if (!token) {
      setPendingReportType(type);
      setAuthError("");
      setAuthMode("login");
      setShowAuth(true);
      return;
    }
    startReport(type);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      if (authMode === "register") {
        const registration = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail, password: authPassword }),
        });
        if (!registration.ok) throw new Error(await readError(registration));
      }

      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: authEmail, password: authPassword }),
      });
      if (!login.ok) throw new Error(await readError(login));

      const data = await login.json();
      localStorage.setItem("findit_access_token", data.access_token);
      setToken(data.access_token);
      const profile = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (!profile.ok) throw new Error("Could not load your account.");
      setCurrentUser(await profile.json());
      setShowAuth(false);
      setAuthMode("login");
      setAuthPassword("");
      setNotice(authMode === "register" ? "Your account is ready." : "Welcome back.");
      if (pendingReportType) {
        startReport(pendingReportType);
        setPendingReportType(null);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  function signOut() {
    localStorage.removeItem("findit_access_token");
    setToken("");
    setCurrentUser(null);
    setNotice("You have signed out.");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Please choose a photo of the item.");
      return;
    }

    setSubmitting(true);
    setError("");
    const payload = new FormData();
    payload.append("item_type", reportType);
    payload.append("title", form.title);
    payload.append("category", form.category);
    payload.append("campus", form.campus);
    payload.append("location", form.location);
    payload.append("description", form.description);
    payload.append("file", selectedFile);

    try {
      const response = await fetch("/api/items", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: payload });
      if (!response.ok) throw new Error(await readError(response));
      setShowReport(false);
      setNotice(reportType === "lost" ? "Your lost-item report is live." : "Your found-item report is live.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your report.");
    } finally {
      setSubmitting(false);
    }
  }

  async function showMatches(item: Item) {
    setMatchesFor(item);
    setMatches([]);
    setLoadingMatches(true);
    try {
      const response = await fetch(`/api/items/${item.id}/matches?limit=5`);
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      setMatches(data.matches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find matches.");
      setMatchesFor(null);
    } finally {
      setLoadingMatches(false);
    }
  }

  async function resolveItem(item: Item) {
    try {
      const response = await fetch(`/api/items/${item.id}/resolve`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(await readError(response));
      setNotice("Report marked as resolved.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this report.");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="FindIt AI home">
          <span className="brand-mark"><Sparkles size={20} /></span>
          <span>findit<span className="brand-ai">.ai</span></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a className="nav-active" href="#discover">Find an item</a>
          <a href="#how-it-works">How it works</a>
          <a href="#organizations">For organizations</a>
        </nav>
        <div className="topbar-right">
          <span className="campus-chip"><span className="live-dot" /> Campus community</span>
          {currentUser ? (
            <div className="account-actions">
              <span className="account-email">{currentUser.email}</span>
              <button className="icon-button signout-button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
            </div>
          ) : (
            <button className="button button-outline button-small" onClick={() => { setAuthError(""); setAuthMode("login"); setShowAuth(true); }}>Sign in</button>
          )}
          <button className="button button-dark button-small" onClick={() => openReport("lost")}>
            <Plus size={16} /> Report an item
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="discover">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> SMART CAMPUS LOST & FOUND</div>
            <h1>Lost something?<br /><span>Let’s bring it back.</span></h1>
            <p className="hero-description">
              Search thousands of lost-and-found reports or let our visual AI help reconnect you with what matters.
            </p>
            <label className="hero-search">
              <Search size={19} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); }}
                placeholder="What have you lost? Try wallet, keys, phone..."
                aria-label="Search lost and found items"
              />
              <button type="button" onClick={() => document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" })}>Search</button>
            </label>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => openReport("lost")}>
                I lost something <ArrowUpRight size={17} />
              </button>
              <button className="button button-outline" onClick={() => openReport("found")}>
                I found something <ArrowDownRight size={17} />
              </button>
            </div>
            <div className="hero-quick-links">
              <span>Popular searches</span>
              {["Wallet", "Phone", "Keys", "Student ID"].map((term) => (
                <button key={term} onClick={() => { setSearch(term); document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); }}>{term}</button>
              ))}
            </div>
            <div className="trust-line"><ShieldCheck size={16} /> Your item photos are processed privately.</div>
          </div>
          <div className="hero-art" aria-label="Illustration of a found item being returned">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-spark spark-a">✳</div>
            <div className="art-spark spark-b">✦</div>
            <div className="art-card art-card-back"><span className="mini-label">FOUND NEAR</span><strong>Library</strong><MapPin size={17} /></div>
            <div className="art-card art-card-front">
              <div className="art-wallet"><Wallet size={54} strokeWidth={1.25} /></div>
              <span className="art-pill"><span /> MATCH FOUND</span>
              <strong>One step closer.</strong>
              <small>Good things find their way home.</small>
            </div>
            <div className="art-float"><BadgeCheck size={20} /><span>AI assisted<br />matching</span></div>
          </div>
        </section>

        <section className="partner-strip" aria-label="FindIt AI service benefits">
          <span className="partner-intro">A smarter way to reunite with your belongings</span>
          <span><ShieldCheck size={16} /> Private by design</span>
          <span><Sparkles size={16} /> AI-powered matching</span>
          <span><MapPin size={16} /> Built for campus life</span>
        </section>

        <section className="proof-band" aria-label="How FindIt AI helps">
          <div className="proof-copy">
            <span className="eyebrow">A COMMUNITY THAT LOOKS OUT FOR YOU</span>
            <h2>Every lost item has a way back.</h2>
            <p>FindIt AI brings lost reports and found reports together in one searchable place, then helps surface visual matches.</p>
          </div>
          <div className="proof-points">
            <div><strong>01</strong><span>Search by item and place</span></div>
            <div><strong>02</strong><span>Compare possible matches</span></div>
            <div><strong>03</strong><span>Reconnect with confidence</span></div>
          </div>
        </section>

        <section className="stats-row" aria-label="Community report statistics">
          <div className="stat-block"><span className="stat-icon stat-purple"><Package size={18} /></span><div><strong>{items.length}</strong><span>Active reports</span></div></div>
          <div className="stat-block"><span className="stat-icon stat-orange"><Search size={18} /></span><div><strong>{lostCount}</strong><span>Items lost</span></div></div>
          <div className="stat-block"><span className="stat-icon stat-green"><Check size={18} /></span><div><strong>{foundCount}</strong><span>Items found</span></div></div>
          <div className="stats-note"><Sparkles size={16} /> Powered by visual AI matching</div>
        </section>

        <section className="list-section" id="community-board">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE COMMUNITY BOARD</div>
              <h2>Search lost & found items</h2>
              <p>Browse recent reports from your campus community.</p>
            </div>
            <button className="button button-dark" onClick={() => openReport("found")}><Plus size={17} /> Post a found item</button>
          </div>

          <div className="toolbar">
            <div className="filter-tabs" role="tablist" aria-label="Filter reports">
              {(["all", "lost", "found"] as const).map((value) => (
                <button
                  key={value}
                  className={filter === value ? "filter-tab selected" : "filter-tab"}
                  onClick={() => setFilter(value)}
                  role="tab"
                  aria-selected={filter === value}
                >
                  {value === "all" ? "All reports" : value === "lost" ? "Lost items" : "Found items"}
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items, places..." />
              <span className="search-shortcut"><Filter size={13} /></span>
            </label>
          </div>

          {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
          {notice && <div className="alert alert-success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button></div>}

          {loading ? (
            <div className="empty-state"><div className="loader" /><strong>Loading campus reports...</strong></div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Compass size={26} /></span>
              <strong>{items.length === 0 ? "Your campus board is ready." : "No reports found."}</strong>
              <p>{items.length === 0 ? "Be the first to post a lost or found item." : "Try another search or filter."}</p>
              {items.length === 0 && <button className="button button-primary" onClick={() => openReport("found")}><Plus size={16} /> Post the first report</button>}
            </div>
          ) : (
            <div className="item-grid">
              {filteredItems.map((item) => {
                const CategoryIcon = iconForCategory(item.category);
                return (
                  <article className="item-card" key={item.id}>
                    <div className={item.item_type === "lost" ? "item-visual visual-lost" : "item-visual visual-found"}>
                      <span className={item.item_type === "lost" ? "type-pill type-lost" : "type-pill type-found"}>{item.item_type === "lost" ? "LOST ITEM" : "FOUND ITEM"}</span>
                      <CategoryIcon size={48} strokeWidth={1.2} />
                      <span className="visual-corner">{item.category}</span>
                    </div>
                    <div className="item-content">
                      <div className="item-meta"><span><Clock3 size={13} /> {formatDate(item.created_at)}</span><span className="meta-dot">·</span><span>{item.campus}</span></div>
                      <h3>{item.title}</h3>
                      <p className="item-location"><MapPin size={14} /> {item.location}</p>
                      {item.description && <p className="item-description">{item.description}</p>}
                      <div className="item-footer">
                        <span className="category-tag"><Tag size={12} /> {item.category}</span>
                        <button className="match-link" onClick={() => void showMatches(item)}>Find matches <ArrowRight size={15} /></button>
                      </div>
                      {currentUser?.id === item.owner_id && <button className="resolve-link" onClick={() => void resolveItem(item)}>Mark resolved</button>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="community-promo">
          <div>
            <div className="eyebrow">FOUND SOMETHING?</div>
            <h2>Help someone get their item back.</h2>
            <p>A quick report could make someone's day. Add a photo and the place you found it.</p>
          </div>
          <button className="button button-primary" onClick={() => openReport("found")}>Report a found item <ArrowRight size={17} /></button>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="eyebrow">SEARCH. MATCH. RECONNECT.</div>
          <h2>Lost & found, made simple.</h2>
          <div className="how-grid">
            <div className="how-card"><span className="how-number">01</span><span className="how-icon"><UploadCloud size={22} /></span><h3>Post a photo</h3><p>Share a photo and a few details about the item you lost or found.</p></div>
            <div className="how-card"><span className="how-number">02</span><span className="how-icon"><Sparkles size={22} /></span><h3>Let AI look</h3><p>FindIt compares visual features and ranks reports that may match.</p></div>
            <div className="how-card"><span className="how-number">03</span><span className="how-icon"><BadgeCheck size={22} /></span><h3>Verify & reconnect</h3><p>Check the details privately and arrange a safe handover.</p></div>
          </div>
        </section>

        <section className="organization-section" id="organizations">
          <div className="organization-icon"><Building2 size={25} /></div>
          <div className="organization-copy">
            <span className="eyebrow">FOR UNIVERSITIES & ORGANIZATIONS</span>
            <h2>Make lost & found easier for your whole community.</h2>
            <p>Bring reports, searchable item records and AI-assisted matching into one clear workflow for your campus, event or venue.</p>
          </div>
          <div className="organization-actions">
            <button className="button button-dark" onClick={() => openReport("found")}>Explore the platform <ArrowRight size={16} /></button>
            <span>Built to grow beyond one campus.</span>
          </div>
        </section>

        <section className="faq-section" aria-labelledby="faq-title">
          <div className="faq-intro">
            <span className="eyebrow">GOOD TO KNOW</span>
            <h2 id="faq-title">A few helpful answers.</h2>
            <p>FindIt AI helps people discover possible matches while keeping personal details protected.</p>
          </div>
          <div className="faq-list">
            <details><summary>How do I report something I lost?</summary><p>Choose “I lost something”, add the item name, category, last-seen location and a photo, then submit your report.</p></details>
            <details><summary>How does visual matching work?</summary><p>When available, the matching service compares item images and returns possible matches. Always verify ownership using details that are not public.</p></details>
            <details><summary>Can I report an item I found?</summary><p>Yes. Select “I found something” and include where and when you found it so its owner has useful clues.</p></details>
            <details><summary>Is a visual match proof that an item is mine?</summary><p>No. A match is only a suggestion. Confirm distinctive details privately before arranging a safe handover.</p></details>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand-column">
            <a className="brand" href="/"><span className="brand-mark"><Sparkles size={18} /></span><span>findit<span className="brand-ai">.ai</span></span></a>
            <p>Helping campus communities bring lost belongings back to the people who matter.</p>
            <span className="footer-status"><span className="live-dot" /> FindIt AI community platform</span>
          </div>
          <div className="footer-column"><strong>For individuals</strong><a href="#community-board">Search items</a><button onClick={() => openReport("lost")}>Report a lost item</button><button onClick={() => openReport("found")}>Report a found item</button><a href="#how-it-works">How it works</a></div>
          <div className="footer-column"><strong>For organizations</strong><a href="#organizations">Campus solutions</a><a href="#organizations">Events & venues</a><a href="#organizations">Community partnerships</a></div>
          <div className="footer-column"><strong>FindIt AI</strong><a href="#discover">About the platform</a><a href="#faq-title">Help & FAQs</a><a href="#discover">Privacy-first design</a></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} FindIt AI. All rights reserved.</span><span>Designed for safer, simpler reunions.</span></div>
      </footer>

      {showAuth && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAuth(false); }}>
          <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <div className="modal-header">
              <div><div className="eyebrow"><ShieldCheck size={13} /> YOUR CAMPUS ACCOUNT</div><h2 id="auth-title">{authMode === "login" ? "Welcome back" : "Create your account"}</h2><p>{authMode === "login" ? "Sign in to post reports and manage your items." : "Join your campus community on FindIt AI."}</p></div>
              <button className="icon-button" onClick={() => setShowAuth(false)} aria-label="Close sign in"><X size={20} /></button>
            </div>
            {authError && <div className="alert alert-error" role="alert">{authError}</div>}
            <form className="report-form auth-form" onSubmit={submitAuth}>
              <label className="field-label">University email<input type="email" required autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@university.edu" /></label>
              <label className="field-label">Password<input type="password" required minLength={8} maxLength={128} autoComplete={authMode === "login" ? "current-password" : "new-password"} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 8 characters" /></label>
              <button className="button button-primary submit-button" type="submit" disabled={authBusy}>{authBusy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"} <ArrowRight size={17} /></button>
            </form>
            <p className="auth-switch">{authMode === "login" ? "New to FindIt AI?" : "Already have an account?"} <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
          </section>
        </div>
      )}

      {showReport && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowReport(false); }}>
          <section className="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <div className="modal-header">
              <div><div className="eyebrow">CAMPUS COMMUNITY</div><h2 id="report-title">Create a report</h2><p>Give the community enough detail to help.</p></div>
              <button className="icon-button" onClick={() => setShowReport(false)} aria-label="Close report form"><X size={20} /></button>
            </div>
            <div className="type-switch">
              <button className={reportType === "lost" ? "type-option active-lost" : "type-option"} onClick={() => setReportType("lost")}><Search size={16} /> I lost this</button>
              <button className={reportType === "found" ? "type-option active-found" : "type-option"} onClick={() => setReportType("found")}><Check size={16} /> I found this</button>
            </div>
            <form onSubmit={submitReport} className="report-form">
              <label className="field-label">Item name<input required minLength={2} maxLength={120} value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="e.g. Black leather wallet" /></label>
              <div className="form-row">
                <label className="field-label">Category<select value={form.category} onChange={(event) => updateForm("category", event.target.value)}><option>Electronics</option><option>Accessories</option><option>Documents</option><option>Books</option><option>Clothing</option><option>Personal item</option><option>Other</option></select><ChevronDown className="select-chevron" size={15} /></label>
                <label className="field-label">Campus<input required minLength={2} maxLength={120} value={form.campus} onChange={(event) => updateForm("campus", event.target.value)} /></label>
              </div>
              <label className="field-label">Where was it {reportType === "lost" ? "last seen" : "found"}?<input required minLength={2} maxLength={160} value={form.location} onChange={(event) => updateForm("location", event.target.value)} placeholder="e.g. Central Library, 2nd floor" /></label>
              <label className="field-label">Additional details <span className="optional-label">Optional</span><textarea maxLength={1000} rows={3} value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Color, brand, or other helpful details..." /></label>
              <label className="field-label">Item photo <span className="required-label">Required</span>
                <span className="upload-box">
                  {previewUrl ? <img src={previewUrl} alt="Selected item preview" className="upload-preview" /> : <span className="upload-placeholder"><UploadCloud size={25} /><strong>Choose an image</strong><small>JPG, PNG or WEBP · up to 5 MB</small></span>}
                  <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
                  {previewUrl && <span className="change-photo">Change photo</span>}
                </span>
              </label>
              <p className="privacy-note"><ShieldCheck size={15} /> Photos are stored privately. Avoid including personal contact details or sensitive information in the description.</p>
              <button className="button button-primary submit-button" type="submit" disabled={submitting}>{submitting ? "Submitting report..." : "Submit report"} <ArrowRight size={17} /></button>
            </form>
          </section>
        </div>
      )}

      {matchesFor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMatchesFor(null); }}>
          <section className="modal matches-modal" role="dialog" aria-modal="true" aria-labelledby="matches-title">
            <div className="modal-header">
              <div><div className="eyebrow"><Sparkles size={13} /> AI VISUAL SEARCH</div><h2 id="matches-title">Possible matches</h2><p>For “{matchesFor.title}” · {matchesFor.item_type} report</p></div>
              <button className="icon-button" onClick={() => setMatchesFor(null)} aria-label="Close matches"><X size={20} /></button>
            </div>
            {loadingMatches ? <div className="empty-state compact"><div className="loader" /><strong>Comparing item photos...</strong><p>The first search may take a little longer while AI loads.</p></div> : matches.length === 0 ? <div className="empty-state compact"><span className="empty-icon"><Search size={24} /></span><strong>No possible matches yet</strong><p>We’ll have more to compare as new reports are added.</p></div> : (
              <div className="match-results">
                {matches.map((match) => (
                  <div className="match-result" key={match.id}>
                    <div className="match-result-icon"><Package size={22} /></div>
                    <div className="match-result-info"><strong>{match.title}</strong><span>{match.item_type} · {match.category}</span><small><MapPin size={12} /> {match.campus} · {match.location}</small></div>
                    <div className="similarity"><strong>{Math.round(Math.max(0, Math.min(1, match.visual_similarity)) * 100)}%</strong><span>visual score</span></div>
                  </div>
                ))}
              </div>
            )}
            <p className="match-disclaimer"><ShieldCheck size={15} /> AI similarity is only a suggestion, not proof of ownership. Verify privately before arranging a handover.</p>
          </section>
        </div>
      )}
    </div>
  );
}
