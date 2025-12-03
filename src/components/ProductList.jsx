import { useState, useEffect } from "react";
import { db } from "../utils/firebase";
import { collection, onSnapshot, addDoc } from "firebase/firestore";
import "../styles/ProductList.css";

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch categories
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "categories"), (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCategories(items.sort((a, b) => a.name.localeCompare(b.name)));
    });

    return () => unsubscribe();
  }, []);

  // Fetch products
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(items.sort((a, b) => a.name.localeCompare(b.name)));
    });

    return () => unsubscribe();
  }, []);

  // Filter products by category
  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.categoryId === selectedCategory);

  // Add new category
  const handleAddCategory = async () => {
    const name = prompt("Enter new category name:");
    if (!name) return;
    try {
      await addDoc(collection(db, "categories"), { name });
      alert(`Category "${name}" added successfully!`);
    } catch (err) {
      console.error(err);
      alert("Error adding category. Try again.");
    }
  };

  return (
    <div className="product-table-container">
      <h2>Warehouse Products</h2>

      {/* Category Filter */}
      <div className="category-filter">
  <div className="category-left">
    <select
      value={selectedCategory}
      onChange={(e) => setSelectedCategory(e.target.value)}
    >
      <option value="all">All Categories</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </select>
  </div>

  <button className="add-category-btn" onClick={handleAddCategory}>+</button>
</div>

      {filteredProducts.length > 0 ? (
        <div className="table-wrapper">
          <table className="product-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price ($)</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id} className={p.quantity === 0 ? "out-of-stock" : ""}>
                  <td>{p.name}</td>
                  <td>{p.price}</td>
                  <td>
                    {p.quantity === 0 ? (
                      <span className="out-of-stock-label">Out of stock</span>
                    ) : (
                      p.quantity
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-text">No products available.</p>
      )}
    </div>
  );
}