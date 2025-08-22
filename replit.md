# Hald AI - Email Marketing Platform

## Overview

Hald AI is a comprehensive email marketing platform that combines artificial intelligence with enterprise-grade email delivery. The application allows users to upload contact lists, generate AI-powered email content, and send bulk email campaigns with analytics tracking. Built with React on the frontend and Express on the backend, the platform provides a modern, responsive interface for email marketing automation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for client-side navigation
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Authentication**: Firebase Authentication with Google OAuth

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database**: PostgreSQL with Drizzle ORM for type-safe database interactions
- **Authentication**: Firebase Admin SDK for token verification
- **Email Services**: Mock email service (designed for production integration with SendGrid, Mailgun, etc.)
- **File Processing**: Multer for CSV file uploads with CSV parsing capabilities

### Data Storage Solutions
- **Primary Database**: PostgreSQL using Neon serverless database
- **ORM**: Drizzle ORM with schema definitions in TypeScript
- **Schema Design**: 
  - Users table with Firebase UID integration
  - Email lists with JSON storage for contact data
  - Campaigns with status tracking and analytics
  - Email templates for reusable content

### Authentication and Authorization
- **Client-side**: Firebase Authentication with Google OAuth provider
- **Server-side**: Firebase Admin SDK for token verification
- **Session Management**: JWT tokens from Firebase with automatic refresh
- **User Flow**: OAuth redirect flow with backend user creation/verification

### External Dependencies
- **Database**: Neon PostgreSQL serverless database
- **Authentication**: Firebase (Authentication and Admin SDK)
- **AI Content Generation**: Groq API for email content generation using Mixtral model
- **Email Delivery**: Designed for integration with SendGrid, Mailgun, or similar services
- **File Processing**: CSV parsing for contact list uploads
- **UI Framework**: Radix UI primitives with Shadcn/ui components
- **Development Tools**: Replit-specific plugins for development environment integration

The architecture follows a clean separation of concerns with shared schema definitions between frontend and backend, enabling type safety across the full stack. The platform is designed for scalability with serverless database solutions and modular service integrations.