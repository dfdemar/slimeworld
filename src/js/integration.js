/* ===== Integration Layer for Legacy and Modular Systems ===== */

/**
 * Configuration to enable/disable modular trait system
 */
const SystemConfig = {
    useModularTraits: false, // Set to true to enable new system
    hybridMode: false, // Use both systems for comparison
    debugMode: false // Enable detailed logging
};

/**
 * Legacy compatibility wrapper
 */
class LegacyWrapper {
    /**
     * Convert legacy archetype to modular format
     */
    static convertLegacyArchetype(legacyCode) {
        const legacy = Archetypes[legacyCode];
        const legacyBehavior = TypeBehavior[legacyCode];

        if (!legacy || !legacyBehavior) return null;

        return new Archetype(
            legacyCode,
            legacy.name,
            `Legacy archetype: ${legacy.name}`,
            legacy.base,
            legacyBehavior
        );
    }

    /**
     * Convert modular colony back to legacy format
     */
    static convertToLegacy(modularColony) {
        return {
            id: modularColony.id,
            type: modularColony.type,
            name: modularColony.name,
            species: modularColony.species,
            x: modularColony.x,
            y: modularColony.y,
            color: modularColony.color,
            traits: modularColony.traits,
            age: modularColony.age,
            biomass: modularColony.biomass,
            gen: modularColony.gen,
            parent: modularColony.parent,
            kids: modularColony.kids,
            lastFit: modularColony.lastFit,
            pattern: modularColony.pattern
        };
    }
}

/**
 * Unified colony creation function
 */
function createUnifiedColony(type, x, y, parent = null) {
    if (SystemConfig.useModularTraits) {
        const modularColony = createModularColony(type, x, y, parent);
        if (modularColony) {
            modularColony.pattern = createPatternForColony(modularColony);
            World.colonies.push(modularColony);

            const X = clampX(x), Y = clampY(y);
            const i = idx(X, Y);
            World.tiles[i] = modularColony.id;
            World.biomass[i] = Math.max(World.biomass[i] || 0, 0.4);

            const behavior = modularColony.archetype.behaviors;
            Slime.trail[i] = (Slime.trail[i] || 0) + (behavior.deposit || 0.5);

            return modularColony;
        }
        return null;
    } else {
        // Use legacy system
        return newColony(type, x, y, parent);
    }
}

/**
 * Unified suitability calculation
 */
function calculateUnifiedSuitability(colony, x, y) {
    if (SystemConfig.useModularTraits && colony.archetype) {
        return calculateModularSuitability(colony, x, y);
    } else {
        return suitabilityAt(colony, x, y);
    }
}

/**
 * Unified trait mutation
 */
function mutateUnifiedTraits(traits, parentColony = null) {
    if (SystemConfig.useModularTraits && parentColony && parentColony.archetype) {
        return parentColony.archetype.mutateTraits(traits, World.mutationRate, World.rng);
    } else {
        return mutateTraits(traits);
    }
}

/**
 * Performance comparison system
 */
class PerformanceComparison {
    constructor() {
        this.metrics = {
            legacy: {time: 0, calls: 0},
            modular: {time: 0, calls: 0}
        };
    }

    timeFunction(name, fn, ...args) {
        const start = performance.now();
        const result = fn(...args);
        const end = performance.now();

        this.metrics[name].time += (end - start);
        this.metrics[name].calls++;

        return result;
    }

    getReport() {
        const legacy = this.metrics.legacy;
        const modular = this.metrics.modular;

        return {
            legacy: {
                totalTime: legacy.time,
                avgTime: legacy.calls > 0 ? legacy.time / legacy.calls : 0,
                calls: legacy.calls
            },
            modular: {
                totalTime: modular.time,
                avgTime: modular.calls > 0 ? modular.time / modular.calls : 0,
                calls: modular.calls
            },
            speedup: legacy.time > 0 ? modular.time / legacy.time : 0
        };
    }

    reset() {
        this.metrics.legacy = {time: 0, calls: 0};
        this.metrics.modular = {time: 0, calls: 0};
    }
}

const performanceComparison = new PerformanceComparison();

/**
 * Hybrid testing mode
 */
function runHybridComparison(colony, x, y) {
    if (!SystemConfig.hybridMode) return null;

    const legacySuitability = performanceComparison.timeFunction('legacy', suitabilityAt, colony, x, y);

    let modularSuitability = 0;
    if (colony.archetype) {
        modularSuitability = performanceComparison.timeFunction('modular', calculateModularSuitability, colony, x, y);
    }

    if (SystemConfig.debugMode) {
        console.log(`Suitability comparison at (${x},${y}): Legacy=${legacySuitability.toFixed(3)}, Modular=${modularSuitability.toFixed(3)}`);
    }

    return {
        legacy: legacySuitability,
        modular: modularSuitability,
        difference: Math.abs(legacySuitability - modularSuitability)
    };
}

/**
 * Migration utilities
 */
class SystemMigration {
    /**
     * Migrate existing colonies to modular system
     */
    static migrateToModular() {
        for (const colony of World.colonies) {
            if (!colony.archetype) {
                const modularArch = ModularArchetypes[colony.type];
                if (modularArch) {
                    colony.archetype = modularArch;
                    // Validate and normalize traits
                    for (const traitName in colony.traits) {
                        const trait = TraitRegistry[traitName];
                        if (trait) {
                            colony.traits[traitName] = trait.validate(colony.traits[traitName]);
                        }
                    }
                }
            }
        }
        SystemConfig.useModularTraits = true;
        console.log(`Migrated ${World.colonies.length} colonies to modular system`);
    }

    /**
     * Revert to legacy system
     */
    static revertToLegacy() {
        for (const colony of World.colonies) {
            delete colony.archetype;
        }
        SystemConfig.useModularTraits = false;
        console.log('Reverted to legacy trait system');
    }

    /**
     * Validate system consistency
     */
    static validateConsistency() {
        const issues = [];

        for (const colony of World.colonies) {
            // Check trait completeness
            const expectedTraits = Object.keys(TraitRegistry);
            for (const traitName of expectedTraits) {
                if (typeof colony.traits[traitName] !== 'number') {
                    issues.push(`Colony ${colony.id}: Missing or invalid trait ${traitName}`);
                }
                if (colony.traits[traitName] < 0 || colony.traits[traitName] > 1) {
                    issues.push(`Colony ${colony.id}: Trait ${traitName} out of range: ${colony.traits[traitName]}`);
                }
            }

            // Check archetype consistency
            if (SystemConfig.useModularTraits) {
                if (!colony.archetype) {
                    issues.push(`Colony ${colony.id}: Missing archetype in modular mode`);
                } else if (colony.archetype.code !== colony.type) {
                    issues.push(`Colony ${colony.id}: Archetype code mismatch`);
                }
            }
        }

        return issues;
    }
}

/**
 * Enhanced ecosystem step with unified system
 */
function stepUnifiedEcosystem() {
    const steps = Math.max(1, Math.floor(8 * World.speed));

    for (let s = 0; s < steps; s++) {
        World.tick++;

        // Environmental drift
        if (World.tick % 5 === 0) {
            const drift = 0.002 * World.speed;
            for (let i = 0; i < World.env.humidity.length; i++) {
                World.env.humidity[i] = clamp(World.env.humidity[i] + randRange(World.rng, -drift, drift), 0, 1);
                World.env.light[i] = clamp(World.env.light[i] + randRange(World.rng, -drift, drift), 0, 1);
            }
        }

        // Colony processing
        const cols = World.colonies;
        if (cols.length > 0) {
            for (let k = 0; k < cols.length; k++) {
                const c = cols[(k + (World.tick % cols.length)) % cols.length];
                if (!c) continue;

                c.age++;

                // Use unified suitability calculation
                const clampedX = clampX(Math.round(c.x));
                const clampedY = clampY(Math.round(c.y));
                c.lastFit = calculateUnifiedSuitability(c, clampedX, clampedY);

                // Try expansion
                if (!tryExpand(c)) {
                    const decay = (c.lastFit < 0.4) ? 0.985 : 0.992;
                    c.biomass *= decay;
                } else {
                    c.biomass = clamp(c.biomass + 0.01, 0, 3);
                }

                // Reproduction
                const pressure = World.typePressure[c.type] ?? 1;
                const sporeRate = clamp(c.traits.spore || 0.5, 0.1, 1);
                const spawnP = (0.003 + 0.008 * World.mutationRate) * pressure * sporeRate;

                if (c.biomass > 0.8 && c.lastFit > 0.55 && World.rng() < spawnP) {
                    const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(World.rng() * 4)];
                    const bx = clampX(Math.round(c.x + dir[0] * 2));
                    const by = clampY(Math.round(c.y + dir[1] * 2));
                    const bi = idx(bx, by);
                    if (World.tiles[bi] === -1) {
                        const child = createUnifiedColony(c.type, bx, by, c);
                        if (child) {
                            c.kids.push(child.id);
                        }
                    }
                }
            }
        }

        // Standard ecosystem processes
        Slime.diffuseEvaporate();
        Signals.diffuseEvaporate();
        starvationSweep();
        nutrientDynamics();

        // Check for adaptive type pressure updates every 5 ticks
        if (World.tick % 5 === 0) updateTypePressure();
        // Clear suitability cache periodically to prevent memory growth and ensure fresh calculations
        if (World.tick % 30 === 0) clearSuitabilityCache();
        if (World.tick % 60 === 0) {
            const alive = new Set(World.tiles);
            // Clean up patterns before removing colonies
            for (const colony of World.colonies) {
                if (!alive.has(colony.id)) {
                    cleanupColonyPattern(colony);
                }
            }
            World.colonies = World.colonies.filter(c => alive.has(c.id));
        }
    }
}

// Export unified interface
window.SystemConfig = SystemConfig;
window.LegacyWrapper = LegacyWrapper;
window.SystemMigration = SystemMigration;
window.createUnifiedColony = createUnifiedColony;
window.calculateUnifiedSuitability = calculateUnifiedSuitability;
window.stepUnifiedEcosystem = stepUnifiedEcosystem;
window.performanceComparison = performanceComparison;
