import { useState } from "react";
import Header from "../components/Header"; // <-- your existing header
import ProductList from "../components/ProductList";
import WarehouseManage from "../pages/WarehouseManage";
import "../styles/WarehousePage.css";

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState("products");

  return (
    <div className="warehouse-page">
      {/* Header at the top, independent of page content */}
      <Header title="Warehouse" />

      {/* Main Content */}
      <div className="warehouse-main">
        {/* Tabs */}
        <div className="dashboard-tabs"> 
          <button
            className={`tab-btn ${activeTab === "products" ? "active" : ""}`}
            onClick={() => setActiveTab("products")}
          >
            Products
          </button>
          <button
            className={`tab-btn ${activeTab === "manage" ? "active" : ""}`}
            onClick={() => setActiveTab("manage")}
          >
            Manage
          </button>
        </div>

        {/* Tab Content */}
        <div className="warehouse-content">
          {activeTab === "products" && <ProductList />}
          {activeTab === "manage" && <WarehouseManage />}
        </div>
      </div>
    </div>
  );
}