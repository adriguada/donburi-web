import { AdminPage } from "./pages/AdminPage";
import { MenuPage } from "./pages/MenuPage";
import { isAdminPath } from "./routes";
import "./App.css";

function App() {
  return isAdminPath(window.location.pathname) ? <AdminPage /> : <MenuPage />;
}

export default App;
