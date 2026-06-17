import { useState, useEffect, useCallback } from "react";

// ─── API KEYS ────────────────────────────────────────────────────────────────
/* global process */
const EBIRD_KEY = (() => {
  try { return process.env.REACT_APP_EBIRD_KEY || ""; } catch { return ""; }
})();

// Recreation.gov public availability API — no key required
const REC_AVAIL_URL = (facilityId) =>
  `https://www.recreation.gov/api/camps/availability/campground/${facilityId}/month`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function fetchSeasonalBirds(eBirdHotspot, dateStr) {
  if (!EBIRD_KEY || !dateStr) return [];
  try {
    // Use the month of the first available date for seasonal accuracy
    const month = new Date(dateStr).getMonth() + 1;
    const res = await fetch(
      `https://api.ebird.org/v2/data/obs/${eBirdHotspot}/recent?back=30&maxResults=20`,
      { headers: { "X-eBirdApiToken": EBIRD_KEY } }
    );
    if (!res.ok) {
      // Fall back to bar chart data for the month
      const bcRes = await fetch(
        `https://api.ebird.org/v2/product/spplist/${eBirdHotspot}`,
        { headers: { "X-eBirdApiToken": EBIRD_KEY } }
      );
      if (!bcRes.ok) return [];
      const codes = await bcRes.json();
      return codes.slice(0, 10).map(c => ({ speciesCode: c, comName: c }));
    }
    const obs = await res.json();
    // Filter to month if possible — for now return recent sightings
    return obs.map(o => ({ speciesCode: o.speciesCode, comName: o.comName, howMany: o.howMany, obsDt: o.obsDt }));
  } catch { return []; }
}

// ─── SORT & FILTER OPTIONS ───────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "availability", label: "Earliest Availability" },
  { value: "distance", label: "Distance from Irvine" },
  { value: "elevation", label: "Elevation (High→Low)" },
  { value: "price", label: "Price (Low→High)" },
];

const amenityFilters = [
  { key: "tentOk", label: "🏕 Tent" },
  { key: "rvOk", label: "🚐 RV" },
  { key: "hasWater", label: "💧 Water" },
  { key: "hasShowers", label: "🚿 Showers" },
  { key: "hasElectric", label: "⚡ Electric" },
];

// ─── AVAILABILITY BADGE ───────────────────────────────────────────────────────
function AvailBadge({ type }) {
  return (
    <div style={{ fontSize: 11, color: "#8a7a6a", fontStyle: "italic" }}>
      Check site for availability
    </div>
  );
}

// ─── CAMP CARD ────────────────────────────────────────────────────────────────
function CampCard({ camp, avail, onExpand, expanded, eBirdKey }) {
  const [seasonalBirds, setSeasonalBirds] = useState([]);
  const [birdsLoading, setBirdsLoading] = useState(false);

  useEffect(() => {
    if (!expanded || !eBirdKey) return;
    setBirdsLoading(true);
    const dateToUse = avail?.nextAvailable || new Date().toISOString().substring(0, 10);
    fetchSeasonalBirds(camp.eBirdHotspot, dateToUse).then(birds => {
      setSeasonalBirds(birds);
      setBirdsLoading(false);
    });
  }, [expanded, camp.eBirdHotspot, avail?.nextAvailable, eBirdKey]);

  const isManual = camp.reservationType === "manual";
  const color = isManual ? "#8f6a3a" : "#2d6a8f";

  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      border: `2px solid ${expanded ? color : "#e0d8cc"}`,
      boxShadow: expanded ? `0 4px 20px ${color}25` : "0 2px 8px rgba(0,0,0,0.06)",
      overflow: "hidden",
      transition: "all 0.2s",
    }}>
      {/* Card Header */}
      <div
        onClick={() => onExpand(camp.id)}
        style={{ padding: "16px 18px", cursor: "pointer", background: expanded ? `${color}0d` : "#fff" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{isManual ? "🏞️" : "⛺"}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                color: "#fff", background: color, borderRadius: 20, padding: "2px 8px"
              }}>
                {camp.agency}
              </span>
              {camp.kidFriendly && <span style={{ fontSize: 10, color: "#4a7c59", fontWeight: 700 }}>👨‍👩‍👧 Kid Friendly</span>}
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "#1a2a1a", fontWeight: 700 }}>{camp.name}</h3>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6a7a6a", flexWrap: "wrap" }}>
              <span>📍 {camp.distanceMiles} mi</span>
              <span>🚗 {camp.driveMinutes} min</span>
              <span>⛰️ {camp.elevation.toLocaleString()} ft</span>
              <span>💰 ${camp.pricePerNight}/night</span>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <AvailBadge type={camp.reservationType} />
            <div style={{ fontSize: 18, marginTop: 4 }}>{expanded ? "▲" : "▼"}</div>
          </div>
        </div>

        {/* Amenity pills */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
          {amenityFilters.map(f => camp[f.key] && (
            <span key={f.key} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${color}15`, color: color, fontWeight: 600 }}>
              {f.label}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${color}20`, padding: "16px 18px" }}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#4a5a4a", lineHeight: 1.6 }}>{camp.highlights}</p>

          {/* Trails */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#8a7a6a", marginBottom: 8 }}>Nearby Trails</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {camp.trails.map(t => (
                <div key={t.name} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: `1px solid ${color}40`, background: `${color}08`, color: "#3a3028" }}>
                  {t.name} · {t.distance} · {t.difficulty}
                </div>
              ))}
            </div>
          </div>

          {/* Featured Birds */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#8a7a6a", marginBottom: 8 }}>
              Featured Birds at this Campground
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {camp.birds.map(b => (
                <a key={b.name}
                  href={`https://www.audubon.org/field-guide/bird/${b.name.toLowerCase().replace(/['']/g, "").replace(/\s+/g, "-")}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "#1a3a6a", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
                  🐦 {b.name}
                </a>
              ))}
            </div>
          </div>

          {/* Live eBird seasonal sightings */}
          {EBIRD_KEY && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#8a7a6a", marginBottom: 8 }}>
                {avail?.nextAvailable
                  ? `Birds Recently Spotted Here (near ${formatDate(avail.nextAvailable)})`
                  : "Recent eBird Sightings"}
              </div>
              {birdsLoading ? (
                <div style={{ fontSize: 12, color: "#8a7a6a" }}>Loading sightings…</div>
              ) : seasonalBirds.length === 0 ? (
                <div style={{ fontSize: 12, color: "#8a7a6a" }}>No recent sightings reported.</div>
              ) : (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {seasonalBirds.slice(0, 20).map((b, i) => (
                    <span key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: `${color}15`, color: color, fontWeight: 600 }}>
                      {b.comName}{b.howMany ? ` ×${b.howMany}` : ""}
                    </span>
                  ))}
                </div>
              )}
              <a href={camp.eBirdUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: color, fontWeight: 700, textDecoration: "none" }}>
                📊 Full eBird Hotspot →
              </a>
            </div>
          )}



          {/* CTA Button */}
          <a href={camp.reservationUrl} target="_blank" rel="noopener noreferrer"
            style={{
              display: "inline-block", padding: "10px 20px", borderRadius: 25,
              background: color, color: "#fff", fontWeight: 700, fontSize: 13,
              textDecoration: "none", letterSpacing: 0.5,
            }}>
            {isManual ? "🔗 Check Availability →" : "🏕 Reserve on Recreation.gov →"}
          </a>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [camps, setCamps] = useState([]);
  const [availability, setAvailability] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [sortBy, setSortBy] = useState("availability");
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);

  // Load campground data
useEffect(() => {
  fetch("/campgrounds.json")
    .then(r => r.json())
    .then(data => {
      setCamps(data);
      setLoading(false);
    })
    .catch(() => setLoading(false));
}, []);

  const handleExpand = useCallback((id) => {
    setExpanded(prev => prev === id ? null : id);
  }, []);

  const toggleFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Apply filters
  const filtered = camps.filter(c => {
    return Object.entries(filters).every(([key, active]) => !active || c[key]);
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "availability") {
      const aDate = availability[a.id]?.nextAvailable || "9999";
      const bDate = availability[b.id]?.nextAvailable || "9999";
      // Manual sites sort after Recreation.gov sites
      if (a.reservationType === "manual" && b.reservationType !== "manual") return 1;
      if (b.reservationType === "manual" && a.reservationType !== "manual") return -1;
      return aDate.localeCompare(bDate);
    }
    if (sortBy === "distance") return a.distanceMiles - b.distanceMiles;
    if (sortBy === "elevation") return b.elevation - a.elevation;
    if (sortBy === "price") return a.pricePerNight - b.pricePerNight;
    return 0;
  });

  return (
    <div style={{ fontFamily: "'Georgia','Times New Roman',serif", minHeight: "100vh", background: "linear-gradient(160deg,#f5f0e8 0%,#e8f0e8 50%,#e8eaf5 100%)", paddingBottom: 48 }}>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#1a3a2a 0%,#2d5a3d 60%,#1a2a3a 100%)", padding: "28px 20px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "12px 12px" }} />
        <div style={{ position: "relative", maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#a8c8a8", textTransform: "uppercase", marginBottom: 6 }}>Within 100 miles of Irvine, CA</div>
          <h1 style={{ margin: 0, fontSize: "clamp(20px,5vw,30px)", fontWeight: 400, color: "#f0ede0", lineHeight: 1.2, fontStyle: "italic" }}>
            Family Camping<br />
            <span style={{ fontStyle: "normal", fontWeight: 700 }}>&amp; Birding Sites</span>
          </h1>
          <p style={{ margin: "10px 0 0", color: "#8ab88a", fontSize: 12, letterSpacing: 1 }}>
            {camps.length} campgrounds · kid-friendly hikes · live availability
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 14px" }}>

        {/* SORT & FILTER BAR */}
        <div style={{ padding: "16px 0 8px" }}>
          {/* Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#8a7a6a", letterSpacing: 1, textTransform: "uppercase" }}>Sort:</span>
            {SORT_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setSortBy(o.value)}
                style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, border: `1.5px solid ${sortBy === o.value ? "#2d6a8f" : "#d0c8b8"}`, background: sortBy === o.value ? "#2d6a8f" : "#faf8f3", color: sortBy === o.value ? "#fff" : "#3a3028", cursor: "pointer", fontWeight: sortBy === o.value ? 700 : 400 }}>
                {o.label}
              </button>
            ))}
          </div>
          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#8a7a6a", letterSpacing: 1, textTransform: "uppercase" }}>Filter:</span>
            {amenityFilters.map(f => (
              <button key={f.key} onClick={() => toggleFilter(f.key)}
                style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, border: `1.5px solid ${filters[f.key] ? "#4a7c59" : "#d0c8b8"}`, background: filters[f.key] ? "#4a7c59" : "#faf8f3", color: filters[f.key] ? "#fff" : "#3a3028", cursor: "pointer", fontWeight: filters[f.key] ? 700 : 400 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* LEGEND */}
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#8a7a6a", marginBottom: 12, flexWrap: "wrap" }}>
          <span>⛺ Recreation.gov — click Reserve button for live availability</span>
          <span>🏞️ OC Parks — manual reservation link</span>
        </div>

        {/* CAMP CARDS */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#8a7a6a" }}>Loading campgrounds…</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#8a7a6a" }}>No campgrounds match your filters.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sorted.map(camp => (
              <CampCard
                key={camp.id}
                camp={camp}
                avail={availability[camp.id]}
                expanded={expanded === camp.id}
                onExpand={handleExpand}
                eBirdKey={EBIRD_KEY}
              />
            ))}
          </div>
        )}

        {/* FOOTER */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#8a7a6a", marginTop: 24, lineHeight: 1.8 }}>
          Live availability from <a href="https://recreation.gov" target="_blank" rel="noopener noreferrer" style={{ color: "#2d6a8f" }}>Recreation.gov</a> · Bird data from <a href="https://ebird.org" target="_blank" rel="noopener noreferrer" style={{ color: "#2d6a8f" }}>eBird</a> · Species ID via <a href="https://merlin.allaboutbirds.org" target="_blank" rel="noopener noreferrer" style={{ color: "#2d6a8f" }}>Merlin</a><br />
          OC Parks sites (Caspers, O'Neill) require direct reservation — no live availability data available.
        </p>
      </div>
      <style>{`* { box-sizing: border-box; } button:hover { opacity: 0.85; }`}</style>
    </div>
  );
}
