import { useState } from "react";
import { auth } from "../utils/firebase";
import { signOut } from "firebase/auth";
import DashboardTabs from "../components/DashboardTabs";
import OverviewTab from "../components/OverviewTab";
import HistoryTab from "../components/HistoryTab";
import Header from "../components/Header";
import "../styles/DashboardPage.css";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview"); // overview | history

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      await signOut(auth);
      window.location.href = "/login";
    }
  };

  return (
    <div className="dashboard-page">
      {/* Header */}
      <Header />

      {/* Tabs */}
      <DashboardTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      <div className="dashboard-content">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "history" && <HistoryTab />}
      </div>

      {/* Logout Button */}
    
      <div className="logout-container">
        <button className="logout-btn" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
}