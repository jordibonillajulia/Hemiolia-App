import { NextResponse } from 'next/server';

// Server-side geocoding proxy to avoid browser CORS/rate-limiting issues
// Queries Photon (Komoot/OSM geocoder with typo-tolerance and fast autocomplete)
// and falls back to Nominatim with a proper User-Agent header.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const bias = searchParams.get('bias') || '';

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const query = q.trim();
  const results = [];
  const seen = new Set();

  // Helper to format Photon feature
  const formatPhotonFeature = (f) => {
    const p = f.properties || {};
    const street = p.street || '';
    const housenumber = p.housenumber || '';
    const name = p.name || '';
    const city = p.city || p.town || p.village || p.municipality || p.county || '';
    const state = p.state || '';
    const postcode = p.postcode || '';
    const country = p.country || '';

    let mainText = '';
    if (street) {
      mainText = housenumber ? `${street}, ${housenumber}` : street;
      if (name && name !== street && !name.includes(street)) {
        mainText = `${name} (${mainText})`;
      }
    } else if (name) {
      mainText = housenumber ? `${name}, ${housenumber}` : name;
    } else {
      mainText = [city, state].filter(Boolean).join(', ');
    }

    const secondaryParts = [];
    if (postcode && city) {
      secondaryParts.push(`${postcode} ${city}`);
    } else if (city) {
      secondaryParts.push(city);
    }
    if (state && state !== city) secondaryParts.push(state);
    if (country && country !== 'Espanya' && country !== 'Spain') secondaryParts.push(country);

    const secondaryText = secondaryParts.join(', ');
    const fullAddress = [mainText, secondaryText].filter(Boolean).join(', ');

    return {
      mainText: mainText || fullAddress,
      secondaryText,
      fullAddress: fullAddress || mainText,
      municipality: city || state || '',
      coordinates: f.geometry?.coordinates ? {
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      } : null,
    };
  };

  // Helper to format Nominatim item
  const formatNominatimItem = (item) => {
    const addr = item.address || {};
    const road = addr.road || addr.pedestrian || addr.footway || addr.cycleway || addr.path || '';
    const houseNumber = addr.house_number || '';
    const amenity = addr.amenity || addr.theatre || addr.building || item.name || '';
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
    const postcode = addr.postcode || '';
    const state = addr.state || '';

    let mainText = '';
    if (road) {
      mainText = houseNumber ? `${road}, ${houseNumber}` : road;
      if (amenity && amenity !== road) {
        mainText = `${amenity} (${mainText})`;
      }
    } else if (amenity) {
      mainText = houseNumber ? `${amenity}, ${houseNumber}` : amenity;
    } else {
      mainText = item.display_name?.split(',')[0] || item.display_name;
    }

    const secondaryParts = [];
    if (postcode && city) {
      secondaryParts.push(`${postcode} ${city}`);
    } else if (city) {
      secondaryParts.push(city);
    }
    if (state && state !== city) secondaryParts.push(state);

    const secondaryText = secondaryParts.join(', ');
    const fullAddress = [mainText, secondaryText].filter(Boolean).join(', ');

    return {
      mainText: mainText || fullAddress,
      secondaryText,
      fullAddress: fullAddress || item.display_name,
      municipality: city || '',
      coordinates: {
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      },
    };
  };

  // 1. Try Photon API (komoot OSM geocoder, biased to Catalonia / Spain)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=ca&lat=41.5912&lon=1.5209&limit=7`;
    const res = await fetch(photonUrl, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.features)) {
        for (const feature of data.features) {
          const item = formatPhotonFeature(feature);
          const key = item.fullAddress.toLowerCase();
          if (item.mainText && !seen.has(key)) {
            seen.add(key);
            results.push(item);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Photon geocode error:', err.message);
  }

  // 2. If Photon returned few results, supplement with Nominatim
  if (results.length < 3) {
    try {
      const nomQuery = bias ? `${query} ${bias}` : query;
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nomQuery)}&format=json&addressdetails=1&limit=5&countrycodes=es,ad,fr`;
      const nomRes = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Hemiolia-App/1.0 (info@hemiolia.cat)',
          'Accept-Language': 'ca,es,en',
        },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(3500),
      });

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        if (Array.isArray(nomData)) {
          for (const item of nomData) {
            const formatted = formatNominatimItem(item);
            const key = formatted.fullAddress.toLowerCase();
            if (formatted.mainText && !seen.has(key)) {
              seen.add(key);
              results.push(formatted);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Nominatim geocode error:', err.message);
    }
  }

  return NextResponse.json({ results });
}
