"use client";

import { useEffect, useRef, useState } from "react";

const EASTVALE_CENTER = { lat: 33.9636, lng: -117.5642 };
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
      // Avoid loading=async — onload can fire before Map is ready.
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
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
      component.types.includes("postal_code"),
    )?.longText ||
    addressComponents.find((component) =>
      component.types.includes("postal_code"),
    )?.long_name ||
    ""
  );
}

export default function ParkPicker({ value, onChange }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapElementRef = useRef(null);
  const searchContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    let cancelled = false;
    let mapClickListener;
    let autocompleteElement;
    let selectPlace;

    loadGoogleMaps(apiKey)
      .then(async (google) => {
        if (cancelled || !mapElementRef.current || !searchContainerRef.current) {
          return;
        }

        const { Map } = await google.maps.importLibrary("maps");
        const { PlaceAutocompleteElement } =
          await google.maps.importLibrary("places");

        if (cancelled || !mapElementRef.current || !searchContainerRef.current) {
          return;
        }

        const map = new Map(mapElementRef.current, {
          center: EASTVALE_CENTER,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;

        const marker = new google.maps.Marker({
          map: null,
          position: EASTVALE_CENTER,
        });
        markerRef.current = marker;

        autocompleteElement = new PlaceAutocompleteElement({
          includedPrimaryTypes: ["park"],
          includedRegionCodes: ["us"],
          locationBias: { center: EASTVALE_CENTER, radius: 50000 },
        });
        autocompleteElement.placeholder = "Search parks near Eastvale";
        autocompleteElement.style.width = "100%";
        searchContainerRef.current.replaceChildren(autocompleteElement);

        selectPlace = async (event) => {
          const place = event.placePrediction.toPlace();
          await place.fetchFields({
            fields: [
              "addressComponents",
              "displayName",
              "formattedAddress",
              "location",
            ],
          });

          if (!place.location) {
            setLoadError("Choose a park from the search suggestions.");
            return;
          }

          const position = {
            lat: place.location.lat(),
            lng: place.location.lng(),
          };
          marker.setMap(map);
          marker.setPosition(position);
          map.panTo(position);
          map.setZoom(16);
          setLoadError("");
          onChangeRef.current({
            location: place.displayName || place.formattedAddress,
            zip_code: getPostalCode(place.addressComponents),
            latitude: position.lat,
            longitude: position.lng,
            place_id: place.id || "",
            place_address: place.formattedAddress || "",
          });
        };
        autocompleteElement.addEventListener("gmp-select", selectPlace);

        const geocoder = new google.maps.Geocoder();
        mapClickListener = map.addListener("click", (event) => {
          const position = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };
          marker.setMap(map);
          marker.setPosition(position);

          geocoder.geocode({ location: position }, (results, status) => {
            const result = status === "OK" ? results?.[0] : null;
            const address = result?.formatted_address || "Pinned park location";
            onChangeRef.current({
              location: result?.address_components?.[0]?.long_name || address,
              zip_code: getPostalCode(result?.address_components),
              latitude: position.lat,
              longitude: position.lng,
              place_id: result?.place_id || "",
              place_address: address,
            });
          });
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
      if (autocompleteElement && selectPlace) {
        autocompleteElement.removeEventListener("gmp-select", selectPlace);
      }
    };
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
        htmlFor="park-search"
        className="block text-sm font-medium text-zinc-700"
      >
        Search for a park
      </label>
      <div
        ref={searchContainerRef}
        id="park-search"
        className="mt-1 min-h-12 w-full"
      />
      <p className="mt-2 text-xs text-zinc-500">
        Choose a search result or click the map to place the game pin.
      </p>
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
