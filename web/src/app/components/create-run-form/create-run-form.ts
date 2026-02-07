import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RunsStore } from '../../services/runs.store';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-create-run-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-run-form.html',
  styleUrl: './create-run-form.css',
})
export class CreateRunForm {
  store = inject(RunsStore);
  apiService = inject(ApiService);

  refreshRuns = () => {
    this.apiService.refreshRunsList();
  };

  isSubmitting = false;

  formData = {
    seed: 42,
    maxTime: 60,
    goalX: 10,
    goalY: 10,
  };

  faultSeverities: { [key: string]: number } = {
    sensor_dropout: 1,
    wheel_slip: 0.5,
    latency_spike: 0.3,
  };

  selectedFaults = new Set<string>();

  faultOptions = [
    { id: 'sensor_dropout', label: 'Sensor Dropout' },
    { id: 'wheel_slip', label: 'Wheel Slip' },
    { id: 'latency_spike', label: 'Latency Spike' },
  ];

  isChecked(faultId: string): boolean {
    return this.selectedFaults.has(faultId);
  }

  toggleFault(faultId: string) {
    if (this.selectedFaults.has(faultId)) {
      this.selectedFaults.delete(faultId);
    } else {
      this.selectedFaults.add(faultId);
    }
  }

  getFaultSeverity(faultId: string): string {
    return (this.faultSeverities[faultId] * 100).toFixed(0) + '%';
  }

  getFaultTime(faultId: string): number {
    const index = Array.from(this.selectedFaults).indexOf(faultId);
    return (index + 1) * 5;
  }

  async submitForm() {
    this.isSubmitting = true;

    const taskSpec = {
      taskId: `task-${Date.now()}`,
      worldId: 'world-1',
      seed: this.formData.seed,
      startPose: { x: 0, y: 0, yaw: 0 },
      goalPose: { x: this.formData.goalX, y: this.formData.goalY, yaw: 0 },
      constraints: { noGoZones: [] },
      success: { maxTimeSec: this.formData.maxTime, maxCollisions: 1 },
    };

    const faults = Array.from(this.selectedFaults).map((faultId, index) => ({
      atSec: (index + 1) * 5,
      type: faultId,
      durationSec: 10,
      severity: this.faultSeverities[faultId],
      target: 'robot',
    }));

    const faultProfile = {
      profileId: `profile-${Date.now()}`,
      faults,
    };

    try {
      console.log('Creating run:', { taskSpec, faultProfile });
      const newRun = await this.apiService.createRun(taskSpec, faultProfile);
      console.log('Run created:', newRun);
      await this.refreshRuns();
      this.store.toggleCreateForm();
      this.store.setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create run';
      this.store.setError(message);
      console.error('Error creating run:', err);
    } finally {
      this.isSubmitting = false;
    }
  }
}
