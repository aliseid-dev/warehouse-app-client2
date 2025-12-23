import { useState, useEffect } from "react";
import { db } from "../utils/firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { toast, Toaster } from "react-hot-toast"; // 1. Added these
import "../styles/WarehouseManage.css";

export default function WarehouseManage() {
  const [activeTab, setActiveTab] = useState("add");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // form states
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // autocomplete states
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [filtered, setFiltered] = useState([]);

  /** Fetch products */
  useEffect(() => {
    const fetchProducts = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchProducts();
  }, [loading]);

  /** Fetch categories */
  useEffect(() => {
    const fetchCategories = async () => {
      const snapshot = await getDocs(collection(db, "categories"));
      setCategories(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchCategories();
  }, []);

  /** Fetch recent history */
  useEffect(() => {
    const fetchHistory = async () => {
      const q = query(
        collection(db, "warehouse_history"),
        orderBy("timestamp", "desc"),
        limit(5)
      );
      const snapshot = await getDocs(q);
      setHistory(snapshot.docs.map((doc) => doc.data()));
    };
    fetchHistory();
  }, [loading]);

  /** Autocomplete search */
  useEffect(() => {
    if (!search.trim()) {
      setFiltered([]);
      return;
    }
    setFiltered(
      products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, products]);

  /** Add product */
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !quantity || !price || !categoryId) {
      toast.error("Please fill all fields"); // 2. Trigger toast
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "products"), {
        name,
        quantity: Number(quantity),
        price: Number(price),
        categoryId,
        dateAdded: serverTimestamp(),
      });

      await addDoc(collection(db, "warehouse_history"), {
        action: "Added New Product",
        productName: name,
        quantity: Number(quantity),
        timestamp: serverTimestamp(),
      });

      toast.success("Product added successfully"); // 3. Success toast
      setName("");
      setQuantity("");
      setPrice("");
      setCategoryId("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add product");
    }
    setLoading(false);
  };

  /** Increase stock only */
  const handleStockUpdate = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !quantity) {
      toast.error("Please select a product and quantity");
      return;
    }

    const productRef = doc(db, "products", selectedProduct.id);
    const newQty = selectedProduct.quantity + Number(quantity);

    setLoading(true);
    try {
      await updateDoc(productRef, { quantity: newQty });

      await addDoc(collection(db, "warehouse_history"), {
        action: "Increased Stock",
        productName: selectedProduct.name,
        quantity: Number(quantity),
        timestamp: serverTimestamp(),
      });

      toast.success("Stock increased successfully");
      setSelectedProduct(null);
      setSearch("");
      setQuantity("");
    } catch (err) {
      console.error(err);
      toast.error("Update failed");
    }
    setLoading(false);
  };

  /** Edit Price */
  const handleEditPrice = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !price) {
      toast.error("Please select a product and enter a price");
      return;
    }

    setLoading(true);
    try {
      const productRef = doc(db, "products", selectedProduct.id);
      await updateDoc(productRef, { price: Number(price) });

      toast.success("Price updated successfully");
      setPrice("");
      setSelectedProduct(null);
      setSearch("");
    } catch (err) {
      console.error(err);
      toast.error("Price update failed");
    }
    setLoading(false);
  };

  return (
    <div className="warehouse-manage">
      {/* 4. Place the Toaster component at the top */}
      <Toaster position="top-right" 
      reverseOrder={false} 
      toastOptions={{
      duration: 4000, // 5 seconds
      style: {
      fontSize: "14px",
    },
  }}
/>

      {/* Tabs */}
      <div className="manage-tabs">
        <button
          className={activeTab === "add" ? "active" : ""}
          onClick={() => setActiveTab("add")}
        >
          Add Product
        </button>

        <button
          className={activeTab === "increase" ? "active" : ""}
          onClick={() => setActiveTab("increase")}
        >
          Increase Stock
        </button>

        <button
          className={activeTab === "editPrice" ? "active" : ""}
          onClick={() => setActiveTab("editPrice")}
        >
          Edit Price
        </button>
      </div>

      {/* Form */}
      <div className="manage-card">
        {activeTab === "add" && (
          <form onSubmit={handleAdd}>
            <input
              type="text"
              placeholder="Product Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select Category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />

            <input
              type="number"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Product"}
            </button>
          </form>
        )}

        {(activeTab === "increase" || activeTab === "editPrice") && (
          <form
            onSubmit={
              activeTab === "increase"
                ? handleStockUpdate
                : handleEditPrice
            }
          >
            <div className="autocomplete-container">
              <input
                type="text"
                className="autocomplete-input"
                placeholder="Search Product"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedProduct(null);
                }}
              />

              {filtered.length > 0 && !selectedProduct && (
                <div className="autocomplete-list">
                  {filtered.map((p) => (
                    <div
                      key={p.id}
                      className="autocomplete-item"
                      onClick={() => {
                        setSelectedProduct(p);
                        setSearch(p.name);
                        setFiltered([]);
                      }}
                    >
                      {p.name} — Qty: {p.quantity}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeTab === "increase" && (
              <input
                type="number"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            )}

            {activeTab === "editPrice" && (
              <input
                type="number"
                placeholder="New Price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            )}

            <button type="submit" disabled={loading}>
              {loading
                ? "Updating..."
                : activeTab === "increase"
                ? "Increase Stock"
                : "Update Price"}
            </button>
          </form>
        )}
      </div>

      {/* Recent History */}
      <div className="history-section">
        <h3>Recent Warehouse Changes</h3>
        <div className="history-list">
          {history.length > 0 ? (
            history.map((h, i) => (
              <div className="history-item" key={i}>
                <div>
                  <strong>{h.action}</strong>
                  <p>{h.productName}</p>
                </div>
                <span className="history-qty">Qty: {h.quantity}</span>
              </div>
            ))
          ) : (
            <p className="no-history">No recent actions yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}