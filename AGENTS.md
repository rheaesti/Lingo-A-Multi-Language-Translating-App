# Repository Guidelines

## Project Structure & Module Organization
- `server.js`: Express + Socket.IO backend (port `5000`).
- `pages/`: Next.js routes (`index.js`, `users.js`, `chat/[id].js`, `_app.js`, `_document.js`).
- `styles/`: Global Tailwind styles (`globals.css`).
- Config: `next.config.js`, `tailwind.config.js`, `postcss.config.js`.
- Docs: `README.md`, `DATABASE.md`. Env: `.env` (do not commit secrets).

## Build, Test, and Development Commands
- `npm run dev`: Run backend and Next.js concurrently (ports `5000` and `3000`).
- `npm run server`: Start only the backend (`server.js`).
- `npm run client`: Start only the Next.js dev server.
- `npm run build`: Build Next.js for production.
- `npm start`: Start Next.js in production. Run backend separately: `node server.js`.
- Debug Socket.IO: `DEBUG=socket.io:* npm run dev`.

## Coding Style & Naming Conventions
- Language: JavaScript (ES2019+), React 18, Next.js 14.
- Indentation: 2 spaces; keep files formatted (use Prettier defaults).
- React components: PascalCase; hooks and utilities: camelCase.
- Pages follow Next.js routing (`pages/users.js`, `pages/chat/[id].js`).
- Use Tailwind classes in JSX; put global CSS in `styles/globals.css`.
- Socket events: use snake_case event names consistently on client and server.

## Testing Guidelines
- No automated tests are configured yet. For new features:
  - Prefer Jest + React Testing Library for UI; add `__tests__/` mirroring `pages/`.
  - For backend, add unit tests near `server.js` or under `__tests__/server/`.
  - Add simple e2e via Playwright or Cypress when feasible.
  - Ensure `npm run build` passes and core flows work locally.

## Commit & Pull Request Guidelines
- Commits: short, imperative present (e.g., `fix login redirect`, `add typing indicator`).
- PRs must include: clear description, rationale, screenshots or short clips for UI, reproduction steps, and any new env vars.
- Link related issues. Note breaking changes. Update `README.md` when adding Socket.IO events or new routes.

## Security & Configuration Tips
- Store secrets in `.env.local`; never commit real keys.
- Keep CORS origins in `server.js` aligned with the Next.js URL.
- Confirm ports `3000` and `5000` are free; document changes if you reconfigure.
