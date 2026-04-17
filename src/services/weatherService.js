/**
 * Weather Integration Service
 *
 * Fetches marine weather data including:
 * - Wind speed and direction
 * - Wave height and period
 * - Water temperature
 * - Tide information
 * - Weather alerts
 */

import * as Location from 'expo-location';

// OpenWeatherMap API (free tier) - you'll need to get your own API key
const OPENWEATHER_API_KEY = 'YOUR_OPENWEATHER_API_KEY'; // Replace with actual key
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Marine weather APIs (free alternatives)
const MARINE_APIS = {
  // World Tide API (free tier available)
  tides: 'https://www.worldtide.info/api/v2',
  // Storm Glass (free tier)
  waves: 'https://api.stormglass.io/v2',
};

/**
 * Get current weather conditions for marine activities
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<Object>} Weather data
 */
export async function getMarineWeather(latitude, longitude) {
  try {
    const [weatherData, marineData] = await Promise.allSettled([
      getWeatherData(latitude, longitude),
      getMarineConditions(latitude, longitude),
    ]);

    return {
      weather: weatherData.status === 'fulfilled' ? weatherData.value : null,
      marine: marineData.status === 'fulfilled' ? marineData.value : null,
      timestamp: Date.now(),
      location: { latitude, longitude },
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return {
      weather: null,
      marine: null,
      timestamp: Date.now(),
      location: { latitude, longitude },
      error: error.message,
    };
  }
}

/**
 * Get basic weather data from OpenWeatherMap
 */
async function getWeatherData(latitude, longitude) {
  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === 'YOUR_OPENWEATHER_API_KEY') {
    // Return mock data if no API key
    return getMockWeatherData();
  }

  const url = `${OPENWEATHER_BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    temperature: data.main.temp,
    humidity: data.main.humidity,
    pressure: data.main.pressure,
    visibility: data.visibility,
    windSpeed: data.wind.speed,
    windDirection: data.wind.deg,
    weather: data.weather[0].main,
    description: data.weather[0].description,
    cloudCover: data.clouds.all,
    sunrise: data.sys.sunrise * 1000,
    sunset: data.sys.sunset * 1000,
  };
}

/**
 * Get marine-specific conditions (waves, tides, water temp)
 */
async function getMarineConditions(latitude, longitude) {
  // For now, return mock marine data
  // In production, integrate with actual marine APIs
  return getMockMarineData();
}

/**
 * Mock weather data for development
 */
function getMockWeatherData() {
  const conditions = ['Clear', 'Clouds', 'Rain', 'Windy', 'Foggy'];
  const descriptions = ['clear sky', 'few clouds', 'light rain', 'moderate breeze', 'mist'];

  return {
    temperature: 18 + Math.random() * 12, // 18-30°C
    humidity: 60 + Math.random() * 30, // 60-90%
    pressure: 1000 + Math.random() * 50, // 1000-1050 hPa
    visibility: 8000 + Math.random() * 2000, // 8-10km
    windSpeed: Math.random() * 15, // 0-15 m/s
    windDirection: Math.random() * 360, // 0-360°
    weather: conditions[Math.floor(Math.random() * conditions.length)],
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    cloudCover: Math.random() * 100, // 0-100%
    sunrise: Date.now() - 6 * 60 * 60 * 1000, // 6 hours ago
    sunset: Date.now() + 6 * 60 * 60 * 1000, // 6 hours from now
  };
}

/**
 * Mock marine data for development
 */
function getMockMarineData() {
  return {
    waveHeight: 0.5 + Math.random() * 2.5, // 0.5-3m
    wavePeriod: 8 + Math.random() * 8, // 8-16 seconds
    waterTemperature: 15 + Math.random() * 10, // 15-25°C
    tide: {
      height: -1 + Math.random() * 4, // -1 to +3m
      type: Math.random() > 0.5 ? 'high' : 'low',
      nextChange: Date.now() + (2 + Math.random() * 4) * 60 * 60 * 1000, // 2-6 hours
    },
    currentSpeed: Math.random() * 2, // 0-2 knots
    currentDirection: Math.random() * 360,
    visibility: 5 + Math.random() * 15, // 5-20 nautical miles
  };
}

/**
 * Get weather suitability for marine activities
 * @param {Object} weatherData
 * @returns {Object} Suitability assessment
 */
export function assessWeatherSuitability(weatherData) {
  if (!weatherData.weather) {
    return {
      suitable: false,
      score: 0,
      reasons: ['Weather data unavailable'],
      recommendations: ['Check weather conditions manually'],
    };
  }

  const { weather, windSpeed, waveHeight, temperature } = weatherData;
  let score = 100;
  const reasons = [];
  const recommendations = [];

  // Wind assessment
  if (windSpeed > 20) {
    score -= 40;
    reasons.push('Strong winds may affect visibility and wave conditions');
    recommendations.push('Consider postponing if winds exceed 20 knots');
  } else if (windSpeed > 10) {
    score -= 20;
    reasons.push('Moderate winds may create choppy conditions');
  }

  // Wave assessment
  if (waveHeight > 2) {
    score -= 35;
    reasons.push('Large waves may make observations difficult');
    recommendations.push('Use caution with high waves');
  } else if (waveHeight > 1) {
    score -= 15;
    reasons.push('Moderate waves present');
  }

  // Weather conditions
  if (weather === 'Rain' || weather === 'Thunderstorm') {
    score -= 30;
    reasons.push('Precipitation may affect camera and visibility');
    recommendations.push('Protect equipment from rain');
  } else if (weather === 'Fog' || weather === 'Mist') {
    score -= 25;
    reasons.push('Poor visibility conditions');
    recommendations.push('Exercise caution in low visibility');
  }

  // Temperature assessment
  if (temperature < 10) {
    score -= 15;
    reasons.push('Cold temperatures may affect equipment and comfort');
    recommendations.push('Dress appropriately for cold weather');
  }

  const suitable = score >= 60;

  return {
    suitable,
    score: Math.max(0, score),
    reasons,
    recommendations,
    conditions: {
      wind: getWindCondition(windSpeed),
      waves: getWaveCondition(waveHeight),
      weather: getWeatherCondition(weather),
      temperature: getTemperatureCondition(temperature),
    },
  };
}

/**
 * Get wind condition description
 */
function getWindCondition(speed) {
  if (speed < 5) return 'Calm';
  if (speed < 10) return 'Light';
  if (speed < 15) return 'Moderate';
  if (speed < 20) return 'Strong';
  return 'Gale';
}

/**
 * Get wave condition description
 */
function getWaveCondition(height) {
  if (height < 0.5) return 'Calm';
  if (height < 1) return 'Light chop';
  if (height < 2) return 'Moderate';
  if (height < 3) return 'Rough';
  return 'Very rough';
}

/**
 * Get weather condition description
 */
function getWeatherCondition(weather) {
  switch (weather) {
    case 'Clear': return 'Sunny';
    case 'Clouds': return 'Cloudy';
    case 'Rain': return 'Rainy';
    case 'Thunderstorm': return 'Stormy';
    case 'Fog': case 'Mist': return 'Foggy';
    case 'Snow': return 'Snowy';
    default: return weather;
  }
}

/**
 * Get temperature condition description
 */
function getTemperatureCondition(temp) {
  if (temp < 0) return 'Freezing';
  if (temp < 10) return 'Cold';
  if (temp < 20) return 'Cool';
  if (temp < 30) return 'Warm';
  return 'Hot';
}

/**
 * Get marine activity recommendations based on weather
 */
export function getMarineActivityRecommendations(weatherData) {
  const suitability = assessWeatherSuitability(weatherData);

  const recommendations = [];

  if (suitability.suitable) {
    recommendations.push({
      activity: 'Fish observation',
      suitable: true,
      notes: 'Good conditions for marine life observation',
    });

    recommendations.push({
      activity: 'Photography',
      suitable: true,
      notes: 'Clear visibility for underwater photography',
    });

    if (weatherData.marine?.waveHeight < 1.5) {
      recommendations.push({
        activity: 'Snorkeling',
        suitable: true,
        notes: 'Calm waters suitable for snorkeling',
      });
    }
  } else {
    recommendations.push({
      activity: 'Fish observation',
      suitable: false,
      notes: 'Poor weather conditions may affect visibility',
    });

    recommendations.push({
      activity: 'Photography',
      suitable: suitability.score > 40,
      notes: 'Consider weather protection for equipment',
    });
  }

  return recommendations;
}