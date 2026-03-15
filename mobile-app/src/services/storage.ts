/**
 * Express AI — Storage Service
 * Manages recordings on device filesystem using expo-file-system (SDK 54 API)
 */
import { Paths, File, Directory } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { RecordingMeta } from '../types';

function getRecordingsDir(): Directory {
    return new Directory(Paths.document, 'recordings');
}

function getMetaFile(): File {
    return new File(Paths.document, 'recordings_meta.json');
}

/** Ensure the recordings directory exists */
export function ensureDir(): void {
    const dir = getRecordingsDir();
    if (!dir.exists) {
        dir.create({ intermediates: true });
    }
}

/** Load all recording metadata */
export async function getRecordings(): Promise<RecordingMeta[]> {
    try {
        const metaFile = getMetaFile();
        if (!metaFile.exists) return [];
        const raw = await metaFile.text();
        return JSON.parse(raw) as RecordingMeta[];
    } catch {
        return [];
    }
}

/** Save updated metadata list */
function saveMeta(recordings: RecordingMeta[]): void {
    const metaFile = getMetaFile();
    metaFile.write(JSON.stringify(recordings));
}

/** Save a new recording (CSV + video) and return metadata */
export async function saveRecording(params: {
    csvContent: string;
    videoUri: string;
    durationSec: number;
    sampleCount: number;
    distanceKm: number;
}): Promise<RecordingMeta> {
    ensureDir();

    const now = new Date();
    const id = now.getTime().toString();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

    const csvFilename = `sensor_data_${dateStr}_${id}.csv`;
    const videoFilename = `survey_video_${dateStr}_${id}.mp4`;

    const recDir = getRecordingsDir();
    const csvFile = new File(recDir, csvFilename);
    const videoDestFile = new File(recDir, videoFilename);

    // Write CSV
    csvFile.write(params.csvContent);

    // Copy video to recordings folder
    const sourceVideo = new File(params.videoUri);
    sourceVideo.copy(videoDestFile);

    // Get file sizes
    const csvSize = csvFile.exists ? csvFile.size : 0;
    const videoSize = videoDestFile.exists ? videoDestFile.size : 0;

    const meta: RecordingMeta = {
        id,
        startedAt: now.toISOString(),
        durationSec: params.durationSec,
        sampleCount: params.sampleCount,
        distanceKm: params.distanceKm,
        csvFilename,
        videoFilename,
        csvUri: csvFile.uri,
        videoUri: videoDestFile.uri,
        csvSizeBytes: csvSize,
        videoSizeBytes: videoSize,
    };

    const recordings = await getRecordings();
    recordings.unshift(meta);
    saveMeta(recordings);

    return meta;
}

/** Delete a recording by ID */
export async function deleteRecording(id: string): Promise<void> {
    const recordings = await getRecordings();
    const target = recordings.find(r => r.id === id);
    if (!target) return;

    try {
        const csvFile = new File(target.csvUri);
        if (csvFile.exists) csvFile.delete();
    } catch { }
    try {
        const videoFile = new File(target.videoUri);
        if (videoFile.exists) videoFile.delete();
    } catch { }

    const updated = recordings.filter(r => r.id !== id);
    saveMeta(updated);
}

/** Delete all recordings */
export function clearAllRecordings(): void {
    try {
        const dir = getRecordingsDir();
        if (dir.exists) dir.delete();
    } catch { }
    try {
        const meta = getMetaFile();
        if (meta.exists) meta.delete();
    } catch { }
}

/** Share/export a file */
export async function shareFile(uri: string): Promise<void> {
    const available = await isAvailableAsync();
    if (available) {
        await shareAsync(uri);
    }
}

/** Get total storage used by recordings */
export async function getStorageUsed(): Promise<number> {
    const recordings = await getRecordings();
    return recordings.reduce((sum, r) => sum + r.csvSizeBytes + r.videoSizeBytes, 0);
}

/** Format bytes to human readable string */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
