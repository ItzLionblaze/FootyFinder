"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, playerKey } from "../lib/games";

function buildTeamsFromGame(game) {
  const teams = {};
  (game.player_names || []).forEach((player, index) => {
    if (player.team === "a" || player.team === "b") {
      teams[playerKey(player, index)] = player.team;
    }
  });
  return teams;
}

export function useGames(accessToken) {
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState("");
  const [joiningGameId, setJoiningGameId] = useState(null);
  const [cancellingGameId, setCancellingGameId] = useState(null);
  const [scoringGameId, setScoringGameId] = useState(null);
  const [scoreDrafts, setScoreDrafts] = useState({});

  const loadGames = useCallback(async (search = {}) => {
    setGamesLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.q?.trim()) {
        params.set("q", search.q.trim());
      }
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
      setGames(Array.isArray(data) ? data : []);
    } catch {
      setGames([]);
    } finally {
      setGamesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  function getScoreDraft(game) {
    const existing = scoreDrafts[game.id];
    if (existing) {
      return existing;
    }

    return {
      score_team_a:
        game.score_team_a != null ? String(game.score_team_a) : "",
      score_team_b:
        game.score_team_b != null ? String(game.score_team_b) : "",
      teams: buildTeamsFromGame(game),
    };
  }

  function handleScoreDraftChange(gameId, field, value) {
    setScoreDrafts((prev) => {
      const current = prev[gameId] || {
        score_team_a: "",
        score_team_b: "",
        teams: {},
      };
      return {
        ...prev,
        [gameId]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  function handlePlayerTeamChange(game, player, index, team) {
    const key = playerKey(player, index);
    setScoreDrafts((prev) => {
      const current = prev[game.id] || {
        score_team_a:
          game.score_team_a != null ? String(game.score_team_a) : "",
        score_team_b:
          game.score_team_b != null ? String(game.score_team_b) : "",
        teams: buildTeamsFromGame(game),
      };
      return {
        ...prev,
        [game.id]: {
          ...current,
          teams: {
            ...(current.teams || {}),
            [key]: team,
          },
        },
      };
    });
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
      await loadGames();
    } catch (error) {
      setGamesError(error.message || "Could not join the game.");
    } finally {
      setJoiningGameId(null);
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
      await loadGames();
    } catch (error) {
      setGamesError(error.message || "Could not cancel the game.");
    } finally {
      setCancellingGameId(null);
    }
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

    const players = game.player_names || [];
    const unassigned = players.filter((player, index) => {
      const team = draft.teams?.[playerKey(player, index)];
      return team !== "a" && team !== "b";
    });
    if (players.length > 0 && unassigned.length > 0) {
      setGamesError(
        "Assign every player to Team A or Team B before saving the score.",
      );
      return;
    }

    const playerTeams = players.map((player, index) => ({
      user_id: player.user_id ?? null,
      first_name: player.first_name || "",
      last_name: player.last_name || "",
      team: draft.teams?.[playerKey(player, index)] || null,
    }));

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
          player_teams: playerTeams,
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
      await loadGames();
    } catch (error) {
      setGamesError(error.message || "Could not save the score.");
    } finally {
      setScoringGameId(null);
    }
  }

  return {
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
    handlePlayerTeamChange,
    handleJoinGame,
    handleCancelGame,
    handleSaveScore,
  };
}
