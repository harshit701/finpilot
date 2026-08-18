import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <span>Signed in as {user?.firstName ?? user?.email}</span>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </header>
      <p>Dashboard content isn't built yet — this is a placeholder for Sprint 6.</p>
    </div>
  );
}
