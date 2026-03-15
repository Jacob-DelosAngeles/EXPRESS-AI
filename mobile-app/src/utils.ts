/**
 * Express AI — Utility Functions
 */
import { SensorSample, CSV_HEADERS } from './types';

/** Calculate distance between two GPS points using Haversine formula (in km) */
export function haversineKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/** Format seconds to HH:MM:SS */
export function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Format a date to a short readable string */
export function formatDate(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

/** Generate CSV content from sensor samples */
export function generateCsv(samples: SensorSample[]): string {
    const header = CSV_HEADERS.join(',');
    const rows = samples.map(s =>
        CSV_HEADERS.map((key: keyof SensorSample) => {
            const val = s[key];
            if (val === null || val === undefined) return '';
            if (typeof val === 'number') return val.toFixed(6);
            return String(val); // handles ISO string for 'time'
        }).join(',')
    );
    return header + '\n' + rows.join('\n') + '\n';
}

/** Calculate total distance from a list of sensor samples */
export function totalDistanceKm(samples: SensorSample[]): number {
    let total = 0;
    for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1];
        const curr = samples[i];
        if (
            prev.latitude !== null && prev.longitude !== null &&
            curr.latitude !== null && curr.longitude !== null
        ) {
            total += haversineKm(
                prev.latitude, prev.longitude,
                curr.latitude, curr.longitude
            );
        }
    }
    return total;
}
