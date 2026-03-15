/**
 * Express AI — Settings Screen
 */
import React from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { AppSettings } from '../types';

interface Props {
    settings: AppSettings;
    onUpdateSettings: (s: AppSettings) => void;
    onNavigate: (view: string) => void;
    onClearData: () => void;
}

const RATE_OPTIONS = [10, 20, 50, 100];
const QUALITY_OPTIONS: Array<'720p' | '1080p' | '4K'> = ['720p', '1080p', '4K'];

const Settings: React.FC<Props> = ({ settings, onUpdateSettings, onNavigate, onClearData }) => {

    const handleClearAll = () => {
        Alert.alert(
            'Clear All Data',
            'This will delete all saved recordings. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear All', style: 'destructive', onPress: onClearData },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => onNavigate('dashboard')}>
                    <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Sampling Rate */}
                <Text style={styles.sectionLabel}>SENSOR SAMPLING RATE</Text>
                <View style={styles.optionGroup}>
                    {RATE_OPTIONS.map(hz => (
                        <TouchableOpacity
                            key={hz}
                            style={[styles.option, settings.samplingRateHz === hz && styles.optionActive]}
                            onPress={() => onUpdateSettings({ ...settings, samplingRateHz: hz })}
                        >
                            <Text style={[styles.optionText, settings.samplingRateHz === hz && styles.optionTextActive]}>
                                {hz} Hz
                            </Text>
                            <Text style={styles.optionDetail}>
                                {hz === 10 ? 'Standard (IRI)' : hz === 20 ? 'High Precision' : hz === 50 ? 'Maximum' : 'Ultra High'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.hint}>
                    Higher rates produce more data points but larger CSV files. 10 Hz is recommended for IRI analysis.
                </Text>

                {/* Video Quality */}
                <Text style={styles.sectionLabel}>VIDEO QUALITY</Text>
                <View style={styles.optionGroup}>
                    {QUALITY_OPTIONS.map(q => (
                        <TouchableOpacity
                            key={q}
                            style={[styles.option, settings.videoQuality === q && styles.optionActive]}
                            onPress={() => onUpdateSettings({ ...settings, videoQuality: q })}
                        >
                            <Text style={[styles.optionText, settings.videoQuality === q && styles.optionTextActive]}>
                                {q}
                            </Text>
                            <Text style={styles.optionDetail}>
                                {q === '720p' ? '~50 MB/min' : q === '1080p' ? '~130 MB/min' : '~375 MB/min'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.hint}>
                    1080p is recommended for road survey analysis. 4K provides the best visual detail but uses significantly more storage.
                </Text>

                {/* Audio Toggle */}
                <Text style={styles.sectionLabel}>AUDIO</Text>
                <View style={styles.toggleRow}>
                    <View>
                        <Text style={styles.toggleLabel}>Record Audio</Text>
                        <Text style={styles.toggleDetail}>Include microphone audio in video</Text>
                    </View>
                    <Switch
                        value={settings.includeAudio}
                        onValueChange={(v) => onUpdateSettings({ ...settings, includeAudio: v })}
                        trackColor={{ false: Colors.slate700, true: `${Colors.primary}88` }}
                        thumbColor={settings.includeAudio ? Colors.primary : Colors.slate400}
                    />
                </View>

                {/* Data Management */}
                <Text style={styles.sectionLabel}>DATA MANAGEMENT</Text>
                <TouchableOpacity style={styles.dangerBtn} onPress={handleClearAll}>
                    <MaterialIcons name="delete-sweep" size={20} color={Colors.red500} />
                    <Text style={styles.dangerText}>Clear All Recordings</Text>
                </TouchableOpacity>

                {/* About */}
                <View style={styles.aboutCard}>
                    <Text style={styles.aboutTitle}>Express AI — Road Survey</Text>
                    <Text style={styles.aboutText}>
                        Expert Platform for Road Evaluation and Smart Surveillance.{'\n'}
                        CSV output is compatible with Physics Toolbox Sensor Suite format.
                    </Text>
                    <Text style={styles.versionText}>v1.0.0 • Built with Expo SDK 54</Text>
                </View>
            </ScrollView>

            {/* Bottom Nav */}
            <View style={styles.nav}>
                <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('dashboard')}>
                    <MaterialIcons name="dashboard" size={24} color={Colors.slate500} />
                    <Text style={styles.navLabel}>Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('recordings')}>
                    <MaterialIcons name="folder-copy" size={24} color={Colors.slate500} />
                    <Text style={styles.navLabel}>Recordings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => { }}>
                    <MaterialIcons name="settings" size={24} color={Colors.primary} />
                    <Text style={[styles.navLabel, { color: Colors.primary }]}>Settings</Text>
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
    scrollContent: { padding: 20, paddingBottom: 100 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.slate400,
        letterSpacing: 1.5,
        marginTop: 20,
        marginBottom: 10,
    },
    optionGroup: { gap: 8 },
    option: {
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1.5,
        borderColor: `${Colors.slate700}44`,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    optionActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}15` },
    optionText: { fontSize: 16, fontWeight: '700', color: Colors.white },
    optionTextActive: { color: Colors.primary },
    optionDetail: { fontSize: 11, color: Colors.slate400 },
    hint: { fontSize: 11, color: Colors.slate500, marginTop: 6, lineHeight: 16, paddingHorizontal: 4 },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: `${Colors.slate700}44`,
    },
    toggleLabel: { fontSize: 14, fontWeight: '600', color: Colors.white },
    toggleDetail: { fontSize: 11, color: Colors.slate400, marginTop: 2 },
    dangerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: `${Colors.red500}15`,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: `${Colors.red500}33`,
    },
    dangerText: { fontSize: 14, fontWeight: '600', color: Colors.red500 },
    aboutCard: {
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 16,
        marginTop: 24,
        borderWidth: 1,
        borderColor: `${Colors.slate700}44`,
        gap: 6,
    },
    aboutTitle: { fontSize: 14, fontWeight: '700', color: Colors.white },
    aboutText: { fontSize: 12, color: Colors.slate400, lineHeight: 18 },
    versionText: { fontSize: 10, color: Colors.slate500, marginTop: 4 },
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

export default Settings;
