import { useState, useEffect } from "react";
import { db } from "../utils/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import "../styles/ProductList.css";

export default function ProductList() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
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

    return () => unsubscribe();
  }, []);

  return (
    <div className="product-table-container">
      <h2>Warehouse Products</h2>
      {products.length > 0 ? (
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
              {products.map((p) => (
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