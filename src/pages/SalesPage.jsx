// src/pages/SalesPage.jsx
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
  const [productSearch, setProductSearch] = useState(""); // for typing/searching product
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

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

  // holders for unique suggestion lists (and their setters!)
  const [uniqueNames, setUniqueNames] = useState([]);
  const [uniqueTins, setUniqueTins] = useState([]);
  const [uniqueContacts, setUniqueContacts] = useState([]);

  const messageRef = useRef(null);

  // Fetch products (live)
  useEffect(() => {
    const colName = source === "store" ? "storeProducts" : "products";
    const unsubscribe = onSnapshot(collection(db, colName), (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.quantity >= 0); // keep zeros too if you want
      // sort alphabetically
      items.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(items);
    });
    return () => unsubscribe();
  }, [source]);

  // Fetch sales (live) and build unique suggestion lists
  useEffect(() => {
    const q = query(collection(db, "sales"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSales = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSales(allSales);

      // Build unique lists without duplicates and without empty values
      const names = [...new Set(allSales.map((s) => s.customerName).filter(Boolean))];
      const tins = [...new Set(allSales.map((s) => s.tinNumber).filter(Boolean))];
      const contacts = [...new Set(allSales.map((s) => s.contact).filter(Boolean))];

      setUniqueNames(names);
      setUniqueTins(tins);
      setUniqueContacts(contacts);
    });
    return () => unsubscribe();
  }, []);

  // Auto-calc total when qty / price / product changes
  useEffect(() => {
    if (!totalManuallyEdited) {
      const prod = products.find((p) => p.id === selectedProduct);
      const qty = Number(quantity) || 0;
      const unitPrice = Number(price) || (prod ? Number(prod.price) || 0 : 0);
      setTotal(qty * unitPrice);
    }
  }, [selectedProduct, quantity, price, products, totalManuallyEdited]);

  // Keep productSearch synced when selectedProduct changes (so selected product name shows in input)
  useEffect(() => {
    const prod = products.find((p) => p.id === selectedProduct);
    if (prod) {
      setProductSearch(prod.name);
      setPrice(prod.price ?? "");
    } else {
      // don't clear productSearch if user is typing — only if selectedProduct cleared
      // setProductSearch("");
    }
  }, [selectedProduct, products]);

  // Scroll message into view
  useEffect(() => {
    if (message && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [message]);

  // Handle submit - add sale
  const handleAddSale = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !quantity || !customerName || total === 0) {
      setMessage({ type: "error", text: "Please fill all required fields" });
      return;
    }

    setLoading(true);
    try {
      const productRef = doc(db, source === "store" ? "storeProducts" : "products", selectedProduct);
      const currentProduct = products.find((p) => p.id === selectedProduct);
      if (!currentProduct) throw new Error("Product not found");

      const remainingQty = currentProduct.quantity - Number(quantity);
      if (remainingQty < 0) {
        setMessage({ type: "error", text: "❌ Not enough stock available" });
        setLoading(false);
        return;
      }

      await addDoc(collection(db, "sales"), {
        source,
        productId: selectedProduct,
        productName: currentProduct.name,
        quantity: Number(quantity),
        price: Number(price) || currentProduct.price || 0,
        total: Number(total),
        customerName,
        tinNumber,
        contact: contact || "",
        paymentStatus,
        amountPaid: paymentStatus === "paid" ? Number(total) : 0,
        timestamp: new Date(),
      });

      await updateDoc(productRef, { quantity: remainingQty });

      setMessage({ type: "success", text: `✅ Sale recorded. Remaining stock: ${remainingQty}` });

      // Reset form fields
      setSelectedProduct("");
      setProductSearch("");
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

  // Confirm payment handler (existing)
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

  // Product suggestion click
  const pickProduct = (p) => {
    setSelectedProduct(p.id);
    setProductSearch(p.name);
    setPrice(p.price ?? "");
    setShowProductSuggestions(false);
    setTotalManuallyEdited(false);
  };

  // When user types a customer name, auto fill tin & contact if an existing one is found
  const onCustomerChange = (value) => {
    setCustomerName(value);
    const previous = sales.find((s) => s.customerName?.toLowerCase() === value.toLowerCase());
    if (previous) {
      setTinNumber(previous.tinNumber || "");
      setContact(previous.contact || "");
    } else {
      // don't overwrite if user is clearing; keep current tin/contact fields
      // setTinNumber("");
      // setContact("");
    }
  };

  return (
    <>
      <div className="sales-header-wrapper">
        <Header title="Sales" />
      </div>

      <div className="sales-page-container">
        <div className="sales-page-content">
          {message && (
            <div ref={messageRef}>
              <MessageBox message={message.text} type={message.type} onClose={() => setMessage(null)} />
            </div>
          )}

          {/* Record Sale Form */}
          <div className="sales-card">
            <h2>💰 Record a Sale</h2>
            <form onSubmit={handleAddSale} className="sales-form" autoComplete="off">
              <div className="form-grid">
                <label>
                  Source
                  <select value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="store">Store</option>
                    <option value="warehouse">Warehouse</option>
                  </select>
                </label>

                {/* Product autocomplete input */}
                <label className="autocomplete-label" style={{ position: "relative" }}>
                  Product
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductSuggestions(true);
                      // clear selectedProduct while typing
                      setSelectedProduct("");
                    }}
                    onFocus={() => setShowProductSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowProductSuggestions(false), 150)} // allow click
                  />
                  {/* suggestion list */}
                  {showProductSuggestions && productSearch && (
                    <ul className="suggestion-list">
                      {products
                        .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                        .slice(0, 8)
                        .map((p) => (
                          <li key={p.id} onClick={() => pickProduct(p)}>
                            {p.name} ({p.quantity})
                          </li>
                        ))}
                      {products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                        <li className="no-result">No products found</li>
                      )}
                    </ul>
                  )}
                </label>

                <label>
                  Quantity
                  <input type="number" placeholder="Quantity" value={quantity} min="1" onChange={(e) => setQuantity(e.target.value)} />
                </label>

                <label>
                  Price per Unit
                  <input type="number" placeholder="Price" value={price} min="0" onChange={(e) => { setPrice(e.target.value); setTotalManuallyEdited(false); }} />
                </label>

                <label>
                  Total
                  <input type="number" value={total} readOnly />
                </label>

                {/* Customer with suggestions (no duplicates) */}
                <label>
                  Customer Name
                  <input
                    type="text"
                    list="customerNames"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => onCustomerChange(e.target.value)}
                  />
                  <datalist id="customerNames">
                    {uniqueNames.map((name, i) => <option key={i} value={name} />)}
                  </datalist>
                </label>

                <label>
                  TIN Number
                  <input type="text" list="tinNumbers" placeholder="TIN Number" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} />
                  <datalist id="tinNumbers">
                    {uniqueTins.map((tin, i) => <option key={i} value={tin} />)}
                  </datalist>
                </label>

                <label>
                  Contact Info
                  <input type="text" list="contactList" placeholder="Contact Info (optional)" value={contact} onChange={(e) => setContact(e.target.value)} />
                  <datalist id="contactList">
                    {uniqueContacts.map((c, i) => <option key={i} value={c} />)}
                  </datalist>
                </label>

                <label>
                  Payment Status
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
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

          {/* Recent Sales */}
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
                            ? new Date(s.timestamp.seconds * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
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