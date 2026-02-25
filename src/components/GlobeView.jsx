import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Globe from 'react-globe.gl';
import { useTheme } from '../context/ThemeContext';

const GlobeView = forwardRef(({ countries = [], onCountryClick }, ref) => {
  const { isDarkMode } = useTheme();
  const globeRef = useRef();

  // expose pointOfView control to parent via ref
  useImperativeHandle(ref, () => ({
    pointOfView: (opts, ms) => {
      if (globeRef.current && typeof globeRef.current.pointOfView === 'function') {
        globeRef.current.pointOfView(opts, ms);
      }
    }
  }), []);
  const containerRef = useRef();
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const el = containerRef.current;
      if (el) {
        setSize({ width: el.clientWidth, height: el.clientHeight });
      } else {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load GeoJSON country polygons for interactive borders
  const [countriesData, setCountriesData] = useState(null);
  const [hoverD, setHoverD] = useState(null);

  useEffect(() => {
    let mounted = true;
    const url = 'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load geojson')))
      .then(json => { if (mounted) setCountriesData(json); })
      .catch(err => console.error('Failed to fetch countries geojson', err));
    return () => { mounted = false; };
  }, []);

  // helper: compute rough centroid from polygon/multipolygon coords
  const getFeatureCentroid = (feature) => {
    const geom = feature && feature.geometry;
    if (!geom || !geom.coordinates) return { lat: 0, lng: 0 };
    const coords = [];
    const pushCoords = (arr) => {
      for (const a of arr) {
        if (typeof a[0] === 'number' && typeof a[1] === 'number') {
          coords.push(a);
        } else if (Array.isArray(a)) {
          pushCoords(a);
        }
      }
    };
    pushCoords(geom.coordinates);
    if (coords.length === 0) return { lat: 0, lng: 0 };
    let sumX = 0, sumY = 0;
    for (const c of coords) {
      // GeoJSON uses [lng, lat]
      sumX += c[0];
      sumY += c[1];
    }
    const avgLng = sumX / coords.length;
    const avgLat = sumY / coords.length;
    return { lat: avgLat, lng: avgLng };
  };

  const globeImage = isDarkMode
    ? '//unpkg.com/three-globe/example/img/earth-night.jpg'
    : '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

  const backgroundImage = isDarkMode ? '//unpkg.com/three-globe/example/img/night-sky.png' : undefined;

  // Convert two lat/lng to angular distance in degrees
  const angularDistanceDeg = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => v * Math.PI / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);
    const d = Math.acos(Math.min(1, Math.max(-1, Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ))));
    return d * (180 / Math.PI);
  };

  // polygon hover / click handlers
  const handlePolygonHover = (d, prev) => {
    setHoverD(d || null);
  };

  const handlePolygonClick = (d, event, { lat, lng }) => {
    if (!d || !d.properties) return;
    const iso = (d.properties.ISO_A2 || '').toUpperCase();
    const name = d.properties.ADMIN || d.properties.NAME || iso;
    // compute centroid to center the globe
    const c = getFeatureCentroid(d);
    if (globeRef.current) globeRef.current.pointOfView({ lat: c.lat, lng: c.lng, altitude: 0.95 }, 900);
    if (onCountryClick) onCountryClick({ name, code: iso, lat: c.lat, lng: c.lng });
  };

  return (
    <div ref={containerRef} className="w-full h-screen relative bg-transparent">
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        globeImageUrl={globeImage}
        backgroundImageUrl={backgroundImage}
        polygonsData={countriesData ? countriesData.features : []}
        polygonAltitude={d => d === hoverD ? 0.12 : 0.01}
        polygonCapColor={d => d === hoverD ? 'rgba(0, 242, 254, 0.3)' : 'rgba(0, 0, 0, 0)'}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={() => '#00f2fe'}
        polygonsTransitionDuration={300}
        onPolygonHover={handlePolygonHover}
        onPolygonClick={handlePolygonClick}
        atmosphereColor={isDarkMode ? 'rgba(0,242,254,0.12)' : 'rgba(0,0,0,0.08)'}
        atmosphereAltitude={isDarkMode ? 0.15 : 0.08}
        animateIn
      />

      <style>{`
        .globe-wrap { position: absolute; inset: 0; }
      `}</style>
    </div>
  );

});

export default GlobeView;
