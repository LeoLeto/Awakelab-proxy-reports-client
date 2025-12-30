import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchLicenseDetails, ingestLicenses, fetchCustomers, setAuthToken, setUnauthorizedHandler } from "./api/scormApi";
import type { LicenseRow, IngestReport } from "./types";
import { SimpleTable } from "./components/SimpleTable";
import { Login } from "./components/Login";
import * as XLSX from "xlsx";
import "./App.css";

const APP_VERSION = "v1.7";

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

// Format date to user-friendly format (e.g., "6 jun 2025")
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { 
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
  return `${diffDays} días`;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [allLicenses, setAllLicenses] = useState<LicenseRow[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null);
  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(lastDayStr);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [showReference, setShowReference] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchLicenseDetails({
        date_from: dateFrom,
        date_to: dateTo,
        page: 1,
        customer_name: selectedCustomer || undefined,
      });
      setAllLicenses(rows);
    } catch (error) {
      console.error("Error al cargar licencias:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedCustomer]);

  const loadCustomers = useCallback(async () => {
    try {
      const customerList = await fetchCustomers();
      setCustomers(customerList);
    } catch (error) {
      console.error("Error al cargar clientes:", error);
    }
  }, []);

  // Derive available products from current licenses
  const products = useMemo(() => {
    const uniqueProducts = new Set<string>();
    allLicenses.forEach(license => {
      if (license.product_title) {
        uniqueProducts.add(license.product_title);
      }
    });
    return Array.from(uniqueProducts).sort();
  }, [allLicenses]);

  // Filter licenses by selected product
  const licenses = useMemo(() => {
    if (!selectedProduct) return allLicenses;
    return allLicenses.filter(license => license.product_title === selectedProduct);
  }, [allLicenses, selectedProduct]);

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
      console.error("Error al ingerir licencias:", error);
      alert("Error al actualizar la base de datos");
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

  // Check for stored token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("authUser");
    
    if (storedToken && storedUser) {
      // Check if token is expired before using it
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        
        if (Date.now() >= expirationTime) {
          // Token has expired - clear it immediately
          localStorage.removeItem("authToken");
          localStorage.removeItem("authUser");
          setAuthToken(null);
          setIsAuthenticated(false);
          setCurrentUser("");
          return;
        }
      } catch {
        // Invalid token format - clear it
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
        return;
      }

      setAuthToken(storedToken);
      setIsAuthenticated(true);
      setCurrentUser(storedUser);
    }

    // Setup handler for 401 responses (expired/invalid tokens)
    setUnauthorizedHandler(() => {
      // Token expired - log user out automatically
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
      setAuthToken(null);
      setIsAuthenticated(false);
      setCurrentUser("");
    });
  }, []);

  const handleLogin = (token: string, username: string) => {
    localStorage.setItem("authToken", token);
    localStorage.setItem("authUser", username);
    setAuthToken(token);
    setIsAuthenticated(true);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    setAuthToken(null);
    setIsAuthenticated(false);
    setCurrentUser("");
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      loadCustomers();
    }
  }, [isAuthenticated, loadData, loadCustomers]);

  useEffect(() => {
    if (isAuthenticated) {
      setSelectedProduct(""); // Reset product when customer changes
      loadData();
    }
  }, [selectedCustomer, isAuthenticated, loadData]);

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      {/* User controls - absolute to viewport */}
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
        display: "flex",
        gap: "10px",
        alignItems: "center"
      }}>
        <span style={{ fontSize: "14px", color: "#666" }}>
          Usuario: <strong>{currentUser}</strong>
        </span>
        <button
          onClick={handleLogout}
          style={{
            padding: "4px 10px",
            fontSize: "12px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Cerrar Sesión
        </button>
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
          ℹ️ Referencia de Columnas
        </button>
      </div>

      {/* Main content */}
      <div style={{ padding: "20px" }}>
        <h1 style={{ marginTop: "0", marginBottom: "20px" }}>Detalles de Licencias</h1>

      {showReference && (
        <div style={{
          marginBottom: "20px",
          padding: "16px",
          backgroundColor: "#f9f9f9",
          border: "1px solid #ddd",
          borderRadius: "4px",
          fontSize: "13px",
          maxWidth: "600px",
          color: "#333",
          marginInline: "auto"
        }}>
          <strong>Referencia de Columnas Excel:</strong>
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
          Fecha Desde:
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ marginLeft: "8px", padding: "4px" }}
          />
        </label>
        <label>
          Fecha Hasta:
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ marginLeft: "8px", padding: "4px" }}
          />
        </label>
        <label>
          Cliente:
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            style={{ marginLeft: "8px", padding: "4px", minWidth: "200px" }}
          >
            <option value="">Todos los Clientes</option>
            {customers.map((customer) => (
              <option key={customer} value={customer}>
                {customer}
              </option>
            ))}
          </select>
        </label>
        <label>
          Producto:
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
            <option value="">Todos los Productos</option>
            {products.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
        </label>
        <button onClick={loadData} disabled={loading} style={{ padding: "6px 16px" }}>
          {loading ? "Cargando..." : "Buscar"}
        </button>
        <button 
          onClick={handleIngest} 
          disabled={ingesting || loading} 
          style={{ padding: "6px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: ingesting ? "not-allowed" : "pointer" }}
        >
          {ingesting ? "Actualizando..." : "Actualizar Base de Datos"}
        </button>
        <button 
          onClick={handleDownloadExcel} 
          disabled={loading || licenses.length === 0} 
          style={{ padding: "6px 16px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: (loading || licenses.length === 0) ? "not-allowed" : "pointer" }}
        >
          📥 Descargar Excel
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
          <strong>¡Base de datos actualizada exitosamente!</strong>
          <div style={{ marginTop: "8px" }}>
            <div>📥 Nuevas entradas desde API: <strong>{ingestReport.fetched}</strong></div>
            <div>💾 Insertadas en base de datos: <strong>{ingestReport.upserted}</strong></div>
            <div>📅 Rango de fechas: <strong>{ingestReport.fromDate}</strong> a <strong>{ingestReport.toDate}</strong></div>
          </div>
        </div>
      )}

      {loading && <p>Cargando…</p>}

      {!loading && (
        <SimpleTable
          columns={[
            { key: "customer_name", label: "Cliente" },
            { key: "customer_url", label: "URL" },
            { key: "customer_url2", label: "URL 2" },
            { key: "customer_url3", label: "URL 3" },
            { key: "user_fullname", label: "Usuario" },
            { key: "product_title", label: "Producto" },
            { 
              key: "license_start", 
              label: "Inicio de Licencia",
              render: (value) => formatDate(value)
            },
            { 
              key: "license_end", 
              label: "Fin de Licencia",
              render: (value) => formatDate(value)
            },
            {
              key: "license_duration",
              label: "Duración de Licencia",
              render: (_, row) => calculateDuration(row.license_start, row.license_end)
            },
          ]}
          rows={licenses}
        />
      )}
      </div>
    </>
  );
}
