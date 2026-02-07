import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RunsStore } from '../../services/runs.store';
import { ApiService } from '../../services/api.service';
import type { Run } from '../../services/api.service';

declare global {
  interface Window {
    createUnityInstance: (canvas: HTMLCanvasElement, config: UnityConfig, progressCb: (progress: number) => void) => Promise<UnityInstance>;
    getBackendUrl?: () => void;
    onUnityReady?: () => void;
  }
}

interface UnityConfig {
  dataUrl: string;
  frameworkUrl: string;
  codeUrl: string;
}

interface UnityInstance {
  SendMessage: (objectName: string, methodName: string, value?: string) => void;
}

@Component({
  selector: 'app-unity-embed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unity-embed.html',
  styleUrl: './unity-embed.css',
})
export class UnityEmbed implements OnInit {
  store = inject(RunsStore);
  apiService = inject(ApiService);

  loading = signal(true);
  loadingProgress = signal(0);
  unityInstance: UnityInstance | null = null;
  isSimRunning = signal(false);
  private pendingBackendUrl = false;
  private pendingConfigSend = false;

  constructor() {
    // Watch selected run and send config to Unity
    effect(() => {
      const selectedRun = this.store.selectedRun();
      if (selectedRun && this.unityInstance) {
        this.sendConfigToUnity(selectedRun);
      }
    });
  }

  ngOnInit() {
    this.loadUnity();
  }

  private loadUnity() {
    // Register Unity bridge callbacks
    const getBackendUrl = () => {
      if (!this.unityInstance) {
        this.pendingBackendUrl = true;
        return;
      }
      this.sendBackendUrlToUnity();
    };

    const onUnityReady = () => {
      if (!this.unityInstance) {
        this.pendingConfigSend = true;
        return;
      }
      const selectedRun = this.store.selectedRun();
      if (selectedRun) {
        this.sendConfigToUnity(selectedRun);
      }
    };

    Object.assign(globalThis, { getBackendUrl, onUnityReady });
    window.getBackendUrl = getBackendUrl;
    window.onUnityReady = onUnityReady;

    // Load the Unity loader script
    const script = document.createElement('script');
    script.src = 'assets/unity-build/Build/build.loader.js';
    script.async = true;

    script.onload = () => {
      const canvas = document.getElementById('unity-canvas') as HTMLCanvasElement;
      if (!canvas) {
        console.error('[UnityEmbed] Canvas element not found');
        return;
      }

      const config: UnityConfig = {
        dataUrl: 'assets/unity-build/Build/build.data',
        frameworkUrl: 'assets/unity-build/Build/build.framework.js',
        codeUrl: 'assets/unity-build/Build/build.wasm'
      };

      window.createUnityInstance(canvas, config, (progress: number) => {
        this.loadingProgress.set(progress);
        console.log(`[UnityEmbed] Loading: ${(progress * 100).toFixed(0)}%`);
      }).then((unityInstance: UnityInstance) => {
        this.unityInstance = unityInstance;
        this.loading.set(false);
        console.log('[UnityEmbed] Unity loaded successfully');

        if (this.pendingBackendUrl) {
          this.sendBackendUrlToUnity();
          this.pendingBackendUrl = false;
        }

        if (this.pendingConfigSend) {
          const selectedRun = this.store.selectedRun();
          if (selectedRun) {
            this.sendConfigToUnity(selectedRun);
          }
          this.pendingConfigSend = false;
        }

        // Send current run config if available
        const selectedRun = this.store.selectedRun();
        if (selectedRun) {
          this.sendConfigToUnity(selectedRun);
        }
      }).catch((err: Error) => {
        console.error('[UnityEmbed] Failed to load Unity:', err);
        this.loading.set(false);
      });
    };

    script.onerror = () => {
      console.error('[UnityEmbed] Failed to load Unity loader script');
      this.loading.set(false);
    };

    document.body.appendChild(script);
  }

  private sendConfigToUnity(run: Run) {
    if (!this.unityInstance) {
      console.warn('[UnityEmbed] Unity instance not ready');
      return;
    }

    const config = {
      runId: run.id,
      taskSpec: run.taskSpec || {},
      faultProfile: run.faultProfile || {},
      autoStart: false
    };

    try {
      this.unityInstance.SendMessage('SimulationManager', 'LoadConfigFromJS', JSON.stringify(config));
      console.log('[UnityEmbed] Config sent to Unity:', config);
    } catch (err) {
      console.error('[UnityEmbed] Failed to send config to Unity:', err);
    }
  }

  private sendBackendUrlToUnity() {
    if (!this.unityInstance) {
      return;
    }
    const apiUrl = this.apiService.getApiUrl();
    try {
      this.unityInstance.SendMessage('EventEmitter', 'SetBackendUrl', apiUrl);
      console.log('[UnityEmbed] Backend URL sent to Unity:', apiUrl);
    } catch (err) {
      console.error('[UnityEmbed] Failed to send backend URL to Unity:', err);
    }
  }

  async startSimulation() {
    const run = this.store.selectedRun();
    if (!run) {
      alert('Please select a run first');
      return;
    }

    if (this.isSimRunning()) {
      alert('Simulation already running');
      return;
    }

    if (!this.unityInstance) {
      alert('Unity not loaded yet');
      return;
    }

    try {
      console.log('[UnityEmbed] Starting simulation for run:', run.id);

      // Tell Unity to start the simulation
      this.unityInstance.SendMessage('SimulationManager', 'StartRun', '');

      // Update backend status
      await this.apiService.startRun(run.id);
      this.isSimRunning.set(true);
      console.log('[UnityEmbed] Simulation started');
      this.apiService.refreshRunsList();
    } catch (err) {
      console.error('[UnityEmbed] Error starting simulation:', err);
      alert('Failed to start simulation');
    }
  }

  pauseSimulation() {
    console.log('[UnityEmbed] Pause simulation (not yet implemented)');
    this.isSimRunning.set(false);
  }

  resetSimulation() {
    console.log('[UnityEmbed] Reset simulation (not yet implemented)');
    this.isSimRunning.set(false);
  }
}
