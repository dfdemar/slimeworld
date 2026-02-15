# Known Bugs and Issues

This file tracks suspected bugs and issues in the Slimeworld Evolution Simulator.

## Confirmed Bugs

*No confirmed bugs at this time.*

## Potential Issues

*No potential issues at this time.*

## Performance Considerations

*No performance considerations at this time - all identified issues have been fixed or addressed.*

## Fixed Issues

### 1. Type Pressure Calculation Timing ✅ FIXED
**Location:** `updateTypePressure()` function (ecosystem.js:11, integration.js:322)
**Issue:** Called every 30 ticks, allowing rapid population changes to create temporary monocultures before pressure adjustment
**Details:** Fixed-interval updates were too slow to respond to rapid population explosions, allowing single archetypes to dominate temporarily and disrupt ecosystem balance
**Fix Applied:** Implemented adaptive pressure system with intelligent update timing:
- Checks population every 5 ticks but only calculates pressure when needed
- Detects significant population changes (>15% share difference) and updates immediately
- Falls back to 30-tick maximum interval if no changes detected
- Tracks population history to compare changes efficiently
- Added force parameter for initialization
**Impact:** Prevents temporary monocultures by responding quickly to population explosions while maintaining performance during stable periods
**Status:** Fixed in v2.6 - comprehensive tests verify responsive pressure updates and ecosystem balance maintenance

### 2. Random Number Generator State ✅ FIXED
**Location:** Global `World.rng` usage and save/load system (utils.js:14-36, ui.js:458-510, world.js:82-94)
**Issue:** RNG state not preserved in save/load operations and inconsistent use of deterministic vs non-deterministic random sources
**Details:** Save/load system didn't include RNG state, causing deterministic simulations to become non-reproducible after loading. Some code used `Math.random()` instead of `World.rng()`, creating mixed deterministic/non-deterministic behavior.
**Fix Applied:** Enhanced RNG state management with complete determinism:
- Modified `sfc32()` to expose `getState()` and `setState()` methods for serialization
- Added `World.getRNGState()` and `World.setRNGState()` utility functions
- Updated save/load system to preserve and restore RNG state
- Replaced all `Math.random()` calls with `World.rng()` for consistency
- Enhanced RNG with internal state management for reliable serialization
**Impact:** Guarantees complete determinism and reproducibility across save/load operations, eliminating non-deterministic behavior in edge cases
**Status:** Fixed in v2.6 - comprehensive tests verify RNG state preservation and deterministic behavior

### 3. Boundary Consistency with Impenetrable Barriers ✅ FIXED
**Location:** Various functions using coordinate calculations (world.js, ecosystem.js, colonies.js, integration.js)
**Issue:** Inconsistent boundary handling where some systems used wrapping while others used different approaches, creating mixed boundary behaviors
**Details:** The simulation needed consistent boundary treatment where world edges act as impenetrable barriers that organisms cannot cross, rather than wrapping around to the opposite side. This ensures realistic ecosystem constraints and prevents unrealistic "teleportation" effects.
**Fix Applied:** Implemented consistent boundary clamping throughout the simulation:
- Added boundary clamping functions: `clampX()`, `clampY()`, `clampCoords()`, `idxClamped()`, `inBounds()`
- Updated environment averaging to only include valid neighbors within bounds
- Modified colony expansion logic to respect boundary barriers and prevent out-of-bounds movement
- Updated colony spawning and coordinate calculations to use boundary clamping
- Enhanced suitability calculation to handle edge cases with fewer neighbors
- Applied fixes to both legacy (`ecosystem.js`, `colonies.js`) and modular (`integration.js`) systems
**Impact:** Creates realistic boundary constraints where world edges act as impenetrable barriers, preventing organisms from expanding beyond simulation boundaries while maintaining consistent environmental calculations
**Status:** Fixed in v2.6 - comprehensive tests verify boundary clamping behavior and barrier effectiveness

### 4. Suitability Calculation Overhead ✅ FIXED
**Location:** `suitabilityAt()` function (ecosystem.js:173-222)
**Issue:** High computational overhead from frequent calls with redundant neighbor sampling and coordinate calculations
**Details:** Function called up to 968 times per colony per tick (for sense radius 5), with each call sampling 5 neighboring cells and performing expensive coordinate wrapping calculations. No caching of results led to repeated identical computations.
**Fix Applied:** Implemented comprehensive performance optimization system:
- Added spatial caching with `World.suitabilityCache` to store computed results based on environmental state
- Pre-calculated averaged environmental fields in `World.environmentCache` updated per tick
- Eliminated redundant `idxWrapped()` calculations through batch processing in environment cache
- Cache management with size limits (10,000 entries) and periodic clearing (every 30 ticks)
- Smart cache keys including position, colony type, pressure, biomass, environment hash, and trail values
- Enhanced input validation to prevent NaN results from extreme values
- Environment cache invalidation when manually cleared for testing
**Impact:** Significantly reduces computational overhead for large worlds while maintaining identical simulation accuracy and deterministic behavior
**Status:** Fixed in v2.6 - comprehensive tests verify performance gains, NaN handling, and environmental change detection

### 5. Memory Leak in Pattern Caching ✅ FIXED
**Location:** Pattern generation system (renderer.js:92)
**Issue:** No explicit cleanup mechanism for colony patterns when colonies are removed
**Details:** While patterns are small (8x8), long-running simulations with many colony births/deaths could accumulate memory
**Fix Applied:** Added `cleanupColonyPattern()` function that properly cleans up canvas patterns and sets pattern property to null. Integrated cleanup calls in all colony removal locations:
- `ecosystem.js:244-250` - During periodic cleanup sweep
- `ui.js:319-320` - During manual colony removal
- `integration.js:322-330` - During modular system cleanup
**Impact:** Prevents gradual memory accumulation over time
**Status:** Fixed in v2.6 - comprehensive tests verify fix and prevent regression

### 7. Suitability Formula Dominated by Chemotaxis (88%) ✅ FIXED
**Location:** `suitabilityAt()` in ecosystem.js
**Issue:** The suitability base score used weights of 6% waterFit, 6% lightFit, and 88% chemo, making environmental traits nearly irrelevant
**Fix Applied:** Rebalanced weights to 25% waterFit, 25% lightFit, 50% chemo, giving environmental traits meaningful impact on colony behavior
**Status:** Fixed in v2.7 - archetypes now exhibit distinct environmental niche preferences

### 8. Starvation Energy Ignores Most Colony Traits ✅ FIXED
**Location:** `starvationSweep()` in ecosystem.js
**Issue:** The energy formula only used `photosym`, ignoring `water_need`, `light_use`, and other traits
**Fix Applied:** Energy formula now incorporates `water_need` (matched against humidity), `light_use` (matched against light for photosynthetic colonies), and non-photosynthetic bonus. Formula: `0.40 * nutrient + 0.25 * lightFit * light + 0.20 * waterFit + 0.15 * nonPhotoBonus * nutrient`
**Status:** Fixed in v2.7 - colony survival now depends on environmental niche matching

### 9. `spore` Trait Is Never Used ✅ FIXED
**Location:** `stepEcosystem()` spawn probability in ecosystem.js
**Issue:** Spawn probability ignored the colony's `spore` trait
**Fix Applied:** Spawn probability now multiplied by `clamp(colony.traits.spore, 0.1, 1)`, making high-spore archetypes reproduce faster. Also applied to `stepUnifiedEcosystem()` in integration.js.
**Status:** Fixed in v2.7 - reproduction rate now varies by archetype

### 10. `transport` Trait Is Never Used ✅ FIXED
**Location:** `tryExpand()` in ecosystem.js
**Issue:** The `transport` trait had no effect on expansion or movement
**Fix Applied:** Transport now scales the effective sense radius: `r = max(2, round(baseSenseR * transport))`. High-transport colonies (CORD: 0.85) sense farther; low-transport colonies (TOWER: 0.5) have reduced range.
**Status:** Fixed in v2.7 - movement efficiency now varies by archetype

### 11. Defense Inherently Weaker Than Predation ✅ FIXED
**Location:** `tryExpand()` combat resolution in ecosystem.js
**Issue:** Defense was multiplied by 0.7, making it impossible to fully defend. Random range was biased toward attacker.
**Fix Applied:** Defense multiplier changed from 0.7 to 1.0 (symmetric). Random range changed from (-0.15, 0.1) to (-0.12, 0.12) (centered).
**Status:** Fixed in v2.7 - combat outcomes are now symmetric and fair

### 12. Diffusion Systems Wrap While Colonies Clamp ✅ FIXED
**Location:** `Slime.diffuseEvaporate()`, `Signals.diffuseEvaporate()` in world.js; `nutrientDynamics()` in ecosystem.js
**Issue:** All three diffusion systems used toroidal wrapping while colonies used clamped boundaries
**Fix Applied:** Replaced wrapping neighbor access with explicit boundary checks. Edge cells now use only valid neighbors (2-3 instead of 4), with averaged diffusion to maintain energy balance.
**Status:** Fixed in v2.7 - diffusion respects impenetrable boundaries consistently

### 13. Ghost Colonies From Failed Spawns ✅ FIXED
**Location:** `stepEcosystem()` child colony creation in ecosystem.js
**Issue:** Child colonies were added to `World.colonies` even when no tile was available
**Fix Applied:** Moved the empty-tile check before colony creation. Colony is only instantiated and pushed if `World.tiles[bi] === -1`. Also fixed in `stepUnifiedEcosystem()`.
**Status:** Fixed in v2.7 - no ghost colonies created

### 14. `randomizeColonyAppearance` Uses Wrong HSL Format ✅ FIXED
**Location:** `randomizeColonyAppearance()` in ui.js
**Issue:** Used comma-separated HSL format incompatible with codebase regex
**Fix Applied:** Changed to space-separated format with `.toFixed(1)` for consistent formatting: `hsl(120.0 70.0% 50.0%)`
**Status:** Fixed in v2.7 - color inheritance and picker work correctly after randomization

### 15. `stepUnifiedEcosystem` Missing Signal Diffusion ✅ FIXED
**Location:** `stepUnifiedEcosystem()` in integration.js
**Issue:** `Signals.diffuseEvaporate()` was not called, causing signal buildup
**Fix Applied:** Added `Signals.diffuseEvaporate()` call after `Slime.diffuseEvaporate()`, matching the legacy `stepEcosystem()` pattern.
**Status:** Fixed in v2.7 - signals diffuse correctly in unified ecosystem

### 6. Canvas Redraw Frequency ✅ FIXED
**Location:** Rendering system (renderer.js:238-303, ui.js:22-37, events.js:86-91)
**Issue:** Inefficient canvas rendering with unnecessary redraws and overlay regeneration
**Details:** Full canvas redraw occurred on every frame regardless of changes. Direct `draw()` calls bypassed the existing `needRedraw` optimization flag. Overlay ImageData was regenerated on every frame even when overlay settings hadn't changed, creating temporary canvases repeatedly without reuse.
**Fix Applied:** Implemented comprehensive rendering optimization system:
- Replaced all direct `draw()` calls with `needRedraw = true` for consistent optimization
- Added overlay state change detection to prevent unnecessary overlay regeneration
- Implemented overlay ImageData caching with automatic invalidation when settings change
- Added canvas reuse for overlay rendering to eliminate repeated canvas creation
- Enhanced cache invalidation for environment changes (reseed, seasonal pulse, load save)
- Maintained existing `needRedraw` flag system while ensuring all code paths use it correctly
**Impact:** Significantly reduces CPU usage on large worlds by preventing unnecessary canvas redraws and overlay regeneration while maintaining identical visual output
**Status:** Fixed in v2.6 - comprehensive tests verify rendering optimization and needRedraw flag usage

---
*Last updated: 2026-02-15*
