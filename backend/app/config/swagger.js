const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Web Gallery API',
      version: '1.0.0',
      description: 'API for Web Gallery application - secure photo sharing platform',
      contact: {
        name: 'Lenny Louis',
        email: 'lenny@example.com'
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Album: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            date: { type: 'string', format: 'date', nullable: true },
            tags: { type: 'array', items: { type: 'string' }, nullable: true },
            location: { type: 'string', nullable: true },
            is_public: { type: 'boolean' },
            owner_id: { type: 'string', format: 'uuid' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            photo_count: { type: 'integer', nullable: true }
          }
        },
        Photo: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            filename: { type: 'string' },
            original_name: { type: 'string' },
            file_path: { type: 'string' },
            preview_path: { type: 'string' },
            file_size: { type: 'integer' },
            mime_type: { type: 'string' },
            width: { type: 'integer' },
            height: { type: 'integer' },
            album_id: { type: 'string', format: 'uuid' },
            uploaded_at: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        AccessLink: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            token: { type: 'string' },
            album_id: { type: 'string', format: 'uuid' },
            created_by: { type: 'string', format: 'uuid' },
            expires_at: { type: 'string', format: 'date-time', nullable: true },
            max_uses: { type: 'integer', nullable: true },
            used_count: { type: 'integer' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        CreateAlbum: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            date: { type: 'string', format: 'date' },
            tags: { type: 'array', items: { type: 'string' } },
            location: { type: 'string' },
            is_public: { type: 'boolean', default: false }
          }
        },
        CreateAccessLink: {
          type: 'object',
          required: ['album_id'],
          properties: {
            album_id: { type: 'string', format: 'uuid' },
            expires_at: { type: 'string', format: 'date-time' },
            max_uses: { type: 'integer' }
          }
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ]
  },
  apis: [
    './app/routes/*.js',
    './app/controllers/*.js',
    './app/models/*.js'
  ],
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
  swaggerUiOptions: {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Web Gallery API Documentation'
  }
};