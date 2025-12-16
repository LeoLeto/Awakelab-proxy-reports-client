import axios from "axios";
import type { LicenseRow, IngestReport } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function fetchLicenseDetails(params?: {
  date_from?: string;
  date_to?: string;
  page?: number;
  customer_name?: string;
}): Promise<LicenseRow[]> {
  const url = `${API_BASE}/api/license-details`;

  const body = {
    date_from: params?.date_from,
    date_to: params?.date_to,
    page: params?.page ?? 1,
    customer_name: params?.customer_name,
  };

  const res = await axios.post<{
    ok: boolean;
    license?: LicenseRow[];
    error?: string;
  }>(url, body, {
    headers: {
      "Content-Type": "application/json",
      // optionally send an auth header if you protect the endpoint:
      // Authorization: `Bearer ${import.meta.env.VITE_FRONTEND_API_KEY}`
    },
  });
  
  console.log("🚀 ~ res: ", res)

  if (!res.data.ok)
    throw new Error(res.data.error ?? "failed to fetch licenses");
  return res.data.license ?? [];
}

export async function ingestLicenses(): Promise<IngestReport> {
  const url = `${API_BASE}/ingest/licenses`;
  const res = await axios.get<{ ok: boolean; report?: IngestReport; error?: string }>(url);
  
  if (!res.data.ok || !res.data.report)
    throw new Error(res.data.error ?? "failed to ingest licenses");
  return res.data.report;
}

export async function fetchCustomers(): Promise<string[]> {
  const url = `${API_BASE}/api/customers`;
  const res = await axios.get<{ ok: boolean; customers?: { customer_name: string }[]; error?: string }>(url);
  
  if (!res.data.ok || !res.data.customers)
    throw new Error(res.data.error ?? "failed to fetch customers");
  return res.data.customers.map(c => c.customer_name);
}
