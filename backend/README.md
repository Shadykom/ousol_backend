# Osoul Collection Reporting System - Backend

## Overview

This is the backend API for the Osoul Collection Reporting System, providing comprehensive collection management, reporting, and customizable dashboards for the collection department.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Collection Management**: CRUD operations for collection transactions
- **Branch Management**: Manage multiple branches and their performance
- **Comprehensive Reporting**: 
  - Monthly and quarterly comparisons
  - Branch-to-branch comparisons
  - Performance trends analysis
  - Top performers identification
- **Customizable Dashboards**: User-driven dashboard creation with drag-and-drop widgets
- **Target Management**: Set and track collection targets per branch

## Tech Stack

- Node.js with Express.js
- PostgreSQL database
- JWT for authentication
- Winston for logging
- Express-validator for input validation

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or pnpm

## Installation

1. Clone the repository and navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your database credentials and other configurations:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/osoul_reporting
JWT_SECRET=your_secure_jwt_secret
```

4. Create the database:
```bash
createdb osoul_reporting
```

5. Run database migrations:
```bash
npm run db:migrate
```

6. Seed the database with sample data:
```bash
npm run db:seed
```

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/password` - Update password

### Branches
- `GET /api/v1/branches` - List all branches
- `GET /api/v1/branches/:id` - Get branch details
- `POST /api/v1/branches` - Create new branch (admin/manager)
- `PUT /api/v1/branches/:id` - Update branch (admin/manager)
- `DELETE /api/v1/branches/:id` - Delete branch (admin)
- `GET /api/v1/branches/:id/stats` - Get branch statistics

### Collections
- `GET /api/v1/collections` - List transactions with filters
- `GET /api/v1/collections/:id` - Get transaction details
- `POST /api/v1/collections` - Create new transaction
- `PUT /api/v1/collections/:id` - Update transaction
- `DELETE /api/v1/collections/:id` - Delete transaction
- `GET /api/v1/collections/targets/:branchId` - Get collection targets
- `POST /api/v1/collections/targets` - Set collection target

### Reports
- `GET /api/v1/reports/monthly-comparison` - Monthly comparison report
- `GET /api/v1/reports/quarterly-comparison` - Quarterly comparison report
- `GET /api/v1/reports/branch-comparison` - Branch comparison report
- `GET /api/v1/reports/performance-trends` - Performance trends
- `GET /api/v1/reports/top-performers` - Top performers report
- `GET /api/v1/reports/summary` - Summary statistics
- `GET /api/v1/reports/export` - Export report data

### Dashboards
- `GET /api/v1/dashboards` - List user dashboards
- `GET /api/v1/dashboards/:id` - Get dashboard with widgets
- `POST /api/v1/dashboards` - Create new dashboard
- `PUT /api/v1/dashboards/:id` - Update dashboard
- `DELETE /api/v1/dashboards/:id` - Delete dashboard
- `POST /api/v1/dashboards/:id/widgets` - Add widget to dashboard
- `PUT /api/v1/dashboards/:id/widgets/:widgetId` - Update widget
- `DELETE /api/v1/dashboards/:id/widgets/:widgetId` - Delete widget
- `GET /api/v1/dashboards/widgets/:widgetId/data` - Get widget data

## Default Users

After seeding, the following users are available:

| Email | Password | Role |
|-------|----------|------|
| admin@osoul.com | password123 | Admin |
| manager@osoul.com | password123 | Manager |
| collector1@osoul.com | password123 | Collector |
| viewer@osoul.com | password123 | Viewer |

## User Roles

- **Admin**: Full system access, can manage users, branches, and all data
- **Manager**: Can manage branches, view reports, and manage collections
- **Collector**: Can create and manage collection transactions
- **Viewer**: Read-only access to reports and dashboards

## Database Schema

The system uses the following main tables:
- `users` - System users with roles
- `branches` - Branch information
- `collection_transactions` - Collection transaction records
- `collection_targets` - Monthly collection targets per branch
- `user_dashboards` - User-created dashboards
- `dashboard_widgets` - Widgets within dashboards

## Development

### Project Structure
```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Express middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── utils/          # Utility functions
│   └── server.js       # Main server file
├── database/
│   ├── schema.sql      # Database schema
│   ├── migrate.js      # Migration script
│   └── seed.js         # Seed data script
└── package.json
```

### Adding New Features

1. Create new route file in `src/routes/`
2. Create corresponding controller in `src/controllers/`
3. Add route to `src/server.js`
4. Update database schema if needed
5. Add API documentation

## Testing

Run the health check endpoint:
```bash
curl http://localhost:5000/health
```

## Deployment

1. Set production environment variables
2. Ensure PostgreSQL is accessible
3. Run migrations on production database
4. Use PM2 or similar for process management:
```bash
pm2 start src/server.js --name osoul-api
```

## Security Considerations

- All passwords are hashed using bcrypt
- JWT tokens expire after 7 days
- Rate limiting is implemented (100 requests per 15 minutes)
- Input validation on all endpoints
- SQL injection protection through parameterized queries

## Support

For issues or questions, please contact the development team.