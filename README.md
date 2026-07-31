# Manthan Parent Portal

A modern, full-featured parent engagement portal for schools built with Next.js 16 and TypeScript. Designed to streamline communication and transparency between parents, teachers, and school staff.

## Features

### For Parents
- **Attendance Tracking** – Real-time view of child's daily attendance with visual calendar
- **Academic Results** – Access to exam results and academic progress
- **Leave Management** – Submit and track leave requests for children
- **Stay-Back Requests** – Request late pickup with approval workflow
- **Parent-Teacher Meetings (PTM)** – Schedule and manage PTM sessions
- **Payments** – View and manage school fees and payments
- **Gallery** – Access photos and media from school events
- **Messages** – Receive notifications and communications from school staff
- **Notifications** – Multi-channel alerts via push notifications, SMS, and WhatsApp

### For Staff
- **Attendance Management** – Mark and track student attendance with QR code support
- **DTR (Daily Time Record)** – Monitor and manage student daily presence
- **Leave Approvals** – Review and approve student leave requests
- **Stay-Back Approvals** – Manage late pickup requests
- **PTM Scheduling** – Create and manage parent-teacher meeting slots
- **Defaulter Tracking** – Identify and track absent students
- **Messaging** – Send targeted notifications to parents
- **QR Code Generation** – Generate QR codes for quick attendance marking

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: TailwindCSS 4
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Cloud Storage**: Firebase Cloud Storage
- **Notifications**: WhatsApp, SMS, and Push Notifications
- **E2E Testing**: Playwright

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Supabase project (database and auth)
- Firebase project (for cloud storage)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd manthan-parent-portal
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (create `.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-firebase-project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-firebase-storage-bucket>
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── (parent)/          # Parent-facing routes
│   ├── (staff)/           # Staff console routes
│   └── page.tsx           # Root page
├── components/            # React components
├── lib/                   # Utility functions and services
│   ├── supabase/         # Supabase client and database types
│   ├── firebase/         # Firebase storage utilities
│   ├── notifications/    # WhatsApp, SMS, push notification services
│   ├── alerts.ts         # Alert generation logic
│   ├── calendar.ts       # Calendar utilities
│   └── session.ts        # Session management
└── middleware.ts          # Next.js middleware
```

## Available Scripts

- `npm run dev` – Start development server
- `npm run build` – Build for production
- `npm start` – Start production server
- `npm run lint` – Run ESLint

## Authentication & Authorization

The portal uses Supabase Auth with role-based access control:
- **Parents**: Can only access their child's information and their own features
- **Staff**: Have full administrative access to school-wide data and management tools

## Development Notes

This project uses Next.js 16 with some breaking changes from earlier versions. Always refer to the guides in `node_modules/next/dist/docs/` when implementing new features.

## Contributing

Contributions are welcome! Please ensure:
- Code follows the ESLint configuration
- TypeScript types are properly defined
- Components are properly documented
- Tests are included for new features

## License

Proprietary - All rights reserved

## Support

For issues and feature requests, please contact the development team.
