import { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import { collection, getDocs } from "firebase/firestore";
import { FaBox, FaBoxes, FaDollarSign, FaExclamationTriangle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "../styles/OverviewTab.css";

export default function OverviewTab() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    monthlySales: 0,
    salesGrowth: 0,
    lowStockProducts: [],
  });

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const productsSnap = await getDocs(collection(db, "products"));
        const salesSnap = await getDocs(collection(db, "sales"));

        let totalStock = 0;
        let totalProducts = productsSnap.size;
        let lowStockProducts = [];

        productsSnap.forEach((doc) => {
          const data = doc.data();
          const qty = data.quantity || 0;
          totalStock += qty;

          if (qty <= 10) lowStockProducts.push({ name: data.name, quantity: qty });
        });

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let monthlySales = 0;
        let lastMonthSales = 0;

        salesSnap.forEach((doc) => {
          const data = doc.data();
          const saleDate = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
          const total = data.total || 0;

          // This month
          if (saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear) {
            monthlySales += total;
          }

          // Last month
          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          if (saleDate.getMonth() === prevMonth && saleDate.getFullYear() === currentYear) {
            lastMonthSales += total;
          }
        });

        let salesGrowth = 0;
        if (lastMonthSales === 0 && monthlySales > 0) salesGrowth = 100;
        else if (lastMonthSales > 0) {
          salesGrowth = ((monthlySales - lastMonthSales) / lastMonthSales) * 100;
        }

        setStats({
          totalProducts,
          totalStock,
          monthlySales,
          salesGrowth: Math.round(salesGrowth),
          lowStockProducts,
        });
      } catch (error) {
        console.error("Error loading stats:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="overview-tab">
      <div className="overview-top-row">
        <div className="overview-card products">
          <div className="card-icon"><FaBox size={28} /></div>
          <h3>Total Products</h3>
          <p>{stats.totalProducts}</p>
        </div>

        <div className="overview-card stock">
          <div className="card-icon"><FaBoxes size={28} /></div>
          <h3>Total Stock</h3>
          <p>{stats.totalStock}</p>
        </div>

        {/*  CLICKABLE MONTHLY SALES CARD */}
        <div
          className="overview-card sales clickable"
          onClick={() => navigate("/sales-report")}
        >
          <div className="card-icon"><FaDollarSign size={28} /></div>
          <h3>Monthly Sales</h3>
          <p>${stats.monthlySales} (+{stats.salesGrowth}%)</p>
        </div>
      </div>

      <div className="overview-bottom-row">
        <div className="overview-card low-stock">
          <div className="card-icon"><FaExclamationTriangle size={28} /></div>
          <h3>Low Stock Products (≤10)</h3>

          {stats.lowStockProducts.length > 0 ? (
            <ul>
              {stats.lowStockProducts.map((p, idx) => (
                <li key={idx}>{p.name} - {p.quantity} left</li>
              ))}
            </ul>
          ) : (
            <p>All products are sufficiently stocked</p>
          )}
        </div>
      </div>
    </div>
  );
}