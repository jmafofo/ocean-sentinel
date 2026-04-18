import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Image, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, Camera, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { initTensorFlow, loadModel, identifyFish } from '../services/fishIdentifier';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const VIEWFINDER_SIZE = SCREEN_W * 0.75;

export default function CameraScreen({ navigation }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [torch, setTorch] = useState(false);
  const [capturedUri, setCapturedUri] = useState(null);
  const [identifying, setIdentifying] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Pause camera when navigating away to free resources
  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
      return () => setIsActive(false);
    }, [])
  );

  // Pre-warm TF.js and model on mount
  useEffect(() => {
    (async () => {
      setModelLoading(true);
      try {
        await initTensorFlow();
        await loadModel();
        setModelReady(true);
      } catch (err) {
        console.warn('[Camera] Model pre-load failed:', err.message);
        // Will retry when user taps Scan
      } finally {
        setModelLoading(false);
      }
    })();
  }, []);

  // ── Permission handling ──────────────────────────────────────────
  if (!permission) {
    return <LoadingView message="Checking camera permissions…" />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionView}>
        <Ionicons name="camera-outline" size={64} color="#00d4aa" style={{ marginBottom: 20 }} />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permText}>
          Ocean Sentinel needs camera access to photograph and identify fish species.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Capture photo ────────────────────────────────────────────────
  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android',
      });
      setCapturedUri(photo.uri);
    } catch (err) {
      Alert.alert('Capture Failed', err.message);
    }
  };

  // ── Pick from gallery ────────────────────────────────────────────
  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setCapturedUri(result.assets[0].uri);
    }
  };

  // ── Run identification ───────────────────────────────────────────
  const runIdentification = async () => {
    if (!capturedUri) return;
    setIdentifying(true);
    try {
      if (!modelReady) {
        setModelLoading(true);
        await initTensorFlow();
        await loadModel();
        setModelReady(true);
        setModelLoading(false);
      }
      const results = await identifyFish(capturedUri);
      navigation.navigate('Identification', { results, imageUri: capturedUri });
      setCapturedUri(null);
    } catch (err) {
      Alert.alert(
        'Identification Failed',
        err.message.includes('model') || err.message.includes('network')
          ? 'Could not load the AI model. Please connect to the internet for the initial model download (~14MB).'
          : `Unexpected error: ${err.message}`
      );
    } finally {
      setIdentifying(false);
    }
  };

  const retake = () => setCapturedUri(null);

  // ── Preview captured image ───────────────────────────────────────
  if (capturedUri) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="cover" />

        {/* Overlay */}
        <View style={styles.previewOverlay}>
          {identifying ? (
            <View style={styles.identifyingBanner}>
              <ActivityIndicator color="#00d4aa" size="small" />
              <Text style={styles.identifyingText}>Analyzing fish…</Text>
            </View>
          ) : (
            <>
              <Text style={styles.previewHint}>Ready to identify?</Text>
              <View style={styles.previewActions}>
                <TouchableOpacity style={styles.retakeBtn} onPress={retake}>
                  <Ionicons name="refresh" size={20} color="#e8f4fd" />
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.identifyBtn} onPress={runIdentification}>
                  <Ionicons name="search" size={20} color="#0a1628" />
                  <Text style={styles.identifyBtnText}>Identify Fish</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── Camera view ──────────────────────────────────────────────────
  return (
    <View style={styles.cameraContainer}>
      {isActive && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={torch}
        />
      )}

      {/* Dark gradient top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={() => setTorch(t => !t)} style={styles.iconBtn}>
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color={torch ? '#ffb74d' : '#fff'} />
        </TouchableOpacity>
        <Text style={styles.cameraTitle}>Fish Scanner</Text>
        <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={styles.iconBtn}>
          <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Viewfinder frame */}
      <View style={styles.viewfinderWrapper}>
        <View style={styles.viewfinder}>
          <Corner position="topLeft" />
          <Corner position="topRight" />
          <Corner position="bottomLeft" />
          <Corner position="bottomRight" />
        </View>
        <Text style={styles.viewfinderHint}>Centre the fish in the frame</Text>
        <View style={styles.fieldTip}>
          <Ionicons name="information-circle-outline" size={13} color="#8ab4d4" />
          <Text style={styles.fieldTipText}>Lay flat · rinse sand/mud · shoot from above</Text>
        </View>
      </View>

      {/* Model loading badge */}
      {modelLoading && (
        <View style={styles.modelBadge}>
          <ActivityIndicator size="small" color="#00d4aa" />
          <Text style={styles.modelBadgeText}>Loading AI model…</Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
          <Ionicons name="images-outline" size={26} color="#fff" />
          <Text style={styles.galleryLabel}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shutterBtn} onPress={capturePhoto}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <View style={{ width: 64 }} />
      </View>
    </View>
  );
}

function Corner({ position }) {
  const posStyle = {
    topLeft:     { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
    topRight:    { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
    bottomLeft:  { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
    bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  }[position];
  return <View style={[styles.corner, posStyle]} />;
}

function LoadingView({ message }) {
  return (
    <View style={styles.loadingView}>
      <ActivityIndicator color="#00d4aa" size="large" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: '#000' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  viewfinderWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#00d4aa',
    borderRadius: 2,
  },
  viewfinderHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 16,
  },
  fieldTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fieldTipText: {
    color: '#8ab4d4',
    fontSize: 11,
  },

  modelBadge: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  modelBadgeText: { color: '#00d4aa', fontSize: 13 },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  galleryBtn: { width: 64, alignItems: 'center' },
  galleryLabel: { color: '#fff', fontSize: 11, marginTop: 4 },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },

  // Preview
  previewContainer: { flex: 1, backgroundColor: '#000' },
  previewImage: { ...StyleSheet.absoluteFillObject },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingTop: 20,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(10,22,40,0.85)',
    alignItems: 'center',
  },
  previewHint: { color: '#8ab4d4', fontSize: 14, marginBottom: 16 },
  previewActions: { flexDirection: 'row', gap: 14, width: '100%' },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#142954',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  retakeBtnText: { color: '#e8f4fd', fontSize: 15, fontWeight: '600' },
  identifyBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00d4aa',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  identifyBtnText: { color: '#0a1628', fontSize: 15, fontWeight: '800' },
  identifyingBanner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identifyingText: { color: '#00d4aa', fontSize: 16, fontWeight: '600' },

  // Permissions
  permissionView: {
    flex: 1,
    backgroundColor: '#0a1628',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permTitle: { color: '#e8f4fd', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  permText: { color: '#8ab4d4', fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 12 },
  permBtn: {
    backgroundColor: '#00d4aa',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 28,
  },
  permBtnText: { color: '#0a1628', fontSize: 16, fontWeight: '700' },

  // Loading
  loadingView: { flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8ab4d4', fontSize: 14, marginTop: 14 },
});
