import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CarFront,
  PawPrint,
  Plane,
  Watch,
  BadgeCheck,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  FileImage,
  Filter,
  Globe2,
  GraduationCap,
  Bus,
  CircleHelp,
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
  const [filter, setFilter] = useState<"all" | ItemType>("found");
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
  const [country, setCountry] = useState("South Korea");
  const [showResultsFilters, setShowResultsFilters] = useState(false);
  const [pickedDate, setPickedDate] = useState("");
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [networkCategory, setNetworkCategory] = useState("All");
  const [activeHotspot, setActiveHotspot] = useState("Seoul");
  const heroImages = [
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=2200&q=85",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=2200&q=85",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=2200&q=85",
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=2200&q=85"
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setHeroImageIndex((current) => (current + 1) % heroImages.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

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
      const dateMatches = !pickedDate || new Date(item.created_at).toISOString().slice(0, 10) === pickedDate;
      const textMatches =
        !term ||
        [item.title, item.category, item.campus, item.location, item.description]
          .some((value) => value.toLowerCase().includes(term));
      return typeMatches && textMatches && dateMatches;
    });
  }, [items, filter, search, pickedDate]);

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
      <header className="topbar is-visible">
        <a className="brand" href="/" aria-label="FindIt AI home">
          <span className="brand-mark"><MapPin size={22} fill="currentColor" strokeWidth={2.5} /></span>
          <span className="brand-word">FindIt <span className="brand-ai">AI</span></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a className="nav-active" href="#discover">Search items</a>
          <a href="#how-it-works">How it works</a>
          <a href="#organizations">For organizations</a>
        </nav>
        <div className="topbar-right">
          <button className="country-nav" type="button" onClick={() => document.getElementById("country-select")?.focus()}><Globe2 size={17} /> Countries <ChevronDown size={14} /></button>
          <button className="help-nav" type="button" onClick={() => document.getElementById("help-section")?.scrollIntoView({ behavior: "smooth" })}><CircleHelp size={18} /> Help</button>
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
          <img key={heroImageIndex} className="hero-photo" src={heroImages[heroImageIndex]} alt="" aria-hidden="true" />
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> SMART CAMPUS LOST & FOUND</div>
            <h1>Lost something?<br /><span>Let’s bring it back.</span></h1>
            <p className="hero-description">
              Search thousands of lost-and-found reports or let our visual AI help reconnect you with what matters.
            </p>
            <div className="hero-search">
              <label className="hero-country"><Globe2 size={18} /><select id="country-select" value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Choose country"><option value="South Korea">🇰🇷  South Korea</option><option value="United States">🇺🇸  United States</option><option value="United Kingdom">🇬🇧  United Kingdom</option><option value="Uzbekistan">🇺🇿  Uzbekistan</option><option value="Japan">🇯🇵  Japan</option><option value="Canada">🇨🇦  Canada</option><option value="Australia">🇦🇺  Australia</option><option value="Germany">🇩🇪  Germany</option><option value="France">🇫🇷  France</option><option value="Italy">🇮🇹  Italy</option><option value="Spain">🇪🇸  Spain</option><option value="Netherlands">🇳🇱  Netherlands</option><option value="Switzerland">🇨🇭  Switzerland</option><option value="Sweden">🇸🇪  Sweden</option><option value="Norway">🇳🇴  Norway</option><option value="Singapore">🇸🇬  Singapore</option><option value="Malaysia">🇲🇾  Malaysia</option><option value="Türkiye">🇹🇷  Türkiye</option><option value="United Arab Emirates">🇦🇪  United Arab Emirates</option><option value="India">🇮🇳  India</option><option value="China">🇨🇳  China</option><option value="Brazil">🇧🇷  Brazil</option><option value="Mexico">🇲🇽  Mexico</option><option value="New Zealand">🇳🇿  New Zealand</option><option value="All countries">🌐  All countries</option></select><ChevronDown size={14} /></label>
              <label className="hero-query"><Search size={19} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { setFilter("found"); setShowResultsFilters(true); document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); } }}
                placeholder="What have you lost? Try wallet, keys, phone..."
                aria-label="Search lost and found items"
              /></label>
              <button className="hero-search-submit" type="button" aria-label="Search" onClick={() => { setFilter("found"); setShowResultsFilters(true); document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); }}><Search size={21} /></button>
            </div>
            <div className="hero-actions hero-search-prompt">
              <span><Search size={15} /> Search found-item reports first</span>
              <button className="button button-primary" type="button" onClick={() => { setFilter("found"); setShowResultsFilters(true); document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); }}>
                Find my item <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="hero-quick-links">
              <span>Popular searches</span>
              {["Wallet", "Phone", "Keys", "Student ID"].map((term) => (
                <button key={term} onClick={() => { setSearch(term); setFilter("found"); setShowResultsFilters(true); document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); }}>{term}</button>
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

        <section className="partners-section" aria-label="FindIt AI partner organizations">
          <h2 className="partner-intro">Trusted by our campus and community partners</h2>
          <p className="partners-subtitle">Working together to return belongings to the people who miss them</p>
          <div className="partners-marquee">
            <div className="partners-track">
              <div className="partners-group">
                <span className="partner-logo partner-gachon"><span className="partner-symbol">G</span> GACHON UNIVERSITY</span>
                <span className="partner-logo"><Building2 size={24}/> CAMPUS LIFE</span>
                <span className="partner-logo"><GraduationCap size={25}/> STUDENT SERVICES</span>
                <span className="partner-logo"><BookOpen size={24}/> UNIVERSITY LIBRARY</span>
                <span className="partner-logo"><Bus size={25}/> CAMPUS TRANSIT</span>
                <span className="partner-logo"><ShieldCheck size={24}/> CAMPUS SECURITY</span>
              </div>
              <div className="partners-group" aria-hidden="true">
                <span className="partner-logo partner-gachon"><span className="partner-symbol">G</span> GACHON UNIVERSITY</span>
                <span className="partner-logo"><Building2 size={24}/> CAMPUS LIFE</span>
                <span className="partner-logo"><GraduationCap size={25}/> STUDENT SERVICES</span>
                <span className="partner-logo"><BookOpen size={24}/> UNIVERSITY LIBRARY</span>
                <span className="partner-logo"><Bus size={25}/> CAMPUS TRANSIT</span>
                <span className="partner-logo"><ShieldCheck size={24}/> CAMPUS SECURITY</span>
              </div>
            </div>
          </div>
        </section>

        <section className="proof-band" aria-label="FindIt AI community feedback">
          <div className="proof-copy">
            <div className="review-stars" aria-label="Five star rating">★★★★★</div>
            <h2>Small things. Big relief.</h2>
            <p>FindIt AI makes it easier to search reports, compare possible matches and reconnect with the things you thought were gone.</p>
          </div>
          <div className="proof-points review-quote">
            <strong>“A simple way to turn a stressful lost-item search into a hopeful one.”</strong>
            <span>— FindIt AI campus community</span>
          </div>
        </section>

        <section className="stats-row" aria-label="Community report statistics">
          <div className="stat-block"><span className="stat-icon stat-purple"><Package size={18} /></span><div><strong>{items.length}</strong><span>Active reports</span></div></div>
          <div className="stat-block"><span className="stat-icon stat-orange"><Search size={18} /></span><div><strong>{lostCount}</strong><span>Items lost</span></div></div>
          <div className="stat-block"><span className="stat-icon stat-green"><Check size={18} /></span><div><strong>{foundCount}</strong><span>Items found</span></div></div>
          <div className="stats-note"><Sparkles size={16} /> Powered by visual AI matching</div>
        </section>

        <section className="list-section" id="community-board">
          {showResultsFilters && (
            <div className="results-searchbar" aria-label="Search result filters">
              <label className="results-country"><Globe2 size={17} /><select value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Filter by country">
                <option>South Korea</option><option>United States</option><option>United Kingdom</option><option>Uzbekistan</option><option>Japan</option><option>All countries</option>
              </select><ChevronDown size={14} /></label>
              <label className="results-location"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Key in Seoul" aria-label="Search by item or location" /></label>
              <label className="results-date"><Clock3 size={16} /><span className="date-label">Pick date</span><input type="date" value={pickedDate} onChange={(event) => setPickedDate(event.target.value)} aria-label="Filter items by date" /></label>
              <button className="results-search-button" type="button" onClick={() => document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" })} aria-label="Apply search"><Search size={19} /></button>
            </div>
          )}
          <div className="section-heading">
            <div>
              <div className="eyebrow">SEARCH THE FOUND ITEMS</div>
              <h2>Found items you may be looking for</h2>
              <p>Search registered found-item reports and check for a possible match.</p>
            </div>
            
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
                        <button className="match-link" onClick={() => void showMatches(item)}>This looks like mine <ArrowRight size={15} /></button>
                      </div>
                      {currentUser?.id === item.owner_id && <button className="resolve-link" onClick={() => void resolveItem(item)}>Mark resolved</button>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="found-report-cta">
            <div>
              <span className="eyebrow">HELP SOMEONE GET IT BACK</span>
              <h3>Found something that belongs to someone else?</h3>
              <p>Register the item so its owner can search for it and identify it.</p>
            </div>
            <button className="button button-primary" type="button" onClick={() => openReport("found")}>
              <Plus size={17} /> I found something — Report it <ArrowRight size={17} />
            </button>
          </div>
        </section>

        <section className="community-promo">
          <div>
            <div className="eyebrow">BE READY BEFORE YOU LOSE IT</div>
            <h2>Register your valuables with FindIt AI.</h2>
            <p>Keep a record of the belongings that matter. If something goes missing, you’ll have the details ready to help identify it.</p>
          </div>
          <button className="button button-primary" onClick={() => document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" })}>Search items <ArrowRight size={17} /></button>
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

        <section className="global-network" id="organizations">
          <div className="global-network-inner">
            <div className="global-network-heading">
              <div>
                <span className="eyebrow"><Globe2 size={14}/> FINDIT AI · GLOBAL NETWORK</span>
                <h2>Lost somewhere.<br/><span>Found anywhere.</span></h2>
                <p>One discovery network for the things, vehicles and companions people are searching for — across campuses, cities and travel hubs.</p>
              </div>
              <div className="network-orbit"><Globe2 size={72}/><span className="orbit-pin pin-one"><MapPin size={16}/></span><span className="orbit-pin pin-two"><MapPin size={16}/></span><span className="orbit-pin pin-three"><MapPin size={16}/></span></div>
            </div>
            <div className="network-stats">
              <div><strong>01</strong><span>One connected platform</span></div>
              <div><strong>06</strong><span>Discovery categories</span></div>
              <div><strong>Worldwide</strong><span>Designed to scale across borders</span></div>
            </div>
            <div className="network-section-title"><div><span className="eyebrow">DISCOVER BY CATEGORY</span><h3>More than everyday lost items.</h3></div><span className="demo-label">CONCEPT SHOWCASE</span></div>
            <div className="network-map-heading"><div><span className="eyebrow">WORLDWIDE HOTSPOTS</span><h3>See where discoveries happen.</h3><p>Explore illustrative lost-and-found activity hubs across major global cities.</p></div><span className="demo-label">ILLUSTRATIVE MAP · NOT LIVE ACTIVITY</span></div>
            <div className="network-map-layout">
              <div className="world-map-panel">
                <div className="world-map-topline"><span><span className="map-live-dot"/> GLOBAL DISCOVERY MAP</span><small>Sample locations · Approximate city areas</small></div>
                <div className="world-map-canvas">
                  <svg className="world-map-shapes" viewBox="0 0 1000 480" role="img" aria-label="Stylized world map showing approximate global discovery hotspots">
                    <path d="M85 105 130 65 205 55 250 82 275 130 250 160 225 177 210 220 180 245 158 215 130 205 118 165 88 145Z M215 250 250 270 267 320 250 375 225 420 205 380 195 330Z M385 105 430 75 485 80 520 105 505 135 470 145 450 180 425 160 405 130Z M455 190 495 205 520 255 505 325 470 390 440 340 430 275Z M520 90 590 55 690 65 760 95 840 90 900 130 875 165 815 175 770 205 710 190 680 225 630 205 590 170 545 165 520 130Z M770 260 825 250 870 275 850 315 800 325 770 295Z"/>
                    <path d="M320 55 340 42 360 55 350 80Z M900 205 925 195 940 215 925 235Z"/>
                  </svg>
                  {([
                    {city:"Vancouver",x:14,y:31,count:"18"},
                    {city:"New York",x:24,y:37,count:"42"},
                    {city:"London",x:47,y:25,count:"36"},
                    {city:"Dubai",x:57,y:43,count:"21"},
                    {city:"Seoul",x:79,y:34,count:"57"},
                    {city:"Tokyo",x:84,y:42,count:"49"},
                    {city:"Singapore",x:73,y:64,count:"28"},
                    {city:"Sydney",x:86,y:79,count:"16"}
                  ] as const).map((spot)=><button key={spot.city} className={activeHotspot===spot.city?"map-hotspot active":"map-hotspot"} style={{left:spot.x+"%",top:spot.y+"%"}} onClick={()=>setActiveHotspot(spot.city)} aria-label={"Select "+spot.city+" hotspot"}><span className="hotspot-pulse"/><span className="hotspot-count">{spot.count}</span></button>)}
                  <div className="map-legend"><span><i/> Discovery hotspot</span><span>Numbers are demo counts</span></div>
                </div>
              </div>
              <aside className="hotspot-sidebar">
                <span className="eyebrow">FEATURED HOTSPOT</span>
                <h4>{activeHotspot}</h4>
                <p>Illustrative community activity around a major city and travel hub.</p>
                <div className="hotspot-metrics"><strong>{({"Vancouver":"18","New York":"42","London":"36","Dubai":"21","Seoul":"57","Tokyo":"49","Singapore":"28","Sydney":"16"} as Record<string,string>)[activeHotspot]}</strong><span>sample reports</span></div>
                <div className="hotspot-item-preview"><span className="eyebrow">ITEMS ON THIS MAP AREA</span>
                  {(({
                    "Seoul":[["Black leather wallet","Found"],["Wireless earbuds","Lost"],["Student backpack","Found"]],
                    "Tokyo":[["Blue cabin suitcase","Found"],["Camera case","Lost"],["Travel passport holder","Lost"]],
                    "London":[["Silver wristwatch","Found"],["Laptop sleeve","Lost"],["House keys","Found"]],
                    "New York":[["Smartphone","Lost"],["Gym duffel bag","Found"],["Bicycle","Lost"]],
                    "Dubai":[["Gold bracelet","Found"],["Carry-on luggage","Lost"],["Car key fob","Lost"]],
                    "Singapore":[["Tablet","Found"],["Blue umbrella","Lost"],["Transit card holder","Found"]],
                    "Vancouver":[["Golden retriever","Lost"],["Mountain bike","Found"],["Red scarf","Lost"]],
                    "Sydney":[["Surfboard","Lost"],["Sunglasses","Found"],["Camera","Lost"]]
                  } as Record<string,string[][]>)[activeHotspot]||[]).map(([name,status])=><div className="hotspot-item-row" key={name}><span className="hotspot-item-dot"/><span>{name}</span><b className={status==="Lost"?"is-lost":"is-found"}>{status}</b></div>)}
                </div>
                <div className="hotspot-city-list">{(["Seoul","Tokyo","London","New York","Dubai","Singapore","Vancouver","Sydney"] as const).map((city)=><button key={city} className={activeHotspot===city?"selected":""} onClick={()=>setActiveHotspot(city)}><MapPin size={14}/>{city}<span>Explore</span></button>)}</div>
                <small className="hotspot-disclaimer">Concept data only. These are not verified reports or real-time statistics.</small>
              </aside>
            </div>
            <div className="network-category-grid">
              <button className={networkCategory==="All"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("All")}><span className="network-category-icon"><Compass/></span><strong>All discoveries</strong><small>Explore every category</small></button>
              <button className={networkCategory==="Personal items"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Personal items")}><span className="network-category-icon"><Wallet/></span><strong>Personal items</strong><small>Phones, wallets, keys</small></button>
              <button className={networkCategory==="Travel"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Travel")}><span className="network-category-icon"><Plane/></span><strong>Travel & luggage</strong><small>Bags and travel gear</small></button>
              <button className={networkCategory==="Vehicles"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Vehicles")}><span className="network-category-icon"><CarFront/></span><strong>Vehicles</strong><small>Cars, bikes, scooters</small></button>
              <button className={networkCategory==="Valuables"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Valuables")}><span className="network-category-icon"><Watch/></span><strong>Valuables</strong><small>Watches and jewelry</small></button>
              <button className={networkCategory==="Pets"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Pets")}><span className="network-category-icon"><PawPrint/></span><strong>Pets</strong><small>Lost and found animals</small></button>
            </div>
            <div className="network-section-title network-listing-title"><div><span className="eyebrow">GLOBAL DISCOVERY PREVIEW</span><h3>{networkCategory==="All"?"Explore what people may be searching for.":networkCategory+" discovery"}</h3><p>Illustrative sample listings to demonstrate the future global experience.</p></div><span className="demo-label">DEMO DATA · NOT LIVE REPORTS</span></div>
            <div className="network-listing-grid">
              {( [
                {category:"Personal items",title:"Black leather wallet",place:"Seoul, South Korea",status:"Found",image:"photo-1627123424574-724758594e93"},
                {category:"Travel",title:"Blue cabin suitcase",place:"Tokyo, Japan",status:"Found",image:"photo-1565026057447-bc90a3dceb87"},
                {category:"Vehicles",title:"White city bicycle",place:"Amsterdam, Netherlands",status:"Lost",image:"photo-1485965120184-e220f721d03e"},
                {category:"Valuables",title:"Silver wristwatch",place:"London, United Kingdom",status:"Found",image:"photo-1523275335684-37898b6baf30"},
                {category:"Pets",title:"Golden retriever",place:"Vancouver, Canada",status:"Lost",image:"photo-1552053831-71594a27632d"},
                {category:"Vehicles",title:"Blue compact car",place:"Los Angeles, United States",status:"Lost",image:"photo-1492144534655-ae79c964c9d7"}
              ] as const).filter((item)=>networkCategory==="All"||item.category===networkCategory).map((item)=>(
                <article className="network-listing-card" key={item.title}>
                  <div className="network-listing-image"><img src={`https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=800&q=82`} alt={item.title}/><span className={item.status==="Lost"?"network-status lost":"network-status"}>{item.status}</span><span className="network-demo-stamp">DEMO</span></div>
                  <div className="network-listing-copy"><span>{item.category}</span><h4>{item.title}</h4><p><MapPin size={14}/>{item.place}</p></div>
                </article>
              ))}
            </div>
            <div className="network-safety-note"><ShieldCheck size={19}/><p><strong>Safety comes first.</strong> Public previews never expose private contact details or precise locations. Vehicle recovery and pet reunification should involve verified owners and appropriate local authorities.</p></div>
            <div className="network-org-heading"><span className="eyebrow">BUILT FOR COMMUNITIES & ORGANIZATIONS</span><h3>Connect the places where things get lost.</h3><p>FindIt AI can support different types of organizations as the network grows.</p></div>
            <div className="network-org-grid">
              <div><GraduationCap/><strong>Universities</strong><span>Campus offices, libraries and student services</span></div>
              <div><Plane/><strong>Airports & travel</strong><span>Terminals, airlines and transport hubs</span></div>
              <div><Building2/><strong>Venues & retail</strong><span>Malls, hotels, events and public spaces</span></div>
              <div><ShieldCheck/><strong>Verified authorities</strong><span>Safe referral pathways for sensitive cases</span></div>
            </div>
            <div className="network-bottom-cta"><div><span className="eyebrow">START WITH YOUR COMMUNITY</span><h3>Every successful reunion starts with a report.</h3><p>Search existing reports or contribute a lost or found item to your community.</p></div><button className="button button-primary" onClick={()=>document.getElementById("community-board")?.scrollIntoView({behavior:"smooth"})}>Explore item reports <ArrowRight size={17}/></button></div>
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
            <a className="brand" href="/" aria-label="FindIt AI home"><span className="brand-mark"><MapPin size={20} fill="currentColor" /></span><span className="brand-word">FindIt <span className="brand-ai">AI</span></span></a>
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
