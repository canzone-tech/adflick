# Current UI design system

Use existing `apps/web/app/globals.css` shared CSS tokens and components. Observed tokens: `--ink: #19152d`, `--muted: #77738b`, `--purple: #7555e8`, `--pink: #ed63a8`, `--line: #ece9f5`, `--bg: #f8f7fc`, `--white: #fff`. Existing typography DM Sans / Manrope, CMS shell/sidebar, responsive breakpoint rules and status labels are design references, not configurable business policies.

New UI must provide visible loading, empty, error and success states, accessible keyboard focus/labels, and tested TV/web-specific layouts. Do not copy prototype metrics as live business data. Real browser visual UAT remains separate from build checks.
