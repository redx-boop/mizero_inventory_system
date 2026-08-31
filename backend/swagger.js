/**
 * Swagger/OpenAPI Documentation Configuration
 *
 * Run the server and visit /api/docs to view the interactive API documentation.
 *
 * To enable, uncomment the swagger setup in server.js:
 *   const swaggerUi = require('swagger-ui-express');
 *   const swaggerSpec = require('./swagger');
 *   app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mizero Inventory Hub API',
      version: '1.0.0',
      description: `
        School inventory and asset management system.
        
        **System Type:** School Inventory / Asset Tracking
        **Roles:** super_admin, admin, stock_manager, staff
        **Auth:** JWT Bearer Token + CSRF Token
        
        ## Financial Logic
        - AVCO (Weighted Average Cost) for inventory valuation
        - No selling price, no POS, no customers
        - Damage liability: 50% of replacement cost
        - Loss liability: 100% of replacement cost
      `,
      contact: {
        name: 'Mizero Inventory Hub',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from POST /api/auth/login',
        },
        CsrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: 'CSRF token obtained from GET /api/csrf-token. Required for all state-changing requests (POST, PUT, PATCH, DELETE).',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Error message' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', description: 'Current page number' },
            limit: { type: 'integer', description: 'Items per page' },
            total: { type: 'integer', description: 'Total items' },
            pages: { type: 'integer', description: 'Total pages' },
          },
        },
        Item: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            sku: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            unit: { type: 'string' },
            quantity: { type: 'integer' },
            minimum_stock: { type: 'integer' },
            unit_cost: { type: 'number' },
            currency: { type: 'string', enum: ['RWF', 'USD', 'EUR'] },
            item_type: { type: 'string', enum: ['consumable', 'non-consumable'] },
            department_id: { type: 'integer' },
            created_by: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        StockIn: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            item_id: { type: 'integer' },
            quantity: { type: 'integer' },
            unit_price: { type: 'number' },
            supplier: { type: 'string' },
            reference_number: { type: 'string' },
            notes: { type: 'string' },
            date: { type: 'string', format: 'date' },
            created_by: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        StockOut: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            item_id: { type: 'integer' },
            quantity: { type: 'integer' },
            unit_cost_at_time: { type: 'number' },
            recipient: { type: 'string' },
            department: { type: 'string' },
            reason: { type: 'string' },
            date: { type: 'string', format: 'date' },
          },
        },
      },
    },
    security: [
      { BearerAuth: [] },
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          security: [],
          responses: {
            200: {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/csrf-token': {
        get: {
          tags: ['Auth'],
          summary: 'Get CSRF token',
          description: 'Returns a CSRF token and sets a httpOnly cookie. Required before making state-changing requests.',
          security: [],
          responses: {
            200: {
              description: 'CSRF token generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      csrfToken: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login',
          description: 'Authenticate user and return JWT token.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email', example: 'admin@mizero.com' },
                    password: { type: 'string', format: 'password', example: 'password123' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      token: { type: 'string' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          full_name: { type: 'string' },
                          email: { type: 'string' },
                          role: { type: 'string' },
                          role_id: { type: 'integer' },
                          department_id: { type: 'integer' },
                          department_ids: { type: 'array', items: { type: 'integer' } },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Invalid credentials',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user',
          responses: {
            200: { description: 'Current user data' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/api/items': {
        get: {
          tags: ['Items'],
          summary: 'List inventory items',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by name, SKU, or category' },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'department_id', in: 'query', schema: { type: 'integer' } },
            { name: 'item_type', in: 'query', schema: { type: 'string', enum: ['consumable', 'non-consumable'] } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: {
            200: {
              description: 'Paginated items list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Items'],
          summary: 'Create a new item',
          security: [{ BearerAuth: [], CsrfToken: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    unit: { type: 'string', default: 'pcs' },
                    quantity: { type: 'integer', default: 0 },
                    minimum_stock: { type: 'integer', default: 0 },
                    unit_cost: { type: 'number', default: 0 },
                    currency: { type: 'string', default: 'RWF' },
                    item_type: { type: 'string', enum: ['consumable', 'non-consumable'], default: 'consumable' },
                    department_id: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Item created' },
            400: { description: 'Validation error' },
          },
        },
      },
      '/api/stock-in': {
        get: {
          tags: ['Stock In'],
          summary: 'List stock-in records',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Paginated stock-in records' } },
        },
        post: {
          tags: ['Stock In'],
          summary: 'Record stock-in (add inventory)',
          description: 'Increases item quantity and recalculates AVCO unit cost.',
          security: [{ BearerAuth: [], CsrfToken: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['item_id', 'quantity', 'unit_price'],
                  properties: {
                    item_id: { type: 'integer' },
                    quantity: { type: 'integer', minimum: 1 },
                    unit_price: { type: 'number', minimum: 0 },
                    supplier: { type: 'string' },
                    reference_number: { type: 'string' },
                    notes: { type: 'string' },
                    date: { type: 'string', format: 'date' },
                    department_id: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Stock-in recorded, AVCO recalculated' },
            400: { description: 'Validation error' },
          },
        },
      },
      '/api/stock-out': {
        get: {
          tags: ['Stock Out'],
          summary: 'List stock-out records',
          responses: { 200: { description: 'Paginated stock-out records' } },
        },
        post: {
          tags: ['Stock Out'],
          summary: 'Record stock-out (issue inventory)',
          description: 'Decreases item quantity. Captures COGS snapshot at current unit cost.',
          security: [{ BearerAuth: [], CsrfToken: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['item_id', 'quantity', 'recipient'],
                  properties: {
                    item_id: { type: 'integer' },
                    quantity: { type: 'integer', minimum: 1 },
                    recipient: { type: 'string' },
                    department: { type: 'string' },
                    reason: { type: 'string' },
                    date: { type: 'string', format: 'date' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Stock-out recorded' },
            400: { description: 'Validation error or insufficient stock' },
          },
        },
      },
      '/api/borrowings': {
        get: {
          tags: ['Borrowings'],
          summary: 'List borrowings',
          responses: { 200: { description: 'Paginated borrowings list' } },
        },
        post: {
          tags: ['Borrowings'],
          summary: 'Record a borrowing',
          security: [{ BearerAuth: [], CsrfToken: [] }],
          responses: { 201: { description: 'Borrowing recorded' } },
        },
      },
      '/api/damage-liabilities': {
        get: {
          tags: ['Liabilities'],
          summary: 'List damage/loss liabilities',
          responses: { 200: { description: 'Paginated liabilities list' } },
        },
        post: {
          tags: ['Liabilities'],
          summary: 'Create liability (damage or loss)',
          description: 'Damage: 50% of replacement cost. Loss: 100% of replacement cost.',
          security: [{ BearerAuth: [], CsrfToken: [] }],
          responses: { 201: { description: 'Liability created' } },
        },
      },
      '/api/damage-liabilities/{id}/payment': {
        post: {
          tags: ['Liabilities'],
          summary: 'Record a payment toward a liability',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          security: [{ BearerAuth: [], CsrfToken: [] }],
          responses: { 200: { description: 'Payment recorded' } },
        },
      },
      '/api/budgets': {
        get: {
          tags: ['Budget'],
          summary: 'List budgets with usage',
          responses: { 200: { description: 'Budgets list with remaining calculations' } },
        },
        post: {
          tags: ['Budget'],
          summary: 'Create a budget',
          security: [{ BearerAuth: [], CsrfToken: [] }],
          responses: { 201: { description: 'Budget created' } },
        },
      },
      '/api/budgets/summary': {
        get: {
          tags: ['Budget'],
          summary: 'Get budget summary',
          responses: { 200: { description: 'Budget summary with totals and usage %' } },
        },
      },
      '/api/departments': {
        get: {
          tags: ['Departments'],
          summary: 'List departments',
          responses: { 200: { description: 'Departments list' } },
        },
      },
      '/api/users': {
        get: {
          tags: ['Users'],
          summary: 'List users (admin/super_admin only)',
          responses: { 200: { description: 'Paginated users list' } },
        },
        post: {
          tags: ['Users'],
          summary: 'Create user (admin/super_admin only)',
          security: [{ BearerAuth: [], CsrfToken: [] }],
          responses: { 201: { description: 'User created' } },
        },
      },
      '/api/reports/stock-in': {
        get: {
          tags: ['Reports'],
          summary: 'Stock-in report',
          responses: { 200: { description: 'Stock-in report with summary' } },
        },
      },
      '/api/reports/stock-out': {
        get: {
          tags: ['Reports'],
          summary: 'Stock-out report',
          responses: { 200: { description: 'Stock-out report with COGS' } },
        },
      },
      '/api/reports/inventory-status': {
        get: {
          tags: ['Reports'],
          summary: 'Inventory status report',
          responses: { 200: { description: 'Full inventory status' } },
        },
      },
      '/api/dashboard': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get dashboard summary data',
          responses: { 200: { description: 'Dashboard with KPIs, charts, and metrics' } },
        },
      },
      '/api/activity-logs': {
        get: {
          tags: ['System'],
          summary: 'Get activity logs',
          responses: { 200: { description: 'Paginated activity logs' } },
        },
      },
      '/api/notifications': {
        get: {
          tags: ['System'],
          summary: 'Get notifications',
          responses: { 200: { description: 'User notifications' } },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
