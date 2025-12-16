import { useEffect, useState } from "react";
import { fetchLicenseDetails, ingestLicenses, fetchCustomers, fetchProducts } from "./api/scormApi";
import type { LicenseRow, IngestReport } from "./types";
import { SimpleTable } from "./components/SimpleTable";
import * as XLSX from "xlsx";
import "./App.css";

const APP_VERSION = "v1.4";

// Get last 30 days date range
const getLast30DaysRange = () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return { firstDay: formatDateForInput(thirtyDaysAgo), lastDayStr: formatDateForInput(now) };
};

const { firstDay, lastDayStr } = getLast30DaysRange();

// Format date to user-friendly format (e.g., "Jun 6, 2025")
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Calculate duration in days between two dates
const calculateDuration = (startDate: string | null | undefined, endDate: string | null | undefined) => {
  if (!startDate || !endDate) return '';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `${diffDays} days`;
};

export default function App() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null);
  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(lastDayStr);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [showReference, setShowReference] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const rows = await fetchLicenseDetails({
        date_from: dateFrom,
        date_to: dateTo,
        page: 1,
        customer_name: selectedCustomer || undefined,
        product_title: selectedProduct || undefined,
      });
      setLicenses(rows);
    } catch (error) {
      console.error("Error loading licenses:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const customerList = await fetchCustomers();
      setCustomers(customerList);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  };

  const loadProducts = async (customerName: string) => {
    try {
      console.log("Loading products for customer:", customerName);
      const productList = await fetchProducts(customerName);
      console.log("Products loaded:", productList);
      setProducts(productList);
    } catch (error) {
      console.error("Error loading products:", error);
      setProducts([]);
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    setIngestReport(null);
    try {
      const report = await ingestLicenses();
      console.log("Ingest report:", report);
      setIngestReport(report);
      
      // Reload data after ingestion
      await loadData();
    } catch (error) {
      console.error("Error ingesting licenses:", error);
      alert("Error updating database");
    } finally {
      setIngesting(false);
    }
  };

  const handleDownloadExcel = () => {
    // Create worksheet from licenses data
    const worksheet = XLSX.utils.json_to_sheet(licenses.map(license => ({
      "Customer Ref": license.customer_ref || "",
      "Entidad_consumo": license.customer_name || "",
      "Customer URL": license.customer_url || "",
      "Customer URL 2": license.customer_url2 || "",
      "Customer URL 3": license.customer_url3 || "",
      "Nombre de usuario": license.user_username || "",
      "Nombre completo con enlace": license.user_fullname || "",
      "Codigo_Curso": license.product_ref || "",
      "Nombre completo del curso con enlace": license.product_title || "",
      "Horas": license.product_duration || "",
      "Precio_Producto": license.product_price || "",
      "F_inicio_licencia": formatDate(license.license_start),
      "F_fin_licencia": formatDate(license.license_end),
      "Duracion_licencia": calculateDuration(license.license_start, license.license_end),
      "Primer acceso a Scorm": license.tracking_first_access || "",
    })));

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Customer Ref
      { wch: 30 }, // Customer Name
      { wch: 35 }, // Customer URL
      { wch: 35 }, // Customer URL 2
      { wch: 35 }, // Customer URL 3
      { wch: 20 }, // User Username
      { wch: 30 }, // User Fullname
      { wch: 15 }, // Product Ref
      { wch: 40 }, // Product Title
      { wch: 18 }, // Product Duration
      { wch: 15 }, // Product Price
      { wch: 18 }, // License Start
      { wch: 18 }, // License End
      { wch: 18 }, // License Duration
      { wch: 22 }, // Tracking First Access
    ];

    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Licenses");

    // Generate filename with date range
    const filename = `licenses_${dateFrom}_to_${dateTo}.xlsx`;

    // Download the file
    XLSX.writeFile(workbook, filename);
  };

  useEffect(() => {
    loadData();
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadProducts(selectedCustomer);
      setSelectedProduct(""); // Reset product when customer changes
    } else {
      setProducts([]);
      setSelectedProduct("");
    }
    loadData();
  }, [selectedCustomer]);

  useEffect(() => {
    loadData();
  }, [selectedProduct]);

  return (
    <div style={{ padding: "20px", position: "relative" }}>
      <div style={{ 
        position: "absolute", 
        top: "10px", 
        right: "20px", 
        fontSize: "14px", 
        color: "#888",
        fontFamily: "monospace"
      }}>
        {APP_VERSION}
      </div>
      <div style={{
        position: "absolute",
        top: "10px",
        right: "70px",
      }}>
        <button
          onClick={() => setShowReference(!showReference)}
          style={{
            padding: "4px 10px",
            fontSize: "12px",
            backgroundColor: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            color: "#666"
          }}
        >
          ℹ️ Column Reference
        </button>
      </div>
      <h1 style={{ marginTop: "0" }}>License Details</h1>

      {showReference && (
        <div style={{
          marginBottom: "20px",
          padding: "16px",
          backgroundColor: "#f9f9f9",
          border: "1px solid #ddd",
          borderRadius: "4px",
          fontSize: "13px",
          maxWidth: "600px",
          color: "#333"
        }}>
          <strong>Excel Column Reference:</strong>
          <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "8px", alignItems: "center" }}>
            <span style={{ color: "#666" }}>User Username</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>Nombre de usuario</span>
            
            <span style={{ color: "#666" }}>User Fullname</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>Nombre completo con enlace</span>
            
            <span style={{ color: "#666" }}>Customer Name</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>Entidad_consumo</span>
            
            <span style={{ color: "#666" }}>Product Ref</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>Codigo_Curso</span>
            
            <span style={{ color: "#666" }}>Product Title</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>Nombre completo del curso con enlace</span>
            
            <span style={{ color: "#666" }}>Product Duration</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>Horas</span>
            
            <span style={{ color: "#666" }}>Product Price</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>Precio_Producto</span>
            
            <span style={{ color: "#666" }}>License Start</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>F_inicio_licencia</span>
            
            <span style={{ color: "#666" }}>License End</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>F_fin_licencia</span>
            
            <span style={{ color: "#666" }}>License Duration</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>Duracion_licencia</span>
            
            <span style={{ color: "#666" }}>Tracking First Access</span>
            <span>→</span>
            <span style={{ fontWeight: "500" }}>Primer acceso a Scorm</span>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <label>
          Date From:
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ marginLeft: "8px", padding: "4px" }}
          />
        </label>
        <label>
          Date To:
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ marginLeft: "8px", padding: "4px" }}
          />
        </label>
        <label>
          Customer:
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            style={{ marginLeft: "8px", padding: "4px", minWidth: "200px" }}
          >
            <option value="">All Customers</option>
            {customers.map((customer) => (
              <option key={customer} value={customer}>
                {customer}
              </option>
            ))}
          </select>
        </label>
        <label>
          Product:
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            disabled={!selectedCustomer}
            style={{ 
              marginLeft: "8px", 
              padding: "4px", 
              minWidth: "200px",
              opacity: selectedCustomer ? 1 : 0.5,
              cursor: selectedCustomer ? "pointer" : "not-allowed"
            }}
          >
            <option value="">All Products</option>
            {products.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
        </label>
        <button onClick={loadData} disabled={loading} style={{ padding: "6px 16px" }}>
          {loading ? "Loading..." : "Search"}
        </button>
        <button 
          onClick={handleIngest} 
          disabled={ingesting || loading} 
          style={{ padding: "6px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: ingesting ? "not-allowed" : "pointer" }}
        >
          {ingesting ? "Updating..." : "Update Database"}
        </button>
        <button 
          onClick={handleDownloadExcel} 
          disabled={loading || licenses.length === 0} 
          style={{ padding: "6px 16px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: (loading || licenses.length === 0) ? "not-allowed" : "pointer" }}
        >
          📥 Download Excel
        </button>
      </div>

      {ingestReport && (
        <div style={{ 
          marginBottom: "20px", 
          padding: "16px", 
          backgroundColor: "#d4edda", 
          border: "1px solid #c3e6cb", 
          borderRadius: "4px",
          color: "#155724"
        }}>
          <strong>Database updated successfully!</strong>
          <div style={{ marginTop: "8px" }}>
            <div>📥 New entries from API: <strong>{ingestReport.fetched}</strong></div>
            <div>💾 Inserted to database: <strong>{ingestReport.upserted}</strong></div>
            <div>📅 Date range: <strong>{ingestReport.fromDate}</strong> to <strong>{ingestReport.toDate}</strong></div>
          </div>
        </div>
      )}

      {loading && <p>Loading…</p>}

      {!loading && (
        <SimpleTable
          columns={[
            { key: "customer_name", label: "Customer" },
            { key: "customer_url", label: "URL" },
            { key: "customer_url2", label: "URL 2" },
            { key: "customer_url3", label: "URL 3" },
            { key: "user_fullname", label: "User" },
            { key: "product_title", label: "Product" },
            { 
              key: "license_start", 
              label: "License Start",
              render: (value) => formatDate(value)
            },
            { 
              key: "license_end", 
              label: "License End",
              render: (value) => formatDate(value)
            },
            {
              key: "license_duration",
              label: "License Duration",
              render: (_, row) => calculateDuration(row.license_start, row.license_end)
            },
          ]}
          rows={licenses}
        />
      )}
    </div>
  );
}
