"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GameCard from "./components/GameCard";
import LoginButton from "./components/LoginButton";
import ParkPicker from "./components/ParkPicker";
import SiteHeader from "./components/SiteHeader";
import { useAuth } from "./context/AuthContext";
import { useGames } from "./hooks/useGames";
import {
  AGE_RANGES,
  API_URL,
  filterUpcoming,
  matchesSearch,
  SKILL_LEVELS,
} from "./lib/games";

const EMPTY_FORM = {
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
};

export default function Home() {
  const { user, accessToken, authLoading } = useAuth();
  const [apiStatus, setApiStatus] = useState("checking");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [recentParks, setRecentParks] = useState([]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    games,
    gamesLoading,
    gamesError,
    setGamesError,
    loadGames,
    joiningGameId,
    cancellingGameId,
    scoringGameId,
    getScoreDraft,
    handleScoreDraftChange,
    handleJoinGame,
    handleCancelGame,
    handleSaveScore,
  } = useGames(accessToken);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((response) => response.json())
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus("offline"));
  }, []);

  useEffect(() => {
    if (!user || !accessToken) {
      setRecentParks([]);
      setShowMapPicker(false);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      first_name: user.first_name || prev.first_name,
      last_name: user.last_name || prev.last_name,
    }));

    fetch(`${API_URL}/parks/recent`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setRecentParks(Array.isArray(data) ? data : []))
      .catch(() => setRecentParks([]));
  }, [user, accessToken]);

  const upcomingGames = useMemo(() => {
    return filterUpcoming(games).filter((game) =>
      matchesSearch(game, searchQuery),
    );
  }, [games, searchQuery]);

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

  async function handleCreateGame(event) {
    event.preventDefault();
    setFormError("");
    setGamesError("");

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
        ...EMPTY_FORM,
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
      });
      setShowMapPicker(false);
      await loadGames();
      scrollToGames();
    } catch (error) {
      setFormError(error.message || "Could not create the game.");
    } finally {
      setFormSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader apiStatus={apiStatus} />

      <section className="border-b border-zinc-200 bg-gradient-to-b from-green-50 to-zinc-50">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-start px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
            Pickup soccer near you
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Find a game. Show up. Play.
          </h1>
          <p className="mt-3 max-w-xl text-base text-zinc-600 sm:text-lg">
            Browse upcoming pickup games, join in one tap, or host your own at a
            local park.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={scrollToGames}
              className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              Find Games
            </button>
            <button
              type="button"
              onClick={scrollToCreateForm}
              className="rounded-lg border border-zinc-300 bg-white px-6 py-3 font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              Create a Game
            </button>
            <Link
              href="/my-games"
              className="rounded-lg px-6 py-3 text-center font-semibold text-green-700 transition hover:bg-green-50"
            >
              My Games
            </Link>
          </div>
        </div>
      </section>

      <section id="games" className="bg-white py-10 sm:py-12">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Upcoming Games</h2>
              <p className="mt-1 text-zinc-600">
                Soonest games first. Search by park, city, zip, or host.
              </p>
            </div>
            <Link
              href="/my-games"
              className="text-sm font-semibold text-green-700 hover:underline"
            >
              View your game history →
            </Link>
          </div>

          <div className="mt-6">
            <label htmlFor="game-search" className="sr-only">
              Search games
            </label>
            <input
              id="game-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search park, city, zip, or host name"
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 outline-none focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-200"
            />
          </div>

          {gamesError && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {gamesError}
            </p>
          )}

          {gamesLoading ? (
            <p className="mt-8 text-zinc-500">Loading games...</p>
          ) : upcomingGames.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
              <p className="font-medium text-zinc-700">No upcoming games found</p>
              <p className="mt-1 text-sm text-zinc-500">
                Try a different search, or create a game for your park.
              </p>
              <button
                type="button"
                onClick={scrollToCreateForm}
                className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Create a Game
              </button>
            </div>
          ) : (
            <ul className="mt-8 flex flex-col gap-4">
              {upcomingGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  user={user}
                  joiningGameId={joiningGameId}
                  cancellingGameId={cancellingGameId}
                  scoringGameId={scoringGameId}
                  scoreDraft={getScoreDraft(game)}
                  onJoin={handleJoinGame}
                  onCancel={handleCancelGame}
                  onScoreDraftChange={handleScoreDraftChange}
                  onSaveScore={handleSaveScore}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="create-game" className="border-t border-zinc-200 bg-zinc-50 py-10 sm:py-12">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-zinc-900">Create a Game</h2>
          <p className="mt-1 text-zinc-600">
            Set the park, time, and roster size. Players can join after you post.
          </p>

          <form
            onSubmit={handleCreateGame}
            className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
          >
            {!authLoading && !user && (
              <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Sign in with Google in the header before creating a game. That
                lets you cancel it later and keeps hosting tied to your account.
                <div className="mt-3">
                  <LoginButton />
                </div>
              </div>
            )}

            <p className="mb-4 text-sm font-semibold text-zinc-800">
              Host details
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
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
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
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
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
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
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
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
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                >
                  {AGE_RANGES.map((range) => (
                    <option key={range} value={range}>
                      {range}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mb-4 mt-8 text-sm font-semibold text-zinc-800">
              Game details
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
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
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div className="sm:col-span-2">
                <p className="block text-sm font-medium text-zinc-700">
                  Park location
                </p>

                {recentParks.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-zinc-500">
                      Reuse a park you&apos;ve used before
                    </p>
                    <ul className="flex flex-col gap-2">
                      {recentParks.map((park) => {
                        const selected =
                          formData.latitude === park.latitude &&
                          formData.longitude === park.longitude &&
                          formData.location === park.location;
                        return (
                          <li
                            key={`${park.place_id || park.latitude}-${park.longitude}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleParkSelect(park)}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                selected
                                  ? "border-green-500 bg-green-50 text-green-900"
                                  : "border-zinc-300 bg-white hover:bg-zinc-50"
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
                    className="mt-3 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    {formData.latitude != null || recentParks.length > 0
                      ? "Choose a different park on the map"
                      : "Choose a park on the map"}
                  </button>
                ) : (
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-zinc-500">
                        Search a city/zip, then click the map to pin the park.
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
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>
              <div>
                <label htmlFor="min_players" className="block text-sm font-medium text-zinc-700">
                  Min players to confirm
                </label>
                <input
                  id="min_players"
                  name="min_players"
                  type="number"
                  min="2"
                  max="30"
                  value={formData.min_players}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
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
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-red-600">{formError}</p>
            )}

            <button
              type="submit"
              disabled={formSubmitting || authLoading || !user}
              className="mt-6 w-full rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {formSubmitting ? "Creating..." : "Create Game"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
