# Paws WPP

A Next.js application built with TypeScript, Prisma, and PostgreSQL hosted on Vercel.

## Getting Started

1. **Environment Setup**
   - Add your Vercel Postgres database URLs to `.env`:
     ```
     POSTGRES_URL="your-postgres-url"
     PRISMA_DATABASE_URL="your-prisma-database-url" 
     DATABASE_URL="your-database-url"
     ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript  
- **Database**: PostgreSQL (Vercel Postgres)
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **Linting**: ESLint

## Project Structure

```
src/
├── app/           # Next.js App Router pages
├── components/    # Reusable UI components  
├── lib/           # Utility libraries (Prisma client, etc.)
├── types/         # TypeScript type definitions
├── hooks/         # Custom React hooks
└── utils/         # Helper functions
```

## Database Commands

- `npx prisma generate` - Generate Prisma client
- `npx prisma db push` - Push schema to database
- `npx prisma studio` - Open Prisma Studio
- `npx prisma migrate dev` - Create and apply migrations

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
