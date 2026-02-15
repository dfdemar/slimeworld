/* ===== Interaction & UI ===== */
let needRedraw = true;
let stepping = false;
let last = 0;

function formatAge(ticks) {
    // Convert simulation ticks to more meaningful time units
    // Assuming 1 tick = ~1 hour in simulation time
    if (ticks < 24) {
        return ticks + (ticks === 1 ? ' hour' : ' hours');
    } else if (ticks < 24 * 7) {
        const days = Math.floor(ticks / 24);
        const hours = ticks % 24;
        return days + (days === 1 ? ' day' : ' days') + (hours > 0 ? ', ' + hours + 'h' : '');
    } else {
        const weeks = Math.floor(ticks / (24 * 7));
        const days = Math.floor((ticks % (24 * 7)) / 24);
        return weeks + (weeks === 1 ? ' week' : ' weeks') + (days > 0 ? ', ' + days + 'd' : '');
    }
}

function loop(ts) {
    last = ts;
    if (!World.paused || stepping) {
        stepEcosystem();
        refreshLiveStats(); // Update live stats after each simulation step
        needRedraw = true;
        stepping = false;
    }
    if (needRedraw) {
        draw();
        needRedraw = false;
    }
    refreshInspectorRealtime(); // Update inspector stats in real-time
    requestAnimationFrame(loop);
}

function playPause() {
    World.paused = !World.paused;
    document.getElementById('btnPause').textContent = World.paused ? '▶️ Play' : '⏸️ Pause';
}

function reset() {
    const seed = parseInt(document.getElementById('seed').value || '1337', 10);
    const size = document.getElementById('worldSize').value;
    setupWorld(seed, size);
    World.paused = false;
    document.getElementById('btnPause').textContent = '⏸️ Pause';
    resize();
    clearOverlayCache(); // Clear overlay cache for new world
    needRedraw = true;
}

function colonyAtCanvas(px, py) {
    const cell = viewScale;
    const x = Math.floor(px / cell), y = Math.floor(py / cell);
    if (!inBounds(x, y)) return null;
    const id = World.tiles[idx(x, y)];
    if (id === -1) return null;
    return World.colonies.find(c => c.id === id) || null;
}

let selectedId = null;

function updateInspector(c) {
    const overlay = document.getElementById('overlay');
    const el = document.getElementById('inspector');
    const stats = document.getElementById('stats');
    const rt = document.getElementById('rtStats');
    const actions = document.getElementById('inspectorActions');
    const tilePreview = document.getElementById('tilePreview');
    
    if (!c) {
        // Hide inspector when no colony is selected
        overlay.classList.add('hidden');
        overlay.classList.remove('collapsed');
        el.textContent = 'Click a colony to inspect.';
        stats.innerHTML = '';
        actions.style.display = 'none';
        tilePreview.style.display = 'none';
        selectedId = null;
        const mv = document.getElementById('miniView');
        if (mv) {
            const mctx = mv.getContext('2d');
            mctx.clearRect(0, 0, mv.width, mv.height);
        }
        if (rt) rt.innerHTML = '';
        return;
    }

    // Show inspector when a colony is selected
    overlay.classList.remove('hidden', 'collapsed');
    selectedId = c.id;
    const name = (c?.name) || (Archetypes[c?.type]?.name) || (c?.type) || 'Unknown';
    el.innerHTML = '<div style="display:flex; align-items:center; gap:8px;">' +
        '<div style="width:14px;height:14px;border-radius:50%;border:2px solid #fff; background:' + c.color + '"></div>' +
        '<div>' +
        '<b>' + name + '</b> <span class="small">(#' + c.id + ')</span><br/>' +
        '<span class="small italic">Species: ' + (c.species || '—') + '</span><br/>' +
        '<span class="small">Gen ' + c.gen + ' • Age <span id="inspectorAge">' + formatAge(c.age) + '</span></span>' +
        '</div>' +
        '</div>' +
        '<div style="margin-top:6px" class="small">Parent: ' + (c.parent ?? '—') + ' • Kids: <span id="inspectorKids">' + c.kids.length + '</span></div>';

    function bar(label, val) {
        const w = Math.round(100 * clamp(val, 0, 1));
        return '<div class="stat"><div style="display:flex; justify-content:space-between"><span>' + label + '</span><span>' + w + '%</span></div><div style="height:8px;background:#0c1426;border-radius:999px;margin-top:6px;overflow:hidden"><div style="width:' + w + '%;height:100%;background:linear-gradient(90deg, var(--accent), var(--accent-2))"></div></div></div>'
    }

    stats.innerHTML = bar('Water Need', c.traits.water_need) + bar('Light Use', c.traits.light_use) + bar('Photosymbiosis', c.traits.photosym) + bar('Transport', c.traits.transport) + bar('Predation', c.traits.predation) + bar('Defense', c.traits.defense) + bar('Spore Rate', c.traits.spore) + bar('Flow', c.traits.flow);
    
    // Add action buttons
    actions.innerHTML = `
        <div class="btn-group" style="margin-top: 8px;">
            <button id="btnKillColony" class="btn-danger" title="Kill this colony">Kill</button>
            <button id="btnSplitColony" class="btn-primary" title="Split this colony in two">Split</button>
            <div style="position: relative; flex: 1; display: flex;">
                <button id="btnChangeColor" title="Change colony color" style="flex: 1;">🎨 Color</button>
                <input type="color" id="colorPicker" 
                       style="position: absolute; top: 100%; left: 0; opacity: 0; pointer-events: none;" 
                       value="${hslToHex(c.color)}">
            </div>
        </div>
    `;
    actions.style.display = 'block';
    
    // Add event listeners for action buttons
    document.getElementById('btnKillColony').onclick = () => killColony(c.id);
    document.getElementById('btnSplitColony').onclick = () => splitColony(c.id);
    document.getElementById('btnChangeColor').onclick = () => showColorPicker(c.id);
    
    // Add color picker event listeners for real-time updates
    const colorPicker = document.getElementById('colorPicker');
    colorPicker.onchange = () => changeColonyColor(c.id, colorPicker.value, true); // Show notification on final change
    colorPicker.oninput = () => changeColonyColor(c.id, colorPicker.value, false); // No notification during real-time updates
    
    // Render tile preview
    renderTilePreview(c);
    tilePreview.style.display = 'block';
    
    refreshInspectorRealtime(true);
}

function refreshInspectorRealtime(force = false) {
    const rt = document.getElementById('rtStats');
    if (!rt) return;
    if (!selectedId) {
        rt.innerHTML = '';
        return;
    }
    const col = World.colonies.find(c => c.id === selectedId);
    if (!col) {
        rt.innerHTML = '';
        return;
    }
    
    // Update real-time age and kids count
    const ageElement = document.getElementById('inspectorAge');
    const kidsElement = document.getElementById('inspectorKids');
    if (ageElement) {
        ageElement.textContent = formatAge(col.age);
    }
    if (kidsElement) {
        kidsElement.textContent = col.kids.length;
    }
    let tiles = 0, mass = 0, fit = 0, minFit = 1, maxFit = 0;
    for (let i = 0; i < World.tiles.length; i++) {
        if (World.tiles[i] === col.id) {
            tiles++;
            mass += World.biomass[i];
            const x = (i % World.W), y = Math.floor(i / World.W);
            const s = suitabilityAt(col, x, y);
            fit += s;
            minFit = Math.min(minFit, s);
            maxFit = Math.max(maxFit, s);
        }
    }
    fit = tiles ? fit / tiles : 0;
    rt.innerHTML = ''
        + '<div class="kv"><div class="k">Tiles</div><div class="v">' + tiles + '</div><div class="k">Mass</div><div class="v">' + mass.toFixed(2) + '</div></div>'
        + '<div class="kv"><div class="k">Avg Suit</div><div class="v">' + fit.toFixed(2) + '</div><div class="k">Fit Range</div><div class="v">' + minFit.toFixed(2) + '–' + maxFit.toFixed(2) + '</div></div>';
    // mini view
    const mv = document.getElementById('miniView');
    if (mv) {
        const mctx = mv.getContext('2d');
        if (mctx) {
            mctx.clearRect(0, 0, mv.width, mv.height);
            mctx.fillStyle = '#0a1326';
            mctx.fillRect(0, 0, mv.width, mv.height);
            mctx.fillStyle = '#9fb4ff';
            const sx = mv.width / World.W, sy = mv.height / World.H;
            for (let i = 0; i < World.tiles.length; i++) {
                if (World.tiles[i] === col.id) {
                    const x = (i % World.W), y = Math.floor(i / World.W);
                    mctx.globalAlpha = 0.8;
                    mctx.fillRect(x * sx, y * sy, Math.max(1, sx), Math.max(1, sy));
                }
            }
        }
    }
}

/* ===== Live Stats & Metrics ===== */
let lastTickTime = 0;
let ticksInSecond = [];

function refreshLiveStats() {
    // Track tick rate
    const now = performance.now();
    if (lastTickTime > 0) {
        ticksInSecond.push(now);
        ticksInSecond = ticksInSecond.filter(t => now - t < 1000);
    }
    lastTickTime = now;

    // Update colony count
    document.getElementById('statColonies').textContent = World.colonies.length;

    // Calculate total biomass
    let totalBiomass = 0;
    for (let i = 0; i < World.biomass.length; i++) {
        totalBiomass += World.biomass[i];
    }
    document.getElementById('statBiomass').textContent = totalBiomass.toFixed(1);

    // Update tick rate
    const tickRate = ticksInSecond.length;
    document.getElementById('statTickRate').textContent = tickRate + '/s';

    // Update max generation
    const maxGen = World.colonies.reduce((max, c) => Math.max(max, c.gen || 0), 0);
    document.getElementById('statMaxGen').textContent = maxGen;

    // Update archetype breakdown
    const breakdown = {};
    World.colonies.forEach(c => {
        const type = c.type || 'Unknown';
        if (!breakdown[type]) {
            breakdown[type] = { count: 0, color: c.color, name: Archetypes[type]?.name || type };
        }
        breakdown[type].count++;
    });

    const breakdownList = document.getElementById('breakdownList');
    breakdownList.innerHTML = '';
    
    Object.entries(breakdown)
        .sort(([,a], [,b]) => b.count - a.count)
        .forEach(([type, data]) => {
            const item = document.createElement('div');
            item.className = 'breakdown-item';
            
            const name = document.createElement('div');
            name.className = 'breakdown-name';
            
            const dot = document.createElement('div');
            dot.className = 'breakdown-dot';
            dot.style.background = data.color;
            
            name.appendChild(dot);
            name.appendChild(document.createTextNode(data.name));
            
            const count = document.createElement('div');
            count.className = 'breakdown-count';
            count.textContent = data.count;
            
            item.appendChild(name);
            item.appendChild(count);
            breakdownList.appendChild(item);
        });
}

/* ===== Archetype Tooltips ===== */
function showArchetypeTooltip(archetypeCode) {
    const archetype = Archetypes[archetypeCode];
    if (!archetype) return;

    const tooltip = document.getElementById('archetypeTooltip');
    const title = document.getElementById('tooltipTitle');
    const traits = document.getElementById('tooltipTraits');

    title.textContent = archetype.name + ' (' + archetype.code + ')';
    
    traits.innerHTML = '';
    Object.entries(archetype.base).forEach(([trait, value]) => {
        const row = document.createElement('div');
        row.className = 'trait-row';
        
        const name = document.createElement('span');
        name.className = 'trait-name';
        name.textContent = trait.replace('_', ' ');
        
        const val = document.createElement('span');
        val.className = 'trait-value';
        val.textContent = Math.round(value * 100) + '%';
        
        row.appendChild(name);
        row.appendChild(val);
        traits.appendChild(row);
    });
    
    tooltip.style.display = 'block';
}

function hideArchetypeTooltip() {
    const tooltip = document.getElementById('archetypeTooltip');
    tooltip.style.display = 'none';
}

/* ===== Inspector Actions ===== */
function killColony(colonyId) {
    if (!confirm('Are you sure you want to kill this colony? This action cannot be undone.')) {
        return;
    }
    
    const colony = World.colonies.find(c => c.id === colonyId);
    if (!colony) {
        notify('Colony not found', 'error', 2000);
        return;
    }

    // Remove all tiles belonging to this colony
    for (let i = 0; i < World.tiles.length; i++) {
        if (World.tiles[i] === colonyId) {
            World.tiles[i] = -1;
            World.biomass[i] = 0;
        }
    }

    // Clean up pattern before removal to prevent memory leaks
    cleanupColonyPattern(colony);
    
    // Remove colony from world
    World.colonies = World.colonies.filter(c => c.id !== colonyId);
    
    // Remove this colony from parent's children list
    if (colony.parent) {
        const parent = World.colonies.find(c => c.id === colony.parent);
        if (parent) {
            parent.kids = parent.kids.filter(id => id !== colonyId);
        }
    }

    // Close inspector since colony is dead
    updateInspector(null);
    refreshLiveStats();
    
    notify(`${colony.name} colony eliminated`, 'warn', 1500);
}

function splitColony(colonyId) {
    const parentColony = World.colonies.find(c => c.id === colonyId);
    if (!parentColony) {
        notify('Colony not found', 'error', 2000);
        return;
    }

    // Find all tiles belonging to the parent colony
    const parentTiles = [];
    for (let i = 0; i < World.tiles.length; i++) {
        if (World.tiles[i] === colonyId) {
            const x = i % World.W;
            const y = Math.floor(i / World.W);
            parentTiles.push({x, y, index: i});
        }
    }

    if (parentTiles.length < 2) {
        notify('Colony too small to split', 'error', 2000);
        return;
    }

    // Split tiles roughly in half
    const halfSize = Math.ceil(parentTiles.length / 2);
    const childTiles = parentTiles.slice(halfSize);
    
    // Create child colony at first child tile location
    const firstChildTile = childTiles[0];
    const childColony = newColony(parentColony.type, firstChildTile.x, firstChildTile.y, parentColony);
    
    if (!childColony) {
        notify('Failed to create child colony', 'error', 2000);
        return;
    }

    // Reset the child's age to 0 as specified
    childColony.age = 0;

    // Reassign child tiles to the new colony
    childTiles.forEach(tile => {
        World.tiles[tile.index] = childColony.id;
        // Split biomass between parent and child
        const currentBiomass = World.biomass[tile.index];
        World.biomass[tile.index] = currentBiomass * 0.6; // Child gets 60% of biomass
    });

    // Reduce parent biomass on remaining tiles
    parentTiles.slice(0, halfSize).forEach(tile => {
        World.biomass[tile.index] *= 0.8; // Parent retains 80% of biomass
    });

    updateInspector(parentColony); // Refresh inspector for parent
    refreshLiveStats();
    
    notify(`${parentColony.name} split into parent (#${parentColony.id}) and child (#${childColony.id})`, 'good', 2000);
}

function showColorPicker(colonyId) {
    const colorPicker = document.getElementById('colorPicker');
    if (!colorPicker) return;
    
    // Make the color picker visible and clickable, positioned below the button
    colorPicker.style.opacity = '1';
    colorPicker.style.pointerEvents = 'auto';
    colorPicker.style.width = '40px';
    colorPicker.style.height = '40px';
    colorPicker.style.border = '2px solid var(--accent)';
    colorPicker.style.borderRadius = '4px';
    colorPicker.style.cursor = 'pointer';
    
    // Trigger the color picker dialog
    colorPicker.click();
    
    // Hide the picker when it loses focus or after color selection
    setTimeout(() => {
        const hideColorPicker = () => {
            colorPicker.style.opacity = '0';
            colorPicker.style.pointerEvents = 'none';
            colorPicker.removeEventListener('blur', hideColorPicker);
        };
        
        colorPicker.addEventListener('blur', hideColorPicker);
        
        // Also hide after a delay if user doesn't interact
        setTimeout(hideColorPicker, 10000);
    }, 100);
}

function changeColonyColor(colonyId, hexColor, showNotification = false) {
    const colony = World.colonies.find(c => c.id === colonyId);
    if (!colony) {
        if (showNotification) notify('Colony not found', 'error', 2000);
        return;
    }

    // Convert hex color back to HSL format
    colony.color = hexToHsl(hexColor);
    colony.pattern = createPatternForColony(colony);

    // Update inspector to show new color (but don't recreate the whole thing to avoid losing the color picker)
    if (selectedId === colonyId) {
        // Just update the color dot in the inspector header
        const colorDot = document.querySelector('#inspector div[style*="background"]');
        if (colorDot) {
            colorDot.style.background = colony.color;
        }
        // Update the tile preview
        renderTilePreview(colony);
    }
    
    // Trigger redraw to show the new color on the canvas
    needRedraw = true;
    
    if (showNotification) {
        notify('Colony color updated', 'good', 1000);
    }
}

function randomizeColonyAppearance(colonyId) {
    const colony = World.colonies.find(c => c.id === colonyId);
    if (!colony) return;
    
    // Generate new random color (space-separated HSL to match codebase format)
    colony.color = `hsl(${(World.rng() * 360).toFixed(1)} 70.0% 50.0%)`;
    
    // Generate new pattern
    colony.pattern = createPatternForColony(colony);
    
    // Update inspector if this colony is selected
    if (selectedId === colonyId) {
        updateInspector(colony);
    }
    
    needRedraw = true;
}

function renderTilePreview(colony) {
    const canvas = document.getElementById('tileCanvas');
    const ctx = canvas.getContext('2d');
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill with colony color
    ctx.fillStyle = colony.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply the colony's pattern at a large scale
    if (colony.pattern) {
        ctx.globalAlpha = 0.8;
        ctx.globalCompositeOperation = 'overlay';
        
        // Scale the 8x8 pattern to fill the 80x80 canvas
        const scaleX = canvas.width / colony.pattern.width;
        const scaleY = canvas.height / colony.pattern.height;
        
        for (let y = 0; y < Math.ceil(scaleY); y++) {
            for (let x = 0; x < Math.ceil(scaleX); x++) {
                ctx.drawImage(
                    colony.pattern,
                    x * colony.pattern.width,
                    y * colony.pattern.height,
                    colony.pattern.width,
                    colony.pattern.height
                );
            }
        }
        
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }
}

function savePNG() {
    const a = document.createElement('a');
    a.download = 'slimeworld.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
}

function saveJSON() {
    const data = {
        W: World.W,
        H: World.H,
        env: {
            humidity: Array.from(World.env.humidity),
            light: Array.from(World.env.light),
            nutrient: Array.from(World.env.nutrient),
            water: Array.from(World.env.water)
        },
        tiles: Array.from(World.tiles),
        biomass: Array.from(World.biomass),
        colonies: World.colonies,
        nextId: World.nextId,
        tick: World.tick,
        // Include RNG state for determinism
        rngState: World.getRNGState()
    };
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'slimeworld_save.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            const sizeStr = data.W + 'x' + data.H;
            setupWorld(1337, sizeStr);
            World.env.humidity.set(data.env.humidity);
            World.env.light.set(data.env.light);
            World.env.nutrient.set(data.env.nutrient);
            World.env.water.set(data.env.water);
            World.tiles.set(data.tiles);
            World.biomass.set(data.biomass);
            World.colonies = data.colonies.map(c => ({...c, pattern: createPatternForColony(c)}));
            World.nextId = data.nextId;
            World.tick = data.tick;
            // Restore RNG state for determinism
            if (data.rngState) {
                World.setRNGState(data.rngState);
            }
            refreshLiveStats();
            clearOverlayCache(); // Clear overlay cache since world state changed
            needRedraw = true;
            notify('Loaded save', 'warn', 1000);
        } catch (err) {
            console.error(err);
            notify('Load failed', 'error', 2000);
        }
    };
    reader.readAsText(file);
}
