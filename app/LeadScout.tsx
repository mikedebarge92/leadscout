"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: string;
  name: string;
  category: string;
  area: string;
  rating: number;
  reviews: number;
  issue: "No website" | "Outdated site";
  score: number;
  phone: string;
  address: string;
  reason: string;
  stage: "New" | "Saved" | "Prototype ready" | "Contacted";
  isSaved?: boolean;
  inDiscovery?: boolean;
  website?: string;
  mapsUrl?: string;
  x: number;
  y: number;
};

const seedLeads: Lead[] = [
  { id: "demo-1", name: "Hearth & Grain Bakery", category: "Bakery", area: "Downtown", rating: 4.8, reviews: 184, issue: "No website", score: 96, phone: "(916) 555-0142", address: "218 J Street", reason: "High review velocity, no owned web presence", stage: "New", x: 27, y: 29 },
  { id: "demo-2", name: "Marlow Auto & Tire", category: "Auto repair", area: "Midtown", rating: 4.7, reviews: 126, issue: "Outdated site", score: 92, phone: "(916) 555-0188", address: "904 21st Street", reason: "Fixed-width site, no mobile CTA, copyright 2011", stage: "Saved", x: 58, y: 39 },
  { id: "demo-3", name: "Juniper Family Dental", category: "Dentist", area: "East Sacramento", rating: 4.9, reviews: 88, issue: "Outdated site", score: 89, phone: "(916) 555-0129", address: "3318 Folsom Blvd", reason: "Excellent reputation, dated template and weak booking flow", stage: "Prototype ready", x: 76, y: 33 },
  { id: "demo-4", name: "Capitol Shoe Repair", category: "Shoe repair", area: "Downtown", rating: 4.6, reviews: 73, issue: "No website", score: 86, phone: "(916) 555-0171", address: "1128 10th Street", reason: "Local favorite relying entirely on map listing", stage: "New", x: 39, y: 55 },
  { id: "demo-5", name: "Sierra Pet Grooming", category: "Pet groomer", area: "Land Park", rating: 4.8, reviews: 61, issue: "Outdated site", score: 82, phone: "(916) 555-0165", address: "2660 Riverside Blvd", reason: "Strong demand, non-secure site and no online request form", stage: "Contacted", x: 31, y: 75 },
  { id: "demo-6", name: "Oak & Iron Barbers", category: "Barber shop", area: "Oak Park", rating: 4.7, reviews: 47, issue: "No website", score: 80, phone: "(916) 555-0114", address: "3512 Broadway", reason: "Growing review count with no booking destination", stage: "New", x: 69, y: 70 },
];

const filters = ["All leads", "No website", "Outdated site"];

export default function LeadScout() {
  const [leads, setLeads] = useState(seedLeads);
  const [view, setView] = useState<"discover" | "saved">("discover");
  const [filter, setFilter] = useState("All leads");
  const [selected, setSelected] = useState<Lead>(seedLeads[0]);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("Sacramento, CA");
  const [radius, setRadius] = useState("5 miles");
  const [category, setCategory] = useState("All local businesses");
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [running, setRunning] = useState(false);
  const [minReviews, setMinReviews] = useState(10);
  const [includeNoWebsite, setIncludeNoWebsite] = useState(true);
  const [includeOutdated, setIncludeOutdated] = useState(true);
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [connecting, setConnecting] = useState("");
  const [status, setStatus] = useState({ googlePlaces: false, email: false, deliveryEmail: false, mode: "demo", vaultReady: false });

  useEffect(() => {
    Promise.all([
      fetch("/api/status").then((r) => r.json()),
      fetch("/api/leads").then((r) => r.json()),
    ]).then(([connectionStatus, stored]) => {
      setStatus(connectionStatus);
      if (stored.leads?.length) {
        setLeads(stored.leads);
        setSelected(stored.leads[0]);
      }
    }).catch(() => {});
  }, []);

  const visible = useMemo(() => leads.filter((lead) => {
    const textMatch = `${lead.name} ${lead.category} ${lead.area}`.toLowerCase().includes(query.toLowerCase());
    const filterMatch = filter === "All leads" || lead.issue === filter;
    const viewMatch = view === "discover" ? lead.inDiscovery !== false : (lead.isSaved ?? lead.stage !== "New");
    return textMatch && filterMatch && viewMatch;
  }), [leads, query, filter, view]);

  function persist(next: Lead[]) {
    setLeads(next);
  }

  function updateStage(id: string, stage: Lead["stage"]) {
    const next = leads.map((lead) => lead.id === id ? { ...lead, stage, isSaved: stage === "Saved" } : lead);
    persist(next);
    const active = next.find((lead) => lead.id === id);
    if (active) setSelected(active);
    if (!id.startsWith("demo-")) {
      fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, stage }) }).catch(() => {});
    }
    setToast(stage === "Saved" ? "Lead saved to your shortlist" : "Lead removed from saved leads");
    window.setTimeout(() => setToast(""), 2400);
  }

  async function runSearch() {
    setRunning(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, category, minReviews, radius, limit: 20, includeNoWebsite, includeOutdated }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.code === "NOT_CONNECTED" ? "Connect Google Places before running a live search" : result.error || "Search failed");
      const refreshed = await fetch("/api/leads").then((response) => response.json()).catch(() => ({ leads: result.leads }));
      const allLeads = refreshed.leads?.length ? refreshed.leads : result.leads;
      setLeads(allLeads);
      if (result.leads[0]) setSelected(result.leads[0]);
      setRunning(false);
      setSearchOpen(false);
      setToast(`Found ${result.qualified} qualified leads after checking ${result.scanned} businesses`);
      window.setTimeout(() => setToast(""), 2600);
    } catch (error) {
      setRunning(false);
      setToast(error instanceof Error ? error.message : "Search failed");
      window.setTimeout(() => setToast(""), 3200);
    }
  }

  async function clearResults() {
    try {
      const response = await fetch("/api/leads", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not clear results");
      const savedOnly = leads.filter((lead) => lead.isSaved ?? lead.stage !== "New").map((lead) => ({ ...lead, inDiscovery: false }));
      setLeads(savedOnly);
      if (savedOnly[0]) setSelected(savedOnly[0]);
      setToast("Search results cleared · saved leads kept");
      window.setTimeout(() => setToast(""), 2600);
    } catch {
      setToast("Could not clear results");
      window.setTimeout(() => setToast(""), 2600);
    }
  }

  async function connectService(service: "googlePlaces" | "resend") {
    const key = service === "googlePlaces" ? googleKey : resendKey;
    if (!key.trim()) {
      setToast("Paste an API key first");
      window.setTimeout(() => setToast(""), 2400);
      return;
    }
    setConnecting(service);
    try {
      const response = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, key }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Connection failed");
      setStatus((current) => ({ ...current, [service === "googlePlaces" ? "googlePlaces" : "email"]: true, mode: service === "googlePlaces" ? "live" : current.mode }));
      if (service === "googlePlaces") setGoogleKey(""); else setResendKey("");
      setToast(`${service === "googlePlaces" ? "Google Places" : "Resend"} connected successfully`);
      window.setTimeout(() => setToast(""), 2600);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Connection failed");
      window.setTimeout(() => setToast(""), 3200);
    } finally {
      setConnecting("");
    }
  }

  const noWebsiteCount = leads.filter((lead) => lead.issue === "No website").length;
  const avgReviews = leads.length ? Math.round(leads.reduce((total, lead) => total + lead.reviews, 0) / leads.length) : 0;
  const savedLeads = leads.filter((lead) => lead.isSaved ?? lead.stage !== "New");
  const savedNoWebsite = savedLeads.filter((lead) => lead.issue === "No website").length;
  const savedAvgReviews = savedLeads.length ? Math.round(savedLeads.reduce((total, lead) => total + lead.reviews, 0) / savedLeads.length) : 0;

  function switchView(next: "discover" | "saved") {
    setView(next);
    setFilter("All leads");
    setQuery("");
    const first = leads.find((lead) => next === "discover" ? lead.inDiscovery !== false : (lead.isSaved ?? lead.stage !== "New"));
    if (first) setSelected(first);
  }

  function googleSearchUrl(lead: Lead) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${lead.name} ${lead.address}`)}`;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">⌖</span>
          <span>LeadScout</span>
        </div>
        <nav>
          <button className={`nav-item ${view === "discover" ? "active" : ""}`} onClick={() => switchView("discover")}><span>⌂</span> Discover</button>
          <button className={`nav-item ${view === "saved" ? "active" : ""}`} onClick={() => switchView("saved")}><span>♡</span> Saved leads <b>{savedLeads.length}</b></button>
        </nav>
        <div className="sidebar-foot">
          <div className="daily-card">
            <div className="pulse-dot" />
            <div><strong>Daily scout</strong><small>Next run tomorrow, 8:00 AM</small></div>
            <button onClick={() => setSettingsOpen(true)}>•••</button>
          </div>
          <button className="profile" onClick={() => setSettingsOpen(true)}>
            <span>MD</span><div><strong>Mike Davis</strong><small>Workspace</small></div><i>⌄</i>
          </button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">{view === "discover" ? "DISCOVER" : "SAVED LEADS"}</p>
            <h1>{view === "discover" ? "Good businesses. Better websites." : "Your strongest opportunities."}</h1>
          </div>
          <div className="header-actions">
            <label className="search-box"><span>⌕</span><input aria-label="Search leads" placeholder="Search leads..." value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>⌘ K</kbd></label>
            <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Settings">⚙</button>
            {view === "discover" && <button className="primary" onClick={() => setSearchOpen(true)}><span>＋</span> New search</button>}
          </div>
        </header>

        {view === "discover" ? <section className="stats-row">
          <div><span>QUALIFIED LEADS</span><strong>{leads.length}</strong><em>{status.mode === "live" ? "Live results" : "Demo results"}</em></div>
          <div><span>WITHOUT A WEBSITE</span><strong>{noWebsiteCount}</strong><em>{leads.length ? Math.round(noWebsiteCount / leads.length * 100) : 0}% of leads</em></div>
          <div><span>OUTDATED SITES</span><strong>{leads.length - noWebsiteCount}</strong><em>Needs redesign</em></div>
          <div><span>AVG. REVIEWS</span><strong>{avgReviews}</strong><em>Strong social proof</em></div>
        </section> : <section className="stats-row saved-stats">
          <div><span>SAVED LEADS</span><strong>{savedLeads.length}</strong><em>Persistent shortlist</em></div>
          <div><span>WITHOUT A WEBSITE</span><strong>{savedNoWebsite}</strong><em>Clean opportunities</em></div>
          <div><span>OUTDATED SITES</span><strong>{savedLeads.length - savedNoWebsite}</strong><em>Redesign opportunities</em></div>
          <div><span>AVG. REVIEWS</span><strong>{savedAvgReviews}</strong><em>Local credibility</em></div>
        </section>}

        {view === "discover" && !status.googlePlaces && <section className="setup-banner">
          <div className="setup-icon">⌁</div>
          <div><strong>Make LeadScout live</strong><p>Connect Google Places once, then search real businesses from this dashboard.</p></div>
          <button onClick={() => setSettingsOpen(true)}>Connect API →</button>
        </section>}

        <section className={`workspace ${view === "saved" ? "saved-workspace" : ""}`}>
          <div className="map-panel">
            <div className="map-toolbar">
              <button onClick={() => view === "discover" && setSearchOpen(true)}>⌖ {area}</button>
              <button onClick={() => view === "discover" && setSearchOpen(true)}>{view === "discover" ? `Within ${radius}⌄` : `${savedLeads.length} saved`}</button>
            </div>
            <div className="street s1" /><div className="street s2" /><div className="street s3" /><div className="street s4" />
            <div className="street s5" /><div className="street s6" /><div className="river" />
            {visible.map((lead) => (
              <button key={lead.id} className={`map-pin ${selected.id === lead.id ? "selected" : ""}`} style={{ left: `${lead.x}%`, top: `${lead.y}%` }} onClick={() => setSelected(lead)} aria-label={`View ${lead.name}`}>
                <span>{lead.score}</span>
              </button>
            ))}
            <div className="map-legend"><span><i className="hot" />90+ best fit</span><span><i />80+ qualified</span></div>
            <div className="map-controls"><button>＋</button><button>−</button></div>
          </div>

          <div className="leads-panel">
            <div className="panel-head">
              <div><h2>{view === "discover" ? "Qualified leads" : "Saved leads"}</h2><p>{view === "discover" ? "Sorted by opportunity score" : "Your persistent prospect shortlist"}</p></div>
              {view === "discover" && leads.some((lead) => lead.inDiscovery !== false) ? <button className="clear-results" onClick={clearResults}>Clear results</button> : <span />}
            </div>
            <div className="filters">{filters.map(f => <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>)}</div>
            <div className="lead-list">
              {visible.length === 0 && <div className="empty-saved"><span>♡</span><h3>No saved leads yet</h3><p>Open Discover and save the businesses you want to pursue.</p><button onClick={() => switchView("discover")}>Browse leads</button></div>}
              {visible.map((lead) => (
                <article key={lead.id} className={`lead-card ${selected.id === lead.id ? "active" : ""}`} onClick={() => setSelected(lead)}>
                  <div className="score">{lead.score}</div>
                  <div className="lead-main">
                    <div className="lead-title"><h3>{lead.name}</h3><span className={lead.issue === "No website" ? "no-site" : "old-site"}>{lead.issue}</span></div>
                    <p>{lead.category} · {lead.area}</p>
                    <div className="rating"><span>★</span> {lead.rating} <small>({lead.reviews} reviews)</small></div>
                    <p className="reason">{lead.reason}</p>
                    <a className="research-link" href={googleSearchUrl(lead)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Google search ↗</a>
                    {(lead.isSaved ?? lead.stage !== "New") && <span className="stage">✓ Saved</span>}
                  </div>
                  <button className={`save-heart ${(lead.isSaved ?? lead.stage !== "New") ? "saved" : ""}`} aria-label={(lead.isSaved ?? lead.stage !== "New") ? "Remove saved lead" : "Save lead"} onClick={(e) => { e.stopPropagation(); updateStage(lead.id, (lead.isSaved ?? lead.stage !== "New") ? "New" : "Saved"); }}>{(lead.isSaved ?? lead.stage !== "New") ? "♥" : "♡"}</button>
                </article>
              ))}
            </div>
          </div>

          <aside className="detail-panel">
            <button className="close-detail" aria-label="Close details">×</button>
            <div className="detail-score"><span>{selected.score}</span><div><small>OPPORTUNITY</small><strong>Excellent fit</strong></div></div>
            <p className="detail-category">{selected.category} · {selected.area}</p>
            <h2>{selected.name}</h2>
            <div className="rating big"><span>★</span> {selected.rating} <small>{selected.reviews} Google reviews</small></div>
            <div className="detail-actions compact-actions">
              <a href={`tel:${selected.phone}`}>☎ <span>Call</span></a>
              <button onClick={() => updateStage(selected.id, (selected.isSaved ?? selected.stage !== "New") ? "New" : "Saved")}>{(selected.isSaved ?? selected.stage !== "New") ? "♥" : "♡"} <span>{(selected.isSaved ?? selected.stage !== "New") ? "Remove" : "Save"}</span></button>
              <a href={googleSearchUrl(selected)} target="_blank" rel="noreferrer">G <span>Search</span></a>
            </div>
            <div className="section"><label>CONTACT</label><p>⌖ {selected.address}</p><p>☎ {selected.phone}</p></div>
            <div className="external-links">{selected.website && <a href={selected.website} target="_blank" rel="noreferrer">Visit website ↗</a>}{selected.mapsUrl ? <a href={selected.mapsUrl} target="_blank" rel="noreferrer">Google Maps ↗</a> : <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.address)}`} target="_blank" rel="noreferrer">Google Maps ↗</a>}</div>
            <div className="section"><label>WEBSITE SIGNAL</label><div className="signal"><span>!</span><div><strong>{selected.issue}</strong><p>{selected.reason}</p>{selected.website && <small className="audit-proof">Verified from the site’s technical markup</small>}</div></div></div>
            <div className="section"><label>WHY IT&apos;S A GOOD LEAD</label>
              <ul><li><span>✓</span> 4.5+ rating with strong local trust</li><li><span>✓</span> {selected.reviews} reviews show proven demand</li><li><span>✓</span> Clear opportunity to improve conversion</li></ul>
            </div>
            <button className={(selected.isSaved ?? selected.stage !== "New") ? "remove-saved-button" : "save-lead-button"} onClick={() => updateStage(selected.id, (selected.isSaved ?? selected.stage !== "New") ? "New" : "Saved")}>{(selected.isSaved ?? selected.stage !== "New") ? "Remove from saved leads" : "Save this lead"} <span>{(selected.isSaved ?? selected.stage !== "New") ? "×" : "♥"}</span></button>
          </aside>
        </section>
      </main>

      {searchOpen && <div className="modal-backdrop" onMouseDown={() => setSearchOpen(false)}>
        <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setSearchOpen(false)}>×</button>
          <p className="eyebrow">NEW SEARCH</p><h2>Scout a local market</h2><p className="modal-copy">Find trusted businesses whose web presence is holding them back.</p>
          <label>Location<input value={area} onChange={(e) => setArea(e.target.value)} /></label>
          <div className="field-row"><label>Radius<select value={radius} onChange={(e) => setRadius(e.target.value)}><option>2 miles</option><option>5 miles</option><option>10 miles</option><option>25 miles</option></select></label>
          <label>Business type<select value={category} onChange={(e) => setCategory(e.target.value)}><option>All local businesses</option><option>Home services</option><option>Health & wellness</option><option>Food & hospitality</option><option>Professional services</option></select></label></div>
          <label>Minimum Google reviews<input type="number" min={10} value={minReviews} onChange={(e) => setMinReviews(Number(e.target.value))} /></label>
          <div className="check-row"><span>Website signal</span><label><input type="checkbox" checked={includeNoWebsite} onChange={(e) => setIncludeNoWebsite(e.target.checked)} /> No website</label><label><input type="checkbox" checked={includeOutdated} onChange={(e) => setIncludeOutdated(e.target.checked)} /> Outdated website</label></div>
          <button className="run-button" onClick={runSearch} disabled={running || (!includeNoWebsite && !includeOutdated)}>{running ? "Scanning businesses & websites…" : "Find qualified leads →"}</button>
          {includeOutdated && <small className="audit-explainer">Outdated sites require multiple verified technical signals. Unreachable sites are excluded.</small>}
          <small className="api-note">{status.googlePlaces ? "Live mode · Google Places connected" : "Demo mode · Google Places connection required"}</small>
        </div>
      </div>}

      {settingsOpen && <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
        <div className="modal compact" onMouseDown={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setSettingsOpen(false)}>×</button>
          <p className="eyebrow">CONNECTIONS & DELIVERY</p><h2>Make LeadScout live</h2><p className="modal-copy">Connect your accounts here. Keys are tested, encrypted, and never shown again.</p>
          <div className="connection-list">
            <div><span className={status.googlePlaces ? "connected" : ""}>{status.googlePlaces ? "✓" : "!"}</span><p><strong>Google Places</strong><small>{status.googlePlaces ? "Connected · live searches ready" : "Not connected · demo results only"}</small></p></div>
            <div><span className={status.email ? "connected" : ""}>{status.email ? "✓" : "!"}</span><p><strong>Resend email</strong><small>{status.email ? "Connected · delivery ready" : "Not connected · daily email paused"}</small></p></div>
          </div>
          {!status.googlePlaces && <div className="credential-field">
            <label>Google Places API key<input type="password" autoComplete="off" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} placeholder="AIza…" /></label>
            <button onClick={() => connectService("googlePlaces")} disabled={connecting === "googlePlaces"}>{connecting === "googlePlaces" ? "Testing…" : "Connect"}</button>
          </div>}
          {!status.email && <div className="credential-field">
            <label>Resend API key<input type="password" autoComplete="off" value={resendKey} onChange={(e) => setResendKey(e.target.value)} placeholder="re_…" /></label>
            <button onClick={() => connectService("resend")} disabled={connecting === "resend"}>{connecting === "resend" ? "Testing…" : "Connect"}</button>
          </div>}
          {(status.googlePlaces || status.email) && <div className="security-note">⌾ Credentials are encrypted at rest and only decrypted inside private server requests.</div>}
          <label>Delivery email<input type="email" value={deliveryEmail} onChange={(e) => setDeliveryEmail(e.target.value)} placeholder="you@studio.com" /></label>
          <div className="field-row"><label>Send at<select><option>8:00 AM</option><option>9:00 AM</option><option>12:00 PM</option></select></label><label>Daily limit<select><option>10 leads</option><option>20 leads</option><option>50 leads</option></select></label></div>
          <button className="run-button" onClick={async () => {
            await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliveryEmail, deliveryHour: 8, dailyLimit: 10, area, radiusMiles: Number(radius.split(" ")[0]), category, minReviews }) });
            setSettingsOpen(false); setToast("Daily scout settings saved"); window.setTimeout(() => setToast(""), 2400);
          }}>Save schedule</button>
          <small className="api-note">{status.googlePlaces ? "Live search is ready." : "Google Places is required for live results."} Resend is only needed for daily email.</small>
        </div>
      </div>}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}
