import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Image, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { initTensorFlow, loadModel, identifyFish } from '../services/fishIdentifier';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const VIEWFINDER_SIZE = SCREEN_W * 0.75;
const TORCH_COOLDOWN_MS = 600; // ms between torch toggles

export default function CameraScreen({ navigation }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [torch, setTorch] = useState(false);
  const [torchCooldown, setTorchCooldown] = useState(false);
  const [capturedUri, setCapturedUri] = useState(null);
  const [identifying, setIdentifying] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [capturing, setCapturing] = useState(false);

  // Pause camera when navigating away to free resources
  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
      return () => {
        setIsActive(false);
        setTorch(false); // always extinguish torch when leaving screen
      };
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

  // ── Safe camera-facing switch ────────────────────────────────────
  const switchFacing = useCallback(() => {
    setFacing(prev => {
      const next = prev === 'back' ? 'front' : 'back';
      // Front cameras usually have no torch — auto-disable to prevent freeze
      if (next === 'front' && torch) {
        setTorch(false);
      }
      return next;
    });
  }, [torch]);

  // ── Torch toggle with cooldown ───────────────────────────────────
  const toggleTorch = useCallback(() => {
    if (torchCooldown) return;
    if (facing === 'front') {
      Alert.alert('Torch unavailable', 'Torch is only available on the rear camera.');
      return;
    }
    setTorch(prev => !prev);
    setTorchCooldown(true);
    setTimeout(() => setTorchCooldown(false), TORCH_COOLDOWN_MS);
  }, [torchCooldown, facing]);

  // ── Capture photo (torch-safe) ───────────────────────────────────
  const capturePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);

    // Turn torch off momentarily before capture — this prevents the
    // camera HAL from deadlocking on Android when torch + capture collide.
    const hadTorch = torch;
    if (hadTorch) setTorch(false);

    // Longer delay lets the driver settle after torch state change.
    // 150 ms is too short for many Samsung / Xiaomi / Pixel devices.
    if (hadTorch) {
      await new Promise(r => setTimeout(r, Platform.OS === 'android' ? 400 : 200));
    }

    // Defensive: ref may have been nulled while we awaited
    if (!cameraRef.current) {
      setCapturing(false);
      return;
    }

    try {
      const photo = await Promise.race([
        cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: true, // avoids extra native processing that can hang
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Camera capture timed out. Please try again.')), 5000)
        ),
      ]);
      setCapturedUri(photo.uri);
      // Keep torch OFF after capture — re-enable only when retaking
      setTorch(false);
    } catch (err) {
      Alert.alert('Capture Failed', err.message);
      // Restore torch on error so user can retry
      if (hadTorch) setTorch(true);
    } finally {
      setCapturing(false);
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
      const msg = err.message ?? '';
      let userMessage;
      if (msg === 'SESSION_EXPIRED') {
        userMessage = 'Your session has expired. Please sign in again from the Profile tab.';
      } else if (msg.includes('internet') || msg.includes('connection') || msg.includes('network')) {
        userMessage = msg; // already user-friendly from apiFetch
      } else {
        userMessage = `Identification failed: ${msg}`;
      }
      Alert.alert('Identification Failed', userMessage);
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
          key={facing}               // force remount on front/back switch
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={torch}
          flash={torch ? 'off' : 'auto'}  // auto-flash + torch = HAL deadlock
        />
      )}

      {/* Dark gradient top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity
          onPress={toggleTorch}
          style={[styles.iconBtn, facing === 'front' && styles.iconBtnDisabled]}
          activeOpacity={0.7}
        >
          <Ionicons
            name={torch ? 'flash' : 'flash-off'}
            size={22}
            color={facing === 'front' ? '#555' : torch ? '#ffb74d' : '#fff'}
          />
        </TouchableOpacity>
        <Text style={styles.cameraTitle}>Fish Scanner</Text>
        <TouchableOpacity onPress={switchFacing} style={styles.iconBtn} activeOpacity={0.7}>
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

        <TouchableOpacity
          style={[styles.shutterBtn, capturing && styles.shutterBtnDisabled]}
          onPress={capturePhoto}
          disabled={capturing}
          activeOpacity={0.8}
        >
          <View style={[styles.shutterInner, capturing && styles.shutterInnerDisabled]} />
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
  iconBtnDisabled: { opacity: 0.4 },

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
  shutterBtnDisabled: {
    borderColor: '#888',
  },
  shutterInnerDisabled: {
    backgroundColor: '#888',
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
