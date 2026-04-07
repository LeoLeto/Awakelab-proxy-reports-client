import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchLicenseDetails, fetchLicenseDetailsForExport, ingestLicenses, fetchCustomers, setAuthToken, setUnauthorizedHandler } from "./api/scormApi";
import type { LicenseRow, IngestReport } from "./types";
import { SimpleTable } from "./components/SimpleTable";
import { Login } from "./components/Login";
import * as XLSX from "xlsx";
import "./App.css";
import reproxyLogoWhite from "./assets/REPROXY-logo-white.png";

const APP_VERSION = "v2.0";

// Color palette
const CYAN = "#5db1b8";
const DARK_BLUE = "#34455c";

// Get last 30 days date range
const getLast30DaysRange = () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return { firstDay: formatDateForInput(thirtyDaysAgo), lastDayStr: formatDateForInput(now) };
};

const { firstDay, lastDayStr } = getLast30DaysRange();

// Format date to user-friendly format (e.g., "6 jun 2025")
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Calculate duration in days between two dates
const calculateDuration = (startDate: string | null | undefined, endDate: string | null | undefined) => {
  if (!startDate || !endDate) return "";
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `${diffDays} días`;
};

// Shared card style
const cardStyle: React.CSSProperties = {
  backgroundColor: "white",
  borderRadius: "10px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  padding: "20px 24px",
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [allLicenses, setAllLicenses] = useState<LicenseRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
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
      const result = await fetchLicenseDetails({
        date_from: dateFrom,
        date_to: dateTo,
        page: 1,
        customer_name: selectedCustomer || undefined,
      });
      setAllLicenses(result.licenses);
      setTotalCount(result.total);
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
    allLicenses.forEach((license) => {
      if (license.product_title) {
        uniqueProducts.add(license.product_title);
      }
    });
    return Array.from(uniqueProducts).sort();
  }, [allLicenses]);

  // Filter licenses by selected product
  const licenses = useMemo(() => {
    if (!selectedProduct) return allLicenses;
    return allLicenses.filter((license) => license.product_title === selectedProduct);
  }, [allLicenses, selectedProduct]);

  const handleIngest = async () => {
    setIngesting(true);
    setIngestReport(null);
    try {
      const report = await ingestLicenses();
      console.log("Ingest report:", report);
      setIngestReport(report);
      await loadData();
    } catch (error) {
      console.error("Error al ingerir licencias:", error);
      alert("Error al actualizar la base de datos");
    } finally {
      setIngesting(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setLoading(true);

      const allRecords = await fetchLicenseDetailsForExport({
        date_from: dateFrom,
        date_to: dateTo,
        customer_name: selectedCustomer || undefined,
        product_title: selectedProduct || undefined,
      });

      console.log("Exporting", allRecords.length, "records to Excel");

      const worksheet = XLSX.utils.json_to_sheet(
        allRecords.map((license) => ({
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
          "Primer acceso a Scorm": formatDate(license.tracking_first_access),
        }))
      );

      worksheet["!cols"] = [
        { wch: 15 }, { wch: 30 }, { wch: 35 }, { wch: 35 }, { wch: 35 },
        { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 40 }, { wch: 18 },
        { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Licenses");
      const filename = `licenses_${dateFrom}_to_${dateTo}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("Error generating Excel:", error);
      alert("Error al generar el archivo Excel");
    } finally {
      setLoading(false);
    }
  };

  // Check for stored token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("authUser");

    if (storedToken && storedUser) {
      try {
        const payload = JSON.parse(atob(storedToken.split(".")[1]));
        const expirationTime = payload.exp * 1000;

        if (Date.now() >= expirationTime) {
          localStorage.removeItem("authToken");
          localStorage.removeItem("authUser");
          setAuthToken(null);
          setIsAuthenticated(false);
          setCurrentUser("");
          return;
        }
      } catch {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
        return;
      }

      setAuthToken(storedToken);
      setIsAuthenticated(true);
      setCurrentUser(storedUser);
    }

    setUnauthorizedHandler(() => {
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
      loadCustomers();
      loadData();
    }
  }, [isAuthenticated, loadCustomers, loadData]);

  useEffect(() => {
    if (isAuthenticated && selectedCustomer) {
      setSelectedProduct("");
    }
  }, [selectedCustomer, isAuthenticated]);

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f2f2", display: "flex", flexDirection: "column" }}>

      {/* ── HEADER ── */}
      <header style={{
        backgroundColor: DARK_BLUE,
        display: "flex",
        alignItems: "center",
        padding: "0 28px",
        height: "60px",
        flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}>
        {/* Logo + version badge */}
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <img src={reproxyLogoWhite} alt="Reproxy" style={{ height: "34px", width: "auto" }} />
          <span style={{
            position: "absolute",
            top: "-8px",
            right: "-34px",
            backgroundColor: CYAN,
            color: "white",
            fontSize: "10px",
            fontWeight: "700",
            padding: "2px 6px",
            borderRadius: "8px",
            letterSpacing: "0.04em",
          }}>
            {APP_VERSION}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* User info + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "14px" }}>
            Usuario: <strong style={{ color: "white" }}>{currentUser}</strong>
          </span>
          <button
            onClick={() => setShowReference(!showReference)}
            style={{
              padding: "5px 12px",
              fontSize: "13px",
              backgroundColor: "rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            ℹ️ Columnas
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 16px",
              fontSize: "14px",
              backgroundColor: CYAN,
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ↩ Cerrar sesión
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, padding: "24px 28px", boxSizing: "border-box" }}>

        {/* Page title row */}
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: "700",
            color: DARK_BLUE,
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <span style={{ fontSize: "20px" }}>📋</span>
            LISTADO DE LICENCIAS
          </h1>
        </div>

        {/* Column reference panel */}
        {showReference && (
          <div style={{ ...cardStyle, marginBottom: "20px", fontSize: "13px", color: "#333" }}>
            <strong style={{ color: DARK_BLUE }}>Referencia de Columnas Excel:</strong>
            <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "6px 12px", alignItems: "center", maxWidth: "540px" }}>
              {[
                ["User Username", "Nombre de usuario"],
                ["User Fullname", "Nombre completo con enlace"],
                ["Customer Name", "Entidad_consumo"],
                ["Product Ref", "Codigo_Curso"],
                ["Product Title", "Nombre completo del curso con enlace"],
                ["Product Duration", "Horas"],
                ["Product Price", "Precio_Producto"],
                ["License Start", "F_inicio_licencia"],
                ["License End", "F_fin_licencia"],
                ["License Duration", "Duracion_licencia"],
                ["Tracking First Access", "Primer acceso a Scorm"],
              ].map(([from, to]) => (
                <>
                  <span key={`from-${from}`} style={{ color: "#666" }}>{from}</span>
                  <span key={`arr-${from}`} style={{ color: "#aaa" }}>→</span>
                  <span key={`to-${from}`} style={{ fontWeight: "500" }}>{to}</span>
                </>
              ))}
            </div>
          </div>
        )}

        {/* ── FILTERS CARD ── */}
        <div style={{ ...cardStyle, marginBottom: "20px" }}>
          {/* Row 1: dates + client */}
          <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
            <label style={filterLabelStyle}>
              <span style={filterIconStyle}>📅</span> Fecha Desde:
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={filterInputStyle}
              />
            </label>
            <label style={filterLabelStyle}>
              <span style={filterIconStyle}>📅</span> Fecha hasta:
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={filterInputStyle}
              />
            </label>
            <label style={{ ...filterLabelStyle, flex: 1, minWidth: "220px" }}>
              <span style={filterIconStyle}>🏢</span> Cliente:
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                style={{ ...filterInputStyle, minWidth: "200px", flex: 1 }}
              >
                <option value="">Todos los clientes</option>
                {customers.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Row 2: product + search button */}
          <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
            <label style={filterLabelStyle}>
              <span style={filterIconStyle}>📦</span> Producto:
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                disabled={!selectedCustomer}
                style={{
                  ...filterInputStyle,
                  minWidth: "200px",
                  opacity: selectedCustomer ? 1 : 0.5,
                  cursor: selectedCustomer ? "pointer" : "not-allowed",
                }}
              >
                <option value="">Todos los productos</option>
                {products.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ flex: 1 }} />
            <button
              onClick={loadData}
              disabled={loading}
              style={{
                padding: "8px 24px",
                backgroundColor: CYAN,
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "15px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.65 : 1,
              }}
            >
              {loading ? "Cargando..." : "Buscar resultados"}
            </button>
          </div>
        </div>

        {/* ── STATUS CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          {/* Resultados de la actualización */}
          <div style={{ ...cardStyle, display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <span style={{ fontSize: "28px", flexShrink: 0, opacity: ingestReport ? 1 : 0.4, transition: "opacity 0.3s" }}>🗄️</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontWeight: "700", color: DARK_BLUE, fontSize: "13px", letterSpacing: "0.06em", opacity: ingestReport ? 1 : 0.4, transition: "opacity 0.3s" }}>
                  RESULTADOS DE LA ACTUALIZACIÓN
                </div>
                <button
                  onClick={handleIngest}
                  disabled={ingesting}
                  style={{
                    padding: "5px 14px",
                    backgroundColor: DARK_BLUE,
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: ingesting ? "not-allowed" : "pointer",
                    opacity: ingesting ? 0.65 : 1,
                    flexShrink: 0,
                  }}
                >
                  {ingesting ? "Actualizando..." : "Actualizar Datos"}
                </button>
              </div>
              <div style={{ opacity: ingestReport ? 1 : 0.4, transition: "opacity 0.3s" }}>
                {ingestReport ? (
                  <div style={{ fontSize: "13px", color: CYAN, lineHeight: "1.8" }}>
                    <div>Nuevas entradas desde API: {ingestReport.fetched}</div>
                    <div>Insertadas en base de datos: {ingestReport.upserted}</div>
                    <div>Rango de fechas: {ingestReport.fromDate} a {ingestReport.toDate}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: "13px", color: "#aaa" }}>—</div>
                )}
              </div>
            </div>
          </div>

          {/* Resultados encontrados */}
          <div style={{ ...cardStyle, display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <span style={{ fontSize: "28px", flexShrink: 0 }}>📊</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontWeight: "700", color: DARK_BLUE, fontSize: "13px", letterSpacing: "0.06em" }}>
                  RESULTADOS ENCONTRADOS
                </div>
                <button
                  onClick={handleDownloadExcel}
                  disabled={loading || totalCount === 0}
                  style={{
                    padding: "5px 14px",
                    backgroundColor: CYAN,
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: (loading || totalCount === 0) ? "not-allowed" : "pointer",
                    opacity: (loading || totalCount === 0) ? 0.55 : 1,
                    flexShrink: 0,
                  }}
                >
                  Descarga registros
                </button>
              </div>
              {!loading && totalCount > 0 ? (
                <div style={{ fontSize: "13px", color: CYAN }}>
                  Mostrando {licenses.length} item de {totalCount} resultados totales
                  {licenses.length < totalCount && (
                    <span style={{ color: "#888", marginLeft: "6px" }}>
                      (Excel descarga los {totalCount} registros)
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "13px", color: "#aaa" }}>
                  {loading ? "Cargando..." : "Sin resultados"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{
          backgroundColor: "white",
          borderRadius: "10px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}>
          {loading ? (
            <p style={{ padding: "24px", color: "#888", margin: 0 }}>Cargando…</p>
          ) : (
            <SimpleTable
              columns={[
                { key: "customer_name", label: "Cliente" },
                { key: "customer_url", label: "URL User" },
                { key: "customer_url2", label: "URL AWK" },
                { key: "user_fullname", label: "Usuario" },
                { key: "product_title", label: "Producto" },
                {
                  key: "license_start",
                  label: "Inicio de Licencia",
                  render: (value) => formatDate(value),
                },
                {
                  key: "license_end",
                  label: "Fin de Licencia",
                  render: (value) => formatDate(value),
                },
                {
                  key: "license_duration",
                  label: "Duración de Licencia",
                  render: (_, row) => calculateDuration(row.license_start, row.license_end),
                },
                {
                  key: "tracking_first_access",
                  label: "Primer Acceso",
                  render: (value) => formatDate(value),
                },
              ]}
              rows={licenses}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// Shared filter styles
const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  fontWeight: "500",
  color: DARK_BLUE,
  whiteSpace: "nowrap",
};

const filterIconStyle: React.CSSProperties = {
  fontSize: "15px",
};

const filterInputStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #dde3e6",
  borderRadius: "6px",
  fontSize: "14px",
  color: "#333",
  backgroundColor: "#fafafa",
  cursor: "pointer",
};
