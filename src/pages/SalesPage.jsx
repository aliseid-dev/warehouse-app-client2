import { useState, useEffect, useRef } from "react";
import { db } from "../utils/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import Header from "../components/Header";
import MessageBox from "../components/MessageBox";
import ActionMenu from "../components/ActionMenu";
import PaymentModal from "../components/PaymentModal";
import "../styles/SalesPage.css";
import "../styles/Modal.css"; // For modal & action menu

export default function SalesPage() {
  const [source, setSource] = useState("store");
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [total, setTotal] = useState(0);
  const [totalManuallyEdited, setTotalManuallyEdited] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [contact, setContact] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [sales, setSales] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  const messageRef = useRef(null);

  // Fetch products
  useEffect(() => {
    const colName = source === "store" ? "storeProducts" : "products";
    const unsubscribe = onSnapshot(collection(db, colName), (snapshot) => {
      const items = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((p) => p.quantity > 0);
      setProducts(items);
    });
    return () => unsubscribe();
  }, [source]);

  // Auto-calc total
  useEffect(() => {
    if (!totalManuallyEdited) {
      const prod = products.find((p) => p.id === selectedProduct);
      const qty = Number(quantity) || 0;
      const unitPrice = Number(price) || (prod ? Number(prod.price) || 0 : 0);
      setTotal(qty * unitPrice);
    }
  }, [selectedProduct, quantity, price, products, totalManuallyEdited]);

  // Fetch sales
  useEffect(() => {
    const q = query(collection(db, "sales"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSales(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Scroll message into view
  useEffect(() => {
    if (message && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [message]);

  // Add Sale
 const handleAddSale = async (e) => {
  e.preventDefault();

  if (!selectedProduct || !quantity || !customerName || total === 0) {
    setMessage({ type: "error", text: "Please fill all required fields" });
    return;
  }

  setLoading(true);
  try {
    const productRef = doc(
      db,
      source === "store" ? "storeProducts" : "products",
      selectedProduct
    );

    // Fetch current product data
    const currentProduct = products.find((p) => p.id === selectedProduct);
    if (!currentProduct) throw new Error("Product not found");

    const remainingQty = currentProduct.quantity - Number(quantity);
    if (remainingQty < 0) {
      setMessage({ type: "error", text: "❌ Not enough stock available" });
      setLoading(false);
      return;
    }

    // 1️⃣ Add the sale record
    await addDoc(collection(db, "sales"), {
      source,
      productId: selectedProduct,
      productName: currentProduct.name,
      quantity: Number(quantity),
      price:
        Number(price) || currentProduct.price || 0,
      total: Number(total),
      customerName,
      tinNumber,
      contact: contact || "",
      paymentStatus,
      amountPaid: paymentStatus === "paid" ? Number(total) : 0,
      timestamp: new Date(),
    });

    // 2️⃣ Update product quantity
    await updateDoc(productRef, { quantity: remainingQty });

    // ✅ Success message
    setMessage({
      type: "success",
      text: `✅ Sale recorded successfully. Stock updated (Remaining: ${remainingQty})`,
    });

    // Reset form
    setSelectedProduct("");
    setQuantity("");
    setPrice("");
    setTotal(0);
    setCustomerName("");
    setTinNumber("");
    setContact("");
    setPaymentStatus("paid");
    setTotalManuallyEdited(false);
  } catch (err) {
    console.error(err);
    setMessage({ type: "error", text: "❌ Failed to record sale" });
  }
  setLoading(false);
};

  // Confirm payment (mark as fully paid)
  const handleConfirmPayment = async (paymentDate) => {
    if (!selectedSale) return;

    try {
      await updateDoc(doc(db, "sales", selectedSale.id), {
        paymentStatus: "paid",
        amountPaid: selectedSale.total,
        paidAt: new Date(paymentDate),
      });

      setMessage({ type: "success", text: "✅ Payment marked as paid" });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "❌ Failed to update payment" });
    }

    setModalVisible(false);
    setSelectedSale(null);
  };

  const unpaidSales = sales.filter((s) => s.paymentStatus === "credit");

  return (
    <>
      <div className="sales-header-wrapper">
        <Header title="Sales" />
      </div>

      <div className="sales-page-container">
        <div className="sales-page-content">
          {message && (
            <div ref={messageRef}>
              <MessageBox
                message={message.text}
                type={message.type}
                onClose={() => setMessage(null)}
              />
            </div>
          )}

          {/* Record Sale Form */}
          <div className="sales-card">
            <h2>💰 Record a Sale</h2>
            <form onSubmit={handleAddSale} className="sales-form">
              <div className="form-grid">
                <label>
                  Source
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="store">Store</option>
                    <option value="warehouse">Warehouse</option>
                  </select>
                </label>

                <label>
                  Product
                  <select
                    value={selectedProduct}
                    onChange={(e) => {
                      setSelectedProduct(e.target.value);
                      setTotalManuallyEdited(false);
                      setPrice("");
                    }}
                  >
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.quantity})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Quantity
                  <input
                    type="number"
                    placeholder="Quantity"
                    value={quantity}
                    min="1"
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>

                <label>
                  Price per Unit
                  <input
                    type="number"
                    placeholder="Price"
                    value={price}
                    min="0"
                    onChange={(e) => {
                      setPrice(e.target.value);
                      setTotalManuallyEdited(false);
                    }}
                  />
                </label>

                <label>
                  Total
                  <input type="number" value={total} readOnly />
                </label>

                <label>
                  Customer Name
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </label>

                <label>
                  TIN Number
                  <input
                    type="text"
                    placeholder="TIN Number"
                    value={tinNumber}
                    onChange={(e) => setTinNumber(e.target.value)}
                  />
                </label>

                <label>
                  Contact Info
                  <input
                    type="text"
                    placeholder="Contact Info (optional)"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                </label>

                <label>
                  Payment Status
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option value="paid">Paid</option>
                    <option value="credit">Credit</option>
                  </select>
                </label>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Record Sale"}
              </button>
            </form>
          </div>

          {/* Unpaid Sales */}
          <div className="sales-card">
            <h3>🧾 Unpaid Sales</h3>
            {unpaidSales.length > 0 ? (
              <div className="sales-table-wrapper">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidSales.map((s) => (
                      <tr key={s.id}>
                        <td>{s.customerName}</td>
                        <td>{s.productName}</td>
                        <td>{s.quantity}</td>
                        <td>{s.total} ETB</td>
                        <td>
                          <ActionMenu
                            sale={s}
                            onMarkPaid={() => {
                              setSelectedSale(s);
                              setModalVisible(true);
                            }}
                            onDelete={() => alert("Delete sale not implemented yet")}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No unpaid sales</p>
            )}
          </div>

          {/* Payment Modal */}
          {modalVisible && selectedSale && (
            <PaymentModal
              visible={modalVisible}
              sale={selectedSale}
              onClose={() => {
                setModalVisible(false);
                setSelectedSale(null);
              }}
              onConfirm={handleConfirmPayment}
            />
          )}

         
<div className="sales-card">
  <h3>📊 Recent Sales</h3>
  {sales.length > 0 ? (
    <div className="sales-table-wrapper">
      <table className="sales-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Total</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {sales.slice(0, 6).map((s) => (
            <tr key={s.id}>
              <td>{s.customerName || "—"}</td>
              <td>{s.productName || "—"}</td>
              <td>{s.quantity || 0}</td>
              <td>{s.total?.toFixed(2) || "0.00"} ETB</td>
              <td>
                {s.timestamp?.seconds
                  ? new Date(s.timestamp.seconds * 1000).toLocaleDateString(
                      "en-GB",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }
                    )
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p>No sales recorded yet</p>
  )}
</div>
        </div>
      </div>
    </>
  );
} 