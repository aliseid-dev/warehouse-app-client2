import { useLocation, useNavigate } from 'react-router-dom';
import { FaWarehouse, FaChartBar, FaStore, FaMoneyBillWave } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext'; // Import your hook
import '../styles/BottomNav.css';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, loading } = useAuth(); // Get role and loading state

  const currentPage = location.pathname.replace('/', '') || 'warehouse';

  // 1. Don't render anything while checking the role to avoid UI "flicker"
  if (loading) return null;

  // 2. If the user is staff, hide the navigation entirely
  if (role === 'staff') {
    return null;
  }

  // 3. Only Admin sees this part
  return (
    <div className="bottom-nav">
      <div
        className={`nav-item ${currentPage === 'warehouse' ? 'active' : ''}`}
        onClick={() => navigate('/warehouse')}
      >
        <FaWarehouse className="nav-icon" />
        <span>Warehouse</span>
      </div>

      <div
        className={`nav-item ${currentPage === 'store' ? 'active' : ''}`}
        onClick={() => navigate('/store')}
      >
        <FaStore className="nav-icon" />
        <span>Store</span>
      </div>

      <div
        className={`nav-item ${currentPage === 'sales' ? 'active' : ''}`}
        onClick={() => navigate('/sales')}
      >
        <FaMoneyBillWave className="nav-icon" />
        <span>Sales</span>
      </div>

      <div
        className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
        onClick={() => navigate('/dashboard')}
      >
        <FaChartBar className="nav-icon" />
        <span>Dashboard</span>
      </div>
    </div>
  );
};

export default BottomNav;