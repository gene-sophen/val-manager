function calculateStandings(teamIds, games) {
  const rows = new Map(teamIds.map(id => [id, { id, wins: 0, losses: 0, roundsFor: 0, roundsAgainst: 0, roundDifference: 0 }]));
  for (const game of games) {
    const a = rows.get(game.a), b = rows.get(game.b);
    if (!a || !b || a === b || !Number.isInteger(game.scoreA) || !Number.isInteger(game.scoreB)
      || game.scoreA === game.scoreB || game.scoreA < 0 || game.scoreB < 0) throw new Error('无效的联赛赛果');
    a.roundsFor += game.scoreA; a.roundsAgainst += game.scoreB;
    b.roundsFor += game.scoreB; b.roundsAgainst += game.scoreA;
    if (game.scoreA > game.scoreB) { a.wins++; b.losses++; }
    else { b.wins++; a.losses++; }
  }
  for (const row of rows.values()) row.roundDifference = row.roundsFor - row.roundsAgainst;
  return [...rows.values()].sort((a, b) => b.wins - a.wins || b.roundDifference - a.roundDifference
    || b.roundsFor - a.roundsFor || a.id.localeCompare(b.id)).map((row, index) => ({ ...row, place: index + 1 }));
}

module.exports = { calculateStandings };
