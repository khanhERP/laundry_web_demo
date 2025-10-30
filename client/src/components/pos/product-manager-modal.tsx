import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  X,
  Plus,
  Upload,
  Download,
  Edit,
  Trash2,
  Link,
  FileImage,
  Pencil, // Import Pencil icon
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  insertProductSchema,
  type Product,
  type Category,
} from "@shared/schema";
import { z } from "zod";
import { useTranslation } from "@/lib/i18n";
import { BulkImportModal } from "./bulk-import-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

interface ProductManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSearchSKU?: string;
}

export function ProductManagerModal({
  isOpen,
  onClose,
  initialSearchSKU = "",
}: ProductManagerModalProps) {
  const { t } = useTranslation();

  const productFormSchema = insertProductSchema.extend({
    categoryId: z.number().min(1, t("tables.categoryRequired")),
    price: z
      .string()
      .min(1, "Price is required")
      .refine((val) => {
        const num = parseFloat(val.replace(/\./g, ""));
        return !isNaN(num) && num > 0 && num < 100000000; // Max 99,999,999 (8 digits)
      }, "Price must be a valid positive number and less than 100,000,000"),
    sku: z.string().optional(),
    name: z.string().min(1, t("tables.productNameRequired")),
    productType: z.number().min(1, t("tables.productTypeRequired")),
    trackInventory: z.boolean().optional(),
    stock: z.number().min(0, "Stock must be 0 or greater"),
    taxRate: z.union([z.string(), z.number()]),
    priceIncludesTax: z.boolean().optional(),
    afterTaxPrice: z
      .union([z.string(), z.number(), z.undefined()])
      .optional()
      .refine((val) => {
        if (!val || val === undefined) return true; // Optional field
        const numVal =
          typeof val === "string" ? parseFloat(val.replace(/\./g, "")) : val;
        return !isNaN(numVal) && numVal > 0 && numVal < 100000000;
      }, "After tax price must be a valid positive number and less than 100,000,000"),
    floor: z.string().optional(),
    zone: z.string().optional(),
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [imageInputMethod, setImageInputMethod] = useState<"url" | "file">(
    "url",
  );
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const { toast } = useToast();

  // 파일을 Base64로 변환하는 함수
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const {
    data: products = [],
    isLoading,
    refetch,
  } = useQuery<Product[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
    enabled: isOpen,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
    enabled: isOpen,
  });

  const { data: units = [] } = useQuery<string[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products/units"],
    enabled: isOpen,
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      let finalData = { ...data };

      // 파일 업로드가 선택되고 파일이 있는 경우 Base64로 변환
      if (imageInputMethod === "file" && selectedImageFile) {
        try {
          const base64Image = await convertFileToBase64(selectedImageFile);
          finalData.imageUrl = base64Image;
        } catch (error) {
          console.error("파일 변환 오류:", error);
          throw new Error("이미지 파일 처리 중 오류가 발생했습니다.");
        }
      }

      console.log("Sending product data:", finalData);
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Product creation error:", errorData);
        throw new Error(errorData.message || "Failed to create product");
      }
      return response.json();
    },
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products/active"] });

      toast({
        title: "✅ Tạo sản phẩm thành công",
        description: `Sản phẩm "${newProduct.name}" đã được thêm vào hệ thống`,
        duration: 3000,
      });

      // Small delay to show toast before closing form
      setTimeout(() => {
        setShowAddForm(false);
        resetForm();
        setSelectedImageFile(null);
        setImageInputMethod("url");
      }, 500);
    },
    onError: (error: Error) => {
      console.error("Create product mutation error:", error);

      let errorMessage = "Failed to create product";
      if (error.message.includes("already exists")) {
        errorMessage = "SKU already exists. Please use a different SKU.";
      } else if (error.message.includes("Invalid product data")) {
        errorMessage = "Invalid product data. Please check all fields.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<z.infer<typeof productFormSchema>>;
    }) => {
      let finalData = { ...data };

      console.log("🔄 UPDATE MUTATION - Sending data to server:", {
        productId: id,
        taxRate: finalData.taxRate,
        taxRateName: finalData.taxRateName,
        price: finalData.price,
        name: finalData.name,
      });

      // 파일 업로드가 선택되고 파일이 있는 경우 Base64로 변환
      if (imageInputMethod === "file" && selectedImageFile) {
        try {
          const base64Image = await convertFileToBase64(selectedImageFile);
          finalData.imageUrl = base64Image;
        } catch (error) {
          console.error("파일 변환 오류:", error);
          throw new Error("이미지 파일 처리 중 오류가 발생했습니다.");
        }
      }

      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalData),
      });

      console.log("🔄 UPDATE MUTATION - Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        console.error("🔄 UPDATE MUTATION - Error:", errorData);
        throw new Error(errorData.message || "Failed to update product");
      }

      const result = await response.json();
      console.log("🔄 UPDATE MUTATION - Success result:", result);
      return result;
    },
    onSuccess: (updatedProduct) => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products/active"] });

      toast({
        title: "✅ Cập nhật thành công",
        description: `Sản phẩm "${updatedProduct.name}" đã được cập nhật`,
        duration: 3000,
      });

      // Small delay to show toast before closing form
      setTimeout(() => {
        setEditingProduct(null);
        setShowAddForm(false);
        resetForm();
        setSelectedImageFile(null);
        setImageInputMethod("url");
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Lỗi cập nhật",
        description: error.message || "Không thể cập nhật sản phẩm. Vui lòng thử lại.",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete product");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products/active"] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      sku: "",
      price: "",
      stock: 0,
      categoryId: 0,
      productType: 1,
      imageUrl: "",
      trackInventory: true,
      taxRate: "8", // 8% tax rate as integer
      priceIncludesTax: false,
      afterTaxPrice: "",
      floor: "1",
      zone: "A",
      unit: "Cái",
    },
  });

  // Helper functions for currency formatting
  const formatCurrency = (value: string | number): string => {
    if (typeof value === "string") {
      // If it's already formatted with dots, parse and reformat
      if (value.includes(".")) {
        const num = parseFloat(value.replace(/\./g, ""));
        if (isNaN(num)) return "";
        return num.toLocaleString("vi-VN");
      }
      // If it's a plain number string
      const num = parseFloat(value);
      if (isNaN(num)) return "";
      return num.toLocaleString("vi-VN");
    }

    // If it's a number
    if (isNaN(value)) return "";
    return value.toLocaleString("vi-VN");
  };

  const parseCurrency = (value: string): number => {
    // Remove all dots and parse as number
    const cleaned = value.replace(/\./g, "");
    return parseFloat(cleaned) || 0;
  };

  // Function to generate unique SKU
  const generateSKU = () => {
    const randomChars = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
    const sku = `ITEM-${randomChars.padEnd(6, "0")}`;
    form.setValue("sku", sku);
  };

  const onSubmit = (data: z.infer<typeof productFormSchema>) => {
    console.log("=== PRODUCT FORM SUBMISSION DEBUG ===");
    console.log("Is Editing?", !!editingProduct);
    console.log("Editing Product ID:", editingProduct?.id);
    console.log("Raw form data:", data);
    console.log("Data types:", {
      name: typeof data.name,
      price: typeof data.price,
      taxRate: typeof data.taxRate,
      afterTaxPrice: typeof data.afterTaxPrice,
      categoryId: typeof data.categoryId,
      stock: typeof data.stock,
    });

    // Validate required fields
    if (!data.name || !data.price || !data.categoryId || !data.taxRate) {
      toast({
        title: "Error",
        description:
          "Please fill in all required fields: Name, Price, Category, and Tax Rate",
        variant: "destructive",
      });
      return;
    }

    // Clean and validate price
    const cleanPrice = data.price.replace(/[^0-9]/g, ""); // Remove all non-numeric characters
    const priceNum = parseInt(cleanPrice);

    if (!cleanPrice || isNaN(priceNum) || priceNum <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }

    if (priceNum >= 100000000) {
      toast({
        title: "Error",
        description: "Price cannot exceed 99,999,999 VND",
        variant: "destructive",
      });
      return;
    }

    // Convert tax rate for storage - handle all cases consistently
    let taxRateValue = String(data.taxRate || "0");
    let taxRateName = String(data.taxRate || "0");

    console.log("🔍 Original taxRate from form:", data.taxRate, "Type:", typeof data.taxRate);

    if (taxRateValue === "KCT") {
      taxRateName = "KCT"; // Save exactly "KCT"
      taxRateValue = "0"; // Store numeric value as 0
    } else if (taxRateValue === "KKKNT") {
      taxRateName = "KKKNT"; // Save exactly "KKKNT"
      taxRateValue = "0"; // Store numeric value as 0
    } else if (taxRateValue === "0") {
      taxRateName = "0%"; // Save as "0%" to distinguish from KCT/KKKNT
      taxRateValue = "0";
    } else {
      taxRateName = taxRateValue + "%"; // Save as "5%", "8%", "10%"
    }

    console.log("💾 Tax rate conversion for save:", {
      original: data.taxRate,
      taxRateValue: taxRateValue,
      taxRateName: taxRateName,
      willSaveTaxRateName: taxRateName,
    });

    // Transform data to ensure proper types - all price fields must be strings
    const transformedData = {
      name: data.name.trim(),
      sku: data.sku ? data.sku.trim().toUpperCase() : "",
      price: priceNum.toString(), // String as expected by schema
      stock: Number(data.stock) || 0,
      categoryId: Number(data.categoryId),
      productType: Number(data.productType) || 1,
      trackInventory: data.trackInventory !== false,
      imageUrl: data.imageUrl?.trim() || null,
      taxRate: taxRateValue, // Convert KCT/KKKNT to 0
      taxRateName: taxRateName, // CRITICAL: Save the display name (KCT, KKKNT, 0%, 5%, 8%, 10%)
      priceIncludesTax: Boolean(data.priceIncludesTax),
      afterTaxPrice:
        data.afterTaxPrice && data.afterTaxPrice.trim() !== ""
          ? String(parseInt(data.afterTaxPrice.replace(/[^0-9]/g, "")))
          : undefined,
      beforeTaxPrice: undefined, // Let server calculate this
      floor: String(data.floor || "1"), // String as expected by schema
      zone: String(data.zone || "A"), // Add zone field to ensure it's saved
      unit: data.unit || "Cái", // Unit field - ensure it's saved
    };

    console.log("📦 Transformed data with unit:", {
      productName: transformedData.name,
      unit: transformedData.unit,
      unitType: typeof transformedData.unit,
    });

    console.log(
      "📤 Sending to server - taxRateName:",
      transformedData.taxRateName,
    );

    console.log("Transformed data:", transformedData);
    console.log("Transformed data types:", {
      name: typeof transformedData.name,
      price: typeof transformedData.price,
      taxRate: typeof transformedData.taxRate,
      taxRateName: typeof transformedData.taxRateName,
      afterTaxPrice: typeof transformedData.afterTaxPrice,
      categoryId: typeof transformedData.categoryId,
      stock: typeof transformedData.stock,
    });

    console.log("Tax rate debugging:", {
      originalTaxRate: data.taxRate,
      transformedTaxRate: transformedData.taxRate,
      transformedTaxRateName: transformedData.taxRateName,
      taxRateType: typeof transformedData.taxRate,
    });

    if (editingProduct) {
      console.log("🔄 CALLING UPDATE MUTATION with:", {
        id: editingProduct.id,
        productName: transformedData.name,
        taxRate: transformedData.taxRate,
        taxRateName: transformedData.taxRateName,
        price: transformedData.price,
      });
      updateProductMutation.mutate({
        id: editingProduct.id,
        data: transformedData,
      });
    } else {
      console.log("✨ CALLING CREATE MUTATION with:", {
        productName: transformedData.name,
        taxRate: transformedData.taxRate,
        taxRateName: transformedData.taxRateName,
        price: transformedData.price,
      });
      createProductMutation.mutate(transformedData);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);

    // IMPORTANT: taxRateName is the source of truth for dropdown selection
    // because KCT, KKKNT, and 0% all have taxRate = 0 in database
    let dropdownValue = "8"; // default

    if (product.taxRateName) {
      const trimmedTaxRateName = product.taxRateName.trim();

      console.log("📋 Edit - Product tax info:", {
        productId: product.id,
        taxRateName: trimmedTaxRateName,
        taxRate: product.taxRate,
      });

      // Exact mapping based on taxRateName - CRITICAL: Keep KCT and KKKNT separate
      if (trimmedTaxRateName === "KCT") {
        dropdownValue = "KCT";
      } else if (trimmedTaxRateName === "KKKNT") {
        dropdownValue = "KKKNT";
      } else if (trimmedTaxRateName === "0%") {
        dropdownValue = "0";
      } else if (trimmedTaxRateName === "5%") {
        dropdownValue = "5";
      } else if (trimmedTaxRateName === "8%") {
        dropdownValue = "8";
      } else if (trimmedTaxRateName === "10%") {
        dropdownValue = "10";
      } else {
        // Fallback: try to parse as percentage
        const match = trimmedTaxRateName.match(/^(\d+)%$/);
        if (match) {
          dropdownValue = match[1];
        }
      }

      console.log("📋 Edit - Mapped dropdown value:", dropdownValue);
    } else if (product.taxRate !== null && product.taxRate !== undefined) {
      // Fallback for old products without taxRateName (should rarely happen)
      const taxRateNum = parseFloat(product.taxRate);
      dropdownValue = taxRateNum.toString();

      console.log("⚠️ Edit - No taxRateName, using taxRate fallback:", {
        productId: product.id,
        taxRate: product.taxRate,
        dropdownValue: dropdownValue,
      });
    }

    console.log("📋 Edit - Loading product unit:", {
      productId: product.id,
      unit: product.unit,
      unitType: typeof product.unit,
    });

    form.reset({
      name: product.name,
      sku: product.sku,
      price: Math.round(parseFloat(product.price)).toString(),
      stock: product.stock,
      categoryId: product.categoryId,
      productType: product.productType || 1,
      imageUrl: product.imageUrl || "",
      trackInventory: product.trackInventory !== false,
      taxRate: dropdownValue, // This will be "KCT", "KKKNT", "0", "5", "8", or "10"
      priceIncludesTax: Boolean(product.priceIncludesTax),
      afterTaxPrice:
        product.afterTaxPrice ||
        (() => {
          const basePrice = parseFloat(product.price);
          const taxRate = parseFloat(product.taxRate || "0");
          return Math.round(basePrice + (basePrice * taxRate) / 100).toString();
        })(),
      floor: product.floor || "1",
      zone: product.zone || "A",
      unit: product.unit || "Cái", // Load unit from product
    });
    setShowAddForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm(t("tables.confirmDeleteProduct"))) {
      deleteProductMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingProduct(null);
    // 파일 상태 초기화
    setSelectedImageFile(null);
    setImageInputMethod("url");
    form.reset({
      name: "",
      sku: "",
      price: "",
      stock: 0,
      categoryId: categories.length > 0 ? categories[0].id : 0,
      productType: 1,
      imageUrl: "",
      trackInventory: true,
      taxRate: "8", // 8% tax rate as integer
      priceIncludesTax: false,
      afterTaxPrice: "",
      floor: "1",
      zone: "A",
      unit: "Cái",
    });

    console.log("Form reset with priceIncludesTax: false");
  };

  const getCategoryName = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId)?.name || "Unknown";
  };

  const getProductTypeName = (productType: number) => {
    const types = {
      1: t("tables.goodsType"),
      2: t("tables.materialType"),
      3: t("tables.finishedProductType"),
    };
    return types[productType as keyof typeof types] || "Unknown";
  };

  const filteredProducts = products.filter((product) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.sku.toLowerCase().includes(searchLower)
    );
  });

  const exportProductsToExcel = () => {
    const exportData = [
      [
        "STT",
        "Tên sản phẩm",
        "SKU",
        "Danh mục",
        "Giá bán",
        "% Thuế",
        "Tồn kho",
        "Hình ảnh (URL)",
      ],
    ];

    products.forEach((product, index) => {
      exportData.push([
        (index + 1).toString(),
        product.name,
        product.sku,
        getCategoryName(product.categoryId),
        parseFloat(product.price).toString(),
        product.taxRate || "0",
        product.stock.toString(),
        product.imageUrl || "",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Auto-fit column widths
    const colWidths = [
      { wch: 5 }, // STT
      { wch: 25 }, // Tên sản phẩm
      { wch: 15 }, // SKU
      { wch: 15 }, // Danh mục
      { wch: 12 }, // Giá bán
      { wch: 10 }, // % Thuế
      { wch: 10 }, // Tồn kho
      { wch: 30 }, // Hình ảnh URL
    ];
    ws["!cols"] = colWidths;

    // Style header row
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "059669" } }, // Green background
        alignment: { horizontal: "center" },
      };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách sản phẩm");

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    XLSX.writeFile(wb, `danh_sach_san_pham_${timestamp}.xlsx`);

    toast({
      title: "Thành công",
      description: `Đã xuất ${products.length} sản phẩm ra file Excel`,
    });
  };

  useEffect(() => {
    if (isOpen) {
      refetch();
      // Set search term if initialSearchSKU is provided
      if (initialSearchSKU) {
        setSearchTerm(initialSearchSKU);
      }
      // Reset form completely when opening modal
      if (!editingProduct) {
        // 새 상품 추가 시 초기화
        setSelectedImageFile(null);
        setImageInputMethod("url");
        form.reset({
          name: "",
          sku: "",
          price: "",
          stock: 0,
          categoryId: 0,
          productType: 1,
          imageUrl: "",
          trackInventory: true,
          taxRate: "8", // 8% tax rate as integer
          priceIncludesTax: false,
          afterTaxPrice: "",
          floor: "1",
          zone: "A",
          unit: "Cái",
        });
      } else {
        // 편집 모드에서 기존 이미지 URL이 있는지 확인
        if (editingProduct.imageUrl && editingProduct.imageUrl.trim() !== "") {
          setImageInputMethod("url");
          setSelectedImageFile(null);
        } else {
          setImageInputMethod("url"); // 기본은 URL 방식
          setSelectedImageFile(null);
        }
      }
    }
  }, [isOpen, refetch, editingProduct, initialSearchSKU]);

  // Add keyboard support for closing modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        handleModalClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleModalClose = () => {
    // Reset all form states when modal closes
    setShowAddForm(false);
    setEditingProduct(null);
    form.reset({
      name: "",
      sku: "",
      price: "",
      stock: 0,
      categoryId: 0,
      productType: 1,
      imageUrl: "",
      trackInventory: true,
      taxRate: "8", // 8% tax rate as integer
      priceIncludesTax: false,
      afterTaxPrice: "",
      floor: "1",
      zone: "A",
      unit: "Cái",
    });
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleModalClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl w-full max-h-screen overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle>{t("tables.productManagement")}</DialogTitle>
        </DialogHeader>

        <div className="w-full p-6">
          {!showAddForm ? (
            <>
              <div className="flex flex-col space-y-4 mb-6">
                <div className="flex space-x-4">
                  <Button
                    variant="outline"
                    className="border-green-500 text-green-700 hover:bg-green-100 hover:border-green-600"
                    onClick={exportProductsToExcel}
                  >
                    <Download className="mr-2" size={16} />
                    {t("tables.export")}
                  </Button>
                </div>

                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Tìm kiếm theo tên hoặc mã SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg overflow-hidden">
                {isLoading ? (
                  <div className="p-8 text-center">{t("tables.loading")}</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">
                      {searchTerm
                        ? `Không tìm thấy sản phẩm nào với từ khóa "${searchTerm}"`
                        : "Không có sản phẩm nào"}
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-center py-3 px-2 font-medium pos-text-primary w-16">
                          {t("common.no")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium pos-text-primary">
                          {t("tables.product")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium pos-text-primary">
                          {t("tables.sku")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium pos-text-primary">
                          {t("tables.category")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium pos-text-primary">
                          {t("tables.productType")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium pos-text-primary">
                          {t("tables.price")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium pos-text-primary">
                          {t("tables.taxRate")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium pos-text-primary">
                          {t("tables.stock")}
                        </th>
                        <th className="text-left py-3 px-4 font-medium pos-text-primary">
                          {t("tables.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredProducts.map((product, index) => (
                        <tr
                          key={product.id}
                          className="border-b border-gray-200"
                        >
                          <td className="py-3 px-2 text-center text-gray-600">
                            {index + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-200 rounded"></div>
                              )}
                              <span className="font-medium">
                                {product.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 pos-text-secondary">
                            {product.sku}
                          </td>
                          <td className="py-3 px-4 pos-text-secondary">
                            {getCategoryName(product.categoryId)}
                          </td>
                          <td className="py-3 px-4 pos-text-secondary">
                            {getProductTypeName(product.productType || 1)}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {Math.round(
                              parseFloat(product.price),
                            ).toLocaleString("vi-VN")}{" "}
                            ₫
                          </td>
                          <td className="py-3 px-4 pos-text-secondary">
                            {product.taxRate || ""}%
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                product.stock > 10
                                  ? "bg-green-600 text-white"
                                  : product.stock > 5
                                    ? "bg-orange-500 text-white"
                                    : product.stock > 0
                                      ? "bg-red-500 text-white"
                                      : "bg-gray-400 text-white"
                              }`}
                            >
                              {product.stock}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditProduct(product)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Pencil size={16} className="mr-1" />
                                {t("common.view")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium">
                  {editingProduct
                    ? t("tables.editProduct")
                    : t("tables.addNewProduct")}
                </h3>
                {/* <Button variant="ghost" onClick={resetForm}>
                  <X size={16} />
                </Button> */}
              </div>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  {/* Row 1: Basic Information */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("tables.productName")}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={t("tables.productNamePlaceholder")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("tables.sku")} (Tự động tạo nếu để trống)
                          </FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="ITEM-xxxxxx (tự động tạo)"
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={generateSKU}
                              className="whitespace-nowrap"
                            >
                              Tạo SKU
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 2: Category & Product Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("tables.category")}</FormLabel>
                          <Select
                            onValueChange={(value) =>
                              field.onChange(parseInt(value))
                            }
                            value={field.value.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("tables.selectCategory")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
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
                      control={form.control}
                      name="productType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("tables.productType")}</FormLabel>
                          <Select
                            onValueChange={(value) =>
                              field.onChange(parseInt(value))
                            }
                            value={field.value.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("tables.selectProductType")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">
                                {t("tables.goodsType")}
                              </SelectItem>
                              <SelectItem value="2">
                                {t("tables.materialType")}
                              </SelectItem>
                              <SelectItem value="3">
                                {t("tables.finishedProductType")}
                              </SelectItem>
                              <SelectItem value="4">
                                {t("tables.expensesType")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 3: Pricing Information */}
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("tables.price")}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="text"
                              placeholder={t(
                                "common.comboValues.pricePlaceholder",
                              )}
                              value={
                                field.value
                                  ? parseInt(
                                      field.value
                                        .toString()
                                        .replace(/[^0-9]/g, "") || "0",
                                    ).toLocaleString("vi-VN")
                                  : ""
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                // Only allow numbers
                                const sanitized = value.replace(/[^0-9]/g, "");

                                // Check if the number would exceed the limit
                                const num = parseInt(sanitized || "0");
                                if (num >= 100000000) {
                                  // Don't allow input that would exceed the limit
                                  return;
                                }

                                // Store the raw numeric value as string
                                field.onChange(sanitized);

                                // Calculate after tax price from base price
                                if (sanitized && !isNaN(parseInt(sanitized))) {
                                  const basePrice = parseInt(sanitized);
                                  const taxRateValue =
                                    form.getValues("taxRate") || "0";

                                  // Convert KCT/KKKNT to 0 for calculation
                                  let taxRateNum = 0;
                                  if (
                                    taxRateValue === "KCT" ||
                                    taxRateValue === "KKKNT"
                                  ) {
                                    taxRateNum = 0;
                                  } else {
                                    taxRateNum = parseFloat(taxRateValue);
                                  }

                                  // Calculate after tax price: afterTaxPrice = basePrice + (basePrice * taxRate/100)
                                  const afterTaxPrice = Math.round(
                                    basePrice + (basePrice * taxRateNum) / 100,
                                  );

                                  // Update the after tax price field
                                  form.setValue(
                                    "afterTaxPrice",
                                    afterTaxPrice.toString(),
                                  );
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("tables.taxRate")}</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);

                              // Calculate after tax price when tax rate changes
                              const basePrice = form.getValues("price");
                              if (basePrice && !isNaN(parseInt(basePrice))) {
                                const basePriceNum = parseInt(basePrice);

                                // Convert KCT/KKKNT to 0 for calculation
                                let taxRateNum = 0;
                                if (value === "KCT" || value === "KKKNT") {
                                  taxRateNum = 0;
                                } else {
                                  taxRateNum = parseFloat(value);
                                }

                                // Calculate after tax price: afterTaxPrice = basePrice + (basePrice * taxRate/100)
                                const afterTaxPrice = Math.round(
                                  basePriceNum +
                                    (basePriceNum * taxRateNum) / 100,
                                );

                                // Update the after tax price field
                                form.setValue(
                                  "afterTaxPrice",
                                  afterTaxPrice.toString(),
                                );
                              }
                            }}
                            value={field.value?.toString() || "8"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Chọn thuế suất" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="KCT">KCT (Không chịu thuế)</SelectItem>
                              <SelectItem value="KKKNT">KKKNT (Không kê khai nộp thuế)</SelectItem>
                              <SelectItem value="0">0%</SelectItem>
                              <SelectItem value="5">5%</SelectItem>
                              <SelectItem value="8">8%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("tables.unit") || "Đơn vị tính"}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || "Cái"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("tables.selectUnit") || "Chọn đơn vị"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {units && units.length > 0 ? (
                                units.map((unit) => (
                                  <SelectItem key={unit} value={unit}>
                                    {unit}
                                  </SelectItem>
                                ))
                              ) : (
                                <>
                                  <SelectItem value="Cái">Cái</SelectItem>
                                  <SelectItem value="Ly">Ly</SelectItem>
                                  <SelectItem value="Chai">Chai</SelectItem>
                                  <SelectItem value="Lon">Lon</SelectItem>
                                  <SelectItem value="Phần">Phần</SelectItem>
                                  <SelectItem value="Đĩa">Đĩa</SelectItem>
                                  <SelectItem value="Tô">Tô</SelectItem>
                                  <SelectItem value="Kg">Kg</SelectItem>
                                  <SelectItem value="Gói">Gói</SelectItem>
                                  <SelectItem value="Hộp">Hộp</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 4: Inventory */}
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("tables.stock")}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              placeholder={t("tables.stockPlaceholder")}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 0)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 층과 구역 선택 */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="floor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("tables.floorLabel")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("tables.floorPlaceholder")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">
                                {t("common.floor")} 1
                              </SelectItem>
                              <SelectItem value="2">
                                {t("common.floor")} 2
                              </SelectItem>
                              <SelectItem value="3">
                                {t("common.floor")} 3
                              </SelectItem>
                              <SelectItem value="4">
                                {t("common.floor")} 4
                              </SelectItem>
                              <SelectItem value="5">
                                {t("common.floor")} 5
                              </SelectItem>
                              <SelectItem value="6">
                                {t("common.floor")} 6
                              </SelectItem>
                              <SelectItem value="7">
                                {t("common.floor")} 7
                              </SelectItem>
                              <SelectItem value="8">
                                {t("common.floor")} 8
                              </SelectItem>
                              <SelectItem value="9">
                                {t("common.floor")} 9
                              </SelectItem>
                              <SelectItem value="10">
                                {t("common.floor")} 10
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("tables.zoneLabel")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("tables.zonePlaceholder")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="A">
                                {t("common.zone")} A
                              </SelectItem>
                              <SelectItem value="B">
                                {t("common.zone")} B
                              </SelectItem>
                              <SelectItem value="C">
                                {t("common.zone")} C
                              </SelectItem>
                              <SelectItem value="D">
                                {t("common.zone")} D
                              </SelectItem>
                              <SelectItem value="E">
                                {t("common.zone")} E
                              </SelectItem>
                              <SelectItem value="F">
                                {t("common.zone")} F
                              </SelectItem>
                              <SelectItem value="Vip">
                                {t("common.zone")} VIP
                              </SelectItem>
                              <SelectItem value="All">
                                {t("common.all")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 이미지 입력 방식 선택 */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      {t("tables.imageUrlOptional")}
                    </Label>
                    <Tabs
                      value={imageInputMethod}
                      onValueChange={(value) =>
                        setImageInputMethod(value as "url" | "file")
                      }
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger
                          value="url"
                          className="flex items-center gap-2"
                        >
                          <Link className="w-4 h-4" />
                          {t("common.urlInput")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="file"
                          className="flex items-center gap-2"
                        >
                          <FileImage className="w-4 h-4" />
                          {t("common.fileUpload")}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="url" className="mt-3">
                        <FormField
                          control={form.control}
                          name="imageUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder={t("tables.imageUrl")}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      <TabsContent value="file" className="mt-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {selectedImageFile ? (
                                  <>
                                    <FileImage className="w-8 h-8 mb-2 text-green-500" />
                                    <p className="text-sm text-gray-700 font-medium">
                                      {selectedImageFile.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {(selectedImageFile.size / 1024).toFixed(
                                        1,
                                      )}{" "}
                                      KB
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                    <p className="mb-2 text-sm text-gray-500">
                                      <span className="font-semibold">
                                        {t("common.selectImageFile")}
                                      </span>
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {t("common.dragDropUpload")}
                                    </p>
                                  </>
                                )}
                              </div>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    // 이미지 파일 크기 제한 (5MB)
                                    if (file.size > 5 * 1024 * 1024) {
                                      toast({
                                        title: "오류",
                                        description:
                                          "이미지 크기는 5MB를 초과할 수 없습니다.",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    setSelectedImageFile(file);
                                    // imageUrl 필드를 비워서 URL과 중복되지 않도록 함
                                    form.setValue("imageUrl", "");
                                  }
                                }}
                              />
                            </label>
                          </div>
                          {selectedImageFile && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedImageFile(null)}
                              className="w-full"
                            >
                              <X className="w-4 h-4 mr-2" />
                              파일 제거
                            </Button>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="trackInventory"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value !== false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              {t("inventory.trackInventory")}
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </div>

        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
        />
      </DialogContent>
    </Dialog>
  );
}