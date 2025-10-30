import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PinAuth } from "@/components/auth/pin-auth";
import POSPage from "@/pages/pos";
import TablesPage from "@/pages/tables";
import EmployeesPage from "@/pages/employees";
import InventoryPage from "@/pages/inventory";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import SuppliersPage from "@/pages/suppliers";
import PurchasesPage from "@/pages/purchases";
import PurchaseFormPage from "@/pages/purchase-form";
import PurchaseViewPage from "./pages/purchase-view";
import AttendancePage from "@/pages/attendance";
import AttendanceQRPage from "./pages/attendance-qr";
import CustomerDisplay from "@/pages/customer-display";
import SalesOrders from "@/pages/sales-orders";
import CashBookPage from "./pages/cash-book";
import NotFoundPage from "./pages/not-found";
import PaymentMethodsPage from "@/pages/payment-methods";
import CustomersPage from "./pages/customers";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "wouter/use-location"; // Assuming Navigate is available or similar functionality

// Define StoreSettings interface if not already defined elsewhere
interface StoreSettings {
  businessType: string;
  // other properties of storeSettings
}

function Router({ onLogout }: { onLogout: () => void }) {
  const RedirectToSales = () => {
    const [, setLocation] = useLocation();

    // Assuming you have a function to get your auth token
    const getAuthToken = () => localStorage.getItem("authToken");
    const { data: storeSettings } = useQuery<StoreSettings>({
      queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings"],
      queryFn: async () => {
        const token = getAuthToken();
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`, // Set the token in the Authorization header
          },
        });
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      },
    });

    useEffect(() => {
      if (storeSettings) {
        const businessType = storeSettings.businessType;

        // Route based on business type
        if (businessType === "laundry" || businessType === "retail") {
          // POS Giặt là or POS Bán lẻ -> Direct sales screen
          setLocation("/pos", { replace: true });
        } else {
          // POS Nhà hàng or default -> Table selection screen
          setLocation("/tables", { replace: true });
        }
      }
    }, [storeSettings, setLocation]);

    return null;
  };

  return (
    <Switch>
      <Route path="/" component={RedirectToSales} />
      <Route path="/pos" component={() => <POSPage onLogout={onLogout} />} />
      <Route
        path="/tables"
        component={() => <TablesPage onLogout={onLogout} />}
      />
      <Route
        path="/inventory"
        component={() => <InventoryPage onLogout={onLogout} />}
      />
      <Route
        path="/reports"
        component={() => <ReportsPage onLogout={onLogout} />}
      />
      <Route
        path="/employees"
        component={() => <EmployeesPage onLogout={onLogout} />}
      />
      <Route
        path="/settings"
        component={() => <SettingsPage onLogout={onLogout} />}
      />
      <Route
        path="/purchases"
        component={() => <PurchasesPage onLogout={onLogout} />}
      />
      <Route
        path="/purchases/view/:id"
        component={() => <PurchaseViewPage onLogout={onLogout} />}
      />
      <Route
        path="/purchases/create"
        component={() => <PurchaseFormPage onLogout={onLogout} />}
      />
      <Route
        path="/purchases/edit/:id"
        component={({ id }: { id: string }) => (
          <PurchaseFormPage id={id} onLogout={onLogout} />
        )}
      />
      <Route
        path="/suppliers"
        component={() => <SuppliersPage onLogout={onLogout} />}
      />
      <Route
        path="/attendance"
        component={() => <AttendancePage onLogout={onLogout} />}
      />
      <Route path="/attendance-qr" component={AttendanceQRPage} />
      <Route
        path="/payment-methods"
        component={() => <PaymentMethodsPage onLogout={onLogout} />}
      />
      <Route
        path="/inventory"
        component={() => <InventoryPage onLogout={onLogout} />}
      />
      <Route path="/customer-display" component={CustomerDisplay} />
      <Route path="/sales-orders" component={SalesOrders} />
      <Route
        path="/cash-book"
        component={() => <CashBookPage onLogout={onLogout} />}
      />
      {/* New route for customers */}
      <Route
        path="/customers"
        component={() => <CustomersPage onLogout={onLogout} />}
      />
      <Route path="*" component={NotFoundPage} />
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    // Xóa tất cả thông tin đăng nhập
    sessionStorage.clear();
    localStorage.removeItem("authToken");
    localStorage.removeItem("storeInfo");
    localStorage.removeItem("currentDomain");
    setIsAuthenticated(false);
  };

  // Check if current path is customer display to bypass authentication
  const isCustomerDisplay = window.location.pathname === "/customer-display";

  // Check for existing authentication on mount
  useEffect(() => {
    const currentDomain = window.location.hostname;
    const storedDomain = localStorage.getItem("currentDomain");

    // Check if domain has changed - MUST clear everything
    if (storedDomain && storedDomain !== currentDomain) {
      console.log(`🔄 Domain changed from ${storedDomain} to ${currentDomain} - forcing complete logout`);
      
      // Clear ALL storage to ensure clean state
      sessionStorage.clear();
      localStorage.clear();
      
      // Force re-authentication
      setIsAuthenticated(false);
      
      console.log("✅ All auth data cleared - user must login again");
      return;
    }

    const pinAuth = sessionStorage.getItem("pinAuthenticated");
    const token = localStorage.getItem("authToken");

    if (pinAuth === "true" && token) {
      setIsAuthenticated(true);
    } else {
      // Nếu thiếu một trong hai, xóa hết và yêu cầu đăng nhập lại
      sessionStorage.removeItem("pinAuthenticated");
      localStorage.removeItem("authToken");
      localStorage.removeItem("storeInfo");
      localStorage.removeItem("currentDomain");
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {!isAuthenticated && !isCustomerDisplay ? (
          <PinAuth onAuthSuccess={handleAuthSuccess} />
        ) : (
          <Router onLogout={handleLogout} />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
