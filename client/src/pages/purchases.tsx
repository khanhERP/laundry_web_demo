import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { POSHeader } from "@/components/pos/header";
import { RightSidebar } from "@/components/ui/right-sidebar";
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
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  BarChart3,
  Calendar,
  User,
  DollarSign,
  Eye,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { PurchaseOrder, Supplier } from "@shared/schema";

interface PurchasesPageProps {
  onLogout: () => void;
}

export default function PurchasesPage({ onLogout }: PurchasesPageProps) {
  const { t, currentLanguage } = useTranslation();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [poNumberFilter, setPoNumberFilter] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // State for selected purchase orders
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());

  // State for delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch purchase receipts with filters
  const {
    data: purchaseReceiptsResponse = { data: [] },
    isLoading: isOrdersLoading,
  } = useQuery<{ data: PurchaseOrder[]; success: boolean; message: string }>({
    queryKey: [
      "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts",
      {
        startDate,
        endDate,
        productFilter,
        searchTerm,
        supplierFilter,
        poNumberFilter,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (startDate) {
        params.append("startDate", startDate);
      }
      if (endDate) {
        params.append("endDate", endDate);
      }

      // Add supplier filter as separate parameter (priority over search)
      if (supplierFilter && supplierFilter.trim() !== "") {
        params.append("supplierName", supplierFilter.trim());
        console.log("🔍 Adding supplier filter:", supplierFilter.trim());
      }

      // Add PO number filter as search parameter
      if (poNumberFilter && poNumberFilter.trim() !== "") {
        params.append("search", poNumberFilter.trim());
        console.log("🔍 Adding PO number search:", poNumberFilter.trim());
      }

      const url = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts${params.toString() ? `?${params.toString()}` : ""}`;
      console.log("🔍 Fetching purchase receipts with filters:", url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch purchase receipts");
      }

      const responseData = await response.json();
      console.log("📦 Purchase receipts response:", responseData);

      // The API returns { success: true, message: "OK", data: [] }
      if (
        responseData.success &&
        responseData.data &&
        Array.isArray(responseData.data)
      ) {
        return responseData;
      } else if (Array.isArray(responseData)) {
        return { data: responseData, success: true, message: "OK" };
      } else {
        console.warn("Unexpected response structure:", responseData);
        return { data: [], success: false, message: "Invalid response" };
      }
    },
    staleTime: 0, // Always consider data stale to ensure fresh data
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnMount: true, // Always refetch when component mounts
  });

  // Extract the array from the response
  const purchaseOrders = purchaseReceiptsResponse?.data || [];

  // Fetch suppliers for filtering
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers"],
  });

  // Fetch payment methods
  const { data: paymentMethodsData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"],
    queryFn: async () => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods");
      return response.json();
    },
  });

  // Calculate dashboard statistics
  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Filter orders from current month
    const thisMonthOrders = purchaseOrders.filter((order) => {
      const orderDate = new Date(order.orderDate);
      return (
        orderDate.getMonth() === currentMonth &&
        orderDate.getFullYear() === currentYear
      );
    });

    const pending = purchaseOrders.filter(
      (order) => order.status === "pending",
    ).length;
    const completed = purchaseOrders.filter(
      (order) => order.status === "received",
    ).length;
    const totalValue = purchaseOrders.reduce(
      (sum, order) => sum + parseFloat(order.total || "0"),
      0,
    );

    return {
      totalOrders: thisMonthOrders.length, // Now correctly shows this month's orders
      pendingOrders: pending,
      completedOrders: completed,
      totalValue: totalValue,
    };
  }, [purchaseOrders]);

  // Use server-filtered orders directly
  const filteredOrders = purchaseOrders;

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      confirmed: "bg-blue-100 text-blue-800 border-blue-300",
      partially_received: "bg-purple-100 text-purple-800 border-purple-300",
      received: "bg-green-100 text-green-800 border-green-300",
      cancelled: "bg-red-100 text-red-800 border-red-300",
    };
    return variants[status as keyof typeof variants] || variants.pending;
  };

  const formatCurrency = (amount: string) => {
    // Get locale from current language setting
    const locale =
      {
        ko: "ko-KR",
        en: "en-US",
        vi: "vi-VN",
      }[currentLanguage] || "en-US";

    // Format as decimal number without currency symbol
    return new Intl.NumberFormat(locale).format(parseFloat(amount || "0"));
  };

  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier?.name || t("purchases.unknownSupplier");
  };

  // Handle individual order selection
  const handleSelectOrder = (orderId: number, checked: boolean) => {
    setSelectedOrders((prev) => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(orderId);
      } else {
        newSelected.delete(orderId);
      }
      return newSelected;
    });
  };

  // Handle select all functionality
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allOrderIds = new Set(filteredOrders.map((order) => order.id));
      setSelectedOrders(allOrderIds);
    } else {
      setSelectedOrders(new Set());
    }
  };

  // Check if all orders are selected
  const isAllSelected =
    filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length;
  const isIndeterminate =
    selectedOrders.size > 0 && selectedOrders.size < filteredOrders.length;

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      return apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/bulk-delete", {
        orderIds,
      });
    },
    onSuccess: (data) => {
      console.log("✅ Bulk delete successful:", data);

      toast({
        title: t("purchases.deleteSuccess"),
        description: `${data.deletedCount} ${t("purchases.deleteSuccess")}`,
        variant: "default",
      });

      // Clear selected orders
      setSelectedOrders(new Set());

      // Refetch purchase receipts
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts"] });

      // Close dialog
      setShowDeleteDialog(false);
    },
    onError: (error: any) => {
      console.error("❌ Bulk delete failed:", error);

      toast({
        title: t("purchases.deleteFailed"),
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });

      // Close dialog
      setShowDeleteDialog(false);
    },
  });

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedOrders.size === 0) return;

    const orderIds = Array.from(selectedOrders);
    console.log("🗑️ Starting bulk delete for orders:", orderIds);

    bulkDeleteMutation.mutate(orderIds);
  };

  return (
    <div className="min-h-screen bg-green-50 grocery-bg">
      {/* Header */}
      <POSHeader />

      {/* Right Sidebar */}
      <RightSidebar />

      <div className="main-content pt-16 px-6">
        <div className="mx-auto py-8" style={{ maxWidth: "95rem" }}>
          {/* Page Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <ClipboardCheck className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
                {t("purchases.purchaseReceiptsList")}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              {t("purchases.dashboard")}
            </p>
          </div>

          {/* Action Buttons - Removed, moved below filters */}

          {/* Action Bar with Search and Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                {/* Desktop: 4 columns, Tablet: 2 columns, Mobile: 1 column */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
                  {/* From Date */}
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1 font-bold">
                      {t("common.fromDate")}
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-sm"
                      data-testid="input-start-date"
                    />
                  </div>

                  {/* To Date */}
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1 font-bold">
                      {t("common.toDate")}
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-sm"
                      data-testid="input-end-date"
                    />
                  </div>

                  {/* Supplier Filter */}
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1 font-bold">
                      {t("purchases.supplier")}
                    </label>
                    <Input
                      placeholder={t("purchases.supplierFilterPlaceholder")}
                      value={supplierFilter}
                      onChange={(e) => setSupplierFilter(e.target.value)}
                      className="w-full text-sm"
                      data-testid="input-search-supplier"
                    />
                  </div>

                  {/* PO Number Filter */}
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1 font-bold">
                      {t("purchases.receiptNumber")}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder={t("purchases.receiptNumberPlaceholder")}
                        value={poNumberFilter}
                        onChange={(e) => setPoNumberFilter(e.target.value)}
                        className="pl-10 w-full text-sm"
                        data-testid="input-search-po-number"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons - Responsive layout */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 mb-6">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={
                selectedOrders.size === 0 || bulkDeleteMutation.isPending
              }
              className="font-semibold px-4 sm:px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-200 text-sm"
              data-testid="button-delete-selected"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              <span className="hidden sm:inline">
                {t("purchases.deleteSelected")}
              </span>
              <span className="sm:hidden">Xóa</span>
              <span className="ml-1">({selectedOrders.size})</span>
            </Button>

            <Button
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 sm:px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-200 text-sm"
              onClick={() => navigate("/purchases/create")}
              data-testid="button-create-purchase-order"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              <span className="hidden sm:inline">
                {t("purchases.createNewPurchaseOrder")}
              </span>
              <span className="sm:hidden">Tạo mới</span>
            </Button>
          </div>

          {/* Purchase Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t("purchases.purchaseReceipts")}</CardTitle>
              <CardDescription>
                {filteredOrders.length > 0
                  ? `${filteredOrders.length} ${t("purchases.ordersFound")}`
                  : t("purchases.overview")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isOrdersLoading ? (
                <div className="text-center py-12">
                  <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-pulse" />
                  <p className="text-gray-500">
                    {t("purchases.loadingOrders")}
                  </p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-8 sm:py-12 px-4">
                  <ClipboardCheck className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
                    {purchaseOrders.length === 0
                      ? t("purchases.noOrders")
                      : t("purchases.noOrdersFound")}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6 max-w-md mx-auto">
                    {purchaseOrders.length === 0
                      ? t("purchases.createFirstOrder")
                      : t("purchases.tryDifferentFilters")}
                  </p>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 sm:px-6 py-2 sm:py-3 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
                    onClick={() => navigate("/purchases/create")}
                    data-testid="button-create-first-order"
                    size="lg"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    <span className="hidden sm:inline">{t("purchases.createNewPurchaseOrder")}</span>
                    <span className="sm:hidden">{t("purchases.createOrder")}</span>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-bold w-12 sticky left-0 bg-white z-10">
                          <Checkbox
                            checked={isAllSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isIndeterminate;
                            }}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="font-bold min-w-[120px] sticky left-12 bg-white z-10 text-xs sm:text-sm">
                          {t("purchases.receiptNumber")}
                        </TableHead>
                        <TableHead className="font-bold min-w-[100px] text-xs sm:text-sm">
                          {t("purchases.purchaseDate")}
                        </TableHead>
                        <TableHead className="font-bold min-w-[150px] text-xs sm:text-sm">
                          {t("purchases.supplier")}
                        </TableHead>
                        <TableHead className="font-bold min-w-[100px] text-right text-xs sm:text-sm">
                          {t("purchases.subtotalAmount")}
                        </TableHead>
                        <TableHead className="font-bold min-w-[100px] text-right text-xs sm:text-sm">
                          {t("purchases.discountAmount")}
                        </TableHead>
                        <TableHead className="font-bold min-w-[100px] text-right text-xs sm:text-sm">
                          {t("purchases.totalAmount")}
                        </TableHead>
                        <TableHead className="font-bold min-w-[150px] text-xs sm:text-sm">
                          Ghi chú
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => {
                        // Calculate values from items if available
                        let calculatedSubtotal = 0;
                        let calculatedDiscount = 0;

                        if (order.items && order.items.length > 0) {
                          order.items.forEach((item) => {
                            const quantity = parseFloat(item.quantity || "0");
                            const unitPrice = parseFloat(item.unitPrice || "0");
                            const itemSubtotal = quantity * unitPrice;

                            calculatedSubtotal += itemSubtotal;

                            // Get discount from item
                            const discount =
                              item.discount ||
                              item.discountAmount ||
                              item.discount_amount ||
                              0;
                            const discountValue =
                              typeof discount === "string"
                                ? parseFloat(discount)
                                : discount;
                            calculatedDiscount += isNaN(discountValue)
                              ? 0
                              : discountValue;
                          });
                        }

                        // Use calculated values if items exist, otherwise use order totals
                        const displaySubtotal =
                          calculatedSubtotal > 0
                            ? calculatedSubtotal
                            : parseFloat(order.subtotal || order.total || "0");
                        const displayDiscount = calculatedDiscount;
                        const displayTotal = displaySubtotal - displayDiscount;

                        return (
                          <TableRow
                            key={order.id}
                            data-testid={`row-purchase-order-${order.id}`}
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={(e) => {
                              // Don't navigate if clicking on checkbox or button elements
                              const target = e.target as HTMLElement;
                              if (
                                target.type === "checkbox" ||
                                target.closest('input[type="checkbox"]') ||
                                target.closest("button")
                              )
                                return;
                              navigate(`/purchases/view/${order.id}`);
                            }}
                          >
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                              className="sticky left-0 bg-white z-10"
                            >
                              <Checkbox
                                checked={selectedOrders.has(order.id)}
                                onCheckedChange={(checked) =>
                                  handleSelectOrder(
                                    order.id,
                                    checked as boolean,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium sticky left-12 bg-white z-10 text-xs sm:text-sm">
                              <div
                                className="max-w-[100px] truncate"
                                title={
                                  order.receiptNumber ||
                                  order.poNumber ||
                                  order.receipt_number ||
                                  "-"
                                }
                              >
                                {order.receiptNumber ||
                                  order.poNumber ||
                                  order.receipt_number ||
                                  "-"}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              <div className="flex items-center gap-1 sm:gap-2">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                                <span className="text-xs sm:text-sm">
                                  {(() => {
                                    // Try multiple possible date fields for purchase receipts
                                    const date =
                                      order.purchaseDate ||
                                      order.actualDeliveryDate ||
                                      order.createdAt ||
                                      order.created_at;
                                    if (date) {
                                      try {
                                        return new Date(
                                          date,
                                        ).toLocaleDateString(
                                          {
                                            ko: "ko-KR",
                                            en: "en-US",
                                            vi: "vi-VN",
                                          }[currentLanguage] || "en-US",
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Date parsing error:",
                                          error,
                                        );
                                        return "-";
                                      }
                                    }
                                    return "-";
                                  })()}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              <div className="flex items-center gap-1 sm:gap-2">
                                <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                                <span
                                  className="max-w-[120px] truncate"
                                  title={
                                    order.supplier?.name ||
                                    getSupplierName(order.supplierId)
                                  }
                                >
                                  {order.supplier?.name ||
                                    getSupplierName(order.supplierId)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              <span className="font-medium">
                                {formatCurrency(displaySubtotal.toString())}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              <span className="font-medium text-red-600">
                                {formatCurrency(
                                  Math.round(displayDiscount).toString(),
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              <span className="font-bold text-green-600">
                                {formatCurrency(
                                  Math.round(displayTotal).toString(),
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              <div
                                className="max-w-[150px] truncate"
                                title={order.notes || ""}
                              >
                                {order.notes || "-"}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("purchases.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.areYouSure")} {selectedOrders.size}{" "}
              {t("purchases.confirmDeleteMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowDeleteDialog(false)}
              disabled={bulkDeleteMutation.isPending}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkDeleteMutation.isPending
                ? t("common.deleting")
                : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
