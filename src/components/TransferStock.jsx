import { useState, useEffect } from "react";
import { db } from "../utils/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { toast, Toaster } from "react-hot-toast";
import "../styles/TransferStock.css";

export default function TransferStock() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Stores states
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");

  // Modal states
  const [showAllModal, setShowAllModal] = useState(false);
  const [allTransfers, setAllTransfers] = useState([]);

  // Fetch warehouse products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => Number(item.quantity) > 0);
      setProducts(items);
      setFilteredProducts(items);
    });
    return () => unsub();
  }, []);

  // Fetch stores list
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "stores"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStores(list);
    });
    return () => unsub();
  }, []);

  // Live filter for suggestions
  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      setFilteredProducts(products);
      return;
    }
    if (selectedProduct && selectedProduct.name.toLowerCase() === q) {
      setShowSuggestions(false);
      return;
    }
    const results = products.filter((p) =>
      p.name.toLowerCase().includes(q)
    );
    setFilteredProducts(results);
  }, [search, products, selectedProduct]);

  // Recent transfer history (Listener)
  useEffect(() => {
    const q = query(
      collection(db, "transfer_history"),
      orderBy("timestamp", "desc"),
      limit(5)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setRecentTransfers(snapshot.docs.map((d) => d.data()));
    });
    return () => unsub();
  }, []);

  // Fetch ALL history for the modal
  const fetchAllHistory = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "transfer_history"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      setAllTransfers(snapshot.docs.map(d => d.data()));
      setShowAllModal(true);
    } catch (err) {
      toast.error("Failed to load full history");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!selectedStore) return toast.error("Please select a destination store.");
    if (!selectedProduct || isNaN(qty) || qty <= 0) return toast.error("Please select a product and valid quantity.");

    setLoading(true);
    try {
      const productRef = doc(db, "products", selectedProduct.id);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        toast.error("Product not found.");
        setLoading(false);
        return;
      }

      const product = productSnap.data();
      const warehouseQty = Number(product.quantity || 0);

      if (qty > warehouseQty) {
        toast.error("Not enough stock.");
        setLoading(false);
        return;
      }

      await updateDoc(productRef, { quantity: warehouseQty - qty });

      const storeProductsRef = collection(db, "stores", selectedStore, "products");
      const storeSnap = await getDocs(storeProductsRef);
      const existing = storeSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((p) => p.name && p.name.toLowerCase() === product.name.toLowerCase());

      if (existing) {
        const storeProductRef = doc(db, "stores", selectedStore, "products", existing.id);
        await updateDoc(storeProductRef, {
          quantity: Number(existing.quantity || 0) + qty,
          transferredAt: serverTimestamp(),
          categoryId: product.categoryId,
        });
      } else {
        await addDoc(storeProductsRef, {
          name: product.name,
          nameLower: product.name.toLowerCase(),
          price: product.price ?? 0,
          quantity: qty,
          transferredAt: serverTimestamp(),
          categoryId: product.categoryId,
        });
      }

      const storeMeta = stores.find((s) => s.id === selectedStore);
      await addDoc(collection(db, "transfer_history"), {
        productId: selectedProduct.id,
        productName: product.name,
        quantity: qty,
        storeId: selectedStore,
        storeName: storeMeta?.name || "",
        timestamp: serverTimestamp(),
      });

      toast.success("Stock transferred successfully!");
      setSearch("");
      setSelectedProduct(null);
      setQuantity("");
      setShowSuggestions(false);
    } catch (err) {
      console.error(err);
      toast.error("Transfer failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="transfer-stock-page">
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { fontSize: "14px" } }} />

      <form className="transfer-form" onSubmit={handleTransfer}>
        <label className="autocomplete-label">
          Warehouse Product
          <input
            type="text"
            placeholder="Search product..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedProduct(null);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            autoComplete="off"
          />
          {showSuggestions && search && filteredProducts.length > 0 && (
            <ul className="suggestion-list">
              {filteredProducts.map((p) => (
                <li key={p.id} onClick={() => { setSelectedProduct(p); setSearch(p.name); setShowSuggestions(false); }}>
                  {p.name} ({p.quantity})
                </li>
              ))}
            </ul>
          )}
        </label>

        <input type="number" placeholder="Quantity to transfer" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        
        <label className="store-select-label">
          Select Store
          <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)}>
            <option value="">Choose store</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
          </select>
        </label>

        <button type="submit" disabled={loading}>{loading ? "Transferring..." : "Transfer Stock"}</button>
      </form>

      <div className="recent-transfers">
        <div className="section-header">
          <h3>Recent Transfers</h3>
          <button className="view-all-btn" onClick={fetchAllHistory}>View All</button>
        </div>
        
        {recentTransfers.length > 0 ? (
          <div className="transfer-list">
            {recentTransfers.map((t, i) => (
              <div className="transfer-card" key={i}>
                <div className="transfer-info">
                  <strong>{t.productName}</strong>
                  <span>Qty: {t.quantity}</span>
                  <div className="transfer-store">{t.storeName ? `→ ${t.storeName}` : ""}</div>
                </div>
                <div className="transfer-date">
                  {t.timestamp?.toDate ? t.timestamp.toDate().toLocaleString() : "Just now"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">No recent transfers</p>
        )}
      </div>

      {/* ALL TIME TRANSFERS MODAL */}
      {showAllModal && (
        <div className="modal-overlay" onClick={() => setShowAllModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>All Time Transfers</h3>
              <button className="close-btn" onClick={() => setShowAllModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Store</th>
                  </tr>
                </thead>
                <tbody>
                  {allTransfers.map((t, i) => (
                    <tr key={i}>
                      <td>{t.timestamp?.toDate ? t.timestamp.toDate().toLocaleDateString() : "-"}</td>
                      <td><strong>{t.productName}</strong></td>
                      <td>{t.quantity}</td>
                      <td>{t.storeName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allTransfers.length === 0 && <p className="empty-text">No records found.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}