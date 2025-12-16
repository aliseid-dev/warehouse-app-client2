// src/pages/SalesPage.jsx
import { useState, useEffect } from "react";
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
import { Toaster, toast } from "react-hot-toast";
import ActionMenu from "../components/ActionMenu";
import PaymentModal from "../components/PaymentModal";
import "../styles/SalesPage.css";
import "../styles/Modal.css"; // For modal & action menu

export default function SalesPage() {
  const [source, setSource] = useState("warehouse"); // warehouse OR storeId
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [total, setTotal] = useState(0);
  const [totalManuallyEdited, setTotalManuallyEdited] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [contact, setContact] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("paid");

  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [loading, setLoading] = useState(false);

  const [sales, setSales] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  const [uniqueNames, setUniqueNames] = useState([]);
  const [uniqueTins, setUniqueTins] = useState([]);
  const [uniqueContacts, setUniqueContacts] = useState([]);

  // Load stores
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "stores"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStores(list);
    });
    return () => unsubscribe();
  }, []);

  // Load products depending on source
  useEffect(() => {
    if (!source) return;

    let colRef;
    if (source === "warehouse") {
      colRef = collection(db, "products");
    } else {
      colRef = collection(db, "stores", source, "products");
    }

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.quantity >= 0);

      items.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(items);
    });

    return () => unsubscribe();
  }, [source]);

  // Load sales + unique lists
  useEffect(() => {
    const q = query(collection(db, "sales"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSales = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSales(allSales);

      const names = [...new Set(allSales.map((s) => s.customerName).filter(Boolean))];
      const tins = [...new Set(allSales.map((s) => s.tinNumber).filter(Boolean))];
      const contacts = [...new Set(allSales.map((s) => s.contact).filter(Boolean))];

      setUniqueNames(names);
      setUniqueTins(tins);
      setUniqueContacts(contacts);
    });
    return () => unsubscribe();
  }, []);

  // Auto-calc total
  useEffect(() => {
    if (!totalManuallyEdited) {
      const prod = products.find((p) => p.id === selectedProduct);
      const qty = Number(quantity) || 0;
      const unitPrice = Number(price) || (prod ? Number(prod.price) || 0 : 0);
      setTotal(qty * unitPrice);
    }
  }, [selectedProduct, quantity, price, products, totalManuallyEdited]);

  // Sync product name input when selectedProduct changes
  useEffect(() => {
    const prod = products.find((p) => p.id === selectedProduct);
    if (prod) {
      setProductSearch(prod.name);
      setPrice(prod.price ?? "");
    }
  }, [selectedProduct, products]);

  // Add sale handler
  const handleAddSale = async (e) => {
    e.preventDefault();

    if (!selectedProduct || !quantity || !customerName || total === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);

    try {
      let productRef;
      if (source === "warehouse") {
        productRef = doc(db, "products", selectedProduct);
      } else {
        productRef = doc(db, "stores", source, "products", selectedProduct);
      }

      const currentProduct = products.find((p) => p.id === selectedProduct);
      if (!currentProduct) throw new Error("Product not found");

      const remainingQty = currentProduct.quantity - Number(quantity);
      if (remainingQty < 0) {
        toast.error("Not enough stock available");
        setLoading(false);
        return;
      }

      await addDoc(collection(db, "sales"), {
        source: source === "warehouse" ? "warehouse" : source,
        productId: selectedProduct,
        productName: currentProduct.name,
        quantity: Number(quantity),
        price: Number(price) || currentProduct.price || 0,
        total: Number(total),
        customerName,
        tinNumber,
        contact: contact || "",
        paymentStatus,
        paymentMethod,
        amountPaid: paymentStatus === "paid" ? Number(total) : 0,
        timestamp: new Date(),
      });

      await updateDoc(productRef, { quantity: remainingQty });

      toast.success(`Sale recorded. Remaining stock: ${remainingQty}`);

      // Reset
      setSelectedProduct("");
      setProductSearch("");
      setQuantity("");
      setPrice("");
      setTotal(0);
      setCustomerName("");
      setTinNumber("");
      setContact("");
      setPaymentStatus("paid");
      setPaymentMethod("cash");
      setTotalManuallyEdited(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to record sale");
    }

    setLoading(false);
  };

  // Confirm payment
  const handleConfirmPayment = async (paymentDate) => {
    if (!selectedSale) return;
    try {
      await updateDoc(doc(db, "sales", selectedSale.id), {
        paymentStatus: "paid",
        amountPaid: selectedSale.total,
        paidAt: new Date(paymentDate),
      });
      toast.success("Payment marked as paid");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update payment");
    }
    setModalVisible(false);
    setSelectedSale(null);
  };

  const unpaidSales = sales.filter((s) => s.paymentStatus === "credit");

  // Pick product from suggestions
  const pickProduct = (p) => {
    setSelectedProduct(p.id);
    setProductSearch(p.name);
    setPrice(p.price ?? "");
    setShowProductSuggestions(false);
    setTotalManuallyEdited(false);
  };

  const onCustomerChange = (value) => {
    setCustomerName(value);
    const previous = sales.find(
      (s) => s.customerName?.toLowerCase() === value.toLowerCase()
    );
    if (previous) {
      setTinNumber(previous.tinNumber || "");
      setContact(previous.contact || "");
    }
  };

  return (
    <>
      {/* React Hot Toaster */}
      <Toaster
  position="top-right"
  reverseOrder={false}
  toastOptions={{
    duration: 4000, // 5 seconds
    style: {
      fontSize: "14px",
    },
  }}
/>

      <div className="sales-header-wrapper">
        <Header title="Sales" />
      </div>

      <div className="sales-page-container">
        <div className="sales-page-content">
          {/* Record Sale */}
          <div className="sales-card">
            <h2>Record a Sale</h2>

            <form onSubmit={handleAddSale} className="sales-form" autoComplete="off">
              <div className="form-grid">
                {/* SOURCE */}
                <label>
                  <span className="label-text">Source</span>
                  <select value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="warehouse">Warehouse</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* PRODUCT */}
                <label className="autocomplete-label">
                  <span className="label-text">Product</span>
                  <div style={{ width: "100%", position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setShowProductSuggestions(true);
                        setSelectedProduct("");
                      }}
                      onFocus={() => setShowProductSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowProductSuggestions(false), 160)}
                    />

                    {showProductSuggestions && productSearch && (
                      <ul className="suggestion-list">
                        {products
                          .filter((p) =>
                            p.name.toLowerCase().includes(productSearch.toLowerCase())
                          )
                          .slice(0, 8)
                          .map((p) => (
                            <li key={p.id} onClick={() => pickProduct(p)}>
                              {p.name} ({p.quantity})
                            </li>
                          ))}

                        {products.filter((p) =>
                          p.name.toLowerCase().includes(productSearch.toLowerCase())
                        ).length === 0 && <li className="no-result">No products found</li>}
                      </ul>
                    )}
                  </div>
                </label>

                {/* QUANTITY */}
                <label>
                  <span className="label-text">Quantity</span>
                  <input
                    type="number"
                    placeholder="Empty"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>

                {/* PRICE */}
                <label>
                  <span className="label-text">Price per Unit</span>
                  <input
                    type="number"
                    placeholder="Empty"
                    min="0"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      setTotalManuallyEdited(false);
                    }}
                  />
                </label>

                {/* TOTAL */}
                <label>
                  <span className="label-text">Total</span>
                  <input type="number" value={total} readOnly />
                </label>

                {/* CUSTOMER */}
                <label>
                  <span className="label-text">Customer Name</span>
                  <input
                    type="text"
                    list="customerNames"
                    placeholder="Empty"
                    value={customerName}
                    onChange={(e) => onCustomerChange(e.target.value)}
                  />
                  <datalist id="customerNames">
                    {uniqueNames.map((name, i) => (
                      <option key={i} value={name} />
                    ))}
                  </datalist>
                </label>

                {/* TIN */}
                <label>
                  <span className="label-text">TIN Number</span>
                  <input
                    type="text"
                    list="tinNumbers"
                    placeholder="Empty"
                    value={tinNumber}
                    onChange={(e) => setTinNumber(e.target.value)}
                  />
                  <datalist id="tinNumbers">
                    {uniqueTins.map((tin, i) => (
                      <option key={i} value={tin} />
                    ))}
                  </datalist>
                </label>

                {/* CONTACT */}
                <label>
                  <span className="label-text">Contact Info</span>
                  <input
                    type="text"
                    list="contactList"
                    placeholder="Empty"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                  <datalist id="contactList">
                    {uniqueContacts.map((c, i) => (
                      <option key={i} value={c} />
                    ))}
                  </datalist>
                </label>

                {/* PAYMENT STATUS */}
                <label>
                  <span className="label-text">Payment Status</span>
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                    <option value="paid">Paid</option>
                    <option value="credit">Credit</option>
                  </select>
                </label>

                {/* PAYMENT METHOD */}
                <label>
                  <span className="label-text">Payment Method</span>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
                    <option value="cash">Cash</option>
                    <option value="transfer">Bank Transfer</option>
                  </select>
                </label>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Record Sale"}
              </button>
            </form>
          </div>

          {/* UNPAID SALES */}
          <div className="sales-card">
            <h3>‼️ Unpaid Sales</h3>
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
                            onDelete={() => toast.error("Delete sale not implemented yet")}
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

          {/* PAYMENT MODAL */}
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

          {/* RECENT SALES */}
          <div className="sales-card">
            <h3>🟢 Recent Sales</h3>

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
                                { day: "2-digit", month: "short", year: "numeric" }
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