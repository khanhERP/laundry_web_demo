import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useTranslation } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { POSHeader } from "@/components/pos/header";
import { RightSidebar } from "@/components/ui/right-sidebar";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ClipboardCheck,
  Calendar,
  User,
  DollarSign,
  FileText,
  Package,
  ShoppingCart,
  Upload,
  X,
  CheckCircle,
  Plus,
  Search,
  Trash2,
  Download,
} from "lucide-react";
import type {
  PurchaseOrder,
  PurchaseReceiptItem,
  Supplier,
} from "@shared/schema";

interface PurchaseViewPageProps {
  onLogout: () => void;
}

export default function PurchaseViewPage({ onLogout }: PurchaseViewPageProps) {
  const { t, currentLanguage } = useTranslation();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/purchases/view/:id");
  const purchaseId = params?.id ? parseInt(params.id) : null;
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [skuSuggestions, setSkuSuggestions] = useState<Record<number, any[]>>(
    {},
  );
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<
    Record<number, number>
  >({});
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch categories for new product form
  const { data: categories = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
    select: (data: any) => data || [],
  });

  // Fetch payment methods from API
  const { data: paymentMethodsData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"],
    queryFn: async () => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods");
      return response.json();
    },
  });

  // Form state for editing
  const [formData, setFormData] = useState({
    supplierId: "",
    purchaseDate: "",
    purchaseType: "",
    employeeId: "",
    notes: "",
    isPaid: false, // Add isPaid to form state
  });

  // State for editing items
  const [editedItems, setEditedItems] = useState<
    Record<
      number,
      {
        quantity?: number;
        unitPrice?: string;
        discountPercent?: string;
        productName?: string;
        sku?: string;
        productId?: number;
        discountAmount?: string;
        discountAmountInput?: string; // Temporary input for discount amount
        isEditingDiscountAmount?: boolean; // Flag to know if user is typing discount amount
      }
    >
  >({});

  // State for managing payment methods
  const [editPaymentMethods, setEditPaymentMethods] = useState<
    Array<{ method: string; amount: string }>
  >([]);

  // Get enabled payment methods from API
  const getPaymentMethods = () => {
    const paymentMethods = paymentMethodsData || [];
    // Filter to only return enabled payment methods
    return paymentMethods.filter((method: any) => method.enabled === true);
  };

  const paymentMethods = getPaymentMethods();

  // Fetch purchase receipt details
  const {
    data: purchaseOrder,
    isLoading: isOrderLoading,
    error: orderError,
  } = useQuery<PurchaseOrder>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId],
    queryFn: async () => {
      if (!purchaseId) throw new Error("Purchase ID not found");

      console.log("🔍 Fetching purchase receipt with ID:", purchaseId);
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/${purchaseId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Purchase receipt not found");
        }
        throw new Error(`Failed to fetch purchase receipt: ${response.status}`);
      }

      const data = await response.json();
      console.log("📦 Purchase receipt details:", data);
      return data;
    },
    enabled: !!purchaseId,
    retry: 1,
  });

  // Fetch purchase receipt items
  const { data: purchaseItems = [], isLoading: isItemsLoading } = useQuery<
    PurchaseReceiptItem[]
  >({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId, "items"],
    queryFn: async () => {
      if (!purchaseId) throw new Error("Purchase ID not found");

      const response = await fetch(
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/${purchaseId}/items`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch purchase receipt items");
      }

      const data = await response.json();
      console.log("📦 Purchase receipt items:", data);
      return data;
    },
    enabled: !!purchaseId,
  });

  // Fetch attached documents
  const { data: attachedDocuments = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId, "documents"],
    queryFn: async () => {
      if (!purchaseId) throw new Error("Purchase ID not found");

      const response = await fetch(
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/${purchaseId}/documents`,
      );
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      console.log("📎 Attached documents:", data);
      return data;
    },
    enabled: !!purchaseId,
  });

  // Fetch suppliers for name lookup
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers"],
  });

  // Initialize form data when purchase order loads
  useEffect(() => {
    if (purchaseOrder) {
      console.log("📋 Loading purchase order data:", purchaseOrder);
      console.log(
        "📋 Purchase type from database:",
        purchaseOrder.purchaseType,
      );
      setFormData({
        supplierId: purchaseOrder.supplierId?.toString() || "",
        purchaseDate:
          purchaseOrder.purchaseDate || purchaseOrder.actualDeliveryDate || "",
        purchaseType: purchaseOrder.purchaseType || "",
        employeeId: purchaseOrder.employeeId?.toString() || "",
        notes: purchaseOrder.notes || "",
        isPaid: purchaseOrder.isPaid || false, // Initialize isPaid
      });
    }
  }, [purchaseOrder]);

  // Initialize edited items when purchase items load
  useEffect(() => {
    if (purchaseItems.length > 0) {
      const initialItems: Record<number, any> = {};
      purchaseItems.forEach((item) => {
        // Convert discount percent - handle both camelCase and snake_case
        let discountPercent =
          item.discountPercent || item.discount_percent || "0";
        const discountValue = parseFloat(discountPercent);
        // If the value is between 0 and 1, it's likely stored as a decimal, so multiply by 100
        if (discountValue > 0 && discountValue < 1) {
          discountPercent = (discountValue * 100).toString();
        }

        // Get discount amount - handle both camelCase and snake_case - PRESERVE EXACT VALUE
        const discountAmount =
          item.discountAmount || item.discount_amount || "0";

        initialItems[item.id] = {
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: discountPercent,
          productName: item.productName,
          sku: item.sku,
          discountAmount: discountAmount, // Keep as string to preserve exact value
          productId: item.productId,
        };
      });
      setEditedItems(initialItems);
    }
  }, [purchaseItems]);

  // Initialize payment methods from purchaseOrder
  useEffect(() => {
    if (purchaseOrder) {
      const paymentMethodStr =
        purchaseOrder.paymentMethods || purchaseOrder.paymentMethod || "";

      // Calculate total from items
      const itemsTotal = purchaseItems.reduce((sum: number, item: any) => {
        const { total } = calculateItemValues(item.id, item);
        return sum + total;
      }, 0);

      let initialMethod = {
        method: "cash",
        amount: Math.round(itemsTotal).toString(),
      };

      // Try to parse as JSON first
      if (paymentMethodStr && paymentMethodStr.trim() !== "") {
        try {
          const parsed = JSON.parse(paymentMethodStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Chỉ lấy phương thức đầu tiên
            initialMethod = {
              method: parsed[0].method || "cash",
              amount:
                parsed[0].amount?.toString() ||
                Math.round(itemsTotal).toString(),
            };
          } else if (
            typeof parsed === "object" &&
            parsed !== null &&
            parsed.method
          ) {
            initialMethod = {
              method: parsed.method,
              amount:
                parsed.amount?.toString() || Math.round(itemsTotal).toString(),
            };
          }
        } catch (e) {
          // Not JSON, treat as simple string (legacy format)
          const amount =
            purchaseOrder.paymentAmount || Math.round(itemsTotal).toString();
          initialMethod = {
            method: paymentMethodStr,
            amount: amount.toString(),
          };
        }
      }

      // Fallback: if no method but is paid, use cash with total amount
      if (purchaseOrder.isPaid || formData.isPaid) {
        if (!initialMethod.method || initialMethod.amount === "0") {
          initialMethod = {
            method: "cash",
            amount: Math.round(itemsTotal).toString(),
          };
        }
      }

      console.log("🔍 Initialized payment method:", initialMethod);
      setEditPaymentMethods([initialMethod]);
    }
  }, [purchaseOrder, formData.isPaid, purchaseItems]);

  // Fetch employees for display
  const { data: employees = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/employees"],
    select: (data: any[]) =>
      (data || []).map((emp: any) => ({
        id: emp.id,
        name:
          emp.name ||
          `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
          "Unnamed Employee",
      })),
  });

  // Fetch products for selection
  const { data: allProducts = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
    select: (data: any[]) =>
      (data || []).map((product: any) => ({
        ...product,
        unitPrice: Number(product.price) || 0,
      })),
  });

  // Filter products based on search
  const products = useMemo(() => {
    return allProducts.filter(
      (product: any) =>
        productSearch === "" ||
        product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.sku?.toLowerCase().includes(productSearch.toLowerCase()),
    );
  }, [allProducts, productSearch]);

  // State for keyboard navigation in product dialog
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);

  // Reset selected index when products change
  useEffect(() => {
    setSelectedProductIndex(0);
  }, [products]);

  if (!purchaseId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
        <POSHeader />
        <RightSidebar />
        <div className="container mx-auto pt-16 px-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-red-600">
              Invalid Purchase Receipt ID
            </h1>
            <Button onClick={() => navigate("/purchases")} className="mt-4">
              Back to Purchases
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier?.name || t("purchases.unknownSupplier");
  };

  const getEmployeeName = (employeeId: number) => {
    const employee = employees.find((e) => e.id === employeeId);
    return employee?.name || "Không xác định";
  };

  const formatCurrency = (amount: string) => {
    const locale =
      {
        ko: "ko-KR",
        en: "en-US",
        vi: "vi-VN",
      }[currentLanguage] || "en-US";

    const currency =
      {
        ko: "KRW",
        en: "USD",
        vi: "VND",
      }[currentLanguage] || "USD";

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
    }).format(parseFloat(amount || "0"));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString(
        {
          ko: "ko-KR",
          en: "en-US",
          vi: "vi-VN",
        }[currentLanguage] || "en-US",
      );
    } catch (error) {
      console.error("Date parsing error:", error);
      return "-";
    }
  };

  const handleItemChange = (itemId: number, field: string, value: any) => {
    setEditedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const handleProductSelect = (product: any) => {
    if (selectedItemId !== null) {
      // Find the index of the item in purchaseItems array
      const itemIndex = purchaseItems.findIndex(
        (item) => item.id === selectedItemId,
      );

      setEditedItems((prev) => ({
        ...prev,
        [selectedItemId]: {
          ...prev[selectedItemId],
          productId: product.id, // CRITICAL: Save productId
          productName: product.name,
          sku: product.sku,
          unitPrice: product.unitPrice.toString(),
        },
      }));
      setIsProductDialogOpen(false);
      setProductSearch("");
      setSelectedItemId(null);

      // Focus on product name field after selection
      setTimeout(() => {
        if (itemIndex !== -1) {
          const productInput = document.querySelector(
            `[data-field="product-${itemIndex}"]`,
          ) as HTMLInputElement;
          productInput?.focus();
        }
      }, 100);
    }
  };

  // Filter products based on SKU/name input
  const filterProductsBySku = (itemId: number, searchTerm: string) => {
    if (!searchTerm || searchTerm.trim() === "") {
      setSkuSuggestions((prev) => ({ ...prev, [itemId]: [] }));
      return;
    }

    const filtered = allProducts
      .filter((product: any) => {
        const search = searchTerm.toLowerCase();
        return (
          product.name.toLowerCase().includes(search) ||
          product.sku?.toLowerCase().includes(search)
        );
      })
      .slice(0, 5); // Limit to 5 suggestions

    setSkuSuggestions((prev) => ({ ...prev, [itemId]: filtered }));
    setActiveSuggestionIndex((prev) => ({ ...prev, [itemId]: 0 }));
  };

  // Select product from suggestions
  const selectProductFromSuggestion = (itemId: number, product: any) => {
    // Find the index of the item in purchaseItems array
    const itemIndex = purchaseItems.findIndex((item) => item.id === itemId);

    setEditedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.unitPrice.toString(),
      },
    }));
    setSkuSuggestions((prev) => ({ ...prev, [itemId]: [] }));
    setActiveSuggestionIndex((prev) => ({ ...prev, [itemId]: 0 }));

    // Focus on product name field after selection
    setTimeout(() => {
      if (itemIndex !== -1) {
        const productInput = document.querySelector(
          `[data-field="product-${itemIndex}"]`,
        ) as HTMLInputElement;
        productInput?.focus();
      }
    }, 50);
  };

  const handleAddNewRow = () => {
    // Create a new temporary item with a timestamp-based ID
    const newItemId = Date.now();

    // Sync current edited data back to purchaseItems before adding new row
    const syncedItems = purchaseItems.map((item) => {
      const edited = editedItems[item.id];
      if (edited) {
        return {
          ...item,
          productId: edited.productId || item.productId,
          productName: edited.productName || item.productName,
          sku: edited.sku || item.sku,
          quantity: edited.quantity ?? item.quantity,
          unitPrice: edited.unitPrice || item.unitPrice,
          discountPercent: edited.discountPercent || item.discountPercent,
          discountAmount: edited.discountAmount || item.discountAmount, // GIỮ NGUYÊN discountAmount đã chỉnh sửa
        };
      }
      return item;
    });

    const newItem = {
      id: newItemId,
      purchaseReceiptId: purchaseId,
      productId: 0,
      productName: "",
      sku: "",
      quantity: 0,
      receivedQuantity: 0,
      unitPrice: "0",
      total: "0",
      taxRate: "0.00",
      discountPercent: "0",
      discountAmount: "0",
      notes: null,
    };

    // Update purchaseItems with synced data and new item
    queryClient.setQueryData(
      ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId, "items"],
      [...syncedItems, newItem],
    );

    // Initialize editedItems for the new row - GIỮ NGUYÊN dữ liệu đã chỉnh sửa của các dòng cũ
    setEditedItems((prev) => ({
      ...prev,
      [newItemId]: {
        quantity: 0,
        unitPrice: "0",
        discountPercent: "0",
        discountAmount: "0",
        productName: "",
        sku: "",
      },
    }));

    // Focus on SKU field of new row after a short delay
    setTimeout(() => {
      const newRowSkuInput = document.querySelector(
        `[data-field="sku-${syncedItems.length}"]`,
      ) as HTMLInputElement;
      newRowSkuInput?.focus();
    }, 100);
  };

  const openProductSelector = (itemId: number) => {
    setSelectedItemId(itemId);
    setIsProductDialogOpen(true);
  };

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !purchaseId) return;

    setUploadingFiles(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            variant: "destructive",
            title: "Lỗi",
            description: `File ${file.name} vượt quá 10MB`,
          });
          return null;
        }

        // Read file content as base64
        const reader = new FileReader();
        const fileContentPromise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = reader.result as string;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const fileContent = await fileContentPromise;

        // Upload file with original filename preserved
        const response = await fetch(
          `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/${purchaseId}/documents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: file.name,
              originalFileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              description: "",
              fileContent: fileContent,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        return await response.json();
      });

      await Promise.all(uploadPromises);

      toast({
        title: "Thành công",
        description: "Tải lên tệp đính kèm thành công",
      });

      // Refresh documents list
      await queryClient.invalidateQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId, "documents"],
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải lên tệp đính kèm",
      });
    } finally {
      setUploadingFiles(false);
    }
  };

  // Handle file download
  const handleFileDownload = async (document: any) => {
    try {
      console.log("📥 Starting file download:", document);

      const response = await fetch(
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/documents/${document.id}/download`,
        {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Download failed:", errorText);
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      console.log("📦 File blob received:", {
        size: blob.size,
        type: blob.type,
        fileName:
          document.originalFileName ||
          document.fileName ||
          document.document_name,
      });

      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download =
        document.originalFileName ||
        document.fileName ||
        document.document_name ||
        `document_${document.id}`;
      a.style.display = "none";
      window.document.body.appendChild(a);
      a.click();

      // Cleanup after a short delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        window.document.body.removeChild(a);
      }, 100);

      console.log("✅ File download triggered successfully");

      toast({
        title: "Thành công",
        description: "Đã tải xuống tệp",
      });
    } catch (error) {
      console.error("❌ Error downloading file:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải xuống tệp",
      });
    }
  };

  // Handle file deletion
  const handleFileDelete = async (documentId: number) => {
    try {
      console.log("🗑️ Deleting document:", documentId);

      const response = await fetch(
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/documents/${documentId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Failed to delete document:", errorData);
        throw new Error(errorData.error || "Failed to delete file");
      }

      console.log("✅ Document deleted successfully");

      toast({
        title: "Đã xóa",
        description: "Xóa tệp đính kèm thành công",
      });

      // Refresh documents list
      await queryClient.invalidateQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId, "documents"],
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description:
          error instanceof Error ? error.message : "Không thể xóa tệp",
      });
    }
  };

  const calculateItemValues = (itemId: number, originalItem: any) => {
    const edited = editedItems[itemId] || {};
    const quantity = edited.quantity ?? originalItem.quantity;
    const unitPrice = parseFloat(
      (edited.unitPrice ?? originalItem.unitPrice) || "0",
    );
    const subtotal = quantity * unitPrice;

    let discountAmount = 0;
    let discountPercent = 0;

    // Nếu ĐANG chỉnh sửa (có dữ liệu trong editedItems)
    if (Object.keys(edited).length > 0 && isEditMode) {
      // Logic chỉnh sửa
      if (
        (edited as any).updatedFromAmount &&
        (edited as any).discountAmount !== undefined
      ) {
        // User vừa thay đổi discountAmount → LẤY CHÍNH XÁC GIÁ TRỊ ĐÃ NHẬP, KHÔNG tính lại %CK
        discountAmount = parseFloat((edited as any).discountAmount) || 0;
        // LẤY %CK hiện tại từ edited hoặc database, KHÔNG tính lại
        discountPercent = parseFloat(
          edited.discountPercent ??
            originalItem.discountPercent ??
            originalItem.discount_percent ??
            "0",
        );
        if (discountPercent > 0 && discountPercent < 1) {
          discountPercent = discountPercent * 100;
        }
      } else if (
        (edited as any).updatedFromPercent &&
        edited.discountPercent !== undefined
      ) {
        // User VỪA MỚI thay đổi %CK (có flag updatedFromPercent) → tính lại discountAmount
        discountPercent = parseFloat(edited.discountPercent) || 0;
        discountAmount = subtotal * (discountPercent / 100);
      } else if (
        edited.quantity !== undefined ||
        edited.unitPrice !== undefined
      ) {
        // User thay đổi quantity/unitPrice → GIỮ NGUYÊN cả discountAmount VÀ %CK từ edited hoặc DB
        discountAmount = parseFloat(
          edited.discountAmount ??
            (originalItem.discountAmount ||
              originalItem.discount_amount ||
              "0"),
        );
        discountPercent = parseFloat(
          edited.discountPercent ??
            (originalItem.discountPercent ||
              originalItem.discount_percent ||
              "0"),
        );
        if (discountPercent > 0 && discountPercent < 1) {
          discountPercent = discountPercent * 100;
        }
      } else {
        // Vừa bật edit mode HOẶC chưa thay đổi gì → LẤY TRỰC TIẾP từ edited hoặc database
        discountAmount = parseFloat(
          edited.discountAmount ??
            (originalItem.discountAmount ||
              originalItem.discount_amount ||
              "0"),
        );
        discountPercent = parseFloat(
          edited.discountPercent ??
            (originalItem.discountPercent ||
              originalItem.discount_percent ||
              "0"),
        );
        // If stored as decimal (0.1), convert to percentage (10)
        if (discountPercent > 0 && discountPercent < 1) {
          discountPercent = discountPercent * 100;
        }
      }
    } else {
      // KHÔNG chỉnh sửa → LẤY TRỰC TIẾP từ database, KHÔNG tính toán
      discountAmount = parseFloat(
        originalItem.discountAmount || originalItem.discount_amount || "0",
      );
      let dbDiscountPercent =
        originalItem.discountPercent || originalItem.discount_percent || "0";
      discountPercent = parseFloat(dbDiscountPercent);

      // If stored as decimal (0.1), convert to percentage (10)
      if (discountPercent > 0 && discountPercent < 1) {
        discountPercent = discountPercent * 100;
      }
    }

    const total = subtotal - discountAmount;

    return {
      quantity,
      unitPrice,
      discountPercent,
      subtotal,
      discountAmount,
      total,
    };
  };

  // Handle keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    fieldType: string,
  ) => {
    const fieldOrder = [
      "sku",
      "product",
      "quantity",
      "unitPrice",
      "subtotal",
      "discountPercent",
      "discountAmount",
      "total",
    ];
    const currentFieldIndex = fieldOrder.indexOf(fieldType);

    // Enter or Tab - move to next field
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();

      if (
        fieldType === "total" ||
        currentFieldIndex === fieldOrder.length - 1
      ) {
        // At the last field
        if (index < purchaseItems.length - 1) {
          // Not the last row, move to first field of next row
          setTimeout(() => {
            const nextRowInput = document.querySelector(
              `[data-field="${fieldOrder[0]}-${index + 1}"]`,
            ) as HTMLInputElement;
            nextRowInput?.focus();
          }, 50);
        } else if (index === purchaseItems.length - 1 && isEditMode) {
          // Last row in edit mode, add new row
          handleAddNewRow();
        }
      } else {
        // Move to next field in same row
        const nextFieldType = fieldOrder[currentFieldIndex + 1];
        setTimeout(() => {
          const nextInput = document.querySelector(
            `[data-field="${nextFieldType}-${index}"]`,
          ) as HTMLInputElement;
          nextInput?.focus();
        }, 50);
      }
    }
    // Arrow Right - move to next field
    else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (currentFieldIndex < fieldOrder.length - 1) {
        const nextFieldType = fieldOrder[currentFieldIndex + 1];
        setTimeout(() => {
          const nextInput = document.querySelector(
            `[data-field="${nextFieldType}-${index}"]`,
          ) as HTMLInputElement;
          nextInput?.focus();
        }, 50);
      }
    }
    // Arrow Left - move to previous field
    else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (currentFieldIndex > 0) {
        const prevFieldType = fieldOrder[currentFieldIndex - 1];
        setTimeout(() => {
          const prevInput = document.querySelector(
            `[data-field="${prevFieldType}-${index}"]`,
          ) as HTMLInputElement;
          prevInput?.focus();
        }, 50);
      }
    }
    // Arrow Down - move to same field in next row
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (index < purchaseItems.length - 1) {
        setTimeout(() => {
          const nextRowInput = document.querySelector(
            `[data-field="${fieldType}-${index + 1}"]`,
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
            `[data-field="${fieldType}-${index - 1}"]`,
          ) as HTMLInputElement;
          prevRowInput?.focus();
        }, 50);
      }
    }
  };

  if (isOrderLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
        <POSHeader />
        <RightSidebar />
        <div className="container mx-auto pt-16 px-6">
          <div className="text-center py-12">
            <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-500">{t("purchases.loadingOrders")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (orderError) {
    console.error("❌ Error loading purchase receipt:", orderError);
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
        <POSHeader />
        <RightSidebar />
        <div className="container mx-auto pt-16 px-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-red-600">
              {orderError.message === "Purchase receipt not found"
                ? "Purchase Receipt Not Found"
                : "Error Loading Purchase Receipt"}
            </h1>
            <p className="text-gray-600 mt-2">
              Purchase Receipt ID: {purchaseId}
            </p>
            <p className="text-sm text-gray-500 mt-1">{orderError.message}</p>
            <Button onClick={() => navigate("/purchases")} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Purchases
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isOrderLoading && !purchaseOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
        <POSHeader />
        <RightSidebar />
        <div className="container mx-auto pt-16 px-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-red-600">
              Purchase Receipt Not Found
            </h1>
            <p className="text-gray-600 mt-2">
              Purchase Receipt ID: {purchaseId}
            </p>
            <Button onClick={() => navigate("/purchases")} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Purchases
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // This function is defined inline and doesn't need to be memoized.
  const handleSave = async () => {
    try {
      setIsSaving(true);
      console.log("🔍 Frontend: Starting purchase receipt update process");

      // Validate required fields
      if (!formData.supplierId || formData.supplierId === "") {
        toast({
          variant: "destructive",
          title: "Lỗi validation",
          description: "Vui lòng chọn nhà cung cấp",
        });
        setIsSaving(false);
        return;
      }

      if (!formData.purchaseDate || formData.purchaseDate === "") {
        toast({
          variant: "destructive",
          title: "Lỗi validation",
          description: "Vui lòng chọn ngày nhập",
        });
        setIsSaving(false);
        return;
      }

      // Validate payment method if isPaid = true
      if (formData.isPaid) {
        if (
          !editPaymentMethods ||
          editPaymentMethods.length === 0 ||
          !editPaymentMethods[0].method
        ) {
          toast({
            variant: "destructive",
            title: "Lỗi validation",
            description: "Vui lòng chọn phương thức thanh toán",
          });
          setIsSaving(false);
          return;
        }

        const paymentAmount = parseFloat(editPaymentMethods[0].amount || "0");
        if (paymentAmount <= 0) {
          toast({
            variant: "destructive",
            title: "Lỗi validation",
            description: "Số tiền thanh toán phải lớn hơn 0",
          });
          setIsSaving(false);
          return;
        }
      }

      // Validate at least one valid item
      const validItems = purchaseItems.filter((item) => {
        const edited = editedItems[item.id] || {};
        const productName = edited.productName || item.productName || "";
        const productId = edited.productId || item.productId;
        return productName.trim() !== "" && productId;
      });

      if (validItems.length === 0) {
        toast({
          variant: "destructive",
          title: "Lỗi validation",
          description: "Vui lòng thêm ít nhất một sản phẩm hợp lệ",
        });
        setIsSaving(false);
        return;
      }

      // CRITICAL: Prepare payment methods data - CHỈ LẤY 1 PHƯƠNG THỨC
      let paymentMethodData = null;
      let paymentAmountData = null;

      if (formData.isPaid && editPaymentMethods.length > 0) {
        // Chỉ lấy phương thức đầu tiên
        const firstMethod = editPaymentMethods[0];
        paymentMethodData = JSON.stringify({
          method: firstMethod.method,
          amount: parseFloat(firstMethod.amount || "0"),
        });

        paymentAmountData = firstMethod.amount;
      }

      console.log("💰 Payment data to save:", {
        isPaid: formData.isPaid,
        paymentMethod: paymentMethodData,
        paymentAmount: paymentAmountData,
        rawMethods: editPaymentMethods,
      });

      // Update basic order information WITH payment data
      const orderUpdateData = {
        supplierId: parseInt(formData.supplierId),
        purchaseDate: formData.purchaseDate,
        actualDeliveryDate: formData.purchaseDate || null,
        purchaseType: formData.purchaseType || "raw_materials",
        employeeId: formData.employeeId ? parseInt(formData.employeeId) : null,
        notes: formData.notes || "",
        isPaid: formData.isPaid,
        paymentMethod: paymentMethodData, // CRITICAL: Include payment method
        paymentAmount: paymentAmountData, // CRITICAL: Include payment amount
      };

      console.log(
        "📝 Updating purchase receipt with payment info:",
        orderUpdateData,
      );

      // Update purchase receipt
      const receiptResponse = await fetch(
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/${purchaseId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderUpdateData),
        },
      );

      if (!receiptResponse.ok) {
        const errorData = await receiptResponse.json().catch(() => ({
          error: "Lỗi không xác định",
          message: `HTTP ${receiptResponse.status}: ${receiptResponse.statusText}`,
        }));
        console.error(
          "❌ Frontend: Failed to update purchase receipt",
          errorData,
        );
        toast({
          variant: "destructive",
          title: "Lỗi cập nhật phiếu nhập",
          description:
            errorData.error || errorData.message || "Vui lòng thử lại",
        });
        setIsSaving(false);
        return;
      }

      console.log("✅ Purchase receipt updated successfully");

      // GIỮ NGUYÊN THỨ TỰ: Xóa tất cả items cũ và tạo lại theo đúng thứ tự từ UI
      const MAX_VALID_ID = 1000000000; // IDs above this are temporary timestamps
      const existingItemIds = purchaseItems
        .filter((item) => item.id && item.id < MAX_VALID_ID)
        .map((item) => item.id);

      console.log("📊 Items to process:", {
        totalItems: purchaseItems.length,
        validItems: validItems.length,
        existingItemsToDelete: existingItemIds.length,
      });

      // Bước 1: Xóa tất cả items cũ
      if (existingItemIds.length > 0) {
        for (const itemId of existingItemIds) {
          try {
            console.log(`🗑️ Deleting old item: ${itemId}`);
            const response = await fetch(
              `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-order-items/${itemId}`,
              {
                method: "DELETE",
              },
            );

            if (!response.ok) {
              console.warn(
                `⚠️ Failed to delete item ${itemId}, but continuing...`,
              );
            } else {
              console.log(`✅ Deleted item: ${itemId}`);
            }
          } catch (deleteError) {
            console.warn(`⚠️ Error deleting item ${itemId}:`, deleteError);
            // Continue with other deletions
          }
        }
      }

      // Bước 2: Tạo lại tất cả items theo đúng thứ tự từ UI (GIỮ NGUYÊN THỨ TỰ)
      let createdCount = 0;
      for (let index = 0; index < purchaseItems.length; index++) {
        const item = purchaseItems[index];
        const edited = editedItems[item.id] || {};

        // Get basic values
        const quantity = edited.quantity ?? item.quantity;
        const unitPrice = parseFloat(
          (edited.unitPrice ?? item.unitPrice) || "0",
        );
        const subtotal = quantity * unitPrice;

        // LẤY TRỰC TIẾP giá trị từ edited hoặc item
        let discountAmount = 0;
        let discountPercent = 0;

        if (edited.discountAmount !== undefined) {
          discountAmount = parseFloat(edited.discountAmount) || 0;
        } else if (
          item.discountAmount !== undefined ||
          item.discount_amount !== undefined
        ) {
          discountAmount = parseFloat(
            item.discountAmount || item.discount_amount || "0",
          );
        }

        if (edited.discountPercent !== undefined) {
          discountPercent = parseFloat(edited.discountPercent) || 0;
        } else if (
          item.discountPercent !== undefined ||
          item.discount_percent !== undefined
        ) {
          discountPercent = parseFloat(
            item.discountPercent || item.discount_percent || "0",
          );
        }

        const total = subtotal - discountAmount;

        // Skip if product not selected
        const productName = edited.productName || item.productName || "";
        const productId = edited.productId || item.productId;

        if (!productName || productName.trim() === "" || !productId) {
          console.log(
            `⏭️ Skipping item at position ${index + 1} without valid product`,
          );
          continue;
        }

        // Tính toán lại các giá trị cuối cùng từ UI để đảm bảo chính xác
        const {
          quantity: finalQuantity,
          unitPrice: finalUnitPrice,
          discountPercent: finalDiscountPercent,
          discountAmount: finalDiscountAmount,
          total: finalTotal,
        } = calculateItemValues(item.id, item);

        const newItemData = {
          purchaseReceiptId: purchaseId,
          productId: productId,
          productName: productName.trim(),
          sku: edited.sku || item.sku || "",
          quantity: Math.max(0, finalQuantity),
          receivedQuantity: item.receivedQuantity || 0,
          unitPrice: Math.max(0, finalUnitPrice).toFixed(2),
          total: Math.max(0, finalTotal).toFixed(2),
          taxRate: item.taxRate || "0.00",
          discountPercent: Math.max(0, finalDiscountPercent).toFixed(2),
          discountAmount: Math.max(0, finalDiscountAmount).toFixed(2),
          notes: item.notes || null,
          rowOrder: index + 1,
        };

        try {
          console.log(
            `📝 Creating item at position ${index + 1}:`,
            newItemData,
          );

          const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-order-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newItemData),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({
              error: "Lỗi không xác định",
              message: `HTTP ${response.status}`,
            }));
            console.error(
              `❌ Failed to create item at position ${index + 1}:`,
              errorData,
            );
            throw new Error(
              `Không thể tạo sản phẩm dòng ${index + 1}: ${errorData.error || errorData.message}`,
            );
          }

          const result = await response.json();
          console.log(`✅ Created item at position ${index + 1}:`, result);
          createdCount++;
        } catch (itemError) {
          console.error(
            `❌ Error creating item at position ${index + 1}:`,
            itemError,
          );
          throw itemError;
        }
      }

      console.log(
        `✅ Frontend: Update successful - Created ${createdCount} items`,
      );

      toast({
        title: "Thành công!",
        description: `Cập nhật phiếu nhập thành công với ${createdCount} sản phẩm`,
        className: "bg-green-50 border-green-200",
      });

      setIsEditMode(false);

      // Refresh the data
      await queryClient.invalidateQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId, "items"],
      });
    } catch (error: any) {
      console.error("❌ Frontend: Error updating purchase receipt:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Lỗi không xác định";
      toast({
        variant: "destructive",
        title: "Có lỗi xảy ra",
        description: `${errorMessage}. Vui lòng kiểm tra và thử lại.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
      <POSHeader />
      <RightSidebar />

      <div className="container mx-auto px-4 pt-24 pb-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/purchases")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("common.back")}
            </Button>
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                {t("purchases.viewPurchaseOrder")}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {t("purchases.viewOrderDescription")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Order Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {t("purchases.orderDetails")}
              </CardTitle>
              <CardDescription>
                {t("purchases.orderDetailsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Supplier */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium">
                    {t("purchases.supplier")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Select
                    disabled={!isEditMode}
                    value={formData.supplierId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, supplierId: value }))
                    }
                  >
                    <SelectTrigger className="h-9 sm:h-10">
                      <SelectValue
                        placeholder={getSupplierName(
                          parseInt(formData.supplierId),
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier: any) => (
                        <SelectItem
                          key={supplier.id}
                          value={supplier.id.toString()}
                        >
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Receipt Number */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium">
                    {t("purchases.receiptNumberLabel")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={
                      purchaseOrder.receiptNumber ||
                      purchaseOrder.poNumber ||
                      `PR-${purchaseOrder.id}`
                    }
                    disabled
                    className="h-9 sm:h-10 text-sm bg-gray-100"
                  />
                </div>

                {/* Purchase Date */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium">
                    {t("purchases.purchaseDate")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formData.purchaseDate}
                    disabled={!isEditMode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        purchaseDate: e.target.value,
                      }))
                    }
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>

                {/* Purchase Type */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium">
                    {t("purchases.purchaseType")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Select
                    disabled={!isEditMode}
                    value={formData.purchaseType}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, purchaseType: value }))
                    }
                  >
                    <SelectTrigger className="h-9 sm:h-10">
                      <SelectValue
                        placeholder={formData.purchaseType || "Không xác định"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw_materials">
                        {t("purchases.rawMaterials")}
                      </SelectItem>
                      <SelectItem value="expenses">
                        {t("purchases.expenses")}
                      </SelectItem>
                      <SelectItem value="others">
                        {t("purchases.others")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Employee Assignment */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium">
                    {t("purchases.assignedTo")}
                  </label>
                  <Select
                    disabled={!isEditMode}
                    value={formData.employeeId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, employeeId: value }))
                    }
                  >
                    <SelectTrigger className="h-9 sm:h-10">
                      <SelectValue
                        placeholder={
                          formData.employeeId
                            ? getEmployeeName(parseInt(formData.employeeId))
                            : "Không xác định"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee: any) => (
                        <SelectItem
                          key={employee.id}
                          value={employee.id.toString()}
                        >
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* File Attachments - Same position as in purchase-form */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium flex items-center gap-2">
                    <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                    {t("purchases.attachedFilesCount")} (
                    {attachedDocuments?.length || 0})
                  </label>
                  {isEditMode ? (
                    <div>
                      <div
                        className="border border-dashed border-gray-300 rounded-md p-2 text-center bg-gray-50/50 h-9 sm:h-10 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
                        onClick={() =>
                          document.getElementById("file-upload-edit")?.click()
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Upload className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                          <span className="text-xs sm:text-sm text-gray-600">
                            {uploadingFiles
                              ? t("purchases.uploadingFiles")
                              : t("purchases.dragOrClickToUpload")}
                          </span>
                        </div>
                        <input
                          id="file-upload-edit"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.doc,.docx"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e.target.files)}
                          disabled={uploadingFiles}
                        />
                      </div>
                      {attachedDocuments && attachedDocuments.length > 0 && (
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {attachedDocuments.map((doc: any, index: number) => (
                            <div
                              key={doc.id || index}
                              className="flex items-center justify-between bg-white border border-gray-200 rounded p-1.5 text-xs"
                            >
                              <FileText className="h-3 w-3 text-gray-500 shrink-0 mr-1" />
                              <span className="truncate flex-1">
                                {doc.originalFileName || doc.fileName}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-blue-500 hover:text-blue-700"
                                  onClick={() => handleFileDownload(doc)}
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => handleFileDelete(doc.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {attachedDocuments && attachedDocuments.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {attachedDocuments.map((doc: any, index: number) => (
                            <div
                              key={doc.id || index}
                              className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 hover:bg-blue-100 transition-colors"
                            >
                              <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 text-sm truncate">
                                  {doc.originalFileName || doc.fileName}
                                </div>
                                <div className="text-gray-500 text-xs mt-1">
                                  {doc.fileSize
                                    ? `${(doc.fileSize / 1024).toFixed(1)} KB`
                                    : ""}
                                  {doc.fileType ? ` • ${doc.fileType}` : ""}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFileDownload(doc);
                                  }}
                                  title="Tải xuống"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                {isEditMode && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFileDelete(doc.id);
                                    }}
                                    title="Xóa tệp"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border border-gray-300 rounded-md p-4 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
                          <FileText className="h-5 w-5 mr-2 text-gray-400" />
                          {t("purchases.noAttachedFiles")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes - Full width */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">
                  {t("purchases.notes")}
                </label>
                <Textarea
                  value={formData.notes}
                  disabled={!isEditMode}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder={t("purchases.notesPlaceholder")}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              {/* Payment Status and Methods - Same Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Payment Status Checkbox */}
                <div className="md:col-span-5">
                  <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 h-full">
                    <input
                      type="checkbox"
                      checked={formData.isPaid} // Use formData.isPaid for editing
                      disabled={!isEditMode}
                      onChange={(e) => {
                        // Update form data when checkbox changes
                        setFormData((prev) => ({
                          ...prev,
                          isPaid: e.target.checked,
                        }));
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="space-y-1 leading-none">
                      <label className="text-sm font-medium">
                        Đã thanh toán
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Đánh dấu nếu phiếu nhập đã được thanh toán
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Method & Amount - Single payment method only */}
                {(purchaseOrder?.isPaid || formData.isPaid) && (
                  <div className="md:col-span-5">
                    <div className="border rounded-lg p-3 bg-blue-50 h-full">
                      <h4 className="font-semibold mb-2 text-sm">
                        Phương thức thanh toán
                      </h4>

                      {(() => {
                        const getMethodName = (method: string) => {
                          const names: Record<string, string> = {
                            cash: "Tiền mặt",
                            bank_transfer: "Chuyển khoản",
                            credit_card: "Thẻ tín dụng",
                            other: "Khác",
                          };
                          return names[method] || method;
                        };

                        // Tính tổng tiền từ items
                        const itemsTotal = purchaseItems.reduce(
                          (sum: number, item: any) => {
                            const { total } = calculateItemValues(
                              item.id,
                              item,
                            );
                            return sum + total;
                          },
                          0,
                        );

                        const updatePaymentMethod = (
                          field: "method" | "amount",
                          value: string,
                        ) => {
                          const currentMethod = editPaymentMethods[0] || {
                            method: "cash",
                            amount: Math.round(itemsTotal).toString(),
                          };
                          const updated = [
                            { ...currentMethod, [field]: value },
                          ];
                          setEditPaymentMethods(updated);
                          setFormData((prev) => ({
                            ...prev,
                            paymentMethod: JSON.stringify(updated[0]),
                          }));
                        };

                        const currentMethod = editPaymentMethods[0] || {
                          method: "cash",
                          amount: Math.round(itemsTotal).toString(),
                        };

                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-white rounded border text-xs">
                              <div className="space-y-1">
                                <label className="text-xs font-medium">
                                  Phương thức
                                </label>
                                {isEditMode ? (
                                  <Select
                                    value={currentMethod.method || "cash"}
                                    onValueChange={(value) =>
                                      updatePaymentMethod("method", value)
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {paymentMethods.map((method: any) => (
                                        <SelectItem
                                          key={method.id}
                                          value={method.nameKey}
                                        >
                                          {method.name} {method.icon}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="h-8 px-2 py-1 bg-blue-50 border border-blue-200 rounded flex items-center">
                                    <span className="font-medium text-blue-900 text-xs">
                                      {(() => {
                                        // Get the payment method key from currentMethod or purchaseOrder
                                        const methodKey =
                                          currentMethod.method ||
                                          purchaseOrder.paymentMethod;
                                        if (!methodKey) return "-";

                                        // Try to parse if it's JSON
                                        try {
                                          const parsed = JSON.parse(methodKey);
                                          const key =
                                            parsed.method || methodKey;
                                          const foundMethod =
                                            paymentMethods.find(
                                              (m: any) => m.nameKey === key,
                                            );
                                          return foundMethod
                                            ? `${foundMethod.icon} ${foundMethod.name}`
                                            : key;
                                        } catch {
                                          // Not JSON, treat as plain string
                                          const foundMethod =
                                            paymentMethods.find(
                                              (m: any) =>
                                                m.nameKey === methodKey,
                                            );
                                          return foundMethod
                                            ? `${foundMethod.icon} ${foundMethod.name}`
                                            : methodKey;
                                        }
                                      })()}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium">
                                  Số tiền
                                </label>
                                <div className="h-8 px-2 py-1 bg-green-50 border border-green-200 rounded flex items-center justify-end">
                                  <span className="font-semibold text-green-800 text-xs">
                                    {Math.round(itemsTotal).toLocaleString(
                                      "vi-VN",
                                    )}{" "}
                                    ₫
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Payment status display */}
                            {(() => {
                              const paymentAmount = Number(
                                currentMethod.amount || 0,
                              );
                              const difference = itemsTotal - paymentAmount;
                              const isExact = Math.abs(difference) < 1;
                              const isUnderpaid = difference > 1;

                              return (
                                <div className="space-y-1 mt-2">
                                  <div className="flex justify-between items-center pt-2 border-t">
                                    <span className="font-semibold text-sm">
                                      Tổng cần thanh toán:
                                    </span>
                                    <span className="text-base font-bold text-gray-900">
                                      {Math.round(itemsTotal).toLocaleString(
                                        "vi-VN",
                                      )}{" "}
                                      ₫
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t("purchases.items")} ({purchaseItems.length})
                  </CardTitle>
                  <CardDescription>
                    {t("purchases.itemsDescription")}
                  </CardDescription>
                </div>
                {isEditMode && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddNewRow}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("purchases.addItem")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="overflow-x-auto border rounded-lg">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-12 sm:w-16 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          STT
                        </TableHead>
                        <TableHead className="w-20 sm:w-28 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          {t("purchases.productCodeColumn")}
                        </TableHead>
                        <TableHead className="min-w-[120px] sm:min-w-[180px] p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          {t("purchases.itemNameColumn")}
                        </TableHead>
                        <TableHead className="w-12 sm:w-20 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          {t("purchases.unit")}
                        </TableHead>
                        <TableHead className="w-16 sm:w-24 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          {t("purchases.quantity")}
                        </TableHead>
                        <TableHead className="w-20 sm:w-28 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          {t("purchases.unitPrice")}
                        </TableHead>
                        <TableHead className="w-20 sm:w-28 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          {t("purchases.subtotalAmount")}
                        </TableHead>
                        <TableHead className="w-12 sm:w-20 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          {t("purchases.discountPercent")}
                        </TableHead>
                        <TableHead className="w-20 sm:w-28 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          {t("purchases.discountAmount")}
                        </TableHead>
                        <TableHead className="w-24 sm:w-32 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                          {t("purchases.totalAmount")}
                        </TableHead>
                        {isEditMode && (
                          <TableHead className="w-12 text-center p-1 sm:p-2 font-bold text-xs sm:text-sm">
                            {t("common.delete")}
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center py-12 text-gray-500 dark:text-gray-400"
                          >
                            <div className="flex flex-col items-center">
                              <Package className="h-12 w-12 mb-3 opacity-50" />
                              <p className="text-lg font-medium mb-1">
                                {t("purchases.noItemsSelected")}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        purchaseItems.map((item, index) => {
                          const {
                            quantity,
                            unitPrice,
                            discountPercent,
                            subtotal,
                            discountAmount,
                            total,
                          } = calculateItemValues(item.id, item);

                          return (
                            <TableRow
                              key={index}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                            >
                              {/* STT - Sequential Row Number */}
                              <TableCell className="text-center font-semibold text-gray-700 p-1 sm:p-2">
                                <div className="flex items-center justify-center w-10 h-8 bg-gray-100 text-gray-700 rounded text-sm font-bold border border-gray-300">
                                  {index + 1}
                                </div>
                              </TableCell>

                              {/* SKU - Autocomplete with suggestions */}
                              <TableCell className="p-1 sm:p-2">
                                {isEditMode ? (
                                  <div className="relative">
                                    <Input
                                      type="text"
                                      value={
                                        editedItems[item.id]?.sku ??
                                        item.sku ??
                                        ""
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        handleItemChange(item.id, "sku", value);
                                        filterProductsBySku(item.id, value);
                                      }}
                                      onKeyDown={(e) => {
                                        const suggestions =
                                          skuSuggestions[item.id] || [];
                                        const activeIndex =
                                          activeSuggestionIndex[item.id] || 0;
                                        const hasSelectedProduct =
                                          editedItems[item.id]?.productId &&
                                          editedItems[item.id]?.productId > 0;
                                        const hasSuggestions =
                                          suggestions.length > 0;

                                        // Arrow Down/Up - Navigate suggestions
                                        if (e.key === "ArrowDown") {
                                          if (hasSuggestions) {
                                            e.preventDefault();
                                            setActiveSuggestionIndex(
                                              (prev) => ({
                                                ...prev,
                                                [item.id]: Math.min(
                                                  activeIndex + 1,
                                                  suggestions.length - 1,
                                                ),
                                              }),
                                            );
                                          } else if (hasSelectedProduct) {
                                            // Move to same field in next row
                                            handleKeyDown(e, index, "sku");
                                          }
                                        } else if (e.key === "ArrowUp") {
                                          if (hasSuggestions) {
                                            e.preventDefault();
                                            setActiveSuggestionIndex(
                                              (prev) => ({
                                                ...prev,
                                                [item.id]: Math.max(
                                                  activeIndex - 1,
                                                  0,
                                                ),
                                              }),
                                            );
                                          } else if (hasSelectedProduct) {
                                            // Move to same field in previous row
                                            handleKeyDown(e, index, "sku");
                                          }
                                        }
                                        // Enter - Select suggestion OR open dialog OR move next
                                        else if (e.key === "Enter") {
                                          e.preventDefault();

                                          if (hasSuggestions) {
                                            // Case 1: Has suggestions - select from list
                                            selectProductFromSuggestion(
                                              item.id,
                                              suggestions[activeIndex],
                                            );
                                            setTimeout(() => {
                                              const nextInput =
                                                document.querySelector(
                                                  `[data-field="product-${index}"]`,
                                                ) as HTMLInputElement;
                                              nextInput?.focus();
                                            }, 50);
                                          } else if (!hasSelectedProduct) {
                                            // Case 2: No product selected - open dialog
                                            openProductSelector(item.id);
                                          } else {
                                            // Case 3: Product already selected - move to next field
                                            setTimeout(() => {
                                              const nextInput =
                                                document.querySelector(
                                                  `[data-field="product-${index}"]`,
                                                ) as HTMLInputElement;
                                              nextInput?.focus();
                                            }, 50);
                                          }
                                        }
                                        // Tab - Same logic as Enter but respect Tab behavior
                                        else if (e.key === "Tab") {
                                          if (hasSuggestions) {
                                            e.preventDefault();
                                            selectProductFromSuggestion(
                                              item.id,
                                              suggestions[activeIndex],
                                            );
                                            setTimeout(() => {
                                              const nextInput =
                                                document.querySelector(
                                                  `[data-field="product-${index}"]`,
                                                ) as HTMLInputElement;
                                              nextInput?.focus();
                                            }, 50);
                                          } else if (!hasSelectedProduct) {
                                            e.preventDefault();
                                            openProductSelector(item.id);
                                          }
                                          // If product selected, allow normal Tab (don't prevent)
                                        }
                                        // Arrow Right - Move to next field if product selected
                                        else if (e.key === "ArrowRight") {
                                          if (hasSelectedProduct) {
                                            e.preventDefault();
                                            setTimeout(() => {
                                              const nextInput =
                                                document.querySelector(
                                                  `[data-field="product-${index}"]`,
                                                ) as HTMLInputElement;
                                              nextInput?.focus();
                                            }, 50);
                                          }
                                        }
                                        // Arrow Left - Move to previous field if exists
                                        else if (e.key === "ArrowLeft") {
                                          if (index > 0) {
                                            e.preventDefault();
                                            setTimeout(() => {
                                              const prevInput =
                                                document.querySelector(
                                                  `[data-field="total-${index - 1}"]`,
                                                ) as HTMLInputElement;
                                              prevInput?.focus();
                                            }, 50);
                                          }
                                        }
                                      }}
                                      onClick={() => {
                                        const hasSelectedProduct =
                                          editedItems[item.id]?.productId &&
                                          editedItems[item.id]?.productId > 0;
                                        if (!hasSelectedProduct) {
                                          openProductSelector(item.id);
                                        }
                                      }}
                                      tabIndex={0}
                                      data-field={`sku-${index}`}
                                      className="w-20 sm:w-28 text-center text-xs sm:text-sm h-8 bg-white"
                                      placeholder={t(
                                        "purchases.skuPlaceholder",
                                      )}
                                    />
                                    <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />

                                    {/* Suggestions dropdown */}
                                    {skuSuggestions[item.id] &&
                                      skuSuggestions[item.id].length > 0 && (
                                        <div className="absolute z-50 w-64 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                          {skuSuggestions[item.id].map(
                                            (product: any, idx: number) => (
                                              <div
                                                key={product.id}
                                                className={`px-3 py-2 cursor-pointer text-xs ${
                                                  idx ===
                                                  (activeSuggestionIndex[
                                                    item.id
                                                  ] || 0)
                                                    ? "bg-blue-50 text-blue-700"
                                                    : "hover:bg-gray-50"
                                                }`}
                                                onClick={() => {
                                                  selectProductFromSuggestion(
                                                    item.id,
                                                    product,
                                                  );
                                                  setTimeout(() => {
                                                    const nextInput =
                                                      document.querySelector(
                                                        `[data-field="product-${index}"]`,
                                                      ) as HTMLInputElement;
                                                    nextInput?.focus();
                                                  }, 50);
                                                }}
                                              >
                                                <div className="font-medium">
                                                  {product.name}
                                                </div>
                                                <div className="text-gray-500">
                                                  SKU: {product.sku}
                                                </div>
                                                <div className="text-gray-600">
                                                  {product.unitPrice?.toLocaleString(
                                                    "vi-VN",
                                                  )}{" "}
                                                  ₫
                                                </div>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  <span className="text-xs sm:text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                    {item.sku || "-"}
                                  </span>
                                )}
                              </TableCell>

                              {/* Product Name - Display only */}
                              <TableCell className="p-1 sm:p-2">
                                {isEditMode ? (
                                  <Input
                                    type="text"
                                    value={
                                      editedItems[item.id]?.productName ??
                                      item.productName
                                    }
                                    tabIndex={0}
                                    data-field={`product-${index}`}
                                    onKeyDown={(e) =>
                                      handleKeyDown(e, index, "product")
                                    }
                                    className="w-full text-xs sm:text-sm h-8 bg-gray-100"
                                    placeholder={t("purchases.productName")}
                                    readOnly
                                  />
                                ) : (
                                  <div className="flex flex-col">
                                    <p className="font-medium text-gray-900 dark:text-white line-clamp-2 leading-tight text-xs sm:text-sm">
                                      {item.productName || "Unknown Product"}
                                    </p>
                                  </div>
                                )}
                              </TableCell>

                              {/* Unit */}
                              <TableCell className="text-center p-1 sm:p-2">
                                <span className="text-xs sm:text-sm text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded-full">
                                  {t("purchases.unit")}
                                </span>
                              </TableCell>

                              {/* Quantity */}
                              <TableCell className="p-1 sm:p-2">
                                <Input
                                  type="number"
                                  value={quantity}
                                  disabled={!isEditMode}
                                  tabIndex={0}
                                  data-field={`quantity-${index}`}
                                  onFocus={(e) => {
                                    // Clear value if it's 0 when user focuses on the input
                                    if (quantity === 0) {
                                      e.target.value = "";
                                    }
                                  }}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const newQuantity = parseInt(value) || 0;

                                    setEditedItems((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        quantity: newQuantity,
                                        updatedFromAmount: false, // Clear flag - cho phép tính lại từ %CK
                                      },
                                    }));
                                  }}
                                  onBlur={(e) => {
                                    // If user leaves field empty, set to 0
                                    if (e.target.value === "") {
                                      setEditedItems((prev) => ({
                                        ...prev,
                                        [item.id]: {
                                          ...prev[item.id],
                                          quantity: 0,
                                          updatedFromAmount: false,
                                        },
                                      }));
                                    }
                                  }}
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, index, "quantity")
                                  }
                                  className="w-16 text-center text-sm h-8"
                                />
                              </TableCell>

                              {/* Unit Price */}
                              <TableCell className="p-1 sm:p-2">
                                <Input
                                  type="text"
                                  value={unitPrice.toLocaleString("vi-VN")}
                                  disabled={!isEditMode}
                                  data-field={`unitPrice-${index}`}
                                  onChange={(e) => {
                                    const rawValue = e.target.value.replace(
                                      /\./g,
                                      "",
                                    );

                                    setEditedItems((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        unitPrice: rawValue,
                                        updatedFromAmount: false, // Clear flag - cho phép tính lại từ %CK
                                      },
                                    }));
                                  }}
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, index, "unitPrice")
                                  }
                                  className="w-28 text-right text-sm h-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </TableCell>

                              {/* Subtotal */}
                              <TableCell className="p-1 sm:p-2">
                                <Input
                                  type="text"
                                  value={subtotal.toLocaleString("vi-VN")}
                                  disabled={!isEditMode}
                                  data-field={`subtotal-${index}`}
                                  onChange={(e) => {
                                    const rawValue = e.target.value.replace(
                                      /\./g,
                                      "",
                                    );
                                    const newSubtotal =
                                      parseFloat(rawValue) || 0;
                                    const newUnitPrice =
                                      quantity > 0 ? newSubtotal / quantity : 0;
                                    handleItemChange(
                                      item.id,
                                      "unitPrice",
                                      newUnitPrice.toString(),
                                    );
                                  }}
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, index, "subtotal")
                                  }
                                  className="w-28 text-right font-medium text-sm h-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </TableCell>

                              {/* Discount Percent */}
                              <TableCell className="p-1 sm:p-2">
                                <Input
                                  type="text"
                                  value={Math.round(discountPercent).toString()}
                                  disabled={!isEditMode}
                                  data-field={`discountPercent-${index}`}
                                  onChange={(e) => {
                                    const rawValue = e.target.value.replace(
                                      /\./g,
                                      "",
                                    );
                                    const newDiscountPercent =
                                      parseInt(rawValue) || 0;

                                    // Cập nhật %CK và TỰ ĐỘNG tính lại tiền chiết khấu
                                    setEditedItems((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        discountPercent:
                                          newDiscountPercent.toString(),
                                        updatedFromPercent: true, // Flag để tính lại từ %CK
                                        updatedFromAmount: false, // Clear flag amount
                                        discountAmount: undefined, // Clear để tính lại
                                      },
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === "Tab") {
                                      e.preventDefault();
                                      // Giữ nguyên giá trị hiện tại - KHÔNG tính lại
                                      const {
                                        discountPercent: currentPercent,
                                        discountAmount: currentAmount,
                                      } = calculateItemValues(item.id, item);
                                      setEditedItems((prev) => ({
                                        ...prev,
                                        [item.id]: {
                                          ...prev[item.id],
                                          discountPercent:
                                            currentPercent.toString(),
                                          discountAmount:
                                            currentAmount.toString(),
                                          updatedFromPercent: false, // Clear flag - không tính lại
                                          updatedFromAmount: false,
                                        },
                                      }));
                                      // Di chuyển sang field tiếp theo
                                      setTimeout(() => {
                                        const nextInput =
                                          document.querySelector(
                                            `[data-field="discountAmount-${index}"]`,
                                          ) as HTMLInputElement;
                                        nextInput?.focus();
                                      }, 50);
                                    } else {
                                      handleKeyDown(
                                        e,
                                        index,
                                        "discountPercent",
                                      );
                                    }
                                  }}
                                  className="w-20 text-center text-sm h-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </TableCell>

                              {/* Discount Amount */}
                              <TableCell className="p-1 sm:p-2">
                                <Input
                                  type="text"
                                  value={discountAmount.toLocaleString("vi-VN")}
                                  disabled={!isEditMode}
                                  data-field={`discountAmount-${index}`}
                                  onChange={(e) => {
                                    const rawValue = e.target.value.replace(
                                      /\D/g,
                                      "",
                                    );
                                    const newDiscountAmount =
                                      parseFloat(rawValue) || 0;

                                    // Lưu CHÍNH XÁC discountAmount từ UI và flag để KHÔNG tính lại %CK
                                    setEditedItems((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        discountAmount:
                                          newDiscountAmount.toString(), // Lưu chính xác giá trị
                                        updatedFromAmount: true, // Flag để biết đang nhập discount amount
                                      },
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === "Tab") {
                                      e.preventDefault();
                                      // Di chuyển sang field tiếp theo
                                      setTimeout(() => {
                                        const nextInput =
                                          document.querySelector(
                                            `[data-field="total-${index}"]`,
                                          ) as HTMLInputElement;
                                        nextInput?.focus();
                                      }, 50);
                                    } else {
                                      handleKeyDown(e, index, "discountAmount");
                                    }
                                  }}
                                  className="w-28 text-right font-medium text-sm h-8 border-red-300 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </TableCell>

                              {/* Total */}
                              <TableCell className="text-right font-bold text-green-600 text-sm p-2">
                                <Input
                                  type="text"
                                  value={Math.round(total).toLocaleString(
                                    "vi-VN",
                                  )}
                                  disabled={!isEditMode}
                                  data-field={`total-${index}`}
                                  onChange={(e) => {
                                    const rawValue = e.target.value.replace(
                                      /\./g,
                                      "",
                                    );
                                    const newTotal = parseFloat(rawValue) || 0;
                                    const newDiscountAmount =
                                      subtotal - newTotal;
                                    const newDiscountPercent =
                                      subtotal > 0
                                        ? (newDiscountAmount / subtotal) * 100
                                        : 0;

                                    // Cập nhật cả discountAmount và discountPercent, set flag để không tính lại
                                    setEditedItems((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        discountAmount:
                                          newDiscountAmount.toString(),
                                        discountPercent:
                                          newDiscountPercent.toString(),
                                        updatedFromAmount: true, // Flag để giữ nguyên discount amount
                                        updatedFromPercent: false,
                                      },
                                    }));
                                  }}
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, index, "total")
                                  }
                                  className="w-32 text-right font-bold text-green-600 bg-green-50 border-green-300 text-sm h-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </TableCell>

                              {/* Delete Button */}
                              {isEditMode && (
                                <TableCell className="text-center p-1 sm:p-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      // Only allow deletion if the item has a valid ID (i.e., it's not a new, unsaved item)
                                      if (item.id && item.id < 1000000000) {
                                        // Assuming valid IDs are smaller than temporary IDs
                                        try {
                                          const response = await fetch(
                                            `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-order-items/${item.id}`,
                                            {
                                              method: "DELETE",
                                            },
                                          );

                                          if (!response.ok) {
                                            throw new Error(
                                              "Failed to delete item",
                                            );
                                          }

                                          toast({
                                            title: "Đã xóa",
                                            description:
                                              "Xóa sản phẩm thành công",
                                          });

                                          // Refresh the items list
                                          await queryClient.invalidateQueries({
                                            queryKey: [
                                              "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts",
                                              purchaseId,
                                              "items",
                                            ],
                                          });
                                        } catch (error) {
                                          console.error(
                                            "Error deleting item:",
                                            error,
                                          );
                                          toast({
                                            variant: "destructive",
                                            title: "Lỗi",
                                            description:
                                              "Không thể xóa sản phẩm",
                                          });
                                        }
                                      } else {
                                        // If it's a new item (temporary ID), just remove it from the state
                                        setEditedItems((prev) => {
                                          const newState = { ...prev };
                                          delete newState[item.id];
                                          return newState;
                                        });
                                        // Also remove from the displayed purchaseItems array if it's a new one
                                        // This requires updating the query cache if purchaseItems is directly from queryClient
                                        // For simplicity, if new items are added to `editedItems` and not yet persisted,
                                        // we might need a way to manage them before they appear in `purchaseItems`.
                                        // If `purchaseItems` is updated directly when adding new rows, then removing from `purchaseItems` is also needed.
                                        // For now, assuming `purchaseItems` is only populated from server initially.
                                        toast({
                                          title: "Đã xóa",
                                          description:
                                            "Đã xóa sản phẩm tạm thời",
                                        });
                                      }
                                    }}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 w-8 h-8 p-0 rounded-full"
                                    disabled={
                                      item.id < 1000000000 ? false : false
                                    } // Only allow delete for real items, temporary items are handled differently.
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}

                      {/* Summary Row */}
                      {purchaseItems.length > 0 && (
                        <TableRow className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 font-semibold">
                          {/* STT - Total Symbol */}
                          <TableCell className="text-center p-1 sm:p-2">
                            <div className="flex items-center justify-center w-10 h-8 bg-blue-200 text-blue-800 rounded text-sm font-bold">
                              Σ
                            </div>
                          </TableCell>

                          {/* SKU - empty for summary */}
                          <TableCell className="text-center p-1 sm:p-2">
                            <span className="text-xs sm:text-sm text-blue-600">
                              -
                            </span>
                          </TableCell>

                          {/* Total Label */}
                          <TableCell className="p-1 sm:p-2 font-bold text-blue-800 text-xs sm:text-sm">
                            {t("common.total")}
                          </TableCell>

                          {/* Unit */}
                          <TableCell className="text-center p-1 sm:p-2">
                            <span className="text-xs sm:text-sm text-blue-600">
                              -
                            </span>
                          </TableCell>

                          {/* Total Quantity */}
                          <TableCell className="p-1 sm:p-2">
                            <div className="w-16 text-center font-bold text-blue-800 bg-blue-100 border border-blue-300 rounded px-1.5 py-0.5 text-xs sm:text-sm">
                              {purchaseItems.reduce((sum, item) => {
                                const { quantity } = calculateItemValues(
                                  item.id,
                                  item,
                                );
                                return sum + quantity;
                              }, 0)}
                            </div>
                          </TableCell>

                          {/* Unit Price - not displayed */}
                          <TableCell className="p-1 sm:p-2">
                            <span className="text-xs sm:text-sm text-blue-600">
                              -
                            </span>
                          </TableCell>

                          {/* Total Subtotal */}
                          <TableCell className="p-1 sm:p-2">
                            <div className="w-28 text-right font-bold text-blue-800 bg-blue-100 border border-blue-300 rounded px-1.5 py-0.5 text-xs sm:text-sm">
                              {purchaseItems
                                .reduce((sum, item) => {
                                  const { subtotal } = calculateItemValues(
                                    item.id,
                                    item,
                                  );
                                  return sum + subtotal;
                                }, 0)
                                .toLocaleString("ko-KR")}
                            </div>
                          </TableCell>

                          {/* Discount Percent - not displayed */}
                          <TableCell className="p-1 sm:p-2">
                            <span className="text-xs sm:text-sm text-blue-600">
                              -
                            </span>
                          </TableCell>

                          {/* Total Discount */}
                          <TableCell className="p-1 sm:p-2">
                            <div className="w-28 text-right font-bold text-red-800 bg-red-100 border border-red-300 rounded px-1.5 py-0.5 text-xs sm:text-sm">
                              {purchaseItems
                                .reduce((sum, item) => {
                                  const { discountAmount } =
                                    calculateItemValues(item.id, item);
                                  return sum + discountAmount;
                                }, 0)
                                .toLocaleString("ko-KR")}
                            </div>
                          </TableCell>

                          {/* Final Total */}
                          <TableCell className="p-1 sm:p-2">
                            <div className="w-32 text-right font-bold text-green-800 bg-green-100 border border-green-300 rounded px-1.5 py-0.5 text-xs sm:text-sm">
                              {(() => {
                                const finalTotal = purchaseItems.reduce(
                                  (sum, item) => {
                                    const { total } = calculateItemValues(
                                      item.id,
                                      item,
                                    );
                                    return sum + total;
                                  },
                                  0,
                                );
                                return Math.round(finalTotal).toLocaleString(
                                  "vi-VN",
                                );
                              })()}
                            </div>
                          </TableCell>

                          {/* Empty cell for delete button column */}
                          {isEditMode && (
                            <TableCell className="p-1 sm:p-2"></TableCell>
                          )}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={() => navigate("/purchases")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("common.back")}
            </Button>
            {!isEditMode ? (
              <Button
                onClick={async () => {
                  // Tải lại dữ liệu từ server trước khi cho phép chỉnh sửa
                  await queryClient.invalidateQueries({
                    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId],
                  });
                  await queryClient.invalidateQueries({
                    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId, "items"],
                  });
                  await queryClient.invalidateQueries({
                    queryKey: [
                      "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts",
                      purchaseId,
                      "documents",
                    ],
                  });

                  // Đợi dữ liệu load xong (refetch data)
                  await queryClient.refetchQueries({
                    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId],
                  });
                  await queryClient.refetchQueries({
                    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId, "items"],
                  });

                  // Bật chế độ chỉnh sửa
                  setIsEditMode(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                {t("common.edit")}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    setIsEditMode(false);

                    // Reload all data from server
                    await queryClient.invalidateQueries({
                      queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId],
                    });
                    await queryClient.invalidateQueries({
                      queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", purchaseId, "items"],
                    });
                    await queryClient.invalidateQueries({
                      queryKey: [
                        "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts",
                        purchaseId,
                        "documents",
                      ],
                    });

                    // Reset form data to original values
                    if (purchaseOrder) {
                      setFormData({
                        supplierId: purchaseOrder.supplierId?.toString() || "",
                        purchaseDate:
                          purchaseOrder.purchaseDate ||
                          purchaseOrder.actualDeliveryDate ||
                          "",
                        purchaseType: purchaseOrder.purchaseType || "",
                        employeeId: purchaseOrder.employeeId?.toString() || "",
                        notes: purchaseOrder.notes || "",
                        isPaid: purchaseOrder.isPaid || false, // Reset isPaid
                      });
                    }
                    // Reset edited items to original values
                    if (purchaseItems.length > 0) {
                      const initialItems: Record<number, any> = {};
                      purchaseItems.forEach((item) => {
                        initialItems[item.id] = {
                          quantity: item.quantity,
                          unitPrice: item.unitPrice,
                          discountPercent:
                            item.discountPercent ||
                            item.discount_percent ||
                            "0",
                          productName: item.productName,
                          sku: item.sku,
                          discountAmount: item.discountAmount, // Reset discountAmount
                        };
                      });
                      setEditedItems(initialItems);
                    }
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isSaving}
                  onClick={handleSave}
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      {t("common.loading")}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t("common.save")}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Selection Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("purchases.selectProducts")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder={t("purchases.searchProducts")}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedProductIndex((prev) =>
                      prev < products.length - 1 ? prev + 1 : prev,
                    );
                    // Scroll to selected item
                    setTimeout(() => {
                      const element = document.querySelector(
                        `[data-product-index="${selectedProductIndex + 1}"]`,
                      );
                      element?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    }, 0);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedProductIndex((prev) =>
                      prev > 0 ? prev - 1 : 0,
                    );
                    // Scroll to selected item
                    setTimeout(() => {
                      const element = document.querySelector(
                        `[data-product-index="${selectedProductIndex - 1}"]`,
                      );
                      element?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    }, 0);
                  } else if (e.key === "Enter" && products.length > 0) {
                    e.preventDefault();
                    handleProductSelect(products[selectedProductIndex]);
                  }
                }}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Product List */}
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("purchases.productName")}</TableHead>
                    <TableHead>{t("purchases.sku")}</TableHead>
                    <TableHead className="text-right">
                      {t("purchases.unitPrice")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("inventory.stock")}
                    </TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-gray-500"
                      >
                        {t("purchases.noItems")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product: any, index: number) => (
                      <TableRow
                        key={product.id}
                        data-product-index={index}
                        className={`cursor-pointer transition-colors ${
                          index === selectedProductIndex
                            ? "bg-blue-50 border-l-4 border-l-blue-500"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => handleProductSelect(product)}
                      >
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {product.sku || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.unitPrice.toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-center">
                          {product.stock || 0}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProductSelect(product);
                            }}
                            className={
                              index === selectedProductIndex
                                ? "text-blue-600"
                                : ""
                            }
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
