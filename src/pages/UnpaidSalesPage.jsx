import { useState, useEffect } from "react";
import { db } from "../utils/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPhone, FaMoneyBillWave, FaUserClock } from "react-icons/fa";
import PaymentModal from "../components/PaymentModal";
import { toast } from "react-hot-toast";
import "../styles/UnpaidSales.css";

export default function UnpaidSalesPage() {
  const navigate = useNavigate();
  const [unpaidSales, setUnpaidSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    // Only fetch sales where status is 'credit'
    const q = query(collection(db, "sales"), where("paymentStatus", "==", "credit"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnpaidSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const totalDebt = unpaidSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  const handleConfirmPayment = async (paymentDate) => {
    if (!selectedSale) return;
    try {
      await updateDoc(doc(db, "sales", selectedSale.id), {
        paymentStatus: "paid",
        amountPaid: selectedSale.total,
        paidAt: new Date(paymentDate),
      });
      toast.success("Payment cleared successfully!");
      setModalVisible(false);
    } catch (err) {
      toast.error("Failed to update payment");
    }
  };

  return (
    <div className="unpaid-container">
      {/* Header */}
      <div className="unpaid-header">
        <button onClick={() => navigate(-1)} className="back-circle"><FaArrowLeft /></button>
        <h1>Credit Tracking</h1>
      </div>

      {/* Summary Card */}
      <div className="debt-summary-card">
        <div className="summary-info">
          <p>Total Outstanding Balance</p>
          <h2>{totalDebt.toLocaleString()} ETB</h2>
        </div>
        <div className="summary-icon"><FaMoneyBillWave /></div>
      </div>

      {/* List of Debtors */}
      <div className="debtors-list">
        <h3>Pending Collections ({unpaidSales.length})</h3>
        
        {unpaidSales.length > 0 ? (
          unpaidSales.map(sale => (
            <div key={sale.id} className="debtor-card">
              <div className="debtor-info">
                <div className="user-icon"><FaUserClock /></div>
                <div>
                  <h4>{sale.customerName}</h4>
                  <p>{sale.productName} • {sale.quantity} units</p>
                  <span className="sale-date">
                    Issued: {sale.timestamp?.seconds ? new Date(sale.timestamp.seconds * 1000).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </div>
              
              <div className="debtor-actions">
                <div className="amount-due">{sale.total?.toLocaleString()} ETB</div>
                <div className="action-buttons">
                  {sale.contact && (
                    <a href={`tel:${sale.contact}`} className="call-btn"><FaPhone /></a>
                  )}
                  <button className="collect-btn" onClick={() => { setSelectedSale(sale); setModalVisible(true); }}>
                    Collect
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>🎉 All clear! No pending payments.</p>
          </div>
        )}
      </div>

      {modalVisible && (
        <PaymentModal 
          visible={modalVisible} 
          sale={selectedSale} 
          onClose={() => setModalVisible(false)} 
          onConfirm={handleConfirmPayment}
        />
      )}
    </div>
  );
}