import React from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Construction,
    Info,
    Sparkles,
    Activity,
    ClipboardList
} from 'lucide-react';
import { RadialBarChart, RadialBar, Tooltip, ResponsiveContainer } from 'recharts';

const DiagnosisCard = ({ diagnosis, metrics }) => {
    // diagnosis: { status, color, action, method, insight, vlm_prompt }
    // metrics: { density, iri, crack_len }

    // Fallback if data is missing
    if (!diagnosis) return null;

    // Map status colors to hex for Chart
    const getColorHex = (color) => {
        switch (color) {
            case 'red': return '#ef4444';
            case 'yellow': return '#eab308';
            case 'green': return '#22c55e';
            default: return '#94a3b8';
        }
    };

    const statusColor = getColorHex(diagnosis.color);

    // Gauge Data (0-100 score based on status)
    const gaugeValue = diagnosis.status === 'CRITICAL' ? 100 :
        diagnosis.status === 'WARNING' ? 60 : 20;

    const data = [
        { name: 'Condition', value: gaugeValue, fill: statusColor }
    ];

    return (
        <div className="w-full h-full flex flex-col gap-4">
            {/* 0. Preliminary Assessment (Cause & Pre-Rehab) */}
            {(diagnosis.cause || diagnosis.pre_rehab_assessment) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cause */}
                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2 flex items-center">
                            <Info className="w-4 h-4 mr-2" />
                            Probable Cause
                        </h4>
                        <p className="text-sm text-blue-900 font-medium leading-relaxed">
                            {diagnosis.cause || "Analysis pending..."}
                        </p>
                    </div>

                    {/* Pre-Rehab */}
                    <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                        <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center">
                            <ClipboardList className="w-4 h-4 mr-2" />
                            Pre-Rehab Assessment
                        </h4>
                        <ul className="list-disc list-inside text-sm text-emerald-900 font-medium leading-relaxed">
                            {Array.isArray(diagnosis.pre_rehab_assessment) ? (
                                diagnosis.pre_rehab_assessment.map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))
                            ) : (
                                <li>{diagnosis.pre_rehab_assessment || "Pending survey..."}</li>
                            )}
                        </ul>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 w-full flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-blue-600" />
                        Engineer's Diagnosis
                    </h3>
                    {diagnosis.status === 'CRITICAL' && (
                        <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                            ACTION REQUIRED
                        </span>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-6 mb-4 flex-1">

                    {/* 1. Condition Assessment (Gauge) */}
                    <div className="flex-1 flex flex-col items-center justify-center min-w-[140px]">
                        <div className="relative w-36 h-36">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadialBarChart
                                    cx="50%" cy="50%"
                                    innerRadius="70%" outerRadius="100%"
                                    barSize={10}
                                    data={data}
                                    startAngle={180} endAngle={0}
                                >
                                    <RadialBar
                                        background
                                        clockWise
                                        dataKey="value"
                                        cornerRadius={10}
                                    />
                                </RadialBarChart>
                            </ResponsiveContainer>
                            {/* Center Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center mt-4">
                                <span className="text-sm text-gray-400 font-medium">Condition</span>
                                <span className={`text-xl font-black`} style={{ color: statusColor }}>
                                    {diagnosis.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Recommended Action */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center border-l border-gray-100 pl-6 border-r pr-6">
                        <div className="p-4 rounded-full mb-3" style={{ backgroundColor: `${statusColor}1A` }}>
                            <Construction className="w-8 h-8" style={{ color: statusColor }} />
                        </div>
                        <div className="font-bold text-gray-900 text-lg mb-1">
                            {diagnosis.action}
                        </div>
                    </div>

                    {/* 3. Data Evidence */}
                    <div className="flex-1 flex flex-col justify-center gap-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                            Data Evidence
                        </h4>

                        {metrics.density !== undefined && (
                            <div className={`flex items-center justify-between p-2 rounded-lg ${metrics.density > 30 ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                                <span className="text-xs text-gray-600">Pothole Density</span>
                                <span className={`text-sm font-bold ${metrics.density > 30 ? 'text-red-600' : 'text-gray-800'}`}>
                                    {metrics.density.toFixed(1)}%
                                </span>
                            </div>
                        )}

                        {metrics.iri !== undefined && (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                                <span className="text-xs text-gray-600">Avg. IRI</span>
                                <span className="text-sm font-bold text-gray-800">
                                    {metrics.iri.toFixed(2)} m/km
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Semantic Insight (VLM) */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 flex gap-3">
                    {/* PAVI Mascot */}
                    <div className="bg-white p-1 rounded-lg shadow-sm h-fit flex-shrink-0">
                        <img
                            src="/pavi_mascot.png"
                            alt="PAVI"
                            className="w-12 h-12 rounded-lg object-cover"
                        />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-xs font-bold text-indigo-800 mb-1 flex items-center">
                            <Sparkles className="w-3 h-3 mr-1" />
                            PAVI's Insight
                        </h4>
                        <p className="text-sm text-indigo-900/80 leading-relaxed">
                            <span className="font-semibold">{diagnosis.method}</span>
                            {diagnosis.method && " "}
                            <span className="italic">{diagnosis.insight || "PAVI is analyzing your road segment..."}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiagnosisCard;
