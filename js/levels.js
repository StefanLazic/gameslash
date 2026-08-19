/* Level definitions: ten stages, three mini bosses, two bosses, plus random mutators. */
(function (global) {
  'use strict';

  const P = {
    dusk: { sky1: '#2b1445', sky2: '#0f0820', ground: '#3a2158', grid: 'rgba(255,255,255,.05)', border: '#c07bff', prop: '#ff9ecb', prop2: '#7be0c0' },
    glass: { sky1: '#123a4d', sky2: '#06131f', ground: '#17485c', grid: 'rgba(180,255,255,.06)', border: '#7ef0ff', prop: '#b6f4ff', prop2: '#6fd0e8' },
    keep: { sky1: '#3b2a12', sky2: '#160d05', ground: '#4a3418', grid: 'rgba(255,220,150,.06)', border: '#ffb547', prop: '#e8c07a', prop2: '#a8783c' },
    marsh: { sky1: '#14342a', sky2: '#050f0c', ground: '#1c4536', grid: 'rgba(150,255,200,.06)', border: '#5ff2a0', prop: '#8fffc4', prop2: '#3f7f5f' },
    chapel: { sky1: '#3d0f30', sky2: '#12040f', ground: '#4d1740', grid: 'rgba(255,180,230,.06)', border: '#ff6ec7', prop: '#ffb3e0', prop2: '#8f3f70' },
    ember: { sky1: '#4a1508', sky2: '#1a0603', ground: '#5c2410', grid: 'rgba(255,160,90,.07)', border: '#ff7a2f', prop: '#ffb07a', prop2: '#c04f1f' },
    obsidian: { sky1: '#151527', sky2: '#04040a', ground: '#20203a', grid: 'rgba(160,180,255,.07)', border: '#8fa6ff', prop: '#b6c4ff', prop2: '#5f6fa8' },
    sky: { sky1: '#2a3f7a', sky2: '#0b1330', ground: '#33508f', grid: 'rgba(255,255,255,.08)', border: '#9fd8ff', prop: '#dceaff', prop2: '#7f9fd8' },
    bone: { sky1: '#332f28', sky2: '#0d0c0a', ground: '#413c33', grid: 'rgba(255,240,210,.06)', border: '#e8dcc0', prop: '#f0e8d0', prop2: '#9f9480' },
    cathedral: { sky1: '#2a1050', sky2: '#080418', ground: '#33165e', grid: 'rgba(255,215,120,.08)', border: '#ffd479', prop: '#ffe9a8', prop2: '#a06bff' }
  };

  const LEVELS = [
    {
      id: 1, name: 'Garden of Ash', sub: 'Something has been stealing the wings.',
      palette: P.dusk, prop: 'grass', world: { w: 1200, h: 800 }, butterflies: 4,
      waves: [
        { types: ['wraith'], count: 4, tier: 1 },
        { types: ['wraith', 'beetle'], count: 5, tier: 1 }
      ]
    },
    {
      id: 2, name: 'Glass Meadow', sub: 'Wisps drift between the shards.',
      palette: P.glass, prop: 'crystal', world: { w: 1300, h: 850 }, butterflies: 6,
      waves: [
        { types: ['wraith', 'wisp'], count: 5, tier: 1 },
        { types: ['wisp', 'beetle'], count: 6, tier: 1.1 },
        { types: ['wraith', 'shade'], count: 6, tier: 1.1 }
      ]
    },
    {
      id: 3, name: 'Thistle Keep', sub: 'A knight guards the cages. (Mini boss)',
      palette: P.keep, prop: 'flower', world: { w: 1350, h: 900 }, butterflies: 7,
      waves: [
        { types: ['wraith', 'shade'], count: 6, tier: 1.1 },
        { types: ['beetle', 'wisp'], count: 6, tier: 1.2 },
        { miniBoss: 'knight', tier: 1, types: ['wraith'], count: 3 }
      ]
    },
    {
      id: 4, name: 'Moonlit Marsh', sub: 'The mud remembers every scream.',
      palette: P.marsh, prop: 'grass', world: { w: 1400, h: 950 }, butterflies: 8,
      waves: [
        { types: ['shade', 'wisp'], count: 7, tier: 1.2 },
        { types: ['beetle', 'wraith'], count: 7, tier: 1.3 },
        { types: ['shade', 'wisp', 'beetle'], count: 8, tier: 1.3 }
      ]
    },
    {
      id: 5, name: "Widow's Chapel", sub: 'Vespera has been waiting. (Boss)',
      palette: P.chapel, prop: 'rune', world: { w: 1450, h: 950 }, butterflies: 10,
      waves: [
        { types: ['wraith', 'wisp'], count: 6, tier: 1.3 },
        { boss: 'vespera', tier: 1, types: ['shade'], count: 3 }
      ]
    },
    {
      id: 6, name: 'Emberfield', sub: 'Wings burn beautifully. Save them faster.',
      palette: P.ember, prop: 'flower', world: { w: 1450, h: 950 }, butterflies: 10,
      waves: [
        { types: ['shade', 'wraith'], count: 8, tier: 1.5 },
        { types: ['wisp', 'beetle'], count: 8, tier: 1.5 },
        { types: ['shade', 'wisp', 'wraith'], count: 9, tier: 1.6 }
      ]
    },
    {
      id: 7, name: 'Obsidian Grove', sub: 'Two knights this time. (Mini bosses)',
      palette: P.obsidian, prop: 'crystal', world: { w: 1500, h: 1000 }, butterflies: 11,
      waves: [
        { types: ['shade', 'wisp'], count: 8, tier: 1.6 },
        { miniBoss: 'knight', tier: 1.2, types: ['wraith'], count: 4 },
        { miniBoss: 'knight', tier: 1.4, types: ['beetle', 'shade'], count: 5 }
      ]
    },
    {
      id: 8, name: 'The Falling Sky', sub: 'Do not look down. Look at the swarm.',
      palette: P.sky, prop: 'rune', world: { w: 1500, h: 1000 }, butterflies: 12,
      waves: [
        { types: ['wisp'], count: 9, tier: 1.7 },
        { types: ['shade', 'wraith'], count: 10, tier: 1.7 },
        { types: ['beetle', 'wisp', 'shade'], count: 10, tier: 1.8 }
      ]
    },
    {
      id: 9, name: 'Bone Orchard', sub: 'The last knight, and everything it kept. (Mini boss)',
      palette: P.bone, prop: 'bone', world: { w: 1550, h: 1050 }, butterflies: 13,
      waves: [
        { types: ['shade', 'wisp', 'wraith'], count: 10, tier: 1.8 },
        { miniBoss: 'knight', tier: 1.8, types: ['beetle', 'shade'], count: 6 }
      ]
    },
    {
      id: 10, name: 'Cathedral of Wings', sub: 'Nyx, Keeper of Wings. End it. (Final boss)',
      palette: P.cathedral, prop: 'rune', world: { w: 1600, h: 1050 }, butterflies: 15,
      waves: [
        { types: ['shade', 'wisp'], count: 8, tier: 1.8 },
        { boss: 'nyx', tier: 1, types: ['wraith', 'shade'], count: 4 }
      ]
    }
  ];

  /* Random twists announced on the level card - keeps repeat runs surprising. */
  const MUTATORS = [
    { key: 'none', name: 'Clear night', desc: 'No omens tonight.', apply: () => {} },
    { key: 'swift', name: 'Restless Wind', desc: 'Foes move faster, but drop extra Flutter.', apply: (g) => { g.speedMod = 1.28; g.epBonus = 2; } },
    { key: 'fragile', name: 'Glass Moon', desc: 'Everything dies faster - including you.', apply: (g) => { g.enemyHpMod = 0.7; g.playerDmgMod = 1.35; } },
    { key: 'swarm', name: 'Swarm Season', desc: 'More foes, more butterflies to save.', apply: (g) => { g.countMod = 1.35; } },
    { key: 'nectar', name: 'Nectar Rain', desc: 'Sweet drops fall often.', apply: (g) => { g.dropMod = 2.2; } },
    { key: 'dark', name: 'Lantern Out', desc: 'The arena is dim - watch the glow.', apply: (g) => { g.dark = true; } },
    { key: 'gold', name: "Guardian's Blessing", desc: 'Your specials cost half.', apply: (g) => { g.specialDiscount = 0.5; } }
  ];

  global.Levels = { LEVELS, MUTATORS, PALETTES: P };
})(window);
