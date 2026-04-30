# Supabase Invoices Page

Minimal Next.js app with one page at `/invoices`.

## Setup

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/invoices`.

The page fetches `invoices` with related `suppliers` and `invoice_items` using Supabase:

```sql
invoices -> suppliers
invoices -> invoice_items
```
