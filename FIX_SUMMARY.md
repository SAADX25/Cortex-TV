# Cortex TV – Black Screen Fix Summary

## Issues Resolved

### 1. **Electron ↔ Vite Communication** ✅
**Problem**: Window was black because Electron couldn't load dev server  
**Solution**: 
- Updated `electron/main.ts` to explicitly load `http://localhost:5173` in dev mode
- Added fallback logic if `VITE_DEV_SERVER_URL` env var is missing
- Implemented 1-second delay to ensure Vite dev server is fully up before window loads
- Added console logging to track what URL is being loaded

**Changes**:
```typescript
// Dev mode now tries:
// 1. VITE_DEV_SERVER_URL (set by vite-plugin-electron)
// 2. Fallback to http://localhost:5173 if env var missing
// 3. Production: load from dist/index.html

if (IS_DEV) {
  setTimeout(loadContent, 1000);  // Wait for dev server
} else {
  loadContent();  // Production: load immediately
}
```

### 2. **DevTools Integration** ✅
**Problem**: No way to see errors in black window  
**Solution**:
- Auto-open DevTools in development mode (`mainWindow.webContents.openDevTools()`)
- Detached mode so DevTools opens in separate window
- Press F12 if closed accidentally

**Changes**:
```typescript
if (IS_DEV) {
  mainWindow.webContents.openDevTools({ mode: "detach" });
}
```

### 3. **Vite Server Configuration** ✅
**Problem**: HMR (Hot Module Replacement) might not work correctly  
**Solution**:
- Added explicit `server.hmr` config to `vite.config.ts`
- Specifies `localhost:5173` for HMR connection
- Ensures browser can reconnect to dev server correctly

**Changes**:
```typescript
export default defineConfig({
  base: "./",
  server: {
    middlewareMode: false,
    hmr: {
      host: "localhost",
      port: 5173,
    },
  },
  plugins: [/* ... */]
});
```

### 4. **Asset Path Verification** ✅
**Problem**: Missing textures/GeoJSON would cause silent failures  
**Solution**:
- Added console logging to Globe.tsx for texture loading
- Improved error messages with HTTP status codes
- Clear guidance on which assets are being loaded
- Created SETUP.md with exact asset installation instructions

**Changes**:
```typescript
console.log("[Globe] Loading textures: /textures/earth_day.jpg, /textures/earth_night.jpg");
const [dayMap, nightMap] = useLoader(THREE.TextureLoader, [...]);

console.log("[Globe] Loading GeoJSON from: " + geoJsonUrl);
// ... with detailed error messages if 404
```

### 5. **Canvas & Layout** ✅
**Status**: Already correct in existing code
- App.tsx uses `h-screen` (100vh) ✓
- Scene.tsx Canvas has `style={{ width: "100%", height: "100%" }}` ✓
- index.css ensures `html, body, #root` are 100% dimensions ✓
- No layout issues

---

## Debugging Checklist

If the app still shows a black screen:

1. **Open DevTools** (should auto-open)
   - Look for red error messages in Console tab
   
2. **Check the URL loaded**
   - Look for logs: `[Electron] Loading from dev server: ...`
   - Verify it's trying to load `http://localhost:5173`

3. **Check for 404 errors** (Red network errors in Network tab)
   - `/textures/earth_day.jpg` → Place file in `public/textures/`
   - `/geo/countries.geojson` → Place file in `public/geo/`

4. **Verify Vite dev server is running**
   - You should see: `[Electron] Loading from dev server: http://localhost:5173`
   - If not, the dev server might not have started yet
   - Wait a moment and try refreshing (Ctrl+R)

5. **Check GeoJSON validity**
   - Open DevTools → Console
   - Look for: `[Globe] GeoJSON loaded: XXX features`
   - If missing, check `public/geo/countries.geojson` exists and is valid JSON

---

## File Changes Guide

| File | Changes | Purpose |
|------|---------|---------|
| `electron/main.ts` | Added dev mode URL loading, DevTools, retry logic | Proper Electron↔Vite communication |
| `vite.config.ts` | Added `server.hmr` config | HMR connection stability |
| `src/components/Globe.tsx` | Added console logging for asset loading | Debugging asset issues |
| `SETUP.md` | New file | Asset installation guide |

---

## Starting Fresh

If you're starting the dev environment:

```bash
npm run dev
```

This will:
1. Start Vite dev server on `http://localhost:5173`
2. Wait 1 second to ensure it's ready
3. Open Electron window pointing to dev server
4. Auto-open DevTools so you see any errors
5. HMR enabled for fast development

You should see:
- Globe spinning (with day/night cycle if textures present)
- Cyan neon country borders (if GeoJSON present)
- "Cortex TV" title in top-left
- Console logs showing what assets loaded

---

## Next Steps (Optional)

1. **Add sample assets** to `public/` directory:
   - `textures/earth_day.jpg`
   - `textures/earth_night.jpg`
   - `geo/countries.geojson`
   
   See `SETUP.md` for download links.

2. **Check console logs** for debugging:
   - Look for `[Cortex TV]` logs
   - Look for `[Globe]` logs about texture/GeoJSON loading
   - Look for `[Scene]` logs about render issues

3. **Test in production**:
   ```bash
   npm run build
   npm run electron:build
   npm run build && npx electron .
   ```

---

## Summary

✅ Electron properly loads Vite dev server  
✅ Dev server waits before window opens  
✅ DevTools auto-opens for debugging  
✅ Console logs all asset loading  
✅ HMR configured for smooth development  
✅ Clear error messages for missing assets  

**You should now see the globe render, or clear error messages in DevTools if assets are missing.**
