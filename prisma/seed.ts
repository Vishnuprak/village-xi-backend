import { PrismaClient, MatchFormat, MatchStatus, TossDecision, InningsStatus, PlayerRole, BattingStyle, BowlingStyle, ExtraType, DismissalType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Village XI database...');

  // 1. Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Administrator access' },
  });

  const scorerRole = await prisma.role.upsert({
    where: { name: 'SCORER' },
    update: {},
    create: { name: 'SCORER', description: 'Cricket Scorer access' },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'VIEWER' },
    update: {},
    create: { name: 'VIEWER', description: 'Standard Viewer access' },
  });

  // 2. Users
  const adminUser = await prisma.user.upsert({
    where: { phone: '+919999999999' },
    update: {},
    create: {
      phone: '+919999999999',
      name: 'Village Admin',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      roles: { create: { roleId: adminRole.id } },
    },
  });

  const scorerUser = await prisma.user.upsert({
    where: { phone: '+918888888888' },
    update: {},
    create: {
      phone: '+918888888888',
      name: 'Official Scorer',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      roles: { create: { roleId: scorerRole.id } },
    },
  });

  const viewerUser = await prisma.user.upsert({
    where: { phone: '+917777777777' },
    update: {},
    create: {
      phone: '+917777777777',
      name: 'Ramesh (Fan)',
      roles: { create: { roleId: viewerRole.id } },
    },
  });

  // 3. Teams
  const teamA = await prisma.team.upsert({
    where: { shortName: 'VXI' },
    update: {},
    create: {
      name: 'Village XI Kings',
      shortName: 'VXI',
      logoUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=150',
      homeGround: 'Village Oval Ground',
    },
  });

  const teamB = await prisma.team.upsert({
    where: { shortName: 'TRL' },
    update: {},
    create: {
      name: 'Town Royals',
      shortName: 'TRL',
      logoUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=150',
      homeGround: 'Town Sports Complex',
    },
  });

  // 4. Players
  const teamAPlayers = [];
  const teamAPlayerNames = [
    'Senthil Kumar', 'Karthi Raja', 'Murugan V', 'Arun Prakash', 'Saravanan M',
    'Dinesh Karthik', 'Praveen Raj', 'Vigneshwaran', 'Ganesh Moorthy', 'Suresh Raina'
  ];

  for (let i = 0; i < teamAPlayerNames.length; i++) {
    const player = await prisma.player.create({
      data: {
        teamId: teamA.id,
        fullName: teamAPlayerNames[i],
        jerseyNumber: `${i + 1}`,
        primaryRole: i < 4 ? PlayerRole.BATSMAN : i < 7 ? PlayerRole.ALL_ROUNDER : PlayerRole.BOWLER,
        battingStyle: i % 3 === 0 ? BattingStyle.LEFT_HAND : BattingStyle.RIGHT_HAND,
        bowlingStyle: i % 2 === 0 ? BowlingStyle.RIGHT_ARM_MEDIUM : BowlingStyle.RIGHT_ARM_SPIN,
      },
    });
    teamAPlayers.push(player);
  }

  const teamBPlayers = [];
  const teamBPlayerNames = [
    'Rajesh Kumar', 'Vikram Seth', 'Ashok Kumar', 'Vijay Antony', 'Pradeep Chandran',
    'Naveen Kumar', 'Santhosh Shiv', 'Manoj Kumar', 'Balaji V', 'Deepak Chahar'
  ];

  for (let i = 0; i < teamBPlayerNames.length; i++) {
    const player = await prisma.player.create({
      data: {
        teamId: teamB.id,
        fullName: teamBPlayerNames[i],
        jerseyNumber: `${i + 11}`,
        primaryRole: i < 4 ? PlayerRole.BATSMAN : i < 7 ? PlayerRole.ALL_ROUNDER : PlayerRole.BOWLER,
        battingStyle: i % 2 === 0 ? BattingStyle.RIGHT_HAND : BattingStyle.LEFT_HAND,
        bowlingStyle: i % 3 === 0 ? BowlingStyle.RIGHT_ARM_FAST : BowlingStyle.LEFT_ARM_SPIN,
      },
    });
    teamBPlayers.push(player);
  }

  // 5. Matches
  // Match 1: Live Match (In Progress)
  const liveMatch = await prisma.match.create({
    data: {
      title: 'Village XI vs Town Royals — Championship Final',
      slug: 'vxi-vs-trl-championship-final',
      teamAId: teamA.id,
      teamBId: teamB.id,
      venue: 'Village Main Oval',
      scheduledAt: new Date(),
      totalOvers: 20,
      format: MatchFormat.LIMITED_OVERS,
      status: MatchStatus.LIVE,
      tossWinnerId: teamA.id,
      tossDecision: TossDecision.BAT,
      liveStreamUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      description: 'Annual Village Trophy Final 2026 Live Match',
    },
  });

  // Squads for Live Match
  for (const player of teamAPlayers) {
    await prisma.matchSquad.create({
      data: { matchId: liveMatch.id, teamId: teamA.id, playerId: player.id },
    });
  }
  for (const player of teamBPlayers) {
    await prisma.matchSquad.create({
      data: { matchId: liveMatch.id, teamId: teamB.id, playerId: player.id },
    });
  }

  // Live Innings 1 (Team A Batting)
  const innings1 = await prisma.innings.create({
    data: {
      matchId: liveMatch.id,
      inningsNumber: 1,
      battingTeamId: teamA.id,
      bowlingTeamId: teamB.id,
      totalRuns: 42,
      totalWickets: 1,
      totalOvers: 4.2,
      status: InningsStatus.IN_PROGRESS,
    },
  });

  // Overs and Balls for Live Match
  const bowlerB1 = teamBPlayers[7];
  const strikerA1 = teamAPlayers[0];
  const strikerA2 = teamAPlayers[1];

  const over1 = await prisma.over.create({
    data: {
      inningsId: innings1.id,
      overNumber: 1,
      bowlerId: bowlerB1.id,
      runsConceded: 12,
      wicketsTaken: 0,
    },
  });

  await prisma.ball.create({
    data: {
      inningsId: innings1.id,
      overId: over1.id,
      ballNumber: 1,
      strikerId: strikerA1.id,
      nonStrikerId: strikerA2.id,
      bowlerId: bowlerB1.id,
      runsBat: 4,
      totalRuns: 4,
    },
  });

  await prisma.ball.create({
    data: {
      inningsId: innings1.id,
      overId: over1.id,
      ballNumber: 2,
      strikerId: strikerA1.id,
      nonStrikerId: strikerA2.id,
      bowlerId: bowlerB1.id,
      runsBat: 1,
      totalRuns: 1,
    },
  });

  await prisma.ball.create({
    data: {
      inningsId: innings1.id,
      overId: over1.id,
      ballNumber: 3,
      strikerId: strikerA2.id,
      nonStrikerId: strikerA1.id,
      bowlerId: bowlerB1.id,
      runsBat: 6,
      totalRuns: 6,
    },
  });

  // Match 2: Scheduled Match
  await prisma.match.create({
    data: {
      title: 'Village XI vs Town Royals — Weekend League',
      slug: 'vxi-vs-trl-weekend-league',
      teamAId: teamA.id,
      teamBId: teamB.id,
      venue: 'Village Main Oval',
      scheduledAt: new Date(Date.now() + 86400000 * 2), // 2 days later
      totalOvers: 20,
      format: MatchFormat.LIMITED_OVERS,
      status: MatchStatus.SCHEDULED,
      description: 'Upcoming league match fixture',
    },
  });

  // Match 3: Completed Match
  const completedMatch = await prisma.match.create({
    data: {
      title: 'Village XI vs Town Royals — Exhibition Trophy',
      slug: 'vxi-vs-trl-exhibition-trophy',
      teamAId: teamA.id,
      teamBId: teamB.id,
      venue: 'Town Sports Complex',
      scheduledAt: new Date(Date.now() - 86400000 * 3),
      totalOvers: 10,
      format: MatchFormat.LIMITED_OVERS,
      status: MatchStatus.COMPLETED,
      tossWinnerId: teamB.id,
      tossDecision: TossDecision.BOWL,
      winnerTeamId: teamA.id,
      resultSummary: 'Village XI Kings won by 18 runs',
      description: 'Exhibition T10 fixture',
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
