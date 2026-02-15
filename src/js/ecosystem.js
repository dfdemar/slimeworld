/* ===== Balance & Starvation ===== */

// Energy calculation constants
window.NON_PHOTOSYNTHETIC_BONUS = 0.5; // Bonus nutrient efficiency for non-photosynthetic archetypes
const NON_PHOTOSYNTHETIC_BONUS = window.NON_PHOTOSYNTHETIC_BONUS;

// Track population changes for adaptive pressure updates
World.lastTypeCounts = null;
World.lastPressureUpdate = 0;

function updateTypePressure(force = false) {
    const counts = {MAT: 0, CORD: 0, TOWER: 0, FLOAT: 0, EAT: 0, SCOUT: 0};
    const idToType = new Map();
    for (const c of World.colonies) {
        idToType.set(c.id, c.type)
    }
    let filled = 0;
    for (let i = 0; i < World.tiles.length; i++) {
        const id = World.tiles[i];
        if (id === -1) continue;
        filled++;
        const t = idToType.get(id);
        if (t) {
            counts[t] = (counts[t] || 0) + 1;
        }
    }
    
    // Check if significant population changes occurred
    let significantChange = force;
    if (World.lastTypeCounts && !force) {
        const totalNow = Math.max(1, filled);
        const totalLast = Math.max(1, Object.values(World.lastTypeCounts).reduce((a, b) => a + b, 0));
        
        for (const t of Object.keys(Archetypes)) {
            const shareNow = (counts[t] || 0) / totalNow;
            const shareLast = (World.lastTypeCounts[t] || 0) / totalLast;
            const changeMagnitude = Math.abs(shareNow - shareLast);
            
            // Trigger update if any type changes by more than 15% of population share
            if (changeMagnitude > 0.15) {
                significantChange = true;
                break;
            }
        }
    }
    
    // Only update if significant change detected or enough time passed
    const timeSinceUpdate = World.tick - World.lastPressureUpdate;
    if (!significantChange && timeSinceUpdate < 30) {
        return; // Skip update
    }
    
    const total = Math.max(1, filled);
    World.typePressure = {};
    for (const t of Object.keys(Archetypes)) {
        const share = (counts[t] || 0) / total;
        const pressure = clamp(1 - 0.7 * share, 0.55, 1.0);
        World.typePressure[t] = pressure;
    }
    
    // Store current counts and update time for next comparison
    World.lastTypeCounts = {...counts};
    World.lastPressureUpdate = World.tick;
}

function starvationSweep() {
    const {nutrient, light} = World.env;
    const idToCol = new Map();
    for (const c of World.colonies) {
        idToCol.set(c.id, c);
    }
    for (let i = 0; i < World.tiles.length; i++) {
        const id = World.tiles[i];
        if (id === -1) continue;
        const col = idToCol.get(id);
        if (!col) {
            World.tiles[i] = -1;
            continue;
        }
        const n = nutrient[i], l = light[i], h = World.env.humidity[i];
        const ps = col.traits.photosym || 0;
        const wn = col.traits.water_need || 0.5;
        const lu = col.traits.light_use || 0.5;
        // Environmental fitness: how well this colony's traits match the local environment
        const waterFit = 1.0 - Math.abs(h - wn);
        const lightFit = ps > 0 ? (1.0 - Math.abs(l - lu)) * ps : (1.0 - 0.4 * l);
        // Non-photosynthetic bonus for nutrient efficiency
        const nonPhotoBonus = ps < 0.1 ? NON_PHOTOSYNTHETIC_BONUS * (1 - ps * 10) : 0;
        const energy = 0.40 * n + 0.25 * lightFit * l + 0.20 * waterFit + 0.15 * nonPhotoBonus * n;
        const cons = Math.min(n, 0.008 * Math.max(0.1, World.biomass[i]));
        nutrient[i] = clamp(n - cons, 0, 1);
        if (energy < 0.35) {
            const deficit = (0.35 - energy);
            const factor = 1 - Math.min(0.8 * deficit, 0.28);
            World.biomass[i] *= factor;
        } else {
            const cap = World.capacity;
            if (World.biomass[i] < cap) {
                World.biomass[i] = Math.min(cap, World.biomass[i] + 0.005 * (energy - 0.35));
            }
        }
        if (World.biomass[i] < 0.05) {
            World.tiles[i] = -1;
        }
    }
}

function nutrientDynamics() {
    const {nutrient, humidity, water} = World.env;
    const Nn = World._nutrientNext;
    const W = World.W, H = World.H;
    const diff = 0.12, regen = 0.01;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            const n = nutrient[i];
            let neighborSum = 0;
            let neighborCount = 0;
            if (x > 0)     { neighborSum += nutrient[y * W + (x - 1)]; neighborCount++; }
            if (x < W - 1) { neighborSum += nutrient[y * W + (x + 1)]; neighborCount++; }
            if (y > 0)     { neighborSum += nutrient[(y - 1) * W + x]; neighborCount++; }
            if (y < H - 1) { neighborSum += nutrient[(y + 1) * W + x]; neighborCount++; }
            const avg = neighborCount > 0 ? neighborSum / neighborCount : n;
            const mixed = (1 - diff) * n + diff * avg;
            const target = clamp(0.2 + 0.6 * humidity[i] + 0.2 * water[i], 0, 1);
            Nn[i] = clamp(mixed + regen * (target - mixed), 0, 1);
        }
    }
    nutrient.set(Nn);
}

/* ===== Suitability & Growth ===== */

// Suitability calculation optimization
World.suitabilityCache = new Map();
World.environmentCache = null;
World.lastEnvironmentTick = -1;

function updateEnvironmentCache() {
    if (World.lastEnvironmentTick === World.tick && World.environmentCache) {
        return; // Cache is still valid
    }
    
    // If cache was manually cleared, force update
    if (!World.environmentCache) {
        World.lastEnvironmentTick = -1;
    }
    
    const {humidity, light, nutrient, water} = World.env;
    const {W, H} = World;
    
    // Pre-calculate averaged environmental fields for all positions
    World.environmentCache = {
        avgHumidity: new Float32Array(W * H),
        avgLight: new Float32Array(W * H),
        nutrient: nutrient, // Direct reference, no averaging needed
        water: water // Direct reference, no averaging needed
    };
    
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = idx(x, y);
            
            // Calculate averaged humidity (center + valid neighbors only)
            let humSum = humidity[i];
            let humCount = 1;
            if (inBounds(x - 1, y)) { humSum += humidity[idx(x - 1, y)]; humCount++; }
            if (inBounds(x + 1, y)) { humSum += humidity[idx(x + 1, y)]; humCount++; }
            if (inBounds(x, y - 1)) { humSum += humidity[idx(x, y - 1)]; humCount++; }
            if (inBounds(x, y + 1)) { humSum += humidity[idx(x, y + 1)]; humCount++; }
            World.environmentCache.avgHumidity[i] = humSum / humCount;
            
            // Calculate averaged light (center + valid neighbors only)
            let lightSum = light[i];
            let lightCount = 1;
            if (inBounds(x - 1, y)) { lightSum += light[idx(x - 1, y)]; lightCount++; }
            if (inBounds(x + 1, y)) { lightSum += light[idx(x + 1, y)]; lightCount++; }
            if (inBounds(x, y - 1)) { lightSum += light[idx(x, y - 1)]; lightCount++; }
            if (inBounds(x, y + 1)) { lightSum += light[idx(x, y + 1)]; lightCount++; }
            World.environmentCache.avgLight[i] = lightSum / lightCount;
        }
    }
    
    World.lastEnvironmentTick = World.tick;
}

function clearSuitabilityCache() {
    World.suitabilityCache.clear();
}

function suitabilityAt(col, x, y) {
    const i = idx(x, y);
    
    // Create cache key based on position, colony type, and changing factors
    // Don't include tick for performance - cache within same tick
    const envHash = Math.round((World.env.humidity[i] + World.env.light[i] + World.env.nutrient[i] + World.env.water[i]) * 1000);
    const trailValue = Math.round(Slime.trail[i] * 100);
    const densityValue = Math.round(World.biomass[i] * 100);
    const pressureValue = Math.round((World.typePressure[col.type] ?? 1) * 1000);
    const cacheKey = `${x},${y},${col.type},${pressureValue},${densityValue},${envHash},${trailValue}`;
    
    // Check cache first
    if (World.suitabilityCache.has(cacheKey)) {
        return World.suitabilityCache.get(cacheKey);
    }
    
    // Update environment cache if needed
    updateEnvironmentCache();
    
    // Use pre-calculated environmental averages with validation
    const h = clamp(World.environmentCache.avgHumidity[i] || 0, 0, 1);
    const l = clamp(World.environmentCache.avgLight[i] || 0, 0, 1);
    const n = clamp(World.environmentCache.nutrient[i] || 0, 0, 1);
    const w = World.environmentCache.water[i] || 0;
    
    const T = col.traits;
    const B = TypeBehavior[col.type] || TypeBehavior.MAT;
    
    // Validate trait values to prevent NaN
    const waterNeed = clamp(T.water_need || 0.5, 0, 1);
    const lightUse = clamp(T.light_use || 0.5, 0, 1);
    const photosym = clamp(T.photosym || 0, 0, 1);
    
    const waterFit = 1.0 - Math.abs(h - waterNeed);
    const lightFit = photosym > 0 ? (0.55 * (1.0 - Math.abs(l - lightUse)) + 0.45 * photosym * l) : (1.0 - 0.6 * l);
    const trSat = Slime.sat(Slime.trail[i]);
    const denom = Math.max(1e-6, (B.nutrientW || 0) + (B.trailW || 0));
    const chemo = ((B.nutrientW || 0) * n + (B.trailW || 0) * trSat) / denom;
    
    // Bonuses/penalties with validation
    let raftBonus = (col.type === 'FLOAT') ? (w ? 0.25 : -0.08) : 0;
    raftBonus += (B.waterAffinity && w) ? B.waterAffinity : 0;
    let towerPenalty = (col.type === 'TOWER' && w) ? -0.12 : 0;
    
    const base = clamp(0.25 * waterFit + 0.25 * lightFit + 0.50 * chemo + raftBonus + towerPenalty, 0, 1);
    
    // Capacity pressure with validation
    const cap = Math.max(0.1, World.capacity || 1.0);
    const density = Math.max(0, World.biomass[i] || 0);
    const capPenalty = -0.35 * clamp((density - cap), 0, 1);
    const pressure = clamp(World.typePressure[col.type] ?? 1, 0.1, 1.5);
    
    const result = clamp(base * pressure + capPenalty, 0, 1);
    
    // Validate final result
    const validResult = (isNaN(result) || !isFinite(result)) ? 0 : result;
    
    // Cache the result but limit cache size to prevent memory issues
    if (World.suitabilityCache.size < 10000) {
        World.suitabilityCache.set(cacheKey, validResult);
    }
    
    return validResult;
}

function tryExpand(col) {
    const B = TypeBehavior[col.type] || TypeBehavior.MAT;
    const cx = col.x, cy = col.y;
    const transport = clamp(col.traits.transport || 0.5, 0.1, 1);
    const r = Math.max(2, Math.round((B.senseR || 5) * transport));
    let best = null, bestScore = -1, bestI = -1;
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const x = cx + dx, y = cy + dy;
            if (!inBounds(x, y)) continue; // Skip out-of-bounds positions
            const i = idx(x, y);
            if (World.tiles[i] !== col.id) continue;
            for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + sx, ny = y + sy;
                if (!inBounds(nx, ny)) continue; // Skip expansion beyond boundaries
                const j = idx(nx, ny);
                const foe = World.tiles[j];
                const s = suitabilityAt(col, nx, ny);
                let ok = false;
                if (foe === -1) ok = true; else if (foe === col.id) ok = false; else {
                    const enemy = World.colonies.find(c => c.id === foe);
                    if (!enemy) ok = true; else {
                        const pred = col.traits.predation - enemy.traits.defense;
                        const comp = s - suitabilityAt(enemy, nx, ny);
                        ok = (pred + comp) > randRange(World.rng, -0.12, 0.12);
                    }
                }
                if (ok) {
                    const trailBias = 0.06 * Slime.sat(Slime.trail[j]);
                    const score = s + trailBias + (foe === -1 ? 0.05 : 0) + World.rng() * 0.02;
                    if (score > bestScore) {
                        bestScore = score;
                        best = {x: nx, y: ny};
                        bestI = j
                    }
                }
            }
        }
    }
    if (best) {
        World.tiles[bestI] = col.id;
        World.biomass[bestI] = clamp(World.biomass[bestI] + 0.2, 0, 2.5);
        col.x = best.x;
        col.y = best.y;
        const dep = (TypeBehavior[col.type]?.deposit || 0.5) * (0.5 + 0.5 * col.traits.flow);
        Slime.trail[bestI] += dep;
        World.env.nutrient[bestI] = clamp(World.env.nutrient[bestI] - 0.03, 0, 1);
        return true;
    }
    return false;
}

function stepEcosystem() {
    const steps = Math.max(1, Math.floor(8 * World.speed));
    for (let s = 0; s < steps; s++) {
        World.tick++;
        if (World.tick % 5 === 0) {
            const drift = 0.002 * World.speed;
            for (let i = 0; i < World.env.humidity.length; i++) {
                World.env.humidity[i] = clamp(World.env.humidity[i] + randRange(World.rng, -drift, drift), 0, 1);
                World.env.light[i] = clamp(World.env.light[i] + randRange(World.rng, -drift, drift), 0, 1);
            }
        }
        const cols = World.colonies;
        if (cols.length > 0) {
            for (let k = 0; k < cols.length; k++) {
                const c = cols[(k + (World.tick % cols.length)) % cols.length];
                if (!c) continue;
                c.age++;
                c.lastFit = suitabilityAt(c, clampX(Math.round(c.x)), clampY(Math.round(c.y)));
                if (!tryExpand(c)) {
                    const decay = (c.lastFit < 0.4) ? 0.985 : 0.992;
                    c.biomass *= decay;
                } else {
                    c.biomass = clamp(c.biomass + 0.01, 0, 3);
                }
                const pressure = World.typePressure[c.type] ?? 1;
                const sporeRate = clamp(c.traits.spore || 0.5, 0.1, 1);
                const spawnP = (0.003 + 0.008 * World.mutationRate) * pressure * sporeRate;
                if (c.biomass > 0.8 && c.lastFit > 0.55 && World.rng() < spawnP) {
                    const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(World.rng() * 4)];
                    const bx = clampX(Math.round(c.x + dir[0] * 2));
                    const by = clampY(Math.round(c.y + dir[1] * 2));
                    const bi = idx(bx, by);
                    if (World.tiles[bi] === -1) {
                        const child = {...c};
                        child.id = World.nextId++;
                        child.parent = c.id;
                        child.gen = c.gen + 1;
                        child.kids = [];
                        child.age = 0;
                        child.x = bx;
                        child.y = by;
                        child.biomass = 0.6;
                        child.traits = mutateTraits(c.traits);
                        child.color = jitterColor(c.color, 14);
                        child.pattern = createPatternForColony(child);
                        World.colonies.push(child);
                        c.kids.push(child.id);
                        World.tiles[bi] = child.id;
                        World.biomass[bi] = 0.4;
                        Slime.trail[bi] += (TypeBehavior[c.type]?.deposit || 0.5);
                    }
                }
            }
        }
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
