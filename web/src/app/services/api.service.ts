import { Injectable, signal, resource } from '@angular/core';

export interface HealthResponse {
  status: string;
  service: string;
}

export interface TaskSpec {
  taskId: string;
  worldId: string;
  seed: number;
  startPose: { x: number; y: number; yaw: number };
  goalPose: { x: number; y: number; yaw: number };
  constraints?: { noGoZones?: Array<Array<{ x: number; y: number }>> };
  success: { maxTimeSec: number; maxCollisions: number };
}

export interface FaultProfile {
  profileId: string;
  faults: Array<{
    atSec: number;
    type: string;
    durationSec: number;
    severity: number;
    target?: string;
  }>;
}

export interface Run {
  id: string;
  taskSpec: TaskSpec;
  faultProfile: FaultProfile;
  status: string;
  result?: string;
  kpis?: Record<string, unknown>;
}

export interface RCAResult {
  rootCause: string;
  evidence: Array<{ t: number; seq: number; eventType: string; note: string }>;
  recommendedFix: string[];
  generatedBy: 'gemini' | 'fallback';
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Default to the local API host in development (Angular dev server on 4200).
  // If the app is served from a production origin where the API is proxied,
  // this will be an empty string and requests will be relative to the page.
  private readonly apiUrl = signal(
    (typeof window !== 'undefined' && window.location.hostname === 'localhost')
      ? 'http://localhost:3000'
      : ''
  );

  private getBase(): string {
    const url = this.apiUrl();
    if (!url) return '';
    return url.replace(/\/$/, '');
  }

  // Health check resource
  health = resource({
    loader: async () => {
      const base = this.getBase();
      const response = await fetch(base ? `${base}/` : `/`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      return response.json() as Promise<HealthResponse>;
    }
  });

  // Runs list resource
  private runsListResource = resource({
    loader: async () => {
      const base = this.getBase();
      const response = await fetch(base ? `${base}/api/runs` : `/api/runs`);
      if (!response.ok) throw new Error('Failed to fetch runs');
      return response.json();
    }
  });

  get runsList() {
    return this.runsListResource;
  }

  setApiUrl(url: string) {
    this.apiUrl.set(url);
  }

  getApiUrl() {
    return this.apiUrl();
  }

  async createRun(taskSpec: TaskSpec, faultProfile: FaultProfile): Promise<Run> {
    const base = this.getBase();
    const response = await fetch(base ? `${base}/api/runs` : `/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskSpec, faultProfile })
    });
    if (!response.ok) throw new Error('Failed to create run');
    return response.json() as Promise<Run>;
  }

  async startRun(id: string) {
    const base = this.getBase();
    const response = await fetch(base ? `${base}/api/runs/${id}/start` : `/api/runs/${id}/start`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to start run');
    return response.json();
  }

  async getRunEvents(id: string): Promise<Record<string, unknown>[]> {
    const base = this.getBase();
    const response = await fetch(base ? `${base}/api/runs/${id}/events` : `/api/runs/${id}/events`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json() as Promise<Record<string, unknown>[]>;
  }

  async analyzeRun(id: string): Promise<RCAResult> {
    const base = this.getBase();
    const response = await fetch(base ? `${base}/api/runs/${id}/analyze` : `/api/runs/${id}/analyze`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to analyze run');
    return response.json() as Promise<RCAResult>;
  }

  // Refresh runs list resource
  refreshRunsList() {
    this.runsListResource.reload();
  }
}
