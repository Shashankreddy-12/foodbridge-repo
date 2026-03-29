// ============================================================
//  FoodBridge — Model 2: Route Optimizer
//  Stack: Node.js + Express
//  Routing API: OpenRouteService (free, no billing)
//  Map: Leaflet.js + OpenStreetMap (frontend, see routeMap.html)
// ============================================================

const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const ORS_API_KEY = process.env.ORS_API_KEY; // get free key at openrouteservice.org
const ORS_BASE    = "https://api.openrouteservice.org/v2";

// ORS profile mapping per travel mode
const ORS_PROFILE = {
  walking:    "foot-walking",
  "2-wheeler": "cycling-regular",  // best free proxy for 2-wheeler
  "4-wheeler": "driving-car",
};

// ─────────────────────────────────────────────────────────────
//  HAVERSINE  (straight-line km, used for TSP distance matrix)
// ─────────────────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ─────────────────────────────────────────────────────────────
//  TSP — NEAREST NEIGHBOUR + 2-OPT
//  Solves optimal stop order for volunteer multi-pickup trips.
//  Input:  array of {lat, lng} waypoints, index 0 = volunteer start
//  Output: reordered array of waypoints
// ─────────────────────────────────────────────────────────────

/** Build N×N distance matrix */
function buildDistMatrix(points) {
  return points.map((a) => points.map((b) => haversineKm(a, b)));
}

/** Nearest-neighbour greedy tour starting from index 0 */
function nearestNeighbour(dist) {
  const n = dist.length;
  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;

  for (let step = 1; step < n; step++) {
    const last = tour[tour.length - 1];
    let best = -1, bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && dist[last][j] < bestDist) {
        bestDist = dist[last][j];
        best = j;
      }
    }
    tour.push(best);
    visited[best] = true;
  }
  return tour;
}

/** 2-opt improvement: swap edges to remove crossings */
function twoOpt(tour, dist) {
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < tour.length - 1; i++) {
      for (let j = i + 1; j < tour.length; j++) {
        const a = tour[i - 1], b = tour[i];
        const c = tour[j],     d = tour[(j + 1) % tour.length];
        const before = dist[a][b] + dist[c][d];
        const after  = dist[a][c] + dist[b][d];
        if (after < before - 1e-10) {
          // Reverse segment between i and j
          tour.splice(i, j - i + 1, ...tour.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return tour;
}

/** Full TSP solve: returns reordered waypoints */
function solveTSP(waypoints) {
  if (waypoints.length <= 2) return waypoints;
  const dist  = buildDistMatrix(waypoints);
  const tour  = nearestNeighbour(dist);
  const optimised = twoOpt(tour, dist);
  return optimised.map((i) => waypoints[i]);
}

/** Straight-line total distance of a route (km) */
function routeTotalKm(waypoints) {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineKm(waypoints[i], waypoints[i + 1]);
  }
  return +total.toFixed(2);
}

// ─────────────────────────────────────────────────────────────
//  OPENROUTESERVICE — GET REAL ROAD GEOMETRY
//  Returns GeoJSON LineString for Leaflet to draw
// ─────────────────────────────────────────────────────────────
async function fetchRoadRoute(waypoints, mode) {
  const profile = ORS_PROFILE[mode] ?? "foot-walking";

  // ORS directions API — coordinates as [lng, lat] (GeoJSON order)
  const coordinates = waypoints.map((p) => [p.lng, p.lat]);

  // Gracefully handle missing ORS API KEY
  if (!ORS_API_KEY) {
    console.warn("Missing ORS_API_KEY in environment variables. Falling back to straight-line distance.");
    return {
      geometry: { type: "LineString", coordinates },
      distanceKm: routeTotalKm(waypoints),
      durationMin: 0, 
    };
  }

  const body = {
    coordinates,
    instructions: false,
    geometry: true,
    units: "km",
  };

  const res = await fetch(`${ORS_BASE}/directions/${profile}/geojson`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: ORS_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn(`ORS API error ${res.status}: ${err}`);
    // Fallback to straight line
    return {
      geometry: { type: "LineString", coordinates },
      distanceKm: routeTotalKm(waypoints),
      durationMin: 0, 
    };
  }

  const data = await res.json();
  const route = data.features?.[0];
  if (!route) {
    return {
      geometry: { type: "LineString", coordinates },
      distanceKm: routeTotalKm(waypoints),
      durationMin: 0, 
    };
  }

  const summary  = route.properties.summary;
  const geometry = route.geometry; // GeoJSON LineString

  return {
    geometry,                                     // send to Leaflet
    distanceKm: +(summary.distance).toFixed(2),
    durationMin: +(summary.duration / 60).toFixed(1),
  };
}

// ─────────────────────────────────────────────────────────────
//  MAIN FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * optimizeVolunteerRoute
 * For volunteer delivery: multi-stop TSP → ORS road geometry
 *
 * @param {Object} volunteer   { lat, lng }
 * @param {Array}  stops       [ { id, type:"donor"|"recipient", lat, lng, label } ]
 * @param {string} mode        "walking" | "2-wheeler" | "4-wheeler"
 */
async function optimizeVolunteerRoute(volunteer, stops, mode = "2-wheeler") {
  // Build waypoint list: volunteer → all stops (TSP reorders the stops)
  // Volunteer start is always index 0 — TSP doesn't move it
  const stopPoints = stops.map((s) => ({ lat: s.lat, lng: s.lng, meta: s }));
  const optimisedStops = solveTSP(stopPoints);

  // Full waypoint sequence: start + optimised stops
  const waypoints = [{ lat: volunteer.lat, lng: volunteer.lng, meta: { type: "start", label: "Your location" } }, ...optimisedStops];

  // Fetch real road geometry from ORS
  const road = await fetchRoadRoute(waypoints, mode);

  return {
    orderedStops: waypoints,
    geometry: road.geometry,       // GeoJSON for Leaflet
    distanceKm: road.distanceKm,
    durationMin: road.durationMin,
    mode,
    straightLineKm: routeTotalKm(waypoints),
  };
}

/**
 * selfCollectRoute
 * For buyer self-collect: current location → donor location
 *
 * @param {Object} buyer  { lat, lng }
 * @param {Object} donor  { lat, lng, label }
 * @param {string} mode   "walking" | "2-wheeler" | "4-wheeler"
 */
async function selfCollectRoute(buyer, donor, mode) {
  const waypoints = [buyer, donor];
  const road = await fetchRoadRoute(waypoints, mode);

  return {
    orderedStops: [
      { ...buyer, meta: { type: "start", label: "Your location" } },
      { ...donor, meta: { type: "donor", label: donor.label ?? "Pickup point" } },
    ],
    geometry: road.geometry,
    distanceKm: road.distanceKm,
    durationMin: road.durationMin,
    mode,
  };
}

// ─────────────────────────────────────────────────────────────
//  EXPRESS ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/route/volunteer
 * Body: { volunteer: {lat,lng}, stops: [{id,type,lat,lng,label}], mode }
 */
async function volunteerRouteHandler(req, res) {
  try {
    const { volunteer, stops, mode } = req.body;
    if (!volunteer || !stops?.length) {
      return res.status(400).json({ error: "volunteer and stops required" });
    }
    const result = await optimizeVolunteerRoute(volunteer, stops, mode ?? "2-wheeler");
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("Volunteer route error:", err.message);
    return res.status(500).json({ error: "Route optimization failed", detail: err.message });
  }
}

/**
 * POST /api/route/self-collect
 * Body: { buyer: {lat,lng}, donor: {lat,lng,label}, mode }
 */
async function selfCollectHandler(req, res) {
  try {
    const { buyer, donor, mode } = req.body;
    if (!buyer || !donor) {
      return res.status(400).json({ error: "buyer and donor required" });
    }
    const result = await selfCollectRoute(buyer, donor, mode ?? "walking");
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("Self-collect route error:", err.message);
    return res.status(500).json({ error: "Route fetch failed", detail: err.message });
  }
}

export {
  optimizeVolunteerRoute,
  selfCollectRoute,
  volunteerRouteHandler,
  selfCollectHandler,
  solveTSP,
};
