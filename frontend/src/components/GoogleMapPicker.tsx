import { useEffect, useRef, useState, type FormEvent } from "react";
import { Crosshair, MapPin, Search } from "lucide-react";

declare global { interface Window { L?: any } }
type MapSelection = { address: string; latitude: number; longitude: number };
type Props = { country: string; value: MapSelection | null; onChange: (selection: MapSelection) => void };

const COUNTRY_VIEW: Record<string, { center: [number, number]; zoom: number }> = {
  "South Korea": { center: [36.5, 127.8], zoom: 7 }, "United States": { center: [39.5, -98.35], zoom: 4 },
  "United Kingdom": { center: [54.5, -3.2], zoom: 6 }, Uzbekistan: { center: [41.3, 64.6], zoom: 5 },
  Japan: { center: [36.2, 138.25], zoom: 5 }, Canada: { center: [56.1, -106.3], zoom: 3 },
  Australia: { center: [-25.3, 133.8], zoom: 4 }, Germany: { center: [51.2, 10.45], zoom: 6 },
  France: { center: [46.2, 2.2], zoom: 6 }, Italy: { center: [41.9, 12.5], zoom: 6 },
  Netherlands: { center: [52.1, 5.3], zoom: 7 }, Singapore: { center: [1.35, 103.82], zoom: 11 },
  "All countries": { center: [20, 0], zoom: 2 }
};

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({ format: "jsonv2", lat: String(lat), lon: String(lon) }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error("Address lookup is temporarily unavailable.");
  const data = await response.json();
  return data.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export default function GoogleMapPicker({ country, value, onChange }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!document.querySelector('link[data-findit-leaflet]')) {
        const link = document.createElement("link"); link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; link.dataset.finditLeaflet = "true";
        document.head.appendChild(link);
      }
      if (!window.L) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>('script[data-findit-leaflet]');
          if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("Could not load map library.")), { once: true }); return; }
          const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.dataset.finditLeaflet = "true"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Could not load map library."));
          document.head.appendChild(script);
        });
      }
      if (!cancelled) setReady(true);
    };
    load().catch((error) => setLoadError(error.message || "Map could not load."));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !mapElement.current || !window.L) return;
    const L = window.L; const view = COUNTRY_VIEW[country] ?? COUNTRY_VIEW["South Korea"];
    if (!mapRef.current) {
      const map = L.map(mapElement.current).setView(value ? [value.latitude, value.longitude] : view.center, value ? 16 : view.zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
      map.on("click", (event: any) => { void choosePoint(event.latlng.lat, event.latlng.lng); });
      mapRef.current = map;
    } else if (!value) mapRef.current.setView(view.center, view.zoom);
    if (value) setMarker(value.latitude, value.longitude);
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [ready, country]);

  function setMarker(lat: number, lon: number) {
    if (!mapRef.current || !window.L) return;
    if (!markerRef.current) markerRef.current = window.L.marker([lat, lon], { draggable: true }).addTo(mapRef.current);
    else markerRef.current.setLatLng([lat, lon]);
    markerRef.current.off("dragend");
    markerRef.current.on("dragend", (event: any) => { const point = event.target.getLatLng(); void choosePoint(point.lat, point.lng); });
  }

  async function choosePoint(lat: number, lon: number) {
    setMarker(lat, lon);
    let address = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    try { address = await reverseGeocode(lat, lon); } catch { /* coordinates remain a valid location */ }
    setQuery(address); onChangeRef.current({ address, latitude: lat, longitude: lon });
  }

  async function searchAddress() {
    if (!query.trim()) return;
    setSearching(true); setLoadError("");
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.search = new URLSearchParams({ q: query.trim(), format: "jsonv2", limit: "1" }).toString();
      const response = await fetch(url); if (!response.ok) throw new Error("Address search is temporarily unavailable.");
      const results = await response.json(); if (!results.length) throw new Error("No matching address was found.");
      const result = results[0]; const lat = Number(result.lat); const lon = Number(result.lon);
      mapRef.current?.setView([lat, lon], 16); await choosePoint(lat, lon);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Could not find that address."); }
    finally { setSearching(false); }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setLoadError("Your browser does not support location access."); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      mapRef.current?.setView([coords.latitude, coords.longitude], 16); void choosePoint(coords.latitude, coords.longitude);
    }, () => setLoadError("Location permission was not granted. You can still search or click the map."), { enableHighAccuracy: true, timeout: 10000 });
  }

  useEffect(() => { if (value) setQuery(value.address); }, [value?.address]);

  return <div className="google-location-picker">
    <div className="map-search-row">
      <div className="map-address-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchAddress();
            }
          }}
          placeholder={`Search a place in ${country}...`}
          aria-label="Search map location"
        />
        <button type="button" onClick={() => void searchAddress()} disabled={searching || !ready}>
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
      <button className="map-current-location" type="button" onClick={useMyLocation} disabled={!ready}><Crosshair size={16} /> Use my location</button>
    </div>
    {loadError && <p className="map-status map-error" role="status">{loadError}</p>}
    {!ready && !loadError && <p className="map-status">Loading OpenStreetMap…</p>}
    <div ref={mapElement} className="google-map-canvas" aria-label="Choose the item location on OpenStreetMap" />
    <div className="map-selection-caption"><MapPin size={16} /><span>{value ? value.address : "Click the map to drop a pin, or search for an address."}</span></div>
  </div>;
}
