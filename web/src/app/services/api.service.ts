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
  private readonly apiUrl = signal('http://localhost:3000');

  // Health check resource
  health = resource({
    loader: async () => {
      const response = await fetch(`${this.apiUrl()}`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      return response.json() as Promise<HealthResponse>;
    }
  });

  // Runs list resource
  private runsListResource = resource({
    loader: async () => {
      const response = await fetch(`${this.apiUrl()}/api/runs`);
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
    const response = await fetch(`${this.apiUrl()}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskSpec, faultProfile })
    });
    if (!response.ok) throw new Error('Failed to create run');
    return response.json() as Promise<Run>;
  }

  async startRun(id: string) {
    const response = await fetch(`${this.apiUrl()}/api/runs/${id}/start`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to start run');
    return response.json();
  }

  async getRunEvents(id: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${this.apiUrl()}/api/runs/${id}/events`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json() as Promise<Record<string, unknown>[]>;
  }

  async analyzeRun(id: string): Promise<RCAResult> {
    const response = await fetch(`${this.apiUrl()}/api/runs/${id}/analyze`, {
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
