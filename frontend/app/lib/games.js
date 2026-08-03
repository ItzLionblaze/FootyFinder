export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
export const AGE_RANGES = ["12+", "18+", "12-17"];

export const STATUS_STYLES = {
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

export const UPCOMING_STATUSES = [
  "looking_for_players",
  "confirmed",
  "full",
];

export function getHost(game) {
  const host = game.player_names?.find((player) => player.is_host);
  return host || game.player_names?.[0] || null;
}

export function playerKey(player, index) {
  if (player?.user_id != null) {
    return `u:${player.user_id}`;
  }
  return `i:${index}:${player?.first_name || ""}:${player?.last_name || ""}`;
}

export function playersOnTeam(game, team) {
  return (game.player_names || []).filter((player) => player.team === team);
}

export function formatPlayerName(player) {
  return `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Player";
}

export function userIsInGame(game, user) {
  if (!user) {
    return false;
  }
  if (game.host_user_id === user.id) {
    return true;
  }
  return (game.player_names || []).some((player) => player.user_id === user.id);
}

export function formatGameWhen(dateTime) {
  if (!dateTime) {
    return { date: "Date TBD", time: "" };
  }

  const normalized = dateTime.includes("T")
    ? dateTime
    : dateTime.replace(" ", "T");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    const [datePart, timePart = ""] = dateTime.split(" ");
    return { date: datePart, time: timePart };
  }

  return {
    date: parsed.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: parsed.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function sortUpcoming(games) {
  return [...games].sort((a, b) =>
    String(a.date_time).localeCompare(String(b.date_time)),
  );
}

export function sortCompleted(games) {
  return [...games].sort((a, b) =>
    String(b.date_time).localeCompare(String(a.date_time)),
  );
}

export function sortCancelled(games) {
  return [...games].sort((a, b) =>
    String(b.created_at || b.date_time).localeCompare(
      String(a.created_at || a.date_time),
    ),
  );
}

export function filterUpcoming(games) {
  return sortUpcoming(
    games.filter((game) => UPCOMING_STATUSES.includes(game.status)),
  );
}

export function matchesSearch(game, query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }

  const host = getHost(game);
  const haystack = [
    game.location,
    game.place_address,
    game.zip_code,
    game.title,
    host?.first_name,
    host?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}
