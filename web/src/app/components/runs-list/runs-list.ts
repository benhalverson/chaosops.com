import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RunsStore } from '../../services/runs.store';

@Component({
  selector: 'app-runs-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './runs-list.html',
  styleUrl: './runs-list.css',
})
export class RunsList {
  store = inject(RunsStore);

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'running':
        return 'bg-yellow-900 text-yellow-200';
      case 'completed':
        return 'bg-green-900 text-green-200';
      case 'failed':
        return 'bg-red-900 text-red-200';
      default:
        return 'bg-slate-700 text-slate-200';
    }
  }
}
