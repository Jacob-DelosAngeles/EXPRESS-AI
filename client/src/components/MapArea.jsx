import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap, useMapEvents, CircleMarker } from 'react-leaflet';
import { Layers, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { isPointInPolygon } from '../utils/geo';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// --- VISUALIZATION COMPONENTS ---

// 1. Budget Calculator Panel (Floating)
const BudgetPanel = ({ potholes, isSelectingROI, setIsSelectingROI, handleFinishROI, handleClearROI, hasROI, tempPointsCount }) => {
    // Calculate totals
    const totalCost = potholes.reduce((sum, p) => sum + (p.repair_cost || 0), 0);
    const totalArea = potholes.reduce((sum, p) => sum + (p.area_m2 || 0), 0);
    const count = potholes.length;

    // Format currency
    const formatPHP = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

    return (
        <div className="absolute top-4 right-4 z-[1000] lg:top-4 lg:right-4 max-w-[240px]">
            <div className="bg-white/90 backdrop-blur-md border border-white/20 shadow-xl rounded-xl p-3 w-full animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between mb-2 border-b border-gray-100 pb-1">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Project Estimate</h3>
                    <div className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">LIVE</div>
                </div>

                <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-0.5">Total Repair Cost</div>
                    <div className="text-lg font-bold text-gray-900 tracking-tight">
                        {formatPHP(totalCost)}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                        <div className="text-gray-400 mb-0.5">Defects</div>
                        <div className="font-semibold text-gray-700">{count}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                        <div className="text-gray-400 mb-0.5">Area</div>
                        <div className="font-semibold text-gray-700">{totalArea.toFixed(2)} m²</div>
                    </div>
                </div>

                {/* Selection Tools Integration */}
                <div className="pt-2 border-t border-gray-100">
                    {!isSelectingROI && !hasROI ? (
                        <button
                            onClick={() => setIsSelectingROI(true)}
                            className="w-full flex items-center justify-center gap-2 text-[11px] py-1.5 bg-gray-50 text-gray-600 rounded-lg font-bold hover:bg-gray-100 transition-colors border border-gray-200"
                        >
                            🎯 Lasso Analysis Area
                        </button>
                    ) : isSelectingROI ? (
                        <div className="space-y-2">
                            <button
                                onClick={handleFinishROI}
                                className="w-full text-[11px] py-1.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 animate-pulse shadow-sm"
                            >
                                ✅ Finish Selection ({tempPointsCount})
                            </button>
                            <button
                                onClick={handleClearROI}
                                className="w-full text-[11px] py-1.5 bg-white text-gray-400 border border-gray-200 rounded-lg font-semibold hover:bg-gray-50"
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleClearROI}
                            className="w-full text-[11px] py-1.5 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100 transition-colors border border-blue-200"
                        >
                            🔄 Reset Analysis
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// 2. Cost Heatmap Layer (Visual)
const CostHeatmapLayer = ({ potholes }) => {
    // Render distinct markers as "blobs"
    // Green = Low Cost (<1k), Orange = Med (<5k), Red = High (>5k)
    return (
        <>
            {potholes.filter(p => !p.is_hidden).map((p, idx) => {
                const cost = p.repair_cost || 0;
                let color = '#22c55e'; // Green
                let radius = 20;       // Base Size

                if (cost > 5000) {
                    color = '#ef4444'; // Red
                    radius = 40;       // Bigger for expensive
                } else if (cost > 1000) {
                    color = '#f97316'; // Orange
                    radius = 30;
                }

                return (
                    <CircleMarker
                        key={`heat-${idx}`}
                        center={[p.lat, p.lon]}
                        radius={radius}
                        pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.2,
                            stroke: false,
                            className: 'blur-sm'
                        }}
                    />
                )
            })}
        </>
    );
};

// Red marker icon for potholes
const RedIcon = L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
            <path fill="#dc2626" stroke="#991b1b" stroke-width="1" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
            <circle cx="12.5" cy="12.5" r="6" fill="white"/>
        </svg>
    `),
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -41]
});

// Orange marker icon for cracks
const OrangeIcon = L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
            <path fill="#f97316" stroke="#c2410c" stroke-width="1" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
            <circle cx="12.5" cy="12.5" r="6" fill="white"/>
        </svg>
    `),
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -41]
});

// Helper to create Severe/Cost Icons
const createSeverityIcon = (cost) => {
    let color = '#ef4444'; // Red (Default High)
    let stroke = '#991b1b';

    // Logic: Yellow (< 1k), Orange (1k-5k), Red (> 5k)
    if (cost < 1000) {
        color = '#eab308'; // Yellow-500
        stroke = '#ca8a04'; // Yellow-700
    } else if (cost <= 5000) {
        color = '#f97316'; // Orange-500
        stroke = '#c2410c'; // Orange-700
    }

    return L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
                <path fill="${color}" stroke="${stroke}" stroke-width="1" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
                <circle cx="12.5" cy="12.5" r="6" fill="white"/>
            </svg>
        `),
        shadowUrl: iconShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [0, -41]
    });
};

// Custom Icons for Vehicles
// Custom Icons for Vehicles using Tailwind and Emojis
const createVehicleIcon = (color, emoji) => L.divIcon({
    className: 'custom-vehicle-icon',
    html: `<div class="flex items-center justify-center w-8 h-8 bg-white rounded-full border-2 shadow-md hover:scale-110 transition-transform" style="border-color: ${color}; font-size: 1.25rem;">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

const CarIcon = createVehicleIcon('#2563eb', '🚗');
const TruckIcon = createVehicleIcon('#f97316', '🚛');
const MotorcycleIcon = createVehicleIcon('#16a34a', '🏍️');

// Map style configurations
const mapStyles = {
    OpenStreetMap: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors'
    },
    'Google Roads': {
        url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        attribution: '© Google Maps'
    },
    'Google Satellite': {
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        attribution: '© Google Maps'
    },
    'Google Hybrid': {
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        attribution: '© Google Maps'
    },
    'Google Terrain': {
        url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
        attribution: '© Google Maps'
    },
};

// Component to update map bounds based on data
const MapUpdater = ({ data, isSelectingROI }) => {
    const map = useMap();
    const { lastZoomedSignature, setLastZoomedSignature } = useAppStore();

    useEffect(() => {
        // Skip auto-zoom if user is currently drawing an ROI
        if (isSelectingROI) return;

        if (data && data.length > 0) {
            // Create a signature based on unique Upload IDs rather than point count
            // This ensures we ONLY re-zoom when a brand-new file/dataset is added
            // but remain static when individual points are hidden or deleted.
            const uniqueIds = [...new Set(data.map(d => d.upload_id || d.id || 'no-id'))].sort();
            const dataSignature = uniqueIds.join('|');

            if (lastZoomedSignature === dataSignature) return;

            const validPoints = data
                .filter(d => d && typeof d.lat === 'number' && typeof d.lon === 'number')
                .map(d => [d.lat, d.lon]);

            if (validPoints.length > 0) {
                const bounds = L.latLngBounds(validPoints);
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                    setLastZoomedSignature(dataSignature);
                }
            }
        }
    }, [data, map, isSelectingROI]);

    return null;
};

// Component to capture and save map view state
const MapViewWatcher = () => {
    const map = useMap();
    const { setMapView, mapCenter, mapZoom } = useAppStore();
    const hasInit = React.useRef(false);

    useMapEvents({
        moveend: () => {
            const center = map.getCenter();
            const currentZoom = map.getZoom();

            // Significant move check (prevents micro-update loops)
            const distThreshold = 0.0001;
            const hasMoved = Math.abs(center.lat - mapCenter[0]) > distThreshold ||
                Math.abs(center.lng - mapCenter[1]) > distThreshold;
            const hasZoomed = Math.abs(currentZoom - mapZoom) > 0.01;

            if (hasMoved || hasZoomed) {
                setMapView([center.lat, center.lng], currentZoom);
            }
        }
    });

    return null;
};

const MapArea = () => {
    const [isLegendOpen, setIsLegendOpen] = useState(false);
    const [isSelectingROI, setIsSelectingROI] = useState(false);
    const [tempROIPoints, setTempROIPoints] = useState([]);

    const {
        vehicles, potholes, cracks, pavement, iriFiles, activeLayers, mapStyle,
        setMapStyle, roiPolygon, setRoiPolygon, clearRoiPolygon,
        mapCenter, mapZoom
    } = useAppStore();

    const currentStyle = mapStyles[mapStyle] || mapStyles.OpenStreetMap;

    // ROI CLICK HANDLER
    const MapEvents = () => {
        useMapEvents({
            click(e) {
                if (isSelectingROI) {
                    const newPoint = [e.latlng.lat, e.latlng.lng];
                    setTempROIPoints(prev => [...prev, newPoint]);
                }
            },
        });
        return null;
    };

    const handleFinishROI = () => {
        if (tempROIPoints.length >= 3) {
            setRoiPolygon(tempROIPoints);
        }
        setIsSelectingROI(false);
        setTempROIPoints([]);
    };

    const handleClearROI = () => {
        clearRoiPolygon();
        setTempROIPoints([]);
        setIsSelectingROI(false);
    };

    // FILTERING LOGIC
    // Memoized filters to prevent expensive recalculations on every pan/zoom
    const filteredPotholes = useMemo(() => (potholes || []).filter(p => {
        if (p.is_hidden) return false;
        if (roiPolygon && !isPointInPolygon([p.lat, p.lon], roiPolygon)) return false;
        return true;
    }), [potholes, roiPolygon]);

    const filteredCracks = useMemo(() => (cracks || []).filter(c => {
        if (c.is_hidden) return false;
        if (roiPolygon && !isPointInPolygon([c.lat, c.lon], roiPolygon)) return false;
        return true;
    }), [cracks, roiPolygon]);

    const safeVehicles = useMemo(() => (vehicles || []).filter(v => v && typeof v.lat === 'number'), [vehicles]);
    const safePotholes = filteredPotholes; // Alias for readability in BudgetPanel
    const safeCracks = filteredCracks;
    const allPotholesForMap = useMemo(() => (potholes || []), [potholes]);
    const allCracksForMap = useMemo(() => (cracks || []), [cracks]);

    const safePavement = useMemo(() => (pavement || []).flatMap(p =>
        (p && p.points) ? p.points.map(pt => ({ lat: pt[0], lon: pt[1] })) : []
    ), [pavement]);

    const safeIri = useMemo(() => (iriFiles || []).filter(f => f.visible).flatMap(f =>
        (f.segments || []).filter(s => s && s.start_lat && s.start_lon).map(s => ({ lat: s.start_lat, lon: s.start_lon }))
    ), [iriFiles]);

    const allPoints = useMemo(() => [...safeVehicles, ...safePotholes, ...safeCracks, ...safePavement, ...safeIri]
        .filter(p => p && typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lon === 'number' && !isNaN(p.lon))
        , [safeVehicles, safePotholes, safeCracks, safePavement, safeIri]);

    const getIriColor = (iri) => {
        if (iri <= 3) return '#16a34a'; // Green
        if (iri <= 5) return '#facc15'; // Brighter Yellow (Yellow-400)
        if (iri <= 7) return '#f97316'; // Brighter Orange (Orange-500)
        return '#dc2626'; // Red
    };

    const getVehicleIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'car': return CarIcon;
            case 'truck': return TruckIcon;
            case 'motorcycle': return MotorcycleIcon;
            case 'bicycle': return MotorcycleIcon; // Fallback similarly
            default: return CarIcon; // Fallback
        }
    };

    return (
        <div className="flex-1 h-full relative">
            <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    url={currentStyle.url}
                    attribution={currentStyle.attribution}
                />

                <MapEvents />
                <MapViewWatcher />

                {/* Always pass all points (including hidden) for stable bounds calculation */}
                {(allPotholesForMap.length > 0 || allCracksForMap.length > 0 || safeVehicles.length > 0) && (
                    <MapUpdater
                        data={[...safeVehicles, ...allPotholesForMap, ...allCracksForMap, ...safePavement, ...safeIri]}
                        isSelectingROI={isSelectingROI}
                    />
                )}

                {/* ROI Visuals */}
                {isSelectingROI && tempROIPoints.length > 0 && (
                    <Polyline positions={tempROIPoints} color="#3b82f6" dashArray="5, 10" />
                )}
                {roiPolygon && (
                    <Polyline positions={[...roiPolygon, roiPolygon[0]]} color="#2563eb" weight={3} />
                )}

                {/* IRI Segments */}
                {activeLayers.iri && iriFiles.filter(f => f.visible).map(file => (
                    <React.Fragment key={file.id}>
                        {file.segments.filter(seg => {
                            if (!roiPolygon) return true;
                            // ROI filtering for segments (check start point)
                            return isPointInPolygon([seg.start_lat, seg.start_lon], roiPolygon);
                        }).map((seg, idx) => {
                            if (seg.start_lat && seg.start_lon && seg.end_lat && seg.end_lon) {
                                // Determine if this is a low-speed segment
                                const isLowSpeed = seg.speed_flag === 'low_speed' || seg.speed_flag === 'stopped';

                                return (
                                    <Polyline
                                        key={`iri-${file.id}-${file.segmentLength || 'default'}-${idx}-${seg.iri_value}`}
                                        positions={[
                                            [seg.start_lat, seg.start_lon],
                                            [seg.end_lat, seg.end_lon]
                                        ]}
                                        color={getIriColor(seg.iri_value)}
                                        weight={6}
                                        opacity={isLowSpeed ? 0.6 : 0.8}
                                        dashArray={isLowSpeed ? "8, 8" : null}
                                    >
                                        <Tooltip sticky>
                                            <div className="text-center">
                                                <div className="font-bold text-xs">{file.filename}</div>
                                                <div className="font-bold">IRI: {seg.iri_value.toFixed(2)}</div>
                                                <div>Quality: {
                                                    seg.iri_value <= 3 ? 'Good' :
                                                        seg.iri_value <= 5 ? 'Fair' :
                                                            seg.iri_value <= 7 ? 'Poor' : 'Bad'
                                                }</div>
                                                <div className="text-xs text-gray-500">
                                                    Speed: {seg.mean_speed?.toFixed(1) || '?'} m/s
                                                </div>
                                                {isLowSpeed && (
                                                    <div className="text-xs text-amber-600 font-semibold mt-1">
                                                        ⚠️ Low Speed ({seg.speed_flag === 'stopped' ? 'Stopped' : 'Intersection'})
                                                    </div>
                                                )}
                                            </div>
                                        </Tooltip>
                                    </Polyline>
                                );
                            }
                            return null;
                        })}
                    </React.Fragment>
                ))}

                {/* Vehicles */}
                {activeLayers.vehicles && vehicles.filter(v => {
                    if (!roiPolygon) return true;
                    return v && isPointInPolygon([v.lat, v.lon], roiPolygon);
                }).map((v, idx) => (
                    (v && typeof v.lat === 'number' && typeof v.lon === 'number') ? (
                        <Marker key={`v-${idx}`} position={[v.lat, v.lon]} icon={getVehicleIcon(v.type)}>
                            <Popup>
                                <div className="text-center font-sans">
                                    <h4 className="font-bold text-gray-800 m-0 mb-1">Vehicle Detection</h4>
                                    <div className="text-sm">Type: <span className="font-semibold capitalize">{v.type}</span></div>
                                </div>
                            </Popup>
                            <Tooltip>{v.type}</Tooltip>
                        </Marker>
                    ) : null
                ))}


                {/* Potholes */}
                {activeLayers.potholes && potholes.filter(p => {
                    if (p.is_hidden && !activeLayers.showHidden) return false;
                    if (roiPolygon && !isPointInPolygon([p.lat, p.lon], roiPolygon)) return false;
                    return true;
                }).map((p, idx) => (
                    <Marker
                        key={`p-${idx}`}
                        position={[p.lat, p.lon]}
                        icon={RedIcon}
                        opacity={p.is_hidden ? 0.3 : 1}
                    >
                        <Popup maxWidth={300}>
                            <PotholePopup pothole={p} />
                        </Popup>
                        <Tooltip>{p.tooltip}{p.is_hidden ? ' (HIDDEN)' : ''}</Tooltip>
                    </Marker>
                ))}

                {/* Cracks */}
                {activeLayers.cracks && cracks.filter(c => {
                    if (c.is_hidden && !activeLayers.showHidden) return false;
                    if (roiPolygon && !isPointInPolygon([c.lat, c.lon], roiPolygon)) return false;
                    return true;
                }).map((c, idx) => (
                    <Marker
                        key={`c-${idx}`}
                        position={[c.lat, c.lon]}
                        icon={OrangeIcon}
                        opacity={c.is_hidden ? 0.3 : 1}
                    >
                        <Popup maxWidth={300}>
                            <PotholePopup pothole={c} />
                        </Popup>
                        <Tooltip>{c.tooltip}{c.is_hidden ? ' (HIDDEN)' : ''}</Tooltip>
                    </Marker>
                ))}

                {/* Pavement */}
                {activeLayers.pavement && pavement.filter(p => {
                    if (!roiPolygon) return true;
                    // Check if first point of pavement line is in ROI
                    const firstPoint = p.points && p.points[0];
                    return firstPoint ? isPointInPolygon(firstPoint, roiPolygon) : true;
                }).map((p, idx) => (
                    (p && p.points && p.points.length > 0) ? (
                        <Polyline
                            key={`pav-${idx}`}
                            positions={p.points}
                            color={p.color}
                            weight={5}
                        >
                            <Tooltip sticky>
                                <div className="font-sans font-bold text-xs">Pavement: {p.type ? p.type.toUpperCase() : 'UNKNOWN'}</div>
                            </Tooltip>
                        </Polyline>
                    ) : null
                ))}
                {/* 3. Cost Heatmap Layer */}
                {activeLayers.showCostHeatmap && (safePotholes.length > 0 || safeCracks.length > 0) && (
                    <CostHeatmapLayer potholes={[...safePotholes, ...safeCracks]} />
                )}

            </MapContainer>

            {/* 4. Budget Calculator Overlay */}
            {activeLayers.showBudgetCalculator && (
                <BudgetPanel
                    potholes={[...safePotholes, ...safeCracks]}
                    isSelectingROI={isSelectingROI}
                    setIsSelectingROI={setIsSelectingROI}
                    handleFinishROI={handleFinishROI}
                    handleClearROI={handleClearROI}
                    hasROI={!!roiPolygon}
                    tempPointsCount={tempROIPoints.length}
                />
            )}

            {/* Legend Overlay */}
            {/* Mobile Toggle Button */}
            <button
                onClick={() => setIsLegendOpen(!isLegendOpen)}
                className="lg:hidden absolute bottom-4 right-4 z-[1001] bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                title="Toggle Layers"
            >
                {isLegendOpen ? <X size={24} className="text-gray-700" /> : <Layers size={24} className="text-gray-700" />}
            </button>

            <div className={`
                absolute right-4 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-2xl z-[1000] max-h-[40vh] overflow-y-auto w-48
                transition-all duration-300 ease-in-out border border-white/20
                ${isLegendOpen ? 'bottom-20 opacity-100 scale-100' : 'bottom-20 opacity-0 scale-95 pointer-events-none'}
                lg:bottom-4 lg:opacity-100 lg:scale-100 lg:pointer-events-auto
            `}>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">Map Layers</h4>
                    <Layers size={14} className="text-gray-300" />
                </div>

                <div className="space-y-3 text-sm">
                    {/* Map Style Selector */}
                    <div className="mb-4 bg-gray-50 p-2 rounded">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Map Type</label>
                        <select
                            value={mapStyle}
                            onChange={(e) => setMapStyle(e.target.value)}
                            className="w-full text-xs p-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {Object.keys(mapStyles).map(style => (
                                <option key={style} value={style}>{style}</option>
                            ))}
                        </select>
                    </div>

                    {/* Show Hidden Toggle */}
                    <div className="flex items-center justify-between py-1 border-b border-gray-50 mb-2">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase">Show Hidden</span>
                        <input
                            type="checkbox"
                            checked={activeLayers.showHidden}
                            onChange={() => useAppStore.getState().toggleLayer('showHidden')}
                            className="w-3 h-3 text-blue-600 rounded"
                        />
                    </div>


                    {activeLayers.iri && (
                        <div className="pt-2 border-t border-gray-50">
                            <div className="font-bold text-[9px] text-gray-400 mb-1.5 uppercase">IRI Quality</div>
                            <div className="grid grid-cols-1 gap-1">
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full bg-green-600 mr-2"></span> Good</div>
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full bg-yellow-400 mr-2"></span> Fair</div>
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span> Poor</div>
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full bg-red-600 mr-2"></span> Bad</div>
                            </div>
                            <div className="mt-2 pt-1 border-t border-gray-100 text-[9px] text-gray-400">
                                <span className="inline-block w-4 border-t-2 border-dashed border-gray-400 mr-1"></span>
                                Low Speed / Intersection
                            </div>
                        </div>
                    )}

                    {activeLayers.vehicles && (
                        <div className="pt-2 border-t border-gray-50">
                            <div className="font-bold text-[9px] text-gray-400 mb-1.5 uppercase">Vehicles</div>
                            <div className="grid grid-cols-1 gap-1">
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full bg-blue-600 mr-2"></span> Car</div>
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span> Truck</div>
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full bg-green-600 mr-2"></span> Cycle</div>
                            </div>
                        </div>
                    )}

                    {activeLayers.pavement && (
                        <div className="pt-2 border-t border-gray-50">
                            <div className="font-bold text-[9px] text-gray-400 mb-1.5 uppercase">Pavement</div>
                            <div className="grid grid-cols-1 gap-1">
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: '#2F2F2F' }}></span> Flexible</div>
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full mr-2 bg-gray-300"></span> Rigid</div>
                                <div className="flex items-center text-[10px]"><span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: '#8B4513' }}></span> Soil</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MapArea;

// Custom Pothole Popup Component
// --- HELPERS ---

const PotholePopup = ({ pothole }) => {
    const { toggleDetectionVisibility, deleteDetection } = useAppStore();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleHide = async () => {
        setIsProcessing(true);
        await toggleDetectionVisibility(pothole.upload_id, pothole.id, !pothole.is_hidden);
        setIsProcessing(false);
    };

    const handleDelete = async () => {
        if (window.confirm("Permanently delete this detection? (SuperUser only)")) {
            setIsProcessing(true);
            const success = await deleteDetection(pothole.upload_id, pothole.id);
            if (!success) alert("Only SuperUsers can delete detections.");
            setIsProcessing(false);
        }
    };

    const handleImageError = (e) => {
        e.target.style.display = 'none';
        e.target.nextElementSibling.style.display = 'block';
    };

    return (
        <div style={{ textAlign: 'center', minWidth: '250px', fontFamily: 'Arial, sans-serif' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontWeight: 'bold' }}>🚧 Road Defect</h4>

            {pothole.is_hidden && (
                <div style={{ marginBottom: '8px', background: '#f3f4f6', color: '#6b7280', fontSize: '10px', padding: '4px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Hidden from Budget
                </div>
            )}

            <div style={{ margin: '10px 0', padding: '10px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <a href={pothole.image_url} target="_blank" rel="noopener noreferrer">
                    <img
                        src={pothole.image_url}
                        style={{ width: '200px', height: 'auto', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer' }}
                        onError={handleImageError}
                        alt="Pothole Detection"
                    />
                </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: '#3b82f6', textTransform: 'uppercase' }}>Conf</div>
                    <div style={{ fontWeight: 'bold' }}>{(pothole.confidence * 100).toFixed(1)}%</div>
                </div>
                <div style={{ background: '#fffbeb', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: '#d97706', textTransform: 'uppercase' }}>Cost</div>
                    <div style={{ fontWeight: 'bold' }}>₱{(pothole.repair_cost || 0).toLocaleString()}</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                <button
                    onClick={handleHide}
                    disabled={isProcessing}
                    style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', background: pothole.is_hidden ? '#2563eb' : '#e5e7eb', color: pothole.is_hidden ? 'white' : '#374151', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    {pothole.is_hidden ? '👁️ Unhide' : '👓 Hide'}
                </button>
                <button
                    onClick={handleDelete}
                    disabled={isProcessing}
                    style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    🗑️ Delete
                </button>
            </div>
        </div>
    );
};


