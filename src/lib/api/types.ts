/**
 * Types mirroring the opentransit API contract v1 (docs/CONTRACT.md).
 * All keys camelCase; times ISO-8601 with offset; distances meters; durations seconds.
 */

export type LatLon = { lat: number; lon: number };

export type Component =
  | "trunk"
  | "feeder"
  | "dual"
  | "zonal"
  | "cable"
  | "rail"
  | "other";

export type Mode =
  | "WALK"
  | "BUS"
  | "RAIL"
  | "SUBWAY"
  | "TRAM"
  | "CABLE_CAR"
  | "BICYCLE"
  | "CAR"
  | "FERRY"
  | "TRANSIT";

export type Geometry = { encoded: string; precision: number };

export type ApiError = { error: { code: string; message: string } };

export type Agency = {
  id: string;
  name: string;
  component: Component;
  color: string;
};

export type City = {
  id: string;
  name: string;
  country: string;
  timezone: string;
  locale: string;
  center: LatLon;
  bbox: [number, number, number, number];
  defaultZoom: number;
  modes: Mode[];
  branding: { primaryColor: string; logoUrl: string | null };
  features: {
    realtimeVehicles: boolean;
    tripUpdates: boolean;
    alerts: boolean;
    fares: boolean;
    bikeShare: boolean;
  };
  agencies: Agency[];
  attribution: string;
};

export type RouteRef = {
  id: string;
  shortName: string;
  longName: string;
  color: string;
  textColor: string;
  mode: Mode;
  agencyId: string;
  component: Component;
};

export type Place = {
  name: string;
  lat: number;
  lon: number;
  stopId: string | null;
  stopCode: string | null;
  arrival: string | null;
  departure: string | null;
  component: Component | null;
};

export type WalkStep = {
  instruction: string;
  distanceMeters: number;
  lat: number;
  lon: number;
  relativeDirection: string;
  streetName: string;
};

export type Alert = {
  id: string;
  cause: string | null;
  effect: string | null;
  severity: "INFO" | "WARNING" | "SEVERE" | null;
  header: string;
  description: string | null;
  url: string | null;
  start: string | null;
  end: string | null;
  routeIds: string[];
  stopIds: string[];
  routes: RouteRef[];
};

export type RealtimeState =
  | "SCHEDULED"
  | "UPDATED"
  | "CANCELED"
  | "ADDED"
  | "MODIFIED";

export type Leg = {
  mode: Mode;
  transit: boolean;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  distanceMeters: number;
  from: Place;
  to: Place;
  route: RouteRef | null;
  headsign: string | null;
  agency: { id: string; name: string } | null;
  tripId: string | null;
  realtime: boolean;
  realtimeState: RealtimeState | null;
  delaySeconds: number | null;
  geometry: Geometry;
  intermediateStops: Place[];
  steps: WalkStep[];
  alerts: Alert[];
};

export type Itinerary = {
  id: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  walkDistanceMeters: number;
  walkTimeSeconds: number;
  waitingTimeSeconds: number;
  transfers: number;
  fare: { amount: number; currency: string } | null;
  accessible: boolean | null;
  legs: Leg[];
};

export type PlanParams = {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  time?: string;
  arriveBy?: boolean;
  modes?: Mode[];
  wheelchair?: boolean;
  numItineraries?: number;
  maxWalkDistance?: number;
  locale?: "es" | "en";
};

export type PlanResponse = {
  from: Place;
  to: Place;
  itineraries: Itinerary[];
  router: { engine: string; version: string; realtime: boolean };
  warnings: string[];
};

export type GeocodeResult = {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  /** `place` = neighbourhoods/localities from Photon (API deviation note). */
  type: "station" | "stop" | "address" | "poi" | "street" | "place";
  stopId: string | null;
  component: Component | null;
  source: "gtfs" | "photon";
};

export type GeocodeResponse = { results: GeocodeResult[] };
export type ReverseResponse = { name: string; lat: number; lon: number };

export type Stop = {
  id: string;
  code: string | null;
  name: string;
  lat: number;
  lon: number;
  locationType: "stop" | "station" | "entrance";
  component: Component | null;
  wheelchair: "unknown" | "accessible" | "not_accessible";
  parentStationId: string | null;
};

export type NearbyStop = Stop & { distanceMeters: number };
export type NearbyResponse = { stops: NearbyStop[] };

export type StopDetail = Stop & {
  routes: RouteRef[];
  parentStation: Stop | null;
  children: Stop[];
};

export type Departure = {
  route: RouteRef;
  headsign: string;
  tripId: string;
  scheduledTime: string;
  realtimeTime: string | null;
  realtime: boolean;
  delaySeconds: number | null;
  canceled: boolean;
  vehicleId: string | null;
  stopSequence: number | null;
};

export type DeparturesResponse = {
  stop: Stop;
  generatedAt: string;
  departures: Departure[];
};

export type RoutesResponse = { routes: RouteRef[] };

export type Pattern = {
  id: string;
  /** May be null when the feed has no trip_headsign (seen on Bogotá feeders). */
  headsign: string | null;
  /** 0 | 1 per contract; the API returns -1 when the feed has no direction_id. */
  directionId: number;
  geometry: Geometry;
  stops: Stop[];
};

export type RouteDetail = RouteRef & { patterns: Pattern[]; alerts: Alert[] };

export type NetworkShape = {
  id: string;
  routeId: string;
  component: Component;
  color: string;
  geometry: Geometry;
};
export type NetworkResponse = { feedVersion: string; shapes: NetworkShape[] };

export type Occupancy =
  | "EMPTY"
  | "MANY_SEATS_AVAILABLE"
  | "FEW_SEATS_AVAILABLE"
  | "STANDING_ROOM_ONLY"
  | "CRUSHED_STANDING_ROOM_ONLY"
  | "FULL"
  | "NOT_ACCEPTING_PASSENGERS";

export type Vehicle = {
  id: string;
  label: string | null;
  routeId: string | null;
  routeShortName: string | null;
  tripId: string | null;
  tripResolved: boolean;
  component: Component;
  lat: number;
  lon: number;
  bearing: number | null;
  timestamp: string;
  stopId: string | null;
  stopSequence: number | null;
  occupancy: Occupancy | null;
};

export type VehicleHealth = {
  entityAgeP50Seconds: number | null;
  pctTripResolved: number | null;
  httpStatus: number;
};

export type VehicleFrame = {
  type: "full";
  seq: number;
  generatedAt: string;
  feedTimestamp: string;
  count: number;
  health: VehicleHealth;
  vehicles: Vehicle[];
};

export type VehicleDelta = {
  type: "delta";
  seq: number;
  generatedAt: string;
  feedTimestamp: string;
  count: number;
  health: VehicleHealth;
  updated: Vehicle[];
  removed: string[];
};

export type VehicleEvent = VehicleFrame | VehicleDelta;

export type VehicleDetail = Vehicle & {
  route: RouteRef | null;
  trip: { id: string | null; resolved: boolean; headsign: string | null };
  shape: Geometry | null;
  currentStop: Stop | null;
  nextStop: Stop | null;
  etaSeconds: number | null;
  delaySeconds: number | null;
  history: { points: [number, number, number][]; avgKmh: number | null };
  alerts: Alert[];
};

export type AlertsResponse = { alerts: Alert[] };

export type CityHealth = {
  static: {
    feedVersion: string;
    fetchedAt: string;
    routes: number;
    stops: number;
  };
  realtime: {
    lastFetchAt: string;
    entityAgeP50Seconds: number | null;
    vehicles: number;
    pctTripResolved: number | null;
    alerts: number;
  };
  router: { up: boolean; version: string; graphBuiltAt: string | null };
};

export type Healthz = { status: string; version: string; cities: string[] };
