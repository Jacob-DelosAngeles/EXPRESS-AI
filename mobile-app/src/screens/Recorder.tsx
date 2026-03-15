/**
 * Express AI — Recorder Screen
 * Core recording functionality: Camera + GPS + Accelerometer + Gyroscope
 * Outputs: MP4 video + CSV matching Physics Toolbox Sensor Suite format
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { SensorSample, AppSettings, DEFAULT_SETTINGS } from '../types';
import { formatTime, totalDistanceKm, generateCsv } from '../utils';
import { saveRecording } from '../services/storage';

interface Props {
    onBack: () => void;
    settings: AppSettings;
}

const Recorder: React.FC<Props> = ({ onBack, settings }) => {
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [saving, setSaving] = useState(false);

    // Live sensor display values
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);
    const [alt, setAlt] = useState<number | null>(null);
    const [speed, setSpeed] = useState<number | null>(null);
    const [heading, setHeading] = useState<number | null>(null);
    const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 });
    const [gyro, setGyro] = useState({ x: 0, y: 0, z: 0 });

    // Refs for recording data (avoid stale closures)
    const cameraRef = useRef<CameraView>(null);
    const samplesRef = useRef<SensorSample[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sensorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);

    // Latest sensor values (mutable ref for interval callback)
    const latestSensor = useRef({
        lat: null as number | null,
        lng: null as number | null,
        alt: null as number | null,
        speed: null as number | null,
        heading: null as number | null,
        ax: 0, ay: 0, az: 0,
        gx: 0, gy: 0, gz: 0,
    });

    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Request permissions on mount
    useEffect(() => {
        (async () => {
            await requestCameraPermission();
            const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
            if (locStatus !== 'granted') {
                Alert.alert('Permission Required', 'GPS access is needed for road survey data collection.');
            }
        })();
    }, []);

    // Set up sensor listeners
    useEffect(() => {
        const intervalMs = Math.round(1000 / settings.samplingRateHz);
        DeviceMotion.setUpdateInterval(intervalMs);

        const motionSub = DeviceMotion.addListener(data => {
            if (data.acceleration) {
                const ax = data.acceleration.x;
                const ay = data.acceleration.y;
                const az = data.acceleration.z;
                setAccel({ x: ax, y: ay, z: az });
                latestSensor.current.ax = ax;
                latestSensor.current.ay = ay;
                latestSensor.current.az = az;
            }
            if (data.rotationRate) {
                const degToRad = Math.PI / 180;
                const gx = data.rotationRate.alpha * degToRad;
                const gy = data.rotationRate.beta * degToRad;
                const gz = data.rotationRate.gamma * degToRad;
                setGyro({ x: gx, y: gy, z: gz });
                latestSensor.current.gx = gx;
                latestSensor.current.gy = gy;
                latestSensor.current.gz = gz;
            }
        });

        return () => {
            motionSub.remove();
        };
    }, [settings.samplingRateHz]);

    // Start GPS tracking
    useEffect(() => {
        let sub: Location.LocationSubscription | null = null;
        (async () => {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return;
            sub = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 500,
                    distanceInterval: 0,
                },
                (location) => {
                    const { latitude, longitude, altitude, speed: spd, heading: hdg } = location.coords;
                    setLat(latitude);
                    setLng(longitude);
                    setAlt(altitude);
                    setSpeed(spd);
                    setHeading(hdg);
                    latestSensor.current.lat = latitude;
                    latestSensor.current.lng = longitude;
                    latestSensor.current.alt = altitude;
                    latestSensor.current.speed = spd;
                    latestSensor.current.heading = hdg;
                }
            );
            locationSubRef.current = sub;
        })();

        return () => {
            if (sub) sub.remove();
        };
    }, []);

    // Pulse animation for recording indicator
    useEffect(() => {
        if (isRecording) {
            const anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            );
            anim.start();
            return () => anim.stop();
        }
    }, [isRecording]);

    const startRecording = useCallback(async () => {
        if (!cameraRef.current) return;

        try {
            // Clear previous data
            samplesRef.current = [];
            startTimeRef.current = Date.now();
            setRecordingTime(0);

            // Keep screen awake during recording
            await activateKeepAwakeAsync('recording');

            // Determine video quality
            const qualityMap = {
                '720p': '720p' as const,
                '1080p': '1080p' as const,
                '4K': '2160p' as const,
            };

            // Start video recording
            const videoPromise = cameraRef.current.recordAsync({
                maxDuration: 3600, // 1 hour max
            });

            setIsRecording(true);

            // Timer (1 second intervals for display)
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            // Sensor sampling interval (matching Physics Toolbox rate)
            const sampleIntervalMs = Math.round(1000 / settings.samplingRateHz);
            sensorIntervalRef.current = setInterval(() => {
                const now = new Date();
                const s = latestSensor.current;
                const sample: SensorSample = {
                    time: now.toISOString(),
                    ax: Number(s.ax.toFixed(6)),
                    ay: Number(s.ay.toFixed(6)),
                    az: Number(s.az.toFixed(6)),
                    gx: Number(s.gx.toFixed(6)),
                    gy: Number(s.gy.toFixed(6)),
                    gz: Number(s.gz.toFixed(6)),
                    latitude: s.lat,
                    longitude: s.lng,
                    altitude: s.alt,
                    speed: s.speed,
                    direction: s.heading,
                    satellites: null, // Not available via expo-location
                };
                samplesRef.current.push(sample);
            }, sampleIntervalMs);

            // Wait for recording to complete (stopped by user)
            const videoResult = await videoPromise;

            // Recording has stopped, now save
            await saveOutputs(videoResult?.uri || '');
        } catch (err) {
            console.error('Recording error:', err);
            Alert.alert('Recording Error', String(err));
            setIsRecording(false);
            deactivateKeepAwake('recording');
        }
    }, [settings]);

    const stopRecording = useCallback(() => {
        if (cameraRef.current && isRecording) {
            cameraRef.current.stopRecording();
            if (timerRef.current) clearInterval(timerRef.current);
            if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
            setIsRecording(false);
            deactivateKeepAwake('recording');
        }
    }, [isRecording]);

    const saveOutputs = async (videoUri: string) => {
        setSaving(true);
        try {
            const samples = samplesRef.current;
            const csvContent = generateCsv(samples);
            const distance = totalDistanceKm(samples);
            const durationMs = samples.length > 0
                ? new Date(samples[samples.length - 1].time).getTime() - new Date(samples[0].time).getTime()
                : 0;
            const duration = durationMs / 1000;

            await saveRecording({
                csvContent,
                videoUri,
                durationSec: Math.round(duration),
                sampleCount: samples.length,
                distanceKm: Math.round(distance * 100) / 100,
            });

            Alert.alert(
                'Recording Saved ✓',
                `Duration: ${formatTime(Math.round(duration))}\nSamples: ${samples.length}\nDistance: ${distance.toFixed(2)} km`,
                [{ text: 'OK', onPress: onBack }]
            );
        } catch (err) {
            console.error('Save error:', err);
            Alert.alert('Save Error', String(err));
        } finally {
            setSaving(false);
        }
    };

    if (!cameraPermission?.granted) {
        return (
            <View style={styles.permissionContainer}>
                <MaterialIcons name="camera-alt" size={64} color={Colors.slate500} />
                <Text style={styles.permissionText}>Camera permission is required</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
                    <Text style={styles.permissionBtnText}>Grant Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.permissionBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Camera Preview — overlays are siblings to avoid CameraView children warning */}
            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="back"
                    mode="video"
                />

                {/* Status Indicators — positioned absolutely over camera */}
                <View style={styles.topOverlay}>
                    <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: isRecording ? Colors.red500 : Colors.accentGreen }]} />
                        <Text style={styles.statusLabel}>{isRecording ? 'RECORDING' : 'READY'}</Text>
                    </View>
                    <View style={styles.gpsBadge}>
                        <MaterialIcons name="gps-fixed" size={12} color={lat ? Colors.accentGreen : Colors.red500} />
                        <Text style={[styles.gpsText, { color: lat ? Colors.accentGreen : Colors.red500 }]}>
                            {lat ? 'GPS LOCK' : 'NO GPS'}
                        </Text>
                    </View>
                </View>

                {/* Timer */}
                {isRecording && (
                    <View style={styles.timerOverlay}>
                        <Animated.View style={[styles.timerBadge, { transform: [{ scale: pulseAnim }] }]}>
                            <View style={styles.recDot} />
                        </Animated.View>
                        <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
                    </View>
                )}

                {/* Reticle */}
                <View style={styles.reticle}>
                    <View style={[styles.corner, styles.tl]} />
                    <View style={[styles.corner, styles.tr]} />
                    <View style={[styles.corner, styles.bl]} />
                    <View style={[styles.corner, styles.br]} />
                </View>

                {/* Bottom info */}
                <View style={styles.bottomOverlay}>
                    <Text style={styles.fpsText}>
                        {settings.samplingRateHz} Hz  •  {settings.videoQuality}
                    </Text>
                </View>
            </View>

            {/* Telemetry Panel */}
            <View style={styles.telemetryPanel}>
                <View style={styles.handleBar} />

                {/* GPS Section */}
                <View style={styles.sensorCard}>
                    <View style={styles.sensorHeader}>
                        <MaterialIcons name="my-location" size={14} color={Colors.primary} />
                        <Text style={styles.sensorTitle}>GPS TELEMETRY</Text>
                    </View>
                    <View style={styles.gpsGrid}>
                        <View style={styles.dataCell}>
                            <Text style={styles.dataLabel}>LAT</Text>
                            <Text style={styles.dataValue}>{lat?.toFixed(5) ?? '—'}</Text>
                        </View>
                        <View style={styles.dataCell}>
                            <Text style={styles.dataLabel}>LNG</Text>
                            <Text style={styles.dataValue}>{lng?.toFixed(5) ?? '—'}</Text>
                        </View>
                        <View style={[styles.dataCell, styles.speedCell]}>
                            <Text style={[styles.dataLabel, { color: Colors.primary }]}>SPEED</Text>
                            <Text style={styles.dataValue}>
                                {speed !== null ? `${(speed * 3.6).toFixed(0)}` : '—'}
                                <Text style={styles.dataUnit}> km/h</Text>
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Accel + Gyro Row */}
                <View style={styles.sensorRow}>
                    {/* Accelerometer */}
                    <View style={[styles.sensorCard, { flex: 1 }]}>
                        <View style={styles.sensorHeader}>
                            <MaterialIcons name="speed" size={14} color={Colors.primary} />
                            <Text style={styles.sensorTitle}>ACCEL (m/s²)</Text>
                        </View>
                        {[
                            { label: 'X', val: accel.x },
                            { label: 'Y', val: accel.y },
                            { label: 'Z', val: accel.z },
                        ].map(a => (
                            <View key={a.label} style={styles.barRow}>
                                <Text style={styles.barLabel}>{a.label}</Text>
                                <View style={styles.barTrack}>
                                    <View
                                        style={[styles.barFill, { width: `${Math.min(Math.abs(a.val) * 5, 100)}%` }]}
                                    />
                                </View>
                                <Text style={styles.barValue}>{a.val.toFixed(1)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Gyroscope */}
                    <View style={[styles.sensorCard, { flex: 1 }]}>
                        <View style={styles.sensorHeader}>
                            <MaterialIcons name="360" size={14} color={Colors.primary} />
                            <Text style={styles.sensorTitle}>GYRO (rad/s)</Text>
                        </View>
                        {[
                            { label: 'X', val: gyro.x },
                            { label: 'Y', val: gyro.y },
                            { label: 'Z', val: gyro.z },
                        ].map(g => (
                            <View key={g.label} style={styles.barRow}>
                                <Text style={styles.barLabel}>{g.label}</Text>
                                <View style={styles.barTrack}>
                                    <View
                                        style={[styles.barFill, { width: `${Math.min(Math.abs(g.val) * 20, 100)}%` }]}
                                    />
                                </View>
                                <Text style={styles.barValue}>{g.val.toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <TouchableOpacity style={styles.ctrlBtn} onPress={onBack} disabled={isRecording}>
                    <MaterialIcons name="arrow-back" size={24} color={isRecording ? Colors.slate700 : Colors.slate400} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={isRecording ? stopRecording : startRecording}
                    disabled={saving}
                    activeOpacity={0.8}
                >
                    <View style={[styles.recordRing, isRecording && styles.recordRingActive]}>
                        <View style={[
                            styles.recordButton,
                            isRecording ? styles.stopButton : styles.startButton,
                        ]}>
                            {isRecording ? (
                                <View style={styles.stopSquare} />
                            ) : (
                                <MaterialIcons name="fiber-manual-record" size={32} color="#fff" />
                            )}
                        </View>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.ctrlBtn} disabled>
                    <MaterialIcons name="folder-open" size={24} color={Colors.slate700} />
                </TouchableOpacity>
            </View>

            {/* Saving overlay */}
            {saving && (
                <View style={styles.savingOverlay}>
                    <Text style={styles.savingText}>Saving recording...</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.navyDark },
    permissionContainer: {
        flex: 1,
        backgroundColor: Colors.navyDark,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: 40,
    },
    permissionText: { fontSize: 16, color: Colors.slate400, textAlign: 'center' },
    permissionBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    backBtn: {
        backgroundColor: Colors.card,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },

    // Camera
    cameraContainer: { height: '50%', overflow: 'hidden', backgroundColor: '#000' },
    camera: { flex: 1 },

    // Overlays
    topOverlay: {
        position: 'absolute',
        top: 50,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: `${Colors.surface}CC`,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusLabel: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
    gpsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: `${Colors.surface}CC`,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    gpsText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },

    timerOverlay: {
        position: 'absolute',
        top: 90,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(239,68,68,0.2)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.4)',
    },
    timerBadge: {},
    recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.red500 },
    timerText: { fontSize: 14, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },

    reticle: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 60,
        height: 60,
        marginTop: -30,
        marginLeft: -30,
        borderWidth: 1,
        borderColor: `${Colors.primary}66`,
    },
    corner: { position: 'absolute', width: 10, height: 10 },
    tl: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2, borderColor: Colors.primary },
    tr: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2, borderColor: Colors.primary },
    bl: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: Colors.primary },
    br: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2, borderColor: Colors.primary },

    bottomOverlay: { position: 'absolute', bottom: 12, right: 16 },
    fpsText: {
        fontSize: 9,
        color: Colors.accentGreen,
        fontVariant: ['tabular-nums'],
        backgroundColor: `${Colors.navyDark}88`,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        overflow: 'hidden',
        fontWeight: '600',
        letterSpacing: 1,
    },

    // Telemetry
    telemetryPanel: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -20,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 90,
        overflow: 'hidden',
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 12,
    },
    sensorCard: {
        backgroundColor: Colors.card,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    sensorHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    sensorTitle: { fontSize: 10, fontWeight: '700', color: '#93c5fd', letterSpacing: 1 },
    gpsGrid: { flexDirection: 'row', gap: 8 },
    dataCell: {
        flex: 1,
        backgroundColor: `${Colors.navyDark}88`,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    speedCell: { borderRightWidth: 2, borderRightColor: Colors.primary },
    dataLabel: { fontSize: 9, color: Colors.slate400, fontWeight: '600', letterSpacing: 1, marginBottom: 4 },
    dataValue: { fontSize: 14, color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
    dataUnit: { fontSize: 9, color: Colors.slate400, fontWeight: '400' },

    sensorRow: { flexDirection: 'row', gap: 8 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    barLabel: { fontSize: 9, color: Colors.slate400, width: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
    barTrack: {
        flex: 1,
        height: 6,
        backgroundColor: Colors.navyDark,
        borderRadius: 3,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
    barValue: { fontSize: 9, color: '#fff', width: 36, textAlign: 'right', fontWeight: '600', fontVariant: ['tabular-nums'] },

    // Controls
    controls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 20,
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    ctrlBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    recordRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.navyDark,
    },
    recordRingActive: { borderColor: `${Colors.red500}88` },
    recordButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    startButton: { backgroundColor: Colors.primary },
    stopButton: { backgroundColor: Colors.red500 },
    stopSquare: { width: 20, height: 20, borderRadius: 3, backgroundColor: '#fff' },

    savingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    savingText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

export default Recorder;
