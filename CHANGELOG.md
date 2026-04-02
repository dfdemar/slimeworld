# Changelog

Notable changes to Slimeworld will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [2.7] - 2026-04-02

### Added

- **New Balance Test Suite**: Added `tests/test-balance-fixes.js` for regression testing of ecosystem balance fixes

### Changed

- **UI Polish**: Enhanced UI styling and interactions (`src/js/ui.js`, `src/css/main.css`)
- **Test Infrastructure**: Updated test runner and ecosystem/utility tests for improved coverage

### Fixed

- **Suitability Formula Balance**: Rebalanced weights from 88% chemotaxis/6%/6% to 50% chemotaxis/25% water/25% light, making environmental
  traits meaningful for colony behavior
- **Starvation Energy Formula**: Enhanced energy calculation to incorporate `water_need`, `light_use`, and non-photosynthetic bonuses
  instead of only `photosym` trait, improving niche differentiation
- **Spore Trait Unused**: Spawn probability now multiplies by colony's `spore` trait, making reproduction rate vary by archetype
- **Transport Trait Unused**: Transport now scales effective sense radius (`r = max(2, round(baseSenseR * transport))`), affecting how far
  colonies can explore
- **Defense Imbalance**: Changed defense multiplier from 0.7 to 1.0 and centered random combat range (-0.12, 0.12), making combat outcomes
  symmetric
- **Diffusion Boundary Inconsistency**: Updated slime and signal diffusion systems to respect impenetrable boundaries consistently with
  colony clamping behavior
- **Ghost Colonies**: Fixed failed spawn attempts that created colony objects without assigned tiles
- **Signal Diffusion Missing**: Added missing `Signals.diffuseEvaporate()` call in unified ecosystem stepping
- **HSL Color Format**: Fixed `randomizeColonyAppearance()` to use correct space-separated HSL format for compatibility with color picker

## [2.6] - 2025-08-23

### Fixed

- **Canvas Redraw Frequency**
  - Fixed inefficient canvas rendering with unnecessary redraws and overlay regeneration. The previous system performed full canvas redraws
    on every frame regardless of changes, with direct `draw()` calls bypassing the existing `needRedraw` optimization flag. Overlay
    ImageData was regenerated every frame even when settings hadn't changed. Implemented comprehensive rendering optimization by replacing
    direct `draw()` calls with consistent `needRedraw = true` usage, added overlay state change detection to prevent unnecessary
    regeneration, implemented overlay ImageData caching with automatic invalidation, and added canvas reuse for overlay rendering. This
    significantly reduces CPU usage on large worlds while maintaining identical visual output.
- **Suitability Calculation Overhead**
  - Fixed high computational overhead from frequent `suitabilityAt()` calls (up to 968 times per colony per tick). The previous system
    performed redundant neighbor sampling and expensive coordinate calculations without caching. Implemented comprehensive performance
    optimization with spatial caching (`World.suitabilityCache`), pre-calculated environmental fields (`World.environmentCache`), and batch
    processing of coordinate calculations. Added smart cache keys based on environmental state, input validation to prevent NaN results, and
    proper cache invalidation. This significantly reduces computational overhead for large worlds while maintaining identical simulation
    accuracy and deterministic behavior.
- **Random Number Generator State**
  - Fixed non-deterministic behavior in save/load scenarios where RNG state was not preserved. The previous system didn't serialize RNG
    state and mixed deterministic (`World.rng()`) with non-deterministic (`Math.random()`) random sources. Enhanced `sfc32()` with state
    serialization methods, added `World.getRNGState()` and `World.setRNGState()` utilities, updated save/load system to preserve RNG state,
    and replaced all `Math.random()` calls for complete consistency. This guarantees deterministic reproduction across save/load operations
    and eliminates non-deterministic edge cases.
- **Type Pressure Calculation Timing**
  - Fixed slow response to rapid population changes that could create temporary monocultures. The previous system updated type pressure
    every 30 ticks, allowing single archetypes to dominate before balancing kicked in. Implemented adaptive pressure system that checks
    population every 5 ticks, detects significant changes (>15% population share difference), and updates pressure immediately when needed
    while maintaining performance during stable periods. This prevents ecosystem imbalances while optimizing computation.
- **Boundary Consistency with Impenetrable Barriers**
  - Fixed inconsistent boundary handling by implementing uniform boundary clamping throughout the simulation. The previous system had mixed
    boundary behaviors that needed to be standardized to treat world edges as impenetrable barriers. Implemented comprehensive boundary
    clamping with utility functions (`clampX()`, `clampY()`, `clampCoords()`, `idxClamped()`, `inBounds()`), updated environment averaging
    to only include valid neighbors within bounds, modified colony expansion logic to respect boundary barriers, and enhanced coordinate
    calculations to use boundary clamping. This creates realistic ecosystem constraints where organisms cannot expand beyond simulation
    boundaries while maintaining consistent environmental calculations across all systems.
- **Memory Leak in Pattern Caching**
  - Fixed potential memory leak where colony canvas patterns (8x8 textures) were not properly cleaned up when colonies died or were removed.
    Added `cleanupColonyPattern()` function that clears canvas contents and sets pattern reference to null. Integrated cleanup in all colony
    removal points: periodic ecosystem cleanup, manual colony removal, and modular system cleanup. Added comprehensive tests to verify fix
    and prevent regression.

## [2.5] - 2025-08-22

### Added

- **Major UI Redesign**: Complete overhaul of user interface with modern, responsive design
- **Live Simulation Stats**: Replaced Legend panel with real-time metrics showing:
  - Colony count, total biomass, tick rate, and max generation
  - Population breakdown by archetype with color-coded display
- **Enhanced Inspector Panel**:
  - Now hidden by default and slides in when colony is selected
  - Age display with meaningful time units (hours, days, weeks)
  - Tile pattern preview showing colony's color and texture up close
  - Kill colony button with confirmation dialog
  - Split colony functionality creating parent/child relationships
  - Randomize color/pattern button for visual variety
  - Close button for better UX
- **Archetype Tooltips**: Interactive hover tooltips on spawn buttons showing:
  - Detailed trait percentages for each archetype
  - Smooth fade-in animations and professional styling
- **Responsive Design**: Improved layout that adapts to different screen sizes
- **Comprehensive Test Coverage**: New test suites for all UI functionality and bug prevention
- **Enhanced Bug Testing**: Added tests for canvas redraw optimization, pattern memory usage, and ecosystem balance

### Changed

- **Button Design**: Flatter, more modern button styling with consistent spacing
- **Color Scheme**: Enhanced visual hierarchy with better contrast
- **Layout Structure**: Better organized CSS with logical groupings
- **Animation System**: Smooth transitions for Inspector panel visibility
- **Code Organization**: Clean separation of UI functions with improved maintainability

### Fixed

- **Nutrient Starvation Balance**: EAT archetype now properly excels in nutrient-rich environments
  - Added 50% bonus nutrient efficiency for non-photosynthetic archetypes
  - Enhanced energy formula balances ecological niches between archetype types
  - EAT excels in nutrient-rich/low-light, TOWER excels in high-light conditions
- Inspector panel real-time updates now work correctly
- Age values display proper time units instead of raw ticks
- Better error handling for all new UI actions
- Improved accessibility with proper button labels and tooltips

## [2.4] - 2025-08-22

### Added

- Comprehensive README with technical architecture and usage details
- BUGS.md file for tracking known issues and performance considerations
- CHANGELOG.md for tracking project changes
- Modular code organization with separate JavaScript files
- Organized directory structure (src/js/, src/css/)
- Comprehensive test suite with web-based test runner
- Bug fix verification tests (`test-bugfixes.js`)
- Starvation balance investigation and test coverage

### Updated

- **README.md**: Updated file structure to reflect modular architecture, enhanced testing section, version bump to 2.4
- **CLAUDE.md**: Updated development environment, file structure, testing framework details, and current state to August 2025
- **Documentation**: All references to monolithic architecture updated to reflect current modular structure

### Changed

- Refactored monolithic index.html into multiple organized files
- Split JavaScript code into logical modules:
  - `utils.js` - PRNG, helpers, and noise generation
  - `archetypes.js` - Colony type definitions and behaviors
  - `world.js` - Core world system and slime trail mechanics
  - `environment.js` - Procedural world generation
  - `colonies.js` - Colony creation and management
  - `ecosystem.js` - Balance, starvation, and growth mechanics
  - `renderer.js` - Canvas rendering and visual patterns
  - `ui.js` - User interface and interaction handling
  - `events.js` - Event listeners and initialization
  - `diagnostics.js` - Testing and debugging functions
- Extracted CSS into separate `main.css` file

### Fixed

- **Inspector Panel Real-time Updates**: Added missing `refreshInspectorRealtime()` call to main animation loop
- **Mini-map Division Bug**: Corrected coordinate calculation in `ui.js` (removed incorrect `y=Math.floor(i/World.H)` calculation)
- **Test Suite Failures**: Resolved 12 test failures including missing functions, DOM mocking, and array initialization
- **Test Infrastructure**: Added `assertNotEqual` method, enhanced DOM element mocking, fixed global references
- Added comprehensive test coverage for boundary wrapping consistency, type pressure edge cases, and RNG determinism

### Investigated

- **Nutrient Starvation Balance**: Confirmed energy formula imbalance affecting EAT archetype
  - Issue: EAT (no photosynthesis) lacks compensation in nutrient-rich, low-light environments
  - Formula `0.7*nutrient + 0.3*photosym*light` requires 0.5 nutrients for ALL archetypes without light
  - Analysis shows photosynthetic types (TOWER) have advantage with light availability
  - Added comprehensive test coverage to document current behavior

## [2.3] - Previous Version

### Features

- Real-time inspector with live colony statistics
- Per-colony procedural pattern generation
- Six distinct organism archetypes with specialized behaviors
- Dynamic environmental overlays (humidity, light, nutrients, water, trails)
- Chemical trail system with diffusion and evaporation
- Competitive displacement and evolutionary mechanics
- Save/load functionality with JSON serialization
- Manual colony spawning and interactive controls

---

*Note: This changelog starts from the refactoring milestone. Previous version history was not formally tracked.*
