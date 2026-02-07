export const schemas = {
  TaskSpec: {
    type: 'object',
    required: ['taskId', 'worldId', 'seed', 'startPose', 'goalPose', 'success'],
    properties: {
      taskId: { type: 'string', example: 'baseline_ok', description: 'Unique task identifier' },
      worldId: { type: 'string', example: 'world_1', description: 'World/environment ID' },
      seed: { type: 'number', example: 42, description: 'Random seed for determinism' },
      startPose: { $ref: '#/components/schemas/Pose' },
      goalPose: { $ref: '#/components/schemas/Pose' },
      constraints: {
        type: 'object',
        properties: {
          noGoZones: { type: 'array', items: { type: 'object' }, description: 'Forbidden areas' }
        }
      },
      success: {
        type: 'object',
        required: ['maxTimeSec', 'maxCollisions'],
        properties: {
          maxTimeSec: { type: 'number', example: 60, description: 'Max duration in seconds' },
          maxCollisions: { type: 'number', example: 0, description: 'Max allowed collisions' }
        }
      }
    }
  },
  Pose: {
    type: 'object',
    required: ['x', 'y', 'yaw'],
    properties: {
      x: { type: 'number', example: 0, description: 'X position' },
      y: { type: 'number', example: 0, description: 'Y position' },
      yaw: { type: 'number', example: 0, description: 'Rotation angle in radians' }
    }
  },
  FaultProfile: {
    type: 'object',
    required: ['profileId', 'faults'],
    properties: {
      profileId: { type: 'string', example: 'none', description: 'Profile identifier' },
      faults: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            atSec: { type: 'number', description: 'When to inject (seconds)' },
            type: {
              type: 'string',
              enum: ['sensor_dropout', 'latency_spike', 'wheel_slip'],
              description: 'Fault type'
            },
            durationSec: { type: 'number', description: 'Fault duration' },
            severity: { type: 'number', description: 'Severity level (0-1)' },
            target: { type: 'string', description: 'Target component' }
          }
        }
      }
    }
  },
  Run: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique run identifier' },
      userId: { type: 'string', nullable: true, description: 'Associated user ID' },
      taskSpec: { $ref: '#/components/schemas/TaskSpec' },
      faultProfile: { $ref: '#/components/schemas/FaultProfile' },
      status: {
        type: 'string',
        enum: ['pending', 'running', 'completed', 'failed'],
        description: 'Current execution status'
      },
      result: { type: 'object', nullable: true, description: 'Execution result data' },
      kpis: { type: 'object', nullable: true, description: 'Performance indicators' },
      startedAt: { type: 'string', format: 'date-time', nullable: true },
      endedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  },
  Event: {
    type: 'object',
    required: ['seq', 't', 'type', 'payload'],
    properties: {
      id: { type: 'number', description: 'Event record ID' },
      runId: { type: 'string', description: 'Associated run ID' },
      seq: { type: 'number', description: 'Monotonic sequence number' },
      t: { type: 'number', description: 'Time since run start (seconds)' },
      type: {
        type: 'string',
        enum: [
          'run.started',
          'state.pose',
          'planner.candidates',
          'decision.chosen',
          'fault.injected',
          'violation.collision',
          'violation.no_go_zone',
          'violation.timeout',
          'run.ended'
        ],
        description: 'Event type'
      },
      payload: {
        type: 'object',
        description: 'Event-specific data payload',
        additionalProperties: true
      },
      createdAt: { type: 'string', format: 'date-time' }
    }
  }
};
