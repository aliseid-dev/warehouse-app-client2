import React, { useState, useEffect } from "react";
import { db } from "../utils/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { FaWarehouse, FaFilter, FaSearch, FaBoxOpen } from "react-icons/fa";
import Header from "../components/Header"; 
import "../styles/UnifiedProducts.css";

export default function ProductsPage() {
  const [source, setSource] = useState("warehouse"); 
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsubStores = onSnapshot(collection(db, "stores"), (snapshot) => {
      setStores(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCats = onSnapshot(collection(db, "categories"), (snapshot) => {
      setCategories(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubStores(); unsubCats(); };
  }, []);

  useEffect(() => {
    let colRef;
    if (source === "warehouse") {
      colRef = collection(db, "products");
    } else {
      colRef = collection(db, "stores", source, "products");
    }

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const sortedItems = items.sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setProducts(sortedItems);
    });

    return () => unsubscribe();
  }, [source]);

  const filteredProducts = products.filter((p) => {
    const matchesCategory = categoryFilter === "all" || p.categoryId === categoryFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <Header /> 
      
      <div className="unified-products-container">
        <div className="page-header">
          <div>
            <h2>Inventory View</h2>
            <p className="subtitle">
              Browsing: <strong>{source === "warehouse" ? "Central Warehouse" : stores.find(s => s.id === source)?.name}</strong>
            </p>
          </div>
          <div className="view-badge">
            <FaBoxOpen /> Read Only Mode
          </div>
        </div>

        <div className="inventory-controls">
          {/* SEARCH BAR - Label removed, icon moved inside */}
          <div className="search-wrapper">
            <FaSearch className="search-icon-inside" />
            <input 
              type="text" 
              className="search-input"
              placeholder="Search products ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-row-mobile">
            <div className="control-group">
              <label><FaWarehouse /> Location</label>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="warehouse">Warehouse</option>
                <optgroup label="Store Branches">
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="control-group">
              <label><FaFilter /> Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="table-wrapper card-shadow">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Price</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const isOut = p.quantity === 0 || p.quantity === "0";
                return (
                  <tr key={p.id} className={isOut ? "row-out-of-stock" : ""}>
                    <td className="font-bold">{p.name}</td>
                    <td>{Number(p.price).toLocaleString()} ETB</td>
                    <td>
                      {isOut ? (
                        <span className="out-of-stock-text">Out of Stock</span>
                      ) : (
                        p.quantity
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="empty-state">
              <p>No products found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}