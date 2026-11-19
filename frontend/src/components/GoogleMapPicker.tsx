import { useEffect, useRef, useState, type FormEvent } from "react";
import { Crosshair, MapPin, Search } from "lucide-react";

declare global {
  interface Window {
    google?: any;
    initFindItGoogleMap?: () => void;
  }
}

type MapSelection = { address: string; latitude: number; longitude: number };

const COUNTRY_VIEW: Record<string, { center: { lat: number; lng: number }; zoom: number; code: string }> = {
  "South Korea": { center: { lat: 36.5, lng: 127.8 }, zoom: 7, code: "kr" },
  "United States": { center: { lat: 39.5, lng: -98.35 }, zoom: 4, code: "us" },
  "United Kingdom": { center: { lat: 54.5, lng: -3.2 }, zoom: 6, code: "gb" },
  Uzbekistan: { center: { lat: 41.3, lng: 64.6 }, zoom: 5, code: "uz" },
  Japan: { center: { lat: 36.2, lng: 138.25 }, zoom: 5, code: "jp" },
  Canada: { center: { lat: 56.1, lng: -106.3 }, zoom: 3, code: "ca" },
  Australia: { center: { lat: -25.3, lng: 133.8 }, zoom: 4, code: "au" },
  Germany: { center: { lat: 51.2, lng: 10.45 }, zoom: 6, code: "de" },
  France: { center: { lat: 46.2, lng: 2.2 }, zoom: 6, code: "fr" },
  Italy: { center: { lat: 41.9, lng: 12.5 }, zoom: 6, code: "it" },
  Spain: { center: { lat: 40.4, lng: -3.7 }, zoom: 6, code: "es" },
  Netherlands: { center: { lat: 52.1, lng: 5.3 }, zoom: 7, code: "nl" },
  Switzerland: { center: { lat: 46.8, lng: 8.2 }, zoom: 7, code: "ch" },
  Sweden: { center: { lat: 60.1, lng: 18.6 }, zoom: 5, code: "se" },
  Norway: { center: { lat: 60.5, lng: 8.5 }, zoom: 5, code: "no" },
  Malaysia: { center: { lat: 4.2, lng: 102 }, zoom: 5, code: "my" },
  Türkiye: { center: { lat: 39, lng: 35.2 }, zoom: 5, code: "tr" },
  India: { center: { lat: 20.6, lng: 78.9 }, zoom: 4, code: "in" },
  China: { center: { lat: 35.9, lng: 104.2 }, zoom: 4, code: "cn" },
  Brazil: { center: { lat: -10.8, lng: -52.9 }, zoom: 4, code: "br" },
  Mexico: { center: { lat: 23.6, lng: -102.5 }, zoom: 5, code: "mx" },
  "New Zealand": { center: { lat: -41.3, lng: 174.8 }, zoom: 5, code: "nz" },
  Singapore: { center: { lat: 1.35, lng: 103.82 }, zoom: 11, code: "sg" },
  "United Arab Emirates": { center: { lat: 24.2, lng: 54.4 }, zoom: 6, code: "ae" },
  "All countries": { center: { lat: 20, lng: 0 }, zoom: 2, code: "" },
};

const DEFAULT_VIEW = COUNTRY_VIEW["South Korea"];

type Props = {
  country: string;
  value: MapSelection | null;
  onChange: (selection: MapSelection) => void;
};

export default function GoogleMapPicker({ country, value, onChange }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) {
      setLoadError("Google Maps API key is not configured yet. Add VITE_GOOGLE_MAPS_API_KEY to the deployment environment.");
      return;
    }
    if (window.google?.maps) {
      setReady(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-findit-google-maps="true"]');
    if (existing) {
      existing.addEventListener("load", () => setReady(true), { once: true });
      existing.addEventListener("error", () => setLoadError("Google Maps could not load. Check your API key and enabled APIs."), { once: true });
      return;
    }

    window.initFindItGoogleMap = () => setReady(true);
    const script = document.createElement("script");
    script.dataset.finditGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initFindItGoogleMap&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setLoadError("Google Maps could not load. Check your API key, billing and website restrictions.");
    document.head.appendChild(script);
    return () => { delete window.initFindItGoogleMap; };
  }, []);

  useEffect(() => {
    if (!ready || !mapElement.current || !window.google?.maps) return;
    const maps = window.google.maps;
    const view = COUNTRY_VIEW[country] ?? DEFAULT_VIEW;
    if (!mapRef.current) {
      mapRef.current = new maps.Map(mapElement.current, {
        center: value ? { lat: value.latitude, lng: value.longitude } : view.center,
        zoom: value ? 16 : view.zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
      });
      geocoderRef.current = new maps.Geocoder();
      mapRef.current.addListener("click", (event: any) => {
        if (typeof event.latLng?.lat !== "function") return;
        void selectPoint(event.latLng.lat(), event.latLng.lng());
      });
    } else {
      mapRef.current.setCenter(view.center);
      mapRef.current.setZoom(view.zoom);
    }
    if (value) {
      placeMarker(value.latitude, value.longitude);
    }
  }, [ready, country]);

  function placeMarker(latitude: number, longitude: number) {
    if (!mapRef.current || !window.google?.maps) return;
    const maps = window.google.maps;
    const position = { lat: latitude, lng: longitude };
    if (!markerRef.current) {
      markerRef.current = new maps.Marker({
        position,
        map: mapRef.current,
        draggable: true,
        title: "Selected lost/found location",
      });
      markerRef.current.addListener("dragend", (event: any) => {
        void selectPoint(event.latLng.lat(), event.latLng.lng());
      });
    } else {
      markerRef.current.setPosition(position);
      markerRef.current.setMap(mapRef.current);
    }
  }

  async function selectPoint(latitude: number, longitude: number) {
    placeMarker(latitude, longitude);
    const view = COUNTRY_VIEW[country] ?? DEFAULT_VIEW;
    try {
      const result = await geocoderRef.current?.geocode({
        location: { lat: latitude, lng: longitude },
        ...(view.code ? { componentRestrictions: { country: view.code } } : {}),
      });
      const address = result?.results?.[0]?.formatted_address ?? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      setQuery(address);
      onChangeRef.current({ address, latitude, longitude });
    } catch {
      const address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      setQuery(address);
      onChangeRef.current({ address, latitude, longitude });
    }
  }

  async function searchAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || !geocoderRef.current) return;
    setSearching(true);
    setLoadError("");
    const view = COUNTRY_VIEW[country] ?? DEFAULT_VIEW;
    try {
      const response = await geocoderRef.current.geocode({
        address: query.trim(),
        ...(view.code ? { componentRestrictions: { country: view.code } } : {}),
      });
      const result = response.results?.[0];
      if (!result) throw new Error("No matching address was found.");
      const location = result.geometry.location;
      const latitude = location.lat();
      const longitude = location.lng();
      mapRef.current?.setCenter({ lat: latitude, lng: longitude });
      mapRef.current?.setZoom(16);
      placeMarker(latitude, longitude);
      const address = result.formatted_address;
      setQuery(address);
      onChangeRef.current({ address, latitude, longitude });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not find that address.");
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLoadError("Your browser does not support location access.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        mapRef.current?.setCenter({ lat: latitude, lng: longitude });
        mapRef.current?.setZoom(16);
        void selectPoint(latitude, longitude);
      },
      () => setLoadError("Location permission was not granted. You can still search or click the map."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    if (value) setQuery(value.address);
  }, [value?.address]);

  return (
    <div className="google-location-picker">
      <div className="map-search-row">
        <form className="map-address-search" onSubmit={searchAddress}>
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search a place in ${country}...`} aria-label="Search map location" />
          <button type="submit" disabled={searching || !ready}>{searching ? "Searching…" : "Search"}</button>
        </form>
        <button className="map-current-location" type="button" onClick={useMyLocation} disabled={!ready}><Crosshair size={16} /> Use my location</button>
      </div>
      {loadError && <p className="map-status map-error" role="status">{loadError}</p>}
      {!ready && !loadError && <p className="map-status">Loading Google Maps…</p>}
      <div ref={mapElement} className="google-map-canvas" aria-label="Choose the item location on Google Maps" />
      <div className="map-selection-caption">
        <MapPin size={16} />
        <span>{value ? value.address : "Click the map to drop a pin, or search for an address."}</span>
      </div>
    </div>
  );
}
