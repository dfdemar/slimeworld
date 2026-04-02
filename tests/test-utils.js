/* ===== Test Utilities ===== */

// Simple test framework
class TestRunner {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    test(name, fn) {
        this.tests.push({name, fn});
    }

    async run() {
        console.log(`Running ${this.tests.length} tests...`);

        for (const test of this.tests) {
            try {
                await test.fn();
                this.results.passed++;
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.results.failed++;
                this.results.errors.push({test: test.name, error});
                console.error(`❌ ${test.name}:`, error.message);
            }
        }

        return this.results;
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
    }

    assertNotEqual(actual, expected, message) {
        if (actual === expected) {
            throw new Error(message || `Expected ${actual} to not equal ${expected}`);
        }
    }

    assertApproxEqual(actual, expected, tolerance = 0.001, message) {
        if (Math.abs(actual - expected) > tolerance) {
            throw new Error(message || `Expected ~${expected}, got ${actual} (tolerance: ${tolerance})`);
        }
    }

    assertGreaterThan(actual, expected, message) {
        if (actual <= expected) {
            throw new Error(message || `Expected ${actual} > ${expected}`);
        }
    }

    assertLessThan(actual, expected, message) {
        if (actual >= expected) {
            throw new Error(message || `Expected ${actual} < ${expected}`);
        }
    }

    assertBetween(actual, min, max, message) {
        if (actual < min || actual > max) {
            throw new Error(message || `Expected ${actual} to be between ${min} and ${max}`);
        }
    }

    assertType(value, type, message) {
        if (typeof value !== type) {
            throw new Error(message || `Expected type ${type}, got ${typeof value}`);
        }
    }

    assertArrayLength(array, length, message) {
        if (!Array.isArray(array)) {
            throw new Error(message || 'Expected an array');
        }
        if (array.length !== length) {
            throw new Error(message || `Expected array length ${length}, got ${array.length}`);
        }
    }

    assertNotNull(value, message) {
        if (value == null) {
            throw new Error(message || 'Expected non-null value');
        }
    }
}

// Test data generators
function createTestWorld(width = 32, height = 24) {
    const oldW = World.W, oldH = World.H;
    World.W = width;
    World.H = height;

    // Initialize minimal world state
    World.tiles = new Int32Array(width * height).fill(-1);
    World.biomass = new Float32Array(width * height).fill(0);
    World.env = {
        humidity: new Float32Array(width * height).fill(0.5),
        light: new Float32Array(width * height).fill(0.5),
        nutrient: new Float32Array(width * height).fill(0.5),
        water: new Uint8Array(width * height).fill(0)
    };
    World._nutrientNext = new Float32Array(width * height).fill(0);
    World.colonies = [];
    World.nextId = 1;
    World.tick = 0;
    World.rng = sfc32(1, 2, 3, 4); // Deterministic
    World.typePressure = {};

    Slime.trail = new Float32Array(width * height).fill(0);
    Slime.trailNext = new Float32Array(width * height).fill(0);

    // Initialize signal buffers
    World.signals = {
        stress: new Float32Array(width * height).fill(0),
        aggregation: new Float32Array(width * height).fill(0),
        stressBuf: new Float32Array(width * height).fill(0),
        aggregationBuf: new Float32Array(width * height).fill(0)
    };

    // Mock notify function to prevent DOM errors during tests
    if (typeof window !== 'undefined' && !window.notify) {
        window.notify = () => {
        }; // No-op during tests
    }

    return {
        restore: () => {
            World.W = oldW;
            World.H = oldH;
        }
    };
}

function createTestColony(type = 'MAT', x = 5, y = 5) {
    if (!isValidType(type)) {
        throw new Error(`Invalid test colony type: ${type}`);
    }

    const arch = Archetypes[type];
    const traits = {...arch.base};
    const color = 'hsl(120 80% 50%)';
    const id = World.nextId++;

    return {
        id, type,
        name: arch.name,
        species: 'Test Species',
        x, y, color, traits,
        age: 0,
        biomass: 1.0,
        gen: 0,
        parent: null,
        kids: [],
        lastFit: 0,
        pattern: null
    };
}
