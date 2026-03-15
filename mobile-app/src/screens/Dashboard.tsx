/**
 * Express AI — Dashboard Screen
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { RecordingMeta } from '../types';
import { getRecordings, getStorageUsed, formatBytes } from '../services/storage';
import { formatDate } from '../utils';

interface Props {
    onNavigate: (view: string) => void;
}

const Dashboard: React.FC<Props> = ({ onNavigate }) => {
    const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
    const [storageUsed, setStorageUsed] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        const recs = await getRecordings();
        setRecordings(recs);
        const used = await getStorageUsed();
        setStorageUsed(used);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const totalDistance = recordings.reduce((s, r) => s + r.distanceKm, 0);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoRow}>
                        <Image source={require('../../assets/express-ai-logo.png')} style={styles.logo} />
                        <Text style={styles.brandText}>
                            Express <Text style={{ color: Colors.accentGreen }}>AI</Text>
                        </Text>
                    </View>
                    <Text style={styles.title}>
                        Digital Analytics for{'\n'}
                        <Text style={styles.gradientText}>Road Infrastructure</Text>
                    </Text>
                    <Text style={styles.subtitle}>
                        Expert Platform for Road Evaluation and Smart Surveillance. Empowering LGUs with AI-powered road assessment.
                    </Text>
                </View>

                {/* New Recording Button */}
                <TouchableOpacity style={styles.recordBtn} onPress={() => onNavigate('recorder')} activeOpacity={0.85}>
                    <MaterialIcons name="fiber-manual-record" size={20} color="#fff" />
                    <Text style={styles.recordBtnText}>New Recording</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>

                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>TOTAL DISTANCE</Text>
                        <View style={styles.statValueRow}>
                            <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
                            <Text style={styles.statUnit}>km</Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: '60%' }]} />
                        </View>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>SESSIONS</Text>
                        <View style={styles.statValueRow}>
                            <Text style={styles.statValue}>{recordings.length}</Text>
                            <Text style={styles.statUnit}>logs</Text>
                        </View>
                        <View style={styles.statusDot}>
                            <View style={styles.dotGreen} />
                            <Text style={styles.statusText}>System Ready</Text>
                        </View>
                    </View>
                </View>

                {/* Storage */}
                <View style={styles.storageCard}>
                    <MaterialIcons name="sd-storage" size={18} color={Colors.primary} />
                    <Text style={styles.storageText}>Storage Used: {formatBytes(storageUsed)}</Text>
                </View>

                {/* Recent Logs */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>RECENT LOGS</Text>
                    <TouchableOpacity onPress={() => onNavigate('recordings')}>
                        <Text style={styles.viewAllText}>View All</Text>
                    </TouchableOpacity>
                </View>

                {recordings.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="videocam-off" size={48} color={Colors.slate500} />
                        <Text style={styles.emptyText}>No recordings yet</Text>
                        <Text style={styles.emptySubtext}>Tap "New Recording" to start your first survey</Text>
                    </View>
                ) : (
                    recordings.slice(0, 5).map(rec => (
                        <TouchableOpacity
                            key={rec.id}
                            style={styles.logItem}
                            onPress={() => onNavigate('recordings')}
                            activeOpacity={0.7}
                        >
                            <View style={styles.logIcon}>
                                <MaterialIcons name="description" size={20} color={Colors.slate400} />
                            </View>
                            <View style={styles.logInfo}>
                                <Text style={styles.logFilename} numberOfLines={1}>{rec.csvFilename}</Text>
                                <Text style={styles.logMeta}>
                                    {formatDate(rec.startedAt)}  •  {rec.distanceKm.toFixed(1)} km
                                </Text>
                            </View>
                            <View style={styles.logRight}>
                                <Text style={styles.logSize}>{formatBytes(rec.csvSizeBytes + rec.videoSizeBytes)}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <MaterialIcons name="sd-storage" size={10} color={Colors.accentGreen} />
                                    <Text style={styles.logLocal}>Local</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}

                {/* How it works */}
                <View style={styles.infoCard}>
                    <MaterialIcons name="info" size={18} color={Colors.accentGreen} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.infoTitle}>How it works</Text>
                        <Text style={styles.infoText}>
                            Mount your phone on the windshield, tap "New Recording", and drive. The app simultaneously captures GPS, accelerometer, gyroscope, and video — all synchronized in one CSV file matching Physics Toolbox format.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Nav */}
            <View style={styles.nav}>
                <TouchableOpacity style={styles.navItem} onPress={() => { }}>
                    <MaterialIcons name="dashboard" size={24} color={Colors.primary} />
                    <Text style={[styles.navLabel, { color: Colors.primary }]}>Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('recordings')}>
                    <MaterialIcons name="folder-copy" size={24} color={Colors.slate500} />
                    <Text style={styles.navLabel}>Recordings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('settings')}>
                    <MaterialIcons name="settings" size={24} color={Colors.slate500} />
                    <Text style={styles.navLabel}>Settings</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.navyDark },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    header: { marginBottom: 20 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    logo: { width: 40, height: 40, borderRadius: 20 },
    brandText: { fontSize: 20, fontWeight: '700', color: Colors.white },
    title: { fontSize: 32, fontWeight: '800', color: Colors.white, lineHeight: 38 },
    gradientText: { color: Colors.primary },
    subtitle: { fontSize: 13, color: Colors.slate400, marginTop: 10, lineHeight: 20 },
    recordBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 20,
        shadowColor: Colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    recordBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    statCard: {
        flex: 1,
        backgroundColor: `${Colors.card}66`,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: `${Colors.primary}22`,
    },
    statLabel: { fontSize: 10, fontWeight: '700', color: Colors.slate400, letterSpacing: 1 },
    statValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8, gap: 4 },
    statValue: { fontSize: 28, fontWeight: '800', color: Colors.white },
    statUnit: { fontSize: 14, color: Colors.accentGreen, fontWeight: '600' },
    progressBar: {
        height: 4,
        backgroundColor: Colors.navyDark,
        borderRadius: 2,
        marginTop: 12,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
    statusDot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentGreen },
    statusText: { fontSize: 10, color: Colors.accentGreen, fontWeight: '500' },
    storageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: `${Colors.card}44`,
        padding: 12,
        borderRadius: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: `${Colors.slate700}44`,
    },
    storageText: { fontSize: 12, color: Colors.slate400, fontWeight: '500' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.white, letterSpacing: 1 },
    viewAllText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
    emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 16, color: Colors.slate400, fontWeight: '600' },
    emptySubtext: { fontSize: 12, color: Colors.slate500, textAlign: 'center' },
    logItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${Colors.navyLight}99`,
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: `${Colors.slate700}44`,
    },
    logIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: Colors.navyDark,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: `${Colors.slate700}66`,
    },
    logInfo: { flex: 1 },
    logFilename: { fontSize: 13, fontWeight: '700', color: Colors.slate200 },
    logMeta: { fontSize: 10, color: Colors.slate500, marginTop: 3 },
    logRight: { alignItems: 'flex-end' },
    logSize: { fontSize: 11, fontWeight: '700', color: Colors.primary },
    logLocal: { fontSize: 10, color: Colors.accentGreen },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: `${Colors.navyLight}66`,
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: `${Colors.slate700}44`,
    },
    infoTitle: { fontSize: 13, fontWeight: '700', color: Colors.white, marginBottom: 4 },
    infoText: { fontSize: 11, color: Colors.slate400, lineHeight: 18 },
    nav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: `${Colors.navyDark}F2`,
        borderTopWidth: 1,
        borderTopColor: `${Colors.slate700}44`,
        paddingHorizontal: 20,
        paddingVertical: 10,
        paddingBottom: 28,
    },
    navItem: { flex: 1, alignItems: 'center', gap: 4 },
    navLabel: { fontSize: 10, fontWeight: '500', color: Colors.slate500 },
});

export default Dashboard;
