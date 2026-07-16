"use client";

import { useEffect, useState } from "react";
import LoginButton from "./components/LoginButton";
import { useAuth } from "./context/AuthContext";

const API_URL = "http://localhost:8000";
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const AGE_RANGES = ["Under 18", "18-25", "26-35", "36-45", "46+", "All ages"];

function getHost(game) {
  const host = game.player_names?.find((player) => player.is_host);
  return host || game.player_names?.[0] || null;
}

export default function Home() {
  const { user } = useAuth();
  const [apiStatus, setApiStatus] = useState("checking");
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    first_name: "",
    last_name: "",
    skill_level: "Intermediate",
    age_range: "26-35",
    location: "Eastvale Community Park",
    zip_code: "92880",
    date_time: "",
    max_players: 10,
  });
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [searchZipCode, setSearchZipCode] = useState("");
  const [searchHostName, setSearchHostName] = useState("");

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

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((response) => response.json())
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus("offline"));

    loadGames();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      first_name: user.first_name || prev.first_name,
      last_name: user.last_name || prev.last_name,
    }));
  }, [user]);

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
      [name]: name === "max_players" ? Number(value) : value,
    }));
  }

  async function handleCreateGame(event) {
    event.preventDefault();
    setFormError("");

    if (
      !formData.title.trim() ||
      !formData.first_name.trim() ||
      !formData.last_name.trim() ||
      !formData.skill_level ||
      !formData.age_range ||
      !formData.location.trim() ||
      !formData.zip_code.trim() ||
      !formData.date_time
    ) {
      setFormError("Please fill in all required fields.");
      return;
    }

    setFormSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim(),
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          skill_level: formData.skill_level,
          age_range: formData.age_range,
          location: formData.location.trim(),
          zip_code: formData.zip_code.trim(),
          date_time: formData.date_time.replace("T", " "),
          max_players: formData.max_players,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create game");
      }

      setFormData({
        title: "",
        first_name: "",
        last_name: "",
        skill_level: "Intermediate",
        age_range: "26-35",
        location: "Eastvale Community Park",
        zip_code: "92880",
        date_time: "",
        max_players: 10,
      });

      await loadGames();
      scrollToGames();
    } catch {
      setFormError("Could not create the game. Is the backend running?");
    } finally {
      setFormSubmitting(false);
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
          soccer games. No accounts needed — just show up and play.
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

              <div>
                <label htmlFor="zip_code" className="block text-sm font-medium text-zinc-700">
                  Zip code
                </label>
                <input
                  id="zip_code"
                  name="zip_code"
                  type="text"
                  value={formData.zip_code}
                  onChange={handleInputChange}
                  placeholder="92880"
                  maxLength={10}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="location" className="block text-sm font-medium text-zinc-700">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
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
                <label htmlFor="max_players" className="block text-sm font-medium text-zinc-700">
                  Max players
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
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-red-600">{formError}</p>
            )}

            <button
              type="submit"
              disabled={formSubmitting}
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
          <h2 className="text-2xl font-bold text-zinc-900">Available Games</h2>
          <p className="mt-1 text-zinc-600">
            Pickup games happening in and around Eastvale
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
                      <p className="mt-1 text-sm text-zinc-600">
                        🗓 {game.date_time}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                        {game.player_count} / {game.max_players} players
                      </span>
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
