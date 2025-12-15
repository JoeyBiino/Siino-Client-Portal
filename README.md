# Siino Client Portal

A web-based client portal for viewing projects and invoices.

## Features

- **Simple Login**: Clients enter their portal code (no email/password required)
- **Dashboard**: Overview of projects and invoices with quick stats
- **Projects**: View all projects shared with the client
- **Invoices**: View invoices, filter by status, see payment summary
- **PDF Download**: Print or download invoices as PDF
- **Responsive**: Works on desktop and mobile devices
- **Dark Mode**: Automatic dark mode support

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production

```bash
npm run build
```

## Deployment to Cloudflare Pages

### Option A: Via Cloudflare Dashboard

1. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
2. Click "Create a project"
3. Connect your Git repository (push this code to GitHub first)
4. Configure build settings:
   - **Framework preset**: Next.js
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
5. Click "Save and Deploy"

### Option B: Via Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
npx @cloudflare/next-on-pages
wrangler pages deploy .vercel/output/static
```

## Project Structure

```
client-portal/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Login page
│   └── dashboard/
│       ├── layout.tsx       # Dashboard layout with nav
│       ├── page.tsx         # Dashboard home
│       ├── projects/
│       │   └── page.tsx     # Projects list
│       └── invoices/
│           ├── page.tsx     # Invoices list
│           └── [id]/
│               └── page.tsx # Invoice detail
├── lib/
│   └── api.ts               # API client & utilities
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## API Endpoints Used

The portal connects to your Supabase Edge Functions:

- `POST /portal-auth` - Login with portal code
- `GET /portal-projects` - Get client's visible projects
- `GET /portal-invoices` - Get client's visible invoices
- `GET /portal-invoice-pdf?invoice_id=X` - Get invoice details
- `POST /portal-signout` - Logout

## Customization

### Changing Colors

Edit `tailwind.config.js` to customize the color scheme.

### Adding Team Branding

The portal supports team branding (logo, primary color) returned from the API.
You can extend the dashboard layout to use these values.

### Changing the Supabase URL

Edit `lib/api.ts` and update the `SUPABASE_URL` constant:

```typescript
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co/functions/v1';
```

## Security Notes

- Portal codes are 8-character alphanumeric strings
- Session tokens expire after 24 hours
- Tokens are stored in localStorage
- All API calls use HTTPS
