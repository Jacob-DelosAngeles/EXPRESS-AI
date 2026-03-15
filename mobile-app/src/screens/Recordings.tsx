/**
 * Express AI — Recordings Screen
 * Browse, export, and delete saved survey recordings
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { RecordingMeta } from '../types';
import { getRecordings, deleteRecording, shareFile, formatBytes } from '../services/storage';
import { formatTime, formatDate } from '../utils';

interface Props {
    onNavigate: (view: string) => void;
}

const Recordings: React.FC<Props> = ({ onNavigate }) => {
    const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        const recs = await getRecordings();
        setRecordings(recs);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleDelete = (rec: RecordingMeta) => {
        Alert.alert(
            'Delete Recording',
            `Delete "${rec.csvFilename}" and its video?\nThis cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteRecording(rec.id);
                        await loadData();
                    },
                },
            ]
        );
    };

    const handleShareCsv = async (rec: RecordingMeta) => {
        try {
            await shareFile(rec.csvUri);
        } catch (err) {
            Alert.alert('Share Error', String(err));
        }
    };

    const handleShareVideo = async (rec: RecordingMeta) => {
        try {
            await shareFile(rec.videoUri);
        } catch (err) {
            Alert.alert('Share Error', String(err));
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => onNavigate('dashboard')}>
                    <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Recordings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                {recordings.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="folder-open" size={64} color={Colors.slate500} />
                        <Text style={styles.emptyText}>No recordings yet</Text>
                        <Text style={styles.emptySubtext}>Start a new survey to see recordings here</Text>
                    </View>
                ) : (
                    recordings.map(rec => (
                        <View key={rec.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.cardIcon}>
                                    <MaterialIcons name="videocam" size={20} color={Colors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardFilename} numberOfLines={1}>{rec.csvFilename}</Text>
                                    <Text style={styles.cardDate}>{formatDate(rec.startedAt)}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleDelete(rec)}>
                                    <MaterialIcons name="delete-outline" size={22} color={Colors.red500} />
                                </TouchableOpacity>
                            </View>

                            {/* Stats */}
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <MaterialIcons name="timer" size={14} color={Colors.slate400} />
                                    <Text style={styles.statText}>{formatTime(rec.durationSec)}</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <MaterialIcons name="straighten" size={14} color={Colors.slate400} />
                                    <Text style={styles.statText}>{rec.distanceKm.toFixed(2)} km</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <MaterialIcons name="data-usage" size={14} color={Colors.slate400} />
                                    <Text style={styles.statText}>{rec.sampleCount} pts</Text>
                                </View>
                            </View>

                            {/* File sizes */}
                            <View style={styles.filesRow}>
                                <View style={styles.fileInfo}>
                                    <MaterialIcons name="description" size={12} color={Colors.accentGreen} />
                                    <Text style={styles.fileText}>CSV: {formatBytes(rec.csvSizeBytes)}</Text>
                                </View>
                                <View style={styles.fileInfo}>
                                    <MaterialIcons name="movie" size={12} color={Colors.primary} />
                                    <Text style={styles.fileText}>Video: {formatBytes(rec.videoSizeBytes)}</Text>
                                </View>
                            </View>

                            {/* Actions */}
                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleShareCsv(rec)}>
                                    <MaterialIcons name="share" size={16} color={Colors.accentGreen} />
                                    <Text style={[styles.actionText, { color: Colors.accentGreen }]}>Export CSV</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleShareVideo(rec)}>
                                    <MaterialIcons name="share" size={16} color={Colors.primary} />
                                    <Text style={[styles.actionText, { color: Colors.primary }]}>Export Video</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Bottom Nav */}
            <View style={styles.nav}>
                <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('dashboard')}>
                    <MaterialIcons name="dashboard" size={24} color={Colors.slate500} />
                    <Text style={styles.navLabel}>Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => { }}>
                    <MaterialIcons name="folder-copy" size={24} color={Colors.primary} />
                    <Text style={[styles.navLabel, { color: Colors.primary }]}>Recordings</Text>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: `${Colors.slate700}44`,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 100 },
    emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyText: { fontSize: 18, color: Colors.slate400, fontWeight: '600' },
    emptySubtext: { fontSize: 13, color: Colors.slate500 },
    card: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: `${Colors.slate700}44`,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: `${Colors.primary}22`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardFilename: { fontSize: 14, fontWeight: '700', color: Colors.white },
    cardDate: { fontSize: 11, color: Colors.slate400, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 12, color: Colors.slate400, fontWeight: '500' },
    filesRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    fileText: { fontSize: 11, color: Colors.slate400 },
    actions: { flexDirection: 'row', gap: 10 },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: `${Colors.slate700}66`,
        backgroundColor: `${Colors.navyDark}88`,
    },
    actionText: { fontSize: 12, fontWeight: '600' },
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

export default Recordings;
