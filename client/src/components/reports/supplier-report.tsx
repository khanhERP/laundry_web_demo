import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Search, BarChart3, TrendingUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function SupplierReport() {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [concernType, setConcernType] = useState<string>("purchase");
  const [supplierSearch, setSupplierSearch] = useState<string>("");
  const [debtFrom, setDebtFrom] = useState<string>("");
  const [debtTo, setDebtTo] = useState<string>("");

  const { data: suppliers } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers"],
  });

  const { data: purchaseReceipts } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts"],
    enabled: concernType === "purchase" || concernType === "purchaseBySupplier",
  });

  // Sử dụng purchase receipts làm nguồn dữ liệu cho debt report
  const { data: supplierDebts } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts"],
    enabled: concernType === "debt",
  });

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ₫`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getSupplierPurchaseData = () => {
    if (!purchaseReceipts || !Array.isArray(purchaseReceipts?.data)) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return purchaseReceipts.data
      .filter((receipt: any) => {
        const purchaseDate = new Date(receipt.purchaseDate || receipt.createdAt);
        const dateMatch = purchaseDate >= start && purchaseDate <= end;

        const supplierMatch =
          !supplierSearch ||
          (receipt.supplier?.code &&
            receipt.supplier.code.toLowerCase().includes(supplierSearch.toLowerCase())) ||
          (receipt.supplier?.name &&
            receipt.supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())) ||
          (receipt.supplier?.phone && 
            receipt.supplier.phone.includes(supplierSearch));

        return dateMatch && supplierMatch;
      })
      .map((receipt: any) => ({
        supplierCode: receipt.supplier?.code || receipt.supplier?.id || "N/A",
        supplierName: receipt.supplier?.name || "Không xác định",
        purchaseValue: Number(receipt.subtotal || 0),
        returnValue: 0, // Chưa có return functionality
        netValue: Number(receipt.subtotal || 0),
      }));
  };

  const getSupplierDebtData = () => {
    if (!supplierDebts || !Array.isArray(supplierDebts?.data)) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Group by supplier to calculate debt amounts
    const supplierDebtMap = new Map();

    supplierDebts.data.forEach((receipt: any) => {
      const receiptDate = new Date(receipt.purchaseDate || receipt.createdAt);
      const dateMatch = receiptDate >= start && receiptDate <= end;

      if (!dateMatch) return;

      const supplierCode = receipt.supplier?.code || receipt.supplier?.id || "N/A";
      const supplierName = receipt.supplier?.name || "Không xác định";

      const supplierMatch =
        !supplierSearch ||
        (receipt.supplier?.code &&
          receipt.supplier.code.toLowerCase().includes(supplierSearch.toLowerCase())) ||
        (receipt.supplier?.name &&
          receipt.supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())) ||
        (receipt.supplier?.phone && 
          receipt.supplier.phone.includes(supplierSearch));

      if (!supplierMatch) return;

      const key = supplierCode;
      if (!supplierDebtMap.has(key)) {
        supplierDebtMap.set(key, {
          supplierCode,
          supplierName,
          openingDebt: 0,
          debitAmount: 0,
          creditAmount: 0,
          closingDebt: 0,
        });
      }

      const supplier = supplierDebtMap.get(key);
      // Assume purchase creates debt (debit) and payments reduce debt (credit)
      supplier.debitAmount += Number(receipt.total || 0);
      supplier.closingDebt = supplier.openingDebt + supplier.debitAmount - supplier.creditAmount;
    });

    const result = Array.from(supplierDebtMap.values());

    // Apply debt amount filter
    return result.filter((debt: any) => {
      if (!debtFrom && !debtTo) return true;
      const from = debtFrom ? Number(debtFrom) : 0;
      const to = debtTo ? Number(debtTo) : Infinity;
      const closingDebt = Number(debt.closingDebt || 0);
      return closingDebt >= from && closingDebt <= to;
    });
  };

  const getSupplierProductData = () => {
    if (!purchaseReceipts || !Array.isArray(purchaseReceipts?.data)) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const supplierProductMap = new Map();

    purchaseReceipts.data.forEach((receipt: any) => {
      const receiptDate = new Date(receipt.purchaseDate || receipt.createdAt);
      const dateMatch = receiptDate >= start && receiptDate <= end;

      if (!dateMatch) return;

      const supplierCode = receipt.supplier?.code || receipt.supplier?.id || "N/A";
      const supplierName = receipt.supplier?.name || "Không xác định";

      const supplierMatch =
        !supplierSearch ||
        supplierCode.toLowerCase().includes(supplierSearch.toLowerCase()) ||
        supplierName.toLowerCase().includes(supplierSearch.toLowerCase()) ||
        (receipt.supplier?.phone && receipt.supplier.phone.includes(supplierSearch));

      if (!supplierMatch) return;

      const key = supplierCode;
      if (!supplierProductMap.has(key)) {
        supplierProductMap.set(key, {
          supplierCode,
          supplierName,
          openingDebt: 0,
          debitAmount: Number(receipt.total || 0),
          creditAmount: 0,
          closingDebt: Number(receipt.total || 0),
        });
      } else {
        const supplier = supplierProductMap.get(key);
        supplier.debitAmount += Number(receipt.total || 0);
        supplier.closingDebt += Number(receipt.total || 0);
      }
    });

    return Array.from(supplierProductMap.values());
  };

  const renderPurchaseReport = () => {
    const data = getSupplierPurchaseData();
    const chartData = data.slice(0, 10).map((item) => ({
      name: item.supplierName.length > 15 
        ? item.supplierName.substring(0, 15) + "..." 
        : item.supplierName,
      value: item.netValue,
    }));

    return (
      <div className="space-y-6">
        {/* Chart */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30">
          <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-lg font-semibold">
              <div className="p-2 bg-white/20 rounded-lg">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-white/90 text-sm font-normal">
                  {t("reports.chartView")}
                </div>
                <div className="text-white font-semibold">
                  {t("reports.supplierPurchaseReportTitle")}
                </div>
              </div>
            </CardTitle>
            <CardDescription className="text-green-100 mt-2">
              {t("reports.visualRepresentation")} - {t("reports.fromDate")}: {formatDate(startDate)} {t("reports.toDate")}: {formatDate(endDate)}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 bg-white/80 backdrop-blur-sm">
            <div className="h-[450px] w-full bg-white/90 rounded-xl border-0 shadow-lg p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50/30 to-emerald-50/20 rounded-xl"></div>
              <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Live Data
              </div>

              <div className="relative z-10 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 30, right: 40, left: 30, bottom: 90 }}
                    barCategoryGap="25%"
                  >
                    <defs>
                      <linearGradient
                        id="supplierGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#22c55e"
                          stopOpacity={0.9}
                        />
                        <stop
                          offset="100%"
                          stopColor="#22c55e"
                          stopOpacity={0.6}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="2 4"
                      stroke="#e2e8f0"
                      opacity={0.4}
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
                      angle={-35}
                      textAnchor="end"
                      height={85}
                      interval={0}
                      tickMargin={12}
                      axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      tickLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
                      tickFormatter={(value) => {
                        if (value >= 1000000) {
                          return `${(value / 1000000).toFixed(1)}M`;
                        } else if (value >= 1000) {
                          return `${(value / 1000).toFixed(0)}K`;
                        }
                        return value.toString();
                      }}
                      width={70}
                      axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      tickLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(value), t("reports.netValue")]}
                      labelStyle={{
                        color: "#1e293b",
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.98)",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        boxShadow:
                          "0 10px 25px -5px rgb(0 0 0 / 0.15), 0 4px 6px -2px rgb(0 0 0 / 0.05)",
                        padding: "12px 16px",
                        backdropFilter: "blur(8px)",
                      }}
                      cursor={{ fill: "rgba(34, 197, 94, 0.05)" }}
                    />
                    <Bar
                      dataKey="value"
                      fill="url(#supplierGradient)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={45}
                      stroke="#16a34a"
                      strokeWidth={1}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {t("reports.supplierPurchaseReportTitle")}
            </CardTitle>
            <CardDescription>
              {t("reports.fromDate")}: {formatDate(startDate)} - {t("reports.toDate")}: {formatDate(endDate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.supplierCode")}</TableHead>
                  <TableHead>{t("reports.supplierName")}</TableHead>
                  <TableHead className="text-right">{t("reports.purchaseValue")}</TableHead>
                  <TableHead className="text-right">{t("reports.returnValue")}</TableHead>
                  <TableHead className="text-right">{t("reports.netValue")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length > 0 ? (
                  data.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.supplierCode}</TableCell>
                      <TableCell>{item.supplierName}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(item.purchaseValue)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(item.returnValue)}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {formatCurrency(item.netValue)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 italic">
                      {t("reports.noReportData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderDebtReport = () => {
    const data = getSupplierDebtData();
    const chartData = data.slice(0, 10).map((item) => ({
      name: item.supplierName.length > 15 
        ? item.supplierName.substring(0, 15) + "..." 
        : item.supplierName,
      value: item.closingDebt,
    }));

    return (
      <div className="space-y-6">
        {/* Chart */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-red-50/50 to-rose-50/30">
          <CardHeader className="bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-lg font-semibold">
              <div className="p-2 bg-white/20 rounded-lg">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-white/90 text-sm font-normal">
                  {t("reports.chartView")}
                </div>
                <div className="text-white font-semibold">
                  {t("reports.supplierDebtReportTitle")}
                </div>
              </div>
            </CardTitle>
            <CardDescription className="text-red-100 mt-2">
              {t("reports.visualRepresentation")} - {t("reports.fromDate")}: {formatDate(startDate)} {t("reports.toDate")}: {formatDate(endDate)}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 bg-white/80 backdrop-blur-sm">
            <div className="h-[450px] w-full bg-white/90 rounded-xl border-0 shadow-lg p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-50/30 to-rose-50/20 rounded-xl"></div>
              <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                Live Data
              </div>

              <div className="relative z-10 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 30, right: 40, left: 30, bottom: 90 }}
                    barCategoryGap="25%"
                  >
                    <defs>
                      <linearGradient
                        id="debtGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ef4444"
                          stopOpacity={0.9}
                        />
                        <stop
                          offset="100%"
                          stopColor="#ef4444"
                          stopOpacity={0.6}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="2 4"
                      stroke="#e2e8f0"
                      opacity={0.4}
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
                      angle={-35}
                      textAnchor="end"
                      height={85}
                      interval={0}
                      tickMargin={12}
                      axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      tickLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
                      tickFormatter={(value) => {
                        if (value >= 1000000) {
                          return `${(value / 1000000).toFixed(1)}M`;
                        } else if (value >= 1000) {
                          return `${(value / 1000).toFixed(0)}K`;
                        }
                        return value.toString();
                      }}
                      width={70}
                      axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      tickLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(value), t("reports.closingDebt")]}
                      labelStyle={{
                        color: "#1e293b",
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.98)",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        boxShadow:
                          "0 10px 25px -5px rgb(0 0 0 / 0.15), 0 4px 6px -2px rgb(0 0 0 / 0.05)",
                        padding: "12px 16px",
                        backdropFilter: "blur(8px)",
                      }}
                      cursor={{ fill: "rgba(239, 68, 68, 0.05)" }}
                    />
                    <Bar
                      dataKey="value"
                      fill="url(#debtGradient)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={45}
                      stroke="#dc2626"
                      strokeWidth={1}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {t("reports.supplierDebtReportTitle")}
            </CardTitle>
            <CardDescription>
              {t("reports.fromDate")}: {formatDate(startDate)} - {t("reports.toDate")}: {formatDate(endDate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.supplierCode")}</TableHead>
                  <TableHead>{t("reports.supplierName")}</TableHead>
                  <TableHead className="text-right">{t("reports.openingDebt")}</TableHead>
                  <TableHead className="text-right">{t("reports.debitAmount")}</TableHead>
                  <TableHead className="text-right">{t("reports.creditAmount")}</TableHead>
                  <TableHead className="text-right">{t("reports.closingDebt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length > 0 ? (
                  data.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.supplierCode}</TableCell>
                      <TableCell>{item.supplierName}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.openingDebt)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(item.debitAmount)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(item.creditAmount)}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {formatCurrency(item.closingDebt)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 italic">
                      {t("reports.noReportData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderProductsBySupplierReport = () => {
    const data = getSupplierProductData();

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t("reports.supplierProductPurchaseReportTitle")}
          </CardTitle>
          <CardDescription>
            {t("reports.fromDate")}: {formatDate(startDate)} - {t("reports.toDate")}: {formatDate(endDate)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports.supplierCode")}</TableHead>
                <TableHead>{t("reports.supplierName")}</TableHead>
                <TableHead className="text-right">{t("reports.openingDebt")}</TableHead>
                <TableHead className="text-right">{t("reports.debitAmount")}</TableHead>
                <TableHead className="text-right">{t("reports.creditAmount")}</TableHead>
                <TableHead className="text-right">{t("reports.closingDebt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length > 0 ? (
                data.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.supplierCode}</TableCell>
                    <TableCell>{item.supplierName}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.openingDebt)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(item.debitAmount)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(item.creditAmount)}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {formatCurrency(item.closingDebt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 italic">
                    {t("reports.noReportData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Main Filters */}
      <Card>
        <CardHeader>
          {t('reports.supplierReport')}
          <CardDescription>{t("reports.supplierReportDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="concern-type">{t("reports.supplierConcernType")}</Label>
              <Select value={concernType} onValueChange={setConcernType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">{t("reports.supplierPurchase")}</SelectItem>
                  <SelectItem value="debt">{t("reports.supplierDebt")}</SelectItem>
                  <SelectItem value="purchaseBySupplier">{t("reports.supplierPurchaseBySupplier")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start-date">{t("reports.startDate")}</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="end-date">{t("reports.endDate")}</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="supplier-search">{t("reports.supplierFilter")}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="supplier-search"
                  placeholder={t("reports.supplierFilterPlaceholder")}
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Debt Range Filter - Only show for debt concern type */}
          {concernType === "debt" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div>
                <Label htmlFor="debt-from">{t("reports.supplierDebtFrom")}</Label>
                <Input
                  id="debt-from"
                  type="number"
                  placeholder="0"
                  value={debtFrom}
                  onChange={(e) => setDebtFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="debt-to">{t("reports.supplierDebtTo")}</Label>
                <Input
                  id="debt-to"
                  type="number"
                  placeholder="999999999"
                  value={debtTo}
                  onChange={(e) => setDebtTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Content Based on Concern Type */}
      <div key={concernType}>
        {concernType === "purchase" && renderPurchaseReport()}
        {concernType === "debt" && renderDebtReport()}
        {concernType === "purchaseBySupplier" && renderProductsBySupplierReport()}
      </div>
    </div>
  );
}