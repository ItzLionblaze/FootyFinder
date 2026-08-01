"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = { lat: 33.9636, lng: -117.5642 };
let mapsPromise;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google);
  }

  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const finishOk = () => resolve(window.google);
      const finishErr = (message) => {
        mapsPromise = null;
        reject(new Error(message));
      };

      const existingScript = document.querySelector(
        'script[data-footyfinder-google-maps="true"]',
      );
      if (existingScript) {
        if (window.google?.maps?.importLibrary) {
          finishOk();
          return;
        }
        existingScript.addEventListener("load", () => {
          if (window.google?.maps?.importLibrary) {
            finishOk();
          } else {
            finishErr("Google Maps script loaded without the Maps API");
          }
        });
        existingScript.addEventListener("error", () =>
          finishErr("Google Maps script failed to load"),
        );
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      script.async = true;
      script.dataset.footyfinderGoogleMaps = "true";
      script.onload = () => {
        if (window.google?.maps?.importLibrary) {
          finishOk();
        } else {
          finishErr(
            "Google Maps loaded, but the API is unavailable. Check billing and API enablement.",
          );
        }
      };
      script.onerror = () => finishErr("Google Maps script failed to load");
      document.head.appendChild(script);
    });
  }

  return mapsPromise;
}

function getPostalCode(addressComponents = []) {
  return (
    addressComponents.find((component) =>
      component.types?.includes("postal_code"),
    )?.long_name || ""
  );
}

export default function ParkPicker({ value, onChange }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [loadError, setLoadError] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [areaHint, setAreaHint] = useState("");
  const [areaSearching, setAreaSearching] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  function goToArea(event) {
    event?.preventDefault?.();
    const query = areaQuery.trim();
    if (!query || !geocoderRef.current || !mapRef.current) {
      return;
    }

    setAreaSearching(true);
    setLoadError("");
    setAreaHint("");

    geocoderRef.current.geocode(
      { address: query, region: "us" },
      (results, status) => {
        setAreaSearching(false);
        if (status !== "OK" || !results?.[0]) {
          setLoadError(
            "Could not find that city or zip code. Try another search.",
          );
          return;
        }

        const result = results[0];
        if (result.geometry.viewport) {
          mapRef.current.fitBounds(result.geometry.viewport);
        } else {
          mapRef.current.panTo(result.geometry.location);
          mapRef.current.setZoom(13);
        }

        setAreaHint(
          `Showing ${result.formatted_address}. Click the map to drop a pin on the park.`,
        );
      },
    );
  }

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    let cancelled = false;
    let mapClickListener;

    loadGoogleMaps(apiKey)
      .then(async (google) => {
        if (cancelled || !mapElementRef.current) {
          return;
        }

        const { Map } = await google.maps.importLibrary("maps");

        if (cancelled || !mapElementRef.current) {
          return;
        }

        const startCenter =
          value.latitude != null && value.longitude != null
            ? { lat: value.latitude, lng: value.longitude }
            : DEFAULT_CENTER;

        const map = new Map(mapElementRef.current, {
          center: startCenter,
          zoom: value.latitude != null ? 15 : 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        geocoderRef.current = new google.maps.Geocoder();

        const marker = new google.maps.Marker({
          map: value.latitude != null ? map : null,
          position: startCenter,
        });
        markerRef.current = marker;

        mapClickListener = map.addListener("click", (event) => {
          const position = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };
          marker.setMap(map);
          marker.setPosition(position);

          geocoderRef.current.geocode(
            { location: position },
            (results, status) => {
              const result = status === "OK" ? results?.[0] : null;
              const address =
                result?.formatted_address || "Pinned park location";
              onChangeRef.current({
                location:
                  result?.address_components?.[0]?.long_name || address,
                zip_code: getPostalCode(result?.address_components),
                latitude: position.lat,
                longitude: position.lng,
                place_id: result?.place_id || "",
                place_address: address,
              });
              setAreaHint("");
              setLoadError("");
            },
          );
        });
      })
      .catch((error) => {
        if (!cancelled) {
          const detail =
            error?.message ||
            "Check your API key, billing, and enabled APIs.";
          setLoadError(`Google Maps could not load. ${detail}`);
          console.error("FootyFinder Maps load error:", error);
        }
      });

    return () => {
      cancelled = true;
      mapClickListener?.remove();
    };
    // Initial map mount only — selected pin is synced in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) {
      return;
    }
    if (value.latitude == null || value.longitude == null) {
      markerRef.current.setMap(null);
      return;
    }

    const position = { lat: value.latitude, lng: value.longitude };
    markerRef.current.setMap(mapRef.current);
    markerRef.current.setPosition(position);
  }, [value.latitude, value.longitude]);

  if (!apiKey) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to{" "}
        <code>frontend/.env.local</code> to enable park search and map pinning.
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="area-search"
        className="block text-sm font-medium text-zinc-700"
      >
        Search city or zip code
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="area-search"
          type="search"
          value={areaQuery}
          onChange={(event) => setAreaQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              goToArea(event);
            }
          }}
          placeholder="e.g. 92880 or Corona, CA"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
        />
        <button
          type="button"
          onClick={goToArea}
          disabled={areaSearching || !areaQuery.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {areaSearching ? "Going..." : "Go"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Search a city or zip, then click the map to drop a pin on the park.
      </p>
      {areaHint && <p className="mt-2 text-sm text-green-800">{areaHint}</p>}

      <div
        ref={mapElementRef}
        className="mt-3 h-80 w-full overflow-hidden rounded-lg border border-zinc-300 bg-zinc-100"
        aria-label="Map for selecting a park"
      />
      {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}
      {value.latitude != null && (
        <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-900">
          <span className="font-semibold">Selected:</span> {value.location}
          {value.place_address && value.place_address !== value.location
            ? ` — ${value.place_address}`
            : ""}
        </div>
      )}
    </div>
  );
}
