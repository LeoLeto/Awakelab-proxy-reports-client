import { useEffect, useState } from "react";
import { fetchLicenseDetails, ingestLicenses } from "./api/scormApi";
import type { LicenseRow, IngestReport } from "./types";
import { SimpleTable } from "./components/SimpleTable";
import * as XLSX from "xlsx";
import "./App.css";

// Get last month's date range
const getLastMonthRange = () => {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = lastMonth.getFullYear();
  const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
  const firstDay = `${year}-${month}-01`;
  const lastDay = new Date(year, lastMonth.getMonth() + 1, 0).getDate();
  const lastDayStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  return { firstDay, lastDayStr };
};

const { firstDay, lastDayStr } = getLastMonthRange();

export default function App() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null);
  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(lastDayStr);

  const loadData = async () => {
    setLoading(true);
    try {
      const rows = await fetchLicenseDetails({
        date_from: dateFrom,
        date_to: dateTo,
        page: 1,
      });
      setLicenses(rows);
    } catch (error) {
      console.error("Error loading licenses:", error);
    } finally {
      setLoading(false);
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
      "Customer Name": license.customer_name || "",
      "User Username": license.user_username || "",
      "User Fullname": license.user_fullname || "",
      "Product Ref": license.product_ref || "",
      "Product Title": license.product_title || "",
      "Product Duration": license.product_duration || "",
      "Product Price": license.product_price || "",
      "License Details": license.license_details || "",
      "License Start": license.license_start || "",
      "License End": license.license_end || "",
      "Tracking First Access": license.tracking_first_access || "",
      "Tracking Last Access": license.tracking_last_access || "",
      "Tracking Visits": license.tracking_visits || "",
      "Tracking Elapsed Time": license.tracking_elapsed_time || "",
    })));

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Customer Ref
      { wch: 30 }, // Customer Name
      { wch: 20 }, // User Username
      { wch: 30 }, // User Fullname
      { wch: 15 }, // Product Ref
      { wch: 40 }, // Product Title
      { wch: 18 }, // Product Duration
      { wch: 15 }, // Product Price
      { wch: 20 }, // License Details
      { wch: 18 }, // License Start
      { wch: 18 }, // License End
      { wch: 22 }, // Tracking First Access
      { wch: 22 }, // Tracking Last Access
      { wch: 15 }, // Tracking Visits
      { wch: 22 }, // Tracking Elapsed Time
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
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>License Details</h1>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center" }}>
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
            { key: "user_fullname", label: "User" },
            { key: "product_title", label: "Product" },
            { key: "license_start", label: "License Start" },
            { key: "license_end", label: "License End" },
            { key: "tracking_visits", label: "Visits" },
          ]}
          rows={licenses}
        />
      )}
    </div>
  );
}
