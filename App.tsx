/**
 * VideoEditor_v1 — Main App Entry
 * -------------------------------
 * Renders the lightweight video editor screen directly.
 */

import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EditorScreen from './src/screens/EditorScreen'; // 👈 adjust the path as per your project

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <EditorScreen /> {/* 👈 Renders your video editor */}
    </SafeAreaProvider>
  );
}

export default App;
