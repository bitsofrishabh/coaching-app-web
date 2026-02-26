# DietTracker Pro Platform - PRD

## Original Problem Statement
Build DietTracker Pro Platform - a unified platform for dietitians/coaches to manage clients, create and update diet plans, track adherence and revenue. Coach Web App MVP focusing on beautiful UI for dietitians.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT-based custom authentication
- **File Storage**: S3-compatible (Emergent Object Storage)
- **Styling**: Dark theme with Lime green (#84cc16) accent, Manrope + Inter fonts

## User Personas
1. **Coach/Dietitian**: Primary user who manages clients, creates diet plans, tracks progress and finances
2. **Admin**: Future role for team management and settings

## Core Requirements (Static)
1. Client Management (CRUD, search, filter, status tracking)
2. Weight/Progress Tracking with charts
3. Diet Plan Builder
4. Finance Tracker (income/expense/net)
5. Follow-ups scheduling
6. JWT Authentication

## What's Been Implemented
### Jan 25, 2026 - MVP Release
- ✅ Complete JWT authentication (register/login)
- ✅ Dashboard with stats cards and weekly revenue chart
- ✅ Client Management (add, edit, delete, search, filter by status)
- ✅ Client Detail Page with tabs (Progress, Diet Plans, Info)
- ✅ Weight Tracking with line chart visualization
- ✅ Diet Plans creation and management
- ✅ Follow-ups scheduling and completion tracking
- ✅ Finance Tracker (income, expense, summary with net profit)
- ✅ Settings page with user profile
- ✅ Beautiful dark UI with lime green accents
- ✅ Responsive sidebar navigation
- ✅ Toast notifications

### Feb 26, 2026 - Mobile Client API Release
- ✅ Client registration with invite code system
- ✅ Client login/authentication flow
- ✅ Client dashboard API (today's status, progress, streak)
- ✅ Daily check-in system (meal tracking, water, mood)
- ✅ Weight logging from mobile
- ✅ Meal photo upload to S3
- ✅ Chat system (client-coach messaging)
- ✅ Coach invite code generation
- ✅ Coach chat inbox with unread counts
- ✅ Coach meal upload review system

## API Endpoints
- `/api/auth/*` - Authentication
- `/api/clients/*` - Client management
- `/api/clients/:id/weights` - Weight entries
- `/api/diet-plans/*` - Diet plan CRUD
- `/api/follow-ups/*` - Follow-up scheduling
- `/api/transactions/*` - Finance tracking
- `/api/dashboard/*` - Dashboard stats
- `/api/upload`, `/api/files/*` - File management

## Prioritized Backlog

### P0 (Critical)
- None currently (MVP complete)

### P1 (High Priority)
- Client mobile app APIs
- Meal photo uploads with S3
- Diet plan PDF export
- Bulk weight import

### P2 (Medium Priority)
- Real-time chat (WebSockets)
- Team management
- AI insights integration
- Report generation

### P3 (Future)
- Blood report analysis
- Subscription/payment management
- Multi-coach support
- Analytics dashboard

## Next Tasks
1. Add seed data for demo
2. Implement meal photo upload with S3
3. Add diet plan PDF export
4. Build mobile-ready client APIs
