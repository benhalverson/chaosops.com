export const listEventsDoc = {
  summary: 'Get events for a run',
  description: 'Retrieve all recorded events for a specific simulation run',
  tags: ['Events'],
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
      description: 'Events list',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/Event' }
          }
        }
      }
    }
  }
};

export const recordEventsDoc = {
  summary: 'Record events for a run',
  description: 'Batch insert simulation events (state updates, faults, violations, etc)',
  tags: ['Events'],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Run ID (UUID)'
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          oneOf: [
            { $ref: '#/components/schemas/Event' },
            {
              type: 'array',
              items: { $ref: '#/components/schemas/Event' }
            }
          ]
        },
        example: [
          {
            seq: 1,
            t: 0.0,
            type: 'run.started',
            payload: { taskId: 'baseline_ok', seed: 42 }
          },
          {
            seq: 2,
            t: 0.1,
            type: 'state.pose',
            payload: { x: 0.1, y: 0, yaw: 0, v: 0.5 }
          },
          {
            seq: 3,
            t: 5.2,
            type: 'fault.injected',
            payload: { type: 'sensor_dropout', target: 'lidar', durationSec: 2.0 }
          }
        ]
      }
    }
  },
  responses: {
    '201': {
      description: 'Events recorded successfully',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/Event' }
          }
        }
      }
    }
  }
};
