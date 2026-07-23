import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { POLL_RATING_MAX, POLL_RATING_MIN } from "@ttrpg-club/shared";
import type {
  ClubStatistics,
  Game,
  GameSpotlight,
  LeaderboardEntry,
  SystemStat,
} from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAuth } from "../../lib/auth.js";
import { json } from "../../lib/response.js";

const LEADERBOARD_SIZE = 5;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function topEntries(
  counts: Map<string, { displayName: string; count: number }>
): LeaderboardEntry[] {
  return Array.from(counts.entries())
    .map(([userId, v]) => ({ userId, displayName: v.displayName, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, LEADERBOARD_SIZE);
}

export async function getClubStatistics(event: APIGatewayProxyEventV2) {
  await requireAuth(event);
  const from = event.queryStringParameters?.from || null;
  const to = event.queryStringParameters?.to || null;

  const result = await ddb.send(new ScanCommand({ TableName: Tables.games() }));
  const games = ((result.Items ?? []) as Game[]).filter(
    (g) => (!from || g.date >= from) && (!to || g.date <= to)
  );

  // One vote query per game — fine at this scale (a hobby club, not thousands of games).
  const gameAverages = new Map<string, number>();
  const ratingCounts = new Array(POLL_RATING_MAX - POLL_RATING_MIN + 1).fill(0);
  let totalVotes = 0;

  await Promise.all(
    games.map(async (game) => {
      const votesResult = await ddb.send(
        new QueryCommand({
          TableName: Tables.gamePollVotes(),
          KeyConditionExpression: "gameId = :gameId",
          ExpressionAttributeValues: { ":gameId": game.gameId },
        })
      );
      const ratings = (votesResult.Items ?? []).map((v) => v.rating as number);
      if (ratings.length === 0) return;

      const avg = average(ratings);
      if (avg !== null) gameAverages.set(game.gameId, avg);
      for (const rating of ratings) {
        ratingCounts[rating - POLL_RATING_MIN] += 1;
        totalVotes += 1;
      }
    })
  );

  const gamesWithScores = games.filter((g) => gameAverages.has(g.gameId));
  const averageScore = average(gamesWithScores.map((g) => gameAverages.get(g.gameId)!));

  const systemGroups = new Map<string, { systemName: string; games: Game[] }>();
  for (const game of games) {
    const group = systemGroups.get(game.systemId) ?? {
      systemName: game.systemName,
      games: [],
    };
    group.games.push(game);
    systemGroups.set(game.systemId, group);
  }
  const systemStats: SystemStat[] = Array.from(systemGroups.entries())
    .map(([systemId, group]) => ({
      systemId,
      systemName: group.systemName,
      gamesPlayed: group.games.length,
      averageScore: average(
        group.games.filter((g) => gameAverages.has(g.gameId)).map((g) => gameAverages.get(g.gameId)!)
      ),
    }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);

  const dmCounts = new Map<string, { displayName: string; count: number }>();
  const playerCounts = new Map<string, { displayName: string; count: number }>();
  for (const game of games) {
    const dm = dmCounts.get(game.dmUserId) ?? { displayName: game.dmDisplayName, count: 0 };
    dm.count += 1;
    dmCounts.set(game.dmUserId, dm);

    for (const p of game.participants) {
      if (p.userId === game.dmUserId) continue;
      const player = playerCounts.get(p.userId) ?? { displayName: p.displayName, count: 0 };
      player.count += 1;
      playerCounts.set(p.userId, player);
    }
  }

  let highestRatedGame: GameSpotlight | null = null;
  let lowestRatedGame: GameSpotlight | null = null;
  for (const game of gamesWithScores) {
    const avg = gameAverages.get(game.gameId)!;
    if (!highestRatedGame || avg > highestRatedGame.averageScore) {
      highestRatedGame = { gameId: game.gameId, title: game.title, averageScore: avg };
    }
    if (!lowestRatedGame || avg < lowestRatedGame.averageScore) {
      lowestRatedGame = { gameId: game.gameId, title: game.title, averageScore: avg };
    }
  }

  const statistics: ClubStatistics = {
    from,
    to,
    totalGames: games.length,
    averageScore,
    ratingDistribution: { counts: ratingCounts, totalVotes },
    systemStats,
    topGameMasters: topEntries(dmCounts),
    topPlayers: topEntries(playerCounts),
    highestRatedGame,
    lowestRatedGame,
  };

  return json(200, { statistics });
}
