# Finance icon refinement
User approved a refined cream/teal interface with consistent named icons, four shortcuts, compact summary, one expense action and details on demand. Existing authorization permits implementation without another approval loop.

Approaches: replacing finance navigation risks regression; adding every tool to home recreates clutter. Chosen: refine the existing workspace with inline SVG and four direct read-only routes to existing screens.

Scope: shortcuts السجل، الالتزامات، الادخار، خطتي; consistent local SVG icons on primary action, nav, summary and recent movements; responsive light/dark styling. Keep three stable tabs. Preserve explanatory period labels, money signs, source distinctions and all existing accounting functions.

Progress indicators must have an explicit denominator and clamp visuals only, never financial values. No denominator means no misleading progress bar. No new financial persistence. No third-party icon dependency.

Acceptance: each shortcut reaches its existing target, navigation creates no cash movements and changes no balances; quick save and undo remain correct. Mobile 320/390, tablet820 and desktop1440 light/dark do not overflow; visible icon labels and keyboard focus. Test full suite and inspect actual screenshots before publishing.
