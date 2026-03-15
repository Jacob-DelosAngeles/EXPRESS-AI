/**
 * Express AI — Type Definitions
 * Matches IRI CSV column format used in the DAAN-FERN pipeline
 */

/** A single sensor data sample at a point in time */
export interface SensorSample {
  /** ISO 8601 datetime string (e.g., "2026-02-16T07:00:00.000Z") */
  time: string;
  /** Linear acceleration X in m/s² (gravity removed) */
  ax: number;
  /** Linear acceleration Y in m/s² (gravity removed) */
  ay: number;
  /** Linear acceleration Z in m/s² (gravity removed) */
  az: number;
  /** Gyroscope X angular velocity in rad/s */
  gx: number;
  /** Gyroscope Y angular velocity in rad/s */
  gy: number;
  /** Gyroscope Z angular velocity in rad/s */
  gz: number;
  /** GPS Latitude in decimal degrees */
  latitude: number | null;
  /** GPS Longitude in decimal degrees */
  longitude: number | null;
  /** GPS Altitude in meters */
  altitude: number | null;
  /** Ground speed in m/s */
  speed: number | null;
  /** Compass heading / direction in degrees */
  direction: number | null;
  /** Number of satellites (Android only, null on iOS) */
  satellites: number | null;
}

/** CSV column headers matching IRI pipeline format */
export const CSV_HEADERS: (keyof SensorSample)[] = [
  'time', 'ax', 'ay', 'az', 'gx', 'gy', 'gz',
  'latitude', 'longitude', 'altitude', 'speed', 'direction', 'satellites',
];

/** Metadata for a saved recording session */
export interface RecordingMeta {
  id: string;
  /** Date string when recording started */
  startedAt: string;
  /** Duration in seconds */
  durationSec: number;
  /** Number of sensor samples collected */
  sampleCount: number;
  /** Calculated distance in km (Haversine) */
  distanceKm: number;
  /** CSV filename */
  csvFilename: string;
  /** Video filename */
  videoFilename: string;
  /** CSV file URI */
  csvUri: string;
  /** Video file URI */
  videoUri: string;
  /** Size of CSV file in bytes */
  csvSizeBytes: number;
  /** Size of video file in bytes */
  videoSizeBytes: number;
}

/** App settings */
export interface AppSettings {
  /** Sensor sampling rate in Hz (10, 20, 50) */
  samplingRateHz: number;
  /** Video quality: '720p' | '1080p' | '4K' */
  videoQuality: '720p' | '1080p' | '4K';
  /** Whether to include audio in video recording */
  includeAudio: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  samplingRateHz: 10,
  videoQuality: '1080p',
  includeAudio: false,
};

export type ViewState = 'dashboard' | 'recorder' | 'recordings' | 'settings';
