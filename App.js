import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initTensorFlow } from './src/services/fishIdentifier';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    initTensorFlow().catch(err =>
      console.warn('[App] TF.js init failed:', err.message)
    );
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0a1628" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
