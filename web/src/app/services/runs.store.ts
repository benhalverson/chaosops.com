import { computed, Injectable, signal } from '@angular/core';

export interface Run {
  id: string;
  taskSpec: {
    taskId: string;
    worldId: string;
    seed: number;
    startPose: { x: number; y: number; yaw: number };
    goalPose: { x: number; y: number; yaw: number };
    constraints: { noGoZones?: any[] };
    success: { maxTimeSec: number; maxCollisions: number };
  };
  faultProfile: {
    profileId: string;
    faults: Array<{
      atSec: number;
      type: string;
      durationSec: number;
      severity: number;
      target?: string;
    }>;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RunsStore {
  // State signals
  private runsSignal = signal<Run[]>([]);
  private selectedRunSignal = signal<Run | null>(null);
  private isLoadingSignal = signal(false);
  private errorSignal = signal<string | null>(null);
  private showCreateFormSignal = signal(false);

  // Public read-only signals
  readonly runs = this.runsSignal.asReadonly();
  readonly selectedRun = this.selectedRunSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly showCreateForm = this.showCreateFormSignal.asReadonly();

  // Computed signals
  readonly runCount = computed(() => this.runs().length);
  readonly activeRuns = computed(() =>
    this.runs().filter((r) => r.status === 'running')
  );
  readonly completedRuns = computed(() =>
    this.runs().filter((r) => r.status === 'completed')
  );
  readonly failedRuns = computed(() =>
    this.runs().filter((r) => r.status === 'failed')
  );

  // Update methods
  setRuns(runs: Run[]) {
    this.runsSignal.set(runs);
  }

  addRun(run: Run) {
    this.runsSignal.update((runs) => [run, ...runs]);
  }

  updateRun(id: string, updates: Partial<Run>) {
    this.runsSignal.update((runs) =>
      runs.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }

  selectRun(run: Run | null) {
    this.selectedRunSignal.set(run);
  }

  setLoading(loading: boolean) {
    this.isLoadingSignal.set(loading);
  }

  setError(error: string | null) {
    this.errorSignal.set(error);
  }

  toggleCreateForm() {
    this.showCreateFormSignal.update((v) => !v);
  }

  resetForm() {
    this.showCreateFormSignal.set(false);
  }
}
