// API client for Siino Client Portal

const SUPABASE_URL = 'https://zutvjmdebkupfowryese.supabase.co/functions/v1';

// Types
export interface Client {
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  client: Client;
  expires_at: string;
}

export interface ProjectStatus {
  id: string;
  name: string;
  color: string;
}

export interface ProjectType {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  deadline: string | null;
  notes: string;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  status: ProjectStatus | null;
  project_type: ProjectType | null;
}

export interface LineItem {
  id: string;
  item_name: string;
  hours: number;
  rate: number;
  total: number;
  is_quantity_based: boolean;
  sort_order: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  subtotal: number;
  tps_amount: number;
  tvq_amount: number;
  total_amount: number;
  status: string;
  issue_date: string;
  due_date: string;
  paid_at: string | null;
  notes: string;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  invoice_line_items: LineItem[];
}

export interface InvoiceSummary {
  total_paid: number;
  total_outstanding: number;
  paid_count: number;
  outstanding_count: number;
}

export interface Team {
  name: string;
  billing_name: string;
  billing_address: string;
  billing_city: string;
  billing_province: string;
  billing_postal_code: string;
  billing_phone: string;
  tps_number: string;
  tvq_number: string;
  logo_url: string | null;
  primary_color: string | null;
}

// Storage helpers
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('portal_token');
}

export function setToken(token: string): void {
  localStorage.setItem('portal_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('portal_token');
  localStorage.removeItem('portal_client');
}

export function getClient(): Client | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('portal_client');
  return data ? JSON.parse(data) : null;
}

export function setClient(client: Client): void {
  localStorage.setItem('portal_client', JSON.stringify(client));
}

// API functions
export async function login(portalCode: string): Promise<AuthResponse> {
  const response = await fetch(`${SUPABASE_URL}/portal-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ portal_code: portalCode }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  // Store token and client info
  setToken(data.token);
  setClient(data.client);

  return data;
}

export async function logout(): Promise<void> {
  const token = getToken();
  
  if (token) {
    try {
      await fetch(`${SUPABASE_URL}/portal-signout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (e) {
      // Ignore errors on logout
    }
  }
  
  clearToken();
}

export async function getProjects(): Promise<{ projects: Project[]; client: Client }> {
  const token = getToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/portal-projects`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
    }
    throw new Error(data.error || 'Failed to fetch projects');
  }

  return data;
}

export async function getInvoices(): Promise<{ invoices: Invoice[]; summary: InvoiceSummary; client: Client }> {
  const token = getToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/portal-invoices`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
    }
    throw new Error(data.error || 'Failed to fetch invoices');
  }

  return data;
}

export async function getInvoiceDetail(invoiceId: string): Promise<{ invoice: Invoice; team: Team | null; client: Client }> {
  const token = getToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/portal-invoice-pdf?invoice_id=${invoiceId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
    }
    throw new Error(data.error || 'Failed to fetch invoice');
  }

  return data;
}

// Format helpers
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'unpaid':
      return 'bg-yellow-100 text-yellow-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
