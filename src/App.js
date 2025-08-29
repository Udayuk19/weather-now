import logo from './logo.svg';
import './App.css';

import React, { useEffect, useMemo, useRef, useState } from "react";

// Weather code mapping per Open‑Meteo WMO codes
const WEATHER_CODES = {
  0: { label: "Clear sky", emoji: "☀️" },
  1: { label: "Mainly clear", emoji: "🌤️" },
  2: { label: "Partly cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Fog", emoji: "🌫️" },
  48: { label: "Depositing rime fog", emoji: "🌫️" },
  51: { label: "Light drizzle", emoji: "🌦️" },
  53: { label: "Moderate drizzle", emoji: "🌦️" },
  55: { label: "Dense drizzle", emoji: "🌧️" },
  56: { label: "Light freezing drizzle", emoji: "🌧️" },
  57: { label: "Dense freezing drizzle", emoji: "🌧️" },
  61: { label: "Light rain", emoji: "🌦️" },
  63: { label: "Moderate rain", emoji: "🌧️" },
  65: { label: "Heavy rain", emoji: "🌧️" },
  66: { label: "Light freezing rain", emoji: "🌧️" },
  67: { label: "Heavy freezing rain", emoji: "🌧️" },
  71: { label: "Light snowfall", emoji: "🌨️" },
  73: { label: "Moderate snowfall", emoji: "🌨️" },
  75: { label: "Heavy snowfall", emoji: "❄️" },
  77: { label: "Snow grains", emoji: "❄️" },
  80: { label: "Light rain showers", emoji: "🌦️" },
  81: { label: "Moderate rain showers", emoji: "🌧️" },
  82: { label: "Violent rain showers", emoji: "🌧️" },
  85: { label: "Light snow showers", emoji: "🌨️" },
  86: { label: "Heavy snow showers", emoji: "❄️" },
  95: { label: "Thunderstorm", emoji: "⛈️" },
  96: { label: "Thunderstorm w/ hail", emoji: "⛈️" },
  99: { label: "Heavy thunderstorm w/ hail", emoji: "⛈️" }
};

function codeToInfo(code) {
  return WEATHER_CODES[code] || { label: "Unknown", emoji: "❓" };
}

function ccToFlag(cc) {
  if (!cc) return "";
  const codePoints = cc
    .trim()
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

function WindArrow({ deg }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        className="h-6 w-6 transform"
        style={{ rotate: `${deg}deg` }}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2l4 8h-3v12h-2V10H8l4-8z" strokeWidth="0" />
      </svg>
      <span className="text-sm text-gray-600">{Math.round(deg)}°</span>
    </div>
  );
}

const UNIT_PRESETS = {
  metric: {
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm"
  },
  imperial: {
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch"
  }
};

export default function WeatherNowApp() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [current, setCurrent] = useState(null); // { data, units }
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [error, setError] = useState("");
  const [unit, setUnit] = useState("metric");
  const debounceRef = useRef(null);

  // Load last place from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("weathernow:lastPlace");
    if (saved) {
      const place = JSON.parse(saved);
      setSelectedPlace(place);
      fetchWeather(place);
      setQuery(`${place.name}${place.admin1 ? `, ${place.admin1}` : ""}`);
    }
  }, []);

  // Re-fetch when unit toggles and we have a place
  useEffect(() => {
    if (selectedPlace) fetchWeather(selectedPlace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  function onChangeQuery(val) {
    setQuery(val);
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val || val.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val.trim());
    }, 350);
  }

  async function fetchSuggestions(name) {
    try {
      setLoadingSuggest(true);
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", name);
      url.searchParams.set("count", "6");
      url.searchParams.set("language", "en");
      url.searchParams.set("format", "json");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Geocoding failed");
      const data = await res.json();
      setSuggestions(data.results || []);
    } catch (e) {
      setSuggestions([]);
    } finally {
      setLoadingSuggest(false);
    }
  }

  async function fetchWeather(place) {
    try {
      setLoadingWeather(true);
      setError("");
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", place.latitude);
      url.searchParams.set("longitude", place.longitude);
      url.searchParams.set(
        "current",
        [
          "temperature_2m",
          "apparent_temperature",
          "relativehumidity_2m",
          "precipitation",
          "weather_code",
          "wind_speed_10m",
          "wind_direction_10m",
          "is_day"
        ].join(",")
      );
      url.searchParams.set("timezone", "auto");
      const preset = UNIT_PRESETS[unit] || UNIT_PRESETS.metric;
      Object.entries(preset).forEach(([k, v]) => url.searchParams.set(k, v));

      const res = await fetch(url);
      if (!res.ok) throw new Error("Weather fetch failed");
      const data = await res.json();
      const { current: cur, current_units: units } = data;
      if (!cur) throw new Error("No current weather in response");
      setCurrent({ data: cur, units, tz: data.timezone, tzAbbr: data.timezone_abbreviation });
      setSelectedPlace(place);
      localStorage.setItem("weathernow:lastPlace", JSON.stringify(place));
      // Save to recents
      const recents = JSON.parse(localStorage.getItem("weathernow:recents") || "[]");
      const withoutDup = [place, ...recents.filter((p) => p.id !== place.id)].slice(0, 6);
      localStorage.setItem("weathernow:recents", JSON.stringify(withoutDup));
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoadingWeather(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (suggestions.length > 0) {
      onSelectPlace(suggestions[0]);
    } else if (query.trim().length >= 3) {
      // fetch suggestions and then select top
      fetchSuggestions(query.trim()).then(() => {
        setTimeout(() => {
          if (suggestions.length > 0) onSelectPlace(suggestions[0]);
        }, 100);
      });
    }
  }

  function onSelectPlace(place) {
    setSuggestions([]);
    setQuery(`${place.name}${place.admin1 ? `, ${place.admin1}` : ""}`);
    fetchWeather(place);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setError("");
    setLoadingWeather(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode for a nice place label
        try {
          const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
          url.searchParams.set("latitude", latitude);
          url.searchParams.set("longitude", longitude);
          url.searchParams.set("language", "en");
          const res = await fetch(url);
          const data = await res.json();
          
          const place = data && data.results && data.results[0]
            ? data.results[0]
            : { id: "here", name: "Current Location", latitude, longitude };
          onSelectPlace(place);
        } catch (e) {
          onSelectPlace({ id: "here", name: "Current Location", latitude, longitude });
        }
      },
      (err) => {
        setLoadingWeather(false);
        setError(err.message || "Failed to get location");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  const recents = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("weathernow:recents") || "[]");
    } catch {
      return [];
    }
  }, [selectedPlace]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-50 to-white text-gray-900">
      <div className="mx-auto max-w-2xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Weather Now <span className="text-sky-600">for Jamie</span></h1>
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 p-1 shadow-sm">
            <button
              onClick={() => setUnit("metric")}
              className={`px-3 py-1.5 text-sm rounded-2xl ${unit === "metric" ? "bg-sky-600 text-white" : "hover:bg-gray-100"}`}
              aria-pressed={unit === "metric"}
            >°C</button>
            <button
              onClick={() => setUnit("imperial")}
              className={`px-3 py-1.5 text-sm rounded-2xl ${unit === "imperial" ? "bg-sky-600 text-white" : "hover:bg-gray-100"}`}
              aria-pressed={unit === "imperial"}
            >°F</button>
          </div>
        </header>

        <form onSubmit={onSubmit} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => onChangeQuery(e.target.value)}
              placeholder="Search a city (e.g., Delhi, Paris, Tokyo)"
              className="w-full rounded-2xl border border-gray-200 bg-white/90 p-3 pr-10 shadow-sm outline-none ring-sky-300 focus:ring"
            />
            {loadingSuggest && (
              <div className="absolute right-3 top-3 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
            )}
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => onSelectPlace(s)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-sky-50"
                  >
                    <div>
                      <div className="font-medium">{s.name} {s.admin1 ? `, ${s.admin1}` : ""}</div>
                      <div className="text-xs text-gray-600">{s.country} {s.country_code ? ccToFlag(s.country_code) : ""}</div>
                    </div>
                    <div className="text-xs text-gray-500">{s.latitude.toFixed(2)}, {s.longitude.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >Get Weather</button>
          <button
            type="button"
            onClick={useMyLocation}
            className="rounded-2xl bg-white px-4 py-3 font-semibold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50"
          >Use my location</button>
        </form>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
        )}

        {recents.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Recent:</span>
            {recents.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelectPlace(r)}
                className="rounded-full bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
                title={`${r.name}${r.admin1 ? `, ${r.admin1}` : ""}`}
              >
                {r.name}{r.country_code ? ` ${ccToFlag(r.country_code)}` : ""}
              </button>
            ))}
          </div>
        )}

        <main>
          {loadingWeather && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 h-6 w-40 animate-pulse rounded bg-gray-200" />
              <div className="mb-6 h-8 w-64 animate-pulse rounded bg-gray-200" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            </div>
          )}

          {!loadingWeather && current && selectedPlace && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-1 text-sm text-gray-600">
                {selectedPlace.country_code ? ccToFlag(selectedPlace.country_code) + " " : ""}
                {selectedPlace.name}{selectedPlace.admin1 ? `, ${selectedPlace.admin1}` : ""}
                {selectedPlace.country ? ` • ${selectedPlace.country}` : ""}
              </div>
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <div className="text-5xl font-bold leading-none">
                    {Math.round(current.data.temperature_2m)}
                    <span className="ml-1 text-2xl align-top">{current.units.temperature_2m}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-lg text-gray-700">
                    <span>{codeToInfo(current.data.weather_code).emoji}</span>
                    <span>{codeToInfo(current.data.weather_code).label}</span>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  Updated: {new Date(current.data.time).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", year: "numeric", month: "short", day: "2-digit" })}
                  {current.tzAbbr ? ` ${current.tzAbbr}` : ""}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-sky-50 p-4">
                  <div className="text-xs text-gray-600">Feels Like</div>
                  <div className="text-xl font-semibold">{Math.round(current.data.apparent_temperature)} {current.units.apparent_temperature}</div>
                </div>
                <div className="rounded-xl bg-sky-50 p-4">
                  <div className="text-xs text-gray-600">Humidity</div>
                  <div className="text-xl font-semibold">{Math.round(current.data.relativehumidity_2m)} {current.units.relativehumidity_2m}</div>
                </div>
                <div className="rounded-xl bg-sky-50 p-4">
                  <div className="text-xs text-gray-600">Precipitation</div>
                  <div className="text-xl font-semibold">{current.data.precipitation ?? 0} {current.units.precipitation}</div>
                </div>
                <div className="rounded-xl bg-sky-50 p-4">
                  <div className="text-xs text-gray-600">Wind Speed</div>
                  <div className="text-xl font-semibold">{Math.round(current.data.wind_speed_10m)} {current.units.wind_speed_10m}</div>
                </div>
                <div className="rounded-xl bg-sky-50 p-4">
                  <div className="text-xs text-gray-600">Wind Direction</div>
                  <div className="flex items-center gap-2">
                    <WindArrow deg={current.data.wind_direction_10m} />
                  </div>
                </div>
                <div className="rounded-xl bg-sky-50 p-4">
                  <div className="text-xs text-gray-600">Daylight</div>
                  <div className="text-xl font-semibold">{current.data.is_day ? "Day" : "Night"}</div>
                </div>
              </div>
            </div>
          )}

          {!loadingWeather && !current && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-gray-600">
              Enter a city to see the current weather.
            </div>
          )}
        </main>

        <footer className="mt-8 text-center text-xs text-gray-500">
          Data by Open‑Meteo • Built for fast city lookups • No API key required
        </footer>
      </div>
    </div>
  );
}
