import { useState, useEffect } from "react";
import "../styles/Modal.css";

export default function PaymentModal({ visible, onClose, onConfirm, sale }) {
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash"); // NEW
  const [errors, setErrors] = useState("");

  useEffect(() => {
    if (visible) {
      const today = new Date();
      const formatted = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(
        today.getDate()
      ).padStart(2, "0")}/${today.getFullYear()}`;

      setPaymentDate(formatted);
      setPaymentMethod(sale?.paymentMethod || "cash"); // load existing if any
      setErrors("");
    }
  }, [visible, sale]);

  if (!visible) return null;

  const handleConfirm = () => {
    const isValid = /^\d{2}\/\d{2}\/\d{4}$/.test(paymentDate);

    if (!isValid) {
      setErrors("Enter a valid date in MM/DD/YYYY format");
      return;
    }

    setErrors("");
    onConfirm(paymentDate, paymentMethod); // Send BOTH back
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Mark Sale as Paid</h3>

        <p>
          Sale: <strong>{sale?.productName}</strong> <br />
          Total: ${sale?.total}
        </p>

        {/* PAYMENT DATE */}
        <label>
          Payment Date (MM/DD/YYYY)
          <input
            type="text"
            placeholder="MM/DD/YYYY"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
          {errors && <span className="error-text">{errors}</span>}
        </label>

        {/* PAYMENT METHOD — NEW */}
        <label>
          Payment Method
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="transfer">Bank Transfer</option>
          </select>
        </label>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>

          <button
            className={`btn-confirm ${!paymentDate ? "disabled" : ""}`}
            onClick={handleConfirm}
            disabled={!paymentDate}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}