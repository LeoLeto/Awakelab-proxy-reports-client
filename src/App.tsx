import { useEffect, useState } from "react";
import { fetchLicenseDetails } from "./api/scormApi";
import type { LicenseRow } from "./types";
import { SimpleTable } from "./components/SimpleTable";
import "./App.css";

export default function App() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("2025-04-01");
  const [dateTo, setDateTo] = useState("2025-04-30");

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
      </div>

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
