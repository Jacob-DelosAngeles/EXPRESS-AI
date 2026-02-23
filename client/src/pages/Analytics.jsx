
import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Activity, AlertTriangle, Truck, Map as MapIcon, ChevronDown, Download, Calendar, Filter, Construction, Zap, Bell, Thermometer, Layers, Equal } from 'lucide-react';
import { generateReport } from '../services/reportService';
import Sidebar from '../components/Sidebar';
import useAppStore from '../store/useAppStore';
import { useAuth } from '../context/AuthContext';
import DiagnosisCard from '../components/DiagnosisCard';
import { isPointInPolygon } from '../utils/geo';

// Helper for Pothole Diagnosis Logic (Mirrors Backend)
const getPotholeDiagnosis = (count, density) => {
    const cause = "Trapped moisture and fatigue due to traffic";
    const preRehabChecklist = [
        "Check for possible flooding",
        "Identify traffic characteristics",
        "Evaluate concentration every 100m"
    ];

    // Using Count > 30 as threshold based on current dataset calibration
    // In future, this should strictly use density %
    if (count > 30) {
        return {
            status: 'CRITICAL',
            color: 'red',
            action: 'Major Rehabilitation',
            method: 'Mill pavement surface to remove all potholes, then reconstruct surface.',
            insight: `Concentration exceeds 30%. Structural failure likely.`,
            cause: cause,
            pre_rehab_assessment: preRehabChecklist
        };
    } else if (count > 10) {
        return {
            status: 'WARNING',
            color: 'yellow',
            action: 'Conditional Patching',
            method: 'Apply patching. Verify if area is prone to flooding.',
            insight: `Concentration between 10-30%. Drainage check recommended.`,
            cause: cause,
            pre_rehab_assessment: preRehabChecklist
        };
    } else {
        return {
            status: 'GOOD',
            color: 'green',
            action: 'Patching',
            method: 'Apply standard patching.',
            insight: `Low concentration (<10%). Routine maintenance.`,
            cause: cause,
            pre_rehab_assessment: preRehabChecklist
        };
    }
};

// Paginated image gallery — 50 images per page, manages its own page state
const PaginatedGallery = ({ images, title, hoverBorderColor = 'hover:border-blue-400', getUrl, emptyFallback }) => {
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 50;
    const totalPages = Math.max(1, Math.ceil(images.length / PAGE_SIZE));
    const pageImages = images.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                <span className="text-sm text-gray-500">
                    {images.length} total &bull; Page {page} of {totalPages}
                </span>
            </div>

            {images.length === 0 ? (
                emptyFallback !== undefined ? emptyFallback : <div className="text-center py-12 text-gray-400">No images available</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {pageImages.map((img, idx) => {
                            const url = getUrl(img);
                            return (
                                <div
                                    key={(page - 1) * PAGE_SIZE + idx}
                                    className={`relative group rounded-lg overflow-hidden border border-gray-200 ${hoverBorderColor} hover:shadow-lg transition-all cursor-pointer aspect-square`}
                                    onClick={() => window.open(url, '_blank')}
                                >
                                    <img
                                        src={url}
                                        alt={`${title} ${(page - 1) * PAGE_SIZE + idx + 1}`}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(e) => { e.target.closest('.aspect-square').style.display = 'none'; }}
                                    />
                                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-bold text-white shadow brightness-110 ${img.confidence >= 0.8 ? 'bg-green-600' : img.confidence >= 0.5 ? 'bg-amber-500' : 'bg-rose-600'
                                        }`}>
                                        {(img.confidence * 100).toFixed(0)}%
                                    </div>
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-xs font-medium">Click to enlarge</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination Controls — smart paginator with ellipsis */}
                    {totalPages > 1 && (() => {
                        // Build visible page numbers: always show first, last, current ±2, fill gaps with null (ellipsis)
                        const delta = 2;
                        const rangeStart = Math.max(2, page - delta);
                        const rangeEnd = Math.min(totalPages - 1, page + delta);
                        const pages = [1];
                        if (rangeStart > 2) pages.push(null); // left ellipsis
                        for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
                        if (rangeEnd < totalPages - 1) pages.push(null); // right ellipsis
                        if (totalPages > 1) pages.push(totalPages);

                        return (
                            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    ← Prev
                                </button>
                                <div className="flex gap-1">
                                    {pages.map((p, i) =>
                                        p === null ? (
                                            <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                                        ) : (
                                            <button
                                                key={p}
                                                onClick={() => setPage(p)}
                                                className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${p === page ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        )
                                    )}
                                </div>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next →
                                </button>
                            </div>
                        );
                    })()}
                </>
            )}
        </div>
    );
};

const Analytics = () => {
    const [activeTab, setActiveTab] = useState('iri');
    const {
        vehicles, potholes, cracks, pavement,
        iriFiles, potholeFiles, crackFiles, vehicleFiles, pavementFiles,
        activeLayers, roiPolygon
    } = useAppStore();
    const { getToken } = useAuth();

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

        // Apply ROI and Visibility filtering
        const processedFiles = iriFiles.filter(f => f.visible).map(file => {
            if (!roiPolygon || !file.segments) return file;

            const filteredSegments = file.segments.filter(s =>
                isPointInPolygon([s.start_lat, s.start_lon], roiPolygon)
            );

            if (filteredSegments.length === 0) return null;

            // Recalculate stats for the isolated segment
            const distance = filteredSegments.reduce((acc, s) => acc + (s.distance_end - s.distance_start), 0);
            const avgIri = filteredSegments.length > 0
                ? filteredSegments.reduce((acc, s) => acc + s.iri_value, 0) / filteredSegments.length
                : 0;

            return {
                ...file,
                segments: filteredSegments,
                stats: {
                    ...file.stats,
                    totalDistance: distance,
                    averageIri: avgIri,
                    totalSegments: filteredSegments.length
                }
            };
        }).filter(Boolean);

        if (processedFiles.length === 0) return null;

        const activeFile = processedFiles[0];
        const totalDistance = processedFiles.reduce((acc, f) => acc + (f.stats?.totalDistance || 0), 0);
        const avgIri = processedFiles.reduce((acc, f) => acc + (f.stats?.averageIri || 0), 0) / processedFiles.length;
        const totalSegments = processedFiles.reduce((acc, f) => acc + (f.stats?.totalSegments || 0), 0);

        let poorSegmentCount = 0;
        processedFiles.forEach(f => {
            poorSegmentCount += f.segments.filter(s => s.iri_value > 5).length;
        });

        return {
            chartData: activeFile.segments,
            stats: {
                avgIri: avgIri.toFixed(2),
                totalDistance: (totalDistance / 1000).toFixed(2), // km
                totalSegments,
                poorSegments: poorSegmentCount
            },
            filename: activeFile.filename,
            activeFile // Pass file for quality cards
        };
    }, [iriFiles, roiPolygon]);


    // 2. Pothole Aggregation (includes Cracks)
    const potholeAnalytics = useMemo(() => {
        if (!potholeFiles || potholeFiles.length === 0) return null;

        const visiblePotholeFiles = potholeFiles.filter(f => f.visible);
        const visibleCrackFiles = crackFiles.filter(f => f.visible);

        if (visiblePotholeFiles.length === 0 && visibleCrackFiles.length === 0) return null;

        let allPotholes = [];
        [...visiblePotholeFiles, ...visibleCrackFiles].forEach(f => {
            if (f.data) {
                // Apply ROI and Visibility filtering
                const filtered = f.data.filter(p => {
                    if (p.is_hidden) return false;
                    if (roiPolygon && !isPointInPolygon([p.lat, p.lon], roiPolygon)) return false;
                    return true;
                });
                allPotholes = [...allPotholes, ...filtered];
            }
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
        ].filter(d => d.value > 0);

        // Timeline Data
        const timelineMap = {};
        let hasTimestamps = false;

        allPotholes.forEach(p => {
            let dateStr = 'Unknown';
            if (p.timestamp) {
                hasTimestamps = true;
                try {
                    const date = new Date(p.timestamp);
                    dateStr = date.toISOString().split('T')[0];
                } catch (e) { }
            }
            timelineMap[dateStr] = (timelineMap[dateStr] || 0) + 1;
        });

        const timelineData = Object.keys(timelineMap).sort().map(date => ({
            date,
            count: timelineMap[date]
        }));

        // Gallery: pothole-specific images only (no cracks)
        const galleryPotholeOnly = [];
        visiblePotholeFiles.forEach(f => {
            if (f.data) {
                const filtered = f.data.filter(p => {
                    if (p.is_hidden) return false;
                    if (roiPolygon && !isPointInPolygon([p.lat, p.lon], roiPolygon)) return false;
                    return true;
                });
                galleryPotholeOnly.push(...filtered);
            }
        });

        const galleryImages = [...galleryPotholeOnly]
            .sort((a, b) => b.confidence - a.confidence)
            .map(p => ({
                url: p.image_url,
                confidence: p.confidence,
                lat: p.lat,
                lon: p.lon,
                imagePath: p.image_path,
                storage_path: p.storage_path
            }));

        const totalRepairCost = allPotholes.reduce((sum, p) => sum + (p.repair_cost || 0), 0);

        return {
            totalCount,
            avgConfidence: (avgConfidence * 100).toFixed(1),
            timelineData,
            hasTimestamps,
            confidenceDistribution,
            galleryImages,
            minConfidence: (Math.min(...allPotholes.map(p => p.confidence)) * 100).toFixed(1),
            maxConfidence: (Math.max(...allPotholes.map(p => p.confidence)) * 100).toFixed(1),
            totalRepairCost
        };
    }, [potholeFiles, crackFiles, roiPolygon]);


    // 3. Traffic Aggregation
    const trafficAnalytics = useMemo(() => {
        if (!vehicleFiles || vehicleFiles.length === 0) return null;

        const visibleFiles = vehicleFiles.filter(f => f.visible);
        let allVehicles = [];
        visibleFiles.forEach(f => {
            if (f.data) {
                const filtered = roiPolygon
                    ? f.data.filter(v => isPointInPolygon([v.lat, v.lon], roiPolygon))
                    : f.data;
                allVehicles = [...allVehicles, ...filtered];
            }
        });

        if (allVehicles.length === 0) return null;

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
    }, [vehicleFiles, roiPolygon]);


    // 4. Pavement Aggregation
    const pavementAnalytics = useMemo(() => {
        if (!pavementFiles || pavementFiles.length === 0) return null;

        const visibleFiles = pavementFiles.filter(f => f.visible);
        let allSegments = [];
        visibleFiles.forEach(f => {
            if (f.data) {
                // For segments, we check the first point for ROI intersection
                const filtered = roiPolygon
                    ? f.data.filter(s => s.points?.[0] && isPointInPolygon(s.points[0], roiPolygon))
                    : f.data;
                allSegments = [...allSegments, ...filtered];
            }
        });

        if (allSegments.length === 0) return null;

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

        const processedPavementData = pavementData.map(d => ({
            ...d,
            color: getPavementColor(d.name.toLowerCase())
        }));

        return {
            totalSegments: allSegments.length,
            pavementData: processedPavementData
        };
    }, [pavementFiles, roiPolygon]);


    // Helper to truncate long filenames for mobile display
    const truncateFilename = (filename, maxLength = 22) => {
        if (!filename || filename.length <= maxLength) return filename;

        // Find the LAST dot for the actual extension (.csv)
        const lastDotIndex = filename.lastIndexOf('.');
        const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';
        const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;

        // Keep first 12 chars + '...' + last 4 chars + extension
        const prefix = name.substring(0, 12);
        const suffix = name.substring(name.length - 4);

        return `${prefix}...${suffix}${extension}`;
    };

    const tabs = [
        { id: 'iri', label: 'IRI Analysis', icon: Activity },
        { id: 'pothole', label: 'Potholes', icon: AlertTriangle },
        { id: 'cracking', label: 'Cracking', icon: Zap },
        { id: 'patching', label: 'Patching', icon: Layers },
        { id: 'rutting', label: 'Rutting', icon: Equal },
        { id: 'noise', label: 'Noise', icon: Bell },
        { id: 'temperature', label: 'Temperature', icon: Thermometer },
        { id: 'pavement', label: 'Road Type', icon: MapIcon },
        { id: 'traffic', label: 'Traffic Volume', icon: Truck },
        { id: 'rehab', label: 'Road Rehabilitation', icon: Construction },
    ];

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
            {/* Reuse Sidebar for consistency if Dashboard uses it */}
            <Sidebar />

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pl-14 lg:pl-0">
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

                                    // 1. Prepare Data for Report (Respecting ROI and Hidden status)
                                    const reportData = {
                                        summary: {
                                            totalDistance: parseFloat(iriAnalytics?.stats?.totalDistance || 0) * 1000, // convert back to m
                                            avgIri: parseFloat(iriAnalytics?.stats?.avgIri || 0),
                                            totalPotholes: potholeAnalytics?.totalCount || 0,
                                            criticalSegments: iriAnalytics?.stats?.poorSegments || 0
                                        },
                                        files: iriAnalytics ? [
                                            {
                                                filename: iriAnalytics.filename,
                                                stats: {
                                                    averageIri: parseFloat(iriAnalytics.stats.avgIri),
                                                    quality: getQualityAssessment(parseFloat(iriAnalytics.stats.avgIri))
                                                },
                                                segments: iriAnalytics.chartData
                                            }
                                        ] : [],
                                        potholes: potholeAnalytics?.galleryImages?.map(img => ({
                                            lat: img.lat,
                                            lon: img.lon,
                                            confidence: img.confidence,
                                            image_url: img.url,
                                            repair_cost: 0,
                                            storage_path: img.storage_path
                                        })) || [],
                                        traffic: trafficAnalytics || { totalCount: 0, compositionData: [] },
                                        pavement: pavementAnalytics || { totalSegments: 0, pavementData: [] }
                                    };

                                    // 2. Generate PDF
                                    generateReport(reportData, getToken);
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
                                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-w-[160px] ${activeTab === tab.id
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
                                            <h3 className="text-lg font-bold text-gray-900 mb-6" title={iriAnalytics.filename}>
                                                IRI Profile: {truncateFilename(iriAnalytics.filename)}
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
                                                        <div key={file.id} className={`p-4 md:p-6 rounded-xl border ${assessment.color} transition-all`}>
                                                            {/* Mobile: Stack vertically. Desktop: Side by side */}
                                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                                                                {/* Left: Filename, Badge, Description */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <h4 className="text-base md:text-lg font-bold truncate" title={file.filename}>
                                                                            {truncateFilename(file.filename, 18)}
                                                                        </h4>
                                                                        <span className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap flex-shrink-0 ${assessment.badge}`}>
                                                                            {assessment.rating}
                                                                        </span>
                                                                    </div>
                                                                    <p className="opacity-90 text-sm font-medium">{assessment.description}</p>
                                                                </div>
                                                                {/* Right: IRI Value */}
                                                                <div className="text-left md:text-right flex-shrink-0">
                                                                    <div className="text-2xl md:text-3xl font-bold">{file.stats.averageIri.toFixed(2)}</div>
                                                                    <div className="text-[10px] md:text-xs opacity-75 uppercase font-bold tracking-wider">Average IRI</div>
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

                                        {/* Pothole Image Gallery */}
                                        <PaginatedGallery
                                            images={potholeAnalytics.galleryImages}
                                            title="Pothole Image Gallery"
                                            hoverBorderColor="hover:border-blue-400"
                                            getUrl={(img) => img.url}
                                        />

                                    </>
                                ) : (
                                    <EmptyState message="No Pothole data available. Please upload files in the sidebar." />
                                )}
                            </div>
                        )}

                        {/* Cracking Section */}
                        {activeTab === 'cracking' && (() => {
                            const visibleCrackFiles = crackFiles.filter(f => f.visible);
                            let allCracks = [];
                            visibleCrackFiles.forEach(f => {
                                if (f.data) {
                                    const filtered = f.data.filter(c => {
                                        if (c.is_hidden) return false;
                                        if (roiPolygon && !isPointInPolygon([c.lat, c.lon], roiPolygon)) return false;
                                        return true;
                                    });
                                    allCracks = [...allCracks, ...filtered];
                                }
                            });
                            const totalCracks = allCracks.length;
                            const totalLength = allCracks.reduce((sum, c) => sum + (parseFloat(c.measurement) || 0), 0);
                            const avgConf = totalCracks > 0
                                ? (allCracks.reduce((s, c) => s + (c.confidence || 0), 0) / totalCracks * 100).toFixed(1)
                                : null;

                            return (
                                <div className="space-y-6">
                                    {totalCracks > 0 ? (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <KpiCard title="Total Cracks" value={totalCracks} unit="detections" trend="" status="danger" />
                                                <KpiCard title="Total Crack Length" value={totalLength.toFixed(2)} unit="m" trend="" status="warning" />
                                                <KpiCard title="Avg Confidence" value={`${avgConf}%`} trend="" status="success" />
                                            </div>
                                            {/* Crack Image Gallery */}
                                            {(() => {
                                                const crackImages = allCracks
                                                    .filter(c => c.image_url)
                                                    .sort((a, b) => b.confidence - a.confidence);
                                                return crackImages.length > 0 ? (
                                                    <PaginatedGallery
                                                        images={crackImages}
                                                        title="Crack Image Gallery"
                                                        hoverBorderColor="hover:border-yellow-400"
                                                        getUrl={(img) => img.image_url}
                                                        emptyFallback={null}
                                                    />
                                                ) : (
                                                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
                                                        <Zap className="w-10 h-10 mx-auto mb-3 text-yellow-400" />
                                                        <h3 className="text-lg font-bold text-gray-800 mb-1">Detailed Cracking Analysis</h3>
                                                        <p className="text-sm text-gray-500">Full crack severity classification, distribution maps, and rehabilitation recommendations are coming in a future update.</p>
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    ) : (
                                        <EmptyState message="No crack detection data available. Upload crack CSV files in the sidebar." />
                                    )}
                                </div>
                            );
                        })()}

                        {/* Patching Section */}
                        {activeTab === 'patching' && (
                            <ComingSoonSection
                                icon={Layers}
                                label="Patching Analysis"
                                color="blue"
                                description="Patch detection and condition scoring will allow you to assess the quality and coverage of existing road repairs. This section is under active development."
                            />
                        )}

                        {/* Rutting Section */}
                        {activeTab === 'rutting' && (
                            <ComingSoonSection
                                icon={Equal}
                                label="Rutting Analysis"
                                color="orange"
                                description="Rutting is a longitudinal surface depression along wheel paths caused by permanent deformation of pavement layers under repeated traffic loading. Rut depth measurement and severity analysis are coming in a future update."
                            />
                        )}

                        {/* Noise Section */}
                        {activeTab === 'noise' && (
                            <ComingSoonSection
                                icon={Bell}
                                label="Road Noise Analysis"
                                color="purple"
                                description="Acoustic road surface analysis will correlate pavement texture with rolling noise levels for environmental assessment. This section is under active development."
                            />
                        )}

                        {/* Temperature Section */}
                        {activeTab === 'temperature' && (
                            <ComingSoonSection
                                icon={Thermometer}
                                label="Temperature Analysis"
                                color="red"
                                description="Thermal pavement monitoring will track surface temperature gradients to predict heat-related distress and optimize rehabilitation timing. This section is under active development."
                            />
                        )}

                        {/* Road Rehabilitation Section */}
                        {activeTab === 'rehab' && (() => {
                            // Crack data for rehab card
                            const visibleCrackFiles = crackFiles.filter(f => f.visible);
                            let allCracks = [];
                            visibleCrackFiles.forEach(f => {
                                if (f.data) {
                                    allCracks = [...allCracks, ...f.data.filter(c => !c.is_hidden)];
                                }
                            });
                            const crackCount = allCracks.length;
                            const crackLength = allCracks.reduce((s, c) => s + (parseFloat(c.measurement) || 0), 0);

                            return (
                                <div className="space-y-6">
                                    {potholeAnalytics ? (
                                        <>
                                            {/* Core rehab KPIs */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <KpiCard title="Pothole Density" value={`${((potholeAnalytics.totalCount / 100) * 10).toFixed(1)}%`} trend="" status="neutral" />
                                                <KpiCard title="Avg IRI" value={iriAnalytics?.stats?.avgIri || 'N/A'} unit="m/km" trend="" status="neutral" />
                                                <KpiCard title="Estimated Cost" value={`₱${potholeAnalytics.totalRepairCost.toLocaleString()}`} trend="" status="neutral" />
                                            </div>

                                            {/* Additional distress indicators */}
                                            <div>
                                                <h3 className="text-base font-semibold text-gray-700 mb-3">Additional Distress Indicators</h3>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                    <KpiCard
                                                        title="Cracking"
                                                        value={crackCount > 0 ? crackLength.toFixed(1) : 'N/A'}
                                                        unit={crackCount > 0 ? 'm total' : ''}
                                                        trend="" status="neutral"
                                                    />
                                                    <KpiCard title="Patching" value="N/A" trend="" status="neutral" />
                                                    <KpiCard title="Rutting" value="N/A" trend="" status="neutral" />
                                                    <KpiCard title="Noise" value="N/A" trend="" status="neutral" />
                                                    <KpiCard title="Temperature" value="N/A" trend="" status="neutral" />
                                                </div>
                                            </div>

                                            <DiagnosisCard
                                                diagnosis={getPotholeDiagnosis(potholeAnalytics.totalCount)}
                                                metrics={{
                                                    density: (potholeAnalytics.totalCount / 100) * 10,
                                                    iri: parseFloat(iriAnalytics?.stats?.avgIri) || 0
                                                }}
                                            />
                                        </>
                                    ) : (
                                        <EmptyState message="No Pothole data available. Please upload detection data to generate rehabilitation recommendations." />
                                    )}
                                </div>
                            );
                        })()}

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
    const colorClass = status === 'neutral' ? 'text-gray-600' :
        status === 'success' ? 'text-green-600' :
            status === 'warning' ? 'text-yellow-600' : 'text-red-600';

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

const colorMap = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-400', badge: 'bg-blue-100 text-blue-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-400', badge: 'bg-orange-100 text-orange-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-400', badge: 'bg-purple-100 text-purple-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-400', badge: 'bg-red-100 text-red-700' },
};

const ComingSoonSection = ({ icon: Icon, label, color = 'blue', description }) => {
    const c = colorMap[color] || colorMap.blue;
    return (
        <div className={`flex flex-col items-center justify-center text-center p-12 rounded-xl border-2 border-dashed ${c.border} ${c.bg} min-h-[320px]`}>
            <Icon className={`w-14 h-14 mb-4 ${c.icon}`} />
            <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 ${c.badge}`}>Coming Soon</span>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{label}</h3>
            <p className="text-sm text-gray-500 max-w-md leading-relaxed">{description}</p>
        </div>
    );
};

export default Analytics;
