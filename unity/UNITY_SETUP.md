# Unity WebGL Simulation Setup

## Prerequisites
- Unity Hub installed
- Unity 2022.3 LTS or later
- WebGL Build Support module installed

## Project Setup

### 1. Create New Unity Project
```bash
# In Unity Hub:
# - Click "New Project"
# - Select "2D (Core)" template
# - Name: "ChaosOpsSimulation"
# - Location: /home/ben/projects/chaosOpts/unity
```

### 2. Import Scripts
All C# scripts are already in `Assets/Scripts/`:
- `SimulationManager.cs` - Main orchestrator
- `RobotController.cs` - Robot movement & navigation
- `FaultInjector.cs` - Fault injection system
- `EventEmitter.cs` - Backend event streaming

### 3. Scene Setup

#### Create Main Scene
1. Create new scene: `Assets/Scenes/MainScene.unity`
2. Save and set as default scene

#### Add GameObjects
1. **SimulationManager** (Empty GameObject)
   - Add Component: `SimulationManager`
   - Add Component: `FaultInjector`
   - Add Component: `EventEmitter`

2. **Robot** (2D Sprite GameObject)
   - Add Sprite: Simple square or circle
   - Add Component: `Rigidbody2D`
     - Body Type: Dynamic
     - Gravity Scale: 0
     - Linear Drag: 2
     - Angular Drag: 5
   - Add Component: `CircleCollider2D` or `BoxCollider2D`
   - Add Component: `RobotController`
   - Set initial position: (0, 0, 0)

3. **Environment**
   - Create "Obstacles" empty GameObject
   - Add child sprites with `BoxCollider2D` for walls
   - Simple corridor layout (L-shaped or straight)

4. **No-Go Zones** (Optional)
   - Create sprites with `BoxCollider2D`
   - Set as Trigger: ✓
   - Tag: "NoGoZone"

5. **Goal Indicator** (Visual only)
   - Small sprite to show goal position
   - No collider needed

### 4. Configure WebGL Build Settings

#### Player Settings
1. **File → Build Settings**
2. Select "WebGL" platform
3. Click "Switch Platform"
4. Click "Player Settings"

#### WebGL Template
1. **Resolution and Presentation**
   - WebGL Template: Default or Minimal
   - Default Canvas Width: 1280
   - Default Canvas Height: 720

#### Publishing Settings
1. **Publishing Settings**
   - Compression Format: Gzip or Brotli
   - Enable Exceptions: Explicitly Thrown Exceptions Only
   - Data Caching: ✓

#### Other Settings
1. **Other Settings**
   - Scripting Backend: IL2CPP
   - API Compatibility Level: .NET Standard 2.1
   - Managed Stripping Level: Medium

### 5. Build WebGL

```bash
# In Unity Editor:
# 1. File → Build Settings
# 2. Add "MainScene" to Scenes In Build
# 3. Platform: WebGL
# 4. Click "Build"
# 5. Output folder: /home/ben/projects/chaosOpts/unity/Build
```

### 6. Test Locally

```bash
# Serve the build folder
cd /home/ben/projects/chaosOpts/unity/Build
python3 -m http.server 8080

# Open browser: http://localhost:8080
```

## Integration with Angular

### Angular Component
```typescript
// In Angular app.component.ts
declare global {
  interface Window {
    unityInstance: any;
  }
}

function onUnityReady() {
  console.log('Unity is ready');
  
  // Send config to Unity
  const config = {
    runId: 'run-123',
    taskSpec: {
      taskId: 'task-1',
      worldId: 'world-1',
      seed: 42,
      startPose: { x: 0, y: 0, yaw: 0 },
      goalPose: { x: 10, y: 10, yaw: 0 },
      constraints: { noGoZones: [] },
      success: { maxTimeSec: 60, maxCollisions: 0 }
    },
    faultProfile: {
      profileId: 'profile-1',
      faults: [
        { atSec: 5, type: 'wheel_slip', durationSec: 3, severity: 0.5, target: 'robot' }
      ]
    },
    autoStart: true
  };
  
  window.unityInstance.SendMessage('SimulationManager', 'LoadConfigFromJS', JSON.stringify(config));
}

function getBackendUrl() {
  window.unityInstance.SendMessage('EventEmitter', 'SetBackendUrl', 'http://localhost:3000');
}

// Expose to window for Unity
window.onUnityReady = onUnityReady;
window.getBackendUrl = getBackendUrl;
```

### Embed Unity in Angular
```html
<!-- In Angular template -->
<iframe 
  [src]="unityBuildUrl" 
  width="1280" 
  height="720"
  frameborder="0">
</iframe>
```

## Testing Checklist

- [ ] Unity builds without errors
- [ ] WebGL loads in browser
- [ ] Robot appears at start position
- [ ] Robot navigates toward goal
- [ ] Collisions are detected
- [ ] Faults are applied at correct times
- [ ] Events are sent to backend
- [ ] Deterministic (same seed → same result)
- [ ] JavaScript bridge works (config loading)

## Debugging

### Enable Debug Mode
In Unity Editor: Window → Analysis → Console
Check "Error Pause" for immediate debugging

### Browser Console
Check browser console for:
- Unity loader messages
- Event emission logs
- JavaScript bridge calls

### Network Tab
Monitor POST requests to `http://localhost:3000/api/runs/{id}/events`

## Performance Tips

1. **Keep Build Small (<50MB)**
   - Use texture compression
   - Remove unused assets
   - Enable code stripping

2. **Optimize Physics**
   - Fixed timestep: 0.02s (50 FPS)
   - Limit collision checks
   - Use simple colliders

3. **Batch Events**
   - EventEmitter batches by default
   - Adjust `batchSize` and `batchIntervalSeconds` if needed

## Next Steps

1. Test deterministic behavior (same seed = same result)
2. Add more fault types
3. Implement A* pathfinding (optional)
4. Add visual feedback (trails, collision effects)
5. Create 2-3 predefined TaskSpecs for demo
