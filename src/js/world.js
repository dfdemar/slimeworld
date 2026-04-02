/* ===== World System ===== */
const World = {
    W: 160, H: 90,
    env: {humidity: [], light: [], nutrient: [], water: []},
    tiles: [], biomass: [],
    colonies: [], nextId: 1,
    rng: null, field: null,
    tick: 0, paused: false, speed: 1.2,
    mutationRate: 0.18, capacity: 1.0,
    hover: {x: -1, y: -1}, typePressure: {},
    signals: {
        stress: null,
        aggregation: null,
        stressBuf: null,
        aggregationBuf: null
    },
};

const Slime = {
    trail: null, trailNext: null,
    params: {evap: 0.985, diff: 0.35, trailScale: 0.03},
    clear() {
        this.trail.fill(0)
    },
    sat(v) {
        return 1 - Math.exp(-this.params.trailScale * v)
    },
    diffuseEvaporate() {
        const {evap, diff} = this.params;
        const W = World.W, H = World.H;
        const T = this.trail, N = this.trailNext;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                const self = T[i] || 0;
                let neighborSum = 0;
                let neighborCount = 0;
                if (x > 0)     { neighborSum += T[y * W + (x - 1)] || 0; neighborCount++; }
                if (x < W - 1) { neighborSum += T[y * W + (x + 1)] || 0; neighborCount++; }
                if (y > 0)     { neighborSum += T[(y - 1) * W + x] || 0; neighborCount++; }
                if (y < H - 1) { neighborSum += T[(y + 1) * W + x] || 0; neighborCount++; }
                const avg = neighborCount > 0 ? neighborSum / neighborCount : self;
                const mixed = (1 - diff) * self + diff * avg;
                N[i] = mixed * evap;
            }
        }
        // swap buffers
        this.trail = N;
        this.trailNext = T;
    },
};

const Signals = {
    params: {evap: 0.98, diff: 0.25, stressScale: 0.02, aggregationScale: 0.035},
    clear() {
        if (World.signals.stress && World.signals.aggregation) {
            World.signals.stress.fill(0);
            World.signals.aggregation.fill(0);
        }
    },
    satStress(v) {
        return 1 - Math.exp(-this.params.stressScale * v);
    },
    satAggregation(v) {
        return 1 - Math.exp(-this.params.aggregationScale * v);
    },
    diffuseEvaporate() {
        // Skip if signals not initialized yet
        if (!World.signals.stress || !World.signals.aggregation || !World.signals.stressBuf || !World.signals.aggregationBuf) {
            return;
        }
        
        const {evap, diff} = this.params;
        const W = World.W, H = World.H;
        
        // Stress signals diffusion
        const stress = World.signals.stress, stressBuf = World.signals.stressBuf;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                const self = stress[i] || 0;
                let neighborSum = 0;
                let neighborCount = 0;
                if (x > 0)     { neighborSum += stress[y * W + (x - 1)] || 0; neighborCount++; }
                if (x < W - 1) { neighborSum += stress[y * W + (x + 1)] || 0; neighborCount++; }
                if (y > 0)     { neighborSum += stress[(y - 1) * W + x] || 0; neighborCount++; }
                if (y < H - 1) { neighborSum += stress[(y + 1) * W + x] || 0; neighborCount++; }
                const avg = neighborCount > 0 ? neighborSum / neighborCount : self;
                stressBuf[i] = ((1 - diff) * self + diff * avg) * evap;
            }
        }

        // Aggregation signals diffusion
        const aggregation = World.signals.aggregation, aggregationBuf = World.signals.aggregationBuf;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                const self = aggregation[i] || 0;
                let neighborSum = 0;
                let neighborCount = 0;
                if (x > 0)     { neighborSum += aggregation[y * W + (x - 1)] || 0; neighborCount++; }
                if (x < W - 1) { neighborSum += aggregation[y * W + (x + 1)] || 0; neighborCount++; }
                if (y > 0)     { neighborSum += aggregation[(y - 1) * W + x] || 0; neighborCount++; }
                if (y < H - 1) { neighborSum += aggregation[(y + 1) * W + x] || 0; neighborCount++; }
                const avg = neighborCount > 0 ? neighborSum / neighborCount : self;
                aggregationBuf[i] = ((1 - diff) * self + diff * avg) * evap;
            }
        }
        
        // Swap buffers
        World.signals.stress = stressBuf;
        World.signals.stressBuf = stress;
        World.signals.aggregation = aggregationBuf;
        World.signals.aggregationBuf = aggregation;
    },
};

function idx(x, y) {
    return y * World.W + x
}

// Boundary clamping utilities for impenetrable barriers
function clampX(x) {
    return Math.max(0, Math.min(x, World.W - 1));
}

function clampY(y) {
    return Math.max(0, Math.min(y, World.H - 1));
}

function clampCoords(x, y) {
    return [clampX(x), clampY(y)];
}

function idxClamped(x, y) {
    return clampY(y) * World.W + clampX(x);
}

function inBounds(x, y) {
    return x >= 0 && x < World.W && y >= 0 && y < World.H;
}

function setupWorld(seed, sizeStr) {
    const [W, H] = sizeStr.split('x').map(n => parseInt(n, 10));
    World.W = W;
    World.H = H;
    World.tiles = new Int32Array(W * H).fill(-1);
    World.biomass = new Float32Array(W * H).fill(0);
    World.env.humidity = new Float32Array(W * H);
    World.env.light = new Float32Array(W * H);
    World.env.nutrient = new Float32Array(W * H);
    World.env.water = new Uint8Array(W * H);
    World._nutrientNext = new Float32Array(W * H);
    World.colonies = [];
    World.nextId = 1;
    World.tick = 0;
    const noise = ValueNoise(seed);
    World.rng = noise.r;
    World.field = noise;
    
    // Add RNG state management utilities
    World.getRNGState = function() {
        return World.rng && World.rng.getState ? World.rng.getState() : null;
    };
    
    World.setRNGState = function(state) {
        if (World.rng && World.rng.setState && state) {
            World.rng.setState(state);
        }
    };
    Slime.trail = new Float32Array(W * H);
    Slime.trailNext = new Float32Array(W * H);
    
    // Initialize chemical signaling system
    World.signals.stress = new Float32Array(W * H);
    World.signals.aggregation = new Float32Array(W * H);
    World.signals.stressBuf = new Float32Array(W * H);
    World.signals.aggregationBuf = new Float32Array(W * H);
    
    buildEnvironment();
    seedInitialColonies();
    updateTypePressure(true); // Force initial calculation
    // Initialize suitability optimization caches
    if (!World.suitabilityCache) World.suitabilityCache = new Map();
    World.environmentCache = null;
    World.lastEnvironmentTick = -1;
    refreshLiveStats();
}
