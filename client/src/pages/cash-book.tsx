import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { POSHeader } from "@/components/pos/header";
import { RightSidebar } from "@/components/ui/right-sidebar";
import IncomeVoucherModal from "@/components/pos/income-voucher-modal";
import ExpenseVoucherModal from "@/components/pos/expense-voucher-modal";
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  FileText,
  Plus,
  Minus,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface CashBookPageProps {
  onLogout: () => void;
}

interface CashTransaction {
  id: string;
  date: string;
  description: string;
  source: string;
  type: "thu" | "chi";
  amount: number;
  balance: number;
  voucherType?: string;
  internalId?: number;
}

export default function CashBookPage({ onLogout }: CashBookPageProps) {
  const { t } = useTranslation();

  // Modal states
  const [showIncomeVoucherModal, setShowIncomeVoucherModal] = useState(false);
  const [showExpenseVoucherModal, setShowExpenseVoucherModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [voucherMode, setVoucherMode] = useState("create");

  // Filters
  const [filterType, setFilterType] = useState("all"); // "all", "thu", "chi"
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all"); // "all" or specific payment method
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("all"); // "all", "income_voucher", "expense_voucher", "purchase_receipt", "sales_order"
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDayOfMonth.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Query orders (thu - income from sales)
  const { data: orders = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching orders:", error);
        return [];
      }
    },
  });

  // Query purchase receipts (chi - expenses from purchases)
  const { data: purchaseReceipts = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return Array.isArray(data.data) ? data.data : [];
      } catch (error) {
        console.error("Error fetching purchase receipts:", error);
        return [];
      }
    },
  });

  // Query income vouchers (thu - manual income entries)
  const { data: incomeVouchers = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/income-vouchers"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/income-vouchers");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching income vouchers:", error);
        return [];
      }
    },
  });

  // Query expense vouchers (chi - manual expense entries)
  const { data: expenseVouchers = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/expense-vouchers"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/expense-vouchers");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching expense vouchers:", error);
        return [];
      }
    },
  });

  // Query suppliers for name mapping
  const { data: suppliers = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        return [];
      }
    },
  });

  // Load payment methods from localStorage (same as settings page)
  // Query payment methods from API
  const { data: paymentMethodsData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"],
    queryFn: async () => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods");
      return response.json();
    },
  });

  const getPaymentMethods = () => {
    const paymentMethods = paymentMethodsData || [];

    // Filter to only return enabled payment methods
    return paymentMethods.filter((method: any) => method.enabled === true);
  };

  const paymentMethods = getPaymentMethods();

  // Calculate cash book data
  const cashBookData = useMemo(() => {
    const transactions: CashTransaction[] = [];

    // Add income transactions from orders (thu)
    orders
      .filter((order) => {
        const isPaid =
          order.status === "paid" || order.paymentStatus === "paid";
        if (!isPaid) return false;

        // Apply payment method filter
        if (paymentMethodFilter !== "all") {
          // Check if payment method is multi-payment (JSON array)
          if (order.paymentMethod && order.paymentMethod.startsWith("[")) {
            try {
              const paymentMethods = JSON.parse(order.paymentMethod);
              // Check if any payment method in the array matches the filter
              return paymentMethods.some(
                (pm: any) => pm.method === paymentMethodFilter,
              );
            } catch (e) {
              console.error("Error parsing payment method:", e);
              return false;
            }
          }
          // Single payment method
          return order.paymentMethod === paymentMethodFilter;
        }
        return true;
      })
      .forEach((order) => {
        const orderDate = new Date(order.orderedAt || order.paidAt);

        // Calculate amount based on payment method filter
        let transactionAmount = parseFloat(order.total || "0");

        // If filtering by specific payment method and order has multi-payment
        if (
          paymentMethodFilter !== "all" &&
          order.paymentMethod &&
          order.paymentMethod.startsWith("[")
        ) {
          try {
            const paymentMethods = JSON.parse(order.paymentMethod);
            const matchedMethod = paymentMethods.find(
              (pm: any) => pm.method === paymentMethodFilter,
            );
            if (matchedMethod) {
              // Use the specific amount for this payment method
              transactionAmount = parseFloat(matchedMethod.amount || "0");
            }
          } catch (e) {
            console.error("Error parsing payment method for amount:", e);
          }
        }

        transactions.push({
          id: order.orderNumber || `ORDER-${order.id}`, // Use actual order number
          date: orderDate.toISOString().split("T")[0],
          description:
            order.salesChannel === "table"
              ? "tableSalesTransaction"
              : "salesTransaction",
          source: order.customerName || t("common.customer"),
          type: "thu", // All paid orders are income transactions
          amount: transactionAmount,
          balance: 0, // Will be calculated later
          voucherType: "sales_order",
        });
      });

    // Add income transactions from income vouchers (thu)
    incomeVouchers
      .filter((voucher) => {
        // Apply payment method filter - income vouchers use 'account' field
        if (paymentMethodFilter !== "all") {
          return voucher.account === paymentMethodFilter;
        }
        return true;
      })
      .forEach((voucher) => {
        // Validate date before adding to transactions
        const voucherDate = voucher.date ? new Date(voucher.date) : new Date();
        const isValidDate = !isNaN(voucherDate.getTime());

        if (isValidDate) {
          transactions.push({
            id: voucher.voucherNumber, // Use actual voucher number instead of internal ID
            date: voucher.date || new Date().toISOString().split("T")[0],
            description: voucher.category || "orther",
            source: voucher.recipient || "",
            type: "thu",
            amount: parseFloat(voucher.amount || "0"),
            balance: 0, // Will be calculated later
            voucherType: "income_voucher",
            internalId: voucher.id, // Keep internal ID for click handling
          });
        }
      });

    // Add expense transactions from expense vouchers (chi)
    expenseVouchers
      .filter((voucher) => {
        // Apply payment method filter - expense vouchers use 'account' field
        if (paymentMethodFilter !== "all") {
          const matches = voucher.account === paymentMethodFilter;
          console.log(
            `🔍 Filtering expense voucher ${voucher.voucherNumber}:`,
            {
              voucherAccount: voucher.account,
              filterValue: paymentMethodFilter,
              matches: matches,
            },
          );
          return matches;
        }
        return true;
      })
      .forEach((voucher) => {
        // Validate date before adding to transactions
        const voucherDate = voucher.date ? new Date(voucher.date) : new Date();
        const isValidDate = !isNaN(voucherDate.getTime());

        if (isValidDate) {
          transactions.push({
            id: voucher.voucherNumber, // Use actual voucher number instead of internal ID
            date: voucher.date || new Date().toISOString().split("T")[0],
            description: voucher.category || "other",
            source: voucher.recipient || "Không rõ",
            type: "chi",
            amount: parseFloat(voucher.amount || "0"),
            balance: 0, // Will be calculated later
            voucherType: "expense_voucher",
            internalId: voucher.id, // Keep internal ID for click handling
          });
        }
      });

    // Add expense transactions from purchase receipts (chi)
    // Only include receipts with purchaseType = 'expenses' AND isPaid = true
    purchaseReceipts
      .filter((receipt) => {
        // Filter 1: Must be expense type AND paid
        const isExpenseAndPaid = receipt.isPaid === true;
        if (!isExpenseAndPaid) return false;

        // Filter 2: Apply payment method filter
        if (paymentMethodFilter !== "all") {
          // Handle null/undefined payment method
          if (!receipt.paymentMethod) {
            return false;
          }

          // Check if payment method is JSON object (single payment)
          if (receipt.paymentMethod.startsWith("{")) {
            try {
              const paymentData = JSON.parse(receipt.paymentMethod);
              return paymentData.method === paymentMethodFilter;
            } catch (e) {
              console.error(
                "Error parsing purchase receipt payment method (object):",
                e,
              );
              return false;
            }
          }

          // Check if payment method is JSON array (multi-payment)
          if (receipt.paymentMethod.startsWith("[")) {
            try {
              const paymentMethods = JSON.parse(receipt.paymentMethod);
              return paymentMethods.some(
                (pm: any) => pm.method === paymentMethodFilter,
              );
            } catch (e) {
              console.error(
                "Error parsing purchase receipt payment method (array):",
                e,
              );
              return false;
            }
          }

          // Single payment method string
          return receipt.paymentMethod === paymentMethodFilter;
        }
        return true;
      })
      .forEach((receipt) => {
        // Validate date before adding to transactions
        const receiptDate =
          receipt.purchaseDate || receipt.createdAt
            ? new Date(receipt.purchaseDate || receipt.createdAt)
            : new Date();
        const isValidDate = !isNaN(receiptDate.getTime());

        if (isValidDate) {
          const supplier = suppliers.find((s) => s.id === receipt.supplierId);

          // Calculate amount based on payment method filter
          let transactionAmount = 0;

          if (paymentMethodFilter === "all") {
            // Show payment_amount when filter is "all"
            transactionAmount = parseFloat(receipt.paymentAmount || "0");
          } else {
            // If filtering by specific payment method
            if (receipt.paymentMethod) {
              // Check if JSON object (single payment)
              if (receipt.paymentMethod.startsWith("{")) {
                try {
                  const paymentData = JSON.parse(receipt.paymentMethod);
                  if (paymentData.method === paymentMethodFilter) {
                    transactionAmount = parseFloat(paymentData.amount || "0");
                  }
                } catch (e) {
                  console.error(
                    "Error parsing payment method for amount (object):",
                    e,
                  );
                }
              }
              // Check if JSON array (multi-payment)
              else if (receipt.paymentMethod.startsWith("[")) {
                try {
                  const paymentMethods = JSON.parse(receipt.paymentMethod);
                  const matchedMethod = paymentMethods.find(
                    (pm: any) => pm.method === paymentMethodFilter,
                  );
                  if (matchedMethod) {
                    transactionAmount = parseFloat(matchedMethod.amount || "0");
                  }
                } catch (e) {
                  console.error(
                    "Error parsing payment method for amount (array):",
                    e,
                  );
                }
              }
              // Single payment method string
              else if (receipt.paymentMethod === paymentMethodFilter) {
                transactionAmount = parseFloat(receipt.paymentAmount || "0");
              }
            }
          }

          // Only add transaction if amount > 0
          if (transactionAmount > 0) {
            transactions.push({
              id: receipt.receiptNumber || `PURCHASE-${receipt.id}`, // Use actual receipt number
              date: receiptDate.toISOString().split("T")[0],
              description: "purchaseTransaction",
              source: supplier?.name || t("common.supplier"),
              type: "chi",
              amount: transactionAmount,
              balance: 0, // Will be calculated later
              voucherType: "purchase_receipt",
            });
          }
        }
      });

    // Sort by date
    transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Filter by date range
    const filteredTransactions = transactions.filter((transaction) => {
      const transactionDate = transaction.date;
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Calculate opening balance (balance before start date)
    const openingBalance = transactions
      .filter((transaction) => transaction.date < startDate)
      .reduce((balance, transaction) => {
        return transaction.type === "thu"
          ? balance + transaction.amount
          : balance - transaction.amount;
      }, 0);

    // Calculate running balance for filtered transactions
    let runningBalance = openingBalance;
    const transactionsWithBalance = filteredTransactions.map((transaction) => {
      runningBalance =
        transaction.type === "thu"
          ? runningBalance + transaction.amount
          : runningBalance - transaction.amount;

      return {
        ...transaction,
        balance: runningBalance,
      };
    });

    // Calculate totals
    const totalIncome = filteredTransactions
      .filter((t) => t.type === "thu")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = filteredTransactions
      .filter((t) => t.type === "chi")
      .reduce((sum, t) => sum + t.amount, 0);

    const endingBalance = openingBalance + totalIncome - totalExpense;

    return {
      openingBalance,
      totalIncome,
      totalExpense,
      endingBalance,
      transactions: transactionsWithBalance,
    };
  }, [
    orders,
    purchaseReceipts,
    incomeVouchers,
    expenseVouchers,
    suppliers,
    startDate,
    endDate,
    paymentMethodFilter,
  ]);

  // Filter transactions by type and recalculate summaries
  const filteredData = useMemo(() => {
    let filtered = cashBookData.transactions;

    // Filter by transaction type
    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    // Filter by voucher type
    if (voucherTypeFilter !== "all") {
      filtered = filtered.filter((t) => t.voucherType === voucherTypeFilter);
    }

    // Recalculate summaries based on filtered transactions
    const totalIncome = filtered
      .filter((t) => t.type === "thu")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = filtered
      .filter((t) => t.type === "chi")
      .reduce((sum, t) => sum + t.amount, 0);

    const endingBalance =
      cashBookData.openingBalance + totalIncome - totalExpense;

    return {
      transactions: filtered,
      totalIncome,
      totalExpense,
      endingBalance,
    };
  }, [
    cashBookData.transactions,
    cashBookData.openingBalance,
    filterType,
    voucherTypeFilter,
  ]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Handle clicking on transaction rows
  const handleTransactionClick = (transaction: CashTransaction) => {
    if (
      transaction.voucherType === "income_voucher" &&
      transaction.internalId
    ) {
      // Find the income voucher using internal ID
      const voucher = incomeVouchers.find(
        (v) => v.id.toString() === transaction.internalId.toString(),
      );
      if (voucher) {
        setSelectedVoucher(voucher);
        setVoucherMode("edit");
        setShowIncomeVoucherModal(true);
      }
    } else if (
      transaction.voucherType === "expense_voucher" &&
      transaction.internalId
    ) {
      // Find the expense voucher using internal ID
      const voucher = expenseVouchers.find(
        (v) => v.id.toString() === transaction.internalId.toString(),
      );
      if (voucher) {
        setSelectedVoucher(voucher);
        setVoucherMode("edit");
        setShowExpenseVoucherModal(true);
      }
    }
  };

  // Handle closing modals
  const handleCloseIncomeModal = () => {
    setShowIncomeVoucherModal(false);
    setSelectedVoucher(null);
    setVoucherMode("create");
  };

  const handleCloseExpenseModal = () => {
    setShowExpenseVoucherModal(false);
    setSelectedVoucher(null);
    setVoucherMode("create");
  };

  return (
    <div className="min-h-screen bg-green-50 grocery-bg">
      <POSHeader />
      <RightSidebar />
      <div className="main-content pt-16 px-6">
        <div className="max-w-7xl mx-auto py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-green-600" />
              {t("common.cashManagement")}
            </h1>
            <p className="text-gray-600 mt-2">
              {t("common.cashManagementDescription")}
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-8 border-green-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Filter Type */}
                <div>
                  <Label className="text-sm font-bold text-gray-800 mb-3 block">
                    {t("common.transactionTypeFilter")}
                  </Label>
                  <RadioGroup
                    value={filterType}
                    onValueChange={setFilterType}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="cursor-pointer">
                        {t("common.allTransactions")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="thu" id="thu" />
                      <Label htmlFor="thu" className="cursor-pointer">
                        {t("common.incomeFilter")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="chi" id="chi" />
                      <Label htmlFor="chi" className="cursor-pointer">
                        {t("common.expenseFilter")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <Label className="text-sm font-bold text-gray-800 mb-3 block">
                    {t("common.fundType")}
                  </Label>
                  <Select
                    value={paymentMethodFilter}
                    onValueChange={setPaymentMethodFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("common.fundType")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("common.allFunds")}
                      </SelectItem>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.id} value={method.nameKey}>
                          {t(`common.${method.nameKey}`)} {method.icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Voucher Type Filter */}
                <div>
                  <Label className="text-sm font-bold text-gray-800 mb-3 block">
                    {t("common.voucherTypeFilter")}
                  </Label>
                  <Select
                    value={voucherTypeFilter}
                    onValueChange={setVoucherTypeFilter}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("common.voucherTypeFilter")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("common.allVouchers")}
                      </SelectItem>
                      <SelectItem value="income_voucher">
                        {t("common.incomeVoucher")}
                      </SelectItem>
                      <SelectItem value="expense_voucher">
                        {t("common.expenseVoucher")}
                      </SelectItem>
                      <SelectItem value="purchase_receipt">
                        {t("common.purchaseReceipt")}
                      </SelectItem>
                      <SelectItem value="sales_order">
                        {t("common.salesOrder")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div>
                  <Label className="text-sm font-bold text-gray-800 mb-3 block">
                    {t("common.fromDate")}
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div>
                  <Label className="text-sm font-bold text-gray-800 mb-3 block">
                    {t("common.toDate")}
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t("common.openingBalance")}
                </CardTitle>
                <Wallet className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(cashBookData.openingBalance)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t("common.totalIncome")}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(filteredData.totalIncome)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t("common.totalExpense")}
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  -{formatCurrency(filteredData.totalExpense)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t("common.closingBalance")}
                </CardTitle>
                <Wallet className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(filteredData.endingBalance)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mb-6">
            <Button
              onClick={() => {
                // Prepare export data
                const exportData = filteredData.transactions.map(
                  (transaction) => ({
                    "Mã phiếu": transaction.id,
                    "Thời gian": formatDate(transaction.date),
                    "Loại thu chi": transaction.description,
                    "Người nộp/nhận": transaction.source,
                    Thu:
                      transaction.type === "thu"
                        ? formatCurrency(transaction.amount)
                        : "",
                    Chi:
                      transaction.type === "chi"
                        ? formatCurrency(transaction.amount)
                        : "",
                    "Tồn quỹ": formatCurrency(transaction.balance),
                  }),
                );

                // Create summary data
                const summaryData = [
                  ["BÁO CÁO SỔ QUỸ TIỀN MẶT", "", "", "", "", "", ""],
                  [
                    `Từ ngày: ${formatDate(startDate)}`,
                    `Đến ngày: ${formatDate(endDate)}`,
                    "",
                    "",
                    "",
                    "",
                    "",
                  ],
                  ["", "", "", "", "", "", ""],
                  ["TỔNG KẾT:", "", "", "", "", "", ""],
                  [
                    "Quỹ đầu kỳ:",
                    "",
                    "",
                    "",
                    "",
                    "",
                    formatCurrency(cashBookData.openingBalance),
                  ],
                  [
                    "Tổng thu:",
                    "",
                    "",
                    "",
                    "",
                    formatCurrency(filteredData.totalIncome),
                    "",
                  ],
                  [
                    "Tổng chi:",
                    "",
                    "",
                    "",
                    "",
                    formatCurrency(filteredData.totalExpense),
                    "",
                  ],
                  [
                    "Tồn quỹ:",
                    "",
                    "",
                    "",
                    "",
                    "",
                    formatCurrency(filteredData.endingBalance),
                  ],
                  ["", "", "", "", "", "", ""],
                  ["CHI TIẾT GIAO DỊCH:", "", "", "", "", "", ""],
                  ["", "", "", "", "", "", ""],
                ];

                // Create worksheet
                const ws = XLSX.utils.aoa_to_sheet(summaryData);

                // Add transaction data
                XLSX.utils.sheet_add_json(ws, exportData, {
                  origin: `A${summaryData.length + 1}`,
                  skipHeader: false,
                });

                // Set column widths
                const colWidths = [
                  { wch: 25 }, // Mã phiếu
                  { wch: 15 }, // Thời gian
                  { wch: 30 }, // Loại thu chi
                  { wch: 25 }, // Người nộp/nhận
                  { wch: 15 }, // Thu
                  { wch: 15 }, // Chi
                  { wch: 15 }, // Tồn quỹ
                ];
                ws["!cols"] = colWidths;

                // Style the worksheet
                const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

                // Style header rows
                for (let row = 0; row < 3; row++) {
                  for (let col = 0; col <= 6; col++) {
                    const cellAddress = XLSX.utils.encode_cell({
                      r: row,
                      c: col,
                    });
                    if (ws[cellAddress]) {
                      ws[cellAddress].s = {
                        font: {
                          bold: row === 0,
                          name: "Times New Roman",
                          sz: row === 0 ? 14 : 11,
                          color: { rgb: "000000" },
                        },
                        alignment: { horizontal: "center", vertical: "center" },
                      };
                    }
                  }
                }

                // Style summary section
                for (let row = 3; row < 9; row++) {
                  for (let col = 0; col <= 6; col++) {
                    const cellAddress = XLSX.utils.encode_cell({
                      r: row,
                      c: col,
                    });
                    if (ws[cellAddress]) {
                      ws[cellAddress].s = {
                        font: {
                          bold: true,
                          name: "Times New Roman",
                          sz: 11,
                          color: { rgb: "000000" },
                        },
                        fill: {
                          patternType: "solid",
                          fgColor: { rgb: "E8F5E8" },
                        },
                        alignment: { horizontal: "left", vertical: "center" },
                      };
                    }
                  }
                }

                // Style transaction header
                const headerRow = summaryData.length;
                for (let col = 0; col <= 6; col++) {
                  const cellAddress = XLSX.utils.encode_cell({
                    r: headerRow,
                    c: col,
                  });
                  if (ws[cellAddress]) {
                    ws[cellAddress].s = {
                      font: {
                        bold: true,
                        name: "Times New Roman",
                        sz: 11,
                        color: { rgb: "FFFFFF" },
                      },
                      fill: {
                        patternType: "solid",
                        fgColor: { rgb: "059669" },
                      },
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

                // Style transaction data rows
                for (let row = headerRow + 1; row <= range.e.r; row++) {
                  const isEven = (row - headerRow - 1) % 2 === 0;
                  const bgColor = isEven ? "FFFFFF" : "F8F9FA";

                  for (let col = 0; col <= 6; col++) {
                    const cellAddress = XLSX.utils.encode_cell({
                      r: row,
                      c: col,
                    });
                    if (ws[cellAddress]) {
                      const isCurrency = [4, 5, 6].includes(col);
                      ws[cellAddress].s = {
                        font: {
                          name: "Times New Roman",
                          sz: 10,
                          color: { rgb: "000000" },
                        },
                        fill: {
                          patternType: "solid",
                          fgColor: { rgb: bgColor },
                        },
                        alignment: {
                          horizontal: isCurrency ? "right" : "left",
                          vertical: "center",
                        },
                        border: {
                          top: { style: "thin", color: { rgb: "CCCCCC" } },
                          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                          left: { style: "thin", color: { rgb: "CCCCCC" } },
                          right: { style: "thin", color: { rgb: "CCCCCC" } },
                        },
                      };
                    }
                  }
                }

                // Create workbook and save
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Sổ quỹ tiền mặt");

                // Set workbook properties
                wb.Props = {
                  Title: "Báo cáo sổ quỹ tiền mặt",
                  Subject: "Chi tiết thu chi tiền mặt",
                  Author: "EDPOS System",
                  CreatedDate: new Date(),
                };

                // Generate filename with timestamp
                const timestamp = new Date()
                  .toISOString()
                  .slice(0, 19)
                  .replace(/:/g, "-");
                const filename = `so-quy-tien-mat_${formatDate(startDate).replace(/\//g, "-")}_${formatDate(endDate).replace(/\//g, "-")}_${timestamp}.xlsx`;

                // Save file
                try {
                  XLSX.writeFile(wb, filename, {
                    bookType: "xlsx",
                    cellStyles: true,
                    sheetStubs: false,
                    compression: true,
                  });
                  console.log("✅ Excel file exported successfully:", filename);
                } catch (error) {
                  console.error("❌ Error exporting Excel file:", error);
                  // Fallback export without styling
                  XLSX.writeFile(wb, filename, { bookType: "xlsx" });
                }
              }}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              {t("common.exportExcel")}
            </Button>
            <Button
              onClick={() => {
                setSelectedVoucher(null);
                setVoucherMode("create");
                setShowIncomeVoucherModal(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("common.createIncomeVoucher")}
            </Button>
            <Button
              onClick={() => {
                setSelectedVoucher(null);
                setVoucherMode("create");
                setShowExpenseVoucherModal(true);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Minus className="w-4 h-4 mr-2" />
              {t("common.createExpenseVoucher")}
            </Button>
          </div>

          {/* Transactions Table */}
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t("common.transactionDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredData.transactions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">
                    {t("common.noTransactionsInPeriod")}
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button
                      onClick={() => {
                        setSelectedVoucher(null);
                        setVoucherMode("create");
                        setShowIncomeVoucherModal(true);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t("common.createIncomeVoucher")}
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedVoucher(null);
                        setVoucherMode("create");
                        setShowExpenseVoucherModal(true);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Minus className="w-4 h-4 mr-2" />
                      {t("common.createExpenseVoucher")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px] font-bold">
                          {t("common.voucherCode")}
                        </TableHead>
                        <TableHead className="w-[110px] font-bold">
                          {t("common.dateTime")}
                        </TableHead>
                        <TableHead className="w-[150px] font-bold">
                          {t("common.transactionType")}
                        </TableHead>
                        <TableHead className="w-[180px] font-bold">
                          {t("common.payerReceiver")}
                        </TableHead>
                        <TableHead className="text-right w-[130px] font-bold">
                          {t("common.income")}
                        </TableHead>
                        <TableHead className="text-right w-[130px] font-bold">
                          {t("common.expense")}
                        </TableHead>
                        <TableHead className="text-right w-[140px] font-bold">
                          {t("common.balance")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.transactions.map((transaction) => (
                        <TableRow
                          key={transaction.id}
                          className={
                            transaction.voucherType === "income_voucher" ||
                            transaction.voucherType === "expense_voucher"
                              ? "cursor-pointer hover:bg-gray-50"
                              : ""
                          }
                          onClick={() => handleTransactionClick(transaction)}
                        >
                          <TableCell className="font-medium w-[140px]">
                            <div className="truncate" title={transaction.id}>
                              {transaction.id}
                            </div>
                          </TableCell>
                          <TableCell className="w-[110px]">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-sm">
                                {formatDate(transaction.date)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-[150px]">
                            <div className="flex items-center gap-1">
                              {transaction.type === "thu" ? (
                                <>
                                  <Plus className="w-3 h-3 text-green-500 flex-shrink-0" />
                                  <Badge className="bg-green-100 text-green-800 text-xs truncate">
                                    {t(
                                      `common.incomeCategories.${transaction.description}`,
                                    )}
                                  </Badge>
                                </>
                              ) : (
                                <>
                                  <Minus className="w-3 h-3 text-red-500 flex-shrink-0" />
                                  <Badge className="bg-red-100 text-red-800 text-xs truncate">
                                    {t(`common.${transaction.description}`)}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="w-[180px]">
                            <div
                              className="truncate"
                              title={transaction.source}
                            >
                              {transaction.source}
                            </div>
                          </TableCell>
                          <TableCell className="text-right w-[130px]">
                            {transaction.type === "thu" ? (
                              <span className="text-green-600 font-medium text-sm">
                                {formatCurrency(transaction.amount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right w-[130px]">
                            {transaction.type === "chi" ? (
                              <span className="text-red-600 font-medium text-sm">
                                {formatCurrency(transaction.amount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium w-[140px]">
                            <span className="text-sm">
                              {formatCurrency(transaction.balance)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Income Voucher Modal */}
      <IncomeVoucherModal
        isOpen={showIncomeVoucherModal}
        onClose={handleCloseIncomeModal}
        voucher={selectedVoucher}
        mode={voucherMode}
      />

      {/* Expense Voucher Modal */}
      <ExpenseVoucherModal
        isOpen={showExpenseVoucherModal}
        onClose={handleCloseExpenseModal}
        voucher={selectedVoucher}
        mode={voucherMode}
      />
    </div>
  );
}
