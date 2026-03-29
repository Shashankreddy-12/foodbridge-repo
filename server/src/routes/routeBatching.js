/**
 * server/src/routes/routeBatching.js
 *
 * Multi-stop Route Batching — volunteer picks up from multiple donors in one trip.
 *
 * Algorithm: TSP nearest-neighbour heuristic starting from volunteer's GPS position.
 * Computes: total distance (km), estimated time, CO₂ saved vs multiple trips.
 *
 * Endpoints:
 *   POST /api/route/batch          — plan optimal multi-stop route for volunteer
 *   POST /api/route/complete-stop  — mark a stop as completed
 *   GET  /api/route/suggestions    — suggest nearby listings to batch
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import FoodListing from '../models/FoodListing.js';

const router = Router();

// ─────────────────────────────────────────────────────────────
// Geo helpers
// ─────────────────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dphi = (lat2 - lat1) * Math.PI / 180;
  const dlam = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dphi / 2) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────
// TSP nearest-neighbour heuristic
// ─────────────────────────────────────────────────────────────

function tspNearestNeighbour(startLat, startLng, stops) {
  if (stops.length === 0) return [];
  if (stops.length === 1) return stops;

  const unvisited = [...stops];
  const route     = [];
  let curLat = startLat;
  let curLng = startLng;

  while (unvisited.length > 0) {
    let bestIdx  = 0;
    let bestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const stop = unvisited[i];
      const [lng, lat] = stop.location.coordinates; // GeoJSON: [lng, lat]
      const dist = haversineKm(curLat, curLng, lat, lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx  = i;
      }
    }

    const chosen = unvisited.splice(bestIdx, 1)[0];
    const [lng, lat] = chosen.location.coordinates;
    chosen._distFromPrev = parseFloat(bestDist.toFixed(2));
    curLat = lat;
    curLng = lng;
    route.push(chosen);
  }

  return route;
}

// ─────────────────────────────────────────────────────────────
// Route metrics
// ─────────────────────────────────────────────────────────────

function computeRouteMetrics(startLat, startLng, orderedStops) {
  let totalKm = 0;
  let prevLat = startLat;
  let prevLng = startLng;

  for (const stop of orderedStops) {
    const [lng, lat] = stop.location.coordinates;
    totalKm += haversineKm(prevLat, prevLng, lat, lng);
    prevLat  = lat;
    prevLng  = lng;
  }

  totalKm = parseFloat(totalKm.toFixed(2));

  // Estimated time: avg 25 km/h city speed + 5 min handover per stop
  const driveMinutes    = (totalKm / 25) * 60;
  const handoverMinutes = orderedStops.length * 5;
  const totalMinutes    = Math.round(driveMinutes + handoverMinutes);

  // CO₂ saved vs separate trips (0.21 kg CO₂/km — DEFRA light vehicle)
  const CO2_PER_KM      = 0.21;
  const singleTripEstKm = orderedStops.length * 3; // avg 3 km per separate trip
  const co2Single       = parseFloat((singleTripEstKm * CO2_PER_KM).toFixed(2));
  const co2Batch        = parseFloat((totalKm * CO2_PER_KM).toFixed(2));
  const co2Saved        = parseFloat(Math.max(0, co2Single - co2Batch).toFixed(2));

  return { totalKm, totalMinutes, co2Saved, co2Batch };
}

// ─────────────────────────────────────────────────────────────
// URL builders
// ─────────────────────────────────────────────────────────────

function buildGoogleMapsUrl(startLat, startLng, stops, mode = 'driving') {
  if (stops.length === 0) return null;
  const modeMap = { driving: 'driving', walking: 'walking', bicycling: 'bicycling' };
  const gMode   = modeMap[mode] || 'driving';

  const origin = `${startLat},${startLng}`;
  const dest   = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
  const waypts = stops.slice(0, -1).map(s => `${s.lat},${s.lng}`).join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${gMode}`;
  if (waypts) url += `&waypoints=${encodeURIComponent(waypts)}`;
  return url;
}

function buildOSMUrl(stops) {
  if (stops.length === 0) return null;
  return `https://www.openstreetmap.org/directions?from=${stops[0].lat},${stops[0].lng}&to=${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
}

// ─────────────────────────────────────────────────────────────
// POST /api/route/batch
// ─────────────────────────────────────────────────────────────

router.post('/batch', verifyToken, async (req, res) => {
  try {
    const {
      volunteerLat,
      volunteerLng,
      listingIds,
      radiusKm   = 10,
      maxStops   = 6,
      travelMode = 'driving',
    } = req.body;

    if (!volunteerLat || !volunteerLng) {
      return res.status(400).json({ error: 'volunteerLat and volunteerLng are required' });
    }

    let listings;

    if (listingIds && listingIds.length > 0) {
      listings = await FoodListing.find({
        _id:       { $in: listingIds },
        status:    'claimed',
        claimedBy: req.user.id,
      })
        .populate('donor', 'name phone')
        .populate('claimedBy', 'name')
        .lean();
    } else {
      listings = await FoodListing.find({
        status:    'claimed',
        claimedBy: req.user.id,
        location: {
          $geoWithin: {
            $centerSphere: [
              [volunteerLng, volunteerLat],
              radiusKm / 6371,
            ],
          },
        },
      })
        .populate('donor', 'name phone')
        .lean();
    }

    if (listings.length === 0) {
      return res.json({
        ok:      true,
        message: 'No claimed listings found for batching in your area.',
        route:   [],
        metrics: null,
      });
    }

    // Cap at maxStops — prioritise urgent + soonest expiry
    const sorted = listings
      .sort((a, b) => {
        const urgencyScore = (b.urgent ? 2 : 0) - (a.urgent ? 2 : 0);
        if (urgencyScore !== 0) return urgencyScore;
        return new Date(a.expiresAt) - new Date(b.expiresAt);
      })
      .slice(0, maxStops);

    const optimised = tspNearestNeighbour(volunteerLat, volunteerLng, sorted);
    const metrics   = computeRouteMetrics(volunteerLat, volunteerLng, optimised);

    const stops = optimised.map((listing, idx) => {
      const [lng, lat] = listing.location.coordinates;
      return {
        stopNumber:   idx + 1,
        listingId:    listing._id,
        title:        listing.title,
        foodType:     listing.foodType,
        quantity:     listing.quantity,
        kgFood:       listing.kgFood,      // correct field name from FoodListing schema
        servings:     listing.servings,
        address:      listing.address,
        lat,
        lng,
        distFromPrev: listing._distFromPrev,
        donor: {
          name:  listing.donor?.name,
          phone: listing.donor?.phone,
        },
        urgent:      listing.urgent,
        expiresAt:   listing.expiresAt,
        safetyScore: listing.safetyScore,
        status:      'pending',
      };
    });

    const batchId = `batch_${req.user.id}_${Date.now()}`;

    res.json({
      ok:          true,
      batchId,
      volunteerId: req.user.id,
      travelMode,
      stops,
      metrics: {
        totalStops:       stops.length,
        totalDistanceKm:  metrics.totalKm,
        estimatedMinutes: metrics.totalMinutes,
        co2SavedKg:       metrics.co2Saved,
        co2EmittedKg:     metrics.co2Batch,
      },
      googleMapsUrl: buildGoogleMapsUrl(volunteerLat, volunteerLng, stops, travelMode),
      osmUrl:        buildOSMUrl(stops),
    });

  } catch (err) {
    console.error('[route/batch]', err);
    res.status(500).json({ error: 'Failed to compute batch route' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/route/complete-stop
// ─────────────────────────────────────────────────────────────

router.post('/complete-stop', verifyToken, async (req, res) => {
  try {
    const { listingId } = req.body;
    if (!listingId) return res.status(400).json({ error: 'listingId required' });

    const listing = await FoodListing.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.claimedBy?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not your assigned listing' });
    }

    listing.status      = 'delivered';
    listing.deliveredAt = new Date();
    await listing.save();

    res.json({ ok: true, listingId, status: 'delivered', deliveredAt: listing.deliveredAt });
  } catch (err) {
    console.error('[route/complete-stop]', err);
    res.status(500).json({ error: 'Failed to mark stop complete' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/route/suggestions
// ─────────────────────────────────────────────────────────────

router.get('/suggestions', verifyToken, async (req, res) => {
  try {
    const { lat, lng, radiusKm = 5, maxSuggestions = 4 } = req.query;

    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng query params required' });

    const nearby = await FoodListing.find({
      status: 'available',
      location: {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], parseFloat(radiusKm) / 6371],
        },
      },
    })
      .sort({ urgent: -1, expiresAt: 1 })
      .limit(parseInt(maxSuggestions) + 2)
      .populate('donor', 'name')
      .lean();

    if (nearby.length < 2) {
      return res.json({ suggestions: [], message: 'Not enough nearby listings to batch.' });
    }

    const stops   = tspNearestNeighbour(parseFloat(lat), parseFloat(lng), nearby.slice(0, parseInt(maxSuggestions)));
    const metrics = computeRouteMetrics(parseFloat(lat), parseFloat(lng), stops);

    res.json({
      suggestions: stops.map((l, i) => ({
        rank:      i + 1,
        listingId: l._id,
        title:     l.title,
        foodType:  l.foodType,
        address:   l.address,
        urgent:    l.urgent,
        expiresAt: l.expiresAt,
        donor:     l.donor?.name,
        lat:       l.location.coordinates[1],
        lng:       l.location.coordinates[0],
        distKm:    l._distFromPrev,
      })),
      metrics: {
        totalStops:       stops.length,
        totalDistanceKm:  metrics.totalKm,
        estimatedMinutes: metrics.totalMinutes,
        co2SavedKg:       metrics.co2Saved,
      },
    });

  } catch (err) {
    console.error('[route/suggestions]', err);
    res.status(500).json({ error: 'Failed to compute route suggestions' });
  }
});

export default router;
