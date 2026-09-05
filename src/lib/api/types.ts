/**
 * Types mirroring the opentransit API contract v1 + v1.1 additions (ROADMAP-v1.1.md).
 * v1.1 fields are optional so the client keeps working against a v1 API.
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
  | "TRANSIT"
  /** v1.2 — shared vehicles (GBFS). `BIKE_RENTAL`/`SCOOTER_RENTAL` are planner modes; `SCOOTER` a leg mode. */
  | "BIKE_RENTAL"
  | "SCOOTER_RENTAL"
  | "SCOOTER";

export type Geometry = { encoded: string; precision: number };

export type ApiErrorDetail = { path: string; message: string };
export type ApiError = { error: { code: string; message: string; details?: ApiErrorDetail[] } };

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
  /** v1.1 — optional so older API builds still parse. */
  components?: CityComponent[];
  fares?: CityFares | null;
  config?: CityConfig;
  links?: CityLinks;
  services?: CityService[];
  /** v1.2 — shared mobility networks (bike-share via GBFS). */
  mobility?: CityMobility | null;
};

/* ── v1.2 shared bikes (GBFS) ──────────────────────────────────────────────── */

export type RentalFormFactor = "bicycle" | "scooter" | "other";

export type BikeShareNetwork = {
  id: string;
  name: string;
  /** OTP vehicle-rental updater network id. */
  network: string;
  gbfsUrl: string;
  color: string;
  url: string | null;
  apps: { ios?: string | null; android?: string | null } | null;
  /** Derived from `system_pricing_plans` when null. */
  pricingSummary: string | null;
  formFactors: RentalFormFactor[];
};

export type CityMobility = { bikeShare: BikeShareNetwork[] };

export type RentalVehicleType = { id: string; formFactor: RentalFormFactor; propulsion: string; name: string | null };
export type RentalPricingPlan = { id: string; name: string; price: number; currency: string; description: string | null; isTaxable: boolean };

export type RentalNetworkInfo = BikeShareNetwork & {
  systemId: string | null;
  timezone: string | null;
  stations: number;
  vehicleTypes: RentalVehicleType[];
  pricingPlans: RentalPricingPlan[];
  lastFetchAt: string | null;
  up: boolean;
};
export type RentalNetworksResponse = { networks: RentalNetworkInfo[] };

export type RentalStation = {
  id: string;
  networkId: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number | null;
  vehiclesAvailable: number;
  ebikesAvailable: number;
  docksAvailable: number;
  isInstalled: boolean;
  isRenting: boolean;
  isReturning: boolean;
  lastReported: string | null;
};
export type RentalStationsResponse = { generatedAt: string; ttlSeconds: number; stations: RentalStation[] };
export type RentalStationDetail = RentalStation & {
  vehicleTypesAvailable: { id: string; formFactor: RentalFormFactor; propulsion: string; count: number }[];
  network: BikeShareNetwork | RentalNetworkInfo | null;
};
export type NearbyRentalStation = RentalStation & { kind: "rental_station"; distanceMeters: number };

/** A station as referenced from an itinerary leg (pickup / drop-off). */
export type RentalStationRef = {
  stationId: string;
  name: string;
  lat: number;
  lon: number;
  vehiclesAvailable: number | null;
  docksAvailable: number | null;
  lastReported: string | null;
};

export type RentalLegInfo = {
  networkId: string;
  networkName: string;
  color: string;
  vehicleType: "bicycle" | "electric_assist" | "scooter" | null;
  pickup: RentalStationRef | null;
  dropoff: RentalStationRef | null;
  freeFloating: boolean;
  priceEstimate: { amount: number; currency: string; label: string; estimated: boolean } | null;
};

export type CityComponent = {
  id: Component;
  label: string;
  color: string;
  icon: "brt" | "bus" | "cable" | "rail" | "tram" | "metro" | "boat" | "other";
};

export type CityFares = {
  currency: string;
  base: number;
  transfer: number;
  transferWindowMinutes: number;
  maxTransfers: number;
  note: string | null;
  estimated: boolean;
};

export type CityConfig = {
  vehiclePollSeconds: number;
  departuresRefreshSeconds: number;
  features: Partial<{
    liveVehicles: boolean;
    board: boolean;
    pois: boolean;
    followAlong: boolean;
    bike: boolean;
    next: boolean;
    favorites: boolean;
    alerts: boolean;
  }>;
  minAppVersion: { ios: string; android: string; web?: string } | null;
  maintenance: { active: boolean; message: string | null } | null;
};

export type CityLinks = Partial<{
  pqrs: string | null;
  recharge: string | null;
  support: string | null;
  privacy: string | null;
  fares: string | null;
}>;

export type CityService = {
  id: string;
  label: string;
  icon: string;
  url: string;
  kind: "external" | "internal";
};

export type ServiceWindow = {
  start: string; // "04:00"
  end: string; // "23:00"
  active: boolean;
  nextStart: string | null;
  source: "gtfs" | "config";
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
  serviceWindow?: ServiceWindow | null;
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
  /** v1.2 — set when the place is a bike-share station. */
  rentalStationId?: string | null;
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
  /** v1.2 — present on shared-vehicle legs (mode BICYCLE/SCOOTER, transit=false). */
  rental?: RentalLegInfo | null;
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
  fare: Fare | null;
  accessible: boolean | null;
  legs: Leg[];
  /** v1.2 */
  rentalLegs?: number;
  modesUsed?: string[];
};

export type FareLine = { label: string; amount: number; kind?: "transit" | "rental" | string };
export type Fare = {
  amount: number;
  currency: string;
  estimated?: boolean;
  breakdown?: FareLine[];
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
  fromName?: string;
  toName?: string;
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
  /** v1.1 — honest accessibility: `verified=false` when the feed value is a blanket default. */
  accessibility?: StopAccessibility | null;
};

export type StopAccessibility = {
  wheelchair: "accessible" | "not_accessible" | "unknown";
  source: "gtfs" | "osm" | "none";
  verified: boolean;
  note: string | null;
};

export type NearbyStop = Stop & { distanceMeters: number; kind?: "stop" | "rental_station" };
/** `?include=stops,rental` adds bike-share stations (in `rental`, or inline in `stops` with `kind`). */
export type NearbyResponse = { stops: NearbyStop[]; rental?: NearbyRentalStation[] };

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

export type Freshness = { realtime: boolean; ageSeconds: number | null; stale: boolean };

export type BoardTime = {
  time: string;
  minutes: number;
  realtime: boolean;
  delaySeconds: number | null;
  tripId: string | null;
  vehicleId: string | null;
};

export type BoardRow = { route: RouteRef; headsign: string | null; next: BoardTime[] };

export type BoardResponse = {
  stop: Stop;
  generatedAt: string;
  freshness: Freshness;
  rows: BoardRow[];
};

export type NextBus = {
  minutes: number;
  time: string;
  source: "live" | "scheduled" | "estimated";
  vehicle: Vehicle | null;
  stopsAway: number | null;
  distanceMeters: number | null;
  tripId: string | null;
};

export type NextResponse = {
  stop: Stop;
  route: RouteRef;
  freshness: Freshness;
  next: NextBus[];
};

export type PoiType = "bike_parking" | "toilets" | "atm" | "health" | "library" | "other";

export type PoiProperties = {
  id: string;
  type: PoiType;
  name: string | null;
  source: "osm" | "city";
  osmId?: string | null;
  wheelchair?: "yes" | "no" | "limited" | null;
};

export type PoiCollection = {
  type: "FeatureCollection";
  features: { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: PoiProperties }[];
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
    enabled?: boolean;
    lastFetchAt: string | null;
    entityAgeP50Seconds: number | null;
    vehicles: number;
    pctTripResolved: number | null;
    alerts: number;
    stale?: boolean;
    staleSeconds?: number | null;
  };
  router: { up: boolean; version: string; graphBuiltAt: string | null };
  /** v1.2 */
  rental?: { networks: { id: string; up: boolean; stations: number; vehiclesAvailable: number; ageSeconds: number | null }[] } | null;
};

export type Healthz = { status: string; version: string; cities: string[] };

/* ── Admin (operators): per-city overrides on top of cities/*.yaml ─────────── */

export type AdminMe = { ok: true; cities: string[] };

/** The editable slice of a city. `null` in `override` means "not overridden". */
export type AdminEditable = {
  fares: CityFares | null;
  config: CityConfig | null;
  links: CityLinks | null;
  services: CityService[] | null;
  branding: { primaryColor: string } | null;
  /** v1.2 — bike-share networks (GBFS). */
  mobility: CityMobility | null;
};
export type AdminSection = keyof AdminEditable;
export type AdminOverride = Partial<AdminEditable>;

export type AdminConfigResponse = {
  effective: City;
  override: AdminOverride | null;
  yaml: AdminEditable;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** PUT body: only the sections being changed; JSON `null` resets a section to YAML. */
export type AdminConfigPatch = Partial<AdminEditable> & { note?: string; updatedBy?: string };

export type AdminHistoryItem = {
  revision: number;
  changedAt: string;
  changedBy: string | null;
  note: string | null;
  data: AdminOverride | null;
};
export type AdminHistoryResponse = { items: AdminHistoryItem[] };
