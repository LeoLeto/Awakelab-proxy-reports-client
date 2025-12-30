import axios from "axios";
import type { LicenseRow, IngestReport } from "../types";

// Use env variable if set, otherwise detect based on hostname
const getApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Auto-detect: if running on localhost, use local API
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  // Production default
  return 'https://proxy-reports.awakelab.world';
};

const API_BASE = getApiBase();

// Token management
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// Setup axios interceptor to handle 401 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && onUnauthorized) {
      // Token expired or invalid - trigger logout
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

function getAuthHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  
  return headers;
}

export async function fetchLicenseDetails(params?: {
  date_from?: string;
  date_to?: string;
  page?: number;
  customer_name?: string;
  product_title?: string;
}): Promise<LicenseRow[]> {
  const url = `${API_BASE}/api/license-details`;

  const body = {
    date_from: params?.date_from,
    date_to: params?.date_to,
    page: params?.page ?? 1,
    customer_name: params?.customer_name,
    product_title: params?.product_title,
  };

  const res = await axios.post<{
    ok: boolean;
    license?: LicenseRow[];
    error?: string;
  }>(url, body, {
    headers: getAuthHeaders(),
  });
  
  console.log("🚀 ~ res: ", res)

  if (!res.data.ok)
    throw new Error(res.data.error ?? "failed to fetch licenses");
  return res.data.license ?? [];
}

export async function ingestLicenses(): Promise<IngestReport> {
  const url = `${API_BASE}/ingest/licenses`;
  const res = await axios.get<{ ok: boolean; report?: IngestReport; error?: string }>(url, {
    headers: getAuthHeaders(),
  });
  
  if (!res.data.ok || !res.data.report)
    throw new Error(res.data.error ?? "failed to ingest licenses");
  return res.data.report;
}

export async function fetchCustomers(): Promise<string[]> {
  const url = `${API_BASE}/api/customers`;
  const res = await axios.get<{ ok: boolean; customers?: { customer_name: string }[]; error?: string }>(url, {
    headers: getAuthHeaders(),
  });
  
  if (!res.data.ok || !res.data.customers)
    throw new Error(res.data.error ?? "failed to fetch customers");
  return res.data.customers.map(c => c.customer_name);
}

export async function fetchProducts(customerName: string): Promise<string[]> {
  const url = `${API_BASE}/api/products?customer_name=${encodeURIComponent(customerName)}`;
  const res = await axios.get<{ ok: boolean; products?: { product_title: string }[]; error?: string }>(url, {
    headers: getAuthHeaders(),
  });
  
  if (!res.data.ok || !res.data.products)
    throw new Error(res.data.error ?? "failed to fetch products");
  return res.data.products.map(p => p.product_title);
}
