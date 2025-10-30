import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Clock,
  Target,
  Search,
  RefreshCw,
} from "lucide-react";
import type { Order, Table as TableType } from "@shared/schema";
import { useTranslation } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

export function formatDateToYYYYMMDD(date: Date | string | number): string {
  const d = new Date(date); // Ensure input is a Date
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  paymentMethod: number;
  invoiceDate: string;
  status: string;
  einvoiceStatus: number;
  invoiceStatus: number;
  notes: string;
  createdAt: string;
}

export function DashboardOverview() {
  const { t, currentLanguage } = useTranslation();

  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const queryClient = useQueryClient();

  // Query orders by date range - using proper order data
  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
  } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/date-range", startDate, endDate, "all"],
    queryFn: async () => {
      try {
        const response = await fetch(
          `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/date-range/${startDate}/${endDate}/all`,
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Dashboard - Orders loaded:", data?.length || 0);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Dashboard - Error fetching orders:", error);
        return [];
      }
    },
    retry: 3,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
  });

  // Query order items for all orders
  const { data: orderItems = [], isLoading: orderItemsLoading } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Dashboard - Order items loaded:", data?.length || 0);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Dashboard - Error fetching order items:", error);
        return [];
      }
    },
    retry: 3,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tables } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"],
  });

  const handleRefresh = () => {
    // Refresh the queries to get the latest data for the selected date
    setStartDate(formatDateToYYYYMMDD(new Date()));
    setEndDate(formatDateToYYYYMMDD(new Date()));
    queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
    queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/date-range"] });
    queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items"] });
    queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"] });
  };

  const getDashboardStats = () => {
    try {
      // Add proper loading and error checks
      if (ordersLoading || orderItemsLoading) {
        return {
          totalSalesRevenue: 0,
          subtotalRevenue: 0,
          periodOrderCount: 0,
          periodCustomerCount: 0,
          dailyAverageRevenue: 0,
          activeOrders: 0,
          occupiedTables: 0,
          monthRevenue: 0,
          averageOrderValue: 0,
          peakHour: 12,
          totalTables: Array.isArray(tables) ? tables.length : 0,
        };
      }

      // Ensure we have valid arrays
      const validOrders = Array.isArray(orders) ? orders : [];
      const validOrderItems = Array.isArray(orderItems) ? orderItems : [];
      const validTables = Array.isArray(tables) ? tables : [];

      console.log("Dashboard Debug - Raw Orders Data:", {
        totalOrders: validOrders.length,
        startDate,
        endDate,
        sampleOrders: validOrders.slice(0, 3).map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          total: o.total,
          orderedAt: o.orderedAt,
        })),
      });

      // Filter completed/paid orders only - data is already filtered by date range from API
      const completedOrders = validOrders.filter(
        (order: any) => order.status === "paid" || order.status === "completed",
      );

      console.log("Dashboard Debug - Raw Data:", {
        totalOrders: validOrders.length,
        completedOrders: completedOrders.length,
        totalOrderItems: validOrderItems.length,
        dateRange: `${startDate} to ${endDate}`,
        sampleCompletedOrder: completedOrders[0]
          ? {
              id: completedOrders[0].id,
              total: completedOrders[0].total,
              subtotal: completedOrders[0].subtotal,
              status: completedOrders[0].status,
              createdAt: completedOrders[0].createdAt,
            }
          : null,
      });

      // Calculate total revenue from completed orders (subtotal + tax = revenue after discount)
      const totalSalesRevenue = completedOrders.reduce(
        (sum: number, order: any) => {
          // Revenue = Subtotal (đã trừ giảm giá) + Tax
          const subtotal = Number(order.subtotal || 0); // Thành tiền sau khi trừ giảm giá
          const tax = Number(order.tax || 0); // Thuế
          const revenue = subtotal + tax; // Doanh thu thực tế
          console.log(
            `Processing order ${order.orderNumber}: subtotal=${subtotal}, tax=${tax}, revenue=${revenue}, originalTotal=${order.total}`,
          );
          return sum + revenue;
        },
        0,
      );

      // Calculate subtotal revenue from completed orders (excludes tax, after discount)
      const subtotalRevenue = completedOrders.reduce(
        (total: number, order: any) => {
          const subtotal = Number(order.subtotal || 0); // Subtotal đã là giá trị sau khi trừ discount
          return total + subtotal;
        },
        0,
      );

      // Total count from completed orders only
      const periodOrderCount = completedOrders.length;

      // Calculate total customer count by summing customer_count from completed orders
      const periodCustomerCount = completedOrders.reduce(
        (total: number, order: any) => {
          const customerCount = Number(order.customerCount || 1); // Default to 1 if not specified
          console.log(
            `Processing order ${order.orderNumber}: customerCount=${customerCount}`,
          );
          return total + customerCount;
        },
        0,
      );

      // Calculate days difference for average
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
          1,
      );
      const dailyAverageRevenue = totalSalesRevenue / daysDiff;

      // Active orders (pending/in-progress orders only from all current orders, not date-filtered)
      const activeOrders = Array.isArray(allCurrentOrders)
        ? allCurrentOrders.filter(
            (order: any) =>
              order.status === "pending" ||
              order.status === "confirmed" ||
              order.status === "preparing" ||
              order.status === "ready" ||
              order.status === "served",
          ).length
        : 0;

      const occupiedTables = validTables.filter(
        (table: TableType) => table.status === "occupied",
      );

      // Month revenue: same as period revenue for the selected date range
      const monthRevenue = totalSalesRevenue;

      // Average order value
      const averageOrderValue =
        periodOrderCount > 0 ? totalSalesRevenue / periodOrderCount : 0;

      // Peak hours analysis from completed orders only
      const hourlyOrders: { [key: number]: number } = {};

      completedOrders.forEach((order: any) => {
        // Use orderedAt if available, otherwise fall back to createdAt
        const orderDate = new Date(order.orderedAt || order.createdAt);
        if (!isNaN(orderDate.getTime())) {
          const hour = orderDate.getHours();
          hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1;
        }
      });

      const peakHour = Object.keys(hourlyOrders).reduce(
        (peak, hour) =>
          hourlyOrders[parseInt(hour)] > (hourlyOrders[parseInt(peak)] || 0)
            ? hour
            : peak,
        "12",
      );

      const finalStats = {
        totalSalesRevenue,
        subtotalRevenue,
        periodOrderCount,
        periodCustomerCount,
        dailyAverageRevenue,
        activeOrders,
        occupiedTables: occupiedTables.length,
        monthRevenue,
        averageOrderValue,
        peakHour: parseInt(peakHour),
        totalTables: validTables.length,
      };

      console.log("Dashboard Debug - Final Stats:", {
        totalSalesRevenue,
        subtotalRevenue,
        periodOrderCount,
        periodCustomerCount,
        dailyAverageRevenue,
        activeOrders,
        dateRange: `${startDate} to ${endDate}`,
        completedOrdersCount: completedOrders.length,
        totalOrdersInRange: validOrders.length,
      });

      return finalStats;
    } catch (error) {
      console.error("Error in getDashboardStats:", error);
      return {
        totalSalesRevenue: 0,
        subtotalRevenue: 0,
        periodOrderCount: 0,
        periodCustomerCount: 0,
        dailyAverageRevenue: 0,
        activeOrders: 0,
        occupiedTables: 0,
        monthRevenue: 0,
        averageOrderValue: 0,
        peakHour: 12,
        totalTables: 0,
      };
    }
  };

  // Get all current orders to check active ones (not date-filtered)
  const { data: allCurrentOrders = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (error) {
        return [];
      }
    },
  });

  const stats = getDashboardStats();

  const formatCurrency = (amount: number) => {
    try {
      return `${(amount || 0).toLocaleString()} ₫`;
    } catch (error) {
      console.error("Error formatting currency:", error);
      return "0 ₫";
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      // Map translation language codes to locale codes
      const localeMap = {
        ko: "ko-KR",
        en: "en-US",
        vi: "vi-VN",
      };

      const locale = localeMap[currentLanguage] || "ko-KR";

      return new Date(dateStr).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateStr || "";
    }
  };

  // Show loading state
  if (ordersLoading || orderItemsLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-gray-500">{t("reports.loading")}</div>
      </div>
    );
  }

  // Show error state
  if (ordersError) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-red-500">
          Lỗi tải dữ liệu báo cáo: {ordersError?.message || "Unknown error"}
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="ml-4"
          >
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-gray-500">{t("reports.loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                {t("reports.dashboardTab")}
              </CardTitle>
              <CardDescription>
                {t("reports.dashboardDescription")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="start-date-picker">
                {t("reports.startDate")}:
              </Label>
              <Input
                id="start-date-picker"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-auto"
              />
              <Label htmlFor="end-date-picker">{t("reports.endDate")}:</Label>
              <Input
                id="end-date-picker"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("reports.totalRevenue")}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.totalSalesRevenue)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {startDate} ~ {endDate}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("reports.salesReportTotalRevenue")}
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(stats.subtotalRevenue)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {startDate === endDate
                    ? formatDate(startDate)
                    : `${formatDate(startDate)} - ${formatDate(endDate)}`}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("reports.totalOrders")}
                </p>
                <p className="text-2xl font-bold">{stats.periodOrderCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t("reports.averageOrderValue")}{" "}
                  {formatCurrency(stats.averageOrderValue)}
                </p>
              </div>
              <ShoppingCart className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("reports.totalCustomers")}
                </p>
                <p className="text-2xl font-bold">
                  {stats.periodCustomerCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t("reports.peakHour")} {stats.peakHour}{" "}
                  <span>{t("reports.hour")}</span>
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t("reports.realTimeStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">
                {t("reports.occupiedTables")}
              </span>
              <Badge
                variant={stats.occupiedTables > 0 ? "destructive" : "outline"}
              >
                {stats.occupiedTables} / {stats.totalTables}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">
                {t("reports.tableUtilization")}
              </span>
              <Badge variant="secondary">
                {stats.totalTables > 0
                  ? Math.round((stats.occupiedTables / stats.totalTables) * 100)
                  : 0}{" "}
                %
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
