/**
 * Weather Integration Service
 *
 * Uses Open-Meteo API (free, no API key required):
 * - General weather: https://api.open-meteo.com/v1/forecast
 * - Marine data:    https://marine-api.open-meteo.com/v1/marine
 */

/**
 * Get current weather and marine conditions for a location.
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
 * Fetch general weather from Open-Meteo.
 */
async function getWeatherData(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  const current = data.current;

  return {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    pressure: current.pressure_msl,
    windSpeed: current.wind_speed_10m,
    windDirection: current.wind_direction_10m,
    weather: weatherCodeToString(current.weather_code),
    description: weatherCodeToDescription(current.weather_code),
    cloudCover: current.cloud_cover,
  };
}

/**
 * Fetch marine conditions from Open-Meteo Marine API.
 */
async function getMarineConditions(latitude, longitude) {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&current=wave_height,sea_surface_temperature&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Marine API error: ${response.status}`);
  }

  const data = await response.json();
  const current = data.current;

  return {
    waveHeight: current.wave_height,
    waterTemperature: current.sea_surface_temperature,
  };
}

/**
 * Convert WMO weather code to a short condition string.
 */
function weatherCodeToString(code) {
  if (code === 0) return 'Clear';
  if (code >= 1 && code <= 3) return 'Clouds';
  if (code >= 45 && code <= 48) return 'Fog';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain';
  if (code >= 85 && code <= 86) return 'Snow';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function weatherCodeToDescription(code) {
  const map = {
    0: 'clear sky',
    1: 'mainly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'fog',
    48: 'depositing rime fog',
    51: 'light drizzle',
    53: 'moderate drizzle',
    55: 'dense drizzle',
    61: 'slight rain',
    63: 'moderate rain',
    65: 'heavy rain',
    71: 'slight snow',
    73: 'moderate snow',
    75: 'heavy snow',
    80: 'slight rain showers',
    81: 'moderate rain showers',
    82: 'violent rain showers',
    95: 'thunderstorm',
    96: 'thunderstorm with slight hail',
    99: 'thunderstorm with heavy hail',
  };
  return map[code] ?? 'unknown';
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

  // Wind assessment (Open-Meteo returns km/h)
  if (windSpeed > 30) {
    score -= 40;
    reasons.push('Strong winds may affect visibility and wave conditions');
    recommendations.push('Consider postponing if winds exceed 30 km/h');
  } else if (windSpeed > 15) {
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

function getWindCondition(speed) {
  if (speed < 5) return 'Calm';
  if (speed < 15) return 'Light';
  if (speed < 25) return 'Moderate';
  if (speed < 35) return 'Strong';
  return 'Gale';
}

function getWaveCondition(height) {
  if (height < 0.5) return 'Calm';
  if (height < 1) return 'Light chop';
  if (height < 2) return 'Moderate';
  if (height < 3) return 'Rough';
  return 'Very rough';
}

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
