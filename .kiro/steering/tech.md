# Technology Stack

## Core Technologies
- TypeScript (ES2020 target, strict mode)
- Vite 6.x (build tool and dev server)
- HTML5 Canvas API (rendering)
- No UI framework - vanilla TypeScript with DOM manipulation

## Build & Development

### Commands
```bash
npm install      # Install dependencies
npm run dev      # Start dev server (port 3000, auto-opens browser)
npm run build    # TypeScript compile + Vite production build
npm run preview  # Preview production build
```

### TypeScript Configuration
- Strict mode enabled
- No unused locals/parameters allowed
- Bundler module resolution
- JSON module imports supported

## Dependencies
- Zero runtime dependencies
- Dev dependencies: TypeScript 5.x, Vite 6.x

## Browser APIs Used
- Canvas 2D Context
- LocalStorage
- Clipboard API
- File API (for import/export)
- Fetch API

## Styling
- CSS custom properties (CSS variables) for theming
- No CSS preprocessor
- Theme colors defined in `src/themes.json`
