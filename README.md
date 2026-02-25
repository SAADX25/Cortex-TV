# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

# Cortex TV

Minimal Cortex TV (Radio Garden-like) demo built with React + Vite.

Quick start

1. Install deps:

```bash
npm install
```

2. Run dev server:

```bash
npm run dev
```

Open http://localhost:5173

Notes
- The app uses `react-globe.gl`, `three`, and `react-player` (HLS test streams).
- If you add or remove packages update `package.json` and run `npm install`.
