import { Component, inject, input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, type RCAResult } from '../../services/api.service';

@Component({
  selector: 'app-rca-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rca-view.html',
  styleUrl: './rca-view.css',
})
export class RcaView {
  runId = input<string>();
  apiService = inject(ApiService);

  rca = signal<RCAResult | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.runId();
      if (id) {
        this.loadRCA(id);
      }
    });
  }

  private async loadRCA(runId: string) {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const result = await this.apiService.analyzeRun(runId);
      this.rca.set(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze run';
      this.error.set(message);
      console.error('RCA error:', err);
    } finally {
      this.isLoading.set(false);
    }
  }
}
