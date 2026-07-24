/** OpenAPI 3.0 spec for Analytic Pulse Public API (/api/v1) */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Analytic Pulse Public API',
    version: '1.0.0',
    description:
      'REST API versionada. Autentique com `Authorization: Bearer ap_pk_...` (ou header `X-Api-Key`). Crie chaves no dashboard em /api-keys. JWT do dashboard gerencia as chaves em `/api/api-keys`.',
  },
  servers: [{ url: '/api/v1', description: 'Public API v1' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'ap_pk_',
        description: 'API key criada em /api-keys',
      },
      ApiKeyHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Key',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
        },
      },
      Monitor: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          url: { type: 'string' },
          check_type: { type: 'string' },
          status: { type: 'string' },
        },
      },
      CreateMonitor: {
        type: 'object',
        required: ['name', 'url'],
        properties: {
          name: { type: 'string' },
          url: { type: 'string' },
          check_type: {
            type: 'string',
            enum: ['http', 'https', 'tcp', 'port', 'ping', 'dns', 'ssl', 'browser'],
          },
          interval_minutes: { type: 'integer' },
          method: { type: 'string' },
          host: { type: 'string' },
          port: { type: 'integer' },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }, { ApiKeyHeader: [] }],
  paths: {
    '/monitors': {
      get: {
        summary: 'List monitors',
        tags: ['Monitors'],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Monitor' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create monitor',
        tags: ['Monitors'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateMonitor' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Monitor' },
              },
            },
          },
        },
      },
    },
    '/monitors/{id}': {
      get: {
        summary: 'Get monitor',
        tags: ['Monitors'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
      },
      patch: {
        summary: 'Update monitor',
        tags: ['Monitors'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        summary: 'Delete monitor',
        tags: ['Monitors'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '204': { description: 'Deleted' } },
      },
    },
    '/monitors/{id}/metrics': {
      get: {
        summary: 'Monitor metrics and recent logs',
        tags: ['Monitors'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/incidents': {
      get: {
        summary: 'List incidents',
        tags: ['Incidents'],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['active', 'all', 'open', 'acknowledged', 'investigating', 'resolved'],
              default: 'active',
            },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/incidents/{id}': {
      get: {
        summary: 'Incident detail',
        tags: ['Incidents'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/dashboard/overview': {
      get: {
        summary: 'Dashboard overview',
        tags: ['Overview'],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/analytics/overview': {
      get: {
        summary: 'Analytics overview',
        tags: ['Overview'],
        parameters: [
          {
            name: 'range',
            in: 'query',
            schema: { type: 'string', enum: ['24h', '7d', '30d'] },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ssl/overview': {
      get: {
        summary: 'SSL overview',
        tags: ['Overview'],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/dns/overview': {
      get: {
        summary: 'DNS overview',
        tags: ['Overview'],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/map/overview': {
      get: {
        summary: 'World map overview',
        tags: ['Overview'],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/agents': {
      get: {
        summary: 'List Linux agents',
        tags: ['Agents'],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/agents/{id}': {
      get: {
        summary: 'Agent detail',
        tags: ['Agents'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/docker/overview': {
      get: {
        summary: 'Docker overview',
        tags: ['Infrastructure'],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/kubernetes/overview': {
      get: {
        summary: 'Kubernetes overview',
        tags: ['Infrastructure'],
        responses: { '200': { description: 'OK' } },
      },
    },
  },
} as const;
