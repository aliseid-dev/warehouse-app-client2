import { useState, useEffect } from "react";
// Add Toaster to the imports
import { db, auth } from "../utils/firebase"; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { 
  FaArrowLeft, FaSearch, FaEye, FaCalendarAlt, 
  FaCheckCircle, FaTimes, FaMoneyBillWave, FaUniversity 
} from "react-icons/fa";
import { Toaster, toast } from "react-hot-toast"; // Fixed import
import "../styles/SalesHistory.css";

export default function SalesHistoryPage() {
  const navigate = useNavigate();
  const user = auth.currentUser; 

  const [sales, setSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);
  const [payingSale, setPayingSale] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "sales"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

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
        updatedAt: new Date(),
        debtClearedBy: user?.uid || "unknown", 
        debtClearedByEmail: user?.email || "unknown" 
      });
      
      toast.success(`Payment recorded: ${payingSale.total?.toLocaleString()} ETB`, { id: loadingToastId });
      setPayingSale(null);
    } catch (error) {
      toast.error("Update failed", { id: loadingToastId });
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch = s.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.productName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || s.paymentStatus === filterStatus;
    
    let matchesDate = true;
    if (s.timestamp) {
      const saleDate = new Date(s.timestamp.seconds * 1000).toISOString().split('T')[0];
      if (startDate && saleDate < startDate) matchesDate = false;
      if (endDate && saleDate > endDate) matchesDate = false;
    }
    
    return matchesSearch && matchesFilter && matchesDate;
  });

  return (
    <div className="sh-page-container">
      {/* --- ADDED TOASTER COMPONENT HERE --- */}
      <Toaster 
        position="top-right" 
        containerStyle={{ zIndex: 99999 }} 
      />

      <header className="sh-navbar">
        <div className="sh-nav-left">
          <button onClick={() => navigate(-1)} className="sh-back-btn">
            <FaArrowLeft />
          </button>
        </div>
        <div className="sh-nav-center">
          <h1 className="sh-page-title">Sales History</h1>
        </div>
        <div className="sh-nav-right"></div>
      </header>

      <div className="sh-filter-area">
        <div className="sh-search-input-wrapper">
          <FaSearch />
          <input 
            type="text" 
            placeholder="Search customer or product..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        <div className="sh-date-range-grid">
          <div className="sh-date-field">
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="sh-date-field">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {(startDate || endDate) && (
            <button className="sh-clear-btn" onClick={() => {setStartDate(""); setEndDate("");}}>
              <FaTimes />
            </button>
          )}
        </div>
        
        <div className="sh-chip-group">
          {["all", "paid", "credit"].map((status) => (
            <button 
              key={status}
              className={`sh-chip ${filterStatus === status ? "active" : ""}`}
              onClick={() => setFilterStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="sh-list-container">
        {filteredSales.map(sale => (
          <div key={sale.id} className={`sh-card ${sale.paymentStatus}`}>
            <div className="sh-card-header">
              <div className="sh-card-info">
                <h3>{sale.customerName || "Walk-in Customer"}</h3>
                <p>{sale.productName} • Qty: {sale.quantity}</p>
                <span className="sh-date">
                  {sale.timestamp?.seconds ? new Date(sale.timestamp.seconds * 1000).toLocaleDateString() : "-"}
                </span>
              </div>
              <div className="sh-card-price">
                <p className="sh-amount">{sale.total?.toLocaleString()} ETB</p>
                <span className={`sh-badge ${sale.paymentStatus}`}>{sale.paymentStatus}</span>
              </div>
            </div>
            <div className="sh-card-footer">
              <button className="sh-btn-view" onClick={() => setSelectedSaleDetail(sale)}>
                <FaEye /> View
              </button>
              {sale.paymentStatus === "credit" && (
                <button className="sh-btn-pay" onClick={() => setPayingSale(sale)}>
                  <FaCheckCircle /> Mark Paid
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredSales.length === 0 && (
          <div className="sh-empty-state">No transactions found.</div>
        )}
      </div>

      {payingSale && (
        <div className="sh-modal-overlay">
          <div className="sh-modal-content">
            <div className="sh-modal-top">
              <h3>Confirm Payment</h3>
              <button disabled={isUpdating} className="sh-close-btn" onClick={() => setPayingSale(null)}><FaTimes /></button>
            </div>
            <div className="sh-modal-body">
              <div className="sh-payment-summary">
                <p>Record payment for {payingSale.customerName}</p>
                <h2>{payingSale.total?.toLocaleString()} <span>ETB</span></h2>
              </div>

              <div className="sh-input-group">
                <label>Date Received</label>
                <input 
                  type="date" 
                  defaultValue={new Date().toISOString().split('T')[0]} 
                  id="actualPaidDate"
                />
              </div>

              <div className="sh-payment-grid">
                <button 
                  disabled={isUpdating}
                  className="sh-method-btn sh-cash" 
                  onClick={() => handleConfirmPayment("cash", document.getElementById("actualPaidDate").value)}
                >
                  <FaMoneyBillWave /> Cash
                </button>
                <button 
                  disabled={isUpdating}
                  className="sh-method-btn sh-transfer" 
                  onClick={() => handleConfirmPayment("transfer", document.getElementById("actualPaidDate").value)}
                >
                  <FaUniversity /> Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSaleDetail && (
        <div className="sh-modal-overlay">
          <div className="sh-modal-content">
            <div className="sh-modal-top">
              <h3>Sale Details</h3>
              <button className="sh-close-btn" onClick={() => setSelectedSaleDetail(null)}><FaTimes /></button>
            </div>
            <div className="sh-detail-list">
              <div className="sh-detail-item"><span>Product</span> <strong>{selectedSaleDetail.productName}</strong></div>
              <div className="sh-detail-item"><span>Quantity</span> <strong>{selectedSaleDetail.quantity}</strong></div>
              <div className="sh-detail-item"><span>Total</span> <strong>{selectedSaleDetail.total} ETB</strong></div>
              <hr />
              <div className="sh-detail-item"><span>Customer</span> <strong>{selectedSaleDetail.customerName}</strong></div>
              <div className="sh-detail-item"><span>Sold By</span> <strong>{selectedSaleDetail.sellerEmail || "System"}</strong></div>
              <div className="sh-detail-item"><span>Status</span> <strong className={selectedSaleDetail.paymentStatus}>{selectedSaleDetail.paymentStatus}</strong></div>
              {selectedSaleDetail.paymentMethod && <div className="sh-detail-item"><span>Method</span> <strong>{selectedSaleDetail.paymentMethod}</strong></div>}
              {selectedSaleDetail.debtClearedByEmail && (
                <div className="sh-detail-item"><span>Debt Cleared By</span> <strong>{selectedSaleDetail.debtClearedByEmail}</strong></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}