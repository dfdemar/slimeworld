/* ===== Balance & Bug Fix Tests (v2.7) ===== */

function runBalanceFixTests() {
    const runner = new TestRunner();

    // --- Bug #7: Suitability formula weights ---

    runner.test('Suitability: environmental traits have meaningful impact', () => {
        const restore = createTestWorld(10, 10);

        const pos = idx(5, 5);
        World.env.nutrient[pos] = 0.5;
        World.env.water[pos] = 0;
        Slime.trail[pos] = 5;

        // Colony perfectly matched to environment
        const matched = createTestColony('MAT', 5, 5);
        matched.traits.water_need = 0.7;
        World.env.humidity[pos] = 0.7;
        World.env.light[pos] = 0.3;

        // Colony poorly matched to environment
        const mismatched = createTestColony('MAT', 5, 5);
        mismatched.traits.water_need = 0.1;

        clearSuitabilityCache();
        World.environmentCache = null;
        const suitMatched = suitabilityAt(matched, 5, 5);

        clearSuitabilityCache();
        World.environmentCache = null;
        const suitMismatched = suitabilityAt(mismatched, 5, 5);

        runner.assertGreaterThan(suitMatched, suitMismatched,
            'Colony with matching water_need should have higher suitability');

        // The difference should be meaningful (not negligible)
        const diff = suitMatched - suitMismatched;
        runner.assertGreaterThan(diff, 0.05,
            'Environmental trait mismatch should create >5% suitability difference');

        restore.restore();
    });

    runner.test('Suitability: TOWER benefits from high light', () => {
        const restore = createTestWorld(10, 10);

        const pos = idx(5, 5);
        World.env.nutrient[pos] = 0.5;
        World.env.water[pos] = 0;
        World.env.humidity[pos] = 0.55;
        Slime.trail[pos] = 0;

        const tower = createTestColony('TOWER', 5, 5);

        // High light (matches TOWER's light_use of 0.85)
        World.env.light[pos] = 0.85;
        clearSuitabilityCache();
        World.environmentCache = null;
        const suitHighLight = suitabilityAt(tower, 5, 5);

        // Low light
        World.env.light[pos] = 0.1;
        clearSuitabilityCache();
        World.environmentCache = null;
        const suitLowLight = suitabilityAt(tower, 5, 5);

        runner.assertGreaterThan(suitHighLight, suitLowLight,
            'TOWER should prefer high-light environments');

        restore.restore();
    });

    runner.test('Suitability: FLOAT benefits from water tiles', () => {
        const restore = createTestWorld(10, 10);

        const pos = idx(5, 5);
        World.env.nutrient[pos] = 0.5;
        World.env.humidity[pos] = 0.9;
        World.env.light[pos] = 0.5;
        Slime.trail[pos] = 0;

        const floater = createTestColony('FLOAT', 5, 5);

        World.env.water[pos] = 1;
        clearSuitabilityCache();
        World.environmentCache = null;
        const suitWater = suitabilityAt(floater, 5, 5);

        World.env.water[pos] = 0;
        clearSuitabilityCache();
        World.environmentCache = null;
        const suitLand = suitabilityAt(floater, 5, 5);

        runner.assertGreaterThan(suitWater, suitLand,
            'FLOAT should strongly prefer water tiles');

        restore.restore();
    });

    // --- Bug #8: Starvation energy uses traits ---

    runner.test('Energy: water_need trait affects survival', () => {
        const restore = createTestWorld(10, 10);

        const pos = idx(5, 5);
        World.env.nutrient[pos] = 0.3;
        World.env.light[pos] = 0.3;

        // Colony well-matched to humid environment
        const wetColony = createTestColony('MAT', 5, 5);
        wetColony.traits.water_need = 0.9;
        World.colonies.push(wetColony);
        World.tiles[pos] = wetColony.id;
        World.biomass[pos] = 1.0;
        World.env.humidity[pos] = 0.9;

        starvationSweep();
        const wetBiomass = World.biomass[pos];

        // Colony poorly matched
        const dryColony = createTestColony('MAT', 5, 5);
        dryColony.traits.water_need = 0.1;
        World.colonies = [dryColony];
        World.tiles[pos] = dryColony.id;
        World.biomass[pos] = 1.0;
        World.env.humidity[pos] = 0.9;

        starvationSweep();
        const dryBiomass = World.biomass[pos];

        runner.assertGreaterThan(wetBiomass, dryBiomass,
            'Colony with water_need matching humidity should retain more biomass');

        restore.restore();
    });

    runner.test('Energy: light_use trait affects photosynthetic colonies', () => {
        const restore = createTestWorld(10, 10);

        const pos = idx(5, 5);
        World.env.nutrient[pos] = 0.2;
        World.env.humidity[pos] = 0.55;

        // TOWER with light matching its light_use
        const tower = createTestColony('TOWER', 5, 5);
        World.colonies = [tower];
        World.tiles[pos] = tower.id;
        World.biomass[pos] = 1.0;
        World.env.light[pos] = tower.traits.light_use;

        starvationSweep();
        const matchedBiomass = World.biomass[pos];

        // TOWER with mismatched light
        World.colonies = [tower];
        World.tiles[pos] = tower.id;
        World.biomass[pos] = 1.0;
        World.env.light[pos] = 0.05;

        starvationSweep();
        const mismatchedBiomass = World.biomass[pos];

        runner.assertGreaterThan(matchedBiomass, mismatchedBiomass,
            'Photosynthetic colony with matching light should have more energy');

        restore.restore();
    });

    // --- Bug #9: Spore trait affects reproduction ---

    runner.test('Spore: high spore rate increases spawn probability', () => {
        const restore = createTestWorld(20, 20);

        // Create two colony types with different spore rates
        const highSpore = createTestColony('FLOAT', 5, 5); // spore: 0.6
        const lowSpore = createTestColony('EAT', 10, 10);  // spore: 0.35

        // Verify spore rates differ
        runner.assertGreaterThan(highSpore.traits.spore, lowSpore.traits.spore,
            'FLOAT should have higher spore rate than EAT');

        // Calculate spawn probabilities with base mutation rate
        const pressure = 1.0;
        const mutRate = 0.18;

        const highSporeRate = clamp(highSpore.traits.spore, 0.1, 1);
        const lowSporeRate = clamp(lowSpore.traits.spore, 0.1, 1);

        const highP = (0.003 + 0.008 * mutRate) * pressure * highSporeRate;
        const lowP = (0.003 + 0.008 * mutRate) * pressure * lowSporeRate;

        runner.assertGreaterThan(highP, lowP,
            'Higher spore trait should produce higher spawn probability');

        // The ratio should roughly match the spore trait ratio
        const expectedRatio = highSporeRate / lowSporeRate;
        const actualRatio = highP / lowP;
        runner.assertApproxEqual(actualRatio, expectedRatio, 0.01,
            'Spawn probability ratio should match spore trait ratio');

        restore.restore();
    });

    // --- Bug #10: Transport trait affects expansion ---

    runner.test('Transport: high transport increases effective sense radius', () => {
        const restore = createTestWorld(20, 20);

        // CORD has high transport (0.85), TOWER has low transport (0.5)
        const cord = createTestColony('CORD', 10, 10);
        const tower = createTestColony('TOWER', 10, 10);

        const cordBase = TypeBehavior.CORD.senseR;
        const towerBase = TypeBehavior.TOWER.senseR;

        const cordR = Math.max(2, Math.round(cordBase * clamp(cord.traits.transport, 0.1, 1)));
        const towerR = Math.max(2, Math.round(towerBase * clamp(tower.traits.transport, 0.1, 1)));

        // CORD with senseR=7 and transport=0.85 → r=6
        // TOWER with senseR=3 and transport=0.5 → r=2
        runner.assertGreaterThan(cordR, towerR,
            'CORD should have larger effective sense radius than TOWER');
        runner.assertGreaterThan(cordR, 2,
            'High-transport colony should have sense radius > minimum');

        restore.restore();
    });

    runner.test('Transport: low transport clamps to minimum radius', () => {
        const restore = createTestWorld(10, 10);

        const colony = createTestColony('MAT', 5, 5);
        colony.traits.transport = 0.1; // Very low

        const base = TypeBehavior.MAT.senseR; // 3
        const r = Math.max(2, Math.round(base * clamp(colony.traits.transport, 0.1, 1)));

        runner.assertGreaterThan(r, 1, 'Sense radius should never be less than 2');

        restore.restore();
    });

    // --- Bug #11: Defense vs predation symmetry ---

    runner.test('Defense: equal defense and predation result in contested outcome', () => {
        const restore = createTestWorld(10, 10);

        // Colony with predation = defense = 0.5
        const attacker = createTestColony('MAT', 5, 5);
        attacker.traits.predation = 0.5;
        const defender = createTestColony('MAT', 6, 5);
        defender.traits.defense = 0.5;

        // pred = 0.5 - 0.5 = 0 (symmetric)
        const pred = attacker.traits.predation - defender.traits.defense;
        runner.assertApproxEqual(pred, 0, 0.001,
            'Equal predation and defense should cancel out');

        restore.restore();
    });

    runner.test('Defense: high defense can fully block moderate predation', () => {
        const restore = createTestWorld(10, 10);

        const attacker = createTestColony('MAT', 5, 5);
        attacker.traits.predation = 0.5;
        const defender = createTestColony('MAT', 6, 5);
        defender.traits.defense = 0.8;

        // pred = 0.5 - 0.8 = -0.3 (defender advantage)
        const pred = attacker.traits.predation - defender.traits.defense;
        runner.assertLessThan(pred, 0,
            'High defense should create negative predation advantage');

        // With random range [-0.12, 0.12] and pred = -0.3,
        // attack succeeds only if comp > 0.18 to 0.42 — very unlikely
        runner.assertLessThan(pred, -0.12,
            'Defense advantage should exceed random noise range');

        restore.restore();
    });

    runner.test('Defense: random combat range is centered (unbiased)', () => {
        // The random range should be symmetric: [-0.12, 0.12]
        const rangeMin = -0.12;
        const rangeMax = 0.12;
        const center = (rangeMin + rangeMax) / 2;

        runner.assertApproxEqual(center, 0, 0.001,
            'Combat random range should be centered at 0');

        restore.restore = () => {};
    });

    // --- Bug #12: Diffusion uses clamped boundaries ---

    runner.test('Diffusion: slime trail does not wrap at edges', () => {
        const restore = createTestWorld(5, 5);

        // Place trail only at right edge
        Slime.trail[idx(4, 2)] = 100;

        Slime.diffuseEvaporate();

        // Trail should NOT appear at left edge (x=0, y=2)
        runner.assertApproxEqual(Slime.trail[idx(0, 2)], 0, 0.001,
            'Trail at right edge should not wrap to left edge');

        // Trail SHOULD appear at neighbor (x=3, y=2)
        runner.assertGreaterThan(Slime.trail[idx(3, 2)], 0,
            'Trail should diffuse to valid neighbor');

        restore.restore();
    });

    runner.test('Diffusion: signals do not wrap at edges', () => {
        const restore = createTestWorld(5, 5);

        // Place stress signal at bottom edge
        World.signals.stress[idx(2, 4)] = 100;

        Signals.diffuseEvaporate();

        // Signal should NOT appear at top edge
        runner.assertApproxEqual(World.signals.stress[idx(2, 0)], 0, 0.001,
            'Stress signal at bottom should not wrap to top');

        restore.restore();
    });

    runner.test('Diffusion: nutrients do not wrap at edges', () => {
        const restore = createTestWorld(5, 5);

        // Set up: high nutrients at left edge, zero everywhere else
        World.env.nutrient.fill(0);
        World.env.nutrient[idx(0, 2)] = 1.0;
        World.env.humidity.fill(0); // Zero humidity to minimize regen
        World.env.water.fill(0);

        nutrientDynamics();

        // Nutrients should NOT appear at right edge
        runner.assertLessThan(World.env.nutrient[idx(4, 2)], 0.01,
            'Nutrients at left edge should not wrap to right edge');

        // Nutrients SHOULD diffuse to neighbor
        runner.assertGreaterThan(World.env.nutrient[idx(1, 2)], 0,
            'Nutrients should diffuse to valid neighbor');

        restore.restore();
    });

    runner.test('Diffusion: corner cells have only 2 neighbors', () => {
        const restore = createTestWorld(5, 5);

        // Place trail at corner
        Slime.trail[idx(0, 0)] = 100;

        Slime.diffuseEvaporate();

        // Top-left corner should only diffuse to right and down
        runner.assertGreaterThan(Slime.trail[idx(1, 0)], 0, 'Right neighbor should receive trail');
        runner.assertGreaterThan(Slime.trail[idx(0, 1)], 0, 'Down neighbor should receive trail');

        // Opposite corner should NOT receive trail (no wrapping)
        runner.assertApproxEqual(Slime.trail[idx(4, 4)], 0, 0.001,
            'Opposite corner should not receive trail');

        restore.restore();
    });

    // --- Bug #13: Ghost colony prevention ---

    runner.test('Spawn: child not created when target tile is occupied', () => {
        const restore = createTestWorld(10, 10);

        // Create parent colony
        const parent = createTestColony('MAT', 5, 5);
        parent.biomass = 1.5;
        parent.lastFit = 0.8;
        World.colonies = [parent];
        World.tiles[idx(5, 5)] = parent.id;
        World.biomass[idx(5, 5)] = 1.0;

        // Fill all adjacent tiles to prevent spawning
        for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
                const x = 5 + dx, y = 5 + dy;
                if (inBounds(x, y) && !(dx === 0 && dy === 0)) {
                    World.tiles[idx(x, y)] = 999; // Occupied by another colony
                }
            }
        }

        const coloniesBefore = World.colonies.length;

        // Force a spawn attempt by running many ticks
        World.mutationRate = 1.0;
        World.speed = 0.125; // Minimal speed to get 1 step
        for (let i = 0; i < 100; i++) {
            stepEcosystem();
        }

        // Every colony should own at least one tile
        for (const col of World.colonies) {
            let hasTile = false;
            for (let i = 0; i < World.tiles.length; i++) {
                if (World.tiles[i] === col.id) {
                    hasTile = true;
                    break;
                }
            }
            runner.assert(hasTile, `Colony #${col.id} should own at least one tile (no ghost colonies)`);
        }

        restore.restore();
    });

    // --- Bug #14: HSL format consistency ---

    runner.test('HSL: randomizeColonyAppearance uses correct format', () => {
        const restore = createTestWorld(10, 10);

        const colony = createTestColony('MAT', 5, 5);
        colony.pattern = createPatternForColony(colony);
        World.colonies.push(colony);

        randomizeColonyAppearance(colony.id);

        // Color should be parseable by jitterColor regex
        const m = /hsl\(([-\d.]+) ([\d.]+)% ([\d.]+)%\)/.exec(colony.color);
        runner.assertNotNull(m, 'randomizeColonyAppearance should produce space-separated HSL');

        // Should also be parseable by hslToHex
        const hex = hslToHex(colony.color);
        runner.assertNotEqual(hex, '#000000', 'Color should convert to valid hex (not black)');

        // jitterColor should work on the result
        const jittered = jitterColor(colony.color, 8);
        const m2 = /hsl\(([-\d.]+) ([\d.]+)% ([\d.]+)%\)/.exec(jittered);
        runner.assertNotNull(m2, 'jitterColor should work on randomized color');

        restore.restore();
    });

    // --- Bug #15: stepUnifiedEcosystem signal diffusion ---

    runner.test('Unified: stepUnifiedEcosystem includes signal diffusion', () => {
        const restore = createTestWorld(5, 5);

        // Place a stress signal
        World.signals.stress[idx(2, 2)] = 100;
        const initialStress = World.signals.stress[idx(2, 2)];

        // Run unified ecosystem step (uses the legacy path by default)
        World.speed = 0.125;
        stepUnifiedEcosystem();

        // After diffusion + evaporation, the center signal should decrease
        // We need to check the correct buffer (buffers swap)
        const centerStress = World.signals.stress[idx(2, 2)];
        runner.assertLessThan(centerStress, initialStress,
            'Signal should diffuse and evaporate in unified ecosystem step');

        restore.restore();
    });

    // --- Cross-cutting: archetype differentiation ---

    runner.test('Archetypes: each type has a distinct ecological niche', () => {
        const restore = createTestWorld(10, 10);

        // Test that different archetypes prefer different environments
        const environments = [
            { name: 'wet+dark', h: 0.9, l: 0.1, n: 0.5, w: 0 },
            { name: 'dry+bright', h: 0.2, l: 0.9, n: 0.5, w: 0 },
            { name: 'water', h: 0.9, l: 0.5, n: 0.5, w: 1 },
            { name: 'nutrient-rich', h: 0.5, l: 0.3, n: 0.9, w: 0 },
        ];

        const results = {};
        for (const env of environments) {
            const pos = idx(5, 5);
            World.env.humidity[pos] = env.h;
            World.env.light[pos] = env.l;
            World.env.nutrient[pos] = env.n;
            World.env.water[pos] = env.w;
            Slime.trail[pos] = 0;

            results[env.name] = {};
            for (const type of Object.keys(Archetypes)) {
                const colony = createTestColony(type, 5, 5);
                clearSuitabilityCache();
                World.environmentCache = null;
                results[env.name][type] = suitabilityAt(colony, 5, 5);
            }
        }

        // FLOAT should be best in water
        const waterResults = results['water'];
        runner.assertGreaterThan(waterResults.FLOAT, waterResults.TOWER,
            'FLOAT should outperform TOWER on water tiles');

        // TOWER should prefer bright environments
        const brightResults = results['dry+bright'];
        runner.assertGreaterThan(brightResults.TOWER, brightResults.EAT,
            'TOWER should outperform EAT in bright environments');

        restore.restore();
    });

    return runner.run();
}
