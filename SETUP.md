# Cortex TV – Setup & Asset Installation Guide

## Installation & Running

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Initial Setup
```bash
npm install
```

### Development (with Dev Tools)
```bash
npm run dev
```
This launches Electron with Vite dev server and opens DevTools for debugging.

### Production Build
```bash
npm run build
npm run electron:build  # Creates native installer
```

---

## Required Assets

Cortex TV requires three asset files in the `public/` directory. **Without these, the app will show a black screen.**

### 1. Earth Textures

Place these two high-quality texture images in `public/textures/`:

#### `public/textures/earth_day.jpg` (4096×2048 or larger)
- **Purpose**: Daytime Earth map shown on the sunlit side
- **Source**: NASA Blue Marble or similar topographical map
- **Recommended**: https://visibleearth.nasa.gov/images/90733/blue-marble-land-surface-temperature
- Example: 8K Blue Marble (4×4 or 8×8K)

#### `public/textures/earth_night.jpg` (4096×2048 or larger)
- **Purpose**: City lights / emissive map shown on the night side
- **Source**: NASA Black Marble or similar lights-at-night map
- **Recommended**: https://visibleearth.nasa.gov/images/79765/earth-black-marble
- Example: Black Marble night lights data

### 2. Country Borders (GeoJSON)

Place this file in `public/geo/`:

#### `public/geo/countries.geojson`
- **Purpose**: World country polygon boundaries for neon border rendering and click-to-country detection
- **Source**: Natural Earth or similar
- **Download**: https://github.com/datasets/geo-countries/blob/master/data/countries.geojson
- Alternative: https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip (unzip and use the .geojson)

---

## File Structure

```
Cortex TV/
├── public/
│   ├── geo/
│   │   └── countries.geojson           ← REQUIRED
│   ├── textures/
│   │   ├── earth_day.jpg               ← REQUIRED
│   │   └── earth_night.jpg             ← REQUIRED
│   └── vite.svg
├── electron/
│   ├── main.ts
│   └── preload.ts
├── src/
│   ├── components/
│   ├── shaders/
│   ├── utils/
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── types.d.ts
├── dist/                               (build output)
├── dist-electron/                      (electron build output)
└── [config files]
```

---

## Troubleshooting

### Black Screen on Launch
1. **Check DevTools** (should auto-open in dev mode)
   - Press `F12` or look for DevTools window
2. **Console Errors** will indicate:
   - Missing textures: `404 /textures/earth_day.jpg`
   - Missing GeoJSON: `404 /geo/countries.geojson`
3. **Verify file paths**: Textures must be `.jpg` or `.png` in `public/textures/`
4. **HMR/Dev Server**: Check if http://localhost:5173 is running
   - If black screen persists, click globe to see if errors appear

### "Failed to load texture"
- Ensure image format is supported (JPG/PNG)
- Verify file size reasonable (not > 100MB per image)
- Check browser console in DevTools for exact 404 errors

### "Cannot find countries.geojson"
- Verify `public/geo/countries.geojson` exists
- Check file is valid JSON (no trailing commas)
- Use online GeoJSON validator: https://geojson.io

### Renderer Crash on Globe Click
- Likely cause: GeoJSON structure invalid
- Solution: Validate GeoJSON file has proper feature/geometry structure
- Features should have `properties.ADMIN` or `properties.NAME` for country names

---

## Development Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Launch Electron with Vite dev server + DevTools |
| `npm run build` | Build renderer + Electron for production |
| `npx electron .` | Run built Electron app directly |
| `npm run electron:build` | Create native installer (.exe on Windows) |

---

## Architecture Overview

- **Electron**: Native desktop window (electron/main.ts, preload.ts)
- **Vite**: Dev server + bundler for React/TypeScript
- **React Three Fiber**: 3D rendering with WebGL
- **Three.js**: 3D graphics library
- **Shaders**: Custom GLSL for day/night blending and atmosphere
- **Tailwind CSS**: UI styling

---

## Notes

- **Base path**: `vite.config.ts` has `base: './'` for Electron asset loading
- **Dev mode**: VITE_DEV_SERVER_URL auto-injected by vite-plugin-electron
- **Fallback**: If env var missing, main.ts tries `http://localhost:5173` directly
- **DevTools**: Auto-opens in development to see errors
- **Production**: Static assets served from `dist/` folder

Enjoy your Cortex TV!
