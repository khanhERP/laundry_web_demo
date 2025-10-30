import { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Calendar,
  Plus,
  Search,
  Trash2,
  ShoppingCart,
  Package,
  Calculator,
  Save,
  Send,
  X,
  Upload,
  FileText,
  Image,
  Download,
  ClipboardCheck,
  Edit,
  CheckCircle,
} from "lucide-react";
import {
  insertPurchaseReceiptSchema,
  insertPurchaseReceiptItemSchema,
  insertProductSchema,
} from "@shared/schema";
import { format } from "date-fns";

// Import types we need
type PurchaseOrderItem = {
  productId: number;
  productName: string;
  sku?: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  total: number;
};

// Form validation schema using shared schema
const purchaseFormSchema = insertPurchaseReceiptSchema.extend({
  items: z
    .array(
      insertPurchaseReceiptItemSchema.extend({
        productName: z.string(),
        sku: z.string().optional(),
        receivedQuantity: z.number().default(0),
      }),
    )
    .min(1, "At least one item is required"),
  purchaseType: z.string().optional(),
});

type PurchaseFormData = z.infer<typeof purchaseFormSchema>;

// Product selection interface
interface ProductSelectionItem {
  id: number;
  name: string;
  sku?: string;
  stock: number;
  unitPrice: number;
}

interface PurchaseFormPageProps {
  id?: string;
  viewOnly?: boolean;
  onLogout: () => void;
}

export default function PurchaseFormPage({
  id,
  viewOnly = false,
  onLogout,
}: PurchaseFormPageProps) {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [isNewProductDialogOpen, setIsNewProductDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [selectedItems, setSelectedItems] = useState<
    Array<{
      productId: number;
      productName: string;
      sku?: string;
      quantity: number;
      receivedQuantity: number;
      unitPrice: number;
      total: number;
      discountPercent?: number; // Added for clarity
      discountAmount?: number; // Added for clarity
      updatedFromAmount?: boolean; // Flag for UI update source
      updatedFromPercent?: boolean; // Flag for UI update source
    }>
  >([]);
  const [skuSuggestions, setSkuSuggestions] = useState<Record<number, any[]>>(
    {},
  );
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<
    Record<number, number>
  >({});
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{
      id?: number;
      fileName: string;
      originalFileName: string;
      fileType: string;
      fileSize: number;
      filePath?: string;
      file?: File;
      description?: string;
    }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // State to control submit button

  // State for managing payment methods
  const [editPaymentMethods, setEditPaymentMethods] = useState<
    Array<{ method: string; amount: string }>
  >([]);

  const isEditMode = Boolean(id) && !viewOnly;

  // Fetch user info and store settings for storeCode
  const { data: userInfo } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/auth/verify"],
    retry: false,
  });

  const { data: storeSettings } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings"],
  });

  // Form setup
  const form = useForm<z.infer<typeof insertPurchaseReceiptSchema>>({
    resolver: zodResolver(insertPurchaseReceiptSchema),
    defaultValues: {
      receiptNumber: `PN${Date.now()}`,
      supplierId: 0,
      purchaseDate: format(new Date(), "yyyy-MM-dd"),
      actualDeliveryDate: "",
      notes: "",
      subtotal: "0.00",
      tax: "0.00",
      total: "0.00",
      isPaid: false,
      paymentMethod: "",
      paymentAmount: "",
    },
    mode: "onChange", // Enable real-time validation
  });

  // New product form
  const newProductForm = useForm({
    resolver: zodResolver(
      insertProductSchema.extend({
        categoryId: z.number(),
        productType: z.number().default(1),
        price: z.string(),
        stock: z.number().default(0),
        trackInventory: z.boolean().default(true),
        taxRate: z.string().default("8.00"),
      }),
    ),
    defaultValues: {
      name: "",
      sku: "",
      categoryId: 1,
      productType: 1,
      price: "0",
      stock: 0,
      trackInventory: true,
      isActive: true,
      taxRate: "8.00",
    },
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers"],
    select: (data: any) => data || [],
  });

  // Fetch employees for assignment
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

  // Fetch categories for new product form
  const { data: categories = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
    select: (data: any) => data || [],
  });

  // Fetch payment methods
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"],
    select: (data: any[]) =>
      (data || [])
        .filter((method: any) => method.enabled === true) // Only show enabled payment methods
        .map((method: any) => ({
          id: method.id,
          name: method.name,
          nameKey: method.nameKey,
          icon: method.icon || "",
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

  // Fetch existing purchase order for edit mode
  const { data: existingOrder, isLoading: isLoadingOrder } = useQuery({
    queryKey: [`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-orders/${id}`],
    enabled: Boolean(id),
    select: (data: any) => {
      console.log("📊 Purchase order API response:", data);
      return data;
    },
  });

  // Fetch existing documents for edit mode
  const { data: existingDocuments } = useQuery({
    queryKey: [`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-orders/${id}/documents`],
    enabled: Boolean(id),
    select: (data: any) => data || [],
  });

  // Fetch next PO number for new orders
  const {
    data: nextPONumber,
    error: nextPOError,
    isLoading: isLoadingPONumber,
  } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-orders/next-po-number"],
    enabled: !isEditMode,
    queryFn: async () => {
      try {
        console.log("🔍 Fetching next PO number...");
        const response = await apiRequest(
          "GET",
          "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-orders/next-po-number",
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        console.log("📊 PO Number API Response:", data);
        return data?.nextPONumber || "PO001";
      } catch (error) {
        console.error("❌ PO Number API Error:", error);
        // Generate client-side fallback with proper format
        const fallbackPO = "PO001";
        console.log("🔄 Using client-side fallback PO:", fallbackPO);
        return fallbackPO;
      }
    },
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Log PO number fetch status
  useEffect(() => {
    console.log("🔍 PO Number Query Status:", {
      isEditMode,
      nextPONumber,
      nextPOError: nextPOError?.message,
      isLoadingPONumber,
      enabled: !isEditMode,
    });

    if (nextPOError) {
      console.error("❌ Next PO number fetch error:", nextPOError);
      // Generate fallback PO number with proper format
      const fallbackPO = "PO001";
      console.log("🔄 Using fallback PO number:", fallbackPO);
      form.setValue("poNumber", fallbackPO);
    }

    if (nextPONumber) {
      console.log("✅ Successfully fetched next PO number:", nextPONumber);
    }
  }, [nextPONumber, nextPOError, isLoadingPONumber, isEditMode, form]);

  // Set default PO number if available and not in edit mode and field is empty
  useEffect(() => {
    if (!isEditMode && nextPONumber) {
      const currentValue = form.getValues("poNumber");
      // Only set if field is completely empty (not just whitespace)
      if (!currentValue || currentValue.trim() === "") {
        console.log("🔢 Setting auto-generated PO number:", nextPONumber);
        form.setValue("poNumber", nextPONumber);
        form.trigger("poNumber"); // Trigger validation to update UI
      }
    }
  }, [nextPONumber, isEditMode, form]);

  // Initialize empty PO number for create mode and add default empty row
  useEffect(() => {
    if (!isEditMode && !nextPONumber && !isLoadingPONumber && !nextPOError) {
      console.log("🆕 Initializing empty PO number for new order");
      // Don't clear if already has a value (like fallback)
      if (!form.getValues("poNumber")) {
        form.setValue("poNumber", "");
      }
    }

    // Add default empty row for new purchase orders
    if (!isEditMode && selectedItems.length === 0) {
      console.log("🆕 Adding default empty row for new purchase order");
      const defaultEmptyRow = {
        productId: 0,
        productName: "",
        sku: "",
        quantity: 0,
        receivedQuantity: 0,
        unitPrice: 0,
        total: 0,
        discountPercent: 0,
        discountAmount: 0,
      };
      setSelectedItems([defaultEmptyRow]);
    }
  }, [
    isEditMode,
    nextPONumber,
    isLoadingPONumber,
    nextPOError,
    form,
    selectedItems.length,
  ]);

  // Load existing order data
  useEffect(() => {
    if (existingOrder && typeof existingOrder === "object") {
      const order = existingOrder as any;
      console.log("📋 Loading existing order data:", order);

      // Load basic order information
      form.setValue("supplierId", order.supplierId || order.supplierid);
      form.setValue("receiptNumber", order.receiptNumber || order.ponumber);
      form.setValue(
        "purchaseDate",
        order.purchaseDate || order.purchasedate || "",
      );
      form.setValue("notes", order.notes || "");
      form.setValue("purchaseType", order.purchaseType || "");
      form.setValue("employeeId", order.employeeId || order.employeeid);

      // Set financial totals
      form.setValue("subtotal", order.subtotal || "0.00");
      form.setValue("tax", order.tax || "0.00");
      form.setValue("total", order.total || "0.00");

      // Set payment information
      form.setValue("isPaid", order.isPaid || order.is_paid || false);
      form.setValue(
        "paymentMethod",
        order.paymentMethod || order.payment_method || "",
      );
      form.setValue(
        "paymentAmount",
        order.paymentAmount || order.payment_amount || "",
      );

      // Initialize payment methods
      const paymentMethodStr =
        order.paymentMethod || order.payment_method || "";
      let initialMethods: Array<{ method: string; amount: string }> = [];

      try {
        const parsed = JSON.parse(paymentMethodStr);
        if (Array.isArray(parsed)) {
          initialMethods = parsed;
        } else if (
          typeof parsed === "object" &&
          parsed !== null &&
          parsed.method &&
          parsed.amount
        ) {
          initialMethods = [parsed];
        }
      } catch (e) {
        if (paymentMethodStr && (order.paymentAmount || order.payment_amount)) {
          initialMethods = [
            {
              method: paymentMethodStr,
              amount: (
                order.paymentAmount ||
                order.payment_amount ||
                "0"
              ).toString(),
            },
          ];
        }
      }

      if (initialMethods.length === 0 && (order.isPaid || order.is_paid)) {
        initialMethods = [{ method: "cash", amount: "0" }];
      }

      setEditPaymentMethods(initialMethods);

      // Load existing items - fix the items loading logic
      if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        console.log("📦 Loading order items:", order.items);
        setSelectedItems(
          order.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName || "Unknown Product",
            sku: item.sku || "",
            quantity: item.quantity || 0,
            receivedQuantity: item.receivedQuantity || 0,
            unitPrice: parseFloat(item.unitPrice || "0"),
            total:
              parseFloat(item.total || "0") ||
              parseFloat(item.unitPrice || "0") * (item.quantity || 0),
            discountPercent: parseFloat(item.discountPercent || "0"),
            discountAmount: parseFloat(item.discountAmount || "0"),
          })),
        );
      } else {
        console.log(
          "⚠️ No items found in order or items is not an array, adding default row",
        );
        // Add a default empty row for editing
        const defaultEmptyRow = {
          productId: 0,
          productName: "",
          sku: "",
          quantity: 0,
          receivedQuantity: 0,
          unitPrice: 0,
          total: 0,
          discountPercent: 0,
          discountAmount: 0,
        };
        setSelectedItems([defaultEmptyRow]);
      }
    }
  }, [existingOrder, form]);

  // Load existing documents
  useEffect(() => {
    if (existingDocuments && Array.isArray(existingDocuments)) {
      setAttachedFiles(
        existingDocuments.map((doc: any) => ({
          id: doc.id,
          fileName: doc.fileName,
          originalFileName: doc.originalFileName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          filePath: doc.filePath,
          description: doc.description,
        })),
      );
    }
  }, [existingDocuments]);

  // Update form items when selectedItems changes - convert to schema format
  useEffect(() => {
    const schemaItems = selectedItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku || "",
      quantity: item.quantity,
      receivedQuantity: item.receivedQuantity,
      unitPrice: item.unitPrice.toFixed(2),
      total: item.total.toFixed(2),
    }));
    form.setValue("items", schemaItems);
  }, [selectedItems, form]);

  // Remove the complex saveMutation since we're now handling submission directly in onSubmit

  // Create new product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products", data);
      return response.json();
    },
    onSuccess: (newProduct) => {
      toast({
        title: t("common.success"),
        description:
          t("inventory.productCreated") || "Product created successfully",
      });

      // Update products query cache
      queryClient.setQueryData(["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"], (old: any[]) => {
        return [
          ...(old || []),
          { ...newProduct, unitPrice: Number(newProduct.price) || 0 },
        ];
      });

      // Invalidate queries for cache consistency
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"] });

      // Add new product to selected items automatically
      addProduct({
        id: newProduct.id,
        name: newProduct.name,
        sku: newProduct.sku,
        stock: newProduct.stock,
        unitPrice: Number(newProduct.price) || 0,
      });

      // Close dialog and reset form
      setIsNewProductDialogOpen(false);
      newProductForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("common.unexpectedError"),
        variant: "destructive",
      });
    },
  });

  // Handle new product creation
  const handleCreateNewProduct = (data: any) => {
    const payload = {
      name: data.name,
      sku: data.sku || "",
      categoryId: data.categoryId,
      productType: data.productType,
      price: data.price,
      stock: data.stock,
      trackInventory: data.trackInventory,
      isActive: true,
      taxRate: data.taxRate,
    };

    createProductMutation.mutate(payload);
  };

  // Handle product selection from keyboard
  const handleProductSelect = (product: ProductSelectionItem) => {
    addProduct(product);

    // Auto-focus to product name field after selection
    setTimeout(() => {
      // Find the index of the item that was just updated
      const targetIndex =
        selectedItemId !== null
          ? selectedItems.findIndex((item) => item.productId === selectedItemId)
          : selectedItems.findIndex(
              (item) => item.productId === 0 || item.productId === product.id,
            );

      if (targetIndex >= 0) {
        const productInput = document.querySelector(
          `[data-testid="input-product-${targetIndex}"]`,
        ) as HTMLInputElement;
        if (productInput) {
          productInput.focus();
          productInput.select();
        }
      }
    }, 150);
  };

  // Add product to order
  const addProduct = (product: ProductSelectionItem) => {
    // If replacing an existing item
    if (selectedItemId !== null) {
      const itemIndex = selectedItems.findIndex(
        (item) => item.productId === selectedItemId,
      );

      if (itemIndex >= 0) {
        const updatedItems = [...selectedItems];
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unitPrice: product.unitPrice || 0,
          total: updatedItems[itemIndex].quantity * (product.unitPrice || 0),
        };
        setSelectedItems(updatedItems);
        setSelectedItemId(null);
        setIsProductDialogOpen(false);
        return;
      }
    }

    const existingIndex = selectedItems.findIndex(
      (item) => item.productId === product.id,
    );

    if (existingIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...selectedItems];
      updatedItems[existingIndex].quantity += 1;
      updatedItems[existingIndex].total =
        updatedItems[existingIndex].quantity *
        updatedItems[existingIndex].unitPrice;
      setSelectedItems(updatedItems);
    } else {
      // Find first empty row (productId = 0) to replace
      const emptyRowIndex = selectedItems.findIndex(
        (item) => item.productId === 0,
      );

      const newItem = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 0,
        receivedQuantity: 0,
        unitPrice: product.unitPrice || 0,
        total: 0,
        discountPercent: 0,
        discountAmount: 0,
      };

      if (emptyRowIndex >= 0) {
        // Replace empty row with new product
        const updatedItems = [...selectedItems];
        updatedItems[emptyRowIndex] = newItem;
        setSelectedItems(updatedItems);
      } else {
        // No empty row found, add new item
        setSelectedItems([...selectedItems, newItem]);
      }
    }
    setSelectedItemId(null);
    setIsProductDialogOpen(false);
  };

  // Update item quantity, price, or receivedQuantity
  const updateItem = (
    index: number,
    field: keyof (typeof selectedItems)[0],
    value: number | string,
  ) => {
    const updatedItems = [...selectedItems];
    if (field === "productName") {
      updatedItems[index][field] = value as string;
    } else {
      updatedItems[index][field] = value as number;
    }

    // Recalculate total if quantity or unitPrice changes
    if (field === "quantity" || field === "unitPrice") {
      const item = updatedItems[index];
      item.total = item.quantity * item.unitPrice;

      // Khi quantity/price thay đổi: tính lại discountAmount từ %CK hiện tại
      const subtotal = item.quantity * item.unitPrice;
      const discountPercent = (item as any).discountPercent || 0;
      (item as any).discountAmount = subtotal * (discountPercent / 100);
      (item as any).updatedFromPercent = true;
      (item as any).updatedFromAmount = false;
    }
    setSelectedItems(updatedItems);
  };

  // Handle keyboard navigation with Arrow keys, Enter, and Tab
  const handleKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    fieldType: string,
  ) => {
    // Define field order for navigation - sku is first, then product name
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
        // At the last field (total), check if this is the last row
        if (index === selectedItems.length - 1) {
          // Last row - add new row and focus on SKU field of new row
          addNewEmptyRow();
          setTimeout(() => {
            const newRowSkuInput = document.querySelector(
              `[data-testid="input-sku-${index + 1}"]`,
            ) as HTMLInputElement;
            if (newRowSkuInput) {
              newRowSkuInput.focus();
            }
          }, 100);
        } else {
          // Not last row - move to SKU field of next row
          setTimeout(() => {
            const nextRowSkuInput = document.querySelector(
              `[data-testid="input-sku-${index + 1}"]`,
            ) as HTMLInputElement;
            if (nextRowSkuInput) {
              nextRowSkuInput.focus();
            }
          }, 50);
        }
      } else {
        // Move to next field in same row
        const nextFieldType = fieldOrder[currentFieldIndex + 1];
        setTimeout(() => {
          const nextInput = document.querySelector(
            `[data-testid="input-${nextFieldType}-${index}"]`,
          ) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
          }
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
            `[data-testid="input-${nextFieldType}-${index}"]`,
          ) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
          }
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
            `[data-testid="input-${prevFieldType}-${index}"]`,
          ) as HTMLInputElement;
          if (prevInput) {
            prevInput.focus();
          }
        }, 50);
      }
    }
    // Arrow Down - move to same field in next row
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (index < selectedItems.length - 1) {
        setTimeout(() => {
          const nextRowInput = document.querySelector(
            `[data-testid="input-${fieldType}-${index + 1}"]`,
          ) as HTMLInputElement;
          if (nextRowInput) {
            nextRowInput.focus();
          }
        }, 50);
      }
    }
    // Arrow Up - move to same field in previous row
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) {
        setTimeout(() => {
          const prevRowInput = document.querySelector(
            `[data-testid="input-${fieldType}-${index - 1}"]`,
          ) as HTMLInputElement;
          if (prevRowInput) {
            prevRowInput.focus();
          }
        }, 50);
      }
    }
  };

  // Add new empty row
  const addNewEmptyRow = () => {
    const newEmptyRow = {
      productId: 0,
      productName: "",
      sku: "",
      quantity: 0,
      receivedQuantity: 0,
      unitPrice: 0,
      total: 0,
      discountPercent: 0,
      discountAmount: 0,
    };
    setSelectedItems([...selectedItems, newEmptyRow]);
    console.log(
      "➕ Added new empty row, total items:",
      selectedItems.length + 1,
    );
  };

  // Check if form has valid data for submission
  const hasValidData = () => {
    const formData = form.getValues();
    const hasSupplier = formData.supplierId && formData.supplierId > 0;
    const hasValidItems = selectedItems.some(
      (item) =>
        item.productName &&
        item.productName.trim() !== "" &&
        item.quantity > 0 &&
        item.unitPrice >= 0,
    );

    return hasSupplier && hasValidItems;
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
  const selectProductFromSuggestion = (index: number, product: any) => {
    const updatedItems = [...selectedItems];

    // Update the item at the specified index
    if (index >= 0 && index < updatedItems.length) {
      updatedItems[index] = {
        ...updatedItems[index],
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.unitPrice || 0,
        total: updatedItems[index].quantity * (product.unitPrice || 0),
        // Reset discount flags when a new product is selected
        discountPercent: 0,
        discountAmount: 0,
        updatedFromAmount: false,
        updatedFromPercent: false,
      };
    }

    setSelectedItems(updatedItems);
    setSkuSuggestions((prev) => ({ ...prev, [index]: [] }));
    setActiveSuggestionIndex((prev) => ({ ...prev, [index]: 0 }));

    // Auto-focus to product name field after selection
    setTimeout(() => {
      const productInput = document.querySelector(
        `[data-testid="input-product-${index}"]`,
      ) as HTMLInputElement;
      if (productInput) {
        productInput.focus();
        productInput.select(); // Also select the text for easy viewing
      }
    }, 100);
  };

  // Remove item
  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  // Calculate totals
  const subtotal = selectedItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = 0; // No tax applied
  const tax = 0;
  const total = subtotal;

  // File handling functions
  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t("common.error"),
          description: t("purchases.fileSizeExceeded"),
          variant: "destructive",
        });
        return;
      }

      // Check file type
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: t("common.error"),
          description: t("purchases.unsupportedFileType"),
          variant: "destructive",
        });
        return;
      }

      const newFile = {
        fileName: file.name, // Use original filename directly
        originalFileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        file: file,
        description: "",
      };

      setAttachedFiles((prev) => [...prev, newFile]);
    });
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFileDescription = (index: number, description: string) => {
    setAttachedFiles((prev) =>
      prev.map((file, i) => (i === index ? { ...file, description } : file)),
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (fileType === "application/pdf") return <FileText className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  // Form submission
  const onSubmit = async (
    values: z.infer<typeof insertPurchaseReceiptSchema>,
  ) => {
    try {
      setIsSubmitting(true);
      console.log("🔍 Form submission values:", values);

      // Check if we have any items
      if (selectedItems.length === 0) {
        toast({
          title: "Lỗi",
          description: "Vui lòng thêm ít nhất một sản phẩm",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Filter out valid items - be more lenient with validation
      const validItems = selectedItems.filter((item) => {
        const hasProductName =
          item.productName && item.productName.trim() !== "";
        const hasQuantity = item.quantity > 0;
        const hasPrice = item.unitPrice >= 0;

        return hasProductName && hasQuantity && hasPrice;
      });

      console.log("📋 Item validation result:", {
        totalItems: selectedItems.length,
        validItems: validItems.length,
        invalidItems: selectedItems.length - validItems.length,
      });

      if (validItems.length === 0) {
        toast({
          title: "Lỗi",
          description:
            "Vui lòng thêm ít nhất một sản phẩm với tên, số lượng và giá hợp lệ",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Get form values
      const formValues = form.getValues();

      // Auto-generate receipt number if empty
      let finalReceiptNumber = formValues.receiptNumber?.trim();
      if (!finalReceiptNumber) {
        if (nextPONumber) {
          finalReceiptNumber = nextPONumber;
        } else {
          // Generate fallback receipt number with correct format
          const currentYear = new Date().getFullYear().toString().slice(-2);
          const timestamp = Date.now().toString().slice(-6);
          finalReceiptNumber = `PN${timestamp}/${currentYear}`;
        }
        console.log(
          "🔢 Using auto-generated receipt number:",
          finalReceiptNumber,
        );
      }

      // Validate required fields
      if (!formValues.supplierId || formValues.supplierId === 0) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn nhà cung cấp",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!finalReceiptNumber) {
        toast({
          title: "Lỗi",
          description: "Số phiếu nhập không được để trống",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!formValues.purchaseDate) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn ngày nhập hàng",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Validate payment method if isPaid = true
      if (formValues.isPaid) {
        if (
          !editPaymentMethods ||
          editPaymentMethods.length === 0 ||
          !editPaymentMethods[0].method
        ) {
          toast({
            title: "Lỗi",
            description: "Vui lòng chọn phương thức thanh toán",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        const paymentAmount = parseFloat(editPaymentMethods[0].amount || "0");
        if (paymentAmount <= 0) {
          toast({
            title: "Lỗi",
            description: "Số tiền thanh toán phải lớn hơn 0",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Calculate totals
      const subtotalAmount = validItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      // Get storeCode from logged-in user
      const storeCode =
        userInfo?.storeCode || storeSettings?.storeCode || "STORE001";

      // Prepare submission data
      const submissionData = {
        receiptNumber: finalReceiptNumber,
        supplierId: formValues.supplierId,
        employeeId: formValues.employeeId || null,
        purchaseDate: formValues.purchaseDate,
        actualDeliveryDate: formValues.actualDeliveryDate || null,
        purchaseType: formValues.purchaseType || null,
        subtotal: subtotalAmount.toFixed(2),
        tax: "0.00",
        total: subtotalAmount.toFixed(2),
        isPaid: formValues.isPaid || false,
        paymentMethod:
          formValues.isPaid && editPaymentMethods.length > 0
            ? JSON.stringify({
                method: editPaymentMethods[0].method,
                amount: parseFloat(editPaymentMethods[0].amount || "0"),
              })
            : null,
        paymentAmount:
          formValues.isPaid && editPaymentMethods.length > 0
            ? editPaymentMethods[0].amount
            : null,
        notes: formValues.notes?.trim() || null,
        storeCode: storeCode, // Add storeCode from logged-in user
        items: validItems.map((item) => {
          // Lấy CHÍNH XÁC giá trị từ UI - không tính toán lại
          const discountPercent = parseFloat(
            (item as any).discountPercent || 0,
          );
          const discountAmount = parseFloat((item as any).discountAmount || 0);

          return {
            productId: item.productId || null,
            productName: item.productName,
            sku: item.sku || "",
            quantity: item.quantity,
            receivedQuantity: item.receivedQuantity || 0,
            unitPrice: item.unitPrice.toFixed(2),
            total: (item.quantity * item.unitPrice).toFixed(2),
            taxRate: "0.00",
            discountPercent: discountPercent.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
          };
        }),
      };

      console.log("🚀 Final submission data:", submissionData);

      // Submit data
      const response = isEditMode
        ? await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submissionData),
          })
        : await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submissionData),
          });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }

      const result = await response.json();
      console.log("✅ API response:", result);

      // Upload attached files if any
      if (attachedFiles.length > 0) {
        console.log(`📎 Uploading ${attachedFiles.length} attached files...`);

        const uploadPromises = attachedFiles.map(async (fileData) => {
          // Skip files that already have an ID (already uploaded)
          if (fileData.id) {
            return;
          }

          if (!fileData.file) {
            console.warn("⚠️ File data missing file object:", fileData);
            return;
          }

          console.log(
            `UPLOAD: Processing file: ${fileData.originalFileName}, size: ${fileData.file.size} bytes`,
          );

          // Read file content as base64 - this preserves exact file content
          const reader = new FileReader();
          const fileContentPromise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const base64 = reader.result as string;

              // Verify file content
              const hasDataPrefix = base64.startsWith("data:");
              const base64Content = hasDataPrefix
                ? base64.split(",")[1]
                : base64;
              const calculatedSize = Math.floor((base64Content.length * 3) / 4);

              console.log(
                `UPLOAD VERIFICATION for ${fileData.originalFileName}:`,
              );
              console.log(
                `   - Original file size: ${fileData.file.size} bytes`,
              );
              console.log(`   - Base64 length: ${base64.length} chars`);
              console.log(`   - Has data URL prefix: ${hasDataPrefix}`);
              console.log(
                `   - Calculated decoded size: ${calculatedSize} bytes`,
              );
              console.log(
                `   - Size match: ${Math.abs(fileData.file.size - calculatedSize) < 10 ? "✅ YES" : "❌ NO"}`,
              );
              console.log(`   - MIME type: ${fileData.fileType}`);
              console.log(
                `   - Base64 preview: ${base64.substring(0, 100)}...`,
              );

              resolve(base64);
            };
            reader.onerror = (error) => {
              console.error(
                `❌ File read error for ${fileData.originalFileName}:`,
                error,
              );
              reject(error);
            };
            reader.readAsDataURL(fileData.file!);
          });

          try {
            const fileContent = await fileContentPromise;

            // Verify file size matches
            const base64Content = fileContent.includes(",")
              ? fileContent.split(",")[1]
              : fileContent;
            const padding = (base64Content.match(/=/g) || []).length;
            const calculatedSize =
              Math.floor((base64Content.length * 3) / 4) - padding;

            console.log(
              `📊 File size verification for ${fileData.originalFileName}:`,
              {
                originalSize: fileData.file.size,
                calculatedSize: calculatedSize,
                matches: Math.abs(fileData.file.size - calculatedSize) < 10, // Allow small tolerance
              },
            );

            // Send file data as JSON with original filename preserved
            const uploadResponse = await fetch(
              `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts/${result.id}/documents`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  fileName: fileData.fileName,
                  originalFileName: fileData.originalFileName,
                  fileType: fileData.fileType,
                  fileSize: fileData.file.size, // Use actual file size from File object
                  description: fileData.description || "",
                  fileContent: fileContent, // Send full data URL with prefix
                }),
              },
            );

            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              console.error(
                `❌ Upload failed for ${fileData.originalFileName}:`,
                errorText,
              );
              throw new Error(
                `Failed to upload ${fileData.originalFileName}: ${errorText}`,
              );
            }

            const uploadResult = await uploadResponse.json();
            console.log(
              `✅ Uploaded file: ${fileData.originalFileName}, server response:`,
              uploadResult,
            );
          } catch (uploadError) {
            console.error(
              `❌ Error uploading ${fileData.originalFileName}:`,
              uploadError,
            );
            throw uploadError;
          }
        });

        try {
          await Promise.all(uploadPromises);
          console.log("✅ All files uploaded successfully");
        } catch (uploadError) {
          console.error("❌ Error uploading files:", uploadError);
          toast({
            title: "Cảnh báo",
            description:
              "Phiếu nhập đã được tạo nhưng có lỗi khi tải lên tệp đính kèm",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Thành công",
        description: isEditMode
          ? "Phiếu nhập hàng đã được cập nhật thành công"
          : "Phiếu nhập hàng đã được tạo thành công",
      });

      // Refresh queries and navigate
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers"] });

      setTimeout(() => {
        navigate("/purchases");
      }, 1000);
    } catch (error: any) {
      console.error("❌ Error in form submission:", error);

      let errorMessage = "Có lỗi xảy ra khi lưu phiếu nhập hàng";
      if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Lỗi",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle save as draft (placeholder, as no specific draft logic is implemented yet)
  const handleSaveAsDraft = () => {
    console.log("Saving as draft...");
    // Implement draft saving logic here if needed
  };

  // Custom number formatter for KRW
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
    }).format(amount);
  };

  // Show loading screen when fetching existing order
  if (Boolean(id) && isLoadingOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Đang tải thông tin phiếu nhập...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/purchases")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("common.back")}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {viewOnly
                  ? t("purchases.viewPurchaseOrder")
                  : id
                    ? t("purchases.editPurchaseOrder")
                    : t("purchases.createPurchaseOrder")}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {viewOnly
                  ? t("purchases.viewOrderDescription")
                  : id
                    ? t("purchases.editOrderDescription")
                    : t("purchases.createOrderDescription")}
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Main Form */}
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
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Supplier Selection */}
                      <FormField
                        control={form.control}
                        name="supplierId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <span>{t("purchases.supplier")}</span>
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <Select
                              onValueChange={(value) =>
                                field.onChange(parseInt(value))
                              }
                              value={field.value?.toString() || ""}
                              disabled={viewOnly}
                              data-testid="select-supplier"
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("purchases.selectSupplier")}
                                  />
                                </SelectTrigger>
                              </FormControl>
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* PO Number */}
                      <FormField
                        control={form.control}
                        name="receiptNumber" // Changed from poNumber to receiptNumber
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <span>{t("purchases.receiptNumber")}</span>
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  placeholder={
                                    !isEditMode && isLoadingPONumber
                                      ? "Đang tạo số phiếu tự động..."
                                      : "Nhập số phiếu (PNxxxxxx/YY) hoặc để trống để tự động sinh"
                                  }
                                  disabled={viewOnly}
                                  data-testid="input-receipt-number" // Updated data-testid
                                />
                                {!isEditMode && isLoadingPONumber && (
                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                            {!isEditMode && nextPOError && (
                              <p className="text-xs text-amber-600 mt-1">
                                ⚠️ Tự động tạo số PO thất bại. Vui lòng nhập thủ
                                công.
                              </p>
                            )}
                          </FormItem>
                        )}
                      />

                      {/* Purchase Date */}
                      <FormField
                        control={form.control}
                        name="purchaseDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <span>{t("purchases.purchaseDate")}</span>
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="date"
                                disabled={viewOnly}
                                data-testid="input-purchase-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Purchase Type */}
                      <FormField
                        control={form.control}
                        name="purchaseType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <span>{t("purchases.purchaseType")}</span>
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ""}
                              disabled={viewOnly}
                              data-testid="select-purchase-type"
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      "purchases.selectPurchaseType",
                                    )}
                                  />
                                </SelectTrigger>
                              </FormControl>
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Employee Assignment */}
                      <FormField
                        control={form.control}
                        name="employeeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("purchases.assignedTo")}</FormLabel>
                            <Select
                              onValueChange={(value) =>
                                field.onChange(value ? parseInt(value) : null)
                              }
                              value={field.value?.toString() || ""}
                              disabled={viewOnly}
                              data-testid="select-employee"
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("purchases.selectEmployee")}
                                  />
                                </SelectTrigger>
                              </FormControl>
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* File Attachments - Files displayed inside upload box */}
                      <FormItem>
                        <FormLabel className="text-sm font-medium flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          {t("purchases.attachDocuments")}
                        </FormLabel>
                        <FormControl>
                          <div
                            className="border border-dashed border-gray-300 rounded-md p-3 hover:border-gray-400 transition-colors cursor-pointer bg-gray-50/50 min-h-[42px] flex flex-col"
                            onClick={(e) => {
                              // Only trigger file input if clicking on empty area
                              if (
                                e.target === e.currentTarget ||
                                (e.target as HTMLElement).closest(
                                  ".upload-prompt",
                                )
                              ) {
                                document.getElementById("file-upload")?.click();
                              }
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add(
                                "border-blue-400",
                                "bg-blue-50",
                              );
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove(
                                "border-blue-400",
                                "bg-blue-50",
                              );
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove(
                                "border-blue-400",
                                "bg-blue-50",
                              );
                              handleFileUpload(e.dataTransfer.files);
                            }}
                          >
                            {/* Upload Prompt - Only show if no files */}
                            {attachedFiles.length === 0 ? (
                              <div className="upload-prompt flex items-center justify-center gap-2">
                                <Upload className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                  {t("purchases.dragOrClickToUpload")}
                                </span>
                              </div>
                            ) : (
                              /* Files List - Inside upload box */
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {attachedFiles.map((file, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between bg-white border border-gray-200 rounded p-1.5 hover:bg-gray-50 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {getFileIcon(file.fileType)}
                                      <div className="min-w-0 flex-1">
                                        <p
                                          className="text-xs font-medium text-gray-900 truncate"
                                          title={file.originalFileName}
                                        >
                                          {file.originalFileName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {formatFileSize(file.fileSize)}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeFile(index);
                                      }}
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                                {/* Add more files button */}
                                <button
                                  type="button"
                                  className="upload-prompt w-full text-xs text-blue-600 hover:text-blue-700 py-1 flex items-center justify-center gap-1"
                                  onClick={() =>
                                    document
                                      .getElementById("file-upload")
                                      ?.click()
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                  {t("purchases.addItem")}
                                </button>
                              </div>
                            )}
                            <input
                              id="file-upload"
                              type="file"
                              multiple
                              accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.doc,.docx"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e.target.files)}
                            />
                          </div>
                        </FormControl>

                        {isUploading && (
                          <div className="flex items-center justify-center py-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                            <span className="text-xs text-gray-600">
                              {t("purchases.uploadingFiles")}
                            </span>
                          </div>
                        )}
                      </FormItem>
                    </div>

                    {/* Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("purchases.notes")}</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              placeholder={t("purchases.notesPlaceholder")}
                              rows={3}
                              disabled={viewOnly}
                              data-testid="textarea-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Payment Status and Methods - Same Row */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Payment Status Checkbox */}
                      <div className="md:col-span-5">
                        <FormField
                          control={form.control}
                          name="isPaid"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 h-full">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    // Khi check isPaid, tự động điền số tiền = tổng tiền
                                    if (checked) {
                                      const itemsTotal = selectedItems.reduce(
                                        (sum, item) => {
                                          const subtotal =
                                            (item.quantity || 0) *
                                            (item.unitPrice || 0);
                                          const discountAmount = parseFloat(
                                            (item as any).discountAmount || 0,
                                          );
                                          return (
                                            sum + (subtotal - discountAmount)
                                          );
                                        },
                                        0,
                                      );

                                      setEditPaymentMethods([
                                        {
                                          method: "cash",
                                          amount:
                                            Math.round(itemsTotal).toString(),
                                        },
                                      ]);

                                      // Cập nhật form values
                                      form.setValue(
                                        "paymentMethod",
                                        JSON.stringify({
                                          method: "cash",
                                          amount: Math.round(itemsTotal),
                                        }),
                                      );
                                      form.setValue(
                                        "paymentAmount",
                                        Math.round(itemsTotal).toString(),
                                      );
                                    }
                                  }}
                                  disabled={viewOnly}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>{t("purchases.paid")}</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                  {t("purchases.paidDescription")}
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Payment Method & Amount - Single payment method only */}
                      {form.watch("isPaid") && (
                        <div className="md:col-span-5">
                          <div className="border rounded-lg p-3 bg-blue-50 h-full">
                            <h4 className="font-semibold mb-2 text-sm">
                              {t("purchases.paymentMethod")}
                            </h4>

                            {(() => {
                              const getMethodName = (method: string) => {
                                // Find the payment method from the list
                                const paymentMethod = paymentMethods.find(
                                  (pm) => pm.nameKey === method,
                                );
                                return paymentMethod
                                  ? paymentMethod.name
                                  : method;
                              };

                              // Tính tổng tiền từ items - tự động cập nhật
                              const itemsTotal = selectedItems.reduce(
                                (sum, item) => {
                                  const subtotal =
                                    (item.quantity || 0) *
                                    (item.unitPrice || 0);
                                  const discountAmount = parseFloat(
                                    (item as any).discountAmount || 0,
                                  );
                                  return sum + (subtotal - discountAmount);
                                },
                                0,
                              );

                              // Lấy method hiện tại hoặc mặc định
                              const currentMethod = editPaymentMethods[0] || {
                                method: "cash",
                                amount: Math.round(itemsTotal).toString(),
                              };

                              // Auto-update payment amount khi items thay đổi
                              if (editPaymentMethods[0]) {
                                editPaymentMethods[0].amount =
                                  Math.round(itemsTotal).toString();
                              }

                              return (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-white rounded border text-xs">
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium">
                                        {t("purchases.paymentMethod")}
                                      </label>
                                      {!viewOnly ? (
                                        <Select
                                          value={currentMethod.method || "cash"}
                                          onValueChange={(value) => {
                                            const updated = [
                                              {
                                                method: value,
                                                amount:
                                                  Math.round(
                                                    itemsTotal,
                                                  ).toString(),
                                              },
                                            ];
                                            setEditPaymentMethods(updated);
                                            form.setValue(
                                              "paymentMethod",
                                              JSON.stringify(updated[0]),
                                            );
                                            form.setValue(
                                              "paymentAmount",
                                              Math.round(itemsTotal).toString(),
                                            );
                                          }}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {paymentMethods.map((method) => (
                                              <SelectItem
                                                key={method.id}
                                                value={method.nameKey}
                                              >
                                                {method.icon}{" "}
                                                {t(`common.${method.nameKey}`)}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <div className="h-8 px-2 py-1 bg-blue-50 border border-blue-200 rounded flex items-center">
                                          <span className="font-medium text-blue-900 text-xs">
                                            {getMethodName(
                                              currentMethod.method,
                                            )}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-xs font-medium">
                                        {t("common.amount")}
                                      </label>
                                      <div className="h-8 px-2 py-1 bg-gray-100 border border-gray-300 rounded flex items-center justify-end">
                                        <span className="font-semibold text-gray-800 text-xs">
                                          {Math.round(
                                            itemsTotal,
                                          ).toLocaleString("vi-VN")}{" "}
                                          ₫
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Payment status display */}
                                  <div className="space-y-1 mt-2">
                                    <div className="flex justify-between items-center pt-2 border-t">
                                      <span className="font-semibold text-sm">
                                        {t("common.totalPayment")}:
                                      </span>
                                      <span className="text-base font-bold text-gray-900">
                                        {Math.round(itemsTotal).toLocaleString(
                                          "vi-VN",
                                        )}{" "}
                                        ₫
                                      </span>
                                    </div>
                                  </div>
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
                          {t("purchases.items")} ({selectedItems.length})
                        </CardTitle>
                        <CardDescription>
                          {t("purchases.itemsDescription")}
                        </CardDescription>
                      </div>
                      <Dialog
                        open={isProductDialogOpen}
                        onOpenChange={(open) => {
                          setIsProductDialogOpen(open);
                          if (!open) {
                            setSelectedItemId(null);
                            setSelectedProductIndex(0);
                            setProductSearch("");
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <div style={{ display: "none" }}>
                            <Button size="sm" data-testid="button-add-item">
                              <Plus className="h-4 w-4 mr-2" />
                              {t("purchases.addItem")}
                            </Button>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <DialogTitle>
                                  {t("purchases.selectProducts")}
                                </DialogTitle>
                                <DialogDescription>
                                  {t("purchases.selectProductsDescription")}
                                </DialogDescription>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsNewProductDialogOpen(true)}
                                className="flex items-center gap-2"
                                data-testid="button-add-new-product"
                              >
                                <Plus className="h-4 w-4" />
                                {t("inventory.addProduct")}
                              </Button>
                            </div>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder={t("purchases.searchProducts")}
                                value={productSearch}
                                onChange={(e) => {
                                  setProductSearch(e.target.value);
                                  setSelectedProductIndex(0);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setSelectedProductIndex((prev) =>
                                      prev < products.length - 1
                                        ? prev + 1
                                        : prev,
                                    );
                                  } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setSelectedProductIndex((prev) =>
                                      prev > 0 ? prev - 1 : 0,
                                    );
                                  } else if (
                                    e.key === "Enter" &&
                                    products.length > 0
                                  ) {
                                    e.preventDefault();
                                    handleProductSelect(
                                      products[selectedProductIndex],
                                    );
                                  }
                                }}
                                className="pl-10"
                                data-testid="input-product-search"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                              <div className="grid gap-2">
                                {products.map((product: any, index: number) => (
                                  <div
                                    key={product.id}
                                    data-product-index={index}
                                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                                      index === selectedProductIndex
                                        ? "bg-blue-50 border-blue-500"
                                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                                    }`}
                                    onClick={() => handleProductSelect(product)}
                                    data-testid={`product-${product.id}`}
                                  >
                                    <div>
                                      <p className="font-medium">
                                        {product.name}
                                      </p>
                                      {product.sku && (
                                        <p className="text-sm text-gray-500">
                                          SKU: {product.sku}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="font-medium">
                                        {formatCurrency(product.unitPrice || 0)}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        {t("inventory.stock")}:{" "}
                                        {product.stock || 0}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <Table className="min-w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 text-center p-2 font-bold">
                                {t("purchases.rowNumber")}
                              </TableHead>
                              <TableHead className="w-32 text-center p-2 font-bold">
                                {t("purchases.productCode")}
                              </TableHead>
                              <TableHead className="min-w-[180px] max-w-[250px] p-2 font-bold">
                                {t("purchases.itemName")}
                              </TableHead>
                              <TableHead className="w-20 text-center p-2 font-bold">
                                {t("purchases.unit")}
                              </TableHead>
                              <TableHead className="w-24 text-center p-2 font-bold">
                                {t("purchases.quantity")}
                              </TableHead>
                              <TableHead className="w-28 text-center p-2 font-bold">
                                {t("purchases.unitPrice")}
                              </TableHead>
                              <TableHead className="w-28 text-center p-2 font-bold">
                                {t("purchases.subtotalAmount")}
                              </TableHead>
                              <TableHead className="w-20 text-center p-2 font-bold">
                                {t("purchases.discountPercent")}
                              </TableHead>
                              <TableHead className="w-28 text-center p-2 font-bold">
                                {t("purchases.discountAmount")}
                              </TableHead>
                              <TableHead className="w-32 text-center p-2 font-bold">
                                {t("purchases.totalAmount")}
                              </TableHead>
                              {!viewOnly && (
                                <TableHead className="w-20 text-center p-2 font-bold">
                                  {t("common.actions")}
                                </TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedItems.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={viewOnly ? 9 : 10}
                                  className="text-center py-12 text-gray-500 dark:text-gray-400"
                                >
                                  <div className="flex flex-col items-center">
                                    <Package className="h-12 w-12 mb-3 opacity-50" />
                                    <p className="text-lg font-medium mb-1">
                                      {t("purchases.noItemsSelected")}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      {t("purchases.clickAddItemToStart")}
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              selectedItems.map((item, index) => {
                                const subtotal = item.total; // Use item.total directly

                                // Xử lý logic chiết khấu - ƯU TIÊN GIÁ TRỊ TỪ UI
                                let discountPercent =
                                  (item as any).discountPercent || 0;
                                let discountAmount =
                                  (item as any).discountAmount || 0;

                                // Nếu user vừa nhập %CK → tính lại tiền chiết khấu
                                if (
                                  (item as any).updatedFromPercent &&
                                  !(item as any).updatedFromAmount
                                ) {
                                  discountAmount =
                                    subtotal * (discountPercent / 100);
                                }
                                // Nếu user vừa nhập tiền chiết khấu → GIỮ NGUYÊN, KHÔNG tính lại %CK
                                // discountAmount đã có giá trị từ UI, không cần làm gì thêm

                                const finalTotal = subtotal - discountAmount;

                                return (
                                  <TableRow
                                    key={index}
                                    data-testid={`item-row-${index}`}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                  >
                                    {/* 1. No - Số thứ tự */}
                                    <TableCell className="text-center font-semibold text-gray-600 p-2">
                                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">
                                        {index + 1}
                                      </div>
                                    </TableCell>

                                    {/* 2. Mã sản phẩm (SKU) - Autocomplete with suggestions OR click to open dialog */}
                                    <TableCell className="p-2">
                                      <div className="relative">
                                        <Input
                                          type="text"
                                          value={item.sku || ""}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            updateItem(index, "sku", value);
                                            filterProductsBySku(index, value);
                                          }}
                                          onClick={() => {
                                            // Open product selector dialog when clicking on SKU field
                                            setSelectedItemId(
                                              item.productId || index,
                                            );
                                            setIsProductDialogOpen(true);
                                          }}
                                          onKeyDown={(e) => {
                                            const suggestions =
                                              skuSuggestions[index] || [];
                                            const activeIndex =
                                              activeSuggestionIndex[index] || 0;
                                            const hasSelectedProduct =
                                              item.productId &&
                                              item.productId > 0;
                                            const hasSuggestions =
                                              suggestions.length > 0;

                                            // Arrow Down/Up - Navigate suggestions OR move to next/prev row
                                            if (e.key === "ArrowDown") {
                                              if (hasSuggestions) {
                                                e.preventDefault();
                                                setActiveSuggestionIndex(
                                                  (prev) => ({
                                                    ...prev,
                                                    [index]: Math.min(
                                                      activeIndex + 1,
                                                      suggestions.length - 1,
                                                    ),
                                                  }),
                                                );
                                              } else {
                                                // Move to same field in next row
                                                handleKeyDown(e, index, "sku");
                                              }
                                            } else if (e.key === "ArrowUp") {
                                              if (hasSuggestions) {
                                                e.preventDefault();
                                                setActiveSuggestionIndex(
                                                  (prev) => ({
                                                    ...prev,
                                                    [index]: Math.max(
                                                      activeIndex - 1,
                                                      0,
                                                    ),
                                                  }),
                                                );
                                              } else {
                                                // Move to same field in previous row
                                                handleKeyDown(e, index, "sku");
                                              }
                                            }
                                            // Enter - Select suggestion OR move to product name field
                                            else if (e.key === "Enter") {
                                              e.preventDefault();

                                              if (hasSuggestions) {
                                                // Select from suggestion list and auto-focus to product name
                                                selectProductFromSuggestion(
                                                  index,
                                                  suggestions[activeIndex],
                                                );
                                              } else {
                                                // Move to product name field
                                                setTimeout(() => {
                                                  const nextInput =
                                                    document.querySelector(
                                                      `[data-testid="input-product-${index}"]`,
                                                    ) as HTMLInputElement;
                                                  nextInput?.focus();
                                                }, 50);
                                              }
                                            }
                                            // Tab - Same as Enter
                                            else if (e.key === "Tab") {
                                              e.preventDefault();

                                              if (hasSuggestions) {
                                                selectProductFromSuggestion(
                                                  index,
                                                  suggestions[activeIndex],
                                                );
                                              } else {
                                                // Move to product name field
                                                setTimeout(() => {
                                                  const nextInput =
                                                    document.querySelector(
                                                      `[data-testid="input-product-${index}"]`,
                                                    ) as HTMLInputElement;
                                                  nextInput?.focus();
                                                }, 50);
                                              }
                                            }
                                            // Arrow Right - Move to product name field
                                            else if (e.key === "ArrowRight") {
                                              e.preventDefault();
                                              setTimeout(() => {
                                                const nextInput =
                                                  document.querySelector(
                                                    `[data-testid="input-product-${index}"]`,
                                                  ) as HTMLInputElement;
                                                nextInput?.focus();
                                              }, 50);
                                            }
                                            // Arrow Left - Move to previous row's total field
                                            else if (e.key === "ArrowLeft") {
                                              if (index > 0) {
                                                e.preventDefault();
                                                setTimeout(() => {
                                                  const prevInput =
                                                    document.querySelector(
                                                      `[data-testid="input-total-${index - 1}"]`,
                                                    ) as HTMLInputElement;
                                                  prevInput?.focus();
                                                }, 50);
                                              }
                                            }
                                          }}
                                          placeholder={
                                            t(
                                              "purchases.searchProductPlaceholder",
                                            ) ||
                                            "Nhập mã/tên SP hoặc click để chọn"
                                          }
                                          className="w-28 text-center text-sm h-8 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                          disabled={viewOnly}
                                          data-testid={`input-sku-${index}`}
                                        />
                                        <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />

                                        {/* Suggestions dropdown */}
                                        {skuSuggestions[index] &&
                                          skuSuggestions[index].length > 0 && (
                                            <div className="absolute z-50 w-64 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                              {skuSuggestions[index].map(
                                                (product: any, idx: number) => (
                                                  <div
                                                    key={product.id}
                                                    className={`px-3 py-2 cursor-pointer text-xs ${
                                                      idx ===
                                                      (activeSuggestionIndex[
                                                        index
                                                      ] || 0)
                                                        ? "bg-blue-50 text-blue-700"
                                                        : "hover:bg-gray-50"
                                                    }`}
                                                    onClick={() => {
                                                      selectProductFromSuggestion(
                                                        index,
                                                        product,
                                                      );
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
                                    </TableCell>

                                    {/* 3. Mặt hàng - Display only */}
                                    <TableCell className="p-2">
                                      <Input
                                        type="text"
                                        value={item.productName}
                                        data-testid={`input-product-${index}`}
                                        onKeyDown={(e) => {
                                          if (
                                            e.key === "Enter" ||
                                            e.key === "Tab"
                                          ) {
                                            e.preventDefault();
                                            handleKeyDown(e, index, "product");
                                          } else {
                                            handleKeyDown(e, index, "product");
                                          }
                                        }}
                                        className="w-full text-sm h-8 bg-gray-100"
                                        placeholder={t("purchases.productName")}
                                        readOnly
                                        disabled={viewOnly}
                                      />
                                    </TableCell>

                                    {/* 4. Đơn vị tính */}
                                    <TableCell className="text-center p-2">
                                      <span className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-full">
                                        {t("common.unit")}
                                      </span>
                                    </TableCell>

                                    {/* 5. Số lượng */}
                                    <TableCell className="p-2">
                                      <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const value = e.target.value.replace(
                                            /[^0-9]/g,
                                            "",
                                          );
                                          const numValue = parseInt(value) || 0;
                                          updateItem(
                                            index,
                                            "quantity",
                                            numValue,
                                          );
                                        }}
                                        onKeyDown={(e) =>
                                          handleKeyDown(e, index, "quantity")
                                        }
                                        className="w-20 text-center text-sm h-8 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        disabled={viewOnly}
                                        data-testid={`input-quantity-${index}`}
                                      />
                                    </TableCell>

                                    {/* 6. Đơn giá */}
                                    <TableCell className="p-2">
                                      <Input
                                        type="text"
                                        value={item.unitPrice.toLocaleString(
                                          "ko-KR",
                                        )}
                                        onChange={(e) => {
                                          const value = e.target.value.replace(
                                            /[^0-9]/g,
                                            "",
                                          );
                                          const newUnitPrice =
                                            parseFloat(value) || 0;
                                          updateItem(
                                            index,
                                            "unitPrice",
                                            newUnitPrice,
                                          );
                                        }}
                                        onKeyDown={(e) =>
                                          handleKeyDown(e, index, "unitPrice")
                                        }
                                        className="w-24 text-right text-sm h-8 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-1 focus:ring-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                        disabled={viewOnly}
                                        data-testid={`input-unitPrice-${index}`}
                                      />
                                    </TableCell>

                                    {/* 7. Thành tiền */}
                                    <TableCell className="p-2">
                                      <Input
                                        type="text"
                                        value={subtotal.toLocaleString("ko-KR")}
                                        onChange={(e) => {
                                          const value = e.target.value.replace(
                                            /[^0-9]/g,
                                            "",
                                          );
                                          const newSubtotal =
                                            parseFloat(value) || 0;
                                          const newUnitPrice =
                                            item.quantity > 0
                                              ? newSubtotal / item.quantity
                                              : 0;
                                          updateItem(
                                            index,
                                            "unitPrice",
                                            newUnitPrice,
                                          );
                                          // Also update the total to reflect the new subtotal
                                          const updatedItems = [
                                            ...selectedItems,
                                          ];
                                          updatedItems[index].total =
                                            newSubtotal;
                                          setSelectedItems(updatedItems);
                                        }}
                                        onKeyDown={(e) =>
                                          handleKeyDown(e, index, "subtotal")
                                        }
                                        className="w-24 text-right font-medium text-sm h-8 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-1 focus:ring-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                        disabled={viewOnly}
                                        data-testid={`input-subtotal-${index}`}
                                      />
                                    </TableCell>

                                    {/* 8. % Chiết khấu */}
                                    <TableCell className="p-2">
                                      <Input
                                        type="number"
                                        value={Math.round(discountPercent)}
                                        onChange={(e) => {
                                          const newDiscountPercent =
                                            parseInt(e.target.value) || 0;
                                          const updatedItems = [
                                            ...selectedItems,
                                          ];
                                          const subtotal =
                                            item.quantity * item.unitPrice;

                                          // Cập nhật %CK và TỰ ĐỘNG tính lại tiền chiết khấu
                                          (
                                            updatedItems[index] as any
                                          ).discountPercent =
                                            newDiscountPercent;
                                          (
                                            updatedItems[index] as any
                                          ).discountAmount =
                                            subtotal *
                                            (newDiscountPercent / 100);
                                          (
                                            updatedItems[index] as any
                                          ).updatedFromPercent = true;
                                          (
                                            updatedItems[index] as any
                                          ).updatedFromAmount = false;

                                          setSelectedItems(updatedItems);
                                        }}
                                        onKeyDown={(e) =>
                                          handleKeyDown(
                                            e,
                                            index,
                                            "discountPercent",
                                          )
                                        }
                                        min="0"
                                        max="100"
                                        step="1"
                                        className="w-16 text-center text-sm h-8 border-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                        disabled={viewOnly}
                                        data-testid={`input-discountPercent-${index}`}
                                      />
                                    </TableCell>

                                    {/* 9. Chiết khấu */}
                                    <TableCell className="p-2">
                                      <Input
                                        type="text"
                                        value={discountAmount.toLocaleString(
                                          "ko-KR",
                                        )}
                                        onChange={(e) => {
                                          const value = e.target.value.replace(
                                            /[^0-9]/g,
                                            "",
                                          );
                                          const newDiscountAmount =
                                            parseFloat(value) || 0;
                                          const updatedItems = [
                                            ...selectedItems,
                                          ];

                                          // LƯU CHÍNH XÁC discountAmount từ UI - GIỮ NGUYÊN %CK
                                          (
                                            updatedItems[index] as any
                                          ).discountAmount = newDiscountAmount;
                                          (
                                            updatedItems[index] as any
                                          ).updatedFromAmount = true;
                                          (
                                            updatedItems[index] as any
                                          ).updatedFromPercent = false;

                                          setSelectedItems(updatedItems);
                                        }}
                                        onKeyDown={(e) =>
                                          handleKeyDown(
                                            e,
                                            index,
                                            "discountAmount",
                                          )
                                        }
                                        className="w-24 text-right font-medium text-sm h-8 border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                        disabled={viewOnly}
                                        data-testid={`input-discountAmount-${index}`}
                                      />
                                    </TableCell>

                                    {/* 10. Tổng tiền */}
                                    <TableCell className="text-right font-bold text-green-600 text-sm p-2">
                                      <Input
                                        type="text"
                                        value={finalTotal.toLocaleString(
                                          "ko-KR",
                                        )}
                                        onChange={(e) => {
                                          // This is just for display, actual calculation is done automatically
                                        }}
                                        onKeyDown={(e) =>
                                          handleKeyDown(e, index, "total")
                                        }
                                        className="w-28 text-right font-bold text-green-600 bg-green-50 border-green-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                        disabled={viewOnly}
                                        readOnly
                                        data-testid={`input-total-${index}`}
                                      />
                                    </TableCell>

                                    {/* Actions */}
                                    {!viewOnly && (
                                      <TableCell className="text-center p-2">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeItem(index)}
                                          className="text-red-500 hover:text-red-700 hover:bg-red-50 w-8 h-8 p-0 rounded-full"
                                          data-testid={`button-remove-item-${index}`}
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
                            {selectedItems.length > 0 &&
                              (() => {
                                // Calculate all totals using useMemo-like logic
                                const totalQuantity = selectedItems.reduce(
                                  (sum, item) => sum + (item.quantity || 0),
                                  0,
                                );

                                const totalSubtotal = selectedItems.reduce(
                                  (sum, item) => {
                                    const subtotal =
                                      (item.quantity || 0) *
                                      (item.unitPrice || 0);
                                    return sum + subtotal;
                                  },
                                  0,
                                );

                                const totalDiscount = selectedItems.reduce(
                                  (sum, item) => {
                                    const discountPercent = parseFloat(
                                      (item as any).discountPercent || 0,
                                    );
                                    const discountAmount = parseFloat(
                                      (item as any).discountAmount || 0,
                                    );
                                    const subtotal =
                                      (item.quantity || 0) *
                                      (item.unitPrice || 0);

                                    let finalDiscountAmount = discountAmount;
                                    if (
                                      discountAmount === 0 &&
                                      discountPercent > 0
                                    ) {
                                      finalDiscountAmount =
                                        subtotal * (discountPercent / 100);
                                    }

                                    return sum + finalDiscountAmount;
                                  },
                                  0,
                                );

                                const grandTotal = selectedItems.reduce(
                                  (sum, item) => {
                                    const subtotal =
                                      (item.quantity || 0) *
                                      (item.unitPrice || 0);
                                    const discountPercent = parseFloat(
                                      (item as any).discountPercent || 0,
                                    );
                                    const discountAmount = parseFloat(
                                      (item as any).discountAmount || 0,
                                    );

                                    let finalDiscountAmount = discountAmount;
                                    if (
                                      discountAmount === 0 &&
                                      discountPercent > 0
                                    ) {
                                      finalDiscountAmount =
                                        subtotal * (discountPercent / 100);
                                    }

                                    const finalTotal =
                                      subtotal - finalDiscountAmount;
                                    return sum + finalTotal;
                                  },
                                  0,
                                );

                                return (
                                  <TableRow className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 font-semibold">
                                    {/* No */}
                                    <TableCell className="text-center p-2">
                                      <div className="flex items-center justify-center w-8 h-8 bg-blue-200 text-blue-800 rounded-full text-xs font-bold">
                                        Σ
                                      </div>
                                    </TableCell>

                                    {/* Mã sản phẩm - empty for summary */}
                                    <TableCell className="text-center p-2">
                                      <span className="text-sm text-blue-600">
                                        -
                                      </span>
                                    </TableCell>

                                    {/* Tên sản phẩm - Placeholder for "TỔNG CỘNG" */}
                                    <TableCell className="p-2 font-bold text-blue-800">
                                      {t("purchases.totalSummary")}
                                    </TableCell>

                                    {/* Đơn vị tính */}
                                    <TableCell className="text-center p-2">
                                      <span className="text-sm text-blue-600">
                                        -
                                      </span>
                                    </TableCell>

                                    {/* Tổng số lượng */}
                                    <TableCell className="p-2">
                                      <div className="w-20 text-center font-bold text-blue-800 bg-blue-100 border border-blue-300 rounded px-2 py-1">
                                        {totalQuantity}
                                      </div>
                                    </TableCell>

                                    {/* Đơn giá - không hiển thị */}
                                    <TableCell className="p-2">
                                      <span className="text-sm text-blue-600">
                                        -
                                      </span>
                                    </TableCell>

                                    {/* Tổng thành tiền (Subtotal before discount) */}
                                    <TableCell className="p-2">
                                      <div className="w-24 text-right font-bold text-blue-800 bg-blue-100 border border-blue-300 rounded px-2 py-1">
                                        {totalSubtotal.toLocaleString("ko-KR")}
                                      </div>
                                    </TableCell>

                                    {/* % Chiết khấu - không hiển thị */}
                                    <TableCell className="p-2">
                                      <span className="text-sm text-blue-600">
                                        -
                                      </span>
                                    </TableCell>

                                    {/* Total Discount */}
                                    <TableCell className="p-2">
                                      <div className="w-24 text-right font-bold text-red-800 bg-red-100 border border-red-300 rounded px-2 py-1">
                                        {totalDiscount.toLocaleString("ko-KR")}
                                      </div>
                                    </TableCell>

                                    {/* Tổng tiền cuối cùng (after discount) */}
                                    <TableCell className="p-2">
                                      <div className="w-28 text-right font-bold text-green-800 bg-green-100 border border-green-300 rounded px-2 py-1">
                                        {grandTotal.toLocaleString("ko-KR")}
                                      </div>
                                    </TableCell>

                                    {/* Actions - empty for summary row */}
                                    {!viewOnly && (
                                      <TableCell className="text-center p-2">
                                        <span className="text-sm text-blue-600">
                                          -
                                        </span>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                );
                              })()}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Form Actions - Moved below items table */}
                <div className="flex gap-4 justify-end mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/purchases")}
                    data-testid="button-cancel"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t("common.cancel")}
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !hasValidData()}
                    className={`${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                    data-testid="button-submit"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Đang lưu...
                      </div>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {isEditMode ? "Cập nhật phiếu nhập" : "Lưu phiếu nhập"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Form>

        {/* New Product Dialog */}
        <Dialog
          open={isNewProductDialogOpen}
          onOpenChange={setIsNewProductDialogOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("inventory.addProduct")}</DialogTitle>
              <DialogDescription>
                {t("inventory.addProductDescription") ||
                  "Create a new product for your inventory"}
              </DialogDescription>
            </DialogHeader>
            <Form {...newProductForm}>
              <form
                onSubmit={newProductForm.handleSubmit(handleCreateNewProduct)}
                className="space-y-4"
              >
                <FormField
                  control={newProductForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.name")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            t("inventory.productNamePlaceholder") ||
                            "Enter product name"
                          }
                          {...field}
                          data-testid="input-product-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newProductForm.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("inventory.sku")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            t("inventory.skuPlaceholder") ||
                            "Enter SKU (optional)"
                          }
                          {...field}
                          data-testid="input-product-sku"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newProductForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.category")}</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue
                              placeholder={
                                t("inventory.selectCategory") ||
                                "Select category"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category: any) => (
                            <SelectItem
                              key={category.id}
                              value={category.id.toString()}
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newProductForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("inventory.unitPrice")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          data-testid="input-product-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newProductForm.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("inventory.currentStock")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                          data-testid="input-product-stock"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newProductForm.control}
                  name="trackInventory"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>{t("inventory.trackInventory")}</FormLabel>
                        <FormDescription>
                          {t("inventory.trackInventoryDescription") ||
                            "Track stock levels for this product"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-track-inventory"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNewProductDialogOpen(false)}
                    className="flex-1"
                    data-testid="button-cancel-new-product"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={createProductMutation.isPending}
                    className="flex-1"
                    data-testid="button-create-product"
                  >
                    {createProductMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {t("common.creating")}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        {t("common.create")}
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
