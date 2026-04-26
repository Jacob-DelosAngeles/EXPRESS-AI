import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { fileService } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, FileText, Activity, AlertCircle } from 'lucide-react';

import useAppStore from '../store/useAppStore';

const IRICalculator = () => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeResult, setActiveResult] = useState(null);
    const [error, setError] = useState(null);
    const [segmentLength, setSegmentLength] = useState(25);

    const { addIriFile, iriFiles } = useAppStore();

    const onDrop = (acceptedFiles) => {
        setFiles(prev => [...prev, ...acceptedFiles]);
        setError(null);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv']
        },
        multiple: true
    });

    const handleCalculate = async () => {
        if (files.length === 0) return;

        setLoading(true);
        setError(null);

        try {
            for (const file of files) {
                // 1. Upload file
                const uploadResponse = await fileService.uploadFile(file, 'iri');

                if (uploadResponse.success) {
                    // 2. Compute IRI
                    const computationResponse = await fileService.computeIRI(uploadResponse.filename, segmentLength);

                    if (computationResponse.success) {
                        // Add to store
                        addIriFile({
                            filename: file.name,
                            segments: computationResponse.segments,
                            display_segments: computationResponse.display_segments,
                            raw_data: computationResponse.raw_data,
                            filtered_data: computationResponse.filtered_data,
                            stats: {
                                averageIri: computationResponse.segments.reduce((acc, seg) => acc + seg.iri_value, 0) / computationResponse.segments.length,
                                maxIri: Math.max(...computationResponse.segments.map(s => s.iri_value)),
                                avgSpeed: computationResponse.segments.reduce((acc, seg) => acc + seg.mean_speed, 0) / computationResponse.segments.length,
                                totalDistance: computationResponse.segments[computationResponse.segments.length - 1].distance_end,
                                totalSegments: computationResponse.total_segments
                            }
                        });

                        // Set active result to the last processed file for immediate viewing
                        setActiveResult(computationResponse);
                    } else {
                        setError(`Failed to compute IRI for ${file.name}: ${computationResponse.message}`);
                    }
                } else {
                    setError(`Failed to upload ${file.name}: ${uploadResponse.message}`);
                }
            }
            // Clear files after processing
            setFiles([]);

        } catch (err) {
            setError(err.response?.data?.detail || 'An error occurred during processing');
        } finally {
            setLoading(false);
        }
    };

    // Use activeResult or the last file from store if available
    const displayResult = activeResult || (iriFiles.length > 0 ? {
        segments: iriFiles[iriFiles.length - 1].segments,
        raw_data: iriFiles[iriFiles.length - 1].raw_data,
        filtered_data: iriFiles[iriFiles.length - 1].filtered_data,
        total_segments: iriFiles[iriFiles.length - 1].stats.totalSegments
    } : null);

    const getQualityColor = (iri) => {
        if (iri <= 3) return 'text-green-600';
        if (iri <= 5) return 'text-yellow-400'; // Brighter Yellow
        if (iri <= 7) return 'text-orange-500'; // Brighter Orange
        return 'text-red-600';
    };

    const getQualityLabel = (iri) => {
        if (iri <= 3) return 'Good';
        if (iri <= 5) return 'Fair';
        if (iri <= 7) return 'Poor';
        return 'Bad';
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                    <Activity className="mr-2 text-blue-600" />
                    IRI Calculator
                </h2>
                <p className="text-gray-600 mb-6">
                    Upload CSV sensor data to calculate the International Roughness Index (IRI) for your pavement section.
                </p>

                {/* File Upload Area */}
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                        }`}
                >
                    <input {...getInputProps()} />
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    {files.length > 0 ? (
                        <div className="text-green-600 font-medium">
                            <FileText className="inline-block mr-2" />
                            {files.length} file(s) selected
                            <ul className="text-sm text-gray-500 mt-2 list-disc list-inside">
                                {files.map((f, i) => <li key={i}>{f.name}</li>)}
                            </ul>
                        </div>
                    ) : (
                        <div>
                            <p className="text-lg font-medium text-gray-700">Drag & drop CSV files here, or click to select</p>
                            <p className="text-sm text-gray-500 mt-2">Supported format: .csv (Physics Toolbox Sensor Suite export)</p>
                        </div>
                    )}
                </div>

                {/* Settings & Action */}
                <div className="mt-6 flex items-end gap-4">
                    <div className="w-48">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Segment Length (m)</label>
                        <input
                            type="number"
                            value={segmentLength}
                            onChange={(e) => setSegmentLength(parseInt(e.target.value))}
                            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="10"
                        />
                    </div>
                    <button
                        onClick={handleCalculate}
                        disabled={files.length === 0 || loading}
                        className={`px-6 py-2 rounded font-bold text-white transition-colors ${files.length === 0 || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {loading ? 'Processing...' : 'Calculate IRI'}
                    </button>
                </div>

                {error && (
                    <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 flex items-start">
                        <AlertCircle className="text-red-500 mr-3 mt-0.5" size={20} />
                        <p className="text-red-700">{error}</p>
                    </div>
                )}
            </div>

            {/* Results Section */}
            {displayResult && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                            <p className="text-gray-500 text-sm font-medium">Average IRI</p>
                            <p className="text-3xl font-bold text-gray-800">
                                {(displayResult.segments.reduce((acc, seg) => acc + seg.iri_value, 0) / displayResult.segments.length).toFixed(2)}
                                <span className="text-sm font-normal text-gray-500 ml-1">m/km</span>
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                            <p className="text-gray-500 text-sm font-medium">Total Distance</p>
                            <p className="text-3xl font-bold text-gray-800">
                                {(displayResult.segments[displayResult.segments.length - 1].distance_end / 1000).toFixed(2)}
                                <span className="text-sm font-normal text-gray-500 ml-1">km</span>
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                            <p className="text-gray-500 text-sm font-medium">Segments Processed</p>
                            <p className="text-3xl font-bold text-gray-800">{displayResult.total_segments}</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="space-y-6">
                        {/* Raw Accelerometer Data */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold mb-4">Raw Accelerometer Data</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={displayResult.raw_data}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="time"
                                            label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -10 }}
                                            tickFormatter={(val) => val.toFixed(1)}
                                        />
                                        <YAxis label={{ value: 'Acceleration (m/s²)', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip labelFormatter={(val) => `Time: ${val.toFixed(2)}s`} />
                                        <Legend />
                                        <Line type="monotone" dataKey="ax" stroke="#ef4444" name="X-axis" dot={false} strokeWidth={1.5} />
                                        <Line type="monotone" dataKey="ay" stroke="#22c55e" name="Y-axis" dot={false} strokeWidth={1.5} />
                                        <Line type="monotone" dataKey="az" stroke="#3b82f6" name="Z-axis" dot={false} strokeWidth={1.5} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Filtered Vertical Acceleration */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold mb-4">Filtered Vertical Acceleration</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={displayResult.filtered_data}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="time"
                                            label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -10 }}
                                            tickFormatter={(val) => val.toFixed(1)}
                                        />
                                        <YAxis label={{ value: 'Vertical Accel (m/s²)', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip labelFormatter={(val) => `Time: ${val.toFixed(2)}s`} />
                                        <Legend />
                                        <Line type="monotone" dataKey="vertical_accel" stroke="#8b5cf6" name="Vertical Accel" dot={false} strokeWidth={1.5} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* IRI Profile */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold mb-4">IRI Profile</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={displayResult.segments}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="distance_end"
                                            label={{ value: 'Distance (m)', position: 'insideBottomRight', offset: -10 }}
                                        />
                                        <YAxis
                                            label={{ value: 'IRI (m/km)', angle: -90, position: 'insideLeft' }}
                                        />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="iri_value"
                                            stroke="#2563eb"
                                            name="IRI Value"
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Table */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="px-6 py-4 border-b">
                            <h3 className="text-lg font-bold">Segment Details</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Segment ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (m)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IRI (m/km)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speed (m/s)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quality</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {displayResult.segments.map((segment) => (
                                        <tr key={segment.segment_id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{segment.segment_id}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {segment.distance_start.toFixed(0)} - {segment.distance_end.toFixed(0)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {segment.iri_value.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {segment.mean_speed.toFixed(1)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                                                <span className={getQualityColor(segment.iri_value)}>
                                                    {getQualityLabel(segment.iri_value)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IRICalculator;
