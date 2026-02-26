/* Ambient type declarations for the project */

// GeoJSON types (simplified)
declare namespace GeoJSON {
  interface Feature {
    type: "Feature";
    geometry: Geometry;
    properties: Record<string, unknown>;
  }

  interface FeatureCollection {
    type: "FeatureCollection";
    features: Feature[];
  }

  type Geometry =
    | Point
    | MultiPoint
    | LineString
    | MultiLineString
    | Polygon
    | MultiPolygon;

  interface Point {
    type: "Point";
    coordinates: number[];
  }
  interface MultiPoint {
    type: "MultiPoint";
    coordinates: number[][];
  }
  interface LineString {
    type: "LineString";
    coordinates: number[][];
  }
  interface MultiLineString {
    type: "MultiLineString";
    coordinates: number[][][];
  }
  interface Polygon {
    type: "Polygon";
    coordinates: number[][][];
  }
  interface MultiPolygon {
    type: "MultiPolygon";
    coordinates: number[][][][];
  }
}
