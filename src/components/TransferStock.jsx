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
  where,
} from "firebase/firestore";
import MessageBox from "./MessageBox";
import "../styles/TransferStock.css";

export default function TransferStock() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // stores & selectedStore
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");

  // Fetch warehouse products (only with qty > 0)
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

    // if already selected same product, hide suggestions
    if (selectedProduct && selectedProduct.name.toLowerCase() === q) {
      setShowSuggestions(false);
      return;
    }

    const results = products.filter((p) =>
      p.name.toLowerCase().includes(q)
    );
    setFilteredProducts(results);
  }, [search, products, selectedProduct]);

  // Recent transfer history (latest 5)
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

  // Transfer handler
  const handleTransfer = async (e) => {
    e.preventDefault();
    setMessage(null);

    const qty = Number(quantity);
    if (!selectedStore) {
      setMessage({ type: "error", text: "Please select a destination store." });
      return;
    }

    if (!selectedProduct || isNaN(qty) || qty <= 0) {
      setMessage({
        type: "error",
        text: "Please select a product and enter a valid quantity.",
      });
      return;
    }

    setLoading(true);

    try {
      // Get fresh warehouse product
      const productRef = doc(db, "products", selectedProduct.id);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        setMessage({ type: "error", text: "Product not found in warehouse." });
        setLoading(false);
        return;
      }

      const product = productSnap.data();
      const warehouseQty = Number(product.quantity || 0);

      if (qty > warehouseQty) {
        setMessage({ type: "error", text: "Not enough stock in warehouse." });
        setLoading(false);
        return;
      }

      // decrease warehouse stock
      await updateDoc(productRef, { quantity: warehouseQty - qty });

      // target store products collection
      const storeProductsRef = collection(db, "stores", selectedStore, "products");

      // fetch store products and try to find by name (case-insensitive)
      const storeSnap = await getDocs(storeProductsRef);
      const existing = storeSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((p) => p.name && p.name.toLowerCase() === product.name.toLowerCase());

      if (existing) {
        // update existing product quantity
        const storeProductRef = doc(db, "stores", selectedStore, "products", existing.id);
        await updateDoc(storeProductRef, {
          quantity: Number(existing.quantity || 0) + qty,
          transferredAt: serverTimestamp(),
          categoryId: product.categoryId,
        });
      } else {
        // add new product to store
        await addDoc(storeProductsRef, {
          name: product.name,
          nameLower: product.name.toLowerCase(),
          price: product.price ?? 0,
          quantity: qty,
          transferredAt: serverTimestamp(),
          categoryId: product.categoryId,
        });
      }

      // log transfer with store info
      const storeMeta = stores.find((s) => s.id === selectedStore);
      await addDoc(collection(db, "transfer_history"), {
        productId: selectedProduct.id,
        productName: product.name,
        quantity: qty,
        storeId: selectedStore,
        storeName: storeMeta?.name || "",
        timestamp: serverTimestamp(),
      });

      setMessage({ type: "success", text: "✅ Stock transferred successfully!" });
      setSearch("");
      setSelectedProduct(null);
      setQuantity("");
      setShowSuggestions(false);
    } catch (err) {
      console.error("Transfer error:", err);
      setMessage({ type: "error", text: "❌ Transfer failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="transfer-stock-page">
      {message && (
        <MessageBox
          message={message.text}
          type={message.type}
          onClose={() => setMessage(null)}
        />
      )}

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
                <li
                  key={p.id}
                  onClick={() => {
                    setSelectedProduct(p);
                    setSearch(p.name);
                    setShowSuggestions(false);
                  }}
                >
                  {p.name} ({p.quantity})
                </li>
              ))}
            </ul>
          )}

          {showSuggestions && search && filteredProducts.length === 0 && (
            <ul className="suggestion-list">
              <li className="no-result">No product found</li>
            </ul>
          )}
        </label>

        <input
          type="number"
          placeholder="Quantity to transfer"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <label className="store-select-label">
          Select Store
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <option value="">Choose store</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.id}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Transferring..." : "Transfer Stock"}
        </button>
      </form>

      {/* Recent transfers */}
      <div className="recent-transfers">
        <h3>Recent Transfers</h3>
        {recentTransfers.length > 0 ? (
          <div className="transfer-list">
            {recentTransfers.map((t, i) => (
              <div className="transfer-card" key={i}>
                <div className="transfer-info">
                  <strong>{t.productName}</strong>
                  <span>Qty: {t.quantity}</span>
                  <div className="transfer-store">
                    {t.storeName ? `→ ${t.storeName}` : ""}
                  </div>
                </div>
                <div className="transfer-date">
                  {t.timestamp?.toDate
                    ? t.timestamp.toDate().toLocaleString()
                    : new Date().toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">No recent transfers</p>
        )}
      </div>
    </div>
  );
}