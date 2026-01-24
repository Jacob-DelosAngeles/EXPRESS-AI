import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import DiagnosisCard from './DiagnosisCard';
const AnalyticsPanel = () => {
  const { vehicleData, potholeData, potholes, iriData, iriResults, isComputingIRI } = useAppStore();

  // Process IRI data for analytics
  const processIRIData = () => {
    if (!iriResults || !iriResults.segments) {
      return {
        qualityDistribution: [
          { name: 'Excellent', value: 0, color: '#28a745' },
          { name: 'Good', value: 0, color: '#20c997' },
          { name: 'Fair', value: 0, color: '#ffc107' },
          { name: 'Poor', value: 0, color: '#fd7e14' },
          { name: 'Bad', value: 0, color: '#dc3545' }
        ],
        averageIRI: 0,
        totalSegments: 0,
        iriChartData: []
      };
    }

    const segments = iriResults.segments;
    const iriValues = segments.map(s => s.iri_value);
    const averageIRI = iriValues.reduce((sum, val) => sum + val, 0) / iriValues.length;

    // Categorize IRI values
    const qualityCounts = {
      'Excellent': 0, // < 1.5
      'Good': 0,      // 1.5 - 2.5
      'Fair': 0,      // 2.5 - 3.5
      'Poor': 0,      // 3.5 - 4.5
      'Bad': 0        // > 4.5
    };

    iriValues.forEach(value => {
      if (value < 1.5) qualityCounts['Excellent']++;
      else if (value < 2.5) qualityCounts['Good']++;
      else if (value < 3.5) qualityCounts['Fair']++;
      else if (value < 4.5) qualityCounts['Poor']++;
      else qualityCounts['Bad']++;
    });

    const qualityDistribution = [
      { name: 'Excellent', value: qualityCounts['Excellent'], color: '#28a745' },
      { name: 'Good', value: qualityCounts['Good'], color: '#20c997' },
      { name: 'Fair', value: qualityCounts['Fair'], color: '#ffc107' },
      { name: 'Poor', value: qualityCounts['Poor'], color: '#fd7e14' },
      { name: 'Bad', value: qualityCounts['Bad'], color: '#dc3545' }
    ];

    // Create chart data for IRI over distance
    const iriChartData = segments.map((segment, index) => ({
      distance: Math.round(segment.distance_start / 100), // Convert to 100m segments
      iri: segment.iri_value,
      speed: segment.mean_speed
    }));

    return {
      qualityDistribution,
      averageIRI,
      totalSegments: segments.length,
      iriChartData
    };
  };

  const iriAnalytics = processIRIData();

  // Sample data for demonstration (fallback)
  const vehicleTypeData = [
    { name: 'Cars', value: 45, color: '#667eea' },
    { name: 'Trucks', value: 20, color: '#764ba2' },
    { name: 'Motorcycles', value: 25, color: '#f093fb' },
    { name: 'Buses', value: 10, color: '#f5576c' }
  ];

  const potholeSeverityData = [
    { name: 'Low', value: 15, color: '#28a745' },
    { name: 'Medium', value: 25, color: '#ffc107' },
    { name: 'High', value: 35, color: '#fd7e14' },
    { name: 'Critical', value: 25, color: '#dc3545' }
  ];

  const timeSeriesData = [
    { time: '00:00', vehicles: 12, potholes: 2 },
    { time: '04:00', vehicles: 8, potholes: 1 },
    { time: '08:00', vehicles: 45, potholes: 3 },
    { time: '12:00', vehicles: 38, potholes: 2 },
    { time: '16:00', vehicles: 52, potholes: 4 },
    { time: '20:00', vehicles: 28, potholes: 2 }
  ];

  const MetricCard = ({ title, value, unit, icon, color = "primary" }) => (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-2xl font-bold text-${color}-600`}>{value}</span>
      </div>
      <h3 className="font-semibold text-gray-700">{title}</h3>
      {unit && <p className="text-sm text-gray-500">{unit}</p>}
    </div>
  );

  return (
    <div className="p-4 space-y-6">
      {/* Key Metrics */}
      <div>
        <h3 className="section-header">
          📊 Key Metrics
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            title="Total Vehicles"
            value={vehicleData ? vehicleData.length : 0}
            icon="🚗"
            color="blue"
          />
          <MetricCard
            title="Potholes Detected"
            value={potholeData ? potholeData.length : 0}
            icon="🚧"
            color="red"
          />
          <MetricCard
            title="IRI Measurements"
            value={iriAnalytics.totalSegments}
            icon="📏"
            color="green"
          />
          <MetricCard
            title="Avg IRI Score"
            value={iriAnalytics.averageIRI.toFixed(2)}
            unit="m/km"
            icon="📊"
            color="purple"
          />
        </div>
      </div>

      {/* Vehicle Type Distribution */}
      <div>
        <h3 className="section-header">
          🚗 Vehicle Distribution
        </h3>
        <div className="bg-white rounded-lg p-4 shadow-card">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={vehicleTypeData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {vehicleTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pothole Severity Analysis */}
      <div>
        <h3 className="section-header">
          🚧 Pothole Severity
        </h3>
        <div className="bg-white rounded-lg p-4 shadow-card">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={potholeSeverityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#667eea" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* IRI Quality Assessment */}
      <div>
        <h3 className="section-header">
          📏 Road Quality (IRI)
        </h3>
        {isComputingIRI ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-blue-700">Computing IRI values...</p>
          </div>
        ) : iriAnalytics.totalSegments > 0 ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {iriAnalytics.qualityDistribution.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {item.value} segments ({iriAnalytics.totalSegments > 0 ? Math.round((item.value / iriAnalytics.totalSegments) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>

            {/* IRI Chart */}
            {iriAnalytics.iriChartData.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-card">
                <h4 className="font-semibold text-gray-700 mb-3">IRI Over Distance</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={iriAnalytics.iriChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="distance" label={{ value: 'Distance (100m segments)', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'IRI (m/km)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      formatter={(value, name) => [value.toFixed(2), name === 'iri' ? 'IRI' : 'Speed']}
                      labelFormatter={(value) => `Distance: ${value * 100}m`}
                    />
                    <Line type="monotone" dataKey="iri" stroke="#667eea" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-gray-500">No IRI data available. Upload sensor data to compute IRI values.</p>
          </div>
        )}
      </div>

      {/* 🚜 Rehabilitation Strategy (NEW) */}
      <div>
        <h3 className="section-header">
          🚜 Rehabilitation Strategy
        </h3>
        {potholes && potholes.length > 0 ? (
          <DiagnosisCard
            diagnosis={{
              status: (() => {
                // Calculate density from potholes summary if available
                const totalArea = potholes.reduce((sum, p) => sum + (p.area_m2 || 0), 0);
                const density = totalArea > 0 ? Math.min((totalArea / 175) * 100, 100) : 0; // Assume 50m x 3.5m = 175m² road
                if (density > 30) return 'CRITICAL';
                if (density >= 10) return 'WARNING';
                return 'GOOD';
              })(),
              color: (() => {
                const totalArea = potholes.reduce((sum, p) => sum + (p.area_m2 || 0), 0);
                const density = totalArea > 0 ? Math.min((totalArea / 175) * 100, 100) : 0;
                if (density > 30) return 'red';
                if (density >= 10) return 'yellow';
                return 'green';
              })(),
              action: (() => {
                const totalArea = potholes.reduce((sum, p) => sum + (p.area_m2 || 0), 0);
                const density = totalArea > 0 ? Math.min((totalArea / 175) * 100, 100) : 0;
                if (density > 30) return 'Major Rehabilitation';
                if (density >= 10) return 'Conditional Patching';
                return 'Patching';
              })(),
              method: (() => {
                const totalArea = potholes.reduce((sum, p) => sum + (p.area_m2 || 0), 0);
                const density = totalArea > 0 ? Math.min((totalArea / 175) * 100, 100) : 0;
                if (density > 30) return 'Mill pavement surface to remove all potholes, then reconstruct.';
                if (density >= 10) return 'Apply patching. Verify if area is prone to flooding.';
                return 'Apply standard patching.';
              })(),
              insight: (() => {
                const totalCost = potholes.reduce((sum, p) => sum + (p.repair_cost || 0), 0);
                return `Based on ${potholes.length} detected defects with estimated repair cost of ₱${totalCost.toLocaleString()}.`;
              })()
            }}
            metrics={{
              density: (() => {
                const totalArea = potholes.reduce((sum, p) => sum + (p.area_m2 || 0), 0);
                return Math.min((totalArea / 175) * 100, 100);
              })(),
              iri: iriAnalytics.averageIRI
            }}
          />
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-gray-500">No pothole data available. Upload detection data to generate rehabilitation recommendations.</p>
          </div>
        )}
      </div>

      {/* Time Series Analysis */}
      <div>
        <h3 className="section-header">
          ⏰ Activity Over Time
        </h3>
        <div className="bg-white rounded-lg p-4 shadow-card">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="vehicles" fill="#667eea" name="Vehicles" />
              <Bar dataKey="potholes" fill="#f5576c" name="Potholes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Quality Indicators */}
      <div>
        <h3 className="section-header">
          ✅ Data Quality
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <span className="text-sm text-green-700">GPS Accuracy</span>
            <span className="text-sm font-medium text-green-800">98.5%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700">Data Completeness</span>
            <span className="text-sm font-medium text-blue-800">94.2%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <span className="text-sm text-yellow-700">Processing Speed</span>
            <span className="text-sm font-medium text-yellow-800">2.3s avg</span>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-700 mb-3">📤 Export Data</h4>
        <div className="space-y-2">
          <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">
            Export Analytics Report
          </button>
          <button className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm">
            Download Raw Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
