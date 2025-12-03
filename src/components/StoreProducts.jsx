import React, { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import "../styles/StoreProducts.css";

const StoreProducts = () => {
  const [branchId, setBranchId] = useState(""); // selected store
  const [stores, setStores] = useState([]);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    quantity: "",
    categoryId: "",
    storeId: "",
  });

  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  /** Fetch stores */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "stores"), (snapshot) => {
      const storeList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setStores(storeList);

      // initialize branchId and modal storeId
      if (storeList.length > 0 && !branchId) {
        setBranchId(storeList[0].id);
        setNewProduct((prev) => ({ ...prev, storeId: storeList[0].id }));
      }
    });

    return () => unsub();
  }, []);

  /** Sync modal storeId when branchId changes */
  useEffect(() => {
    if (branchId) {
      setNewProduct((prev) => ({ ...prev, storeId: branchId }));
    }
  }, [branchId]);

  /** Fetch products inside selected store */
  useEffect(() => {
    if (!branchId) return;

    const storeProductsRef = collection(db, "stores", branchId, "products");
    const unsub = onSnapshot(storeProductsRef, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(sorted);
    });

    return () => unsub();
  }, [branchId]);

  /** Fetch categories */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snapshot) => {
      const cats = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCategories(cats);
    });

    return () => unsub();
  }, []);

  /** Add Product */
  const handleAddProduct = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    // Validation
    if (
      !newProduct.name.trim() ||
      newProduct.price === "" ||
      newProduct.quantity === "" ||
      !newProduct.categoryId ||
      !newProduct.storeId
    ) {
      setErrorMsg("Please fill in all fields.");
      setLoading(false);
      return;
    }

    const nameLower = newProduct.name.trim().toLowerCase();

    try {
      // Duplicate check (case-insensitive)
      const storeProductsRef = collection(
        db,
        "stores",
        newProduct.storeId,
        "products"
      );
      const q = query(storeProductsRef, where("nameLower", "==", nameLower));
      const existing = await getDocs(q);

      if (!existing.empty) {
        setErrorMsg("This product already exists in this store.");
        setLoading(false);
        return;
      }

      // Add product
      await addDoc(storeProductsRef, {
        name: newProduct.name.trim(),
        nameLower,
        price: Number(newProduct.price),
        quantity: Number(newProduct.quantity),
        categoryId: newProduct.categoryId,
        createdAt: new Date(),
      });

      // Reset form
      setNewProduct({
        name: "",
        price: "",
        quantity: "",
        categoryId: "",
        storeId: newProduct.storeId,
      });

      setShowModal(false);
    } catch (error) {
      console.error("Error adding product:", error);
      setErrorMsg("Failed to add product.");
    } finally {
      setLoading(false);
    }
  };

  /** Filter products by category */
  const filteredProducts = categoryFilter
    ? products.filter((p) => p.categoryId === categoryFilter)
    : products;

  return (
    <div className="store-products-container">
      <h2>Store Products</h2>

      {/* FILTERS */}
      <div className="filters-row">
        {/* STORE SELECT */}
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          {stores.length === 0 ? (
            <option>Loading stores...</option>
          ) : (
            stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))
          )}
        </select>

        {/* CATEGORY FILTER */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button className="add-btn" onClick={() => setShowModal(true)}>
          + Add
        </button>
      </div>

      {/* PRODUCTS TABLE */}
      {filteredProducts.length > 0 ? (
        <div className="table-wrapper">
          <table className="store-products-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const isOut = p.quantity === 0;
                return (
                  <tr key={p.id} className={isOut ? "out-of-stock" : ""}>
                    <td>{p.name}</td>
                    <td>{p.price}</td>
                    <td>
                      {isOut ? (
                        <span className="out-of-stock-label">Out of stock</span>
                      ) : (
                        p.quantity
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-text">No products in this store.</p>
      )}

      {/* ADD PRODUCT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Product</h3>

            {errorMsg && <div className="error-msg">{errorMsg}</div>}

            <form onSubmit={handleAddProduct}>
              <input
                type="text"
                placeholder="Product name"
                value={newProduct.name}
                required
                onChange={(e) =>
                  setNewProduct({ ...newProduct, name: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Price"
                value={newProduct.price}
                required
                min="0"
                onChange={(e) =>
                  setNewProduct({ ...newProduct, price: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Quantity"
                value={newProduct.quantity}
                required
                min="0"
                onChange={(e) =>
                  setNewProduct({ ...newProduct, quantity: e.target.value })
                }
              />

              {/* STORE SELECT */}
              <select
                value={newProduct.storeId}
                required
                onChange={(e) =>
                  setNewProduct({ ...newProduct, storeId: e.target.value })
                }
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* CATEGORY SELECT */}
              <select
                value={newProduct.categoryId}
                required
                onChange={(e) =>
                  setNewProduct({ ...newProduct, categoryId: e.target.value })
                }
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Add Product"}
              </button>

              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreProducts;