export interface Job {
  id: string;
  status: 'Done' | 'Processing' | 'Failed';
  progress?: number;
  name: string;
  detections: {
    potholes: number;
    cracks: number;
  } | string;
  duration: string;
}

export interface SystemStats {
  model: string;
  storage: number;
  backendHealth: 'OPTIMAL' | 'DEGRADED' | 'OFFLINE';
  fps: number;
  cpu: number;
  gpu: number;
}
