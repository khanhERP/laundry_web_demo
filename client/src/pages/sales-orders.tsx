import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { POSHeader } from "@/components/pos/header";
import { RightSidebar } from "@/components/ui/right-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Search,
  FileText,
  Package,
  Printer,
  Mail,
  X,
  Download,
  CreditCard, // Import CreditCard icon
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTranslation } from "@/lib/i18n";
import * as XLSX from "xlsx";
import { EInvoiceModal } from "@/components/pos/einvoice-modal";
import { PrintDialog } from "@/components/pos/print-dialog";
import { ReceiptModal } from "@/components/pos/receipt-modal";
import { PaymentMethodModal } from "@/components/pos/payment-method-modal"; // Import PaymentMethodModal
import { toast } from "@/hooks/use-toast";
import { NumericFormat } from "react-number-format"; // Import NumericFormat
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Invoice {
  id: number;
  invoiceNumber: string;
  tradeNumber: string;
  templateNumber: string;
  symbol: string;
  customerName: string;
  customerTaxCode: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  subtotal: string;
  tax: string;
  total: string;
  paymentMethod: number | string | null; // Allow string for new payment methods, null for unpaid
  invoiceDate: string;
  status: string;
  einvoiceStatus: number;
  invoiceStatus: number;
  notes: string;
  createdAt: string;
  updatedAt?: string; // Added updatedAt field
  type?: "invoice" | "order"; // Added to differentiate
  displayNumber?: string;
  displayStatus?: number;
  orderNumber?: string;
  salesChannel?: string;
  tableId?: number;
  orderedAt?: string;
  discount?: string; // Added discount field
  date?: string; // Added missing date field
  employeeId?: number; // Added missing employeeId field
  customerCode?: string; // Added missing customerCode field
  paymentStatus?: string; // Added missing paymentStatus field
  exactDiscount?: string; // Added missing exactDiscount field
  priceIncludeTax?: boolean; // Added priceIncludeTax field
  isPaid?: boolean; // Added isPaid field
  customerId?: number; // Added customerId field
}

interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  total: string;
  taxRate: string;
  discount?: string; // Added discount field
  sku?: string; // Added sku field
  productSku?: string; // Added productSku field
}

interface Order {
  id: number;
  orderNumber: string;
  tableId?: number;
  employeeId?: number;
  status: string;
  customerName?: string;
  customerPhone?: string; // Added customerPhone
  customerCount: number;
  subtotal: string;
  tax: string;
  total: string;
  paymentMethod: number | string | null; // Allow string for new payment methods, null for unpaid
  paymentStatus: string;
  einvoiceStatus: number;
  notes?: string;
  orderedAt: string;
  salesChannel?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  customerAddress?: string;
  customerTaxCode?: string;
  symbol?: string;
  templateNumber?: string;
  customerEmail?: string;
  invoiceStatus?: number;
  type?: "order";
  date?: string;
  displayNumber?: string;
  displayStatus?: number;
  discount?: string; // Added discount field
  priceIncludeTax?: boolean; // Added priceIncludeTax field
  isPaid?: boolean; // Added isPaid field
  customerId?: number; // Added customerId field
}

// Helper function to safely determine item type
const getItemType = (item: any): "invoice" | "order" => {
  if (item?.type) return item.type;
  if (item?.orderNumber) return "order";
  if (item?.invoiceNumber || item?.tradeNumber) return "invoice";
  return "invoice"; // default fallback
};

export default function SalesOrders() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [storeSettings, setStoreSettings] = useState<any>(null); // To store store settings for priceIncludesTax

  // Initialize form for react-hook-form
  const form = useForm();

  // State for PaymentMethodModal
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [orderForPayment, setOrderForPayment] = useState<any>(null);
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false); // State for EInvoiceModal
  const [isTitle, setIsTitle] = useState(true); // State for title visibility

  // Listen for print completion and einvoice modal close events
  useEffect(() => {
    const handlePrintCompleted = (event: CustomEvent) => {
      console.log(
        "📄 Sales Orders: Print completed, closing all modals and refreshing",
      );

      // Close all modals
      setSelectedInvoice(null);
      setShowPublishDialog(false);
      setShowCancelDialog(false);
      setShowPrintDialog(false);
      setShowEInvoiceModal(false);
      setPrintReceiptData(null);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"] });
    };

    const handleEInvoiceModalClosed = async (event: CustomEvent) => {
      console.log("📧 Sales Orders: E-invoice modal closed, refreshing data");

      // Clear cache completely and force fresh fetch
      queryClient.removeQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      queryClient.removeQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items"] });
      queryClient.removeQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoices"] });

      // Force immediate refetch with fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] }),
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items"] }),
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"] }),
        queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] }),
        queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoices"] }),
      ]);

      console.log("✅ Sales Orders: Data refreshed successfully from database");
    };

    window.addEventListener(
      "printCompleted",
      handlePrintCompleted as EventListener,
    );
    window.addEventListener(
      "einvoiceModalClosed",
      handleEInvoiceModalClosed as EventListener,
    );

    return () => {
      window.removeEventListener(
        "printCompleted",
        handlePrintCompleted as EventListener,
      );
      window.removeEventListener(
        "einvoiceModalClosed",
        handleEInvoiceModalClosed as EventListener,
      );
    };
  }, [queryClient]);

  // Chỉ refetch khi có sự kiện cụ thể từ các action thành công
  useEffect(() => {
    const handleOrderUpdate = async () => {
      console.log("🔄 Sales Orders: Order updated, refetching data...");
      await queryClient.refetchQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"],
        exact: false,
      });
    };

    // Chỉ listen các event quan trọng
    window.addEventListener("orderStatusUpdated", handleOrderUpdate);
    window.addEventListener("paymentCompleted", handleOrderUpdate);

    return () => {
      window.removeEventListener("orderStatusUpdated", handleOrderUpdate);
      window.removeEventListener("paymentCompleted", handleOrderUpdate);
    };
  }, [queryClient]);
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const orderParam = urlParams.get("order");

  // Set default dates to today
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownSearch, setCustomerDropdownSearch] = useState(""); // Separate state for dropdown search
  const [orderNumberSearch, setOrderNumberSearch] = useState(orderParam || "");
  const [customerCodeSearch, setCustomerCodeSearch] = useState("");
  const [salesChannelFilter, setSalesChannelFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [einvoiceStatusFilter, setEinvoiceStatusFilter] = useState("all");
  const [dateFilterMode, setDateFilterMode] = useState<"created" | "completed">(
    "created",
  );
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null); // Renamed to selectedItem for clarity
  const [isEditing, setIsEditing] = useState(false);
  const [editableInvoice, setEditableInvoice] = useState<Invoice | null>(null); // Renamed to editableItem
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [showBulkCancelDialog, setShowBulkCancelDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Handle column sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Fetch store settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setStoreSettings(data);
      } catch (error) {
        console.error("Error fetching store settings:", error);
      }
    };
    fetchSettings();
  }, []);

  // Query customers for datalist
  const { data: customers = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Query orders using /api/orders/list with storeCode filter
  const {
    data: ordersResponse,
    isLoading: ordersLoading,
    error: ordersError,
  } = useQuery({
    queryKey: [
      "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list",
      startDate,
      endDate,
      dateFilterMode,
      // customerSearch removed - only used for dropdown filtering, not for API query
      orderNumberSearch,
      customerCodeSearch,
      searchTerm,
      salesChannelFilter,
      orderStatusFilter,
      einvoiceStatusFilter,
      currentPage,
      itemsPerPage,
      sortField, // Include sort parameters in query key
      sortOrder,
    ],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();

        // Add date filters - ensure proper format
        if (startDate && startDate.trim() !== "") {
          params.append("startDate", startDate);
        }
        if (endDate && endDate.trim() !== "") {
          params.append("endDate", endDate);
        }
        // Add date filter mode
        params.append("dateFilterMode", dateFilterMode);
        if (customerSearch) params.append("customerName", customerSearch);
        if (orderNumberSearch) params.append("orderNumber", orderNumberSearch);
        if (customerCodeSearch)
          params.append("productSearch", customerCodeSearch);
        if (searchTerm) params.append("productSearch", searchTerm);
        if (salesChannelFilter && salesChannelFilter !== "all") {
          params.append("salesChannel", salesChannelFilter);
        }
        if (orderStatusFilter && orderStatusFilter !== "all") {
          params.append("status", orderStatusFilter);
        }
        if (einvoiceStatusFilter && einvoiceStatusFilter !== "all") {
          params.append("einvoiceStatus", einvoiceStatusFilter);
        }
        params.append("page", currentPage.toString());
        if (itemsPerPage) {
          params.append("limit", itemsPerPage.toString());
        }
        // Add sorting parameters to the query
        if (sortField) {
          params.append("sortBy", sortField);
          params.append("sortOrder", sortOrder);
        }

        const url = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list?${params.toString()}`;
        const response = await apiRequest("GET", url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Sales Orders - Orders loaded with date filter:", {
          url: url,
          startDate,
          endDate,
          total: data?.orders?.length || 0,
          hasStoreCodeFilter: true,
        });

        return data;
      } catch (error) {
        console.error("Error fetching orders:", error);
        return { orders: [], pagination: {} };
      }
    },
    retry: 1,
    retryDelay: 500,
    staleTime: 0, // Không cache
    gcTime: 0, // Không giữ trong memory
    refetchOnMount: true, // Refetch when component mounts or queryKey changes
    refetchOnWindowFocus: false, // Không tự động refetch khi focus
    refetchInterval: false, // Không auto-refresh
    refetchIntervalInBackground: false, // Không background polling
  });

  const orders = ordersResponse?.orders || [];

  // Query all products to get tax rates
  const { data: products = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching products:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent unnecessary refetches
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Debounce customer search to avoid too many API calls (for order list filter)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Customer search will trigger API refetch via queryKey dependency
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Query tables to map tableId to table number
  const { data: tables = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching tables:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  const getTableNumber = (tableId: number): string => {
    const table = tables.find((t: any) => t.id === tableId);
    // Use table.name if available, fallback to table.number or table.tableNumber
    const tableName =
      table?.name || table?.number || table?.tableNumber || tableId;

    // Check if tableName already starts with "Bàn" or "Ban" to avoid duplication
    const tableNameStr = String(tableName);
    if (
      tableNameStr.toLowerCase().startsWith("bàn") ||
      tableNameStr.toLowerCase().startsWith("ban")
    ) {
      return tableNameStr;
    }

    return `Bàn ${tableName}`;
  };

  const isLoading = ordersLoading; // Only orders loading is relevant now
  const hasError = ordersError; // Only orders error is relevant now

  // Query items for selected order
  const {
    data: orderItems = [],
    isLoading: orderItemsLoading,
    error: orderItemsError,
  } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items", selectedInvoice?.id],
    queryFn: async () => {
      if (!selectedInvoice?.id) {
        console.log("❌ No selected invoice ID");
        return [];
      }

      console.log("📦 Fetching order items for order:", selectedInvoice.id);

      try {
        const response = await apiRequest(
          "GET",
          `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${selectedInvoice.id}`,
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Error response:", response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log(
          "✅ Order items loaded successfully:",
          data?.length || 0,
          "items",
        );

        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("❌ Error fetching order items:", error);
        throw error; // Re-throw to trigger error state
      }
    },
    enabled: !!selectedInvoice?.id && getItemType(selectedInvoice) === "order",
    retry: 2,
    retryDelay: 1000,
    staleTime: 0,
    gcTime: 0,
  });

  // Mutation for updating an order
  const updateOrderMutation = useMutation({
    mutationFn: async (updatedOrder: Order) => {
      console.log("🔄 Updating order with data:", updatedOrder);

      const updatePayload = {
        customerName: updatedOrder.customerName || "",
        customerPhone: updatedOrder.customerPhone || "",
        customerAddress: updatedOrder.customerAddress || "",
        customerTaxCode: updatedOrder.customerTaxCode || "",
        customerEmail: updatedOrder.customerEmail || "",
        isPaid: updatedOrder.isPaid,
        notes: updatedOrder.notes || "",
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        subtotal: updatedOrder.subtotal,
        tax: updatedOrder.tax,
        total: updatedOrder.total,
        discount: updatedOrder.discount,
        invoiceNumber: updatedOrder.invoiceNumber,
        symbol: updatedOrder.symbol,
        einvoiceStatus: updatedOrder.einvoiceStatus,
        // Add other fields that might be updated
        orderNumber: updatedOrder.orderNumber,
        date: updatedOrder.date, // If date is editable
        customerId: updatedOrder.customerId, // If customer selection is implemented
        priceIncludeTax: updatedOrder.priceIncludeTax, // If this field is editable
        paymentMethod: updatedOrder.paymentMethod, // Include paymentMethod in update payload
      };

      console.log("📝 Update payload:", updatePayload);

      const response = await apiRequest(
        "PUT",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${updatedOrder.id}`,
        updatePayload,
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update order: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: async (data, updatedOrder) => {
      console.log("✅ Order updated successfully:", data);

      // Only refetch orders list and order items for the specific order
      await queryClient.refetchQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"],
        exact: false,
      });

      await queryClient.refetchQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items", updatedOrder.id],
      });

      setIsEditing(false);
      setEditableInvoice(null);

      if (selectedInvoice) {
        setSelectedInvoice({ ...selectedInvoice, ...data });
      }

      toast({
        title: "Cập nhật thành công",
        description: "Đơn hàng đã được cập nhật",
      });
    },
    onError: (error) => {
      console.error("Error updating order:", error);
      toast({
        title: "Lỗi cập nhật",
        description: `Không thể cập nhật đơn hàng: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for bulk canceling orders
  const bulkCancelOrdersMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      // Changed to accept orderIds directly
      const results = [];
      for (const orderId of orderIds) {
        try {
          // For orders, update status to 'cancelled'
          const response = await apiRequest(
            "PUT",
            `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderId}/status`,
            {
              status: "cancelled",
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to cancel order ${orderId}: ${errorText}`);
          }

          results.push({ orderId, success: true });
        } catch (error) {
          console.error(`Error canceling order ${orderId}:`, error);
          results.push({
            orderId,
            success: false,
            error: (error as Error).message,
          });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      console.log("Bulk cancel results:", results);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      setShowBulkCancelDialog(false);
      setSelectedOrderIds(new Set());

      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"] });

      // Update selected order if it was cancelled
      if (selectedInvoice) {
        const wasCancelled = results.find(
          (r) => r.orderId === String(selectedInvoice.id) && r.success,
        );
        if (wasCancelled) {
          setSelectedInvoice({
            ...selectedInvoice,
            status: "cancelled",
          });
          setIsEditing(false);
          setEditableInvoice(null);
        }
      }

      if (successCount > 0) {
        alert(
          `Đã hủy thành công ${successCount} đơn hàng${failCount > 0 ? `, ${failCount} đơn thất bại` : ""}`,
        );
      } else {
        alert(`Không thể hủy đơn hàng nào`);
      }
    },
    onError: (error) => {
      console.error("Bulk cancel error:", error);
      setShowBulkCancelDialog(false);
      alert(`Lỗi hủy đơn hàng: ${error.message}`);
    },
  });

  // Mutation for publishing invoice (kept for now, but might be removed if only orders are displayed)
  const publishRequestMutation = useMutation({
    mutationFn: async (invoiceData: any) => {
      const response = await apiRequest(
        "POST",
        "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice/publish",
        invoiceData,
      );
      return response.json();
    },
    onSuccess: async (result, variables) => {
      console.log("✅ E-invoice published successfully:", result);

      if (result.success && selectedInvoice) {
        try {
          const invoiceNo =
            result.data?.invoiceNo || result.invoiceNumber || null;
          const symbol = result.data?.symbol || result.symbol || "AA/25E";
          const templateNumber =
            result.data?.templateNumber || result.templateNumber || "1C25TYY";

          const updateData = {
            einvoiceStatus: 1, // Đã phát hành
            invoiceStatus: 1, // Hoàn thành
            status: "published",
            invoiceNumber: invoiceNo,
            symbol: symbol,
            templateNumber: templateNumber,
            tradeNumber:
              invoiceNo || selectedInvoice.orderNumber || `TXN-${Date.now()}`,
            notes: `E-Invoice published - Invoice No: ${invoiceNo || "N/A"}`,
          };

          console.log(`Updating order with data:`, updateData);

          const updateResponse = await apiRequest(
            "PUT",
            `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${selectedInvoice.id}`,
            updateData,
          );
          console.log(
            "✅ Order updated successfully after publish:",
            updateResponse,
          );

          const items = orderItems;
          const receiptData = {
            transactionId:
              invoiceNo || selectedInvoice.orderNumber || `TXN-${Date.now()}`,
            orderId: selectedInvoice.id,
            items: items.map((item) => ({
              id: item.id || item.productId,
              productName: item.productName || item.name,
              price: item.unitPrice || item.price || "0",
              quantity: item.quantity || 1,
              total: item.total || "0",
              sku: item.sku || `SKU${item.productId}`,
              taxRate: parseFloat(item.taxRate || "0"),
            })),
            subtotal: selectedInvoice.subtotal || "0",
            tax: selectedInvoice.tax || "0",
            total: selectedInvoice.total || "0",
            paymentMethod: "einvoice",
            amountReceived: selectedInvoice.total || "0",
            change: "0",
            cashierName: "System User",
            createdAt: new Date().toISOString(),
            invoiceNumber: invoiceNo,
            customerName: selectedInvoice.customerName || "Khách hàng",
            customerTaxCode: selectedInvoice.customerTaxCode || null,
          };

          setPrintReceiptData(receiptData);
          setShowPrintDialog(true);

          queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"] });

          setShowPublishDialog(false);
          setSelectedInvoice(null);

          alert(
            `Hóa đơn đã phát hành thành công!\nSố hóa đơn: ${invoiceNo || "N/A"}\n\nMàn hình in hóa đơn sẽ hiển thị.`,
          );
        } catch (updateError) {
          console.error("❌ Error updating order after publish:", {
            error: updateError,
            message: (updateError as Error)?.message,
            stack: (updateError as Error)?.stack,
          });

          const errorMessage =
            (updateError as Error)?.message ||
            (updateError as Error)?.toString() ||
            "Lỗi không xác định";
          alert(
            `Hóa đơn đã phát hành nhưng không thể cập nhật trạng thái: ${errorMessage}`,
          );
        }
      } else {
        alert(`Lỗi phát hành hóa đơn: ${result.message || "Không xác định"}`);
      }
    },
    onError: (error) => {
      console.error("❌ Error publishing invoice:", error);
      alert(`Lỗi phát hành hóa đơn: ${(error as Error).message}`);
    },
  });

  // Mutation for canceling a single order
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      // Changed to accept orderId
      const response = await apiRequest(
        "PUT",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderId}/status`,
        {
          status: "cancelled",
        },
      );

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.text();
          errorMessage = errorData || errorMessage;
        } catch (textError) {
          console.error("Could not parse error response:", textError);
        }
        throw new Error(`Không thể hủy đơn hàng: ${errorMessage}`);
      }

      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        } else {
          return { success: true, message: "Order cancelled successfully" };
        }
      } catch (jsonError) {
        console.warn(
          "Response is not valid JSON, but request was successful:",
          jsonError,
        );
        return { success: true, message: "Order cancelled successfully" };
      }
    },
    onSuccess: async (data, orderId) => {
      console.log("Order cancelled successfully:", orderId);

      setShowCancelDialog(false);

      // Only refetch orders list
      await queryClient.refetchQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"],
        exact: false,
      });

      // Update selected order if it was cancelled
      if (selectedInvoice && selectedInvoice.id === orderId) {
        setSelectedInvoice({
          ...selectedInvoice,
          status: "cancelled",
        });

        setIsEditing(false);
        setEditableInvoice(null);
      }

      toast({
        title: "Đã hủy đơn hàng",
        description: "Đơn hàng đã được hủy",
      });
    },
    onError: (error) => {
      console.error("Error canceling order:", error);
      setShowCancelDialog(false);
      toast({
        title: "Lỗi hủy đơn hàng",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPaymentMethodName = (method: number | string | null) => {
    // Handle null/undefined cases explicitly
    if (method === null || method === undefined) {
      return t("common.unpaid");
    }

    switch (method) {
      case 1:
      case "cash":
        return t("common.cash");
      case 2:
      case "creditCard":
      case "debitCard":
      case "bankTransfer":
        return t("common.bankTransfer");
      case 3:
      case "qrCode":
      case "momo":
      case "zalopay":
      case "vnpay":
      case "grabpay":
        return t("common.qrCode");
      case "Đối trừ công nợ":
        return t("common.creditNote");
      case "unpaid":
        return t("common.unpaid");
      default:
        return t("common.unpaid"); // Changed default from "Tiền mặt" to "Chưa thanh toán"
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: "bg-gray-100 text-gray-800",
      published: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800", // Added pending status
      paid: "bg-green-100 text-green-800", // Added paid status
    };

    const statusLabels = {
      draft: "Nháp",
      published: "Đã xuất",
      cancelled: "Đã hủy",
      pending: "Chờ xử lý",
      paid: "Đã thanh toán",
    };

    return (
      <Badge
        className={
          statusColors[status as keyof typeof statusColors] ||
          statusColors.draft
        }
      >
        {statusLabels[status as keyof typeof statusLabels] || status}
      </Badge>
    );
  };

  const getEInvoiceStatusBadge = (status: number) => {
    const statusLabels = {
      0: t("common.einvoiceStatus.notPublished"),
      1: t("common.einvoiceStatus.published"),
      2: t("common.einvoiceStatus.draft"),
      3: t("common.einvoiceStatus.approved"),
      4: t("common.einvoiceStatus.replaced"),
      5: t("common.einvoiceStatus.tempReplaced"),
      6: t("common.einvoiceStatus.replacement"),
      7: t("common.einvoiceStatus.adjusted"),
      8: t("common.einvoiceStatus.tempAdjusted"),
      9: t("common.einvoiceStatus.adjustment"),
      10: t("common.einvoiceStatus.cancelled"),
    };

    const statusColors = {
      0: "bg-gray-100 text-gray-800",
      1: "bg-green-100 text-green-800",
      2: "bg-blue-100 text-blue-800",
      3: "bg-green-100 text-green-800",
      4: "bg-red-100 text-red-800",
      5: "bg-yellow-100 text-yellow-800",
      6: "bg-green-100 text-green-800",
      7: "bg-orange-100 text-orange-800",
      8: "bg-yellow-100 text-yellow-800",
      9: "bg-orange-100 text-orange-800",
      10: "bg-red-100 text-red-800",
    };

    return (
      <Badge
        className={
          statusColors[status as keyof typeof statusColors] || statusColors[0]
        }
      >
        {statusLabels[status as keyof typeof statusColors] ||
          t("common.einvoiceStatus.notPublished")}
      </Badge>
    );
  };

  const getInvoiceStatusBadge = (status: number, order?: Order) => {
    const statusLabels = {
      1: t("common.completed"),
      2: t("common.serving"),
      3: t("common.cancelled"),
    };

    const statusColors = {
      1: "bg-green-100 text-green-800",
      2: "bg-blue-100 text-blue-800",
      3: "bg-red-100 text-red-800",
    };

    // Special handling for pending unpaid orders - only show for laundry business
    if (
      storeSettings?.businessType === "laundry" &&
      order &&
      order.status === "pending" &&
      order.paymentStatus === "pending"
    ) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          {t("orders.status.ordered")}
        </Badge>
      );
    }

    return (
      <Badge
        className={
          statusColors[status as keyof typeof statusColors] || statusColors[1]
        }
      >
        {statusLabels[status as keyof typeof statusLabels] ||
          t("common.completed")}
      </Badge>
    );
  };

  // Map orders to a consistent structure similar to Invoice for easier handling
  const combinedData: Invoice[] = Array.isArray(orders)
    ? orders.map((order: Order) => ({
        ...order,
        type: "order" as const,
        date: order.orderedAt,
        displayNumber:
          order.orderNumber || `ORD-${String(order.id).padStart(13, "0")}`,
        // Map order status to invoiceStatus convention
        displayStatus:
          order.status === "paid"
            ? 1
            : order.status === "pending" && order.paymentStatus === "pending"
              ? 2 // Chờ xử lý (pending unpaid)
              : order.status === "pending"
                ? 2 // Đang phục vụ
                : order.status === "cancelled"
                  ? 3
                  : 2,
        customerName: order.customerName || "",
        invoiceStatus:
          order.status === "paid"
            ? 1
            : order.status === "pending" && order.paymentStatus === "pending"
              ? 2 // Chờ xử lý (pending unpaid)
              : order.status === "pending"
                ? 2 // Đang phục vụ
                : order.status === "cancelled"
                  ? 3
                  : 2,
        customerPhone: order.customerPhone || "", // Ensure customerPhone is mapped
        customerAddress: order.customerAddress || "",
        symbol: order.symbol || order.templateNumber || "",
        invoiceNumber: order.orderNumber || ``,
        tradeNumber: order.orderNumber || "",
        invoiceDate: order.orderedAt,
        einvoiceStatus: order.einvoiceStatus || 0,
        // Ensure all fields from Invoice interface are present, even if null/empty
        templateNumber: order.templateNumber || "",
        customerEmail: order.customerEmail || "",
        subtotal: order.subtotal || "0",
        tax: order.tax || "0",
        total: order.total || "0",
        paymentMethod: order.paymentMethod || null, // Default to null for unpaid
        notes: order.notes || "",
        createdAt: order.orderedAt || order.createdAt, // Use orderedAt as primary, fallback to createdAt
        updatedAt: order.updatedAt, // Keep updatedAt for cancellation/completion time
        discount: order.discount || "0", // Map discount field
        priceIncludeTax: order.priceIncludeTax || false, // Map priceIncludeTax field
        customerId: order.customerId, // Map customerId field
      }))
    : [];

  const filteredInvoices = Array.isArray(combinedData)
    ? combinedData.sort((a: any, b: any) => {
        // Apply sorting if a field is selected
        if (sortField) {
          let aValue: any;
          let bValue: any;

          switch (sortField) {
            case "orderNumber":
              aValue = a.displayNumber || "";
              bValue = b.displayNumber || "";
              break;
            case "createdAt":
              aValue = new Date(a.createdAt || 0).getTime();
              bValue = new Date(b.createdAt || 0).getTime();
              break;
            case "updatedAt":
              aValue = new Date(a.updatedAt || 0).getTime();
              bValue = new Date(b.updatedAt || 0).getTime();
              break;
            case "salesChannel":
              aValue = a.salesChannel || "";
              bValue = b.salesChannel || "";
              break;
            case "customerCode":
              aValue = a.customerCode || a.customerTaxCode || "";
              bValue = b.customerCode || b.customerTaxCode || "";
              break;
            case "customerName":
              aValue = a.customerName || "";
              bValue = b.customerName || "";
              break;
            case "customerPhone": // Added for sorting customer phone
              aValue = a.customerPhone || "";
              bValue = b.customerPhone || "";
              break;
            case "subtotal":
              aValue = parseFloat(a.subtotal || "0");
              bValue = parseFloat(b.subtotal || "0");
              break;
            case "discount":
              aValue = parseFloat(a.discount || "0");
              bValue = parseFloat(b.discount || "0");
              break;
            case "tax":
              aValue = parseFloat(a.tax || "0");
              bValue = parseFloat(b.tax || "0");
              break;
            case "total":
              aValue = parseFloat(a.total || "0");
              bValue = parseFloat(b.total || "0");
              break;
            // Removed employeeCode and employeeName from sorting
            case "symbol":
              aValue = a.symbol || a.templateNumber || "";
              bValue = b.symbol || b.templateNumber || "";
              break;
            case "invoiceNumber":
              aValue = a.invoiceNumber || "";
              bValue = b.invoiceNumber || "";
              break;
            case "notes":
              aValue = a.notes || "";
              bValue = b.notes || "";
              break;
            case "status":
              aValue = a.displayStatus || 0;
              bValue = b.displayStatus || 0;
              break;
            default:
              aValue = "";
              bValue = "";
          }

          // Compare values
          if (typeof aValue === "string" && typeof bValue === "string") {
            const comparison = aValue.localeCompare(bValue, "vi");
            return sortOrder === "asc" ? comparison : -comparison;
          } else {
            const comparison = aValue - bValue;
            return sortOrder === "asc" ? comparison : -comparison;
          }
        }

        // Default sort by date (newest first)
        const dateA = new Date(
          a.orderedAt || a.createdAt || a.date || a.invoiceDate,
        );
        const dateB = new Date(
          b.orderedAt || b.createdAt || b.date || b.invoiceDate,
        );

        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;

        return dateB.getTime() - dateA.getTime();
      })
    : [];

  // Auto-expand matching order when data is available and order param exists
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderParam = urlParams.get("order");

    if (orderParam && filteredInvoices.length > 0) {
      const matchingOrder = filteredInvoices.find((item) => {
        const displayNumber = item.displayNumber?.toLowerCase() || "";
        const orderNumber = item.orderNumber?.toLowerCase() || "";
        const invoiceNumber = item.invoiceNumber?.toLowerCase() || "";
        const searchParam = orderParam.toLowerCase();

        return (
          displayNumber.includes(searchParam) ||
          orderNumber.includes(searchParam) ||
          invoiceNumber.includes(searchParam) ||
          displayNumber === searchParam ||
          orderNumber === searchParam ||
          invoiceNumber === searchParam
        );
      });

      if (
        matchingOrder &&
        (!selectedInvoice || selectedInvoice.id !== matchingOrder.id)
      ) {
        console.log(
          "🎯 Sales Orders: Auto-expanding matching order:",
          matchingOrder.displayNumber,
        );
        setSelectedInvoice(matchingOrder);

        // Clear URL parameter after auto-expand
        setTimeout(() => {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        }, 500);
      }
    }
  }, [filteredInvoices]);

  const formatCurrency = (
    amount: string | number | undefined | null,
  ): string => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (typeof num !== "number" || isNaN(num)) {
      return "0";
    }
    return Math.floor(num).toLocaleString("vi-VN");
  };

  const formatDate = (dateStr: string | undefined | null): string => {
    if (!dateStr) return "";
    try {
      // Parse as UTC date and convert to Vietnam timezone (UTC+7)
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";

      // Convert to Vietnam timezone using toLocaleString
      const vietnamTime = date.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      // Format: dd/MM/yyyy HH:mm:ss
      return vietnamTime.replace(
        /(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/,
        "$1/$2/$3 $4:$5:$6",
      );
    } catch (error) {
      console.error("Error formatting date:", dateStr, error);
      return "";
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditableInvoice({ ...order });
    setIsEditing(true);
    // Fetch order items to populate editable state
    // The orderItems data is already fetched by useQuery, so we just need to use it.
  };

  // Function to add a new order item row (only in UI, not saved to database yet)
  const handleAddNewOrderItem = () => {
    if (!selectedInvoice || !selectedInvoice.id) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn đơn hàng trước khi thêm dòng mới",
        variant: "destructive",
      });
      return;
    }

    console.log("➕ Adding new empty row for order:", selectedInvoice.id);

    // Generate a temporary negative ID for the new row (to distinguish from real database items)
    const tempId = -Date.now();

    // New item will have 0 values initially
    // When user enters product info, all values will be recalculated in updateOrderItemField
    const newItemDiscount = "0";
    const newItemTax = "0";
    const newItemPriceBeforeTax = "0";

    // Create an empty row item
    const newEmptyItem = {
      id: tempId,
      orderId: selectedInvoice.id,
      productId: 0,
      productName: "",
      sku: "",
      quantity: 1,
      unitPrice: "0",
      total: "0",
      discount: newItemDiscount,
      tax: newItemTax,
      priceBeforeTax: newItemPriceBeforeTax,
      _isNew: true, // Flag to identify new unsaved items
    };

    // Add the new empty item to editedOrderItems state
    setEditedOrderItems((prev) => ({
      ...prev,
      [tempId]: {
        productId: 0,
        productName: "",
        sku: "",
        quantity: 1,
        unitPrice: "0",
        total: "0",
        discount: newItemDiscount,
        tax: newItemTax,
        priceBeforeTax: newItemPriceBeforeTax,
        _isNew: true,
      },
    }));

    // Add to the orderItems query data temporarily for display
    queryClient.setQueryData(
      ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items", selectedInvoice.id],
      (oldData: any) => {
        const currentItems = Array.isArray(oldData) ? oldData : [];
        return [...currentItems, newEmptyItem];
      },
    );

    toast({
      title: "Đã thêm dòng mới",
      description: "Vui lòng nhập thông tin sản phẩm và ấn Lưu",
    });

    // Focus on SKU field of new row after a short delay
    setTimeout(() => {
      const visibleItems = orderItems.filter(
        (item: any) => !editedOrderItems[item.id]?._deleted,
      );
      const newRowIndex = visibleItems.length;
      const skuInput = document.querySelector(
        `[data-field="orderitem-sku-${newRowIndex}"]`,
      ) as HTMLInputElement;
      skuInput?.focus();
    }, 100);
  };

  const handleSaveOrder = async () => {
    if (!editableInvoice) return;

    try {
      console.log("💾 Starting save order process:", {
        orderId: editableInvoice.id,
        editedItemsCount: Object.keys(editedOrderItems).length,
        editedItems: editedOrderItems,
      });

      // Step 1: Separate new items from existing items
      const itemsToCreate: any[] = [];
      const itemsToUpdate: any[] = [];
      const itemsToDelete: any[] = [];

      // Use for...of loop to support continue/break statements
      for (const [itemId, changes] of Object.entries(editedOrderItems)) {
        const id = parseInt(itemId);

        if (changes._deleted) {
          // Only delete if it's an existing item (positive ID)
          if (id > 0) {
            itemsToDelete.push({ id, ...changes });
          }
          continue; // Skip to next item
        }

        if (changes._isNew || id < 0) {
          // ✨ NEW ITEM - Will be INSERTED into database
          console.log(`➕ Processing NEW item for INSERT (ID: ${id})`);

          // Get data from cache (may be incomplete for new items)
          const fullItemData = orderItems.find((item: any) => item.id === id);

          // Get product info to ensure we have the SKU
          const product = products.find(
            (p: any) => p.id === (changes.productId || fullItemData?.productId),
          );

          // Merge all available data - prioritize changes from editedOrderItems
          const completeItemData = {
            ...(fullItemData || {}),
            ...changes,
            // Ensure required fields are set
            productId: changes.productId || fullItemData?.productId || 0,
            productName: changes.productName || fullItemData?.productName || "",
            sku:
              changes.sku ||
              fullItemData?.sku ||
              fullItemData?.productSku ||
              product?.sku ||
              "",
            quantity:
              changes.quantity !== undefined
                ? changes.quantity
                : fullItemData?.quantity || 1,
            unitPrice:
              changes.unitPrice !== undefined
                ? changes.unitPrice
                : fullItemData?.unitPrice || "0",
            total: changes.total || fullItemData?.total || "0",
            discount:
              changes.discount !== undefined
                ? changes.discount
                : fullItemData?.discount || "0",
            tax:
              changes.tax !== undefined
                ? changes.tax
                : fullItemData?.tax || "0",
            priceBeforeTax:
              changes.priceBeforeTax || fullItemData?.priceBeforeTax || "0",
          };

          // Validate required fields before INSERT
          if (!completeItemData.productId || completeItemData.productId <= 0) {
            console.warn(`⚠️ Skipping new item ${id} - missing productId`);
            continue;
          }

          if (!completeItemData.productName) {
            console.warn(`⚠️ Skipping new item ${id} - missing productName`);
            continue;
          }

          console.log(
            `✅ Will INSERT new item: ${completeItemData.productName} (Product ID: ${completeItemData.productId}, SKU: ${completeItemData.sku})`,
          );
          itemsToCreate.push(completeItemData);
        } else {
          // 🔄 EXISTING ITEM - Will be UPDATED in database
          console.log(`🔄 Processing EXISTING item for UPDATE (ID: ${id})`);
          itemsToUpdate.push({ id, ...changes });
        }
      }

      console.log("📝 Items to create:", itemsToCreate.length);
      console.log("📝 Items to update:", itemsToUpdate.length);
      console.log("📝 Items to delete:", itemsToDelete.length);

      // Step 2: Delete marked items
      for (const item of itemsToDelete) {
        console.log(`🗑️ Deleting order item ${item.id}`);
        const response = await apiRequest(
          "DELETE",
          `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${item.id}`,
        );
        if (!response.ok) {
          throw new Error(`Failed to delete order item ${item.id}`);
        }
      }

      // Step 3: INSERT new items into database
      for (const item of itemsToCreate) {
        console.log(`📝 [INSERT] Creating new order item in database:`, {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        });

        // Double-check validation before INSERT
        if (!item.productId || item.productId <= 0) {
          console.error(`❌ [INSERT FAILED] Missing valid productId:`, item);
          continue;
        }

        if (!item.productName) {
          console.error(`❌ [INSERT FAILED] Missing productName:`, item);
          continue;
        }

        const product = products.find((p: any) => p.id === item.productId);
        const taxRate = product?.taxRate
          ? parseFloat(product.taxRate) / 100
          : 0;
        const unitPrice = parseFloat(item.unitPrice || "0");
        const quantity = parseInt(item.quantity || "1");

        console.log(`📊 Item calculation data:`, {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          unitPrice,
          quantity,
          taxRate: taxRate * 100 + "%",
        });

        // Calculate totals based on discount allocation
        const orderDiscount = parseFloat(editableInvoice.discount || "0");
        let itemDiscountAmount = parseFloat(item.discount || "0");

        let itemSubtotal = unitPrice * quantity;
        let itemTax = 0;
        let priceBeforeTax = 0;

        const priceIncludeTax =
          editableInvoice.priceIncludeTax ??
          storeSettings?.priceIncludesTax ??
          false;

        if (priceIncludeTax && taxRate > 0) {
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
          const giaGomThue = adjustedPrice * quantity;
          priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
          itemTax = giaGomThue - priceBeforeTax;
        } else {
          priceBeforeTax = Math.round(itemSubtotal - itemDiscountAmount);
          itemTax = Math.round(priceBeforeTax * taxRate);
        }

        const totalAmount = priceBeforeTax + itemTax;

        const payload = {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku || product?.sku || `SKU${item.productId}`,
          quantity: quantity,
          unitPrice: unitPrice.toFixed(2),
          total: totalAmount.toFixed(2),
          discount: itemDiscountAmount.toFixed(2),
          tax: Math.round(itemTax).toFixed(2),
          priceBeforeTax: Math.round(priceBeforeTax).toFixed(2),
          notes: item.notes || null,
        };

        console.log(`📝 Creating order item with payload:`, payload);

        const response = await apiRequest(
          "POST",
          `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${editableInvoice.id}`,
          payload,
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to create order item:`, errorText);
          throw new Error(`Failed to create order item: ${errorText}`);
        }

        const createdItem = await response.json();
        console.log(`✅ New order item created successfully:`, createdItem);
      }

      // Step 4: UPDATE existing items in database
      for (const item of itemsToUpdate) {
        console.log(
          `📝 [UPDATE] Updating existing order item ID ${item.id} in database`,
        );
        const originalItem = orderItems.find((oi) => oi.id === item.id);

        // Build complete payload with all calculated fields
        const payload: any = {
          quantity:
            item.quantity !== undefined
              ? item.quantity
              : originalItem?.quantity,
          unitPrice:
            item.unitPrice !== undefined
              ? item.unitPrice
              : originalItem?.unitPrice,
          total: item.total !== undefined ? item.total : originalItem?.total,
          discount:
            item.discount !== undefined
              ? item.discount
              : originalItem?.discount || "0.00",
          tax: item.tax !== undefined ? item.tax : originalItem?.tax || "0.00",
          priceBeforeTax:
            item.priceBeforeTax !== undefined
              ? item.priceBeforeTax
              : originalItem?.priceBeforeTax || "0.00",
        };

        // Include optional fields if provided
        if (item.notes !== undefined) payload.notes = item.notes;
        if (item.productId !== undefined) payload.productId = item.productId;
        if (item.sku !== undefined) payload.sku = item.sku;
        if (item.productName !== undefined)
          payload.productName = item.productName;

        // Get values for calculation (use edited values if available, otherwise original)
        const product = products.find(
          (p: any) =>
            p.id ===
            (item.productId ||
              originalItem?.productId ||
              (item.sku
                ? products.find((prod) => prod.sku === item.sku)?.id
                : null)),
        );

        const taxRate = product?.taxRate
          ? parseFloat(product.taxRate) / 100
          : 0;

        const unitPrice =
          item.unitPrice !== undefined
            ? parseFloat(item.unitPrice)
            : parseFloat(originalItem?.unitPrice || "0");

        const quantity =
          item.quantity !== undefined
            ? parseInt(item.quantity)
            : parseInt(originalItem?.quantity || "0");

        // Calculate totals
        let itemSubtotal = unitPrice * quantity;
        let itemTax = 0;
        let priceBeforeTax = 0;

        const priceIncludeTax =
          editableInvoice.priceIncludeTax ??
          storeSettings?.priceIncludesTax ??
          false;

        if (priceIncludeTax && taxRate > 0) {
          const giaGomThue = itemSubtotal;
          priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
          itemTax = itemSubtotal - priceBeforeTax;
        } else {
          priceBeforeTax = Math.round(itemSubtotal);
          itemTax = Math.round(priceBeforeTax * taxRate);
        }

        const totalAmount = priceBeforeTax + itemTax;

        // Always set calculated values
        payload.total = totalAmount.toString();
        payload.tax = Math.round(itemTax).toString();
        payload.priceBeforeTax = Math.round(priceBeforeTax).toString();

        console.log(`📝 Updating order item ${item.id}:`, payload);

        // Update the item
        const response = await apiRequest(
          "PATCH",
          `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${item.id}`,
          payload,
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to update order item ${item.id}: ${errorText}`,
          );
        }
      }

      // Step 5: Recalculate order totals from fresh data
      const allCurrentItemsResponse = await apiRequest(
        "GET",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${editableInvoice.id}`,
      );
      const allCurrentItems = await allCurrentItemsResponse.json();

      console.log(
        "📊 Recalculating order totals from",
        allCurrentItems.length,
        "items",
      );

      const priceIncludeTax =
        editableInvoice.priceIncludeTax ??
        storeSettings?.priceIncludesTax ??
        false;
      const orderDiscount = parseFloat(editableInvoice.discount || "0");

      let exactSubtotal = 0;
      let exactTax = 0;

      allCurrentItems.forEach((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        const taxRate = product?.taxRate
          ? parseFloat(product.taxRate) / 100
          : 0;
        const unitPrice = parseFloat(item.unitPrice || "0");
        const quantity = parseInt(item.quantity || "0");

        if (priceIncludeTax && taxRate > 0) {
          const itemSubtotalIncludingTax = unitPrice * quantity;
          const priceBeforeTax = itemSubtotalIncludingTax / (1 + taxRate);
          const itemTax = itemSubtotalIncludingTax - priceBeforeTax;
          exactSubtotal += priceBeforeTax;
          exactTax += itemTax;
        } else {
          const itemSubtotal = unitPrice * quantity;
          exactSubtotal += itemSubtotal;
          exactTax += itemSubtotal * taxRate;
        }
      });

      const exactTotal = exactSubtotal + exactTax - orderDiscount;

      // Step 6: Update order with new totals and all editable fields
      // Use the SAME calculation logic as displayTotals to ensure consistency
      const orderData: Partial<Order> = {
        id: editableInvoice.id,
        customerName: editableInvoice.customerName,
        customerPhone: editableInvoice.customerPhone,
        customerAddress: editableInvoice.customerAddress,
        customerTaxCode: editableInvoice.customerTaxCode,
        customerEmail: editableInvoice.customerEmail,
        isPaid: editableInvoice.isPaid,
        notes: editableInvoice.notes,
        status: editableInvoice.status,
        paymentStatus: editableInvoice.paymentStatus,
        subtotal: displayTotals.subtotal.toString(),
        tax: displayTotals.tax.toString(),
        total: displayTotals.total.toString(),
        discount: orderDiscount.toString(),
        priceIncludeTax: editableInvoice.priceIncludeTax,
        invoiceNumber: editableInvoice.invoiceNumber,
        symbol: editableInvoice.symbol,
        einvoiceStatus: editableInvoice.einvoiceStatus,
        // Ensure other potential fields are passed if they are editable
        orderNumber: editableInvoice.orderNumber,
        date: editableInvoice.date,
        customerId: editableInvoice.customerId,
        paymentMethod: editableInvoice.paymentMethod, // Ensure paymentMethod is saved
      };

      console.log("💾 Saving order with recalculated totals:", orderData);

      // Clear local edits after successful preparation
      setEditedOrderItems({});

      // Validate order data before mutation
      if (!orderData || !orderData.id) {
        throw new Error("Dữ liệu đơn hàng không hợp lệ");
      }

      // Use the mutation to update the main order
      await updateOrderMutation.mutateAsync(orderData as Order);

      // Clear and refresh all related queries
      queryClient.removeQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      queryClient.removeQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"] });
      queryClient.removeQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items"] });
      queryClient.removeQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/date-range"],
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] }),
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"] }),
        queryClient.invalidateQueries({
          queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items", editableInvoice.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/date-range"],
        }),
        queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] }),
        queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"] }),
        queryClient.refetchQueries({
          queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items", editableInvoice.id],
        }),
        queryClient.refetchQueries({
          queryKey: [
            "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/date-range",
            startDate,
            endDate,
            currentPage,
            itemsPerPage,
          ],
        }),
      ]);

      // Reset editing state
      setIsEditing(false);
      setEditableInvoice(null);
      setEditedOrderItems({});

      // Close the selected invoice to show the updated list
      setSelectedInvoice(null);

      // Dispatch custom event to force refresh
      window.dispatchEvent(new CustomEvent("forceRefresh"));

      toast({
        title: "Lưu thành công",
        description: "Đơn hàng đã được cập nhật và danh sách đã được làm mới",
      });
    } catch (error) {
      console.error("❌ Error saving order:", error);
      toast({
        title: "Lỗi lưu đơn hàng",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditableInvoice(null);
    setEditedOrderItems({}); // Clear local edits
    // Invalidate order items to reset them if any changes were made but not saved
    queryClient.invalidateQueries({
      queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items", selectedInvoice?.id],
    });
  };

  const updateEditableInvoiceField = (
    field:
      | keyof Invoice
      | "orderedAt"
      | "orderNumber"
      | "customerName"
      | "customerPhone"
      | "customerAddress"
      | "symbol"
      | "invoiceNumber"
      | "notes"
      | "discount" // Added discount field
      | "priceIncludeTax"
      | "templateNumber" // Added templateNumber field
      | "customerId"
      | "paymentMethod" // Added paymentMethod field
      | "createdAt", // Added createdAt field
    value: any,
  ) => {
    if (editableInvoice) {
      setEditableInvoice({
        ...editableInvoice,
        [field]: value,
      });
    }
  };

  // State to track edited items locally (only update UI, not database)
  const [editedOrderItems, setEditedOrderItems] = useState<{
    [itemId: number]: {
      quantity?: number;
      unitPrice?: string;
      discount?: string;
      total?: string; // Add total to track calculated total
      sku?: string; // Add sku field
      productName?: string; // Add productName field
      productId?: number; // Add productId field
      _deleted?: boolean; // Flag for deletion
      notes?: string; // Add notes field
      tax?: string; // Add tax to edited item state
      _isNew?: boolean; // Flag for new unsaved items
      priceBeforeTax?: string; // Add priceBeforeTax to edited item state
      taxRate?: string; // Add taxRate to edited item state
    };
  }>({});

  // Query payment methods data
  const { data: paymentMethodsData = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching payment methods:", error);
        return [];
      }
    },
    staleTime: 0,
    gcTime: 0,
  });

  // Get only enabled payment methods
  const enabledPaymentMethods = useMemo(() => {
    return paymentMethodsData.filter((method: any) => method.enabled === true);
  }, [paymentMethodsData]);

  // Recalculate order totals and item discounts whenever editedOrderItems, orderItems, or discount changes
  useEffect(() => {
    if (!editableInvoice || !isEditing) return;

    const orderDiscount = parseFloat(editableInvoice.discount || "0");

    // Get all visible items (not deleted)
    const visibleItems = orderItems.filter(
      (item: any) => !editedOrderItems[item.id]?._deleted,
    );

    // If discount changed, recalculate all item discounts
    if (orderDiscount >= 0 && visibleItems.length > 0) {
      // Calculate total before discount
      const totalBeforeDiscount = visibleItems.reduce(
        (sum: number, item: any) => {
          const edited = editedOrderItems[item.id] || {};
          const unitPrice = parseFloat(
            edited.unitPrice !== undefined
              ? edited.unitPrice
              : item.unitPrice || "0",
          );
          const quantity = parseFloat(
            edited.quantity !== undefined
              ? edited.quantity
              : item.quantity || "0",
          );
          return sum + unitPrice * quantity;
        },
        0,
      );

      // Recalculate discount allocation for each item
      if (totalBeforeDiscount > 0) {
        const newEditedItems: typeof editedOrderItems = {};

        visibleItems.forEach((item: any, index: number) => {
          const edited = editedOrderItems[item.id] || {};
          const unitPrice = parseFloat(
            edited.unitPrice !== undefined
              ? edited.unitPrice
              : item.unitPrice || "0",
          );
          const quantity = parseFloat(
            edited.quantity !== undefined
              ? edited.quantity
              : item.quantity || "0",
          );
          const itemSubtotal = unitPrice * quantity;

          // Calculate proportional discount
          let itemDiscountAmount = 0;
          if (orderDiscount > 0) {
            const isLastItem = index === visibleItems.length - 1;
            if (isLastItem) {
              // Last item gets remaining discount
              const previousDiscounts = visibleItems
                .slice(0, -1)
                .reduce((sum, it) => {
                  const editedIt = editedOrderItems[it.id] || {};
                  const itPrice = parseFloat(
                    editedIt.unitPrice !== undefined
                      ? editedIt.unitPrice
                      : it.unitPrice || "0",
                  );
                  const itQty = parseFloat(
                    editedIt.quantity !== undefined
                      ? editedIt.quantity
                      : it.quantity || "0",
                  );
                  const itSubtotal = itPrice * itQty;
                  return (
                    sum +
                    Math.floor(
                      (orderDiscount * itSubtotal) / totalBeforeDiscount,
                    )
                  );
                }, 0);
              itemDiscountAmount = Math.max(
                0,
                orderDiscount - previousDiscounts,
              );
            } else {
              itemDiscountAmount = Math.floor(
                (orderDiscount * itemSubtotal) / totalBeforeDiscount,
              );
            }
          }

          // Get product info for tax calculation
          const product = products.find(
            (p: any) => p.id === (edited.productId || item.productId),
          );
          const taxRate = product?.taxRate
            ? parseFloat(product.taxRate) / 100
            : 0;
          const priceIncludeTax =
            editableInvoice?.priceIncludeTax ??
            storeSettings?.priceIncludesTax ??
            false;

          let itemTax = 0;
          let priceBeforeTax = 0;

          if (taxRate > 0) {
            if (priceIncludeTax) {
              const discountPerUnit = itemDiscountAmount / quantity;
              const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
              const giaGomThue = adjustedPrice * quantity;
              priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
              itemTax = giaGomThue - priceBeforeTax;
            } else {
              priceBeforeTax = Math.round(itemSubtotal - itemDiscountAmount);
              itemTax = Math.round(priceBeforeTax * taxRate);
            }
          } else {
            priceBeforeTax = Math.round(itemSubtotal - itemDiscountAmount);
          }

          const calculatedTotal = priceBeforeTax + itemTax;

          // Update edited items with recalculated values
          newEditedItems[item.id] = {
            ...edited,
            discount: itemDiscountAmount.toString(),
            tax: Math.round(itemTax).toString(),
            priceBeforeTax: Math.round(priceBeforeTax).toString(),
            total: calculatedTotal.toString(),
          };
        });

        // Update all items at once
        setEditedOrderItems(newEditedItems);
      }
    }

    let totalSubtotal = 0;
    let totalTax = 0;

    // Calculate totals from visible items
    visibleItems.forEach((item: any) => {
      const edited = editedOrderItems[item.id] || {};
      // Use tax from editedOrderItems if available (already calculated)
      if (edited.tax !== undefined) {
        totalTax += parseFloat(edited.tax);

        // Calculate subtotal from unitPrice and quantity
        const unitPrice = parseFloat(
          edited.unitPrice !== undefined
            ? edited.unitPrice
            : item.unitPrice || "0",
        );
        const quantity = parseFloat(
          edited.quantity !== undefined
            ? edited.quantity
            : item.quantity || "0",
        );
        totalSubtotal += unitPrice * quantity;
      } else {
        // Fallback to original calculation if tax not in editedOrderItems
        const product = products.find((p: any) => p.id === item.productId);
        const taxRate = product?.taxRate
          ? parseFloat(product.taxRate) / 100
          : 0;

        const unitPrice = parseFloat(
          edited.unitPrice !== undefined
            ? edited.unitPrice
            : item.unitPrice || "0",
        );
        const quantity = parseFloat(
          edited.quantity !== undefined
            ? edited.quantity
            : item.quantity || "0",
        );

        const itemSubtotal = unitPrice * quantity;

        if (editableInvoice?.priceIncludeTax && taxRate > 0) {
          const priceBeforeTax = itemSubtotal / (1 + taxRate);
          const itemTax = itemSubtotal - priceBeforeTax;
          totalSubtotal += priceBeforeTax;
          totalTax += itemTax;
        } else {
          totalSubtotal += itemSubtotal;
          totalTax += itemSubtotal * taxRate;
        }
      }
    });

    const totalAmount = totalSubtotal + totalTax - orderDiscount;

    // Update editableInvoice with new totals
    setEditableInvoice((prev) => {
      if (!prev) return prev;

      // Only update if values actually changed to avoid infinite loops
      const newSubtotal = Math.floor(totalSubtotal).toString();
      const newTax = Math.floor(totalTax).toString();
      const newTotal = Math.floor(totalAmount).toString();

      if (
        prev.subtotal === newSubtotal &&
        prev.tax === newTax &&
        prev.total === newTotal
      ) {
        return prev;
      }

      return {
        ...prev,
        subtotal: newSubtotal,
        tax: newTax,
        total: newTotal,
      };
    });
  }, [
    editedOrderItems,
    orderItems,
    isEditing,
    editableInvoice?.discount,
    products,
    storeSettings,
  ]);

  const updateOrderItemField = (itemId: number, field: string, value: any) => {
    setEditedOrderItems((prev) => {
      const currentItem = prev[itemId] || {};
      const originalItem = orderItems.find((item: any) => item.id === itemId);

      // PRESERVE ALL existing values - only update the field being changed
      let quantity =
        currentItem.quantity !== undefined
          ? currentItem.quantity
          : originalItem?.quantity || 1;
      let unitPrice =
        currentItem.unitPrice !== undefined
          ? parseFloat(currentItem.unitPrice)
          : parseFloat(originalItem?.unitPrice || "0");
      let productId =
        currentItem.productId !== undefined
          ? currentItem.productId
          : originalItem?.productId || 0;
      let sku =
        currentItem.sku !== undefined
          ? currentItem.sku
          : originalItem?.sku || "";
      let productName =
        currentItem.productName !== undefined
          ? currentItem.productName
          : originalItem?.productName || "";

      // Track if product changed (to recalculate tax with new taxRate)
      let productChanged = false;

      // Update ONLY the specific field that user is editing
      if (field === "quantity") {
        quantity = parseFloat(value) || 1;
        // ✅ KEEP all product info unchanged (productId, sku, productName)
      } else if (field === "unitPrice") {
        unitPrice = parseFloat(value) || 0;
        // ✅ KEEP all product info unchanged (productId, sku, productName)
      } else if (field === "productId") {
        // User is actively changing productId - update all related fields
        productId = value;
        productChanged = true;
        const product = products.find((p: any) => p.id === value);
        if (product) {
          productName = product.name;
          sku = product.sku;
          unitPrice = parseFloat(product.price || "0");
        }
      } else if (field === "sku") {
        // User is actively changing SKU - update all related fields
        sku = value;
        const product = products.find((p: any) => p.sku === value);
        if (product) {
          productId = product.id;
          productName = product.name;
          unitPrice = parseFloat(product.price || "0");
          productChanged = true;
        }
      } else if (field === "productName") {
        // User is actively changing product name - update all related fields
        productName = value;
        const product = products.find((p: any) => p.name === value);
        if (product) {
          productId = product.id;
          sku = product.sku;
          unitPrice = parseFloat(product.price || "0");
          productChanged = true;
        }
      }

      // Calculate item subtotal
      const itemSubtotal = quantity * unitPrice;

      // Calculate discount allocation
      const orderDiscount = parseFloat(
        editableInvoice?.discount || selectedInvoice?.discount || "0",
      );
      let itemDiscountAmount = 0;

      if (orderDiscount > 0) {
        // Get all visible items (including new items with negative IDs)
        const visibleItems = orderItems.filter(
          (item: any) => !prev[item.id]?._deleted,
        );

        // Calculate total before discount for ALL items (including this updated one)
        const totalBeforeDiscount = visibleItems.reduce(
          (sum: number, item: any) => {
            const editedItem = prev[item.id] || {};
            let itPrice = parseFloat(
              editedItem.unitPrice !== undefined
                ? editedItem.unitPrice
                : item.unitPrice || "0",
            );
            let itQty = parseFloat(
              editedItem.quantity !== undefined
                ? editedItem.quantity
                : item.quantity || "0",
            );

            // Use new values for the current item being updated
            if (item.id === itemId) {
              itPrice = unitPrice;
              itQty = quantity;
            }

            return sum + itPrice * itQty;
          },
          0,
        );

        // Calculate proportional discount for this item
        if (totalBeforeDiscount > 0) {
          // Check if this is the last item
          const currentIndex = visibleItems.findIndex(
            (item: any) => item.id === itemId,
          );
          const isLastItem = currentIndex === visibleItems.length - 1;

          if (isLastItem) {
            // Last item gets remaining discount
            let previousDiscounts = 0;
            for (let i = 0; i < visibleItems.length - 1; i++) {
              const item = visibleItems[i];
              const editedItem = prev[item.id] || {};
              const itPrice = parseFloat(
                editedItem.unitPrice !== undefined
                  ? editedItem.unitPrice
                  : item.unitPrice || "0",
              );
              const itQty = parseFloat(
                editedItem.quantity !== undefined
                  ? editedItem.quantity
                  : item.quantity || "0",
              );
              const itSubtotal = itPrice * itQty;
              previousDiscounts += Math.floor(
                (orderDiscount * itSubtotal) / totalBeforeDiscount,
              );
            }
            itemDiscountAmount = Math.max(0, orderDiscount - previousDiscounts);
          } else {
            // Proportional allocation
            itemDiscountAmount = Math.floor(
              (orderDiscount * itemSubtotal) / totalBeforeDiscount,
            );
          }
        }
      }

      // Calculate tax - ALWAYS get product info to ensure we have latest taxRate
      let product = products.find((p: any) => p.id === productId);
      if (!sku) {
        sku = product?.sku || "";
      }
      const taxRate = product?.taxRate ? parseFloat(product.taxRate) / 100 : 0;
      const priceIncludeTax =
        editableInvoice?.priceIncludeTax ??
        selectedInvoice?.priceIncludeTax ??
        storeSettings?.priceIncludesTax ??
        false;

      let itemTax = 0;
      let priceBeforeTax = 0;

      if (taxRate > 0) {
        if (priceIncludeTax) {
          // Price includes tax
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
          const giaGomThue = adjustedPrice * quantity;
          priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
          itemTax = giaGomThue - priceBeforeTax;
        } else {
          // Price excludes tax
          priceBeforeTax = Math.round(itemSubtotal - itemDiscountAmount);
          itemTax = Math.round(priceBeforeTax * taxRate);
        }
      } else {
        priceBeforeTax = Math.round(itemSubtotal - itemDiscountAmount);
      }

      const calculatedTotal = priceBeforeTax + itemTax;

      console.log(
        `🔢 Tính toán thuế cho item ${itemId} ${productChanged ? "(SẢN PHẨM MỚI)" : ""}:`,
        {
          productId,
          productName,
          sku,
          quantity,
          unitPrice,
          itemSubtotal,
          taxRate: taxRate * 100 + "%",
          priceIncludeTax,
          itemDiscountAmount,
          priceBeforeTax,
          itemTax: Math.round(itemTax),
          calculatedTotal,
        },
      );

      // ALWAYS return updated calculated fields to ensure UI reflects latest values
      const updatedEditedItems = {
        ...prev,
        [itemId]: {
          ...currentItem,
          [field]: value,
          productId,
          productName,
          sku,
          quantity,
          unitPrice: unitPrice.toString(),
          total: calculatedTotal.toString(),
          discount: itemDiscountAmount.toString(),
          tax: Math.round(itemTax).toString(),
          priceBeforeTax: Math.round(priceBeforeTax).toString(),
          taxRate: (taxRate * 100).toString(),
        },
      };

      return updatedEditedItems;
    });
  };

  // Handle keyboard navigation for order items table
  const handleOrderItemKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    fieldType: string,
  ) => {
    // Only editable fields (có input)
    const editableFields = ["sku", "productName", "quantity", "unitPrice"];
    const currentFieldIndex = editableFields.indexOf(fieldType);

    // Get visible items (not deleted)
    const visibleItems = orderItems.filter(
      (item: any) => !editedOrderItems[item.id]?._deleted,
    );

    // Enter or Tab - move to next editable field
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();

      if (currentFieldIndex === editableFields.length - 1) {
        // At the last editable field (unitPrice)
        if (index < visibleItems.length - 1) {
          // Not the last row, move to first field of next row
          setTimeout(() => {
            const nextRowInput = document.querySelector(
              `[data-field="orderitem-${editableFields[0]}-${index + 1}"]`,
            ) as HTMLInputElement;
            nextRowInput?.focus();
          }, 50);
        }
      } else {
        // Move to next editable field in same row
        const nextFieldType = editableFields[currentFieldIndex + 1];
        setTimeout(() => {
          const nextInput = document.querySelector(
            `[data-field="orderitem-${nextFieldType}-${index}"]`,
          ) as HTMLInputElement;
          nextInput?.focus();
        }, 50);
      }
    }
    // Arrow Right - move to next editable field
    else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (currentFieldIndex < editableFields.length - 1) {
        const nextFieldType = editableFields[currentFieldIndex + 1];
        setTimeout(() => {
          const nextInput = document.querySelector(
            `[data-field="orderitem-${nextFieldType}-${index}"]`,
          ) as HTMLInputElement;
          nextInput?.focus();
        }, 50);
      }
    }
    // Arrow Left - move to previous editable field
    else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (currentFieldIndex > 0) {
        const prevFieldType = editableFields[currentFieldIndex - 1];
        setTimeout(() => {
          const prevInput = document.querySelector(
            `[data-field="orderitem-${prevFieldType}-${index}"]`,
          ) as HTMLInputElement;
          prevInput?.focus();
        }, 50);
      }
    }
    // Arrow Down - move to same field in next row
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (index < visibleItems.length - 1) {
        setTimeout(() => {
          const nextRowInput = document.querySelector(
            `[data-field="orderitem-${fieldType}-${index + 1}"]`,
          ) as HTMLInputElement;
          nextRowInput?.focus();
        }, 50);
      }
    }
    // Arrow Up - move to same field in previous row
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) {
        setTimeout(() => {
          const prevRowInput = document.querySelector(
            `[data-field="orderitem-${fieldType}-${index - 1}"]`,
          ) as HTMLInputElement;
          prevRowInput?.focus();
        }, 50);
      }
    }
  };

  // Calculate totals from ALL orders in filteredInvoices
  const calculateTotals = () => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      return { subtotal: 0, tax: 0, discount: 0, total: 0 };
    }

    // Calculate from all filtered invoices (across all pages)
    const totals = filteredInvoices.reduce(
      (acc, item) => {
        const subtotal = parseFloat(item.subtotal || "0");
        const tax = parseFloat(item.tax || "0");
        const discount = parseFloat(item.discount || "0");
        const total = parseFloat(item.total || "0");

        acc.subtotal += subtotal;
        acc.tax += tax;
        acc.discount += discount;
        acc.total += total;

        return acc;
      },
      { subtotal: 0, tax: 0, discount: 0, total: 0 },
    );

    console.log("📊 Calculated totals from all filtered invoices:", {
      count: filteredInvoices.length,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
    });

    return totals;
  };

  // Calculate totals dynamically based on order items and edits
  const displayTotals = useMemo(() => {
    if (!selectedInvoice) return { subtotal: 0, tax: 0, discount: 0, total: 0 };

    // If editing and has edited items, calculate from items
    if (isEditing && Object.keys(editedOrderItems).length > 0) {
      const priceIncludeTax =
        selectedInvoice.priceIncludeTax ??
        storeSettings?.priceIncludesTax ??
        false;
      let calculatedSubtotal = 0;
      let calculatedTax = 0;
      const orderDiscount = parseFloat(
        editableInvoice?.discount || selectedInvoice.discount || "0",
      );

      // Calculate from visible order items (excluding deleted ones)
      const visibleItems = orderItems.filter(
        (item: any) => !editedOrderItems[item.id]?._deleted,
      );

      visibleItems.forEach((item: any) => {
        const editedItem = editedOrderItems[item.id] || {};
        // Use tax from editedOrderItems if available (already calculated)
        if (editedItem.tax !== undefined) {
          calculatedTax += parseFloat(editedItem.tax);

          // Calculate subtotal from unitPrice and quantity
          const unitPrice = parseFloat(
            editedItem.unitPrice !== undefined
              ? editedItem.unitPrice
              : item.unitPrice || "0",
          );
          const quantity = parseFloat(
            editedItem.quantity !== undefined
              ? editedItem.quantity
              : item.quantity || "0",
          );
          calculatedSubtotal += unitPrice * quantity;
        } else {
          // Fallback to original calculation if tax not in editedOrderItems
          const product = products.find((p: any) => p.id === item.productId);
          const taxRate = product?.taxRate
            ? parseFloat(product.taxRate) / 100
            : 0;

          const unitPrice = parseFloat(
            editedItem.unitPrice !== undefined
              ? editedItem.unitPrice
              : item.unitPrice || "0",
          );
          const quantity = parseFloat(
            editedItem.quantity !== undefined
              ? editedItem.quantity
              : item.quantity || "0",
          );

          const itemSubtotal = unitPrice * quantity;

          if (priceIncludeTax && taxRate > 0) {
            const priceBeforeTax = itemSubtotal / (1 + taxRate);
            const itemTax = itemSubtotal - priceBeforeTax;
            calculatedSubtotal += priceBeforeTax;
            calculatedTax += itemTax;
          } else {
            calculatedSubtotal += itemSubtotal;
            calculatedTax += itemSubtotal * taxRate;
          }
        }
      });

      // Total = subtotal + tax - discount
      const totalPayment = Math.max(
        0,
        priceIncludeTax
          ? calculatedSubtotal + calculatedTax
          : calculatedSubtotal + calculatedTax - orderDiscount,
      );

      console.log("📊 Calculated totals from items:", {
        subtotal: calculatedSubtotal,
        tax: calculatedTax,
        discount: orderDiscount,
        total: totalPayment,
      });

      return {
        subtotal: Math.round(calculatedSubtotal),
        tax: Math.round(calculatedTax),
        discount: Math.round(orderDiscount),
        total: Math.round(totalPayment),
      };
    } else {
      // Otherwise, use the totals from the selected invoice directly
      const dbSubtotal = parseFloat(selectedInvoice.subtotal || "0");
      const dbTax = parseFloat(selectedInvoice.tax || "0");
      const dbDiscount = parseFloat(selectedInvoice.discount || "0");
      const dbTotal = parseFloat(selectedInvoice.total || "0");

      console.log("📊 Using database values for totals:", {
        subtotal: dbSubtotal,
        tax: dbTax,
        discount: dbDiscount,
        total: dbTotal,
      });

      return {
        subtotal: Math.round(dbSubtotal),
        tax: Math.round(dbTax),
        discount: Math.round(dbDiscount),
        total: Math.round(dbTotal),
      };
    }
  }, [
    selectedInvoice,
    isEditing,
    editedOrderItems,
    orderItems,
    products,
    storeSettings,
    editableInvoice,
  ]);

  const handleSelectOrder = (
    orderId: number,
    orderType: string,
    checked: boolean,
  ) => {
    const orderKey = `${orderType}-${orderId}`;
    const newSelectedIds = new Set(selectedOrderIds);

    if (checked) {
      newSelectedIds.add(orderKey);
    } else {
      newSelectedIds.delete(orderKey);
    }

    setSelectedOrderIds(new Set(newSelectedIds));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allOrderKeys = filteredInvoices.map(
        (item) => `${item.type}-${item.id}`,
      );
      setSelectedOrderIds(new Set(allOrderKeys));
    } else {
      setSelectedOrderIds(new Set());
    }
  };

  const isOrderSelected = (orderId: number, orderType: string) => {
    return selectedOrderIds.has(`${orderType}-${orderId}`);
  };

  const isAllSelected =
    filteredInvoices.length > 0 &&
    selectedOrderIds.size === filteredInvoices.length;
  const isIndeterminate =
    selectedOrderIds.size > 0 &&
    selectedOrderIds.size < filteredInvoices.length;

  const exportSelectedOrdersToExcel = () => {
    if (selectedOrderIds.size === 0) {
      alert("Vui lòng chọn ít nhất một đơn hàng để xuất Excel");
      return;
    }

    const selectedOrders = filteredInvoices.filter((item) =>
      selectedOrderIds.has(`${item.type}-${item.id}`),
    );

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    ws["!defaultFont"] = { name: "Times New Roman", sz: 11 };

    XLSX.utils.sheet_add_aoa(ws, [[t("purchases.salesOrdersList")]], {
      origin: "A1",
    });
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } });

    XLSX.utils.sheet_add_aoa(ws, [[]], { origin: "A2" });

    const headers = [
      t("orders.orderNumberColumn"),
      t("orders.createdDateColumn"),
      t("orders.table"),
      t("orders.customerCode"),
      t("orders.customerName"),
      t("common.phone"), // Added phone header
      t("common.subtotalAmount"),
      t("common.discount"),
      t("common.tax"),
      t("common.paid"),
      // Removed Employee Code and Name headers
      t("orders.invoiceSymbol"),
      t("orders.invoiceNumber"),
      t("common.notes"),
      t("common.status"),
    ];
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A3" });

    const dataRows = selectedOrders.map((item, index) => {
      const orderNumber =
        item.tradeNumber ||
        item.invoiceNumber ||
        item.orderNumber ||
        `ORD-${String(item.id).padStart(8, "0")}`;
      const orderDate = formatDate(item.date); // Use 'date' field for order date
      const table =
        item.type === "order" && item.tableId
          ? getTableNumber(item.tableId)
          : "";
      const customerCode = item.customerTaxCode;
      const customerName = item.customerName || "";
      const customerPhone = item.customerPhone || ""; // Get customer phone
      const subtotal = parseFloat(item.subtotal || "0");
      const discount = parseFloat(item.discount || "0");
      const tax = parseFloat(item.tax || "0");
      const total = parseFloat(item.total || "0");
      const paid = total;
      const symbol = item.symbol || "";
      const invoiceNumber =
        item.invoiceNumber || String(item.id).padStart(8, "0");
      const status =
        item.displayStatus === 1
          ? t("common.completed")
          : item.displayStatus === 2
            ? t("common.serving")
            : t("common.cancelled");

      return [
        orderNumber,
        orderDate,
        table,
        customerCode,
        customerName,
        customerPhone, // Add customer phone data
        subtotal,
        discount,
        tax,
        paid,
        // Removed Employee Code and Name data
        symbol,
        invoiceNumber,
        item.notes || "",
        status,
      ];
    });

    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A4" });

    ws["!cols"] = [
      { wch: 15 },
      { wch: 13 },
      { wch: 8 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 }, // Column for phone number
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      // Removed Employee Code and Name columns
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
    ];

    ws["!rows"] = [
      { hpt: 25 },
      { hpt: 15 },
      { hpt: 20 },
      ...Array(selectedOrders.length).fill({ hpt: 18 }),
    ];

    if (ws["A1"]) {
      ws["A1"].s = {
        font: {
          name: "Times New Roman",
          sz: 16,
          bold: true,
          color: { rgb: "000000" },
        },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
      };
    }

    for (let col = 0; col <= 13; col++) {
      // Adjusted loop to match new header count (0-13)
      const cellAddress = XLSX.utils.encode_cell({ r: 2, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: {
            name: "Times New Roman",
            sz: 11,
            bold: true,
            color: { rgb: "FFFFFF" },
          },
          fill: { patternType: "solid", fgColor: { rgb: "92D050" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
    }

    for (let row = 3; row < 3 + selectedOrders.length; row++) {
      const isEven = (row - 3) % 2 === 0;
      const bgColor = isEven ? "FFFFFF" : "F2F2F2";

      for (let col = 0; col <= 13; col++) {
        // Adjusted loop to match new header count
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const isCurrency = [6, 7, 8, 9].includes(col); // Indices for subtotal, discount, tax, paid

        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            font: { name: "Times New Roman", sz: 11, color: { rgb: "000000" } },
            fill: { patternType: "solid", fgColor: { rgb: bgColor } },
            alignment: {
              horizontal: isCurrency ? "right" : "center",
              vertical: "center",
            },
            border: {
              top: { style: "thin", color: { rgb: "BFBFBF" } },
              bottom: { style: "thin", color: { rgb: "BFBFBF" } },
              left: { style: "thin", color: { rgb: "BFBFBF" } },
              right: { style: "thin", color: { rgb: "BFBFBF" } },
            },
          };

          if (isCurrency && typeof ws[cellAddress].v === "number") {
            ws[cellAddress].z = "#,##0";
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Danh sách đơn hàng");

    wb.Props = {
      Title: "Danh sách đơn hàng bán",
      Subject: "Báo cáo đơn hàng",
      Author: "EDPOS System",
      CreatedDate: new Date(),
    };

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const defaultFilename = `danh-sach-don-hang-ban_${timestamp}.xlsx`;

    try {
      XLSX.writeFile(wb, defaultFilename, {
        bookType: "xlsx",
        cellStyles: true,
        sheetStubs: false,
        compression: true,
      });

      console.log(
        "✅ Excel file exported successfully with Times New Roman formatting",
      );
      alert(
        "File Excel đã được xuất thành công với định dạng Times New Roman!",
      );
    } catch (error) {
      console.error("❌ Error exporting Excel file:", error);
      XLSX.writeFile(wb, defaultFilename, { bookType: "xlsx" });
      alert("File Excel đã được xuất nhưng có thể thiếu một số định dạng.");
    }
  };

  const totals = calculateTotals();

  // Function to handle payment initiation
  const handlePayment = async (order: Invoice) => {
    console.log("💳 Payment initiated for order:", order.id);

    // Update order status to paid
    try {
      const updateResponse = await apiRequest(
        "PUT",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${order.id}`,
        {
          paymentStatus: "paid",
          status: "paid",
          paidAt: new Date().toISOString(),
        },
      );

      if (updateResponse.ok) {
        console.log("✅ Order payment status updated successfully");

        // Refresh orders list
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"] });
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"] });

        toast({
          title: "Thanh toán thành công",
          description: "Đơn hàng đã được cập nhật trạng thái thanh to n",
        });

        // For laundry business, show receipt modal after payment
        if (storeSettings?.businessType === "laundry") {
          console.log("🧺 Laundry business: Preparing receipt after payment");

          // Fetch fresh order items
          const itemsResponse = await apiRequest(
            "GET",
            `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${order.id}`,
          );
          const items = await itemsResponse.json();

          // Prepare receipt data
          const receiptData = {
            id: order.id,
            tableId: order.tableId || null,
            orderNumber: order.orderNumber || order.displayNumber,
            transactionId: order.orderNumber || `TXN-${order.id}`,
            items: items.map((item: any) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              price: item.unitPrice,
              quantity: item.quantity,
              total: item.total,
              discount: item.discount || "0",
              sku: item.productSku || item.sku || `ITEM${item.productId}`,
              taxRate: parseFloat(item.taxRate || "0"),
            })),
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total,
            paymentMethod: order.paymentMethod || "cash",
            amountReceived: order.total,
            change: "0",
            cashierName: "System User",
            createdAt: new Date().toISOString(),
            customerName: order.customerName || "Khách hàng",
            customerTaxCode: order.customerTaxCode || null,
            tableNumber: order.tableId ? getTableNumber(order.tableId) : null,
          };

          console.log("🧾 Opening receipt modal with data:", receiptData);
          setSelectedReceipt(receiptData);
          setShowReceiptModal(true);
        }
      }
    } catch (error) {
      console.error("❌ Error updating payment status:", error);
      toast({
        title: "Lỗi thanh toán",
        description: "Không thể cập nhật trạng thái thanh toán",
        variant: "destructive",
      });
    }
  };

  // Handler for when payment is completed
  const handlePaymentComplete = (data: any) => {
    console.log("💳 Sales Orders: Payment completed:", data);

    // Close payment modal
    setShowPaymentMethodModal(false);

    if (data.success && data.receipt) {
      console.log(
        "✅ Sales Orders: Showing receipt modal with data:",
        data.receipt,
      );

      // Set receipt data
      setSelectedReceipt(data.receipt);

      // Show receipt modal with a small delay to ensure state is properly set
      setTimeout(() => {
        setShowReceiptModal(true);
      }, 100);

      // Refresh orders list after a delay to avoid interfering with receipt modal
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"] });
        queryClient.invalidateQueries({
          queryKey: [
            "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/date-range",
            startDate,
            endDate,
            currentPage,
            itemsPerPage,
          ],
        });
      }, 500);
    }
  };

  // Function to print receipt for a given order
  const handlePrintReceipt = async (order: any) => {
    try {
      console.log("📄 Sales Orders: Preparing receipt for order:", order.id);

      // Fetch order items with tax information
      const response = await apiRequest("GET", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${order.id}`);
      const items = await response.json();

      // Enrich items with product information including tax rates
      const enrichedItems = items.map((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          price: item.unitPrice,
          quantity: item.quantity,
          discount: item.discount || "0",
          total: item.total,
          tax: item.tax || "0", // Include tax for the item if available
          sku: item.productSku || item.sku || `SKU${item.productId}`,
          // Prioritize item.taxRate, fallback to product.taxRate, then default to 0
          taxRate: parseFloat(item.taxRate || product?.taxRate || "0"),
          product: product || null, // Include the full product object for potential future use
        };
      });

      const receiptData = {
        ...order,
        transactionId: order.orderNumber || order.invoiceNumber,
        items: enrichedItems,
        cashierName: "System",
        amountReceived: order.total,
        change: "0",
      };

      console.log("📄 Sales Orders: Receipt data with tax info:", receiptData);

      setSelectedReceipt(receiptData);
      setShowReceiptModal(true);
    } catch (error) {
      console.error("❌ Error preparing receipt:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin hóa đơn",
        variant: "destructive",
      });
    }
  };

  // Effect to handle receipt modal close events and prevent reopening
  useEffect(() => {
    const handleReceiptModalClosed = (event: CustomEvent) => {
      console.log(
        "🔒 Sales Orders: Receipt modal closed event received",
        event.detail,
      );

      // Only clear if event detail confirms intentional close
      if (event.detail?.intentionalClose) {
        setShowReceiptModal(false);
        setSelectedReceipt(null);
        setShowPaymentMethodModal(false);
        console.log("✅ Sales Orders: Receipt modal states cleared");
      }
    };

    window.addEventListener(
      "receiptModalClosed",
      handleReceiptModalClosed as EventListener,
    );

    return () => {
      window.removeEventListener(
        "receiptModalClosed",
        handleReceiptModalClosed as EventListener,
      );
    };
  }, []);

  return (
    <div className="min-h-screen bg-green-50 grocery-bg">
      {/* Header */}
      <POSHeader />
      {/* Right Sidebar */}
      <RightSidebar />
      <div className="main-content pt-16 px-6">
        <div className="max-w-full mx-auto py-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-6 h-6 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-800">
                {t("purchases.salesOrdersList")}
              </h1>
            </div>
            <p className="text-gray-600 mb-4">
              {t("orders.realTimeOrderStatus")}
            </p>
          </div>

          <Card className="mb-6 border-green-200 shadow-sm">
            <CardContent className="py-3">
              {/* Compact Filter Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* Date Filter Mode */}
                <div className="lg:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("orders.dateFilterMode")}
                  </label>
                  <ToggleGroup
                    type="single"
                    value={dateFilterMode}
                    onValueChange={(value) => {
                      if (value)
                        setDateFilterMode(value as "created" | "completed");
                    }}
                    className="justify-start gap-1"
                  >
                    <ToggleGroupItem
                      value="created"
                      aria-label={t("orders.createdDateFilter")}
                      className="data-[state=on]:bg-blue-600 data-[state=on]:text-white text-sm px-2 h-8"
                    >
                      {t("orders.createdDateFilter")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="completed"
                      aria-label={t("orders.completedDateFilter")}
                      className="data-[state=on]:bg-blue-600 data-[state=on]:text-white text-sm px-2 h-8"
                    >
                      {t("orders.completedDateFilter")}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("orders.startDate")}
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-sm border-green-200 focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("orders.endDate")}
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-sm border-green-200 focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                {/* Order Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("orders.orderNumber")}
                  </label>
                  <Input
                    placeholder={t("reports.orderNumberPlaceholder")}
                    value={orderNumberSearch}
                    onChange={(e) => setOrderNumberSearch(e.target.value)}
                    className="h-8 text-sm border-green-200 focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                {/* Customer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("orders.customer")}
                  </label>
                  <Input
                    placeholder={t("reports.customerFilterPlaceholder")}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="h-8 text-sm border-green-200 focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                {/* Product Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("common.product")}
                  </label>
                  <Input
                    placeholder={t("common.customerCodeSearchPlaceholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 text-sm border-green-200 focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                {/* Order Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("orders.orderStatusFilter")}
                  </label>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-green-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="all">{t("orders.allStatus")}</option>
                    <option value="paid">{t("orders.paidStatus")}</option>
                    <option value="pending">{t("orders.pendingStatus")}</option>
                    <option value="cancelled">
                      {t("orders.cancelledStatus")}
                    </option>
                  </select>
                </div>

                {/* E-invoice Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("common.einvoiceStatusFilter")}
                  </label>
                  <select
                    value={einvoiceStatusFilter}
                    onChange={(e) => setEinvoiceStatusFilter(e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-green-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="all">{t("common.allEinvoiceStatus")}</option>
                    <option value="0">
                      {t("common.einvoiceStatus.notPublished")}
                    </option>
                    <option value="1">
                      {t("common.einvoiceStatus.published")}
                    </option>
                  </select>
                </div>

                {/* Sales Type - only if not laundry */}
                {storeSettings?.businessType !== "laundry" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("orders.salesType")}
                    </label>
                    <select
                      value={salesChannelFilter}
                      onChange={(e) => setSalesChannelFilter(e.target.value)}
                      className="w-full h-8 px-2 rounded-md border border-green-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="all">{t("common.all")}</option>
                      <option value="table">{t("orders.eatIn")}</option>
                      <option value="pos">{t("orders.atCounter")}</option>
                      <option value="online">{t("orders.online")}</option>
                      <option value="delivery">{t("orders.delivery")}</option>
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {storeSettings?.businessType !== "laundry" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2 border-red-500 text-red-600 hover:bg-red-50"
                      disabled={selectedOrderIds.size === 0}
                      onClick={() => setShowBulkCancelDialog(true)}
                    >
                      <X className="w-4 h-4" />
                      {t("common.cancelOrder")} ({selectedOrderIds.size})
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50"
                    disabled={selectedOrderIds.size === 0}
                    onClick={exportSelectedOrdersToExcel}
                  >
                    <Download className="w-4 h-4" />
                    {t("common.exportExcel")} ({selectedOrderIds.size})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-500">{t("common.loading")}</p>
                </div>
              ) : hasError ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-4">
                    <X className="w-8 h-8 mx-auto mb-2" />
                    <p className="font-medium">
                      {t("errors.databaseConnection")}
                    </p>
                  </div>
                  <p className="text-gray-500 mb-4">
                    {t("errors.failedToLoadData")}
                  </p>
                  <Button
                    onClick={() => {
                      queryClient.invalidateQueries({
                        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"],
                      });
                    }}
                  >
                    {t("common.retry")}
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="w-full overflow-x-auto border rounded-md bg-white">
                    <table className="w-full min-w-[1600px] table-fixed">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="w-[50px] px-3 py-3 text-center font-medium text-[16px] text-gray-600">
                            <Checkbox
                              checked={isAllSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = isIndeterminate;
                              }}
                              onCheckedChange={handleSelectAll}
                            />
                          </th>
                          <th
                            className="w-[180px] px-3 py-3 text-left font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("orderNumber")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.orderNumberColumn")}
                              {sortField === "orderNumber" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          {storeSettings?.businessType === "laundry" && (
                            <th className="w-[100px] px-3 py-3 text-center font-medium text-[16px] text-gray-600">
                              {t("common.returned")}
                            </th>
                          )}
                          <th
                            className="w-[120px] px-3 py-3 text-center font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("status")}
                          >
                            <div className="leading-tight flex items-center justify-center gap-1">
                              {t("common.status")}
                              {sortField === "status" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[180px] px-3 py-3 text-left font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("createdAt")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.createdDateColumn")}
                              {sortField === "createdAt" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[180px] px-3 py-3 text-left font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("updatedAt")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.completedCancelledColumn")}
                              {sortField === "updatedAt" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[80px] px-3 py-3 text-left font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("salesChannel")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.orderSource")}
                              {sortField === "salesChannel" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[120px] px-3 py-3 text-left font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("customerCode")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.customerCode")}
                              {sortField === "customerCode" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[150px] px-3 py-3 text-left font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("customerName")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.customerName")}
                              {sortField === "customerName" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th // Added header for customer phone
                            className="w-[120px] px-3 py-3 text-left font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("customerPhone")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("common.phone")}
                              {sortField === "customerPhone" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[120px] px-3 py-3 text-right font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("subtotal")}
                          >
                            <div className="leading-tight flex items-center justify-end gap-1">
                              {t("common.subtotalAmount")}
                              {sortField === "subtotal" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[100px] px-3 py-3 text-right font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("discount")}
                          >
                            <div className="leading-tight flex items-center justify-end gap-1">
                              {t("common.discount")}
                              {sortField === "discount" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[100px] px-3 py-3 text-right font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("tax")}
                          >
                            <div className="leading-tight flex items-center justify-end gap-1">
                              {t("common.tax")}
                              {sortField === "tax" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="w-[120px] px-3 py-3 text-right font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("total")}
                          >
                            <div className="leading-tight flex items-center justify-end gap-1">
                              {t("common.totalPayment")}
                              {sortField === "total" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                          <th className="w-[150px] px-3 py-3 text-left font-medium text-[16px] text-gray-600">
                            <div className="leading-tight">
                              {t("common.paymentMethodLabel")}
                            </div>
                          </th>
                          <th
                            className="w-[120px] px-3 py-3 text-left font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("symbol")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("orders.invoiceSymbol")}
                              {sortField === "symbol" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>

                          <th
                            className="w-[200px] px-3 py-3 text-left font-medium text-[16px] text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("notes")}
                          >
                            <div className="leading-tight flex items-center gap-1">
                              {t("common.notes")}
                              {sortField === "notes" && (
                                <span className="text-blue-600">
                                  {sortOrder === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredInvoices.length === 0 ? (
                          <tr>
                            <td
                              colSpan={
                                storeSettings?.businessType === "laundry"
                                  ? 16
                                  : 15
                              }
                              className="p-8 text-center text-sm text-gray-500"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <FileText className="w-8 h-8 text-gray-400" />
                                <p>{t("common.noOrders")}</p>
                                <p className="text-xs">
                                  {t("orders.tryChangingFilters")}
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredInvoices.map((item) => {
                            // Get customer info - prioritize customerId from customer table if order has customerId
                            let customerCode =
                              item.customerCode || item.customerTaxCode || "";

                            // If order has customerId, try to find customer in customers list
                            if (
                              item.customerId &&
                              customers &&
                              customers.length > 0
                            ) {
                              const customer = customers.find(
                                (c: any) =>
                                  c.id === item.customerId ||
                                  c.name == item.customerName,
                              );
                              if (customer && customer.customerId) {
                                customerCode = customer.customerId;
                              }
                            }

                            const customerName = item.customerName || "";
                            const customerPhone = item.customerPhone || ""; // Get customer phone
                            const discount = parseFloat(item.discount || "0");
                            const tax = parseFloat(item.tax || "0");
                            const subtotal = parseFloat(item.subtotal || "0");
                            const total = parseFloat(item.total || "0");
                            const paid = total;
                            const symbol = item.symbol || "";
                            const invoiceNumber =
                              item.invoiceNumber ||
                              String(item.id).padStart(8, "0");
                            const notes = item.notes || "";

                            const itemSymbol =
                              item.symbol || item.templateNumber || "";

                            return (
                              <>
                                <tr
                                  key={`${item.type}-${item.id}`}
                                  className={`hover:bg-gray-50 ${
                                    selectedInvoice?.id === item.id &&
                                    selectedInvoice?.type === item.type
                                      ? "bg-blue-100"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    const itemWithType = {
                                      ...item,
                                      type:
                                        item.type ||
                                        (item.orderNumber
                                          ? "order"
                                          : "invoice"),
                                    };
                                    setSelectedInvoice(itemWithType);
                                  }}
                                >
                                  <td className="px-3 py-3 text-center">
                                    <Checkbox
                                      checked={isOrderSelected(
                                        item.id,
                                        item.type,
                                      )}
                                      onCheckedChange={(checked) =>
                                        handleSelectOrder(
                                          item.id,
                                          item.type,
                                          checked as boolean,
                                        )
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <div
                                      className="font-medium text-[16px]"
                                      title={
                                        item.orderNumber || item.displayNumber
                                      }
                                    >
                                      {item.orderNumber || item.displayNumber}
                                    </div>
                                  </td>
                                  {storeSettings?.businessType ===
                                    "laundry" && (
                                    <td className="text-center border-r min-w-[100px] px-4">
                                      <Badge
                                        className={
                                          item.isPaid
                                            ? "bg-green-100 text-green-800"
                                            : "bg-gray-100 text-gray-600"
                                        }
                                      >
                                        {item.isPaid
                                          ? t("common.returned")
                                          : t("common.notReturned")}
                                      </Badge>
                                    </td>
                                  )}
                                  <td className="px-3 py-3 text-center">
                                    {getInvoiceStatusBadge(
                                      item.displayStatus,
                                      item,
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-[16px] truncate">
                                      {formatDate(item.createdAt)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-[16px] truncate">
                                      {(() => {
                                        // Show completion/cancellation date based on status
                                        if (
                                          item.displayStatus === 1 ||
                                          item.status === "paid"
                                        ) {
                                          // Completed - show updatedAt
                                          return formatDate(item.updatedAt);
                                        } else if (
                                          item.displayStatus === 3 ||
                                          item.status === "cancelled"
                                        ) {
                                          // Cancelled - show updatedAt
                                          return formatDate(item.updatedAt);
                                        }
                                        return "-";
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-[16px]">
                                      {(() => {
                                        if (item.salesChannel === "table") {
                                          return t("orders.eatIn");
                                        } else if (
                                          item.salesChannel === "pos"
                                        ) {
                                          return t("orders.atCounter");
                                        } else if (
                                          item.salesChannel === "online"
                                        ) {
                                          return t("orders.online");
                                        } else if (
                                          item.salesChannel === "delivery"
                                        ) {
                                          return t("orders.delivery");
                                        }
                                        return t("orders.atCounter"); // default fallback
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    {isEditing && editableInvoice ? (
                                      <div className="relative">
                                        <Input
                                          list={`customer-code-list-${item.id}`}
                                          value={
                                            editableInvoice.customerCode ||
                                            editableInvoice.customerTaxCode ||
                                            ""
                                          }
                                          onChange={(e) => {
                                            const inputValue = e.target.value;

                                            // Extract customer code from datalist value (part before " - ")
                                            const selectedCode =
                                              inputValue.includes(" - ")
                                                ? inputValue
                                                    .split(" - ")[0]
                                                    .trim()
                                                : inputValue;

                                            updateEditableInvoiceField(
                                              "customerCode",
                                              selectedCode,
                                            );

                                            // Find customer by code
                                            const selectedCustomer =
                                              customers.find(
                                                (c: any) =>
                                                  c.customerId ===
                                                    selectedCode ||
                                                  c.customerTaxCode ===
                                                    selectedCode,
                                              );

                                            if (selectedCustomer) {
                                              updateEditableInvoiceField(
                                                "customerName",
                                                selectedCustomer.name,
                                              );
                                              updateEditableInvoiceField(
                                                "customerPhone",
                                                selectedCustomer.phone || "",
                                              );
                                              updateEditableInvoiceField(
                                                "customerTaxCode",
                                                selectedCustomer.customerTaxCode ||
                                                  "",
                                              );
                                              updateEditableInvoiceField(
                                                "customerAddress",
                                                selectedCustomer.address || "",
                                              );
                                              updateEditableInvoiceField(
                                                "customerEmail",
                                                selectedCustomer.email || "",
                                              );
                                              updateEditableInvoiceField(
                                                "customerId",
                                                selectedCustomer.id,
                                              );
                                            }
                                          }}
                                          className="w-32"
                                          disabled={true}
                                          placeholder="Chọn mã KH"
                                        />
                                        <datalist
                                          id={`customer-code-list-${item.id}`}
                                        >
                                          {customers
                                            .filter(
                                              (c: any) =>
                                                c.customerId ||
                                                c.customerTaxCode,
                                            )
                                            .map((c: any) => (
                                              <option
                                                key={c.id}
                                                value={
                                                  c.customerId ||
                                                  c.customerTaxCode
                                                }
                                              >
                                                {c.customerId ||
                                                  c.customerTaxCode}{" "}
                                                - {c.name} ({c.phone || "N/A"})
                                              </option>
                                            ))}
                                        </datalist>
                                      </div>
                                    ) : (
                                      <div
                                        className="text-[16px] font-mono truncate"
                                        title={customerCode}
                                      >
                                        {customerCode}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div
                                      className="text-[16px] truncate"
                                      title={customerName}
                                    >
                                      {customerName}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    {" "}
                                    {/* Added cell for customer phone */}
                                    <div
                                      className="text-[16px] truncate"
                                      title={customerPhone}
                                    >
                                      {customerPhone || "-"}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <div className="text-[16px] font-medium">
                                      {formatCurrency(subtotal)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <div className="text-[16px]">
                                      {(() => {
                                        // If order discount is 0, calculate from order items
                                        if (discount === 0 && item.id) {
                                          // Get order items for this order from cache
                                          const cachedItems =
                                            queryClient.getQueryData([
                                              "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items",
                                              item.id,
                                            ]) as any[];
                                          if (
                                            cachedItems &&
                                            cachedItems.length > 0
                                          ) {
                                            const totalItemDiscount =
                                              cachedItems.reduce(
                                                (sum, orderItem) => {
                                                  return (
                                                    sum +
                                                    parseFloat(
                                                      orderItem.discount || "0",
                                                    )
                                                  );
                                                },
                                                0,
                                              );
                                            // Only show if there's actually item discount
                                            if (totalItemDiscount > 0) {
                                              return formatCurrency(
                                                totalItemDiscount,
                                              );
                                            }
                                          }
                                        }
                                        return formatCurrency(discount);
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <div className="text-[16px]">
                                      {formatCurrency(tax)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <div className="text-[16px] font-medium">
                                      {formatCurrency(total)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-[16px]">
                                      {getPaymentMethodName(item.paymentMethod)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-[16px]">
                                      {symbol || "-"}
                                    </div>
                                  </td>

                                  <td className="px-3 py-3">
                                    <div
                                      className="text-[16px] truncate"
                                      title={notes || "-"}
                                    >
                                      {notes || "-"}
                                    </div>
                                  </td>
                                </tr>
                                {selectedInvoice &&
                                  selectedInvoice.id === item.id &&
                                  selectedInvoice.type === item.type && (
                                    <tr>
                                      <td
                                        colSpan={
                                          storeSettings?.businessType ===
                                          "laundry"
                                            ? 16
                                            : 15
                                        }
                                        className="p-0"
                                      >
                                        <div className="p-4 border-l-4 border-blue-500 bg-gray-50">
                                          <Card className="shadow-lg">
                                            <CardHeader className="pb-3">
                                              <CardTitle className="text-lg text-blue-700">
                                                {t("common.orderDetails")}
                                              </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                              <div className="bg-white p-4 rounded-lg overflow-x-auto">
                                                <div className="min-w-[1200px]">
                                                  <table className="w-full text-base border-collapse">
                                                    <tbody>
                                                      <tr>
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t(
                                                            "orders.orderNumberLabel",
                                                          )}
                                                          :
                                                        </td>
                                                        <td className="py-2 pr-6 text-blue-600 font-semibold text-base">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <Input
                                                              {...form.register(
                                                                "orderNumber",
                                                              )}
                                                              value={
                                                                editableInvoice.orderNumber ||
                                                                ""
                                                              }
                                                              onChange={(e) => {
                                                                updateEditableInvoiceField(
                                                                  "orderNumber",
                                                                  e.target
                                                                    .value,
                                                                );
                                                                form.setValue(
                                                                  "orderNumber",
                                                                  e.target
                                                                    .value,
                                                                );
                                                              }}
                                                              className="w-32"
                                                              disabled={true}
                                                            />
                                                          ) : (
                                                            selectedInvoice.orderNumber ||
                                                            selectedInvoice.displayNumber
                                                          )}
                                                        </td>
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t("common.date")}:
                                                        </td>
                                                        <td className="py-2 pr-6 text-base">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <Input
                                                              type="datetime-local"
                                                              {...form.register(
                                                                "createdAt",
                                                              )}
                                                              value={
                                                                editableInvoice.createdAt?.slice(
                                                                  0,
                                                                  16,
                                                                ) || ""
                                                              }
                                                              onChange={(e) => {
                                                                updateEditableInvoiceField(
                                                                  "createdAt",
                                                                  e.target
                                                                    .value,
                                                                );
                                                                form.setValue(
                                                                  "createdAt",
                                                                  e.target
                                                                    .value,
                                                                );
                                                              }}
                                                              className="w-44"
                                                              disabled={
                                                                selectedInvoice.displayStatus ===
                                                                1
                                                              }
                                                            />
                                                          ) : (
                                                            formatDate(
                                                              selectedInvoice.createdAt,
                                                            )
                                                          )}
                                                        </td>
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t("orders.customer")}
                                                          :
                                                        </td>
                                                        <td className="py-2 pr-6 text-blue-600 font-semibold text-base">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <div className="relative">
                                                              <Input
                                                                list={`customer-name-list-${selectedInvoice.id}`}
                                                                value={
                                                                  editableInvoice.customerName ||
                                                                  ""
                                                                }
                                                                onChange={(
                                                                  e,
                                                                ) => {
                                                                  const inputValue =
                                                                    e.target
                                                                      .value;

                                                                  // Always update customer name as user types
                                                                  updateEditableInvoiceField(
                                                                    "customerName",
                                                                    inputValue,
                                                                  );

                                                                  // Try to find exact match in customers list
                                                                  const selectedCustomer =
                                                                    customers.find(
                                                                      (
                                                                        c: any,
                                                                      ) => {
                                                                        // Check for exact name match
                                                                        if (
                                                                          c.name ===
                                                                          inputValue
                                                                        )
                                                                          return true;

                                                                        // Check if input matches datalist format: "Name - Phone (Code)"
                                                                        const datalistValue = `${c.name} - ${c.phone || "N/A"} (${c.customerId || "N/A"})`;
                                                                        if (
                                                                          datalistValue ===
                                                                          inputValue
                                                                        )
                                                                          return true;

                                                                        return false;
                                                                      },
                                                                    );

                                                                  if (
                                                                    selectedCustomer
                                                                  ) {
                                                                    // Auto-fill customer information
                                                                    updateEditableInvoiceField(
                                                                      "customerName",
                                                                      selectedCustomer.name,
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerPhone",
                                                                      selectedCustomer.phone ||
                                                                        "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerTaxCode",
                                                                      selectedCustomer.customerTaxCode ||
                                                                        selectedCustomer.taxCode ||
                                                                        "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerAddress",
                                                                      selectedCustomer.address ||
                                                                        "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerEmail",
                                                                      selectedCustomer.email ||
                                                                        "",
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerId",
                                                                      selectedCustomer.id,
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "customerCode",
                                                                      selectedCustomer.customerId ||
                                                                        selectedCustomer.customerTaxCode ||
                                                                        "",
                                                                    );
                                                                  }
                                                                }}
                                                                className="w-60"
                                                                disabled={
                                                                  selectedInvoice.displayStatus ===
                                                                  1
                                                                }
                                                                placeholder="Nhập tên khách hàng..."
                                                              />
                                                              <datalist
                                                                id={`customer-name-list-${selectedInvoice.id}`}
                                                              >
                                                                {customers.map(
                                                                  (c: any) => (
                                                                    <option
                                                                      key={c.id}
                                                                      value={`${c.name} - ${c.phone || "N/A"} (${c.customerId || "N/A"})`}
                                                                    >
                                                                      {c.name} -{" "}
                                                                      {c.phone ||
                                                                        "N/A"}{" "}
                                                                      (
                                                                      {c.customerId ||
                                                                        "N/A"}
                                                                      )
                                                                    </option>
                                                                  ),
                                                                )}
                                                              </datalist>
                                                            </div>
                                                          ) : (
                                                            <>
                                                              {(isEditing
                                                                ? editableInvoice?.customerName
                                                                : selectedInvoice.customerName) ||
                                                                "Khách hàng"}
                                                              {(isEditing
                                                                ? editableInvoice?.customerPhone
                                                                : selectedInvoice.customerPhone) &&
                                                                ` - ${isEditing ? editableInvoice?.customerPhone : selectedInvoice.customerPhone}`}
                                                            </>
                                                          )}
                                                        </td>
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t(
                                                            "orders.phoneNumber",
                                                          )}
                                                          :
                                                        </td>
                                                        <td className="py-2 pr-6 text-base">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <Input
                                                              {...form.register(
                                                                "customerPhone",
                                                              )}
                                                              value={
                                                                editableInvoice.customerPhone ||
                                                                ""
                                                              }
                                                              onChange={(e) => {
                                                                updateEditableInvoiceField(
                                                                  "customerPhone",
                                                                  e.target
                                                                    .value,
                                                                );
                                                                form.setValue(
                                                                  "customerPhone",
                                                                  e.target
                                                                    .value,
                                                                );
                                                              }}
                                                              className="w-32"
                                                              disabled={
                                                                selectedInvoice.displayStatus ===
                                                                1
                                                              }
                                                              placeholder="Số điện thoại"
                                                            />
                                                          ) : (
                                                            <span className="text-sm">
                                                              {selectedInvoice.customerPhone ||
                                                                "-"}
                                                            </span>
                                                          )}
                                                        </td>
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t("orders.table")}:
                                                        </td>
                                                        <td className="py-2 pr-6 text-base">
                                                          {selectedInvoice.salesChannel ===
                                                            "table" &&
                                                          selectedInvoice.tableId
                                                            ? getTableNumber(
                                                                selectedInvoice.tableId,
                                                              )
                                                            : "-"}
                                                        </td>
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t("common.status")}:
                                                        </td>
                                                        <td className="py-2 text-base">
                                                          {(() => {
                                                            const statusLabels =
                                                              {
                                                                1: `${t("common.completed")}`,
                                                                2: `${t("common.serving")}`,
                                                                3: `${t("common.cancelled")}`,
                                                              };
                                                            return (
                                                              statusLabels[
                                                                selectedInvoice
                                                                  .displayStatus
                                                              ] ||
                                                              "Đang phục vụ"
                                                            );
                                                          })()}
                                                        </td>
                                                      </tr>
                                                      <tr>
                                                        {storeSettings?.businessType ===
                                                          "laundry" && (
                                                          <>
                                                            <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                              {t(
                                                                "common.returned",
                                                              )}
                                                              :
                                                            </td>
                                                            <td className="py-2 pr-6 text-base">
                                                              {isEditing &&
                                                              editableInvoice ? (
                                                                <Checkbox
                                                                  {...form.register(
                                                                    "isPaid",
                                                                  )}
                                                                  checked={
                                                                    editableInvoice.isPaid ||
                                                                    false
                                                                  }
                                                                  onCheckedChange={(
                                                                    checked,
                                                                  ) => {
                                                                    console.log(
                                                                      "✅ isPaid checkbox changed to:",
                                                                      checked,
                                                                    );
                                                                    updateEditableInvoiceField(
                                                                      "isPaid",
                                                                      checked as boolean,
                                                                    );
                                                                    form.setValue(
                                                                      "isPaid",
                                                                      checked,
                                                                    );
                                                                  }}
                                                                />
                                                              ) : (
                                                                <Badge
                                                                  className={
                                                                    selectedInvoice?.isPaid
                                                                      ? "bg-green-100 text-green-800"
                                                                      : "bg-gray-100 text-gray-600"
                                                                  }
                                                                >
                                                                  {selectedInvoice?.isPaid
                                                                    ? t(
                                                                        "common.returned",
                                                                      )
                                                                    : t(
                                                                        "common.notReturned",
                                                                      )}
                                                                </Badge>
                                                              )}
                                                            </td>
                                                          </>
                                                        )}
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t(
                                                            "orders.salesType",
                                                          )}
                                                          :
                                                        </td>
                                                        <td className="py-2 pr-6 text-base">
                                                          {(() => {
                                                            const salesChannel =
                                                              selectedInvoice.salesChannel;
                                                            if (
                                                              salesChannel ===
                                                              "table"
                                                            )
                                                              return t(
                                                                "orders.eatIn",
                                                              );
                                                            if (
                                                              salesChannel ===
                                                              "pos"
                                                            )
                                                              return t(
                                                                "orders.atCounter",
                                                              );
                                                            if (
                                                              salesChannel ===
                                                              "online"
                                                            )
                                                              return t(
                                                                "orders.online",
                                                              );
                                                            if (
                                                              salesChannel ===
                                                              "delivery"
                                                            )
                                                              return t(
                                                                "orders.delivery",
                                                              );
                                                            return t(
                                                              "orders.atCounter",
                                                            );
                                                          })()}
                                                        </td>
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t(
                                                            "orders.invoiceSymbol",
                                                          )}
                                                          :
                                                        </td>
                                                        <td className="py-2 pr-6 text-base">
                                                          {isEditing &&
                                                          editableInvoice ? (
                                                            <Input
                                                              {...form.register(
                                                                "symbol",
                                                              )}
                                                              value={
                                                                editableInvoice.symbol ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                updateEditableInvoiceField(
                                                                  "symbol",
                                                                  e.target
                                                                    .value,
                                                                )
                                                              }
                                                              className="w-32"
                                                              disabled={
                                                                selectedInvoice.displayStatus ===
                                                                1
                                                              }
                                                            />
                                                          ) : (
                                                            <span className="text-sm">
                                                              {selectedInvoice.symbol ||
                                                                selectedInvoice.templateNumber ||
                                                                "-"}
                                                            </span>
                                                          )}
                                                        </td>
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t(
                                                            "orders.invoiceNumber",
                                                          )}
                                                          :
                                                        </td>
                                                        <td className="py-2 pr-6 text-base">
                                                          {isEditing &&
                                                          editableInvoice &&
                                                          selectedInvoice.displayStatus !==
                                                            1 ? (
                                                            <Input
                                                              {...form.register(
                                                                "templateNumber",
                                                              )}
                                                              value={
                                                                editableInvoice.templateNumber ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                updateEditableInvoiceField(
                                                                  "templateNumber",
                                                                  e.target
                                                                    .value,
                                                                )
                                                              }
                                                              className="w-40"
                                                              disabled={
                                                                selectedInvoice.displayStatus ===
                                                                1
                                                              }
                                                            />
                                                          ) : (
                                                            <span className="text-sm">
                                                              {selectedInvoice.templateNumber ||
                                                                "-"}
                                                            </span>
                                                          )}
                                                        </td>
                                                        <td className="py-2 pr-4 font-semibold whitespace-nowrap text-base">
                                                          {t(
                                                            "common.einvoiceStatusLabel",
                                                          )}
                                                        </td>
                                                        <td className="py-2 pr-6 text-base">
                                                          {getEInvoiceStatusBadge(
                                                            selectedInvoice.einvoiceStatus,
                                                          )}
                                                        </td>
                                                      </tr>
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>

                                              <div>
                                                <h4 className="font-medium mb-3">
                                                  {t("orders.itemList")}
                                                </h4>
                                                {orderItemsLoading ? (
                                                  <div className="text-center py-8">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                                                    <p className="mt-2 text-gray-500">
                                                      {t("common.loading")}
                                                    </p>
                                                  </div>
                                                ) : orderItemsError ? (
                                                  <div className="text-center py-8">
                                                    <div className="text-red-500 mb-4">
                                                      <X className="w-8 h-8 mx-auto mb-2" />
                                                      <p className="font-medium">
                                                        {t(
                                                          "errors.failedToLoadItems",
                                                        )}
                                                      </p>
                                                    </div>
                                                    <p className="text-gray-500 mb-4">
                                                      {t(
                                                        "errors.failedToLoadItemData",
                                                      )}
                                                    </p>
                                                    <Button
                                                      onClick={() => {
                                                        queryClient.invalidateQueries(
                                                          {
                                                            queryKey: [
                                                              "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items",
                                                              selectedInvoice?.id,
                                                            ],
                                                          },
                                                        );
                                                      }}
                                                      size="sm"
                                                    >
                                                      {t("common.retry")}
                                                    </Button>
                                                  </div>
                                                ) : !orderItems ||
                                                  orderItems.length === 0 ? (
                                                  <div className="text-center py-8">
                                                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                                    <p className="text-gray-500">
                                                      {t("common.noItems")}
                                                    </p>
                                                  </div>
                                                ) : (
                                                  <div className="border rounded-lg overflow-x-auto">
                                                    <table className="w-full text-sm min-w-[1200px]">
                                                      <thead>
                                                        <tr className="bg-gray-50 border-b">
                                                          <th className="border-r px-2 py-2 font-medium text-base text-left sticky left-0 bg-green-50 z-10 w-12">
                                                            {t("common.no")}
                                                          </th>
                                                          <th className="border-r px-2 py-2 font-medium text-base text-left min-w-[100px]">
                                                            {t(
                                                              "orders.itemCode",
                                                            )}
                                                          </th>
                                                          <th className="border-r px-2 py-2 font-medium text-base text-left min-w-[180px] max-w-[220px]">
                                                            {t(
                                                              "orders.itemName",
                                                            )}
                                                          </th>
                                                          <th className="border-r px-2 py-2 font-medium text-base text-center min-w-[60px]">
                                                            {t("orders.unit")}
                                                          </th>
                                                          <th className="border-r px-2 py-2 font-medium text-base text-center min-w-[80px]">
                                                            {t(
                                                              "common.quantity",
                                                            )}
                                                          </th>
                                                          <th className="border-r px-2 py-2 font-medium text-base text-right min-w-[100px]">
                                                            {t(
                                                              "orders.unitPrice",
                                                            )}
                                                          </th>
                                                          <th className="border-r px-2 py-2 font-medium text-base text-right min-w-[100px]">
                                                            {t(
                                                              "common.subtotalAmount",
                                                            )}
                                                          </th>
                                                          <th className="border-r px-2 py-2 font-medium text-base text-right min-w-[100px]">
                                                            {t(
                                                              "common.discount",
                                                            )}
                                                          </th>
                                                          <th className="border-r px-2 py-2 font-medium text-base text-right min-w-[100px]">
                                                            {t("common.tax")}
                                                          </th>
                                                          <th className="border-r px-2 py-2 font-medium text-base text-right min-w-[100px]">
                                                            {t("common.total")}
                                                          </th>
                                                          <th className="text-center px-3 py-2 font-medium text-base whitespace-nowrap w-[80px]">
                                                            {isEditing &&
                                                            selectedInvoice?.displayStatus !==
                                                              1 &&
                                                            !(
                                                              storeSettings?.businessType ===
                                                                "laundry" &&
                                                              selectedInvoice?.status ===
                                                                "paid"
                                                            ) ? (
                                                              <button
                                                                onClick={
                                                                  handleAddNewOrderItem
                                                                }
                                                                className="text-green-600 hover:text-green-700 font-bold text-lg"
                                                                title="Thêm dòng mới"
                                                              >
                                                                +
                                                              </button>
                                                            ) : (
                                                              ""
                                                            )}
                                                          </th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {(() => {
                                                          // Filter out items marked for deletion
                                                          const visibleItems =
                                                            orderItems.filter(
                                                              (item: any) =>
                                                                !editedOrderItems[
                                                                  item.id
                                                                ]?._deleted,
                                                            );

                                                          if (
                                                            !visibleItems ||
                                                            visibleItems.length ===
                                                              0
                                                          ) {
                                                            return (
                                                              <tr className="border-t">
                                                                <td
                                                                  colSpan={10} // Adjusted colspan
                                                                  className="text-center py-4 text-gray-500"
                                                                >
                                                                  {t(
                                                                    "common.noItems",
                                                                  )}
                                                                </td>
                                                              </tr>
                                                            );
                                                          }
                                                          return visibleItems.map(
                                                            (
                                                              item: any,
                                                              index: number,
                                                            ) => {
                                                              // Get edited values or use original
                                                              const editedItem =
                                                                editedOrderItems[
                                                                  item.id
                                                                ] || {};

                                                              // For new items, prioritize edited values
                                                              const isNewItem =
                                                                editedItem._isNew ||
                                                                item._isNew;

                                                              // Get product info - prioritize edited productId
                                                              const productId =
                                                                editedItem.productId !==
                                                                undefined
                                                                  ? editedItem.productId
                                                                  : item.productId ||
                                                                    0;

                                                              const product =
                                                                products.find(
                                                                  (p: any) =>
                                                                    p.id ===
                                                                    productId,
                                                                );

                                                              const priceIncludeTax =
                                                                selectedInvoice?.priceIncludeTax ??
                                                                storeSettings?.priceIncludesTax ??
                                                                false;

                                                              // Get all field values - prioritize edited values
                                                              const sku =
                                                                editedItem.sku !==
                                                                undefined
                                                                  ? editedItem.sku
                                                                  : item.sku ||
                                                                    item.productSku ||
                                                                    product?.sku ||
                                                                    "";

                                                              const productName =
                                                                editedItem.productName !==
                                                                undefined
                                                                  ? editedItem.productName
                                                                  : item.productName ||
                                                                    "";

                                                              const unitPrice =
                                                                parseFloat(
                                                                  editedItem.unitPrice !==
                                                                    undefined
                                                                    ? editedItem.unitPrice
                                                                    : item.unitPrice ||
                                                                        "0",
                                                                );
                                                              const quantity =
                                                                parseFloat(
                                                                  editedItem.quantity !==
                                                                    undefined
                                                                    ? editedItem.quantity
                                                                    : item.quantity ||
                                                                        "0",
                                                                );

                                                              const orderDiscount =
                                                                parseFloat(
                                                                  selectedInvoice?.discount ||
                                                                    "0",
                                                                );

                                                              // Get discount from editedOrderItems if available, otherwise calculate
                                                              let itemDiscountAmount =
                                                                Number(
                                                                  item.discount ||
                                                                    "0",
                                                                );

                                                              if (
                                                                editedItem.discount !==
                                                                undefined
                                                              ) {
                                                                // Use the allocated discount from editedOrderItems
                                                                itemDiscountAmount =
                                                                  parseFloat(
                                                                    editedItem.discount,
                                                                  );
                                                              } else if (
                                                                orderDiscount >
                                                                0
                                                              ) {
                                                                // Calculate total before discount for proportional distribution
                                                                const totalBeforeDiscount =
                                                                  visibleItems.reduce(
                                                                    (
                                                                      sum: number,
                                                                      it,
                                                                    ) => {
                                                                      const editedIt =
                                                                        editedOrderItems[
                                                                          it.id
                                                                        ] || {};
                                                                      const itPrice =
                                                                        parseFloat(
                                                                          editedIt.unitPrice !==
                                                                            undefined
                                                                            ? editedIt.unitPrice
                                                                            : it.unitPrice ||
                                                                                "0",
                                                                        );
                                                                      const itQty =
                                                                        parseFloat(
                                                                          // Use parseFloat for quantity
                                                                          editedIt.quantity !==
                                                                            undefined
                                                                            ? editedIt.quantity
                                                                            : it.quantity ||
                                                                                "0",
                                                                        );
                                                                      return (
                                                                        sum +
                                                                        itPrice *
                                                                          itQty
                                                                      );
                                                                    },
                                                                    0,
                                                                  );

                                                                if (
                                                                  totalBeforeDiscount >
                                                                  0
                                                                ) {
                                                                  const isLastItem =
                                                                    index ===
                                                                    visibleItems.length -
                                                                      1;
                                                                  const itemSubtotal =
                                                                    unitPrice *
                                                                    quantity;

                                                                  if (
                                                                    isLastItem
                                                                  ) {
                                                                    // Last item gets remaining discount
                                                                    const previousDiscounts =
                                                                      visibleItems
                                                                        .slice(
                                                                          0,
                                                                          -1,
                                                                        )
                                                                        .reduce(
                                                                          (
                                                                            sum,
                                                                            it,
                                                                          ) => {
                                                                            const editedIt =
                                                                              editedOrderItems[
                                                                                it
                                                                                  .id
                                                                              ] ||
                                                                              {};
                                                                            const itPrice =
                                                                              parseFloat(
                                                                                editedIt.unitPrice !==
                                                                                  undefined
                                                                                  ? editedIt.unitPrice
                                                                                  : it.unitPrice ||
                                                                                      "0",
                                                                              );
                                                                            const itQty =
                                                                              parseFloat(
                                                                                // Use parseFloat for quantity
                                                                                editedIt.quantity !==
                                                                                  undefined
                                                                                  ? editedIt.quantity
                                                                                  : it.quantity ||
                                                                                      "0",
                                                                              );
                                                                            const itSubtotal =
                                                                              itPrice *
                                                                              itQty;
                                                                            return (
                                                                              sum +
                                                                              Math.floor(
                                                                                (orderDiscount *
                                                                                  itSubtotal) /
                                                                                  totalBeforeDiscount,
                                                                              )
                                                                            );
                                                                          },
                                                                          0,
                                                                        );
                                                                    itemDiscountAmount =
                                                                      Math.max(
                                                                        0,
                                                                        orderDiscount -
                                                                          previousDiscounts,
                                                                      );
                                                                  } else {
                                                                    itemDiscountAmount =
                                                                      Math.floor(
                                                                        (orderDiscount *
                                                                          itemSubtotal) /
                                                                          totalBeforeDiscount,
                                                                      );
                                                                  }
                                                                }
                                                              }

                                                              // Calculate tax based on priceIncludeTax setting
                                                              const taxRate =
                                                                product?.taxRate
                                                                  ? parseFloat(
                                                                      product.taxRate,
                                                                    ) / 100
                                                                  : 0;
                                                              let itemTax = 0;
                                                              let itemTotal = 0;

                                                              if (
                                                                priceIncludeTax &&
                                                                taxRate > 0
                                                              ) {
                                                                const itemSubtotal =
                                                                  unitPrice *
                                                                  quantity;
                                                                const priceBeforeTax =
                                                                  itemSubtotal /
                                                                  (1 + taxRate);
                                                                itemTax =
                                                                  itemSubtotal -
                                                                  priceBeforeTax;
                                                                itemTotal =
                                                                  itemSubtotal -
                                                                  itemDiscountAmount;
                                                              } else {
                                                                const itemSubtotal =
                                                                  unitPrice *
                                                                  quantity;
                                                                itemTax =
                                                                  itemSubtotal *
                                                                  taxRate;
                                                                itemTotal =
                                                                  itemSubtotal +
                                                                  itemTax -
                                                                  itemDiscountAmount;
                                                              }

                                                              return (
                                                                <tr
                                                                  key={item.id}
                                                                  className="border-b hover:bg-gray-50"
                                                                >
                                                                  <td className="text-center py-2 px-3 border-r text-sm w-[50px]">
                                                                    {index + 1}
                                                                  </td>
                                                                  <td className="text-left py-2 px-3 border-r text-base w-[120px]">
                                                                    {isEditing ? (
                                                                      <div className="relative">
                                                                        <Input
                                                                          list={`product-sku-list-${item.id}`}
                                                                          value={
                                                                            sku
                                                                          }
                                                                          disabled={
                                                                            selectedInvoice.displayStatus ===
                                                                            1
                                                                          }
                                                                          data-field={`orderitem-sku-${index}`}
                                                                          onFocus={(
                                                                            e,
                                                                          ) =>
                                                                            e.target.select()
                                                                          }
                                                                          onChange={(
                                                                            e,
                                                                          ) => {
                                                                            const inputValue =
                                                                              e
                                                                                .target
                                                                                .value;

                                                                            // Trích xuất chỉ SKU từ giá trị datalist (phần trước " - ")
                                                                            const selectedSku =
                                                                              inputValue.includes(
                                                                                " - ",
                                                                              )
                                                                                ? inputValue
                                                                                    .split(
                                                                                      " - ",
                                                                                    )[0]
                                                                                    .trim()
                                                                                : inputValue;

                                                                            updateOrderItemField(
                                                                              item.id,
                                                                              "sku",
                                                                              selectedSku,
                                                                            );

                                                                            // Tìm sản phẩm theo SKU
                                                                            const selectedProduct =
                                                                              products.find(
                                                                                (
                                                                                  p: any,
                                                                                ) =>
                                                                                  p.sku ===
                                                                                  selectedSku,
                                                                              );

                                                                            if (
                                                                              selectedProduct
                                                                            ) {
                                                                              // Cập nhật thông tin sản phẩm
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "productId",
                                                                                selectedProduct.id,
                                                                              );
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "productName",
                                                                                selectedProduct.name,
                                                                              );
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "unitPrice",
                                                                                selectedProduct.price,
                                                                              );
                                                                            }
                                                                          }}
                                                                          onKeyDown={(
                                                                            e,
                                                                          ) =>
                                                                            handleOrderItemKeyDown(
                                                                              e,
                                                                              index,
                                                                              "sku",
                                                                            )
                                                                          }
                                                                          className="w-full h-8 text-base"
                                                                          placeholder="Chọn mã hàng"
                                                                        />
                                                                        <datalist
                                                                          id={`product-sku-list-${item.id}`}
                                                                        >
                                                                          {products
                                                                            .filter(
                                                                              (
                                                                                p: any,
                                                                              ) =>
                                                                                p.isActive &&
                                                                                p.productType !==
                                                                                  4,
                                                                            )
                                                                            .map(
                                                                              (
                                                                                p: any,
                                                                              ) => (
                                                                                <option
                                                                                  key={
                                                                                    p.id
                                                                                  }
                                                                                  value={
                                                                                    p.sku
                                                                                  }
                                                                                >
                                                                                  {
                                                                                    p.sku
                                                                                  }{" "}
                                                                                  -{" "}
                                                                                  {
                                                                                    p.name
                                                                                  }{" "}
                                                                                  (
                                                                                  {formatCurrency(
                                                                                    p.price,
                                                                                  )}

                                                                                  )
                                                                                </option>
                                                                              ),
                                                                            )}
                                                                        </datalist>
                                                                      </div>
                                                                    ) : (
                                                                      <div className="truncate text-base">
                                                                        {sku ||
                                                                          "-"}
                                                                      </div>
                                                                    )}
                                                                  </td>
                                                                  <td className="text-left py-2 px-3 border-r text-base w-[180px] max-w-[220px]">
                                                                    {isEditing ? (
                                                                      <div className="relative">
                                                                        <Input
                                                                          list={`product-name-list-${item.id}`}
                                                                          value={
                                                                            productName
                                                                          }
                                                                          disabled={
                                                                            selectedInvoice.displayStatus ===
                                                                            1
                                                                          }
                                                                          data-field={`orderitem-productName-${index}`}
                                                                          onFocus={(
                                                                            e,
                                                                          ) =>
                                                                            e.target.select()
                                                                          }
                                                                          onChange={(
                                                                            e,
                                                                          ) => {
                                                                            const inputValue =
                                                                              e
                                                                                .target
                                                                                .value;

                                                                            // Trích xuất chỉ tên sản phẩm từ giá trị datalist
                                                                            // Format: "Tên - SKU (Giá)" -> lấy phần trước " - "
                                                                            const selectedName =
                                                                              inputValue.includes(
                                                                                " - ",
                                                                              )
                                                                                ? inputValue
                                                                                    .split(
                                                                                      " - ",
                                                                                    )[0]
                                                                                    .trim()
                                                                                : inputValue;

                                                                            updateOrderItemField(
                                                                              item.id,
                                                                              "productName",
                                                                              selectedName,
                                                                            );

                                                                            // Tìm sản phẩm theo tên
                                                                            const selectedProduct =
                                                                              products.find(
                                                                                (
                                                                                  p: any,
                                                                                ) =>
                                                                                  p.name ===
                                                                                  selectedName,
                                                                              );

                                                                            if (
                                                                              selectedProduct
                                                                            ) {
                                                                              // Cập nhật thông tin sản phẩm
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "productId",
                                                                                selectedProduct.id,
                                                                              );
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "sku",
                                                                                selectedProduct.sku,
                                                                              );
                                                                              updateOrderItemField(
                                                                                item.id,
                                                                                "unitPrice",
                                                                                selectedProduct.price,
                                                                              );
                                                                            }
                                                                          }}
                                                                          onKeyDown={(
                                                                            e,
                                                                          ) =>
                                                                            handleOrderItemKeyDown(
                                                                              e,
                                                                              index,
                                                                              "productName",
                                                                            )
                                                                          }
                                                                          className="w-full h-8 text-base"
                                                                          placeholder="Chọn tên hàng"
                                                                        />
                                                                        <datalist
                                                                          id={`product-name-list-${item.id}`}
                                                                        >
                                                                          {products
                                                                            .filter(
                                                                              (
                                                                                p: any,
                                                                              ) =>
                                                                                p.isActive &&
                                                                                p.productType !==
                                                                                  4,
                                                                            )
                                                                            .map(
                                                                              (
                                                                                p: any,
                                                                              ) => (
                                                                                <option
                                                                                  key={
                                                                                    p.id
                                                                                  }
                                                                                  value={
                                                                                    p.name
                                                                                  }
                                                                                >
                                                                                  {
                                                                                    p.name
                                                                                  }{" "}
                                                                                  -{" "}
                                                                                  {
                                                                                    p.sku
                                                                                  }{" "}
                                                                                  (
                                                                                  {formatCurrency(
                                                                                    p.price,
                                                                                  )}

                                                                                  )
                                                                                </option>
                                                                              ),
                                                                            )}
                                                                        </datalist>
                                                                      </div>
                                                                    ) : (
                                                                      <div className="truncate text-base font-semibold">
                                                                        {productName ||
                                                                          "-"}
                                                                      </div>
                                                                    )}
                                                                  </td>
                                                                  <td className="text-center py-2 px-3 border-r text-base w-[60px]">
                                                                    {product?.unit ||
                                                                      "pcs"}
                                                                  </td>
                                                                  <td className="text-center py-2 px-3 border-r text-base w-[100px]">
                                                                    {isEditing ? (
                                                                      <NumericFormat
                                                                        value={
                                                                          quantity
                                                                        }
                                                                        onValueChange={(
                                                                          values,
                                                                        ) => {
                                                                          const {
                                                                            floatValue,
                                                                          } =
                                                                            values;
                                                                          if (
                                                                            floatValue !==
                                                                              undefined &&
                                                                            floatValue >
                                                                              0
                                                                          ) {
                                                                            updateOrderItemField(
                                                                              item.id,
                                                                              "quantity",
                                                                              floatValue,
                                                                            );
                                                                          }
                                                                        }}
                                                                        onBlur={(
                                                                          e,
                                                                        ) => {
                                                                          const rawValue =
                                                                            e.target.value
                                                                              .replace(
                                                                                /\./g,
                                                                                "",
                                                                              )
                                                                              .replace(
                                                                                ",",
                                                                                ".",
                                                                              );
                                                                          const value =
                                                                            parseFloat(
                                                                              rawValue,
                                                                            );
                                                                          if (
                                                                            !value ||
                                                                            value <=
                                                                              0 ||
                                                                            isNaN(
                                                                              value,
                                                                            )
                                                                          ) {
                                                                            updateOrderItemField(
                                                                              item.id,
                                                                              "quantity",
                                                                              1,
                                                                            );
                                                                          }
                                                                        }}
                                                                        onKeyDown={(
                                                                          e,
                                                                        ) =>
                                                                          handleOrderItemKeyDown(
                                                                            e,
                                                                            index,
                                                                            "quantity",
                                                                          )
                                                                        }
                                                                        data-field={`orderitem-quantity-${index}`}
                                                                        customInput={
                                                                          Input
                                                                        }
                                                                        decimalScale={
                                                                          4
                                                                        }
                                                                        fixedDecimalScale={
                                                                          false
                                                                        }
                                                                        allowNegative={
                                                                          false
                                                                        }
                                                                        decimalSeparator=","
                                                                        thousandSeparator="."
                                                                        disabled={
                                                                          selectedInvoice.displayStatus ===
                                                                          1
                                                                        }
                                                                        className="w-full h-8 text-base text-center"
                                                                      />
                                                                    ) : (
                                                                      quantity.toLocaleString(
                                                                        "vi-VN",
                                                                        {
                                                                          minimumFractionDigits: 0,
                                                                          maximumFractionDigits: 4,
                                                                        },
                                                                      )
                                                                    )}
                                                                  </td>
                                                                  <td className="text-right py-2 px-3 border-r text-base w-[120px]">
                                                                    {isEditing ? (
                                                                      <Input
                                                                        type="text"
                                                                        value={Math.floor(
                                                                          unitPrice,
                                                                        ).toLocaleString(
                                                                          "vi-VN",
                                                                        )}
                                                                        disabled={
                                                                          selectedInvoice.displayStatus ===
                                                                          1
                                                                        }
                                                                        data-field={`orderitem-unitPrice-${index}`}
                                                                        onChange={(
                                                                          e,
                                                                        ) => {
                                                                          const value =
                                                                            e.target.value.replace(
                                                                              /[^\d]/g,
                                                                              "",
                                                                            );
                                                                          const newPrice =
                                                                            parseFloat(
                                                                              value,
                                                                            ) ||
                                                                            0;
                                                                          updateOrderItemField(
                                                                            item.id,
                                                                            "unitPrice",
                                                                            newPrice.toString(),
                                                                          );
                                                                        }}
                                                                        onKeyDown={(
                                                                          e,
                                                                        ) =>
                                                                          handleOrderItemKeyDown(
                                                                            e,
                                                                            index,
                                                                            "unitPrice",
                                                                          )
                                                                        }
                                                                        className="w-full text-right h-8"
                                                                      />
                                                                    ) : (
                                                                      Math.floor(
                                                                        unitPrice,
                                                                      ).toLocaleString(
                                                                        "vi-VN",
                                                                      )
                                                                    )}
                                                                  </td>
                                                                  <td className="text-right py-2 px-3 border-r text-base w-[120px]">
                                                                    {Math.floor(
                                                                      unitPrice *
                                                                        quantity,
                                                                    ).toLocaleString(
                                                                      "vi-VN",
                                                                    )}
                                                                  </td>
                                                                  <td className="text-red-600 text-right py-2 px-3 border-r text-base w-[100px]">
                                                                    {Math.floor(
                                                                      itemDiscountAmount,
                                                                    ).toLocaleString(
                                                                      "vi-VN",
                                                                    )}
                                                                  </td>
                                                                  <td className="text-right py-2 px-3 border-r text-base w-[100px]">
                                                                    {(() => {
                                                                      // ALWAYS use edited tax if available from state
                                                                      const editedItem =
                                                                        editedOrderItems[
                                                                          item
                                                                            .id
                                                                        ] || {};
                                                                      if (
                                                                        editedItem.tax !==
                                                                        undefined
                                                                      ) {
                                                                        return Math.floor(
                                                                          parseFloat(
                                                                            editedItem.tax,
                                                                          ),
                                                                        ).toLocaleString(
                                                                          "vi-VN",
                                                                        );
                                                                      }
                                                                      // Fallback to calculated itemTax
                                                                      return Math.floor(
                                                                        itemTax,
                                                                      ).toLocaleString(
                                                                        "vi-VN",
                                                                      );
                                                                    })()}
                                                                  </td>
                                                                  <td className="text-right py-2 px-3 border-r text-base w-[100px]">
                                                                    {(() => {
                                                                      const editedItem =
                                                                        editedOrderItems[
                                                                          item
                                                                            .id
                                                                        ] || {};

                                                                      // Tổng cộng = Thành tiền - Chiết khấu
                                                                      const thanhTien =
                                                                        unitPrice *
                                                                        quantity;
                                                                      const tongCong =
                                                                        thanhTien -
                                                                        itemDiscountAmount;

                                                                      return Math.floor(
                                                                        tongCong,
                                                                      ).toLocaleString(
                                                                        "vi-VN",
                                                                      );
                                                                    })()}
                                                                  </td>
                                                                  <td className="text-center py-2 px-3 text-sm w-[80px]">
                                                                    {isEditing &&
                                                                      selectedInvoice.displayStatus !==
                                                                        1 && (
                                                                        <Button
                                                                          size="sm"
                                                                          variant="ghost"
                                                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                          onClick={() => {
                                                                            if (
                                                                              window.confirm(
                                                                                `Bạn có chắc chắn muốn xóa "${item.productName}" khỏi đơn hàng?`,
                                                                              )
                                                                            ) {
                                                                              setEditedOrderItems(
                                                                                (
                                                                                  prev,
                                                                                ) => ({
                                                                                  ...prev,
                                                                                  [item.id]:
                                                                                    {
                                                                                      ...prev[
                                                                                        item
                                                                                          .id
                                                                                      ],
                                                                                      _deleted:
                                                                                        true,
                                                                                    },
                                                                                }),
                                                                              );
                                                                            }
                                                                          }}
                                                                        >
                                                                          <X className="h-4 w-4" />
                                                                        </Button>
                                                                      )}
                                                                  </td>
                                                                </tr>
                                                              );
                                                            },
                                                          );
                                                        })()}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                )}
                                              </div>

                                              <div>
                                                <h4 className="font-semibold text-lg mb-3">
                                                  {t("orders.summary")}
                                                </h4>
                                                <div className="bg-blue-50 p-4 rounded-lg">
                                                  <div className="grid grid-cols-2 gap-8">
                                                    {/* Cột trái - Các trường cũ */}
                                                    <div className="space-y-2 text-sm">
                                                      <div className="flex justify-between items-center">
                                                        <span>
                                                          {t(
                                                            "common.totalPayment",
                                                          )}
                                                          :
                                                        </span>
                                                        <span className="font-bold">
                                                          {formatCurrency(
                                                            Math.floor(
                                                              displayTotals.total,
                                                            ),
                                                          )}
                                                        </span>
                                                      </div>
                                                      <div className="flex justify-between items-center">
                                                        <span>
                                                          {t(
                                                            "common.subtotalAmount",
                                                          )}
                                                          :
                                                        </span>
                                                        <span className="font-bold">
                                                          {formatCurrency(
                                                            Math.floor(
                                                              displayTotals.subtotal,
                                                            ),
                                                          )}
                                                        </span>
                                                      </div>
                                                      <div className="flex justify-between text-red-600">
                                                        <span>
                                                          {t("common.discount")}
                                                          :
                                                        </span>
                                                        {isEditing &&
                                                        editableInvoice ? (
                                                          <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            {...form.register(
                                                              "discount",
                                                            )}
                                                            value={parseFloat(
                                                              editableInvoice.discount ||
                                                                "0",
                                                            ).toLocaleString(
                                                              "vi-VN",
                                                            )}
                                                            onFocus={(e) =>
                                                              e.target.select()
                                                            }
                                                            onChange={(e) => {
                                                              const value =
                                                                e.target.value.replace(
                                                                  /[^0-9]/g,
                                                                  "",
                                                                );
                                                              const newDiscount =
                                                                parseFloat(
                                                                  value,
                                                                ) || 0;

                                                              console.log(
                                                                "💰 Thay đổi chiết khấu:",
                                                                {
                                                                  oldDiscount:
                                                                    editableInvoice.discount,
                                                                  newDiscount,
                                                                  orderItems:
                                                                    orderItems.length,
                                                                },
                                                              );

                                                              // Cập nhật chiết khấu đơn hàng
                                                              updateEditableInvoiceField(
                                                                "discount",
                                                                newDiscount.toString(),
                                                              );
                                                              form.setValue(
                                                                "discount",
                                                                newDiscount.toString(),
                                                              ); // Sync with react-hook-form

                                                              // Phân bổ chiết khấu vào từng mặt hàng theo tỷ lệ thành tiền
                                                              const visibleItems =
                                                                orderItems.filter(
                                                                  (item: any) =>
                                                                    !editedOrderItems[
                                                                      item.id
                                                                    ]?._deleted,
                                                                );

                                                              if (
                                                                visibleItems.length >
                                                                0
                                                              ) {
                                                                // Tính tổng thành tiền trước chiết khấu
                                                                const totalBeforeDiscount =
                                                                  visibleItems.reduce(
                                                                    (
                                                                      sum: number,
                                                                      item: any,
                                                                    ) => {
                                                                      const editedItem =
                                                                        editedOrderItems[
                                                                          item
                                                                            .id
                                                                        ] || {};
                                                                      const unitPrice =
                                                                        parseFloat(
                                                                          editedItem.unitPrice !==
                                                                            undefined
                                                                            ? editedItem.unitPrice
                                                                            : item.unitPrice ||
                                                                                "0",
                                                                        );
                                                                      const quantity =
                                                                        parseFloat(
                                                                          editedItem.quantity !==
                                                                            undefined
                                                                            ? editedItem.quantity
                                                                            : item.quantity ||
                                                                                "0",
                                                                        );
                                                                      return (
                                                                        sum +
                                                                        unitPrice *
                                                                          quantity
                                                                      );
                                                                    },
                                                                    0,
                                                                  );

                                                                console.log(
                                                                  "📊 Tổng thành tiền trước CK:",
                                                                  totalBeforeDiscount,
                                                                );

                                                                // Phân bổ chiết khấu theo tỷ lệ
                                                                let allocatedDiscount = 0;
                                                                const newEditedItems =
                                                                  {
                                                                    ...editedOrderItems,
                                                                  };

                                                                visibleItems.forEach(
                                                                  (
                                                                    item: any,
                                                                    index: number,
                                                                  ) => {
                                                                    const editedItem =
                                                                      editedOrderItems[
                                                                        item.id
                                                                      ] || {};
                                                                    const unitPrice =
                                                                      parseFloat(
                                                                        editedItem.unitPrice !==
                                                                          undefined
                                                                          ? editedItem.unitPrice
                                                                          : item.unitPrice ||
                                                                              "0",
                                                                      );
                                                                    const quantity =
                                                                      parseFloat(
                                                                        // Use parseFloat for quantity
                                                                        editedItem.quantity !==
                                                                          undefined
                                                                          ? editedItem.quantity
                                                                          : item.quantity ||
                                                                              "0",
                                                                      );
                                                                    const itemSubtotal =
                                                                      unitPrice *
                                                                      quantity;

                                                                    let itemDiscount =
                                                                      Number(
                                                                        item.discount ||
                                                                          "0",
                                                                      );
                                                                    if (
                                                                      index ===
                                                                      visibleItems.length -
                                                                        1
                                                                    ) {
                                                                      // Mặt hàng cuối cùng: nhận phần CK còn lại
                                                                      itemDiscount =
                                                                        Math.max(
                                                                          0,
                                                                          Math.floor(
                                                                            newDiscount -
                                                                              allocatedDiscount,
                                                                          ),
                                                                        );
                                                                    } else {
                                                                      // Các mặt hàng khác: phân bổ theo tỷ lệ
                                                                      itemDiscount =
                                                                        totalBeforeDiscount >
                                                                        0
                                                                          ? Math.floor(
                                                                              (newDiscount *
                                                                                itemSubtotal) /
                                                                                totalBeforeDiscount,
                                                                            )
                                                                          : 0;
                                                                      allocatedDiscount +=
                                                                        itemDiscount;
                                                                    }

                                                                    console.log(
                                                                      `📦 Mặt hàng ${index + 1} (${item.productName}):`,
                                                                      {
                                                                        itemSubtotal,
                                                                        itemDiscount,
                                                                        allocatedDiscount,
                                                                      },
                                                                    );

                                                                    // Lưu chiết khấu đã phân bổ cho mặt hàng
                                                                    newEditedItems[
                                                                      item.id
                                                                    ] = {
                                                                      ...newEditedItems[
                                                                        item.id
                                                                      ],
                                                                      discount:
                                                                        itemDiscount.toString(),
                                                                    };
                                                                  },
                                                                );

                                                                setEditedOrderItems(
                                                                  newEditedItems,
                                                                );

                                                                console.log(
                                                                  "✅ Phân bổ CK hoàn tất:",
                                                                  {
                                                                    totalDiscount:
                                                                      newDiscount,
                                                                    totalBeforeDiscount,
                                                                    allocatedDiscount,
                                                                    itemCount:
                                                                      visibleItems.length,
                                                                    editedItems:
                                                                      newEditedItems,
                                                                  },
                                                                );
                                                              }
                                                            }}
                                                            className="h-7 text-sm w-32 text-right font-bold text-red-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            disabled={
                                                              selectedInvoice.displayStatus ===
                                                              1
                                                            }
                                                          />
                                                        ) : (
                                                          <span className="font-bold">
                                                            {displayTotals.discount >
                                                            0 ? (
                                                              <>
                                                                -
                                                                {formatCurrency(
                                                                  Math.floor(
                                                                    displayTotals.discount,
                                                                  ),
                                                                )}
                                                              </>
                                                            ) : (
                                                              <>
                                                                -
                                                                {formatCurrency(
                                                                  orderItems.reduce(
                                                                    (
                                                                      sum: number,
                                                                      item: any,
                                                                    ) =>
                                                                      sum +
                                                                      parseFloat(
                                                                        item.discount ||
                                                                          "0",
                                                                      ),
                                                                    0,
                                                                  ),
                                                                )}
                                                              </>
                                                            )}
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">
                                                          {t("common.totalTax")}
                                                          :
                                                        </span>
                                                        <span className="font-bold">
                                                          {formatCurrency(
                                                            Math.floor(
                                                              displayTotals.tax,
                                                            ),
                                                          )}
                                                        </span>
                                                      </div>
                                                    </div>

                                                    {/* Cột phải - Khách hàng trả và Phương thức thanh toán */}
                                                    <div className="space-y-2 text-sm">
                                                      {storeSettings?.businessType ===
                                                        "laundry" && (
                                                        <div className="flex justify-between items-center">
                                                          <span className="font-semibold text-gray-700">
                                                            {t(
                                                              "common.customerPaid",
                                                            )}
                                                            :
                                                          </span>
                                                          <span className="font-bold text-green-600">
                                                            {formatCurrency(
                                                              Math.floor(
                                                                displayTotals.total,
                                                              ),
                                                            )}
                                                          </span>
                                                        </div>
                                                      )}
                                                      <div className="flex justify-between items-center">
                                                        <span className="font-semibold text-gray-700">
                                                          {t(
                                                            "common.paymentMethodLabel",
                                                          )}
                                                          :
                                                        </span>
                                                        <span className="font-bold text-blue-600">
                                                          {isEditing ? (
                                                            <Select
                                                              value={
                                                                editableInvoice.paymentMethod !==
                                                                  null &&
                                                                editableInvoice.paymentMethod !==
                                                                  undefined &&
                                                                String(
                                                                  editableInvoice.paymentMethod,
                                                                ).trim() !== ""
                                                                  ? String(
                                                                      editableInvoice.paymentMethod,
                                                                    )
                                                                  : "unpaid"
                                                              }
                                                              onValueChange={(
                                                                value,
                                                              ) => {
                                                                console.log(
                                                                  "💳 Payment method changed to:",
                                                                  value,
                                                                  "Type:",
                                                                  typeof value,
                                                                );
                                                                // Nếu chọn "unpaid", set về null
                                                                if (
                                                                  value ===
                                                                  "unpaid"
                                                                ) {
                                                                  updateEditableInvoiceField(
                                                                    "paymentMethod",
                                                                    null,
                                                                  );
                                                                } else {
                                                                  updateEditableInvoiceField(
                                                                    "paymentMethod",
                                                                    value,
                                                                  );
                                                                }
                                                              }}
                                                            >
                                                              <SelectTrigger className="h-8 w-[180px] text-sm">
                                                                <SelectValue
                                                                  placeholder={t(
                                                                    "common.selectPaymentMethod",
                                                                  )}
                                                                />
                                                              </SelectTrigger>
                                                              <SelectContent>
                                                                {/* Chưa thanh toán option */}
                                                                <SelectItem value="unpaid">
                                                                  {t(
                                                                    "common.unpaid",
                                                                  )}
                                                                </SelectItem>

                                                                {enabledPaymentMethods.map(
                                                                  (
                                                                    method: any,
                                                                  ) => (
                                                                    <SelectItem
                                                                      key={
                                                                        method.id
                                                                      }
                                                                      value={
                                                                        method.nameKey
                                                                      }
                                                                    >
                                                                      {
                                                                        method.icon
                                                                      }{" "}
                                                                      {getPaymentMethodName(
                                                                        method.nameKey,
                                                                      )}
                                                                    </SelectItem>
                                                                  ),
                                                                )}
                                                              </SelectContent>
                                                            </Select>
                                                          ) : (
                                                            <span className="font-bold text-blue-600">
                                                              {(() => {
                                                                const paymentMethod =
                                                                  selectedInvoice.paymentMethod;
                                                                try {
                                                                  if (
                                                                    paymentMethod &&
                                                                    typeof paymentMethod ===
                                                                      "string"
                                                                  ) {
                                                                    const parsed =
                                                                      JSON.parse(
                                                                        paymentMethod,
                                                                      );
                                                                    if (
                                                                      Array.isArray(
                                                                        parsed,
                                                                      ) &&
                                                                      parsed.length >
                                                                        0
                                                                    ) {
                                                                      return t(
                                                                        "common.multiplePaymentMethods",
                                                                      );
                                                                    }
                                                                  }
                                                                } catch (e) {}
                                                                return getPaymentMethodName(
                                                                  selectedInvoice.paymentMethod,
                                                                );
                                                              })()}
                                                            </span>
                                                          )}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              <div>
                                                <label className="block text-sm font-medium mb-2">
                                                  {t("common.notes")}
                                                </label>
                                                {isEditing &&
                                                editableInvoice ? (
                                                  <textarea
                                                    {...form.register("notes")}
                                                    value={
                                                      editableInvoice.notes ||
                                                      ""
                                                    }
                                                    onChange={(e) => {
                                                      updateEditableInvoiceField(
                                                        "notes",
                                                        e.target.value,
                                                      );
                                                      form.setValue(
                                                        "notes",
                                                        e.target.value,
                                                      );
                                                    }}
                                                    className="w-full p-3 border rounded min-h-[80px] resize-none"
                                                    placeholder={t(
                                                      "common.enterNotes",
                                                    )}
                                                    disabled={
                                                      selectedInvoice.displayStatus ===
                                                      1
                                                    }
                                                  />
                                                ) : (
                                                  <div className="p-3 bg-gray-50 rounded border min-h-[80px]">
                                                    {selectedInvoice.notes ||
                                                      t("common.noNotes")}
                                                  </div>
                                                )}
                                              </div>

                                              <div className="flex gap-2 pt-4 border-t">
                                                {!isEditing ? (
                                                  <>
                                                    {/* Nút Hủy đơn: hiển thị khi order.status != 'cancelled' && order.status != 'paid' */}
                                                    {selectedInvoice.status !==
                                                      "cancelled" &&
                                                      selectedInvoice.status !==
                                                        "paid" &&
                                                      storeSettings?.businessType !==
                                                        "laundry" && (
                                                        <Button
                                                          variant="destructive"
                                                          size="sm"
                                                          onClick={() =>
                                                            setShowCancelDialog(
                                                              true,
                                                            )
                                                          }
                                                        >
                                                          <X className="w-4 h-4 mr-2" />
                                                          {t(
                                                            "common.cancelOrder",
                                                          )}
                                                        </Button>
                                                      )}

                                                    {/* Nút Sửa đơn: logic phức tạp dựa vào businessType và isPaid */}
                                                    {(() => {
                                                      const canEdit =
                                                        selectedInvoice.status !==
                                                          "cancelled" &&
                                                        selectedInvoice.status !==
                                                          "paid";
                                                      const isLaundry =
                                                        storeSettings?.businessType ===
                                                        "laundry";
                                                      const canEditLaundry =
                                                        selectedInvoice.status !==
                                                        "cancelled";

                                                      if (isLaundry) {
                                                        // Với laundry: cho phép sửa nếu chưa cancelled và chưa paid
                                                        if (canEditLaundry) {
                                                          return (
                                                            <Button
                                                              onClick={() =>
                                                                handleEditOrder(
                                                                  selectedInvoice,
                                                                )
                                                              }
                                                              size="sm"
                                                            >
                                                              {t(
                                                                "orders.editOrder",
                                                              )}
                                                            </Button>
                                                          );
                                                        }
                                                      } else {
                                                        // Với business khác: chỉ cho sửa khi canEdit
                                                        if (canEdit) {
                                                          return (
                                                            <Button
                                                              onClick={() =>
                                                                handleEditOrder(
                                                                  selectedInvoice,
                                                                )
                                                              }
                                                              size="sm"
                                                            >
                                                              {t(
                                                                "orders.editOrder",
                                                              )}
                                                            </Button>
                                                          );
                                                        }
                                                      }
                                                      return null;
                                                    })()}

                                                    {/* Nút Thanh toán: hiển thị khi order.status != 'cancelled' && order.status != 'paid' */}
                                                    {selectedInvoice.status !==
                                                      "cancelled" &&
                                                      selectedInvoice.status !==
                                                        "paid" && (
                                                        <Button
                                                          onClick={async () => {
                                                            if (
                                                              !selectedInvoice
                                                            ) {
                                                              toast({
                                                                title: "Lỗi",
                                                                description:
                                                                  "Vui lòng chọn đơn hàng",
                                                                variant:
                                                                  "destructive",
                                                              });
                                                              return;
                                                            }

                                                            try {
                                                              // Fetch fresh order items
                                                              const itemsResponse =
                                                                await apiRequest(
                                                                  "GET",
                                                                  `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${selectedInvoice.id}`,
                                                                );
                                                              const items =
                                                                await itemsResponse.json();

                                                              // Prepare order data for payment
                                                              const orderForPayment =
                                                                {
                                                                  ...selectedInvoice,
                                                                  orderItems:
                                                                    items,
                                                                  items:
                                                                    items.map(
                                                                      (
                                                                        item: any,
                                                                      ) => ({
                                                                        id: item.id,
                                                                        productId:
                                                                          item.productId,
                                                                        productName:
                                                                          item.productName,
                                                                        price:
                                                                          item.unitPrice,
                                                                        quantity:
                                                                          item.quantity,
                                                                        total:
                                                                          item.total,
                                                                        discount:
                                                                          item.discount ||
                                                                          "0",
                                                                        sku:
                                                                          item.productSku ||
                                                                          item.sku ||
                                                                          `SKU${item.productId}`,
                                                                        taxRate:
                                                                          parseFloat(
                                                                            item.taxRate ||
                                                                              "0",
                                                                          ),
                                                                      }),
                                                                    ),
                                                                  exactSubtotal:
                                                                    parseFloat(
                                                                      selectedInvoice.subtotal ||
                                                                        "0",
                                                                    ),
                                                                  exactTax:
                                                                    parseFloat(
                                                                      selectedInvoice.tax ||
                                                                        "0",
                                                                    ),
                                                                  exactDiscount:
                                                                    parseFloat(
                                                                      selectedInvoice.discount ||
                                                                        "0",
                                                                    ),
                                                                  exactTotal:
                                                                    parseFloat(
                                                                      selectedInvoice.total ||
                                                                        "0",
                                                                    ),
                                                                };

                                                              // Open payment method modal first
                                                              setOrderForPayment(
                                                                orderForPayment,
                                                              );
                                                              setShowPaymentMethodModal(
                                                                true,
                                                              );
                                                            } catch (error) {
                                                              console.error(
                                                                "  Error preparing payment:",
                                                                error,
                                                              );
                                                              toast({
                                                                title: "Lỗi",
                                                                description:
                                                                  "Không thể tải thông tin đơn hàng",
                                                                variant:
                                                                  "destructive",
                                                              });
                                                            }
                                                          }}
                                                          className="bg-green-600 hover:bg-green-700 text-white"
                                                        >
                                                          <CreditCard className="w-4 h-4 mr-2" />
                                                          {t("common.payment")}
                                                        </Button>
                                                      )}

                                                    {/* Nút Phát hành hóa đơn: hiển thị khi order.status != 'paid' */}
                                                    {selectedInvoice.status ===
                                                      "paid" &&
                                                      selectedInvoice.einvoiceStatus ===
                                                        0 &&
                                                      storeSettings?.businessType !==
                                                        "laundry" && (
                                                        <Button
                                                          onClick={() =>
                                                            setShowEInvoiceModal(
                                                              true,
                                                            )
                                                          }
                                                          variant="outline"
                                                          size="sm"
                                                          className="border-green-500 text-green-600 hover:bg-green-50"
                                                        >
                                                          {t(
                                                            "orders.issueInvoice",
                                                          )}
                                                        </Button>
                                                      )}

                                                    {/* Nút In hóa đơn: hiển thị khi order.status != 'paid' */}
                                                    {selectedInvoice.status !==
                                                      "cancelled" && (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                          setSelectedReceipt({
                                                            ...selectedInvoice,
                                                            items: orderItems,
                                                          });
                                                          setIsTitle(
                                                            selectedInvoice.status ===
                                                              "paid"
                                                              ? true
                                                              : false,
                                                          );
                                                          setShowReceiptModal(
                                                            true,
                                                          );
                                                        }}
                                                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                                                      >
                                                        <Printer className="w-4 h-4 mr-2" />
                                                        {t("common.print")}
                                                      </Button>
                                                    )}

                                                    {/* Nút Đóng: luôn hiển thị */}
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() =>
                                                        setSelectedInvoice(null)
                                                      }
                                                    >
                                                      {t("common.close")}
                                                    </Button>
                                                  </>
                                                ) : (
                                                  <>
                                                    {/* Chế độ editing: chỉ hiển thị Lưu và Hủy */}
                                                    {(() => {
                                                      const isLaundry =
                                                        storeSettings?.businessType ===
                                                        "laundry";
                                                      const isPaidOrder =
                                                        selectedInvoice.status ===
                                                        "paid";

                                                      // Nếu là laundry và đơn đã paid, chỉ cho phép sửa isPaid
                                                      if (
                                                        isLaundry &&
                                                        isPaidOrder
                                                      ) {
                                                        return (
                                                          <>
                                                            <Button
                                                              onClick={
                                                                handleSaveOrder
                                                              }
                                                              size="sm"
                                                              disabled={
                                                                updateOrderMutation.isPending
                                                              }
                                                            >
                                                              {updateOrderMutation.isPending
                                                                ? t(
                                                                    "common.saving",
                                                                  )
                                                                : t(
                                                                    "common.save",
                                                                  )}
                                                            </Button>
                                                            <Button
                                                              onClick={
                                                                handleCancelEdit
                                                              }
                                                              variant="outline"
                                                              size="sm"
                                                            >
                                                              {t(
                                                                "common.cancel",
                                                              )}
                                                            </Button>
                                                          </>
                                                        );
                                                      }

                                                      // Trường hợp bình thường: hiển thị Lưu và Hủy
                                                      return (
                                                        <>
                                                          <Button
                                                            onClick={
                                                              handleSaveOrder
                                                            }
                                                            size="sm"
                                                            disabled={
                                                              updateOrderMutation.isPending
                                                            }
                                                          >
                                                            {updateOrderMutation.isPending
                                                              ? t(
                                                                  "common.saving",
                                                                )
                                                              : t(
                                                                  "common.save",
                                                                )}
                                                          </Button>
                                                          <Button
                                                            onClick={
                                                              handleCancelEdit
                                                            }
                                                            variant="outline"
                                                            size="sm"
                                                          >
                                                            {t("common.cancel")}
                                                          </Button>
                                                        </>
                                                      );
                                                    })()}
                                                  </>
                                                )}
                                              </div>
                                            </CardContent>
                                          </Card>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                              </>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination Controls */}
                  {ordersResponse?.pagination &&
                    ordersResponse.pagination.totalCount > 0 && (
                      <div className="flex items-center justify-between space-x-6 py-4">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium">
                            {t("common.show")}
                          </p>
                          <Select
                            value={itemsPerPage.toString()}
                            onValueChange={(value) => {
                              setItemsPerPage(Number(value));
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 w-[70px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="top">
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="30">30</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-sm font-medium">
                            {t("common.rows")}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-muted-foreground">
                            {t("common.showing")}{" "}
                            {(currentPage - 1) * itemsPerPage + 1} -{" "}
                            {Math.min(
                              currentPage * itemsPerPage,
                              ordersResponse.pagination.totalCount,
                            )}{" "}
                            {t("common.of")}{" "}
                            {ordersResponse.pagination.totalCount}
                          </p>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setCurrentPage(1)}
                              disabled={!ordersResponse.pagination.hasPrev}
                              className="h-8 w-8"
                            >
                              «
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                setCurrentPage((prev) => Math.max(prev - 1, 1))
                              }
                              disabled={!ordersResponse.pagination.hasPrev}
                              className="h-8 w-8"
                            >
                              ‹
                            </Button>
                            <div className="flex items-center gap-1 px-2">
                              <span className="text-sm font-medium">
                                {currentPage}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                /
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {ordersResponse.pagination.totalPages}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                setCurrentPage((prev) =>
                                  Math.min(
                                    prev + 1,
                                    ordersResponse.pagination.totalPages,
                                  ),
                                )
                              }
                              disabled={!ordersResponse.pagination.hasNext}
                              className="h-8 w-8"
                            >
                              ›
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                setCurrentPage(
                                  ordersResponse.pagination.totalPages,
                                )
                              }
                              disabled={!ordersResponse.pagination.hasNext}
                              className="h-8 w-8"
                            >
                              »
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                  <div className="mt-4 border-t bg-blue-50 p-3 rounded text-center">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">
                          {t("common.subtotalAmount")}:
                        </span>
                        <div className="font-bold text-blue-600">
                          {formatCurrency(totals.subtotal)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">
                          {t("common.discount")}:
                        </span>
                        <div className="font-bold text-red-600">
                          -{formatCurrency(totals.discount || 0)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">
                          {t("common.totalTax")}:
                        </span>
                        <div className="font-bold text-orange-600">
                          {formatCurrency(totals.tax)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">
                          {t("common.grandTotal")}:
                        </span>
                        <div className="font-bold text-green-600">
                          {formatCurrency(totals.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Bulk Cancel Confirmation Dialog */}
      <AlertDialog
        open={showBulkCancelDialog}
        onOpenChange={setShowBulkCancelDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmBulkCancel")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.confirmBulkCancelMessage", {
                count: selectedOrderIds.size,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedOrderIds.size > 0) {
                  bulkCancelOrdersMutation.mutate(
                    Array.from(selectedOrderIds).map((id) => id.split("-")[1]),
                  ); // Extract order IDs
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkCancelOrdersMutation.isPending
                ? t("common.cancelling")
                : t("common.cancelSelected", { count: selectedOrderIds.size })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common.confirmCancelOrder")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.confirmCancelOrderMessage", {
                orderNumber: selectedInvoice?.displayNumber,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedInvoice) {
                  console.log("Cancelling order:", selectedInvoice.id);
                  cancelOrderMutation.mutate(selectedInvoice.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelOrderMutation.isPending
                ? t("common.cancelling")
                : t("common.confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Method Modal - STEP 2 */}
      {showPaymentMethodModal && orderForPayment && (
        <PaymentMethodModal
          isOpen={showPaymentMethodModal}
          onClose={() => {
            console.log("💳 Closing payment modal from sales-orders");
            setShowPaymentMethodModal(false);
            setOrderForPayment(null);

            // Refresh data after closing
            // queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
          }}
          onSelectMethod={handlePaymentComplete}
          total={
            orderForPayment.exactTotal ||
            parseFloat(orderForPayment.total || "0")
          }
          cartItems={orderForPayment.items || []}
          orderForPayment={orderForPayment}
          products={products}
          getProductName={(productId) => {
            const product = products.find((p: any) => p.id === productId);
            return product?.name || `Product #${productId}`;
          }}
          receipt={{
            exactSubtotal: orderForPayment.exactSubtotal,
            exactTax: orderForPayment.exactTax,
            exactDiscount: orderForPayment.exactDiscount,
            exactTotal: orderForPayment.exactTotal,
            subtotal: orderForPayment.subtotal,
            tax: orderForPayment.tax,
            discount: orderForPayment.discount,
            total: orderForPayment.total,
          }}
        />
      )}

      {/* E-Invoice Modal */}
      {showEInvoiceModal && selectedInvoice && (
        <EInvoiceModal
          isOpen={showEInvoiceModal}
          onClose={() => setShowEInvoiceModal(false)}
          order={{
            id: selectedInvoice.id,
            orderNumber:
              selectedInvoice.orderNumber || selectedInvoice.displayNumber,
            customerName: selectedInvoice.customerName || "",
            customerTaxCode: selectedInvoice.customerTaxCode || "",
            customerAddress: selectedInvoice.customerAddress || "",
            customerPhone: selectedInvoice.customerPhone || "",
            customerEmail: selectedInvoice.customerEmail || "",
            subtotal: selectedInvoice.subtotal,
            tax: selectedInvoice.tax,
            total: selectedInvoice.total,
            paymentMethod: selectedInvoice.paymentMethod || 1,
          }}
          items={orderItems || []}
        />
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedReceipt && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            console.log("🔒 Sales Orders: Receipt modal closed by user");

            // Dispatch intentional close event
            window.dispatchEvent(
              new CustomEvent("receiptModalClosed", {
                detail: {
                  intentionalClose: true,
                  source: "sales_orders_receipt_close",
                },
              }),
            );

            setShowReceiptModal(false);
            setSelectedReceipt(null);

            queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/list"] });
          }}
          receipt={selectedReceipt}
          isPreview={false}
          isTitle={isTitle}
        />
      )}
    </div>
  );
}
