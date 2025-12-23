import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import "../styles/SalesReport.css";
import { formatNumber } from "../lib/utils";

export default function SalesReport() {
  const [sales, setSales] = useState([]);
  const [stores, setStores] = useState([]);
  
  // 🟢 STORE FILTER (New)
  const [selectedSource, setSelectedSource] = useState("all");

  // 🔵 FILTER FOR CARDS
  const [cardFilter, setCardFilter] = useState("monthly");

  // 🔴 FILTER FOR TABLE
  const [tableFilter, setTableFilter] = useState("monthly");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [cashTotal, setCashTotal] = useState(0);
  const [transferTotal, setTransferTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  // Load Stores on mount
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const snap = await getDocs(collection(db, "stores"));
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStores(list);
      } catch (err) {
        console.error("Error fetching stores:", err);
      }
    };
    fetchStores();
  }, []);

  // Re-run totals when timeframe or store changes
  useEffect(() => {
    loadCardTotals();
  }, [cardFilter, selectedSource]);

  // Re-run table data when timeframe or store changes
  useEffect(() => {
    loadTableData();
  }, [tableFilter, selectedSource]);

  // ============================
  // 🔵 LOAD TOTALS FOR SUMMARY CARDS
  // ============================
  const loadCardTotals = async () => {
    try {
      let start, end;
      const now = new Date();

      if (cardFilter === "daily") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else if (cardFilter === "weekly") {
        end = new Date();
        start = new Date();
        start.setDate(end.getDate() - 7);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      let constraints = [
        where("timestamp", ">=", start),
        where("timestamp", "<=", end)
      ];

      // Add store filter if not "all"
      if (selectedSource !== "all") {
        constraints.push(where("source", "==", selectedSource));
      }

      const q = query(collection(db, "sales"), ...constraints);
      const snap = await getDocs(q);

      let cash = 0;
      let transfer = 0;

      snap.docs.forEach((doc) => {
        const sale = doc.data();
        if (sale.paymentMethod === "cash") cash += sale.total || 0;
        if (sale.paymentMethod === "transfer") transfer += sale.total || 0;
      });

      setCashTotal(cash);
      setTransferTotal(transfer);
      setGrandTotal(cash + transfer);
    } catch (error) {
      console.error("Error loading card totals:", error);
    }
  };

  // ============================
  // 🔴 LOAD TABLE DATA ONLY
  // ============================
  const loadTableData = async () => {
    try {
      const now = new Date();
      let start, end;

      if (tableFilter === "daily") {
        const todayStr = now.toISOString().split("T")[0];
        start = new Date(todayStr + "T00:00:00");
        end = new Date(todayStr + "T23:59:59");
      } else if (tableFilter === "weekly") {
        start = new Date();
        start.setDate(now.getDate() - 7);
        end = now;
      } else if (tableFilter === "monthly") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);
      } else if (tableFilter === "range" && fromDate && toDate) {
        start = new Date(fromDate + "T00:00:00");
        end = new Date(toDate + "T23:59:59");
      }

      let constraints = [];
      if (start && end) {
        constraints.push(where("timestamp", ">=", start));
        constraints.push(where("timestamp", "<=", end));
      }

      if (selectedSource !== "all") {
        constraints.push(where("source", "==", selectedSource));
      }

      // Note: If you use multiple where clauses + orderBy, 
      // Firestore requires a composite index.
      const q = query(collection(db, "sales"), ...constraints, orderBy("timestamp", "desc"));
      const snap = await getDocs(q);

      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }));

      setSales(list);
    } catch (err) {
      console.error("Error loading table data:", err);
    }
  };

  return (
    <div className="sales-report-container">
      <div className="report-header">
        <h2>Sales Report</h2>
        
        {/* 🟢 NEW STORE SELECTOR */}
        <div className="store-filter-box">
          <label>Select your store</label>
          <select 
            value={selectedSource} 
            onChange={(e) => setSelectedSource(e.target.value)}
            className="store-select"
          >
            <option value="all">All Locations</option>
            <option value="warehouse">Warehouse</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <hr className="divider" />

      {/* =========================== */}
      {/* 🔵 CARD FILTER BUTTONS */}
      {/* =========================== */}
      <div className="period-filter">
        <button
          className={cardFilter === "daily" ? "active" : ""}
          onClick={() => setCardFilter("daily")}
        >
          Today
        </button>
        <button
          className={cardFilter === "weekly" ? "active" : ""}
          onClick={() => setCardFilter("weekly")}
        >
          Weekly
        </button>
        <button
          className={cardFilter === "monthly" ? "active" : ""}
          onClick={() => setCardFilter("monthly")}
        >
          Monthly
        </button>
      </div>

      {/* =========================== */}
      {/* 🔵 SUMMARY CARDS */}
      {/* =========================== */}
      <div className="summary-row">
        <div className="summary-card cash">
          <h4>Cash Total</h4>
          <p>{formatNumber(cashTotal)} ETB</p>
        </div>
        <div className="summary-card transfer">
          <h4>Bank Transfer</h4>
          <p>{formatNumber(transferTotal)} ETB</p>
        </div>
        <div className="summary-card total">
          <h4>Grand Total</h4>
          <p>{formatNumber(grandTotal)} ETB</p>
        </div>
      </div>

      {/* =========================== */}
      {/* 🔴 TABLE FILTER */}
      {/* =========================== */}
      <div className="filter-row">
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="filter-select"
        >
          <option value="daily">Today</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="range">Custom Range</option>
        </select>

        {tableFilter === "range" && (
          <div className="date-range">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <button onClick={loadTableData}>Apply</button>
          </div>
        )}
      </div>

      {/* =========================== */}
      {/* 🔴 SALES TABLE */}
      {/* =========================== */}
      <div className="table-wrapper">
        <table className="sales-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Method</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            {sales.length > 0 ? (
              sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{sale.timestamp.toLocaleDateString()}</td>
                  <td>{sale.customerName || "—"}</td>
                  <td>{sale.productName || "—"}</td>
                  <td className="method-badge">{sale.paymentMethod}</td>
                  <td>{formatNumber(sale.total)} ETB</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="empty-row">
                  No sales found for this selection
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}