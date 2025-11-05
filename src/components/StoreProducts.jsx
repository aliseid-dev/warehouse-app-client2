import React, { useEffect, useState } from "react";
import { db } from "../utils/firebase";
import { collection, addDoc, onSnapshot } from "firebase/firestore";
import "../styles/StoreProducts.css";

const StoreProducts = () => {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: 0,
    quantity: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "storeProducts"), (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // ✅ Sort alphabetically by name
      const sortedItems = items.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setProducts(sortedItems);
    });

    return () => unsub();
  }, []);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (
  !newProduct.name.trim() ||
  newProduct.price === "" ||
  newProduct.quantity === ""
) {
  alert("Please fill in all fields");
  return;
}

    try {
      setLoading(true);
      await addDoc(collection(db, "storeProducts"), {
        name: newProduct.name.trim(),
        price: parseFloat(newProduct.price),
        quantity: parseInt(newProduct.quantity),
      });
      setNewProduct({ name: "", price: 0, quantity: "" });
    } catch (error) {
      console.error("Error adding product:", error);
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="store-products-container">
      <h2>Store Products</h2>

      🟩 Temporary Add Product Form
      <form onSubmit={handleAddProduct} className="quick-add-form">
        <input
          type="text"
          placeholder="Product name"
          value={newProduct.name}
          onChange={(e) =>
            setNewProduct({ ...newProduct, name: e.target.value })
          }
        />
        <input
          type="number"
          placeholder="Price ($)"
          min="0"
          value={newProduct.price}
          onChange={(e) =>
            setNewProduct({ ...newProduct, price: e.target.value })
          }
        />
        <input
          type="number"
          placeholder="Quantity"
          value={newProduct.quantity}
          onChange={(e) =>
            setNewProduct({ ...newProduct, quantity: e.target.value })
          }
        />
        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>

      {products.length > 0 ? (
        <div className="table-wrapper">
          <table className="store-products-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price </th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className={p.quantity === 0 ? "out-of-stock" : ""}
                >
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
        <p className="empty-text">No products in store yet.</p>
      )}
    </div>
  );
};

export default StoreProducts;