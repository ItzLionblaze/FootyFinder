"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../lib/games";

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
    handleJoinGame,
    handleCancelGame,
    handleSaveScore,
  };
}
