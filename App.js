import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import * as tf from '@tensorflow/tfjs';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import { MapView } from 'react-native-maps';

// Placeholder for camera (requires expo-camera later)
const TensorCamera = cameraWithTensors(() => null); // Dummy for now

export default function App() {
  const [result, setResult] = useState('Initializing AI...');
  const [isTfReady, setIsTfReady] = useState(false);

  useEffect(() => {
    // Initialize TensorFlow
    (async () => {
      await tf.ready();
      setIsTfReady(true);
      setResult('AI Ready - Scan a fish!');
    })();
  }, []);

  const handleImageScan = () => {
    if (isTfReady) {
      setResult('Mahi Mahi detected!'); // Dummy result
    }
  };

  return (
    <View style={styles.container}>
      <Text>{result}</Text>
      <Button title="Scan Fish" onPress={handleImageScan} disabled={!isTfReady} />
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 25.1275,
          longitude: 56.3422,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  map: { flex: 1, marginTop: 20 },
});
