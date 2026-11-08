---
name: postgis-geospatial
description: PostGIS geospatial data modeling and query patterns — geometry vs geography types, SRID/projections, GiST/SP-GiST indexing, proximity search, ORM integration (GeoDjango and similar), and performance tuning for location-aware applications.
origin: authored
---

# PostGIS Geospatial

Patterns for storing, indexing, and querying spatial data in PostgreSQL with PostGIS.

## Prerequisites (preflight)

Requires **PostGIS** extension and PostgreSQL client. Verify; warn if missing:

```bash
command -v psql >/dev/null 2>&1 || echo "WARN: psql missing — apt install postgresql-client"
```

Then enable PostGIS on your database:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## When to Activate

- Designing a schema that stores coordinates, routes, or areas (points, lines, polygons)
- Writing proximity, containment, or intersection queries ("nearest N", "within radius", "inside zone")
- Choosing between `geometry` and `geography` column types
- Debugging slow spatial queries or a missing/ignored spatial index
- Integrating spatial models into an ORM (GeoDjango, GeoAlchemy2, PostGIS via raw SQL)
- Reviewing SRID handling across a codebase (storage vs API vs display projection)

## Core Concepts

### `geometry` vs `geography`

| Aspect | `geometry` | `geography` |
|---|---|---|
| Coordinate math | Planar (Cartesian) | Spherical (on the ellipsoid) |
| Units | SRID-dependent (degrees or meters) | Always meters |
| Accuracy over large distances | Degrades, needs projection | Correct globally, no reprojection |
| Function support | Full (all ST_* functions) | Subset, growing each release |
| Performance | Faster (simpler math) | Slower (~2-10x on distance/DWithin) |
| Typical SRID | Local projected (e.g. 3857, 2154) | 4326 only |

Rule of thumb: use `geography` for small-to-medium tables needing correct
global distance/radius semantics with minimal tuning (points of interest,
vehicle positions, delivery addresses). Use `geometry` + a local projected
SRID when the dataset is large, region-bound, or needs polygon-heavy
operations (routing corridors, coverage zones, dense tiling) — projected
`geometry` is significantly faster for repeated `ST_DWithin`/`ST_Distance`.

### SRID / projections

- **4326 (WGS84)** — degrees, lat/lon, the GPS/API interchange standard.
  Never compute distances directly in 4326 `geometry` — degrees are not
  meters and distort with latitude.
- **3857 (Web Mercator)** — meters, used for web map tiles (Leaflet,
  Mapbox, OSM slippy tiles). Distorts area/distance away from the equator;
  fine for rendering, poor for measurement.
- **Local projected CRS** (e.g. 2154 Lambert-93 for France, UTM zones) —
  meters, minimal distortion for area/distance math within the region.
  Prefer this over 3857 for real measurement work.
- Store in 4326 (interchange-friendly), reproject with `ST_Transform` only
  at the moment of measurement or tile generation. Never mix SRIDs in a
  single spatial predicate — PostGIS raises `ERROR: Operation on mixed SRID
  geometries` rather than silently reprojecting.

```sql
-- Reproject before measuring in geometry mode
SELECT ST_Distance(
    ST_Transform(a.location, 2154),
    ST_Transform(b.location, 2154)
) AS distance_meters
FROM point_of_interest a, point_of_interest b
WHERE a.id = 1 AND b.id = 2;
```

## Indexing

- **GiST** — the default and near-universal choice for spatial columns
  (`geometry`, `geography`, box types). Supports all bounding-box-based
  operators (`&&`, `ST_DWithin`, `ST_Intersects`, `ST_Contains`, KNN `<->`).
- **SP-GiST** — for skewed or non-uniformly distributed point data (e.g.
  points clustered in city centers with sparse coverage elsewhere); can
  outperform GiST on `geometry` point columns. Not implemented for all
  operator classes — check before switching.
- **BRIN** — only for very large, naturally ordered spatial tables (e.g.
  time-partitioned tracking data) where the geometry roughly correlates
  with insertion order. Much cheaper to maintain, less precise.

```sql
CREATE INDEX idx_point_of_interest_location
    ON point_of_interest USING GIST (location);

-- Speed up KNN "nearest N" queries specifically
CREATE INDEX idx_point_of_interest_location_ops
    ON point_of_interest USING GIST (location gist_geometry_ops_2d);
```

A spatial column without a GiST index forces a sequential scan on every
`ST_DWithin`/`ST_Intersects` call — this is the single most common
performance bug in spatial schemas.

## Key Functions

| Function | Purpose |
|---|---|
| `ST_DWithin(a, b, distance)` | "Within distance" — index-accelerated, preferred over `ST_Distance(a,b) < x` |
| `ST_Distance(a, b)` | Exact distance; not index-accelerated by itself |
| `ST_Intersects(a, b)` | True if geometries share any point — for zone/corridor overlap checks |
| `ST_Contains(a, b)` | True if `a` fully contains `b` — geofencing, "is point inside polygon" |
| `ST_AsGeoJSON(geom)` | Serialize to GeoJSON for API responses |
| `ST_Transform(geom, srid)` | Reproject between coordinate systems |
| `ST_MakePoint(lon, lat)` / `ST_SetSRID(...)` | Construct a point with an explicit SRID |
| `ST_Buffer(geom, distance)` | Expand a geometry by a radius — build search/coverage areas |
| `ST_Simplify(geom, tolerance)` | Reduce vertex count for tile rendering at low zoom |

### Proximity query (index-friendly)

```sql
-- Find points within 500m of a given location, closest first
SELECT id, name, ST_Distance(location, :origin) AS distance_meters
FROM point_of_interest
WHERE ST_DWithin(location, :origin, 500)
ORDER BY location <-> :origin
LIMIT 20;
```

`ST_DWithin` uses the index bounding-box filter before the exact distance
check; the `<->` KNN operator lets `ORDER BY ... LIMIT` use the index for
nearest-neighbor ranking instead of computing and sorting every distance.

### Containment / geofencing

```sql
SELECT v.id
FROM vehicle_position v
JOIN service_zone z ON ST_Contains(z.boundary, v.location)
WHERE z.id = :zone_id;
```

### Tiling (vector tiles for web maps)

```sql
SELECT ST_AsMVT(tile, 'points', 4096, 'geom')
FROM (
    SELECT id, name,
           ST_AsMVTGeom(
               ST_Transform(location, 3857),
               ST_TileEnvelope(:z, :x, :y),
               4096, 64, true
           ) AS geom
    FROM point_of_interest
    WHERE location && ST_Transform(ST_TileEnvelope(:z, :x, :y), 4326)
) AS tile;
```

Tile at 3857 (the slippy-tile standard), filter with the index-friendly
`&&` bounding-box operator before the exact `ST_AsMVTGeom` clip.

## ORM Integration

### GeoDjango

```python
class PointOfInterest(models.Model):
    name = models.CharField(max_length=200)
    location = gis_models.PointField(geography=True, srid=4326)

class ServiceZone(models.Model):
    name = models.CharField(max_length=200)
    boundary = gis_models.PolygonField(srid=4326)
```

```python
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D

origin = Point(lon, lat, srid=4326)
nearby = (
    PointOfInterest.objects
    .filter(location__dwithin=(origin, D(m=500)))
    .annotate(distance=Distance("location", origin))
    .order_by("distance")[:20]
)
```

- `PointField(geography=True)` maps to a `geography` column — correct
  meter-based `dwithin`/`distance` lookups with no manual `ST_Transform`.
  Omit `geography=True` for a `geometry` column when you need full
  `ST_*` function coverage or plan to project explicitly.
- Always set `srid=4326` explicitly on field declarations; the Django
  default (`4326`) is implicit and easy to override by accident when
  copying field definitions across models.
- Django spatial lookups (`__dwithin`, `__distance_lte`, `__intersects`,
  `__contains`) compile to the equivalent `ST_*` predicates and remain
  index-accelerated — prefer them over raw SQL unless a function has no
  ORM lookup.

### Other ORMs (GeoAlchemy2, raw SQL)

Same principles apply: declare the column type (`Geography`/`Geometry`)
and SRID explicitly at the model layer, and route filters through
`ST_DWithin`/`ST_Intersects` rather than fetching rows and filtering in
application code.

## Pitfalls

- **SRID mismatch** — combining geometries with different SRIDs raises a
  hard error; combining `geometry` in degrees with meter-based logic
  (no error, wrong answer) is worse. Always confirm SRID at both write
  and read paths, especially when ingesting third-party GPS feeds.
- **`geometry` vs `geography` cost surprise** — `geography` correctness
  comes with real overhead on heavy `ST_DWithin`/`ST_Distance` workloads;
  benchmark both on production-scale data before committing to one.
- **Missing spatial index** — a spatial predicate on an unindexed column
  silently falls back to a sequential scan; `EXPLAIN ANALYZE` is the only
  reliable way to catch this, `EXPLAIN` alone does not show row counts.
- **`ST_Distance(a, b) < x` instead of `ST_DWithin`** — computes exact
  distance for every row before filtering; `ST_DWithin` filters via the
  index first.
- **Reprojecting inside a hot loop** — `ST_Transform` per row in a large
  scan is expensive; transform the constant/input side once, not the
  indexed column, or maintain a precomputed projected column.
- **Mixing 3857 for measurement** — Web Mercator distorts distance/area
  away from the equator; use a local projected CRS for real measurement,
  reserve 3857 for tile rendering only.
- **Over-fetching precision for display** — sending full-precision
  polygons to a web map at low zoom wastes bandwidth; apply `ST_Simplify`
  or vector tiles (`ST_AsMVT`) instead.
- **`VACUUM`/`ANALYZE` neglect on spatial tables** — GiST index bloat from
  frequent updates (e.g. live vehicle tracking) degrades query plans over
  time; autovacuum tuning matters more on high-churn spatial tables.

## Checklist

- [ ] Column type (`geometry`/`geography`) chosen deliberately, not by default
- [ ] SRID declared explicitly on every spatial column and every constructed point
- [ ] GiST (or SP-GiST for skewed point data) index exists on every spatial column used in a predicate
- [ ] Proximity queries use `ST_DWithin`/`<->`, never `ST_Distance(...) < x`
- [ ] Reprojection (`ST_Transform`) happens once, on the constant side, not the indexed column
- [ ] Measurement math uses a projected CRS (local UTM/Lambert), not raw 4326 degrees or 3857
- [ ] `EXPLAIN ANALYZE` confirms index usage on hot spatial queries
- [ ] Tile/rendering paths simplify geometry or use `ST_AsMVT` instead of shipping full precision
- [ ] Autovacuum/index maintenance considered for high-churn spatial tables
