export const listRunsDoc = {
  summary: 'List all simulation runs',
  description: 'Retrieve all simulation runs with their configurations and status',
  tags: ['Runs'],
  responses: {
    '200': {
      description: 'List of all runs',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Run'
            }
          }
        }
      }
    }
  }
};

export const createRunDoc = {
  summary: 'Create a new simulation run',
  description: 'Create a new simulation run with task specification and fault profile',
  tags: ['Runs'],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['taskSpec', 'faultProfile'],
          properties: {
            taskSpec: { $ref: '#/components/schemas/TaskSpec' },
            faultProfile: { $ref: '#/components/schemas/FaultProfile' }
          }
        },
        example: {
          taskSpec: {
            taskId: 'baseline_ok',
            worldId: 'world_1',
            seed: 42,
            startPose: { x: 0, y: 0, yaw: 0 },
            goalPose: { x: 10, y: 10, yaw: 0 },
            constraints: {},
            success: { maxTimeSec: 60, maxCollisions: 0 }
          },
          faultProfile: {
            profileId: 'none',
            faults: []
          }
        }
      }
    }
  },
  responses: {
    '201': {
      description: 'Run created successfully',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Run' }
        }
      }
    }
  }
};

export const getRunDoc = {
  summary: 'Get run details',
  description: 'Retrieve detailed information about a specific run',
  tags: ['Runs'],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Run ID (UUID)'
    }
  ],
  responses: {
    '200': {
      description: 'Run details',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Run' }
        }
      }
    },
    '404': {
      description: 'Run not found'
    }
  }
};

export const startRunDoc = {
  summary: 'Start a simulation run',
  description: 'Begin execution of a pending simulation run',
  tags: ['Runs'],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Run ID (UUID)'
    }
  ],
  responses: {
    '200': {
      description: 'Run started',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Run' }
        }
      }
    },
    '404': {
      description: 'Run not found'
    }
  }
};

export const stopRunDoc = {
  summary: 'Stop a simulation run',
  description: 'Halt execution of an active simulation run',
  tags: ['Runs'],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Run ID (UUID)'
    }
  ],
  responses: {
    '200': {
      description: 'Run stopped',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Run' }
        }
      }
    },
    '404': {
      description: 'Run not found'
    }
  }
};
