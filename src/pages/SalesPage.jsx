import { useState, useEffect } from "react";
import { db, auth } from "../utils/firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { Toaster, toast } from "react-hot-toast";
import { 
  FaSignOutAlt, FaChartLine, FaHistory, 
  FaExclamationCircle, FaTimes, FaMoneyBillWave, FaUniversity 
} from "react-icons/fa";
import "../styles/SalesPage.css";
import "../styles/Modal.css";

export default function SalesPage() {
  const navigate = useNavigate();
  const user = auth.currentUser; // Get logged in user

  const [source, setSource] = useState("warehouse");
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);

  // Form States
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
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal Visibility States
  const [showUnpaidModal, setShowUnpaidModal] = useState(false);
  const [payingSale, setPayingSale] = useState(null); 

  const [uniqueNames, setUniqueNames] = useState([]);
  const [uniqueTins, setUniqueTins] = useState([]);
  const [uniqueContacts, setUniqueContacts] = useState([]);

  // --- UPDATED: User-Specific Shift Total Logic ---
  const todayTotal = sales
    .filter((s) => {
      const today = new Date().setHours(0, 0, 0, 0);
      const isToday = (s.timestamp?.seconds * 1000 || Date.now()) >= today;
      // Only include sales where the sellerId matches the current logged-in user
      const isMine = s.sellerId === user?.uid;
      return isToday && isMine;
    })
    .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  // Load stores
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "stores"), (snapshot) => {
      setStores(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Load products depending on source
  useEffect(() => {
    if (!source) return;
    let colRef = source === "warehouse" ? collection(db, "products") : collection(db, "stores", source, "products");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.quantity >= 0);
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
      setUniqueNames([...new Set(allSales.map((s) => s.customerName).filter(Boolean))]);
      setUniqueTins([...new Set(allSales.map((s) => s.tinNumber).filter(Boolean))]);
      setUniqueContacts([...new Set(allSales.map((s) => s.contact).filter(Boolean))]);
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

  // Sync inputs
  useEffect(() => {
    const prod = products.find((p) => p.id === selectedProduct);
    if (prod) {
      setProductSearch(prod.name);
      setPrice(prod.price ?? "");
    }
  }, [selectedProduct, products]);

  const handleLogout = async () => {
    if (window.confirm("Logout and end shift?")) {
      await signOut(auth);
      navigate("/login");
    }
  };

  const handleAddSale = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !quantity || !customerName || total === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      let productRef = source === "warehouse" ? doc(db, "products", selectedProduct) : doc(db, "stores", source, "products", selectedProduct);
      const currentProduct = products.find((p) => p.id === selectedProduct);
      const remainingQty = currentProduct.quantity - Number(quantity);
      
      if (remainingQty < 0) {
        toast.error("Not enough stock!");
        setLoading(false);
        return;
      }

      await addDoc(collection(db, "sales"), {
        sellerId: user?.uid, // Store the UID for user-specific tracking
        sellerEmail: user?.email,
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
        paymentMethod: paymentStatus === "credit" ? "credit" : paymentMethod,
        timestamp: new Date(),
      });

      await updateDoc(productRef, { quantity: remainingQty });
      toast.success("Sale recorded!");
      resetForm();
    } catch (err) {
      toast.error("Failed to record sale");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setSelectedProduct(""); setProductSearch(""); setQuantity(""); setPrice("");
    setTotal(0); setCustomerName(""); setTinNumber(""); setContact("");
    setPaymentStatus("paid"); setPaymentMethod("cash"); setTotalManuallyEdited(false);
  };

  const handleConfirmPayment = async (method, dateString) => {
    if (!payingSale || isUpdating) return;
    setIsUpdating(true);
    const loadingToastId = toast.loading("Processing payment...");

    try {
      const saleRef = doc(db, "sales", payingSale.id);
      await updateDoc(saleRef, {
        paymentStatus: "paid",
        paymentMethod: method,
        paidAt: new Date(dateString),
        updatedAt: new Date()
      });
      
      toast.success(`Debt Cleared for ${payingSale.customerName}`, { id: loadingToastId });
      setPayingSale(null);
    } catch (error) {
      toast.error("Update failed", { id: loadingToastId });
    } finally {
      setIsUpdating(false);
    }
  };

  const pickProduct = (p) => {
    if (p.quantity <= 5) toast(`Low Stock: Only ${p.quantity} left!`, { icon: "⚠️" });
    setSelectedProduct(p.id); setProductSearch(p.name); setPrice(p.price ?? "");
    setShowProductSuggestions(false); setTotalManuallyEdited(false);
  };

  const onCustomerChange = (value) => {
    setCustomerName(value);
    const previous = sales.find(s => s.customerName?.toLowerCase() === value.toLowerCase());
    if (previous) { setTinNumber(previous.tinNumber || ""); setContact(previous.contact || ""); }
  };

  const unpaidSales = sales.filter((s) => s.paymentStatus === "credit");

  return (
    <div className="sh-page-container">
      <Toaster position="top-right" />

      {/* --- STAFF HEADER --- */}
      <div className="staff-header">
        <div className="staff-profile">
          <div className="staff-avatar">{user?.email?.charAt(0).toUpperCase() || "S"}</div>
          <div>
            <p className="staff-label">{user?.email || "Staff Member"}</p>
            <button onClick={handleLogout} className="logout-link"><FaSignOutAlt /> Logout</button>
          </div>
        </div>
        <div className="shift-stats">
          <FaChartLine className="stats-icon" />
          <div>
            <p className="stats-label">My Sales Today</p>
            <p className="stats-value">{todayTotal.toLocaleString()} ETB</p>
          </div>
        </div>
      </div>

      <div className="sales-page-container">
        <div className="quick-nav-pills">
          <button className="pill credit" onClick={() => setShowUnpaidModal(true)}>
            <FaExclamationCircle /> Unpaid ({unpaidSales.length})
          </button>
          <button className="pill history" onClick={() => navigate("/sales-history")}>
            <FaHistory /> Sales History
          </button>
        </div>

        <div className="sales-page-content">
          <div className="sales-card">
            <h2>Record a Sale</h2>
            <form onSubmit={handleAddSale} className="sales-form" autoComplete="off">
              <div className="form-grid">
                <label><span className="label-text">Source</span>
                  <select value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="warehouse">Warehouse</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>

                <label className="autocomplete-label">
                  <span className="label-text">Product</span>
                  <div style={{ width: "100%", position: "relative" }}>
                    <input type="text" placeholder="Search product..." value={productSearch}
                      onChange={(e) => { setProductSearch(e.target.value); setShowProductSuggestions(true); setSelectedProduct(""); }}
                      onFocus={() => setShowProductSuggestions(true)}
                    />
                    {showProductSuggestions && productSearch && (
                      <ul className="suggestion-list">
                        {products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 8).map((p) => (
                          <li key={p.id} onMouseDown={() => pickProduct(p)} className={p.quantity <= 5 ? "low-stock-item" : ""}>
                            {p.name} ({p.quantity})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </label>

                <label><span className="label-text">Quantity</span><input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
                <label><span className="label-text">Price</span><input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
                <label><span className="label-text">Total</span><input type="text" value={`${total.toLocaleString()} ETB`} readOnly className="total-display" /></label>
                <label><span className="label-text">Customer</span><input type="text" list="customerNames" value={customerName} onChange={(e) => onCustomerChange(e.target.value)} /><datalist id="customerNames">{uniqueNames.map((name, i) => <option key={i} value={name} />)}</datalist></label>
                <label><span className="label-text">TIN</span><input type="text" list="tinNumbers" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} /><datalist id="tinNumbers">{uniqueTins.map((tin, i) => <option key={i} value={tin} />)}</datalist></label>
                <label><span className="label-text">Contact</span><input type="text" list="contactList" value={contact} onChange={(e) => setContact(e.target.value)} /><datalist id="contactList">{uniqueContacts.map((c, i) => <option key={i} value={c} />)}</datalist></label>
                
                <label>
                    <span className="label-text">Status</span>
                    <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); if (e.target.value === "credit") setPaymentMethod("credit"); else setPaymentMethod("cash"); }}>
                        <option value="paid">Paid</option>
                        <option value="credit">Credit</option>
                    </select>
                </label>

                <label>
                    <span className="label-text">Method</span>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={paymentStatus === "credit"}>
                        {paymentStatus === "credit" ? <option value="credit">N/A (Credit Sale)</option> : (
                            <>
                                <option value="cash">Cash</option>
                                <option value="transfer">Bank Transfer</option>
                            </>
                        )}
                    </select>
                </label>
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="reset-btn">Clear Form</button>
                <button type="submit" disabled={loading} className="submit-btn">{loading ? "Saving..." : "Record Sale"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* --- UNPAID LIST MODAL --- */}
      {showUnpaidModal && (
        <div className="sh-modal-overlay">
          <div className="sh-modal-content large">
            <div className="sh-modal-top">
              <h3>Unpaid Sales ‼️</h3>
              <button onClick={() => setShowUnpaidModal(false)} className="sh-close-btn"><FaTimes /></button>
            </div>
            <div className="sh-modal-body">
              <table className="sh-table">
                <thead><tr><th>Customer</th><th>Product</th><th>Amount</th><th>Action</th></tr></thead>
                <tbody>
                  {unpaidSales.map((s) => (
                    <tr key={s.id}>
                      <td>{s.customerName}</td><td>{s.productName}</td><td>{s.total?.toLocaleString()} ETB</td>
                      <td>
                        <button className="sh-btn-pay-small" onClick={() => setPayingSale(s)}>Pay</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {unpaidSales.length === 0 && <p className="sh-empty-text">No unpaid sales found.</p>}
            </div>
          </div>
        </div>
      )}

      {/* --- STREAMLINED PAYMENT CONFIRMATION MODAL --- */}
      {payingSale && (
        <div className="sh-modal-overlay" style={{ zIndex: 3000 }}>
          <div className="sh-modal-content">
            <div className="sh-modal-top">
              <h3>Confirm Payment</h3>
              <button disabled={isUpdating} className="sh-close-btn" onClick={() => setPayingSale(null)}><FaTimes /></button>
            </div>
            <div className="sh-modal-body">
              <div className="sh-simple-info">
                <div className="sh-info-row"><span className="sh-info-label">Customer</span><span className="sh-info-value">{payingSale.customerName}</span></div>
                <div className="sh-info-row"><span className="sh-info-label">Item</span><span className="sh-info-value">{payingSale.productName}</span></div>
                <div className="sh-info-row sh-total-row"><span className="sh-info-label">Total</span><span className="sh-info-total">{payingSale.total?.toLocaleString()} ETB</span></div>
              </div>

              <div className="sh-input-group">
                <label>Received Date</label>
                <input type="date" defaultValue={new Date().toISOString().split('T')[0]} id="paidDateInput" />
              </div>

              <div className="sh-payment-grid">
                <button disabled={isUpdating} className="sh-method-btn sh-cash" onClick={() => handleConfirmPayment("cash", document.getElementById("paidDateInput").value)}>
                  <FaMoneyBillWave /> Cash
                </button>
                <button disabled={isUpdating} className="sh-method-btn sh-transfer" onClick={() => handleConfirmPayment("transfer", document.getElementById("paidDateInput").value)}>
                  <FaUniversity /> Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}