import { useState, useEffect } from "react";
import { db, auth } from "../utils/firebase";
import { signOut } from "firebase/auth";
import { collection, query, orderBy, getDocs, doc, updateDoc, addDoc, deleteDoc } from "firebase/firestore";
import { 
  FaBoxes, FaExclamationTriangle, FaUserShield, FaChartBar, 
  FaSignOutAlt, FaArrowRight, FaUsers, FaStore, FaPlus, FaTrash, FaLock 
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { toast, Toaster } from "react-hot-toast";
import "../styles/DashboardPage.css";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [newStoreName, setNewStoreName] = useState("");
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    stockValue: 0,
    lowStockProducts: [],
  });

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      await signOut(auth);
      window.location.href = "/login";
    }
  };

  const updateUserField = async (userId, field, value) => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { [field]: value });
      toast.success(`User updated successfully`);
      fetchData(); 
    } catch (error) {
      toast.error("Update failed");
    }
  };

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return;
    try {
      await addDoc(collection(db, "stores"), { name: newStoreName });
      setNewStoreName("");
      toast.success("Store added");
      fetchData();
    } catch (error) { toast.error("Error adding store"); }
  };

  const handleDeleteStore = async (id) => {
    if (window.confirm("Delete this store? This will leave assigned users 'Unassigned'.")) {
      await deleteDoc(doc(db, "stores", id));
      toast.success("Store removed");
      fetchData();
    }
  };

  const fetchData = async () => {
    try {
      const productsSnap = await getDocs(collection(db, "products"));
      let totalStock = 0, stockValue = 0, lowStock = [];
      productsSnap.forEach((doc) => {
        const data = doc.data();
        const qty = Number(data.quantity) || 0;
        totalStock += qty;
        stockValue += (qty * (Number(data.price) || 0));
        if (qty <= 10) lowStock.push({ name: data.name, quantity: qty });
      });

      const storesSnap = await getDocs(collection(db, "stores"));
      const usersSnap = await getDocs(collection(db, "users"));
      
      setStores(storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      setStats({
        totalProducts: productsSnap.size,
        totalStock,
        stockValue,
        lowStockProducts: lowStock,
      });
    } catch (error) { 
        console.error(error); 
        toast.error("Failed to load data");
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="admin-loading">Loading Admin Console...</div>;

  return (
    <div className="dashboard-page">
      <Toaster />
      <Header />

      <div className="admin-container">
        {/* TOP STATS */}
        <div className="stats-grid-top">
          <div className="glass-card-mini" onClick={() => navigate("/sales-report")}>
             <FaChartBar className="icon blue" />
             <div>
               <label>Sales Report</label>
               <p>View Details</p>
             </div>
          </div>
          <div className="glass-card-mini">
             <FaBoxes className="icon green" />
             <div>
               <label>Stock Value</label>
               <p>{stats.stockValue.toLocaleString()} ETB</p>
             </div>
          </div>
        </div>

        {/* USER MANAGEMENT SECTION */}
        <section className="admin-section">
          <div className="section-header">
            <h3><FaUsers /> User Management</h3>
            <p>Set permissions. Users with "Unassigned" store are locked out of sales.</p>
          </div>
          
          <div className="user-cards-list">
            {users.map(u => (
              <div key={u.id} className={`user-card ${!u.assignedStoreId && u.role !== 'admin' ? 'unassigned-border' : ''}`}>
                <div className="user-card-header">
                  <div className="user-info-main">
                    <strong>{u.name || u.email.split('@')[0]}</strong>
                    {!u.assignedStoreId && u.role !== 'admin' && (
                        <span className="lock-tag"><FaLock /> Locked</span>
                    )}
                  </div>
                  <span>{u.email}</span>
                </div>

                <div className="user-card-actions">
                  <div className="input-group">
                    <label>Role</label>
                    <select 
                      value={u.role || "staff"}
                      className={`role-select ${u.role}`}
                      onChange={(e) => updateUserField(u.id, "role", e.target.value)}
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Assign Store</label>
                    <select 
                      value={u.assignedStoreId || ""}
                      className={`store-select-input ${!u.assignedStoreId ? 'warning-bg' : ''}`}
                      onChange={(e) => updateUserField(u.id, "assignedStoreId", e.target.value)}
                    >
                      <option value="">Unassigned (Locked)</option>
                      <option value="warehouse">Warehouse (Main)</option>
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* STORE LOCATIONS SECTION */}
        <section className="admin-section">
          <h3><FaStore /> Manage Store Locations</h3>
          <div className="store-management-box">
            <div className="add-store-form">
              <input 
                type="text" 
                placeholder="Enter new store name..." 
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
              />
              <button onClick={handleAddStore} className="add-btn"><FaPlus /> Add Store</button>
            </div>
            <div className="stores-list">
              {stores.map(s => (
                <div key={s.id} className="store-pill">
                  <span>{s.name}</span>
                  <FaTrash className="del-btn" onClick={() => handleDeleteStore(s.id)} title="Delete Store" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LOW STOCK ALERT */}
        {stats.lowStockProducts.length > 0 && (
          <div className="low-stock-banner">
            <FaExclamationTriangle />
            <span>{stats.lowStockProducts.length} products are low on stock!</span>
          </div>
        )}

        <button className="full-logout-btn" onClick={handleLogout}><FaSignOutAlt /> Sign Out</button>
      </div>
    </div>
  );
}