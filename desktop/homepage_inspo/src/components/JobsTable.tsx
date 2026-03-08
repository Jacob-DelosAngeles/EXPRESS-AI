import { CheckCircle2, Loader2, XCircle, ArrowRight } from 'lucide-react';
import { Job } from '../types';

const mockJobs: Job[] = [
  {
    id: '1',
    status: 'Done',
    name: 'Maharlika Highway Survey',
    detections: { potholes: 42, cracks: 128 },
    duration: '12m 45s',
  },
  {
    id: '2',
    status: 'Processing',
    progress: 78,
    name: 'Baguio City Arterial Road',
    detections: 'Processing...',
    duration: '08m 12s',
  },
  {
    id: '3',
    status: 'Done',
    name: 'Expressway Exit A-4 Scan',
    detections: { potholes: 8, cracks: 31 },
    duration: '03m 12s',
  },
  {
    id: '4',
    status: 'Done',
    name: 'Main Square Intersection',
    detections: { potholes: 15, cracks: 44 },
    duration: '05m 50s',
  },
  {
    id: '5',
    status: 'Failed',
    name: 'Night Drive Test Runway 1',
    detections: 'Input corrupted',
    duration: '00m 04s',
  },
];

export default function JobsTable() {
  return (
    <section className="glass-card rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
        <h2 className="font-bold text-lg text-white">Recent Processing Jobs</h2>
        <button className="text-sm text-blue-400 font-semibold hover:underline">View All History</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-800/30 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Job Name</th>
              <th className="px-6 py-3">Detections</th>
              <th className="px-6 py-3">Duration</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-sm">
            {mockJobs.map((job) => (
              <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  {job.status === 'Done' && (
                    <div className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 className="w-4 h-4" />
                      Done
                    </div>
                  )}
                  {job.status === 'Processing' && (
                    <div className="flex items-center gap-2 text-blue-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {job.progress}%
                    </div>
                  )}
                  {job.status === 'Failed' && (
                    <div className="flex items-center gap-2 text-red-500">
                      <XCircle className="w-4 h-4" />
                      Failed
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-slate-200">{job.name}</td>
                <td className="px-6 py-4">
                  {typeof job.detections === 'object' ? (
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px]">
                        {job.detections.potholes} Potholes
                      </span>
                      <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-[10px]">
                        {job.detections.cracks} Cracks
                      </span>
                    </div>
                  ) : (
                    <span className={job.status === 'Failed' ? 'text-red-400/60' : 'text-slate-500 italic'}>
                      {job.detections}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-400">{job.duration}</td>
                <td className="px-6 py-4 text-right">
                  {job.status === 'Done' ? (
                    <a href="#" className="text-blue-400 font-medium hover:text-blue-300 flex items-center justify-end gap-1">
                      Open Results <ArrowRight className="w-3 h-3" />
                    </a>
                  ) : job.status === 'Failed' ? (
                    <button className="text-slate-500 font-medium hover:text-slate-400">Retry Scan</button>
                  ) : (
                    <span className="text-slate-600 font-medium">Pending...</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
