import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RunsStore } from '../../services/runs.store';
import { RunsList } from '../runs-list/runs-list';
import { CreateRunForm } from '../create-run-form/create-run-form';
import { UnityEmbed } from '../unity-embed/unity-embed';
import { RcaView } from '../rca-view/rca-view';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-console',
  standalone: true,
  imports: [
    CommonModule,
    RunsList,
    CreateRunForm,
    UnityEmbed,
    RcaView,
  ],
  templateUrl: './console.html',
  styleUrl: './console.css',
})
export class Console {
  store = inject(RunsStore);
  apiService = inject(ApiService);

  events: any[] = [];
  pollInterval: any;

  constructor() {
    // Load initial runs from API resource
    effect(() => {
      const runsResource = this.apiService.runsList;
      if (runsResource.hasValue()) {
        const runs = runsResource.value();
        this.store.setRuns(runs);
        if (runsResource.isLoading()) {
          this.store.setLoading(true);
        } else {
          this.store.setLoading(false);
        }
      }
      if (runsResource.error()) {
        this.store.setError('Failed to load runs');
      }
    });

    // Watch for selected run changes and start polling events
    effect(() => {
      const run = this.store.selectedRun();
      this.clearEventPolling();
      if (run?.status === 'running') {
        this.startEventPolling(run.id);
      } else if (run) {
        this.loadEvents(run.id);
      }
    });
  }

  private async loadEvents(runId: string) {
    try {
      this.events = await this.apiService.getRunEvents(runId);
    } catch (err) {
      console.error('Error loading events:', err);
    }
  }

  private startEventPolling(runId: string) {
    this.pollInterval = setInterval(async () => {
      try {
        this.apiService.refreshRunsList();

        // Check if run is still running
        const runs = this.apiService.runsList.value() || [];
        const updatedRun = runs.find((r: any) => r.id === runId);
        if (updatedRun?.status !== 'running') {
          this.clearEventPolling();
        }

        // Update events
        await this.loadEvents(runId);
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 2000); // Poll every 2 seconds
  }

  private clearEventPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'running':
        return 'text-yellow-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  }

  getEventTypeColor(type: string): string {
    if (type.includes('violation')) return 'text-red-400';
    if (type.includes('fault')) return 'text-yellow-400';
    if (type.includes('state')) return 'text-blue-400';
    return 'text-slate-400';
  }
}
