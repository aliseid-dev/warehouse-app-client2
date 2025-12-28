import React, { useState, useEffect } from "react";
import { db } from "../utils/firebase";
import {
  collection, doc, addDoc, updateDoc, getDocs, deleteDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp, getDoc
} from "firebase/firestore";
import { toast, Toaster } from "react-hot-toast";
import { 
  FaPlus, FaExchangeAlt, FaTags, FaWarehouse, FaStore, 
  FaSearch, FaBox, FaMoneyBillWave, FaListUl, FaHashtag, FaUndo, FaTrash 
} from "react-icons/fa";
import Header from "../components/Header";
import "../styles/ManageInventory.css";

export default function ManageInventory() {
  const [activeTab, setActiveTab] = useState("add"); 
  const [loading, setLoading] = useState(false);

  // Data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [logs, setLogs] = useState([]);

  // Form states
  const [targetLocation, setTargetLocation] = useState("warehouse"); 
  const [formData, setFormData] = useState({
    name: "", quantity: "", price: "", categoryId: "", newCategoryName: ""
  });
  
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedStore, setSelectedStore] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // --- Real-time Data Listeners ---
  useEffect(() => {
    const unsubProd = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCat = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubStore = onSnapshot(collection(db, "stores"), (snap) => {
      setStores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const qLogs = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(20));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubProd(); unsubCat(); unsubStore(); unsubLogs(); };
  }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q || selectedProduct) { setFiltered([]); return; }
    setFiltered(products.filter(p => p.name.toLowerCase().includes(q)));
  }, [search, products, selectedProduct]);

  // --- HANDLER: Add Category ---
  const handleAddCategory = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const catName = formData.newCategoryName?.trim();
    if (!catName) return toast.error("Enter category name");

    setLoading(true);
    try {
      await addDoc(collection(db, "categories"), {
        name: catName,
        createdAt: serverTimestamp()
      });
      toast.success("Category created");
      setFormData(prev => ({ ...prev, newCategoryName: "" }));
    } catch (err) {
      toast.error("Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER: Add Product + Log ---
  const handleAddProduct = async (e) => {
    e.preventDefault();
    const { name, quantity, price, categoryId } = formData;
    if (!name || !quantity || !price || !categoryId) return toast.error("Fill all fields");

    setLoading(true);
    try {
      const colPath = targetLocation === "warehouse" ? "products" : `stores/${targetLocation}/products`;
      const docRef = await addDoc(collection(db, colPath), {
        name, quantity: Number(quantity), price: Number(price), categoryId, createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "activity_logs"), {
        type: "ADDITION",
        productId: docRef.id,
        path: colPath,
        name,
        quantity: Number(quantity),
        locationName: targetLocation === "warehouse" ? "Warehouse" : stores.find(s => s.id === targetLocation)?.name,
        timestamp: serverTimestamp(),
        undone: false
      });

      toast.success("Product added");
      setFormData({ ...formData, name: "", quantity: "", price: "", categoryId: "" });
    } catch (err) { toast.error("Error adding product"); }
    finally { setLoading(false); }
  };

  // --- HANDLER: Transfer + Log ---
  const handleTransfer = async (e) => {
    e.preventDefault();
    const qty = Number(formData.quantity);
    if (!selectedProduct || !selectedStore || qty <= 0) return toast.error("Check inputs");

    setLoading(true);
    try {
      await updateDoc(doc(db, "products", selectedProduct.id), { quantity: selectedProduct.quantity - qty });
      const storeProdRef = collection(db, "stores", selectedStore, "products");
      const storeSnap = await getDocs(storeProdRef);
      const existing = storeSnap.docs.find(d => d.data().name === selectedProduct.name);
      let storeProdId;

      if (existing) {
        storeProdId = existing.id;
        await updateDoc(doc(db, "stores", selectedStore, "products", existing.id), {
          quantity: Number(existing.data().quantity) + qty
        });
      } else {
        const newDoc = await addDoc(storeProdRef, {
          name: selectedProduct.name, price: selectedProduct.price, quantity: qty, categoryId: selectedProduct.categoryId
        });
        storeProdId = newDoc.id;
      }

      await addDoc(collection(db, "activity_logs"), {
        type: "TRANSFER",
        warehouseProdId: selectedProduct.id,
        storeProdId: storeProdId,
        storeId: selectedStore,
        name: selectedProduct.name,
        quantity: qty,
        locationName: stores.find(s => s.id === selectedStore)?.name,
        timestamp: serverTimestamp(),
        undone: false
      });

      toast.success("Transfer successful");
      setSearch(""); setSelectedProduct(null); setFormData({...formData, quantity: ""});
    } catch (err) { toast.error("Transfer failed"); }
    finally { setLoading(false); }
  };

  // --- HANDLER: UNDO ACTION ---
  const handleUndo = async (log) => {
    if (log.undone) return;
    setLoading(true);
    try {
      if (log.type === "ADDITION") {
        const docRef = doc(db, log.path, log.productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const currentQty = docSnap.data().quantity;
          if (currentQty <= log.quantity) await deleteDoc(docRef);
          else await updateDoc(docRef, { quantity: currentQty - log.quantity });
        }
      } else if (log.type === "TRANSFER") {
        const wRef = doc(db, "products", log.warehouseProdId);
        const wSnap = await getDoc(wRef);
        if (wSnap.exists()) await updateDoc(wRef, { quantity: wSnap.data().quantity + log.quantity });

        const sRef = doc(db, `stores/${log.storeId}/products`, log.storeProdId);
        const sSnap = await getDoc(sRef);
        if (sSnap.exists()) {
          const newSQty = sSnap.data().quantity - log.quantity;
          if (newSQty <= 0) await deleteDoc(sRef);
          else await updateDoc(sRef, { quantity: newSQty });
        }
      }
      await updateDoc(doc(db, "activity_logs", log.id), { undone: true });
      toast.success("Action reversed!");
    } catch (err) { toast.error("Undo failed"); }
    finally { setLoading(false); }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm("Delete this category?")) {
      await deleteDoc(doc(db, "categories", id));
      toast.success("Category removed");
    }
  };

  return (
    <div className="manage-page-container">
      <Header />
      <Toaster position="top-right" />

      <div className="manage-wrapper">
        <h2 className="manage-title">Inventory Management</h2>

        <div className="tabs-nav scrollable-tabs">
          <button className={activeTab === "add" ? "active" : ""} onClick={() => setActiveTab("add")}><FaPlus /> Add</button>
          <button className={activeTab === "transfer" ? "active" : ""} onClick={() => setActiveTab("transfer")}><FaExchangeAlt /> Transfer</button>
          <button className={activeTab === "category" ? "active" : ""} onClick={() => setActiveTab("category")}><FaTags /> Categories</button>
          <button className={activeTab === "undo" ? "active" : ""} onClick={() => setActiveTab("undo")}><FaUndo /> Undo</button>
        </div>

        <div className="manage-card">
          {activeTab === "add" && (
            <form onSubmit={handleAddProduct} className="form-grid">
              <h3>Direct Entry</h3>
              
              <div className="label-group">
                <label className="field-label"><FaStore /> Destination Location</label>
                <select value={targetLocation} onChange={(e) => setTargetLocation(e.target.value)}>
                  <option value="warehouse">Central Warehouse</option>
                  {stores.map(s => <option key={s.id} value={s.id}>Store: {s.name}</option>)}
                </select>
              </div>

              <div className="label-group">
                <label className="field-label"><FaBox /> Product Name</label>
                <input type="text" placeholder="Enter name" value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="label-group">
                <label className="field-label"><FaListUl /> Category</label>
                <select value={formData.categoryId || ""} onChange={(e) => setFormData({...formData, categoryId: e.target.value})}>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              <div className="form-row-compact">
                <div className="label-group">
                  <label className="field-label"><FaHashtag /> Quantity</label>
                  <input type="number" placeholder="0" value={formData.quantity || ""} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
                </div>
                <div className="label-group">
                  <label className="field-label"><FaMoneyBillWave /> Price (ETB)</label>
                  <input type="number" placeholder="0.00" value={formData.price || ""} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                </div>
              </div>

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Processing..." : "Save to Inventory"}
              </button>
            </form>
          )}

          {activeTab === "undo" && (
            <div className="undo-section">
              <h3>Recent Actions</h3>
              <div className="logs-list">
                {logs.length === 0 && <p className="empty-text">No recent actions</p>}
                {logs.map(log => (
                  <div key={log.id} className={`log-item ${log.undone ? 'is-undone' : ''}`}>
                    <div className="log-info">
                      <span className="log-type">{log.type}</span>
                      <p><strong>{log.name}</strong> ({log.quantity} units)</p>
                      <small>{log.type === "ADDITION" ? `Added to ${log.locationName}` : `Moved to ${log.locationName}`}</small>
                    </div>
                    {!log.undone && (
                      <button className="btn-undo-action" onClick={() => handleUndo(log)} disabled={loading}>
                        <FaUndo /> Undo Change
                      </button>
                    )}
                    {log.undone && <span className="undone-badge">Action Undone</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "category" && (
            <div className="form-grid">
              <h3>Category Management</h3>
              <form onSubmit={handleAddCategory} className="label-group">
                <label className="field-label"><FaTags /> New Category Name</label>
                <div className="category-input-row">
                  <input 
                    type="text" 
                    placeholder="e.g. Electronics" 
                    value={formData.newCategoryName || ""} 
                    onChange={(e) => setFormData({...formData, newCategoryName: e.target.value})} 
                  />
                  <button className="btn-icon-add" type="submit" disabled={loading}>
                    <FaPlus />
                  </button>
                </div>
              </form>
              
              <div className="category-preview">
                 <label className="field-label"><FaListUl /> Current Categories</label>
                 <div className="category-list">
                    {categories.length > 0 ? (
                      categories.map(cat => (
                        <div key={cat.id} className="cat-row">
                          <span>{cat.name}</span>
                          <FaTrash className="delete-icon" onClick={() => handleDeleteCategory(cat.id)} />
                        </div>
                      ))
                    ) : <p className="empty-text">No categories yet</p>}
                 </div>
              </div>
            </div>
          )}

          {activeTab === "transfer" && (
            <form onSubmit={handleTransfer} className="form-grid">
              <h3>Stock Transfer</h3>
              
              <div className="label-group">
                <label className="field-label"><FaSearch /> Select Warehouse Item</label>
                <div className="search-box">
                  <input 
                    type="text" 
                    className="search-input-manage"
                    placeholder="Search products..." 
                    value={search || ""} 
                    onChange={(e) => { 
                        setSearch(e.target.value); 
                        setSelectedProduct(null); 
                        setShowSuggestions(true); 
                    }}
                  />
                  {showSuggestions && filtered.length > 0 && (
                    <ul className="manage-suggestions">
                      {filtered.map(p => (
                        <li key={p.id} onClick={() => { 
                            setSelectedProduct(p); 
                            setSearch(p.name); 
                            setShowSuggestions(false); 
                        }}>
                          {p.name} (In Stock: {p.quantity})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="form-row-compact">
                <div className="label-group">
                  <label className="field-label"><FaHashtag /> Amount to Move</label>
                  <input type="number" placeholder="Quantity" value={formData.quantity || ""} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
                </div>
                <div className="label-group">
                  <label className="field-label"><FaStore /> Target Store</label>
                  <select value={selectedStore || ""} onChange={(e) => setSelectedStore(e.target.value)}>
                    <option value="">Choose store</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <button className="btn-transfer" type="submit" disabled={loading}>
                 {loading ? "Processing..." : "Confirm Stock Transfer"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}