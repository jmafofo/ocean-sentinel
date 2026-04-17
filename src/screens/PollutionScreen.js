import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { analyzePollution, getPollutionSeverityColor } from '../services/pollutionDetector';
import { getMarineWeather, assessWeatherSuitability } from '../services/weatherService';

const THEME = {
  background: '#0a1628',
  surface: '#0f2044',
  card: '#142954',
  accent: '#00d4aa',
  text: '#e8f4fd',
  subtext: '#8ab4d4',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
};

export default function PollutionScreen({ navigation }) {
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [location, setLocation] = useState(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll permissions are required to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
      setResults(null);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permissions are required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
      setResults(null);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      // Get location for weather data
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const locationData = await Location.getCurrentPositionAsync({});
        setLocation(locationData.coords);

        // Get weather data
        const weather = await getMarineWeather(
          locationData.coords.latitude,
          locationData.coords.longitude
        );
        setWeatherData(weather);
      }

      // Analyze pollution
      const pollutionResults = await analyzePollution(image.uri);
      setResults(pollutionResults);

    } catch (error) {
      Alert.alert('Analysis Error', 'Failed to analyze the image. Please try again.');
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return '⚠️';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '❓';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Pollution Monitor</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Image Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Water Sample</Text>
          <Text style={styles.sectionSubtitle}>
            Take a photo of the water surface to analyze for pollution indicators
          </Text>

          {!image ? (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera" size={48} color={THEME.subtext} />
              <Text style={styles.placeholderText}>No image selected</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.button} onPress={takePhoto}>
                  <Ionicons name="camera" size={20} color={THEME.text} />
                  <Text style={styles.buttonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={pickImage}>
                  <Ionicons name="images" size={20} color={THEME.text} />
                  <Text style={styles.buttonText}>From Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image.uri }} style={styles.image} />
              <View style={styles.imageActions}>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => setImage(null)}
                >
                  <Ionicons name="close" size={20} color={THEME.text} />
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Analyze Button */}
        {image && !analyzing && (
          <TouchableOpacity style={styles.analyzeButton} onPress={analyzeImage}>
            <Ionicons name="analytics" size={20} color={THEME.background} />
            <Text style={styles.analyzeButtonText}>Analyze Pollution</Text>
          </TouchableOpacity>
        )}

        {/* Analyzing Indicator */}
        {analyzing && (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color={THEME.accent} />
            <Text style={styles.analyzingText}>Analyzing water quality...</Text>
          </View>
        )}

        {/* Results */}
        {results && (
          <View style={styles.resultsContainer}>
            <View style={styles.overallScore}>
              <Text style={styles.scoreLabel}>Pollution Level</Text>
              <Text style={[styles.scoreValue, { color: getPollutionSeverityColor(results.overallScore >= 0.8 ? 'high' : results.overallScore >= 0.5 ? 'medium' : 'low') }]}>
                {getSeverityIcon(results.overallScore >= 0.8 ? 'high' : results.overallScore >= 0.5 ? 'medium' : 'low')}
                {' '}
                {results.overallScore >= 0.8 ? 'High' : results.overallScore >= 0.5 ? 'Medium' : 'Low'}
              </Text>
              <Text style={styles.scorePercent}>{Math.round(results.overallScore * 100)}%</Text>
            </View>

            {results.pollutants.length > 0 && (
              <View style={styles.pollutantsList}>
                <Text style={styles.pollutantsTitle}>Detected Pollutants</Text>
                {results.pollutants.map((pollutant, index) => (
                  <View key={index} style={styles.pollutantItem}>
                    <View style={styles.pollutantHeader}>
                      <Text style={styles.pollutantIcon}>{pollutant.icon}</Text>
                      <View style={styles.pollutantInfo}>
                        <Text style={styles.pollutantName}>{pollutant.name}</Text>
                        <Text style={styles.pollutantDescription}>{pollutant.description}</Text>
                      </View>
                      <Text style={[styles.pollutantConfidence, { color: getPollutionSeverityColor(pollutant.severity) }]}>
                        {Math.round(pollutant.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {results.recommendations.length > 0 && (
              <View style={styles.recommendationsList}>
                <Text style={styles.recommendationsTitle}>Recommendations</Text>
                {results.recommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationItem}>
                    <View style={[styles.urgencyIndicator, {
                      backgroundColor: rec.urgency === 'high' ? THEME.error :
                                     rec.urgency === 'medium' ? THEME.warning : THEME.success
                    }]} />
                    <View style={styles.recommendationContent}>
                      <Text style={styles.recommendationAction}>{rec.action}</Text>
                      <Text style={styles.recommendationDescription}>{rec.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Weather Info */}
        {weatherData && (
          <View style={styles.weatherContainer}>
            <Text style={styles.weatherTitle}>Current Conditions</Text>
            <View style={styles.weatherGrid}>
              <View style={styles.weatherItem}>
                <Ionicons name="thermometer" size={24} color={THEME.accent} />
                <Text style={styles.weatherValue}>
                  {Math.round(weatherData.weather?.temperature || 20)}°C
                </Text>
                <Text style={styles.weatherLabel}>Water Temp</Text>
              </View>
              <View style={styles.weatherItem}>
                <Ionicons name="water" size={24} color={THEME.accent} />
                <Text style={styles.weatherValue}>
                  {weatherData.marine?.waveHeight?.toFixed(1) || '1.2'}m
                </Text>
                <Text style={styles.weatherLabel}>Wave Height</Text>
              </View>
              <View style={styles.weatherItem}>
                <Ionicons name="speedometer" size={24} color={THEME.accent} />
                <Text style={styles.weatherValue}>
                  {Math.round(weatherData.weather?.windSpeed || 5)} kt
                </Text>
                <Text style={styles.weatherLabel}>Wind Speed</Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.text,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: THEME.subtext,
    marginBottom: 20,
    lineHeight: 20,
  },
  imagePlaceholder: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.card,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
    color: THEME.subtext,
    marginTop: 16,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
  },
  imageContainer: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  imageActions: {
    padding: 16,
    alignItems: 'center',
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  changeButtonText: {
    color: THEME.text,
    fontSize: 14,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.accent,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 30,
    gap: 8,
  },
  analyzeButtonText: {
    color: THEME.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  analyzingText: {
    color: THEME.text,
    fontSize: 16,
    marginTop: 16,
  },
  resultsContainer: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  overallScore: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreLabel: {
    fontSize: 14,
    color: THEME.subtext,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  scorePercent: {
    fontSize: 12,
    color: THEME.subtext,
  },
  pollutantsList: {
    marginBottom: 24,
  },
  pollutantsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 16,
  },
  pollutantItem: {
    backgroundColor: THEME.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  pollutantHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pollutantIcon: {
    fontSize: 24,
  },
  pollutantInfo: {
    flex: 1,
  },
  pollutantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 4,
  },
  pollutantDescription: {
    fontSize: 14,
    color: THEME.subtext,
    lineHeight: 18,
  },
  pollutantConfidence: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  recommendationsList: {
    marginBottom: 24,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 16,
  },
  recommendationItem: {
    flexDirection: 'row',
    backgroundColor: THEME.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  urgencyIndicator: {
    width: 4,
    borderRadius: 2,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationAction: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 14,
    color: THEME.subtext,
    lineHeight: 18,
  },
  weatherContainer: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 20,
  },
  weatherTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 16,
  },
  weatherGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weatherItem: {
    alignItems: 'center',
  },
  weatherValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.accent,
    marginTop: 8,
  },
  weatherLabel: {
    fontSize: 12,
    color: THEME.subtext,
    marginTop: 4,
  },
});