import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  Package,
  DollarSign,
  Search,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useTranslation } from "@/lib/i18n";

interface Product {
  id: number;
  name: string;
  sku: string;
  price: string;
  stock: number;
  categoryId: number;
  categoryName?: string;
  productType: number;
  taxRate: string;
  isActive: boolean;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface MenuAnalysisData {
  totalRevenue: number;
  totalQuantity: number;
  categoryStats: Array<{
    categoryId: number;
    categoryName: string;
    totalQuantity: number;
    totalRevenue: number;
    productCount: number;
  }>;
  productStats: Array<{
    productId: number;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
    averagePrice: number;
  }>;
  topSellingProducts: Array<{
    productId: number;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  topRevenueProducts: Array<{
    productId: number;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
}

function MenuReport() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [productType, setProductType] = useState<string>("all");
  const [productSearch, setProductSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [productSearch]);

  // Query categories
  const { data: categories = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories");
        if (!response.ok) throw new Error("Failed to fetch categories");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching categories:", error);
        return [];
      }
    },
    retry: 2,
  });

  // Query products - filter by search term
  const { data: products = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products", selectedCategory, productType, productSearch],
    queryFn: async () => {
      try {
        const searchParam = productSearch
          ? encodeURIComponent(productSearch)
          : "";
        const response = await apiRequest(
          "GET",
          `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products/${selectedCategory}/${productType}/${searchParam}`,
        );
        if (!response.ok) throw new Error("Failed to fetch products");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching products:", error);
        return [];
      }
    },
    retry: 2,
    enabled: true, // Always enabled to reload when productSearch changes
  });

  // Query menu analysis data
  const {
    data: menuAnalysis,
    isLoading: analysisLoading,
    error: analysisError,
    refetch,
  } = useQuery({
    queryKey: [
      "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/menu-analysis",
      startDate,
      endDate,
      selectedCategory,
      productSearch,
    ],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          startDate,
          endDate,
          ...(selectedCategory !== "all" && { categoryId: selectedCategory }),
          ...(productSearch &&
            productSearch.trim() !== "" && { search: productSearch.trim() }),
        });

        const response = await apiRequest(
          "GET",
          `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/menu-analysis?${params.toString()}`,
        );
        if (!response.ok) {
          console.error(
            "Menu analysis API error:",
            response.status,
            response.statusText,
          );
          throw new Error(`Failed to fetch menu analysis: ${response.status}`);
        }

        const data = await response.json();
        console.log("Menu analysis data received:", data);

        // Ensure data structure is correct
        return {
          totalRevenue: Number(data.totalRevenue || 0),
          totalQuantity: Number(data.totalQuantity || 0),
          categoryStats: Array.isArray(data.categoryStats)
            ? data.categoryStats
            : [],
          productStats: Array.isArray(data.productStats)
            ? data.productStats
            : [],
          topSellingProducts: Array.isArray(data.topSellingProducts)
            ? data.topSellingProducts
            : [],
          topRevenueProducts: Array.isArray(data.topRevenueProducts)
            ? data.topRevenueProducts
            : [],
        } as MenuAnalysisData;
      } catch (error) {
        console.error("Error fetching menu analysis:", error);
        // Return fallback data structure
        return {
          totalRevenue: 0,
          totalQuantity: 0,
          categoryStats: [],
          productStats: [],
          topSellingProducts: [],
          topRevenueProducts: [],
        } as MenuAnalysisData;
      }
    },
    retry: 2,
    retryDelay: 1000,
  });

  // Filter products for display
  const filteredProducts = products.filter((product: Product) => {
    if (!product || !product.name) return false;

    const searchMatch =
      !productSearch ||
      product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (product.sku &&
        product.sku.toLowerCase().includes(productSearch.toLowerCase()));

    const categoryMatch =
      selectedCategory === "all" ||
      product.categoryId === parseInt(selectedCategory);

    const typeMatch =
      productType === "all" ||
      (productType === "combo" && product.productType === 3) ||
      (productType === "product" && product.productType === 1) ||
      (productType === "service" && product.productType === 2);

    return searchMatch && categoryMatch && typeMatch;
  });

  const formatCurrency = (
    amount: number | string | undefined | null,
  ): string => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (typeof num !== "number" || isNaN(num)) {
      return "0";
    }
    return Math.floor(num).toLocaleString("vi-VN");
  };

  const getProductTypeName = (type: number): string => {
    switch (type) {
      case 1:
        return t("reports.product") || "Sản phẩm";
      case 2:
        return t("reports.service") || "Dịch vụ";
      case 3:
        return t("reports.combo") || "Combo";
      default:
        return t("reports.product") || "Sản phẩm";
    }
  };

  const handleRefresh = () => {
    // Refresh both orders and order items data
    queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/date-range"] });
    queryClient.invalidateQueries({
      queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/date-range"],
    });
  };

  if (analysisError) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">
            <BarChart3 className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">Lỗi tải dữ liệu phân tích menu</p>
          </div>
          <p className="text-gray-500 mb-4">
            {analysisError instanceof Error
              ? analysisError.message
              : "Không thể tải dữ liệu phân tích"}
          </p>
          <Button onClick={handleRefresh} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {t("reports.productAnalysis") || "Phân tích sản phẩm"}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("reports.fromDate") || "Từ ngày"}
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("reports.toDate") || "Đến ngày"}
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("reports.categoryGroup")}
              </label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("common.selectCategory") || "Chọn danh mục"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("common.all") || "Tất cả"}
                  </SelectItem>
                  {categories.map((category: Category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id.toString()}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("reports.productFilter") || "Tìm sản phẩm"}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder={
                    t("reports.productFilterPlaceholder") ||
                    "Tìm theo tên hoặc mã"
                  }
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("reports.totalRevenue")}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(menuAnalysis?.totalRevenue || 0)} ₫
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("reports.totalQuantitySold") || "Tổng số lượng đã bán"}
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {(menuAnalysis?.totalQuantity || 0).toLocaleString("vi-VN")}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("reports.menuItems") || "Sản phẩm"}
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {(menuAnalysis?.productStats?.length || 0).toLocaleString(
                    "vi-VN",
                  )}
                </p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Performance Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {t("reports.categoryPerformance") || "Hiệu suất danh mục"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysisLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Đang tải dữ liệu biểu đồ...</p>
            </div>
          ) : !menuAnalysis?.categoryStats ||
            menuAnalysis.categoryStats.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium mb-2">
                {t("reports.noCategoryData") || "No category data"}
              </p>
              <p className="text-gray-400 text-sm">
                {t("reports.noDataDescription") ||
                  "Select a date range with sales data to view charts"}
              </p>
              <Button
                onClick={handleRefresh}
                className="mt-4 flex items-center gap-2 mx-auto"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4" />
                {t("common.refresh") || "Refresh"}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Revenue Pie Chart */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    {t("reports.revenueByCategory") ||
                      "Doanh thu theo danh mục"}
                  </h4>
                  <div className="h-80 relative border rounded-lg bg-gradient-to-br from-green-50/30 to-emerald-50/20">
                    <div className="absolute inset-0 bg-white/50 rounded-lg"></div>
                    <div className="relative z-10 h-full p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={menuAnalysis.categoryStats.map(
                              (cat, index) => ({
                                name:
                                  cat.categoryName ||
                                  `Danh mục ${cat.categoryId}`,
                                value: Number(cat.totalRevenue || 0),
                                fill: `hsl(${(index * 137.508) % 360}, 70%, 60%)`,
                              }),
                            )}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {menuAnalysis.categoryStats.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={`hsl(${(index * 137.508) % 360}, 70%, 60%)`}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [
                              formatCurrency(Number(value)) + " ₫",
                              "Doanh thu",
                            ]}
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            wrapperStyle={{ fontSize: "12px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Quantity Pie Chart */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    {t("reports.quantityByCategory") ||
                      "Số lượng theo danh mục"}
                  </h4>
                  <div className="h-80 relative border rounded-lg bg-gradient-to-br from-blue-50/30 to-sky-50/20">
                    <div className="absolute inset-0 bg-white/50 rounded-lg"></div>
                    <div className="relative z-10 h-full p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={
                              menuAnalysis?.categoryStats?.length > 0
                                ? menuAnalysis.categoryStats.map(
                                    (cat, index) => ({
                                      name:
                                        cat.categoryName ||
                                        `Danh mục ${cat.categoryId}`,
                                      value: Number(cat.totalQuantity || 0),
                                      fill: `hsl(${(index * 137.508 + 180) % 360}, 70%, 60%)`,
                                    }),
                                  )
                                : [
                                    {
                                      name: "Không có dữ liệu",
                                      value: 1,
                                      fill: "#e0e0e0",
                                    },
                                  ]
                            }
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            <Cell />
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [
                              `${Number(value).toLocaleString()}`,
                              name,
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        {menuAnalysis?.topSellingProducts &&
          menuAnalysis.topSellingProducts.length > 0 && (
            <Card className="shadow-sm border-0 bg-gradient-to-br from-blue-50/30 to-indigo-50/20">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {t("reports.topSellingItems") || "Sản phẩm bán chạy nhất"}
                    </h3>
                    <p className="text-sm text-gray-500 font-normal mt-1">
                      {t("reports.topProductsByQuantity") ||
                        "Sản phẩm bán nhiều nhất theo số lượng"}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {menuAnalysis.topSellingProducts
                    .slice(0, 10)
                    .map((product, index) => (
                      <div
                        key={product.productId || index}
                        className="group hover:bg-white/60 transition-colors rounded-xl p-4 border border-gray-100/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                  index === 0
                                    ? "bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200"
                                    : index === 1
                                      ? "bg-gray-100 text-gray-700 ring-2 ring-gray-200"
                                      : index === 2
                                        ? "bg-orange-100 text-orange-700 ring-2 ring-orange-200"
                                        : "bg-blue-100 text-blue-600"
                                }`}
                              >
                                {index + 1}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                                {product.productName ||
                                  `Sản phẩm ${product.productId}`}
                              </h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="inline-flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-medium">
                                  <Package className="w-3 h-3" />
                                  {(product.totalQuantity || 0).toLocaleString(
                                    "vi-VN",
                                  )}{" "}
                                  {t("reports.itemsSold") || "đã bán"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className="font-bold text-gray-800 text-lg">
                              {formatCurrency(product.totalRevenue || 0)}
                              <span className="text-gray-500 font-normal ml-1">
                                ₫
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

        {/* Top Revenue Products */}
        {menuAnalysis?.topRevenueProducts &&
          menuAnalysis.topRevenueProducts.length > 0 && (
            <Card className="shadow-sm border-0 bg-gradient-to-br from-green-50/30 to-emerald-50/20">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {t("reports.topRevenueItems") ||
                        "Sản phẩm doanh thu cao nhất"}
                    </h3>
                    <p className="text-sm text-gray-500 font-normal mt-1">
                      {t("reports.topProductsByRevenue") ||
                        "Sản phẩm doanh thu cao nhất"}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {menuAnalysis.topRevenueProducts
                    .slice(0, 10)
                    .map((product, index) => (
                      <div
                        key={product.productId || index}
                        className="group hover:bg-white/60 transition-colors rounded-xl p-4 border border-gray-100/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                  index === 0
                                    ? "bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200"
                                    : index === 1
                                      ? "bg-gray-100 text-gray-700 ring-2 ring-gray-200"
                                      : index === 2
                                        ? "bg-orange-100 text-orange-700 ring-2 ring-orange-200"
                                        : "bg-green-100 text-green-600"
                                }`}
                              >
                                {index + 1}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-800 truncate group-hover:text-green-600 transition-colors">
                                {product.productName ||
                                  `Sản phẩm ${product.productId}`}
                              </h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="inline-flex items-center gap-1 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-lg font-medium">
                                  <Package className="w-3 h-3" />
                                  {(product.totalQuantity || 0).toLocaleString(
                                    "vi-VN",
                                  )}{" "}
                                  {t("reports.itemsSold") || "đã bán"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className="font-bold text-green-600 text-lg">
                              {formatCurrency(product.totalRevenue || 0)}
                              <span className="text-gray-500 font-normal ml-1">
                                ₫
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      {/* Product Sales Analysis from Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t("reports.productAnalysis") || "Phân tích sản phẩm"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysisLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : !menuAnalysis?.productStats ||
            menuAnalysis.productStats.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {t("common.noData") || "Không có dữ liệu bán hàng"}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {t("reports.noDataDescription") ||
                  "Select a date range with sales data to view analysis"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">
                        {t("common.name") || "Sản phẩm"}
                      </th>
                      <th className="text-right py-2 px-4">
                        {t("reports.quantitySold") || "Số lượng bán"}
                      </th>
                      <th className="text-right py-2 px-4">
                        {t("reports.totalRevenue")}
                      </th>
                      <th className="text-right py-2 px-4">
                        {t("reports.averagePrice") || "Giá trung bình"}
                      </th>
                      <td className="py-2 px-4 text-right">
                        {t("reports.contribution")}
                      </td>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Filter products based on search term
                      const filteredStats = menuAnalysis.productStats.filter(
                        (product) =>
                          !productSearch ||
                          (product.productName &&
                            product.productName
                              .toLowerCase()
                              .includes(productSearch.toLowerCase())),
                      );

                      const sortedProducts = filteredStats.sort(
                        (a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0),
                      );

                      const totalPages = Math.ceil(
                        sortedProducts.length / itemsPerPage,
                      );
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const currentProducts = sortedProducts.slice(
                        startIndex,
                        endIndex,
                      );

                      return currentProducts.map((product, index) => {
                        const contribution =
                          menuAnalysis.totalRevenue > 0
                            ? ((product.totalRevenue || 0) /
                                menuAnalysis.totalRevenue) *
                              100
                            : 0;

                        return (
                          <tr
                            key={`${product.productId}-${index}`}
                            className="border-b hover:bg-gray-50"
                          >
                            <td className="py-2 px-4 font-medium">
                              {product.productName ||
                                `Sản phẩm ${product.productId}`}
                            </td>
                            <td className="py-2 px-4 text-right">
                              <span className="font-medium text-blue-600">
                                {(product.totalQuantity || 0).toLocaleString(
                                  "vi-VN",
                                )}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right font-medium">
                              <span className="text-green-600">
                                {formatCurrency(product.totalRevenue || 0)} ₫
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right">
                              {formatCurrency(
                                product.totalQuantity > 0
                                  ? (product.totalRevenue || 0) /
                                      (product.totalQuantity || 1)
                                  : 0,
                              )}{" "}
                              ₫
                            </td>
                            <td className="py-2 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-12 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{
                                      width: `${Math.min(contribution, 100)}%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium">
                                  {contribution.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {(() => {
                // Use same filtering logic as table
                const filteredStats = menuAnalysis.productStats.filter(
                  (product) =>
                    !productSearch ||
                    (product.productName &&
                      product.productName
                        .toLowerCase()
                        .includes(productSearch.toLowerCase())),
                );

                const sortedProducts = filteredStats.sort(
                  (a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0),
                );
                const totalPages = Math.ceil(
                  sortedProducts.length / itemsPerPage,
                );
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;

                return (
                  totalPages > 1 && (
                    <div className="flex items-center justify-between py-4 border-t">
                      <div className="text-sm text-gray-500">
                        {t("common.showing")} {startIndex + 1} -{" "}
                        {Math.min(endIndex, sortedProducts.length)}{" "}
                        {t("common.of")} {sortedProducts.length}
                        {productSearch && (
                          <span className="ml-2 text-blue-600">
                            (lọc theo "{productSearch}")
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage(Math.max(1, currentPage - 1))
                          }
                          disabled={currentPage === 1}
                        >
                          {t("common.previous")}
                        </Button>
                        <span className="px-3 py-1 text-sm">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage(
                              Math.min(totalPages, currentPage + 1),
                            )
                          }
                          disabled={currentPage === totalPages}
                        >
                          {t("common.next")}
                        </Button>
                      </div>
                    </div>
                  )
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default MenuReport;
export { MenuReport };
