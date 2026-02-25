// Lightweight client for iptv-org public JSON APIs with simple in-memory cache
const CHANNELS_URL = 'https://iptv-org.github.io/api/channels.json';
const STREAMS_URL = 'https://iptv-org.github.io/api/streams.json';
const COUNTRIES_URL = 'https://iptv-org.github.io/api/countries.json';

// Simple in-memory cache by countryCode
const channelsCache = new Map();
const countriesCache = { list: null };

export async function fetchChannelsForCountry(countryCode) {
  const cc = (countryCode || '').toUpperCase();
  if (!cc) return [];

  // return cached result if available
  if (channelsCache.has(cc)) {
    return channelsCache.get(cc);
  }

  try {
    const [channelsResp, streamsResp] = await Promise.all([
      fetch(CHANNELS_URL),
      fetch(STREAMS_URL)
    ]);
    if (!channelsResp.ok || !streamsResp.ok) throw new Error('Failed to fetch IPTV data');

    const channels = await channelsResp.json();
    const streams = await streamsResp.json();

    // Filter channels by country code (case-insensitive).
    // iptv-org channel objects may use `country`, `country_code` or similar fields; be permissive.
    const countryChannels = channels.filter(c => {
      const cand = ((c.country_code || c.country || c.iso_3166_1_alpha2 || c.country_code_short || '')).toString().toUpperCase();
      return cand === cc;
    });

    // Map channel id -> preferred stream URL (prefer HLS .m3u8)
    const streamMap = new Map();
    for (const s of streams) {
      if (!s.url) continue;
      const chId = s.channel;
      if (!chId) continue;

      // normalize to array
      const urls = typeof s.url === 'string' ? [s.url] : Array.isArray(s.url) ? s.url : [];
      // prefer any .m3u8 url
      const hls = urls.find(u => typeof u === 'string' && u.includes('.m3u8'));
      const pick = hls || urls.find(u => typeof u === 'string');
      if (pick && !streamMap.has(chId)) streamMap.set(chId, pick);
    }

    // Attach first available stream to channel if exists
    const result = countryChannels.map(c => {
      const stream = streamMap.get(c.id) || null;
      return {
        id: c.id,
        name: c.name,
        logo: c.logo || null,
        categories: c.categories || [],
        language: c.language || null,
        stream
      };
    }).filter(c => c.stream !== null);

    // cache result (even empty arrays)
    channelsCache.set(cc, result);

    return result;
  } catch (err) {
    console.error('IPTV fetch error', err);
    throw err;
  }
}

export async function fetchCountries() {
  if (countriesCache.list) return countriesCache.list;
  try {
    const res = await fetch(COUNTRIES_URL);
    if (!res.ok) throw new Error('Failed to fetch countries');
    const list = await res.json();
    // Basic normalization: ensure name and code exist
    const normalized = (list || []).map(c => ({
      name: c.name || c.country || c.title || 'Unknown',
      code: (c.iso_3166_1_alpha2 || c.alpha2 || c.code || c.iso || c.id || '').toString().toUpperCase(),
      ...c
    }));
    countriesCache.list = normalized;
    return normalized;
  } catch (err) {
    console.error('Failed to fetch countries', err);
    throw err;
  }
}

export default { fetchChannelsForCountry, fetchCountries };
