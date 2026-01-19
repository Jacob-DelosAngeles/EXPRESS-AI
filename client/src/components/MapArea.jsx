import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap, CircleMarker } from 'react-leaflet';
import { Layers, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
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
const BudgetPanel = ({ potholes }) => {
    // Calculate totals
    const totalCost = potholes.reduce((sum, p) => sum + (p.repair_cost || 0), 0);
    const totalArea = potholes.reduce((sum, p) => sum + (p.area_m2 || 0), 0);
    const count = potholes.length;

    // Format currency
    const formatPHP = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

    return (
        <div className="absolute top-4 right-4 z-[1000] lg:top-4 lg:right-4 max-w-[220px]">
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

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                        <div className="text-gray-400 mb-0.5">Defects</div>
                        <div className="font-semibold text-gray-700">{count}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                        <div className="text-gray-400 mb-0.5">Area</div>
                        <div className="font-semibold text-gray-700">{totalArea.toFixed(2)} m²</div>
                    </div>
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
            {potholes.map((p, idx) => {
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
                            className: 'blur-sm' // Tailwin blur effect via CSS? Might need inline style if CSS module
                        }}
                    >
                        {/* No Popup for heatmap, it's visual only */}
                    </CircleMarker>
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
const MapUpdater = ({ data }) => {
    const map = useMap();

    useEffect(() => {
        if (data && data.length > 0) {
            const validPoints = data
                .filter(d => d && typeof d.lat === 'number' && typeof d.lon === 'number')
                .map(d => [d.lat, d.lon]);

            if (validPoints.length > 0) {
                const bounds = L.latLngBounds(validPoints);
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                }
            }
        }
    }, [data, map]);

    return null;
};

const MapArea = () => {
    const [isLegendOpen, setIsLegendOpen] = useState(false);
    const { vehicles, potholes, pavement, iriFiles, activeLayers, mapStyle, setMapStyle } = useAppStore();

    const currentStyle = mapStyles[mapStyle] || mapStyles.OpenStreetMap;

    // Combine all points to calculate bounds
    const safeVehicles = (vehicles || []).filter(v => v && typeof v.lat === 'number');
    const safePotholes = (potholes || []).filter(p => p && typeof p.lat === 'number');
    const safePavement = (pavement || []).flatMap(p => (p && p.points) ? p.points.map(pt => ({ lat: pt[0], lon: pt[1] })) : []);
    const safeIri = (iriFiles || []).filter(f => f.visible).flatMap(f => (f.segments || []).filter(s => s && s.start_lat && s.start_lon).map(s => ({ lat: s.start_lat, lon: s.start_lon })));

    const allPoints = [...safeVehicles, ...safePotholes, ...safePavement, ...safeIri]
        .filter(p => p && typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lon === 'number' && !isNaN(p.lon));

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
                center={[14.1648, 121.2413]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    url={currentStyle.url}
                    attribution={currentStyle.attribution}
                />

                {allPoints.length > 0 && <MapUpdater data={allPoints} />}

                {/* IRI Segments */}
                {activeLayers.iri && iriFiles.filter(f => f.visible).map(file => (
                    <React.Fragment key={file.id}>
                        {file.segments.map((seg, idx) => {
                            if (seg.start_lat && seg.start_lon && seg.end_lat && seg.end_lon) {
                                return (
                                    <Polyline
                                        key={`iri-${file.id}-${file.segmentLength || 'default'}-${idx}-${seg.iri_value}`}
                                        positions={[
                                            [seg.start_lat, seg.start_lon],
                                            [seg.end_lat, seg.end_lon]
                                        ]}
                                        color={getIriColor(seg.iri_value)}
                                        weight={6}
                                        opacity={0.8}
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
                {activeLayers.vehicles && vehicles.map((v, idx) => (
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
                {activeLayers.potholes && potholes.map((p, idx) => (
                    <Marker key={`p-${idx}`} position={[p.lat, p.lon]} icon={RedIcon}>
                        <Popup maxWidth={300}>
                            <PotholePopup pothole={p} />
                        </Popup>
                        <Tooltip>{p.tooltip}</Tooltip>
                    </Marker>
                ))}

                {/* Pavement */}
                {activeLayers.pavement && pavement.map((p, idx) => (
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
                {activeLayers.showCostHeatmap && safePotholes.length > 0 && (
                    <CostHeatmapLayer potholes={safePotholes} />
                )}

            </MapContainer>

            {/* 4. Budget Calculator Overlay */}
            {activeLayers.showBudgetCalculator && safePotholes.length > 0 && (
                <BudgetPanel potholes={safePotholes} />
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
                absolute right-4 bg-white p-4 rounded shadow-lg z-[1000] max-h-[60vh] overflow-y-auto
                transition-all duration-300 ease-in-out
                ${isLegendOpen ? 'bottom-20 opacity-100 scale-100' : 'bottom-20 opacity-0 scale-95 pointer-events-none'}
                lg:bottom-4 lg:opacity-100 lg:scale-100 lg:pointer-events-auto
            `}>
                <h4 className="font-bold mb-2 text-sm">Layers & Legend</h4>
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


                    {activeLayers.iri && (
                        <div>
                            <div className="font-semibold text-xs mb-1 bg-gray-100 p-1 rounded">IRI Quality</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-600 mr-2"></span> Good (0-3)</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></span> Fair (3-5)</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-2"></span> Poor (5-7)</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-600 mr-2"></span> Bad (&gt;7)</div>
                        </div>
                    )}

                    {activeLayers.vehicles && (
                        <div>
                            <div className="font-semibold text-xs mb-1 bg-gray-100 p-1 rounded">Vehicles</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-600 mr-2"></span> Car</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-2"></span> Truck</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-600 mr-2"></span> Motorcycle/Bike</div>
                        </div>
                    )}

                    {activeLayers.potholes && (
                        <div>
                            <div className="font-semibold text-xs mb-1 bg-gray-100 p-1 rounded">Hazards</div>
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-red-600 mr-2"></span> Pothole
                            </div>
                        </div>
                    )}

                    {activeLayers.pavement && (
                        <div>
                            <div className="font-semibold text-xs mb-1 bg-gray-100 p-1 rounded">Pavement Type</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#2F2F2F' }}></span> Flexible</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2 border border-gray-300" style={{ backgroundColor: '#D3D3D3' }}></span> Rigid</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#8B4513' }}></span> Soil</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2 border border-gray-300" style={{ backgroundColor: '#FFFFFF' }}></span> Gravel</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MapArea;

// Custom Pothole Popup Component
const PotholePopup = ({ pothole }) => {
    const handleImageError = (e) => {
        e.target.style.display = 'none';
        e.target.nextElementSibling.style.display = 'block';
    };

    return (
        <div style={{ textAlign: 'center', minWidth: '250px', fontFamily: 'Arial, sans-serif' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>🚧 Pothole Detection</h4>
            <p style={{ margin: '5px 0' }}><strong>Confidence:</strong> {(pothole.confidence * 100).toFixed(2)}%</p>
            <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>{pothole.image_path}</p>

            <div style={{ margin: '10px 0', padding: '10px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <a href={pothole.image_url} target="_blank" rel="noopener noreferrer">
                    <img
                        src={pothole.image_url}
                        style={{ width: '200px', height: 'auto', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer' }}
                        onError={handleImageError}
                        alt="Pothole Detection"
                    />
                </a>
                <div style={{ display: 'none', color: '#e74c3c', fontSize: '12px', padding: '10px' }}>
                    ❌ Image failed to load<br />
                    <a href={pothole.image_url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none', fontSize: '10px' }}>
                        Click here to view image
                    </a>
                </div>
            </div>

            <p style={{ margin: '5px 0', fontSize: '10px', color: '#999' }}>
                <a href={pothole.image_url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none' }}>
                    View full image in new tab
                </a>
            </p>
        </div>
    );
};


