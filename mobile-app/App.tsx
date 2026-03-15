/**
 * Express AI — Main App
 * Expert Platform for Road Evaluation and Smart Surveillance
 */
import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Alert } from 'react-native';
import Dashboard from './src/screens/Dashboard';
import Recorder from './src/screens/Recorder';
import Recordings from './src/screens/Recordings';
import Settings from './src/screens/Settings';
import { AppSettings, DEFAULT_SETTINGS, ViewState } from './src/types';
import { Colors } from './src/theme';
import { clearAllRecordings } from './src/services/storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const handleNavigate = useCallback((v: string) => {
    setView(v as ViewState);
  }, []);

  const handleClearData = useCallback(async () => {
    try {
      await clearAllRecordings();
      setView('dashboard');
    } catch (err) {
      console.error('Clear data error:', err);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        {view === 'dashboard' && (
          <Dashboard onNavigate={handleNavigate} />
        )}
        {view === 'recorder' && (
          <Recorder onBack={() => setView('dashboard')} settings={settings} />
        )}
        {view === 'recordings' && (
          <Recordings onNavigate={handleNavigate} />
        )}
        {view === 'settings' && (
          <Settings
            settings={settings}
            onUpdateSettings={setSettings}
            onNavigate={handleNavigate}
            onClearData={handleClearData}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navyDark,
  },
});
