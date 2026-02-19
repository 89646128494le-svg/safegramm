import 'react-native-get-random-values';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>SafeGram</Text>
      <Text style={styles.subtitle}>E2EE · Создан Lev</Text>
      <Text style={styles.hint}>Мобильное приложение (E2EE модуль в src/lib/e2ee)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#7c6cff',
    marginBottom: 24,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});
