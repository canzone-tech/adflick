# ADFLICK design system — single workspace shell

**Architecture decision:** No page is allowed to invent a different operations sidebar or topbar. Implement navigation in `apps/web/components/app-chrome.tsx` and the corresponding styles in `apps/web/app/app-chrome.css`. `apps/web/app/layout.tsx` owns the shell on operations routes. `/login` is a public authentication exception. When SRS v1.0 public landing/registration is implemented, use an explicit public route group/layout rather than extending the operations chrome to marketing pages.

## Canonical workspace interface

- Desktop/tablet >860px: 248px sticky scrollable sidebar, 74px sticky topbar, centered fluid 1536px content cap.
- Mobile <=860px: accessible toggle, close button backdrop, Escape closes, focus stays inside open navigation on Tab, drawer closes on route transition and link click.
- Navigation entries and selected route are derived from the single `WORKSPACE_LINKS` array; `aria-current="page"` only on the selected link. Avoid duplicate sidebars/menus in leaf pages. Sidebar/topbar are **never** manually created by individual pages.
- Use `DM Sans` body and `Manrope` headings; retain existing tokens `--ink`, `--muted`, `--purple`, `--pink`, `--line`, `--bg`, `--white`. Shared padding, radius, hover and focus states come from AppChrome rather than leaf CSS.
- Page-specific titles, forms, status messages and tables remain within the shared content container. Leaf shell padding is removed centrally, while page-specific panels and form styles remain until integration.
- Public, member, admin and operations audiences may require separate navigation **configs** and hard RBAC data filters, but should share brand tokens, accessible components and responsive layout contracts. A visible menu link is not authorization.
- Always implement visible loading/empty/error/success states; server-side RBAC and session checks protect data. Never invent live data, hardcode income claims or mistake synthetic fixture UIs for production-ready experiences.

## Required UI quality gates

- `scripts/check-ui-shell.mjs`: protects single shared navigation, root integration, required route coverage, and absence of duplicated `<aside className="sidebar">` page chrome.
- `scripts/browser-uat.mjs`: real Chrome/Chromium route checks for single sidebar + topbar, correct selected navigation, login isolation, 320/390/768/1280px viewport behavior, mobile open/close, no navigation clipping, keyboard-accessible drawer.
- Per route real-browser functional UAT: sign-in, 401/403, form validation, keyboard focus, loading, no-data, errors, success, persistence and visual screenshots at target breakpoints. CI smoke is **not** equivalent to final design sign-off.
- Actual screenshots must be reviewed for mobile/table/sidebar clipping and touch targets before approving any page. Fix code in GitHub, rerun exact-SHA Backend/Frontend/Release Evidence and owner local `npm run verify`.

## Current implementation boundary

This shared shell corrects **navigation and layout consistency** only. Existing campaign/fleet/CMS/delivery/playback/scheduler preview-only screens still need genuine MySQL-backed functionality and must not be described as complete. SRS v1.0 member/admin/public UX will use the same design system after its functional requirements are implemented. Production stays blocked.
