"use client";

import { useEffect, useState } from "react";
import LoginButton from "./components/LoginButton";
import ParkPicker from "./components/ParkPicker";
import { useAuth } from "./context/AuthContext";

const API_URL = "http://localhost:8000";
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const AGE_RANGES = ["12+", "18+", "12-17"];
const STATUS_STYLES = {
  looking_for_players: {
    label: "Looking for players",
    className: "bg-amber-100 text-amber-900",
  },
  confirmed: {
    label: "Confirmed · still open",
    className: "bg-green-100 text-green-800",
  },
  full: {
    label: "Confirmed · full",
    className: "bg-blue-100 text-blue-800",
  },
  completed: {
    label: "Completed",
    className: "bg-zinc-200 text-zinc-700",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700",
  },
};

function getHost(game) {
  const host = game.player_names?.find((player) => player.is_host);
  return host || game.player_names?.[0] || null;
}

export default function Home() {
  const { user, accessToken, authLoading } = useAuth();
  const [apiStatus, setApiStatus] = useState("checking");
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    first_name: "",
    last_name: "",
    skill_level: "Intermediate",
    age_range: "18+",
    location: "",
    zip_code: "",
    latitude: null,
    longitude: null,
    place_id: "",
    place_address: "",
    date_time: "",
    min_players: 10,
    max_players: 20,
  });
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [cancellingGameId, setCancellingGameId] = useState(null);
  const [joiningGameId, setJoiningGameId] = useState(null);
  const [scoringGameId, setScoringGameId] = useState(null);
  const [scoreDrafts, setScoreDrafts] = useState({});
  const [gamesError, setGamesError] = useState("");
  const [searchZipCode, setSearchZipCode] = useState("");
  const [searchHostName, setSearchHostName] = useState("");
  const [recentParks, setRecentParks] = useState([]);
  const [showMapPicker, setShowMapPicker] = useState(false);

  async function loadGames(search = {}) {
    setGamesLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.zipCode?.trim()) {
        params.set("zip_code", search.zipCode.trim());
      }
      if (search.hostName?.trim()) {
        params.set("host_name", search.hostName.trim());
      }

      const query = params.toString();
      const url = query ? `${API_URL}/games?${query}` : `${API_URL}/games`;
      const response = await fetch(url);
      const data = await response.json();
      setGames(data);
    } catch {
      setGames([]);
    } finally {
      setGamesLoading(false);
    }
  }

  async function loadRecentParks(token = accessToken) {
    if (!token) {
      setRecentParks([]);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/parks/recent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Failed to load recent parks");
      }
      const data = await response.json();
      setRecentParks(Array.isArray(data) ? data : []);
    } catch {
      setRecentParks([]);
    }
  }

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((response) => response.json())
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus("offline"));

    loadGames();
  }, []);

  useEffect(() => {
    if (!user) {
      setRecentParks([]);
      setShowMapPicker(false);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      first_name: user.first_name || prev.first_name,
      last_name: user.last_name || prev.last_name,
    }));
    loadRecentParks();
  }, [user, accessToken]);

  function handleSearch(event) {
    event.preventDefault();
    loadGames({
      zipCode: searchZipCode,
      hostName: searchHostName,
    });
  }

  function handleClearSearch() {
    setSearchZipCode("");
    setSearchHostName("");
    loadGames();
  }

  function scrollToGames() {
    document.getElementById("games")?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollToCreateForm() {
    document.getElementById("create-game")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleInputChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "max_players" || name === "min_players" ? Number(value) : value,
    }));
  }

  function handleParkSelect(park) {
    setFormData((prev) => ({
      ...prev,
      ...park,
      zip_code: park.zip_code || prev.zip_code,
    }));
    setShowMapPicker(false);
  }

  function handleSelectRecentPark(park) {
    handleParkSelect(park);
  }

  async function handleCreateGame(event) {
    event.preventDefault();
    setFormError("");

    if (!accessToken) {
      setFormError("Sign in with Google before creating a game.");
      return;
    }

    if (
      !formData.title.trim() ||
      !formData.first_name.trim() ||
      !formData.last_name.trim() ||
      !formData.skill_level ||
      !formData.age_range ||
      !formData.location.trim() ||
      formData.latitude == null ||
      formData.longitude == null ||
      !formData.date_time ||
      !formData.min_players ||
      !formData.max_players
    ) {
      setFormError("Please fill in all fields and select a park on the map.");
      return;
    }

    if (formData.min_players < 2) {
      setFormError("Minimum players must be at least 2.");
      return;
    }

    if (formData.max_players > 30) {
      setFormError("Maximum players cannot be more than 30.");
      return;
    }

    if (formData.min_players > formData.max_players) {
      setFormError("Minimum players cannot be greater than maximum players.");
      return;
    }

    setFormSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          skill_level: formData.skill_level,
          age_range: formData.age_range,
          location: formData.location.trim(),
          zip_code: formData.zip_code.trim(),
          latitude: formData.latitude,
          longitude: formData.longitude,
          place_id: formData.place_id,
          place_address: formData.place_address,
          date_time: formData.date_time.replace("T", " "),
          min_players: formData.min_players,
          max_players: formData.max_players,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create game");
      }

      setFormData({
        title: "",
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        skill_level: "Intermediate",
        age_range: "18+",
        location: "",
        zip_code: "",
        latitude: null,
        longitude: null,
        place_id: "",
        place_address: "",
        date_time: "",
        min_players: 10,
        max_players: 20,
      });
      setShowMapPicker(false);

      await loadGames();
      await loadRecentParks();
      scrollToGames();
    } catch (error) {
      setFormError(error.message || "Could not create the game.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleCancelGame(gameId) {
    if (!accessToken || !window.confirm("Cancel this game?")) {
      return;
    }

    setCancellingGameId(gameId);
    setGamesError("");
    try {
      const response = await fetch(`${API_URL}/games/${gameId}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Could not cancel the game");
      }
      await loadGames({
        zipCode: searchZipCode,
        hostName: searchHostName,
      });
    } catch (error) {
      setGamesError(error.message || "Could not cancel the game.");
    } finally {
      setCancellingGameId(null);
    }
  }

  function userIsInGame(game) {
    if (!user) {
      return false;
    }
    if (game.host_user_id === user.id) {
      return true;
    }
    return (game.player_names || []).some(
      (player) => player.user_id === user.id,
    );
  }

  async function handleJoinGame(gameId) {
    if (!accessToken) {
      setGamesError("Sign in with Google to join a game.");
      return;
    }

    setJoiningGameId(gameId);
    setGamesError("");
    try {
      const response = await fetch(`${API_URL}/games/${gameId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Could not join the game");
      }
      await loadGames({
        zipCode: searchZipCode,
        hostName: searchHostName,
      });
    } catch (error) {
      setGamesError(error.message || "Could not join the game.");
    } finally {
      setJoiningGameId(null);
    }
  }

  function getScoreDraft(game) {
    return (
      scoreDrafts[game.id] || {
        score_team_a:
          game.score_team_a != null ? String(game.score_team_a) : "",
        score_team_b:
          game.score_team_b != null ? String(game.score_team_b) : "",
      }
    );
  }

  function handleScoreDraftChange(gameId, field, value) {
    setScoreDrafts((prev) => ({
      ...prev,
      [gameId]: {
        score_team_a: prev[gameId]?.score_team_a ?? "",
        score_team_b: prev[gameId]?.score_team_b ?? "",
        [field]: value,
      },
    }));
  }

  async function handleSaveScore(game) {
    if (!accessToken) {
      setGamesError("Sign in to post a score.");
      return;
    }

    const draft = getScoreDraft(game);
    const scoreTeamA = Number(draft.score_team_a);
    const scoreTeamB = Number(draft.score_team_b);

    if (
      draft.score_team_a === "" ||
      draft.score_team_b === "" ||
      Number.isNaN(scoreTeamA) ||
      Number.isNaN(scoreTeamB) ||
      scoreTeamA < 0 ||
      scoreTeamB < 0
    ) {
      setGamesError("Enter valid non-negative scores for both teams.");
      return;
    }

    setScoringGameId(game.id);
    setGamesError("");
    try {
      const response = await fetch(`${API_URL}/games/${game.id}/score`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          score_team_a: scoreTeamA,
          score_team_b: scoreTeamB,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Could not save the score");
      }
      setScoreDrafts((prev) => {
        const next = { ...prev };
        delete next[game.id];
        return next;
      });
      await loadGames({
        zipCode: searchZipCode,
        hostName: searchHostName,
      });
    } catch (error) {
      setGamesError(error.message || "Could not save the score.");
    } finally {
      setScoringGameId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <span className="text-xl font-bold text-green-700">FootyFinder</span>
          </div>
          <div className="flex items-center gap-3">
            <LoginButton />
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                apiStatus === "ok"
                  ? "bg-green-100 text-green-800"
                  : apiStatus === "checking"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              API: {apiStatus}
            </span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              Eastvale, CA
            </span>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-16 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Find pickup soccer games near you
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-600">
          FootyFinder helps players in Eastvale create and join local pickup
          soccer games. Sign in to host a game, then show up and play.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <button
            type="button"
            onClick={scrollToGames}
            className="rounded-lg bg-green-600 px-8 py-3 font-semibold text-white transition hover:bg-green-700"
          >
            View Games
          </button>
          <button
            type="button"
            onClick={scrollToCreateForm}
            className="rounded-lg border border-zinc-300 bg-white px-8 py-3 font-semibold text-zinc-800 transition hover:bg-zinc-50"
          >
            Create a Game
          </button>
        </div>

        <p className="mt-12 text-sm text-zinc-500">
          More cities coming soon. Starting with Eastvale, California.
        </p>
      </section>

      {/* Create game form */}
      <section id="create-game" className="border-t border-zinc-200 bg-zinc-50 py-12">
        <div className="mx-auto w-full max-w-4xl px-6">
          <h2 className="text-2xl font-bold text-zinc-900">Create a Game</h2>
          <p className="mt-1 text-zinc-600">
            Host a pickup game in Eastvale and invite others to join
          </p>

          <form
            onSubmit={handleCreateGame}
            className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
          >
            {!authLoading && !user && (
              <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Sign in with Google using the button at the top before creating
                a game. This lets only you cancel games that you host.
              </div>
            )}
            <p className="mb-5 text-sm font-medium text-zinc-700">Your info (game host)</p>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-zinc-700">
                  First name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="Alex"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-zinc-700">
                  Last name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Rivera"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label htmlFor="skill_level" className="block text-sm font-medium text-zinc-700">
                  Skill level
                </label>
                <select
                  id="skill_level"
                  name="skill_level"
                  value={formData.skill_level}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                >
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="age_range" className="block text-sm font-medium text-zinc-700">
                  Age range
                </label>
                <select
                  id="age_range"
                  name="age_range"
                  value={formData.age_range}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                >
                  {AGE_RANGES.map((range) => (
                    <option key={range} value={range}>
                      {range}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mb-5 mt-8 text-sm font-medium text-zinc-700">Game details</p>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="title" className="block text-sm font-medium text-zinc-700">
                  Game title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Saturday Morning Kickabout"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div className="sm:col-span-2">
                <p className="block text-sm font-medium text-zinc-700">
                  Park location
                </p>

                {recentParks.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-zinc-500">
                      Reuse a park you&apos;ve used before (no Google Maps charge)
                    </p>
                    <ul className="flex flex-col gap-2">
                      {recentParks.map((park) => {
                        const selected =
                          formData.latitude === park.latitude &&
                          formData.longitude === park.longitude &&
                          formData.location === park.location;

                        return (
                          <li key={`${park.place_id || park.latitude}-${park.longitude}`}>
                            <button
                              type="button"
                              onClick={() => handleSelectRecentPark(park)}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                selected
                                  ? "border-green-500 bg-green-50 text-green-900"
                                  : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                              }`}
                            >
                              <span className="font-medium">{park.location}</span>
                              {park.place_address &&
                              park.place_address !== park.location ? (
                                <span className="mt-0.5 block text-xs text-zinc-500">
                                  {park.place_address}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {formData.latitude != null && !showMapPicker && (
                  <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-900">
                    <span className="font-semibold">Selected:</span>{" "}
                    {formData.location}
                    {formData.place_address &&
                    formData.place_address !== formData.location
                      ? ` — ${formData.place_address}`
                      : ""}
                  </div>
                )}

                {!showMapPicker ? (
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="mt-3 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                  >
                    {formData.latitude != null || recentParks.length > 0
                      ? "Search a different park on the map"
                      : "Search or pin a park on the map"}
                  </button>
                ) : (
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-zinc-500">
                        Map search uses Google Maps (only opens when you need a
                        new park)
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowMapPicker(false)}
                        className="shrink-0 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                      >
                        Hide map
                      </button>
                    </div>
                    <ParkPicker value={formData} onChange={handleParkSelect} />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="date_time" className="block text-sm font-medium text-zinc-700">
                  Date and time
                </label>
                <input
                  id="date_time"
                  name="date_time"
                  type="datetime-local"
                  value={formData.date_time}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div>
                <label htmlFor="min_players" className="block text-sm font-medium text-zinc-700">
                  Minimum players to confirm
                </label>
                <input
                  id="min_players"
                  name="min_players"
                  type="number"
                  min="2"
                  max="30"
                  value={formData.min_players}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Game becomes confirmed once this many players join. More can
                  still join until the maximum.
                </p>
              </div>

              <div>
                <label htmlFor="max_players" className="block text-sm font-medium text-zinc-700">
                  Maximum players
                </label>
                <input
                  id="max_players"
                  name="max_players"
                  type="number"
                  min="2"
                  max="30"
                  value={formData.max_players}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  At this number the game is confirmed and full — no longer
                  looking for players.
                </p>
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-red-600">{formError}</p>
            )}

            <button
              type="submit"
              disabled={formSubmitting || authLoading || !user}
              className="mt-6 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formSubmitting ? "Creating..." : "Create Game"}
            </button>
          </form>

        </div>
      </section>

      {/* Games list */}
      <section id="games" className="border-t border-zinc-200 bg-white py-12">
        <div className="mx-auto w-full max-w-4xl px-6">
          <h2 className="text-2xl font-bold text-zinc-900">Games</h2>
          <p className="mt-1 text-zinc-600">
            Upcoming, completed, and cancelled games in and around Eastvale
          </p>

          <form
            onSubmit={handleSearch}
            className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          >
            <p className="text-sm font-medium text-zinc-700">Search games</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="search_zip_code" className="block text-sm text-zinc-600">
                  Zip code
                </label>
                <input
                  id="search_zip_code"
                  type="text"
                  value={searchZipCode}
                  onChange={(event) => setSearchZipCode(event.target.value)}
                  placeholder="92880"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>
              <div>
                <label htmlFor="search_host_name" className="block text-sm text-zinc-600">
                  Host name
                </label>
                <input
                  id="search_host_name"
                  type="text"
                  value={searchHostName}
                  onChange={(event) => setSearchHostName(event.target.value)}
                  placeholder="Alex or Rivera"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="rounded-lg bg-green-600 px-5 py-2 font-semibold text-white transition hover:bg-green-700"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleClearSearch}
                className="rounded-lg border border-zinc-300 bg-white px-5 py-2 font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                Clear
              </button>
            </div>
          </form>

          {gamesError && (
            <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {gamesError}
            </p>
          )}

          {gamesLoading && (
            <p className="mt-8 text-zinc-500">Loading games...</p>
          )}

          {!gamesLoading && games.length === 0 && (
            <div className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
              <p className="font-medium text-zinc-700">No games found</p>
              <p className="mt-1 text-sm text-zinc-500">
                Try a different zip code or host name, or create a new game.
              </p>
            </div>
          )}

          {!gamesLoading && games.length > 0 && (
            <ul className="mt-8 flex flex-col gap-4">
              {games.map((game) => {
                const host = getHost(game);
                const status =
                  STATUS_STYLES[game.status] ||
                  STATUS_STYLES.looking_for_players;
                const canCancel =
                  user?.id === game.host_user_id &&
                  ["looking_for_players", "confirmed", "full"].includes(
                    game.status,
                  );
                const alreadyJoined = userIsInGame(game);
                const canJoin =
                  Boolean(user) &&
                  !alreadyJoined &&
                  ["looking_for_players", "confirmed"].includes(game.status);
                const canPostScore =
                  user?.id === game.host_user_id && game.status === "completed";
                const hasScore =
                  game.score_team_a != null && game.score_team_b != null;
                const scoreDraft = getScoreDraft(game);

                return (
                <li
                  key={game.id}
                  className="rounded-lg border border-zinc-200 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-zinc-900">
                        {game.title}
                      </h3>
                      {host && (
                        <p className="mt-1 text-sm text-zinc-600">
                          Hosted by {host.first_name} {host.last_name} · {host.skill_level}
                          {host.age_range ? ` · Ages ${host.age_range}` : ""}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-zinc-600">
                        📍 {game.location}
                        {game.zip_code ? ` · ${game.zip_code}` : ""}
                      </p>
                      {game.latitude != null && game.longitude != null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${game.latitude},${game.longitude}${
                            game.place_id
                              ? `&query_place_id=${encodeURIComponent(game.place_id)}`
                              : ""
                          }`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-sm font-medium text-green-700 hover:text-green-800 hover:underline"
                        >
                          Open park in Google Maps ↗
                        </a>
                      )}
                      <p className="mt-1 text-sm text-zinc-600">
                        🗓 {game.date_time}
                      </p>
                      {game.player_names?.length > 0 && (
                        <p className="mt-2 text-sm text-zinc-600">
                          Players:{" "}
                          {game.player_names
                            .map((player) =>
                              `${player.first_name} ${player.last_name}`.trim(),
                            )
                            .join(", ")}
                        </p>
                      )}
                      {hasScore && (
                        <p className="mt-3 text-base font-semibold text-zinc-900">
                          Final score: Team A {game.score_team_a} –{" "}
                          {game.score_team_b} Team B
                        </p>
                      )}
                      {canPostScore && (
                        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-sm font-medium text-zinc-800">
                            {hasScore ? "Update final score" : "Post final score"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Only available after the game time has passed.
                          </p>
                          <div className="mt-3 flex flex-wrap items-end gap-3">
                            <div>
                              <label
                                htmlFor={`score-a-${game.id}`}
                                className="block text-xs text-zinc-600"
                              >
                                Team A
                              </label>
                              <input
                                id={`score-a-${game.id}`}
                                type="number"
                                min="0"
                                value={scoreDraft.score_team_a}
                                onChange={(event) =>
                                  handleScoreDraftChange(
                                    game.id,
                                    "score_team_a",
                                    event.target.value,
                                  )
                                }
                                className="mt-1 w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                              />
                            </div>
                            <span className="pb-2 text-sm font-semibold text-zinc-500">
                              –
                            </span>
                            <div>
                              <label
                                htmlFor={`score-b-${game.id}`}
                                className="block text-xs text-zinc-600"
                              >
                                Team B
                              </label>
                              <input
                                id={`score-b-${game.id}`}
                                type="number"
                                min="0"
                                value={scoreDraft.score_team_b}
                                onChange={(event) =>
                                  handleScoreDraftChange(
                                    game.id,
                                    "score_team_b",
                                    event.target.value,
                                  )
                                }
                                className="mt-1 w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveScore(game)}
                              disabled={scoringGameId === game.id}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {scoringGameId === game.id
                                ? "Saving..."
                                : hasScore
                                  ? "Update score"
                                  : "Save score"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800">
                        {game.player_count} / {game.max_players} players
                      </span>
                      <span className="text-xs text-zinc-500">
                        Min {game.min_players ?? game.max_players} to confirm
                      </span>
                      {alreadyJoined && !canCancel && (
                        <span className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800">
                          You&apos;re in this game
                        </span>
                      )}
                      {canJoin && (
                        <button
                          type="button"
                          onClick={() => handleJoinGame(game.id)}
                          disabled={joiningGameId === game.id}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {joiningGameId === game.id ? "Joining..." : "Join game"}
                        </button>
                      )}
                      {!user &&
                        ["looking_for_players", "confirmed"].includes(
                          game.status,
                        ) && (
                          <span className="text-xs text-zinc-500">
                            Sign in to join
                          </span>
                        )}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => handleCancelGame(game.id)}
                          disabled={cancellingGameId === game.id}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {cancellingGameId === game.id
                            ? "Cancelling..."
                            : "Cancel game"}
                        </button>
                      )}
                      <span className="text-xs text-zinc-500">
                        Game #{game.id}
                      </span>
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
