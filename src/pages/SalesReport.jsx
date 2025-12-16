import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import "../styles/SalesReport.css";

export default function SalesReport() {
  const [sales, setSales] = useState([]);

  // 🔵 FILTER FOR CARDS ONLY
  const [cardFilter, setCardFilter] = useState("monthly");

  // 🔴 FILTER FOR TABLE ONLY
  const [tableFilter, setTableFilter] = useState("monthly");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [cashTotal, setCashTotal] = useState(0);
  const [transferTotal, setTransferTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    loadCardTotals();
  }, [cardFilter]);

  useEffect(() => {
    loadTableData();
  }, [tableFilter]);

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
      }

      if (cardFilter === "weekly") {
        end = new Date();
        start = new Date();
        start.setDate(end.getDate() - 7);
      }

      if (cardFilter === "monthly") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      const q = query(
        collection(db, "sales"),
        where("timestamp", ">=", start),
        where("timestamp", "<=", end)
      );

      const snap = await getDocs(q);

      let cash = 0;
      let transfer = 0;

      snap.docs.forEach((doc) => {
        const sale = doc.data();
        if (sale.paymentMethod === "cash") cash += sale.total;
        if (sale.paymentMethod === "transfer") transfer += sale.total;
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
      let q = collection(db, "sales");
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

      if (tableFilter === "daily") {
        q = query(
          collection(db, "sales"),
          where("timestamp", ">=", new Date(todayStr + "T00:00:00")),
          where("timestamp", "<=", new Date(todayStr + "T23:59:59"))
        );
      }

      if (tableFilter === "weekly") {
        const start = new Date();
        start.setDate(now.getDate() - 7);

        q = query(
          collection(db, "sales"),
          where("timestamp", ">=", start),
          where("timestamp", "<=", now)
        );
      }

      if (tableFilter === "monthly") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);

        q = query(
          collection(db, "sales"),
          where("timestamp", ">=", start),
          where("timestamp", "<=", end)
        );
      }

      if (tableFilter === "range" && fromDate && toDate) {
        q = query(
          collection(db, "sales"),
          where("timestamp", ">=", new Date(fromDate + "T00:00:00")),
          where("timestamp", "<=", new Date(toDate + "T23:59:59"))
        );
      }

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
      <h2>Sales Report</h2>

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
          <p>${cashTotal}</p>
        </div>

        <div className="summary-card transfer">
          <h4>Bank Transfer</h4>
          <p>${transferTotal}</p>
        </div>

        <div className="summary-card total">
          <h4>Grand Total</h4>
          <p>${grandTotal}</p>
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
                  <td>{sale.paymentMethod}</td>
                  <td>${sale.total}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="empty-row">
                  No sales found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}