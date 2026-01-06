
import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Activity, AlertTriangle, Truck, Map as MapIcon, ChevronDown, Download, Calendar, Filter } from 'lucide-react';
import { generateReport } from '../services/reportService';
import Sidebar from '../components/Sidebar';
import useAppStore from '../store/useAppStore';

const Analytics = () => {
    const [activeTab, setActiveTab] = useState('iri');
    const { iriFiles, potholeFiles, vehicleFiles, pavementFiles } = useAppStore();

    // --- Data Aggregation Logic ---



    // Helper for Quality Assessment
    const getQualityAssessment = (iri_value) => {
        if (iri_value <= 3) {
            return {
                rating: 'Good',
                color: 'text-green-700 bg-green-50 border-green-200',
                badge: 'bg-green-100 text-green-700',
                description: 'Acceptable pavement condition',
                interpretation: 'This pavement provides good ride quality with acceptable smoothness. Vehicle operating costs are within normal range and user comfort is satisfactory.',
                recommendations: 'Condition with routine maintenance activities. Monitor condition annually and apply preventive treatments as needed to maintain current service level.'
            };
        } else if (iri_value <= 5) {
            return {
                rating: 'Fair',
                color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
                badge: 'bg-yellow-100 text-yellow-700',
                description: 'Moderate pavement roughness',
                interpretation: 'This pavement shows moderate roughness that begins to affect ride quality. Some increase in vehicle operating costs and minor user discomfort may be experienced.',
                recommendations: 'Plan for rehabilitation treatments within 3-5 years. Consider surface treatments or minor structural improvements to prevent further deterioration.'
            };
        } else if (iri_value <= 7) {
            return {
                rating: 'Poor',
                color: 'text-orange-700 bg-orange-50 border-orange-200',
                badge: 'bg-orange-100 text-orange-700',
                description: 'Significant pavement deterioration',
                interpretation: 'This pavement has significant roughness that notably impacts ride quality and increases vehicle operating costs. User comfort is compromised and maintenance costs are elevated.',
                recommendations: 'Prioritize major rehabilitation or reconstruction within 2-3 years. Implement interim maintenance to prevent further rapid deterioration and safety issues.'
            };
        } else {
            return {
                rating: 'Bad',
                color: 'text-red-700 bg-red-50 border-red-200',
                badge: 'bg-red-100 text-red-700',
                description: 'Severe pavement distress',
                interpretation: 'This pavement exhibits severe roughness causing substantial user discomfort, high vehicle operating costs, and potential safety concerns. Structural integrity may be compromised.',
                recommendations: 'Immediate major rehabilitation or full reconstruction required. Consider emergency repairs if safety is compromised. Evaluate load restrictions until permanent repairs are completed.'
            };
        }
    };

    // 1. IRI Aggregation
    const iriAnalytics = useMemo(() => {
        if (!iriFiles || iriFiles.length === 0) return null;

        // Only consider visible files
        const visibleFiles = iriFiles.filter(f => f.visible);

        // If no files are visible, show empty state
        if (visibleFiles.length === 0) return null;

        // Use the first visible file for the chart
        const activeFile = visibleFiles[0];

        // Calculate aggregate stats across all visible files
        const totalDistance = visibleFiles.reduce((acc, f) => acc + (f.stats?.totalDistance || 0), 0);
        const avgIri = visibleFiles.reduce((acc, f) => acc + (f.stats?.averageIri || 0), 0) / visibleFiles.length;
        const totalSegments = visibleFiles.reduce((acc, f) => acc + (f.stats?.totalSegments || 0), 0);

        // Count "Poor" segments (IRI > 5)
        let poorSegmentCount = 0;
        visibleFiles.forEach(f => {
            if (f.segments) {
                poorSegmentCount += f.segments.filter(s => s.iri_value > 5).length;
            }
        });

        // Chart Data: Use segments from the active file
        const chartData = activeFile.segments;

        return {
            chartData,
            stats: {
                avgIri: avgIri.toFixed(2),
                totalDistance: (totalDistance / 1000).toFixed(2), // km
                totalSegments,
                poorSegments: poorSegmentCount
            },
            filename: activeFile.filename
        };
    }, [iriFiles]);


    // 2. Pothole Aggregation
    const potholeAnalytics = useMemo(() => {
        if (!potholeFiles || potholeFiles.length === 0) return null;

        const visibleFiles = potholeFiles.filter(f => f.visible);
        if (visibleFiles.length === 0) return null;

        let allPotholes = [];
        visibleFiles.forEach(f => {
            if (f.data) allPotholes = [...allPotholes, ...f.data];
        });

        if (allPotholes.length === 0) return null;

        const totalCount = allPotholes.length;
        const avgConfidence = allPotholes.reduce((acc, p) => acc + p.confidence, 0) / totalCount;

        // Confidence Distribution
        const highConf = allPotholes.filter(p => p.confidence >= 0.8).length;
        const medConf = allPotholes.filter(p => p.confidence >= 0.5 && p.confidence < 0.8).length;
        const lowConf = allPotholes.filter(p => p.confidence < 0.5).length;

        const confidenceDistribution = [
            { name: 'High (≥80%)', value: highConf, color: '#22c55e' },
            { name: 'Medium (50-80%)', value: medConf, color: '#f59e0b' },
            { name: 'Low (<50%)', value: lowConf, color: '#ef4444' }
        ].filter(d => d.value > 0); // Only show non-zero categories

        // Timeline Data (if timestamps exist)
        const timelineMap = {};
        let hasTimestamps = false;

        allPotholes.forEach(p => {
            let dateStr = 'Unknown';
            if (p.timestamp) {
                hasTimestamps = true;
                try {
                    const date = new Date(p.timestamp);
                    dateStr = date.toISOString().split('T')[0];
                } catch (e) { /* Fallback */ }
            }
            timelineMap[dateStr] = (timelineMap[dateStr] || 0) + 1;
        });

        const timelineData = Object.keys(timelineMap).sort().map(date => ({
            date,
            count: timelineMap[date]
        }));

        const validTimelineData = timelineData.filter(d => d.date !== 'Unknown');
        const finalTimelineData = validTimelineData.length > 0 ? validTimelineData : timelineData;

        // Image Gallery: Sort by confidence (highest first), limit for performance
        const galleryImages = [...allPotholes]
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 50) // Limit to top 50 for performance
            .map(p => ({
                url: p.image_url,
                confidence: p.confidence,
                lat: p.lat,
                lon: p.lon,
                imagePath: p.image_path
            }));

        return {
            totalCount,
            avgConfidence: (avgConfidence * 100).toFixed(1),
            timelineData: finalTimelineData,
            hasTimestamps,
            confidenceDistribution,
            galleryImages,
            minConfidence: (Math.min(...allPotholes.map(p => p.confidence)) * 100).toFixed(1),
            maxConfidence: (Math.max(...allPotholes.map(p => p.confidence)) * 100).toFixed(1)
        };
    }, [potholeFiles]);


    // 3. Traffic Aggregation
    const trafficAnalytics = useMemo(() => {
        if (!vehicleFiles || vehicleFiles.length === 0) return null;

        const visibleFiles = vehicleFiles.filter(f => f.visible);
        let allVehicles = [];
        visibleFiles.forEach(f => {
            if (f.data) allVehicles = [...allVehicles, ...f.data];
        });

        // Composition
        const composition = {};
        allVehicles.forEach(v => {
            const type = v.type || 'Unknown';
            composition[type] = (composition[type] || 0) + 1;
        });

        const compositionData = Object.keys(composition).map(type => ({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            value: composition[type],
            color: getTypeColor(type)
        }));

        return {
            totalCount: allVehicles.length,
            compositionData
        };
    }, [vehicleFiles]);


    // 4. Pavement Aggregation
    const pavementAnalytics = useMemo(() => {
        if (!pavementFiles || pavementFiles.length === 0) return null;

        const visibleFiles = pavementFiles.filter(f => f.visible);
        let allSegments = [];
        visibleFiles.forEach(f => {
            if (f.data) allSegments = [...allSegments, ...f.data];
        });

        // Distribution by Type (Distance or Count?)
        // Count is easier. Distance requires calculating length of segments.
        // Let's do Count for now, usually sufficient for POC.
        const typeCount = {};
        allSegments.forEach(s => {
            const type = s.type || 'Unknown';
            typeCount[type] = (typeCount[type] || 0) + 1;
        });

        const pavementData = Object.keys(typeCount).map(type => ({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            value: typeCount[type],
            color: getPavementColor(type)
        }));

        // Fix color mapping
        const processedPavementData = pavementData.map(d => ({
            ...d,
            color: getPavementColor(d.name.toLowerCase())
        }));

        return {
            totalSegments: allSegments.length,
            pavementData: processedPavementData
        };
    }, [pavementFiles]);


    const tabs = [
        { id: 'iri', label: 'IRI Analysis', icon: Activity },
        { id: 'pothole', label: 'Pothole Detection', icon: AlertTriangle },
        { id: 'traffic', label: 'Traffic Volume', icon: Truck },
        { id: 'pavement', label: 'Road Type', icon: MapIcon },
    ];

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
            {/* Reuse Sidebar for consistency if Dashboard uses it */}
            <Sidebar />

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                            <p className="text-gray-500 mt-1">Comprehensive analysis of road quality and traffic data</p>
                        </div>
                        <div className="flex gap-2">
                            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                                <Calendar className="w-4 h-4" />
                                All Time
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    if (!iriFiles || iriFiles.length === 0) {
                                        alert("No data available to export.");
                                        return;
                                    }

                                    // 1. Prepare Data for Report
                                    const visibleFiles = iriFiles.filter(f => f.visible);

                                    // Calculate summaries
                                    const totalDistance = visibleFiles.reduce((acc, f) => acc + (f.stats?.totalDistance || 0), 0);
                                    const avgIri = visibleFiles.length > 0
                                        ? visibleFiles.reduce((acc, f) => acc + (f.stats?.averageIri || 0), 0) / visibleFiles.length
                                        : 0;

                                    // Count critical segments
                                    let criticalSegments = 0;
                                    visibleFiles.forEach(f => {
                                        if (f.segments) criticalSegments += f.segments.filter(s => s.iri_value > 7).length;
                                    });

                                    // Prepare potholes list
                                    let allPotholes = [];
                                    if (potholeFiles) {
                                        potholeFiles.filter(f => f.visible).forEach(f => {
                                            if (f.data) allPotholes.push(...f.data);
                                        });
                                    }

                                    const reportData = {
                                        summary: {
                                            totalDistance,
                                            avgIri,
                                            totalPotholes: allPotholes.length,
                                            criticalSegments
                                        },
                                        files: visibleFiles.map(f => ({
                                            filename: f.filename,
                                            stats: {
                                                averageIri: f.stats.averageIri,
                                                quality: getQualityAssessment(f.stats.averageIri)
                                            },
                                            segments: f.segments
                                        })),
                                        potholes: allPotholes,
                                        traffic: trafficAnalytics || { totalCount: 0, compositionData: [] },
                                        pavement: pavementAnalytics || { totalSegments: 0, pavementData: [] }
                                    };

                                    // 2. Generate PDF
                                    generateReport(reportData);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-md active:scale-95 transition-all"
                            >
                                <Download className="w-4 h-4" />
                                Export Report
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                        <div className="flex gap-4 overflow-x-auto">
                            {tabs.map((tab) => {
                                const Icon = activeTab === tab.id ? tab.icon : tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-700' : 'text-gray-500'}`} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="space-y-6">

                        {/* IRI Section */}
                        {activeTab === 'iri' && (
                            <div className="space-y-6">
                                {iriAnalytics ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <KpiCard title="Average IRI" value={iriAnalytics.stats.avgIri} unit="m/km" trend="-" status="warning" />
                                            <KpiCard title="Total Distance" value={iriAnalytics.stats.totalDistance} unit="km" trend="-" status="success" />
                                            <KpiCard title="Total Segments" value={iriAnalytics.stats.totalSegments} unit="" trend="-" status="success" />
                                            <KpiCard title="Poor Segments" value={iriAnalytics.stats.poorSegments} unit="" trend="-" status="danger" />
                                        </div>

                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                            <h3 className="text-lg font-bold text-gray-900 mb-6">
                                                IRI Profile: {iriAnalytics.filename}
                                            </h3>
                                            <div className="h-80">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={iriAnalytics.chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="distance_end" label={{ value: 'Distance (m)', position: 'insideBottomRight', offset: -10 }} />
                                                        <YAxis label={{ value: 'IRI (m/km)', angle: -90, position: 'insideLeft' }} />
                                                        <Tooltip />
                                                        <Legend />
                                                        <Line type="monotone" dataKey="iri_value" stroke="#2563eb" strokeWidth={2} name="IRI Value" dot={false} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Quality Assessment Section */}
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-bold text-gray-900">Quality Assessment</h3>
                                            <div className="grid grid-cols-1 gap-4">
                                                {iriFiles.filter(f => f.visible).map(file => {
                                                    const assessment = getQualityAssessment(file.stats.averageIri);
                                                    return (
                                                        <div key={file.id} className={`p-6 rounded-xl border ${assessment.color} transition-all`}>
                                                            <div className="flex items-start justify-between mb-4">
                                                                <div>
                                                                    <h4 className="text-lg font-bold flex items-center gap-3">
                                                                        {file.filename}
                                                                        <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${assessment.badge}`}>
                                                                            {assessment.rating}
                                                                        </span>
                                                                    </h4>
                                                                    <p className="opacity-90 mt-1 font-medium">{assessment.description}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-3xl font-bold">{file.stats.averageIri.toFixed(2)}</div>
                                                                    <div className="text-xs opacity-75 uppercase font-bold tracking-wider">Average IRI</div>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-black/5">
                                                                <div>
                                                                    <h5 className="text-sm font-bold uppercase tracking-wider mb-2 opacity-75">Interpretation</h5>
                                                                    <p className="text-sm leading-relaxed opacity-90">{assessment.interpretation}</p>
                                                                </div>
                                                                <div>
                                                                    <h5 className="text-sm font-bold uppercase tracking-wider mb-2 opacity-75">Recommendations</h5>
                                                                    <p className="text-sm leading-relaxed opacity-90">{assessment.recommendations}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <EmptyState message="No IRI data available. Please upload files in the sidebar." />
                                )}
                            </div>
                        )}

                        {/* Pothole Section */}
                        {activeTab === 'pothole' && (
                            <div className="space-y-6">
                                {potholeAnalytics ? (
                                    <>
                                        {/* KPI Row */}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <KpiCard title="Total Potholes" value={potholeAnalytics.totalCount} trend="" status="danger" />
                                            <KpiCard title="Avg Confidence" value={`${potholeAnalytics.avgConfidence}% `} trend="" status="success" />
                                            <KpiCard title="Min Confidence" value={`${potholeAnalytics.minConfidence}% `} trend="" status="warning" />
                                            <KpiCard title="Max Confidence" value={`${potholeAnalytics.maxConfidence}% `} trend="" status="success" />
                                        </div>

                                        {/* Charts Row */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Confidence Distribution */}
                                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                                <h3 className="text-lg font-bold text-gray-900 mb-6">Confidence Distribution</h3>
                                                <div className="h-72">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={potholeAnalytics.confidenceDistribution}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={50}
                                                                outerRadius={90}
                                                                paddingAngle={3}
                                                                dataKey="value"
                                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}% `}
                                                                labelLine={false}
                                                            >
                                                                {potholeAnalytics.confidenceDistribution.map((entry, index) => (
                                                                    <Cell key={`cell - ${index} `} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip formatter={(value) => `${value} detections`} />
                                                            <Legend verticalAlign="bottom" height={36} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Timeline or Fallback */}
                                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                                <h3 className="text-lg font-bold text-gray-900 mb-6">Detection Timeline</h3>
                                                {potholeAnalytics.hasTimestamps && potholeAnalytics.timelineData[0]?.date !== 'Unknown' ? (
                                                    <div className="h-72">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <AreaChart data={potholeAnalytics.timelineData}>
                                                                <defs>
                                                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                                    </linearGradient>
                                                                </defs>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                                                <YAxis />
                                                                <Tooltip />
                                                                <Area type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" name="Potholes" />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                ) : (
                                                    <div className="h-72 flex flex-col items-center justify-center text-gray-400">
                                                        <Calendar className="w-12 h-12 mb-4 opacity-50" />
                                                        <p className="text-sm italic">No timestamp data in CSVs</p>
                                                        <p className="text-xs mt-2">Add a 'timestamp' column to enable timeline</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Image Gallery */}
                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-lg font-bold text-gray-900">Pothole Image Gallery</h3>
                                                <span className="text-sm text-gray-500">
                                                    Showing top {potholeAnalytics.galleryImages.length} by confidence
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                                {potholeAnalytics.galleryImages.map((img, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="relative group rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer aspect-square"
                                                        onClick={() => window.open(img.url, '_blank')}
                                                    >
                                                        <img
                                                            src={img.url}
                                                            alt={`Pothole ${idx + 1} `}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                // Hide the entire card when image fails to load
                                                                e.target.closest('.aspect-square').style.display = 'none';
                                                            }}
                                                        />
                                                        {/* Confidence Badge */}
                                                        <div className={`absolute top - 2 right - 2 px - 2 py - 1 rounded - full text - xs font - bold text - white shadow ${img.confidence >= 0.8 ? 'bg-green-500' :
                                                            img.confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                                                            } `}>
                                                            {(img.confidence * 100).toFixed(0)}%
                                                        </div>
                                                        {/* Hover Overlay */}
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <span className="text-white text-xs font-medium">Click to enlarge</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {potholeAnalytics.galleryImages.length === 0 && (
                                                <div className="text-center py-12 text-gray-400">
                                                    No images available
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <EmptyState message="No Pothole data available. Please upload files in the sidebar." />
                                )}
                            </div>
                        )}

                        {/* Traffic Section */}
                        {activeTab === 'traffic' && (
                            <div className="space-y-6">
                                {trafficAnalytics ? (
                                    <>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                                <h3 className="text-lg font-bold text-gray-900 mb-6">Vehicle Composition</h3>
                                                <div className="h-80">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={trafficAnalytics.compositionData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={60}
                                                                outerRadius={100}
                                                                fill="#8884d8"
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                                label
                                                            >
                                                                {trafficAnalytics.compositionData.map((entry, index) => (
                                                                    <Cell key={`cell - ${index} `} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip />
                                                            <Legend verticalAlign="bottom" height={36} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                                <h3 className="text-lg font-bold text-gray-900 mb-6">Traffic Summary</h3>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                                                        <span className="font-medium text-blue-900">Total Vehicles Counted</span>
                                                        <span className="text-2xl font-bold text-blue-700">{trafficAnalytics.totalCount}</span>
                                                    </div>
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <h4 className="font-medium text-gray-700 mb-2">Breakdown</h4>
                                                        <ul className="space-y-2">
                                                            {trafficAnalytics.compositionData.map(d => (
                                                                <li key={d.name} className="flex justify-between text-sm">
                                                                    <span className="flex items-center">
                                                                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: d.color }}></span>
                                                                        {d.name}
                                                                    </span>
                                                                    <span className="font-medium">{d.value}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <EmptyState message="No Traffic data available. Please upload files in the sidebar." />
                                )}
                            </div>
                        )}

                        {/* Pavement Section */}
                        {activeTab === 'pavement' && (
                            <div className="space-y-6">
                                {pavementAnalytics ? (
                                    <>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                                <h3 className="text-lg font-bold text-gray-900 mb-6">Road Surface Types</h3>
                                                <div className="h-80">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={pavementAnalytics.pavementData} layout="vertical">
                                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                            <XAxis type="number" />
                                                            <YAxis dataKey="name" type="category" width={100} />
                                                            <Tooltip />
                                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                                                {pavementAnalytics.pavementData.map((entry, index) => (
                                                                    <Cell key={`cell - ${index} `} fill={entry.color} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <EmptyState message="No Pavement data available. Please upload files in the sidebar." />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const KpiCard = ({ title, value, unit, trend, status }) => {
    const colorClass = status === 'success' ? 'text-green-600' : status === 'warning' ? 'text-yellow-600' : 'text-red-600';

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h4 className="text-sm font-medium text-gray-500">{title}</h4>
            <div className="mt-2 flex items-baseline">
                <span className="text-3xl font-bold text-gray-900">{value}</span>
                {unit && <span className="ml-1 text-sm text-gray-500">{unit}</span>}
            </div>
            {trend && trend !== '-' && (
                <div className={`mt - 2 text - sm font - medium ${colorClass} `}>
                    {trend} <span className="text-gray-400 font-normal">vs last month</span>
                </div>
            )}
        </div>
    );
};

const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-200 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Found</h3>
        <p className="text-gray-500 max-w-sm">{message}</p>
    </div>
);

// Helper functions
const getTypeColor = (type) => {
    const colors = {
        'car': '#3b82f6',
        'truck': '#10b981',
        'bus': '#f59e0b',
        'motorcycle': '#ef4444',
        'bicycle': '#8b5cf6'
    };
    return colors[type.toLowerCase()] || '#9ca3af';
};

const getPavementColor = (type) => {
    const colors = {
        'asphalt': '#374151', // Dark Gray
        'concrete': '#9ca3af', // Light Gray
        'gravel': '#d97706', // Amber
        'soil': '#8B4513', // SaddleBrown
        'flexible': '#3b82f6', // Mapping to generic type if needed
        'rigid': '#9ca3af'
    };
    return colors[type.toLowerCase()] || '#9ca3af';
};

// Mock s variable was used in prev code, fixed now.

export default Analytics;
