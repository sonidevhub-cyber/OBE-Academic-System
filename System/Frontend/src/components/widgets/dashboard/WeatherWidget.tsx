import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  location: string;
}

const WeatherWidget: React.FC<{}> = () => {
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 28,
    condition: 'Partly Cloudy',
    humidity: 65,
    windSpeed: 12,
    icon: '⛅',
    location: 'University Campus'
  });

  const [loading, setLoading] = useState(false);

  // Simulate weather API call
  const fetchWeather = async () => {
    setLoading(true);
    try {
      // In a real app, this would be an actual weather API call
      // For demo purposes, we'll simulate some variation
      setTimeout(() => {
        const conditions = [
          { condition: 'Sunny', icon: '☀️', temp: 32 },
          { condition: 'Partly Cloudy', icon: '⛅', temp: 28 },
          { condition: 'Cloudy', icon: '☁️', temp: 26 },
          { condition: 'Light Rain', icon: '🌦️', temp: 24 }
        ];
        const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];

        setWeather({
          temperature: randomCondition.temp,
          condition: randomCondition.condition,
          humidity: Math.floor(Math.random() * 30) + 50, // 50-80%
          windSpeed: Math.floor(Math.random() * 15) + 5, // 5-20 km/h
          icon: randomCondition.icon,
          location: 'University Campus'
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    // Update weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getTemperatureColor = (temp: number) => {
    if (temp >= 30) return 'text-red-500';
    if (temp >= 25) return 'text-orange-500';
    if (temp >= 20) return 'text-yellow-500';
    return 'text-blue-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 right-4 text-6xl">☁️</div>
        <div className="absolute bottom-4 left-4 text-4xl">🌤️</div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Weather</h3>
            <p className="text-blue-100 text-sm">{weather.location}</p>
          </div>
          <button
            onClick={fetchWeather}
            disabled={loading}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            <motion.svg
              animate={loading ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: "linear" }}
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </motion.svg>
          </button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-4xl">{weather.icon}</span>
            <div>
              <div className={`text-3xl font-bold ${getTemperatureColor(weather.temperature)}`}>
                {weather.temperature}°C
              </div>
              <div className="text-blue-100 text-sm">{weather.condition}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <svg className="h-4 w-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <div>
                <div className="text-xs text-blue-200">Humidity</div>
                <div className="text-sm font-semibold">{weather.humidity}%</div>
              </div>
            </div>
          </div>

          <div className="bg-white/20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <svg className="h-4 w-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H13m-4 4h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 15H13m-4-4v4m0-4H9m4 0h1.586a1 1 0 00.707-.293l.707-.707A1 1 0 0015.414 9H17" />
              </svg>
              <div>
                <div className="text-xs text-blue-200">Wind</div>
                <div className="text-sm font-semibold">{weather.windSpeed} km/h</div>
              </div>
            </div>
          </div>
        </div>

        {/* Weather Tips */}
        <div className="mt-4 p-3 bg-white/10 rounded-lg">
          <div className="text-xs text-blue-100 mb-1">Campus Tip</div>
          <div className="text-sm">
            {weather.temperature > 30
              ? "High temperature today - stay hydrated and use sunscreen!"
              : weather.condition.includes('Rain')
              ? "Rain expected - don't forget your umbrella!"
              : "Perfect weather for outdoor activities!"
            }
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WeatherWidget;
