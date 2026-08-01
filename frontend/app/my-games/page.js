"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GameCard from "../components/GameCard";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { useGames } from "../hooks/useGames";
import {
  API_URL,
  sortCancelled,
  sortCompleted,
  sortUpcoming,
  UPCOMING_STATUSES,
  userIsInGame,
} from "../lib/games";

function Section({ title, description, children, emptyText }) {
  const hasContent = Boolean(children);

  return (
    <section className="mt-10">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        ) : null}
      </div>
      {hasContent ? (
        children
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

export default function MyGamesPage() {
  const { user, accessToken, authLoading } = useAuth();
  const [apiStatus, setApiStatus] = useState("checking");
  const {
    games,
    gamesLoading,
    gamesError,
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

  const myGames = useMemo(() => {
    if (!user) {
      return { upcoming: [], completed: [], cancelled: [] };
    }

    const mine = games.filter((game) => userIsInGame(game, user));
    return {
      upcoming: sortUpcoming(
        mine.filter((game) => UPCOMING_STATUSES.includes(game.status)),
      ),
      completed: sortCompleted(
        mine.filter((game) => game.status === "completed"),
      ),
      cancelled: sortCancelled(
        mine.filter((game) => game.status === "cancelled"),
      ),
    };
  }, [games, user]);

  function renderList(list, emptyText) {
    if (!list.length) {
      return null;
    }

    return (
      <ul className="flex flex-col gap-4">
        {list.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            user={user}
            variant="my-games"
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
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader apiStatus={apiStatus} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          My Games
        </h1>
        <p className="mt-2 text-zinc-600">
          Your upcoming matches, completed history, and anything you hosted.
        </p>

        {authLoading ? (
          <p className="mt-8 text-zinc-500">Loading your account...</p>
        ) : !user ? (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <p className="font-medium text-amber-950">
              Sign in to see your games
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Use Google sign-in in the header, then come back here to track
              games you joined or hosted.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-semibold text-green-700 hover:underline"
            >
              Browse upcoming games →
            </Link>
          </div>
        ) : (
          <>
            {gamesError && (
              <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {gamesError}
              </p>
            )}

            {gamesLoading ? (
              <p className="mt-8 text-zinc-500">Loading your games...</p>
            ) : (
              <>
                <Section
                  title="Upcoming"
                  description="Games you're hosting or have joined, soonest first."
                  emptyText="No upcoming games yet. Find one to join or create your own."
                >
                  {renderList(myGames.upcoming)}
                </Section>

                <Section
                  title="My Completed Games"
                  description="Past games you played in or hosted."
                  emptyText="No completed games in your history yet."
                >
                  {renderList(myGames.completed)}
                </Section>

                <Section
                  title="Cancelled"
                  description="Cancelled games you hosted or had joined."
                  emptyText="No cancelled games."
                >
                  {renderList(myGames.cancelled)}
                </Section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
