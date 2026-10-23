# Orbital Studio

[Open the live website](https://carterbh.github.io/orbital-studio/)

An interactive orbital explorer for all 118 elements, built with plain HTML, CSS, and JavaScript. No build step, dependencies, database, or API keys are required.

The site can be hosted on GitHub Pages by choosing **Deploy from a branch**, branch **main**, folder **/ (root)** under **Settings → Pages**. GitHub Pages serves the static site; `serve.cjs` is only for local previews.

Double-click **Launch Orbital Studio.cmd** or **index.html**. Keep `elements.js`, `app.js`, and `style.css` alongside the HTML. No packages or internet connection are required.

Click any of the 118 elements to immediately load its neutral ground state. **View cloud** is an optional scroll shortcut. Search by name, symbol, or atomic number; Enter selects the first result.

Use the filling diagram beside the cloud: each large sublevel card and each inner orbital box is an independent toggle. An orbital is visible only when its own switch AND its sublevel switch are on. Turning a sublevel off preserves its orbital switch states; changing orbital switches never changes the sublevel switch. **All sublevels on** turns both sets of switches on, even when pressed repeatedly. No modifier key is needed. Focusing hides other groups without changing the selected groups' existing points, sample allocation, camera orientation, zoom, or whole-atom scale. Empty orbitals leave both graphs blank. The radial chart also preserves the full atom's horizontal and vertical scales when focusing.

**Electron dots (one per electron)** overrides the cloud budget and shows exactly one dot for each electron in the selected orbitals. Paired orbitals show two dots, singly occupied orbitals one, and empty orbitals none. It enables continuous resampling at the selected interval, including 0.05 seconds. Each dot independently samples its own orbital; these jumps are probability samples, not trajectories. Turn off continuous resampling to pause. Cutaways and zoom can hide dots. The free orbital explorer represents one electron.

In cloud mode, the sample budget is 6,000, 14,000, or 26,000. Light atoms receive budget/10 samples per electron, so helium gets twice hydrogen's samples at the same setting. Heavy atoms cap the total at the budget; samples carry increased visual density weight to retain electron-count information. Each orbital receives samples proportional to its occupancy. Isolating an orbital keeps its whole-atom allocation instead of assigning it the entire budget. Continuous resampling refreshes a quarter of each visible cloud group per interval.

**Emphasize dense regions** strongly brightens dense lobe interiors and fades sparse haze. It uses relative 3D orbital density, scaled separately for each orbital to preserve outer-shell structure. This is an exaggerated display, not a quantitative brightness scale. It does not change the probability samples or radial graph and is inactive in electron-dot mode.

Drag to rotate, scroll or use the slider to zoom up to 300×, and double-click to reset. All element focus views retain the full-atom camera scale. Small atoms use a common 8 a0 reference extent, making modeled H/He size differences visible; larger atoms fit as whole atoms. **Expand inner shells** applies a logarithmic display lens. The chart and radius statistic retain physical model units. The statistic reports the selected density's radius, not the camera scale.

**Free orbital explorer** keeps its shell, sublevel, and orientation dropdowns, with all 140 real orbitals for n = 1 through 7. Free orbitals automatically fit their view. Cutaways, radial node guides, phase colors, and presets remain available.

The model adds independent occupancy-weighted orbital densities, with hydrogen-like radial functions and approximate Slater screening. These are educational shapes, not self-consistent many-electron or relativistic calculations. Configurations follow NIST/PDG with RSC conventions for Ds and Rg; 109–118 are marked predicted/reference. Open-shell assignments are one Hund-rule teaching arrangement. Sources and limitations appear in the app.

Periodic-table tiles show atomic number, symbol, name, and CIAAW 2024 abridged standard atomic weight (uncertainties omitted). Brackets indicate isotope mass numbers from the IUPAC 4 May 2022 table. Tile widths are bounded from 58 to 74 px with proportional heights and horizontal scrolling on narrow screens.

For a local HTTP preview with Node.js, run `node serve.cjs`, then open http://127.0.0.1:4173. The server binds only to the local machine. Stop it with Ctrl+C.

Run `node model.test.cjs` for model checks and `node app.test.cjs` for integration checks, including all 118 electron counts, H/He distinctions, occupancy-weighted cloud budgets, stable isolation scale and samples, and rendering controls. The local harness does not replace visual browser testing.

The controls sidebar and the main periodic-table/diagram pane scroll independently beneath the fixed header. Scroll chaining is contained within each pane. View cloud scrolls only the main pane to the diagram. On narrow screens, the two independently scrolling panes stack vertically.

The filling cards and cloud legend use Aufbau display order (n + l, then n), while preserving actual ground-state occupancies and their exceptions. Legend entries include electron counts for the current selection, including when phase coloring is enabled.
