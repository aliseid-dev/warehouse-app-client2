import { useState, useEffect } from "react";
import { db } from "../utils/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
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

  // Fetch warehouse products
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const items = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => item.quantity > 0);
      setProducts(items);
      setFilteredProducts(items);
    });
    return () => unsubscribe();
  }, []);

  // Filter live as user types
  useEffect(() => {
    const query = search.toLowerCase();
    const results = products.filter((p) =>
      p.name.toLowerCase().includes(query)
    );
    setFilteredProducts(results);
  }, [search, products]);

  // Fetch recent transfer history
  useEffect(() => {
    const q = query(
      collection(db, "transfer_history"),
      orderBy("timestamp", "desc"),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentTransfers(snapshot.docs.map((doc) => doc.data()));
    });
    return () => unsubscribe();
  }, []);

  const handleTransfer = async (e) => {
  e.preventDefault();
  const qty = Number(quantity);

  if (!selectedProduct || isNaN(qty) || qty <= 0) {
    setMessage({
      type: "error",
      text: "Please select a product and enter a valid quantity",
    });
    return;
  }

  setLoading(true);

  try {
    // Get warehouse product
    const productRef = doc(db, "products", selectedProduct.id);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      setMessage({ type: "error", text: "Product not found in warehouse" });
      setLoading(false);
      return;
    }

    const product = productSnap.data();

    if (qty > product.quantity) {
      setMessage({ type: "error", text: "Not enough stock in warehouse" });
      setLoading(false);
      return;
    }

    // ✅ Decrease warehouse stock
    await updateDoc(productRef, { quantity: product.quantity - qty });

    // ✅ Check if store already has this product by name
    const storeProductsRef = collection(db, "storeProducts");
    const storeSnapshot = await onSnapshot(storeProductsRef, () => {}); // just to ensure real-time cache is ready

    const qStore = query(storeProductsRef);
    const snapshot = await getDocs(qStore);
    const existingStoreProduct = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .find(
        (p) => p.name.toLowerCase() === product.name.toLowerCase()
      );

    if (existingStoreProduct) {
      // ✅ Update existing store product quantity
      const storeRef = doc(db, "storeProducts", existingStoreProduct.id);
      await updateDoc(storeRef, {
        quantity: existingStoreProduct.quantity + qty,
        transferredAt: serverTimestamp(),
      });
    } else {
      // ✅ Create new product in store
      await setDoc(doc(collection(db, "storeProducts")), {
        name: product.name,
        price: product.price ?? 0,
        quantity: qty,
        transferredAt: serverTimestamp(),
      });
    }

    // ✅ Log transfer history
    await setDoc(doc(collection(db, "transfer_history")), {
      productId: selectedProduct.id,
      productName: product.name,
      quantity: qty,
      timestamp: serverTimestamp(),
    });

    setMessage({ type: "success", text: "✅ Stock transferred successfully!" });
    setSearch("");
    setSelectedProduct(null);
    setQuantity("");
  } catch (err) {
    console.error(err);
    setMessage({ type: "error", text: "❌ Transfer failed" });
  }

  setLoading(false);
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

      {/* Transfer Form */}
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
            }}
          />
          {search && filteredProducts.length > 0 && (
            <ul className="suggestion-list">
              {filteredProducts.map((p) => (
                <li
                  key={p.id}
                  onClick={() => {
                    setSelectedProduct(p);
                    setSearch(p.name);
                    setFilteredProducts([]);
                  }}
                >
                  {p.name} ({p.quantity})
                </li>
              ))}
            </ul>
          )}
          {search && filteredProducts.length === 0 && (
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

        <button type="submit" disabled={loading}>
          {loading ? "Transferring..." : "Transfer Stock"}
        </button>
      </form>

      {/* Recent Transfers */}
      <div className="recent-transfers">
        <h3>Recent Transfers</h3>
        {recentTransfers.length > 0 ? (
          <div className="transfer-list">
            {recentTransfers.map((t, i) => (
              <div className="transfer-card" key={i}>
                <div className="transfer-info">
                  <strong>{t.productName}</strong>
                  <span>Qty: {t.quantity}</span>
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