"use client";

import {
  STATUS_STYLES,
  formatGameWhen,
  getHost,
  userIsInGame,
} from "../lib/games";

export default function GameCard({
  game,
  user,
  variant = "discover",
  joiningGameId,
  cancellingGameId,
  scoringGameId,
  scoreDraft,
  onJoin,
  onCancel,
  onScoreDraftChange,
  onSaveScore,
}) {
  const host = getHost(game);
  const status = STATUS_STYLES[game.status] || STATUS_STYLES.looking_for_players;
  const { date, time } = formatGameWhen(game.date_time);
  const alreadyJoined = userIsInGame(game, user);
  const isHost = user?.id === game.host_user_id;
  const canJoin =
    Boolean(user) &&
    !alreadyJoined &&
    ["looking_for_players", "confirmed"].includes(game.status);
  const canCancel =
    isHost &&
    ["looking_for_players", "confirmed", "full"].includes(game.status);
  const canPostScore = isHost && game.status === "completed";
  const hasScore = game.score_team_a != null && game.score_team_b != null;
  const mapsUrl =
    game.latitude != null && game.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${game.latitude},${game.longitude}${
          game.place_id
            ? `&query_place_id=${encodeURIComponent(game.place_id)}`
            : ""
        }`
      : null;

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-900">
                {game.title}
              </h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
              >
                {status.label}
              </span>
            </div>

            <dl className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  When
                </dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {date}
                  {time ? ` · ${time}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Park
                </dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {game.location}
                  {game.zip_code ? ` · ${game.zip_code}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Host
                </dt>
                <dd className="mt-0.5">
                  {host
                    ? `${host.first_name} ${host.last_name}`.trim()
                    : "Unknown host"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Skill / ages
                </dt>
                <dd className="mt-0.5">
                  {host?.skill_level || "Any skill"}
                  {host?.age_range ? ` · ${host.age_range}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Players
                </dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {game.player_count} / {game.max_players}
                  <span className="font-normal text-zinc-500">
                    {" "}
                    (min {game.min_players ?? game.max_players} to confirm)
                  </span>
                </dd>
              </div>
            </dl>

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-green-700 hover:text-green-800 hover:underline"
              >
                Open park in Google Maps ↗
              </a>
            )}

            {game.player_names?.length > 0 && (
              <p className="mt-3 text-sm text-zinc-600">
                <span className="font-medium text-zinc-800">Players:</span>{" "}
                {game.player_names
                  .map((player) =>
                    `${player.first_name} ${player.last_name}`.trim(),
                  )
                  .join(", ")}
              </p>
            )}

            {hasScore && (
              <p className="mt-3 text-base font-semibold text-zinc-900">
                Final score: Team A {game.score_team_a} – {game.score_team_b}{" "}
                Team B
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-40 sm:items-end">
            {alreadyJoined && (
              <span className="rounded-lg bg-green-50 px-3 py-1.5 text-center text-sm font-medium text-green-800">
                {isHost ? "You're hosting" : "You're in"}
              </span>
            )}

            {canJoin && (
              <button
                type="button"
                onClick={() => onJoin?.(game.id)}
                disabled={joiningGameId === game.id}
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joiningGameId === game.id ? "Joining..." : "Join game"}
              </button>
            )}

            {!user &&
              ["looking_for_players", "confirmed"].includes(game.status) &&
              variant === "discover" && (
                <span className="text-center text-xs text-zinc-500">
                  Sign in to join
                </span>
              )}

            {canCancel && (
              <button
                type="button"
                onClick={() => onCancel?.(game.id)}
                disabled={cancellingGameId === game.id}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancellingGameId === game.id ? "Cancelling..." : "Cancel game"}
              </button>
            )}
          </div>
        </div>

        {canPostScore && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-medium text-zinc-800">
              {hasScore ? "Update final score" : "Post final score"}
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
                  value={scoreDraft?.score_team_a ?? ""}
                  onChange={(event) =>
                    onScoreDraftChange?.(game.id, "score_team_a", event.target.value)
                  }
                  className="mt-1 w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
                />
              </div>
              <span className="pb-2 text-sm font-semibold text-zinc-500">–</span>
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
                  value={scoreDraft?.score_team_b ?? ""}
                  onChange={(event) =>
                    onScoreDraftChange?.(game.id, "score_team_b", event.target.value)
                  }
                  className="mt-1 w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
                />
              </div>
              <button
                type="button"
                onClick={() => onSaveScore?.(game)}
                disabled={scoringGameId === game.id}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
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
    </li>
  );
}
