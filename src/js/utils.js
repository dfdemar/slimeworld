/* ===== PRNG & Helpers ===== */
function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19
    }
    return function () {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return (h ^ h >>> 16) >>> 0
    }
}

function sfc32(a, b, c, d) {
    const state = {a: a|0, b: b|0, c: c|0, d: d|0};
    
    const rng = function () {
        var t = (state.a + state.b | 0) + state.d | 0;
        state.d = state.d + 1 | 0;
        state.a = state.b ^ state.b >>> 9;
        state.b = state.c + (state.c << 3) | 0;
        state.c = (state.c << 21 | state.c >>> 11);
        state.c = state.c + t | 0;
        return (t >>> 0) / 4294967296;
    };
    
    // Expose state for serialization
    rng.getState = () => ({...state});
    rng.setState = (newState) => {
        state.a = newState.a|0;
        state.b = newState.b|0;
        state.c = newState.c|0;
        state.d = newState.d|0;
    };
    
    return rng;
}

function clamp(v, a, b) {
    return v < a ? a : (v > b ? b : v)
}

function lerp(a, b, t) {
    return a + (b - a) * t
}

function smoothstep(t) {
    return t * t * (3 - 2 * t)
}

function randRange(r, min, max) {
    return min + r() * (max - min)
}

// Color conversion utilities
function hslToHex(hsl) {
    // Parse HSL string like "hsl(120 50% 60%)"
    const match = /hsl\(([-\d.]+) ([\d.]+)% ([\d.]+)%\)/.exec(hsl);
    if (!match) return '#000000';
    
    let [_, h, s, l] = match;
    h = parseFloat(h);
    s = parseFloat(s) / 100;
    l = parseFloat(l) / 100;
    
    // Convert HSL to RGB
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r, g, b;
    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    // Convert to hex
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hexToHsl(hex) {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    
    if (delta !== 0) {
        s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        
        switch (max) {
            case r:
                h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
                break;
            case g:
                h = ((b - r) / delta + 2) * 60;
                break;
            case b:
                h = ((r - g) / delta + 4) * 60;
                break;
        }
    }
    
    return `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
}

function percentile(arr, p) {
    const a = Array.from(arr);
    a.sort((x, y) => x - y);
    const i = Math.max(0, Math.min(a.length - 1, Math.floor(p * (a.length - 1))));
    return a[i];
}

function notify(msg, level = 'info', ttl = 1600) {
    const el = document.getElementById('alert');
    el.className = 'show';
    if (level === 'warn') el.classList.add('warn');
    if (level === 'error') el.classList.add('error');
    el.textContent = msg;
    clearTimeout(notify._t);
    notify._t = setTimeout(() => {
        el.className = '';
    }, ttl);
}

/* ===== ValueNoise (fractal) ===== */
function ValueNoise(seed) {
    const hash = xmur3(seed.toString());
    const r = sfc32(hash(), hash(), hash(), hash());
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]]
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

    function grad(ix, iy) {
        const v = perm[(ix + perm[iy & 255]) & 255];
        return v / 255
    }

    function noise2D(x, y) {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const xf = x - x0, yf = y - y0;
        const v00 = grad(x0, y0), v10 = grad(x0 + 1, y0), v01 = grad(x0, y0 + 1), v11 = grad(x0 + 1, y0 + 1);
        const u = smoothstep(xf), v = smoothstep(yf);
        const x1 = lerp(v00, v10, u);
        const x2 = lerp(v01, v11, u);
        return lerp(x1, x2, v);
    }

    function fractal2D(x, y, oct = 4, lac = 2.0, gain = 0.5) {
        let amp = 1, freq = 1, sum = 0, norm = 0;
        for (let i = 0; i < oct; i++) {
            sum += amp * noise2D(x * freq, y * freq);
            norm += amp;
            amp *= gain;
            freq *= lac
        }
        return sum / norm; // 0..1
    }

    return {noise2D, fractal2D, r};
}
