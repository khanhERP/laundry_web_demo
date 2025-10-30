import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Trash2, Check, X, FileDown, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";
import * as XLSX from "xlsx";

// Helper function to format currency
const formatCurrency = (value: string | number): string => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return "0";
  // Format: dấu phẩy (,) ngăn cách hàng nghìn, dấu chấm (.) ngăn cách thập phân
  return numValue
    .toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/,/g, ","); // Giữ dấu phẩy cho hàng nghìn
};

interface PriceList {
  id: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  validFrom?: string;
  validTo?: string;
  createdAt: string;
  updatedAt: string;
  storeCode?: string; // Added to satisfy the type
}

interface PriceListItem {
  id?: number;
  priceListId: number;
  productId: number;
  price: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  price: string;
  categoryId: number;
  categoryName?: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface ProductWithPrices extends Product {
  prices: { [priceListId: number]: string };
}

export function PriceListManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPriceLists, setSelectedPriceLists] = useState<number[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState<PriceList | null>(
    null,
  );
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingPrices, setEditingPrices] = useState<{
    [key: string]: string;
  }>({});
  const [priceListForm, setPriceListForm] = useState({
    code: "",
    name: "",
    description: "",
    isActive: true,
    storeCodes: [] as string[],
    validFrom: "",
    validTo: "",
  });
  const [storeFilter, setStoreFilter] = useState<string>("all");

  // Fetch current user store settings
  const { data: currentUserSettings } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings");
      if (!response.ok) throw new Error("Failed to fetch user settings");
      return response.json();
    },
  });

  const isAdmin = currentUserSettings?.isAdmin || false;
  const userStoreCodes =
    currentUserSettings?.parent?.split(",").map((s: string) => s.trim()) || [];

  // Fetch all stores for selection
  const { data: allStores = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list");
      if (!response.ok) throw new Error("Failed to fetch stores");
      return response.json();
    },
  });

  // Filter stores based on user permission
  const availableStores = isAdmin
    ? allStores.filter((store: any) => store.typeUser !== 1)
    : allStores.filter(
        (store: any) =>
          store.typeUser !== 1 && userStoreCodes.includes(store.storeCode),
      );

  // Fetch next price list code
  const { data: nextCodeData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists/next-code"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists/next-code");
      if (!response.ok) throw new Error("Failed to fetch next code");
      return response.json();
    },
    enabled: isDialogOpen && !editingPriceList,
  });

  // Initialize store filter for non-admin users
  useEffect(() => {
    if (!isAdmin && availableStores.length > 0 && storeFilter === "all") {
      setStoreFilter(availableStores[0].storeCode);
    }
  }, [isAdmin, availableStores, storeFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Fetch price lists
  const { data: priceLists = [], isLoading: priceListsLoading } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists");
      if (!response.ok) throw new Error("Failed to fetch price lists");
      return response.json();
    },
  });

  // Filter price lists based on store filter
  const filteredPriceLists = useMemo(() => {
    if (storeFilter === "all") {
      return priceLists;
    }
    return priceLists.filter((priceList: PriceList) => {
      if (!priceList.storeCode) return false;
      const storeCodes = priceList.storeCode
        .split(",")
        .map((s: string) => s.trim());
      return storeCodes.includes(storeFilter);
    });
  }, [priceLists, storeFilter]);

  // Fetch all products for search/selection
  const { data: allProducts = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Fetch price list items for selected price lists
  const { data: priceListItemsData = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items", selectedPriceLists],
    queryFn: async () => {
      if (selectedPriceLists.length === 0) return [];

      const itemsPromises = selectedPriceLists.map(async (priceListId) => {
        const response = await apiRequest(
          "GET",
          `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists/${priceListId}`,
        );
        if (!response.ok) throw new Error("Failed to fetch price list items");
        const data = await response.json();
        return data.items || [];
      });

      const allItems = await Promise.all(itemsPromises);
      return allItems.flat();
    },
    enabled: selectedPriceLists.length > 0,
    refetchOnMount: false, // Không refetch khi mount
    refetchOnWindowFocus: false, // Không refetch khi focus
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Auto-generate code if not provided
      if (!data.code) {
        // Fetch current price lists to determine the next code
        const existingListsResponse = await apiRequest(
          "GET",
          "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists",
        );
        if (!existingListsResponse.ok)
          throw new Error(
            "Failed to fetch existing price lists for code generation",
          );
        const existingLists = await existingListsResponse.json();

        const maxCode = existingLists.reduce((max: number, list: PriceList) => {
          const match = list.code?.match(/BG-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            return num > max ? num : max;
          }
          return max;
        }, 0);
        data.code = `BG-${String(maxCode + 1).padStart(6, "0")}`;
      }

      const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create price list");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists"] });
      queryClient.invalidateQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists/next-code"],
      });
      toast({
        title: "Thành công",
        description: "Tạo bảng giá thành công",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PUT", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update price list");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists"] });
      toast({
        title: "Thành công",
        description: "Cập nhật bảng giá thành công",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete price list");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists"] });
      toast({
        title: "Thành công",
        description: "Xóa bảng giá thành công",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({
      priceListId,
      productId,
      price,
    }: {
      priceListId: number;
      productId: number;
      price: string;
    }) => {
      const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items", {
        priceListId,
        productId,
        price,
      });
      if (!response.ok) throw new Error("Failed to update price");
      return response.json();
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches để tránh ghi đè optimistic update
      await queryClient.cancelQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items", selectedPriceLists],
      });

      // Snapshot giá trị hiện tại
      const previousData = queryClient.getQueryData([
        "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items",
        selectedPriceLists,
      ]);

      // Optimistically update cache ngay lập tức
      queryClient.setQueryData(
        ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items", selectedPriceLists],
        (old: any) => {
          if (!old) return old;

          // Tìm item cần update
          const existingItemIndex = old.findIndex(
            (item: any) =>
              item.priceListId === variables.priceListId &&
              item.productId === variables.productId,
          );

          if (existingItemIndex !== -1) {
            // Update item đã tồn tại
            const newData = [...old];
            newData[existingItemIndex] = {
              ...newData[existingItemIndex],
              price: variables.price,
            };
            return newData;
          } else {
            // Thêm item mới nếu chưa tồn tại
            return [
              ...old,
              {
                priceListId: variables.priceListId,
                productId: variables.productId,
                price: variables.price,
              },
            ];
          }
        },
      );

      // Return context để có thể rollback nếu lỗi
      return { previousData };
    },
    onSuccess: (data, variables) => {
      // Update lại cache với data từ server (đảm bảo có ID)
      queryClient.setQueryData(
        ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items", selectedPriceLists],
        (old: any) => {
          if (!old) return [data];

          const existingItemIndex = old.findIndex(
            (item: any) =>
              item.priceListId === variables.priceListId &&
              item.productId === variables.productId,
          );

          if (existingItemIndex !== -1) {
            const newData = [...old];
            newData[existingItemIndex] = data;
            return newData;
          } else {
            return [...old, data];
          }
        },
      );
    },
    onError: (error: Error, _variables, context) => {
      // Rollback về giá trị cũ nếu có lỗi
      if (context?.previousData) {
        queryClient.setQueryData(
          ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items", selectedPriceLists],
          context.previousData,
        );
      }
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete product from price list mutation
  const deleteProductFromPriceListMutation = useMutation({
    mutationFn: async ({
      priceListId,
      productId,
    }: {
      priceListId: number;
      productId: number;
    }) => {
      console.log(
        `🗑️ Deleting product ${productId} from price list ${priceListId}`,
      );
      const response = await apiRequest(
        "DELETE",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items/${priceListId}/${productId}`,
      );
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Không thể xóa sản phẩm" }));
        throw new Error(
          error.message || error.error || "Không thể xóa sản phẩm",
        );
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      console.log(
        `✅ Product ${variables.productId} deleted from price list ${variables.priceListId}`,
      );
    },
    onError: (error: Error) => {
      console.error("❌ Delete mutation error:", error);
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPriceList(null);
    setPriceListForm({
      code: "",
      name: "",
      description: "",
      isActive: true,
      storeCodes: [],
      validFrom: "",
      validTo: "",
    });
  };

  // Auto-fill code when creating new price list (optional now)
  useEffect(() => {
    if (
      isDialogOpen &&
      !editingPriceList &&
      nextCodeData?.code &&
      !priceListForm.code
    ) {
      setPriceListForm((prev) => ({
        ...prev,
        code: nextCodeData.code,
      }));
    }
  }, [isDialogOpen, editingPriceList, nextCodeData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!priceListForm.name) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên bảng giá",
        variant: "destructive",
      });
      return;
    }

    if (priceListForm.storeCodes.length === 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất 1 chi nhánh áp dụng",
        variant: "destructive",
      });
      return;
    }

    if (editingPriceList && !priceListForm.code) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã bảng giá",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...priceListForm,
      storeCode: priceListForm.storeCodes.join(","),
    };

    if (editingPriceList) {
      // Update existing price list
      updateMutation.mutate({
        id: editingPriceList.id,
        data: submitData,
      });
    } else {
      // Create price list without any products initially
      createMutation.mutate({
        ...submitData,
        items: [],
      });
    }
  };

  const handleEdit = (priceList: PriceList) => {
    setEditingPriceList(priceList);
    setPriceListForm({
      code: priceList.code,
      name: priceList.name,
      description: priceList.description || "",
      isActive: priceList.isActive,
      storeCodes: priceList.storeCode
        ? priceList.storeCode.split(",").map((s: string) => s.trim())
        : [],
      validFrom: priceList.validFrom ? priceList.validFrom.split("T")[0] : "",
      validTo: priceList.validTo ? priceList.validTo.split("T")[0] : "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (priceList: PriceList) => {
    setPriceListToDelete(priceList);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (priceListToDelete) {
      deleteMutation.mutate(priceListToDelete.id);
      setShowDeleteDialog(false);
      setPriceListToDelete(null);
    }
  };

  const togglePriceListSelection = (id: number) => {
    setSelectedPriceLists((prev) =>
      prev.includes(id) ? prev.filter((plId) => plId !== id) : [...prev, id],
    );
  };

  // Build products with prices - only show products that have been explicitly added
  const productsWithPrices = useMemo(() => {
    if (selectedPriceLists.length === 0) {
      return [];
    }

    // Get unique product IDs that exist in ANY selected price list
    const productIdsInPriceLists = new Set<number>();

    priceListItemsData.forEach((item: PriceListItem) => {
      productIdsInPriceLists.add(item.productId);
    });

    const result: ProductWithPrices[] = allProducts
      .filter((product: Product) => productIdsInPriceLists.has(product.id))
      .map((product: Product) => {
        const prices: { [priceListId: number]: string } = {};

        // Get prices from price list items
        selectedPriceLists.forEach((priceListId) => {
          const item = priceListItemsData.find(
            (i: PriceListItem) =>
              i.priceListId === priceListId && i.productId === product.id,
          );
          prices[priceListId] = item ? item.price : "";
        });

        return {
          ...product,
          prices,
        };
      });

    return result;
  }, [allProducts, selectedPriceLists, priceListItemsData]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return productsWithPrices.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" ||
        product.categoryId.toString() === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [productsWithPrices, searchTerm, selectedCategory]);

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedPriceLists]);

  const handlePriceInputChange = (
    priceListId: number,
    productId: number,
    value: string,
  ) => {
    const key = `${priceListId}-${productId}`;
    setEditingPrices((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handlePriceSave = (
    priceListId: number,
    productId: number,
    newPrice: string,
  ) => {
    const key = `${priceListId}-${productId}`;

    // Only save if there's a valid price and it's different from current
    if (newPrice && newPrice.trim() !== "") {
      updatePriceMutation.mutate({
        priceListId,
        productId,
        price: newPrice,
      });
    }

    // Remove from editing state after saving
    setEditingPrices((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  // Add products to price list mutation
  const addProductsMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      if (selectedPriceLists.length === 0) {
        throw new Error("Vui lòng chọn bảng giá trước");
      }

      const priceListId = selectedPriceLists[0]; // Add to first selected price list

      try {
        const promises = productIds.map(async (productId) => {
          const prod = allProducts.find((p: Product) => p.id === productId);
          if (!prod) {
            throw new Error(`Không tìm thấy sản phẩm ID ${productId}`);
          }

          const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items", {
            priceListId,
            productId,
            price: "0",
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.message || errorData.error || "Không thể thêm sản phẩm",
            );
          }
          return response.json();
        });

        const results = await Promise.all(promises);
        return results;
      } catch (error) {
        console.error("Error adding products:", error);
        throw error;
      }
    },
    onSuccess: async () => {
      // Chỉ invalidate một lần, không refetch ngay
      queryClient.invalidateQueries({
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items", selectedPriceLists],
      });

      setShowProductSelector(false);
      setSelectedProducts([]);
      toast({
        title: "Thành công",
        description: "Thêm sản phẩm vào bảng giá thành công",
      });
    },
    onError: (error: Error) => {
      console.error("Add products mutation error:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể thêm sản phẩm vào bảng giá",
        variant: "destructive",
      });
    },
  });

  const handleAddProducts = () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất một sản phẩm",
        variant: "destructive",
      });
      return;
    }
    addProductsMutation.mutate(selectedProducts);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (selectedPriceLists.length === 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn bảng giá để xuất",
        variant: "destructive",
      });
      return;
    }

    if (filteredProducts.length === 0) {
      toast({
        title: "Lỗi",
        description: "Không có sản phẩm để xuất",
        variant: "destructive",
      });
      return;
    }

    // Prepare data for export
    const exportData = [
      [
        "Mã hàng",
        "Tên hàng",
        "Nhóm hàng",
        ...selectedPriceLists.map((plId) => {
          const pl = priceLists.find((p: PriceList) => p.id === plId);
          return pl?.name || `Bảng giá ${plId}`;
        }),
      ],
    ];

    filteredProducts.forEach((product) => {
      const row = [
        product.sku,
        product.name,
        categories.find((c: Category) => c.id === product.categoryId)?.name ||
          "",
        ...selectedPriceLists.map((plId) => product.prices[plId] || ""),
      ];
      exportData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Auto-fit column widths
    const colWidths = [
      { wch: 15 }, // Mã hàng
      { wch: 40 }, // Tên hàng
      { wch: 20 }, // Nhóm hàng
      ...selectedPriceLists.map(() => ({ wch: 15 })), // Price columns
    ];
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bảng giá");

    const priceListNames = selectedPriceLists
      .map((plId) => priceLists.find((p: PriceList) => p.id === plId)?.code)
      .join("_");
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `bang_gia_${priceListNames}_${timestamp}.xlsx`);

    toast({
      title: "Thành công",
      description: "Đã xuất file Excel thành công",
    });
  };

  // Import from Excel
  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as any[][];

        if (jsonData.length < 2) {
          throw new Error("File Excel không có dữ liệu");
        }

        const headers = jsonData[0];

        // Validate headers
        if (
          headers[0] !== "Mã bảng giá" ||
          headers[1] !== "Mã sản phẩm" ||
          headers[2] !== "Giá sản phẩm"
        ) {
          throw new Error(
            "File Excel không đúng định dạng. Vui lòng sử dụng file mẫu với các cột: Mã bảng giá, Mã sản phẩm, Giá sản phẩm",
          );
        }

        // Process rows
        const updates: Array<{
          priceListId: number;
          productId: number;
          price: string;
        }> = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const priceListCode = row[0]?.toString().trim();
          const productSku = row[1]?.toString().trim();
          const price = row[2]?.toString().trim();

          if (!priceListCode || !productSku || !price) continue;

          // Find price list by code
          const priceList = priceLists.find(
            (pl: PriceList) => pl.code === priceListCode,
          );
          if (!priceList) {
            console.warn(`Không tìm thấy bảng giá với mã: ${priceListCode}`);
            continue;
          }

          // Find product by SKU
          const product = allProducts.find(
            (p: Product) => p.sku === productSku,
          );
          if (!product) {
            console.warn(`Không tìm thấy sản phẩm với SKU: ${productSku}`);
            continue;
          }

          if (!isNaN(parseFloat(price))) {
            updates.push({
              priceListId: priceList.id,
              productId: product.id,
              price: parseFloat(price).toString(),
            });
          }
        }

        if (updates.length === 0) {
          toast({
            title: "Lỗi",
            description: "Không có dữ liệu hợp lệ để import",
            variant: "destructive",
          });
          return;
        }

        // Batch update prices
        let successCount = 0;
        let errorCount = 0;

        for (const update of updates) {
          try {
            await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items", update);
            successCount++;
          } catch (error) {
            errorCount++;
            console.error("Error updating price:", error);
          }
        }

        await queryClient.invalidateQueries({
          queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items"],
        });
        await queryClient.refetchQueries({
          queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items"],
        });

        toast({
          title: "Thành công",
          description: `Import thành công ${successCount} giá${errorCount > 0 ? `, ${errorCount} lỗi` : ""}`,
        });

        setShowImportDialog(false);
      } catch (error) {
        console.error("Import error:", error);
        toast({
          title: "Lỗi",
          description:
            error instanceof Error
              ? error.message
              : "Không thể import file Excel",
          variant: "destructive",
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    if (selectedPriceLists.length === 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn bảng giá để tải mẫu",
        variant: "destructive",
      });
      return;
    }

    // Create template with only 3 columns: Price List Code, Product SKU, Price
    const template = [
      ["Mã bảng giá", "Mã sản phẩm", "Giá sản phẩm"],
      ...selectedPriceLists.map((plId) => {
        const pl = priceLists.find((p: PriceList) => p.id === plId);
        return [pl?.code || `BG-${plId}`, "ITEM-001", "100000"];
      }),
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);

    // Auto-fit column widths
    const colWidths = [
      { wch: 20 }, // Mã bảng giá
      { wch: 20 }, // Mã sản phẩm
      { wch: 15 }, // Giá sản phẩm
    ];
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mẫu bảng giá");
    XLSX.writeFile(wb, "mau_bang_gia.xlsx");

    toast({
      title: "Thành công",
      description: "Đã tải file mẫu thành công",
    });
  };

  return (
    <div className="h-full flex gap-4">
      {/* Left Sidebar - Price Lists */}
      <div className="w-64 flex-shrink-0 space-y-4">
        {/* Store Filter */}
        <div className="space-y-2">
          <Label>{t("common.storeFilterLabel")}</Label>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn cửa hàng" />
            </SelectTrigger>
            <SelectContent>
              {isAdmin && (
                <SelectItem value="all">{t("common.all")}</SelectItem>
              )}
              {availableStores.map((store: any) => (
                <SelectItem key={store.id} value={store.storeCode}>
                  {store.storeName} ({store.storeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("settings.priceLists")}</h3>
          <Button
            size="sm"
            onClick={() => {
              setEditingPriceList(null);
              setPriceListForm({
                code: "",
                name: "",
                description: "",
                isActive: true,
                storeCodes: [],
                validFrom: "",
                validTo: "",
              });

              setIsDialogOpen(true);
            }}
            className="h-8"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t("settings.createNewPriceList")}
          </Button>
        </div>

        {/* Check All Checkbox */}
        {filteredPriceLists.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
            <input
              type="checkbox"
              id="check-all-price-lists"
              checked={
                selectedPriceLists.length === filteredPriceLists.length &&
                filteredPriceLists.length > 0
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedPriceLists(
                    filteredPriceLists.map((pl: PriceList) => pl.id),
                  );
                } else {
                  setSelectedPriceLists([]);
                }
              }}
              className="w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="check-all-price-lists"
              className="text-sm font-medium cursor-pointer select-none"
            >
              {t("settings.selectAllPriceLists")} ({filteredPriceLists.length})
            </label>
          </div>
        )}

        <div className="space-y-2">
          {priceListsLoading ? (
            <div className="text-sm text-gray-500">Đang tải...</div>
          ) : (
            filteredPriceLists.map((priceList: PriceList) => (
              <div
                key={priceList.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedPriceLists.includes(priceList.id)
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => togglePriceListSelection(priceList.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        selectedPriceLists.includes(priceList.id)
                          ? "bg-blue-500 border-blue-500"
                          : "border-gray-300"
                      }`}
                    >
                      {selectedPriceLists.includes(priceList.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm font-medium truncate">
                      {priceList.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    {t("settings.priceListCode")}: {priceList.code}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(priceList);
                    }}
                    disabled={
                      !isAdmin &&
                      priceList.storeCode &&
                      priceList.storeCode
                        .split(",")
                        .filter((s: string) => s.trim()).length > 1
                    }
                    title={
                      !isAdmin &&
                      priceList.storeCode &&
                      priceList.storeCode
                        .split(",")
                        .filter((s: string) => s.trim()).length > 1
                        ? "Chỉ admin mới có quyền sửa bảng giá áp dụng nhiều cửa hàng"
                        : "Sửa bảng giá"
                    }
                    className="h-8 w-8 p-0"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-500"
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(priceList);
                    }}
                    disabled={
                      priceList.isDefault ||
                      (!isAdmin &&
                        priceList.storeCode &&
                        priceList.storeCode
                          .split(",")
                          .filter((s: string) => s.trim()).length > 1)
                    }
                    title={
                      priceList.isDefault
                        ? "Không thể xóa bảng giá mặc định"
                        : !isAdmin &&
                            priceList.storeCode &&
                            priceList.storeCode
                              .split(",")
                              .filter((s: string) => s.trim()).length > 1
                          ? "Chỉ admin mới có quyền xóa bảng giá áp dụng nhiều cửa hàng"
                          : "Xóa bảng giá"
                    }
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Content - Products Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Card className="flex-1 flex flex-col">
          <CardContent className="p-4 flex-1 flex flex-col overflow-hidden">
            {/* Read-only warning for non-admin users */}
            {!isAdmin &&
              selectedPriceLists.length > 0 &&
              selectedPriceLists.some((plId) => {
                const pl = priceLists.find((p: PriceList) => p.id === plId);
                return (
                  pl?.storeCode &&
                  pl.storeCode.split(",").filter((s: string) => s.trim())
                    .length > 1
                );
              }) && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>{t("settings.readOnlyMode")}:</strong>{" "}
                    {t("settings.readOnlyModeDesc")}
                  </p>
                </div>
              )}

            {/* Filters */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={t("settings.searchProductPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("settings.categoryName")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("settings.allProductGroups")}
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
              <Button
                onClick={() => setShowProductSelector(true)}
                disabled={
                  selectedPriceLists.length === 0 ||
                  (!isAdmin &&
                    selectedPriceLists.some((plId) => {
                      const pl = priceLists.find(
                        (p: PriceList) => p.id === plId,
                      );
                      return (
                        pl?.storeCode &&
                        pl.storeCode.split(",").filter((s: string) => s.trim())
                          .length > 1
                      );
                    }))
                }
                title={
                  !isAdmin &&
                  selectedPriceLists.some((plId) => {
                    const pl = priceLists.find((p: PriceList) => p.id === plId);
                    return (
                      pl?.storeCode &&
                      pl.storeCode.split(",").filter((s: string) => s.trim())
                        .length > 1
                    );
                  })
                    ? "Chỉ admin mới có quyền thêm sản phẩm vào bảng giá nhiều chi nhánh"
                    : ""
                }
                className="whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("settings.addProductsToPriceList")}
              </Button>
              <Button
                onClick={handleExportExcel}
                disabled={
                  selectedPriceLists.length === 0 ||
                  filteredProducts.length === 0
                }
                variant="outline"
                className="whitespace-nowrap"
              >
                <FileDown className="w-4 h-4 mr-2" />
                {t("settings.exportPriceList")}
              </Button>
              <Button
                onClick={() => setShowImportDialog(true)}
                disabled={
                  selectedPriceLists.length === 0 ||
                  (!isAdmin &&
                    selectedPriceLists.some((plId) => {
                      const pl = priceLists.find(
                        (p: PriceList) => p.id === plId,
                      );
                      return (
                        pl?.storeCode &&
                        pl.storeCode.split(",").filter((s: string) => s.trim())
                          .length > 1
                      );
                    }))
                }
                title={
                  !isAdmin &&
                  selectedPriceLists.some((plId) => {
                    const pl = priceLists.find((p: PriceList) => p.id === plId);
                    return (
                      pl?.storeCode &&
                      pl.storeCode.split(",").filter((s: string) => s.trim())
                        .length > 1
                    );
                  })
                    ? "Chỉ admin mới có quyền import giá cho bảng giá nhiều chi nhánh"
                    : ""
                }
                variant="outline"
                className="whitespace-nowrap"
              >
                <FileUp className="w-4 h-4 mr-2" />
                {t("settings.importPriceList")}
              </Button>
            </div>

            {/* Products Table */}
            <div className="flex-1 overflow-hidden border-2 border-gray-300 rounded-lg shadow-sm">
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full divide-y-2 divide-gray-300">
                      <thead className="bg-gradient-to-r from-gray-100 to-gray-50 sticky top-0 z-20 border-b-2 border-gray-300">
                        <tr>
                          <th
                            scope="col"
                            className="sticky left-0 z-30 bg-gradient-to-r from-gray-100 to-gray-50 px-2 py-4 text-left text-sm font-bold text-gray-700 tracking-wider min-w-[120px] w-[120px] border-r-2 border-gray-300 shadow-sm whitespace-normal leading-tight"
                          >
                            {t("settings.productCode")}
                          </th>
                          <th
                            scope="col"
                            className="sticky left-[120px] z-30 bg-gradient-to-r from-gray-100 to-gray-50 px-2 py-4 text-left text-sm font-bold text-gray-700 tracking-wider min-w-[250px] w-[250px] border-r-2 border-gray-400 shadow-sm whitespace-normal leading-tight"
                          >
                            {t("settings.productName")}
                          </th>
                          {selectedPriceLists.map((priceListId, index) => {
                            const priceList = priceLists.find(
                              (pl: PriceList) => pl.id === priceListId,
                            );
                            return (
                              <th
                                key={priceListId}
                                scope="col"
                                className={`z-10 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider min-w-[200px] w-[200px] border-r border-gray-300 ${
                                  index % 2 === 0
                                    ? "bg-blue-100"
                                    : "bg-indigo-100"
                                } text-gray-800`}
                              >
                                <div
                                  className="font-semibold"
                                  title={priceList?.name}
                                >
                                  {priceList?.name || t("settings.priceLists")}
                                </div>
                              </th>
                            );
                          })}
                          <th
                            scope="col"
                            className="sticky right-0 z-30 bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[120px] w-[120px] border-l-2 border-gray-400 shadow-sm"
                          >
                            {t("common.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedPriceLists.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3 + selectedPriceLists.length}
                              className="px-4 py-8 text-center text-gray-500"
                            >
                              {t("settings.selectPriceListFirst")}
                            </td>
                          </tr>
                        ) : paginatedProducts.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3 + selectedPriceLists.length}
                              className="px-4 py-8 text-center text-gray-500"
                            >
                              {t("settings.noProductsInPriceList")}
                            </td>
                          </tr>
                        ) : (
                          paginatedProducts.map((product, rowIndex) => (
                            <TableRow
                              key={product.id}
                              className={`hover:bg-blue-50 transition-colors ${
                                rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }`}
                            >
                              <td
                                className={`sticky left-0 z-10 px-2 py-3 whitespace-nowrap text-xs font-mono font-semibold border-r-2 border-gray-300 min-w-[120px] w-[120px] ${
                                  rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                                }`}
                              >
                                {product.sku}
                              </td>
                              <td
                                className={`sticky left-[120px] z-10 px-2 py-3 text-sm border-r-2 border-gray-400 min-w-[200px] w-[200px] ${
                                  rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                                }`}
                              >
                                <div
                                  className="break-words font-medium text-xs leading-tight line-clamp-2"
                                  title={product.name}
                                >
                                  {product.name}
                                </div>
                              </td>
                              {selectedPriceLists.map(
                                (priceListId, colIndex) => {
                                  const key = `${priceListId}-${product.id}`;
                                  const editingValue = editingPrices[key];
                                  const currentValue =
                                    editingValue !== undefined
                                      ? editingValue
                                      : product.prices[priceListId] || "";

                                  // Find the price list to check store count
                                  const priceList = priceLists.find(
                                    (pl: PriceList) => pl.id === priceListId,
                                  );
                                  const storeCount = priceList?.storeCode
                                    ? priceList.storeCode
                                        .split(",")
                                        .filter((s: string) => s.trim()).length
                                    : 0;

                                  // Allow editing only if admin OR price list is for single store
                                  const canEdit = isAdmin || storeCount <= 1;

                                  return (
                                    <td
                                      key={priceListId}
                                      className={`z-0 px-4 py-2 whitespace-nowrap border-r border-gray-300 ${
                                        colIndex % 2 === 0
                                          ? "bg-blue-50"
                                          : "bg-indigo-50"
                                      }`}
                                    >
                                      <Input
                                        type="number"
                                        value={currentValue}
                                        data-price-input={`${product.id}-${colIndex}`}
                                        onChange={(e) =>
                                          handlePriceInputChange(
                                            priceListId,
                                            product.id,
                                            e.target.value,
                                          )
                                        }
                                        onBlur={(e) =>
                                          handlePriceSave(
                                            priceListId,
                                            product.id,
                                            e.target.value,
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();

                                            // Save current value
                                            handlePriceSave(
                                              priceListId,
                                              product.id,
                                              e.currentTarget.value,
                                            );

                                            // Move to next cell
                                            const nextColIndex = colIndex + 1;
                                            if (
                                              nextColIndex <
                                              selectedPriceLists.length
                                            ) {
                                              // Move to next column in same row
                                              setTimeout(() => {
                                                const nextInput =
                                                  document.querySelector(
                                                    `[data-price-input="${product.id}-${nextColIndex}"]`,
                                                  ) as HTMLInputElement;
                                                if (nextInput) {
                                                  nextInput.focus();
                                                  nextInput.select();
                                                }
                                              }, 50);
                                            } else {
                                              // Move to first column of next row
                                              const currentRowIndex =
                                                paginatedProducts.findIndex(
                                                  (p) => p.id === product.id,
                                                );
                                              if (
                                                currentRowIndex <
                                                paginatedProducts.length - 1
                                              ) {
                                                const nextProduct =
                                                  paginatedProducts[
                                                    currentRowIndex + 1
                                                  ];
                                                setTimeout(() => {
                                                  const nextInput =
                                                    document.querySelector(
                                                      `[data-price-input="${nextProduct.id}-0"]`,
                                                    ) as HTMLInputElement;
                                                  if (nextInput) {
                                                    nextInput.focus();
                                                    nextInput.select();
                                                  }
                                                }, 50);
                                              }
                                            }
                                          }
                                        }}
                                        className="text-right w-full"
                                        min="0"
                                        step="1000"
                                        disabled={!canEdit}
                                        title={
                                          !canEdit
                                            ? "Chỉ admin mới có quyền sửa giá cho bảng giá áp dụng nhiều cửa hàng"
                                            : ""
                                        }
                                      />
                                    </td>
                                  );
                                },
                              )}
                              <td
                                className={`sticky right-0 z-10 px-4 py-3 whitespace-nowrap text-center border-l-2 border-gray-400 w-56 ${
                                  rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                                }`}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    if (selectedPriceLists.length === 0) {
                                      toast({
                                        title: "Lỗi",
                                        description: "Vui lòng chọn bảng giá",
                                        variant: "destructive",
                                      });
                                      return;
                                    }

                                    if (
                                      deleteProductFromPriceListMutation.isPending
                                    ) {
                                      return;
                                    }

                                    try {
                                      let successCount = 0;
                                      for (const priceListId of selectedPriceLists) {
                                        await deleteProductFromPriceListMutation.mutateAsync(
                                          {
                                            priceListId,
                                            productId: product.id,
                                          },
                                        );
                                        successCount++;
                                      }

                                      await queryClient.refetchQueries({
                                        queryKey: [
                                          "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-list-items",
                                          selectedPriceLists,
                                        ],
                                        exact: true,
                                      });

                                      toast({
                                        title: "Thành công",
                                        description: `Đã xóa sản phẩm khỏi ${successCount} bảng giá`,
                                      });
                                    } catch (error) {
                                      console.error(
                                        "Error deleting product from price list:",
                                        error,
                                      );
                                      toast({
                                        title: "Lỗi",
                                        description:
                                          error instanceof Error
                                            ? error.message
                                            : "Không thể xóa sản phẩm",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  className="h-8 w-8 p-0 hover:bg-red-50"
                                  disabled={
                                    deleteProductFromPriceListMutation.isPending ||
                                    (!isAdmin &&
                                      selectedPriceLists.some((plId) => {
                                        const pl = priceLists.find(
                                          (p: PriceList) => p.id === plId,
                                        );
                                        return (
                                          pl?.storeCode &&
                                          pl.storeCode
                                            .split(",")
                                            .filter((s: string) => s.trim())
                                            .length > 1
                                        );
                                      }))
                                  }
                                  title={
                                    !isAdmin &&
                                    selectedPriceLists.some((plId) => {
                                      const pl = priceLists.find(
                                        (p: PriceList) => p.id === plId,
                                      );
                                      return (
                                        pl?.storeCode &&
                                        pl.storeCode
                                          .split(",")
                                          .filter((s: string) => s.trim())
                                          .length > 1
                                      );
                                    })
                                      ? "Chỉ admin mới có quyền xóa sản phẩm khỏi bảng giá nhiều chi nhánh"
                                      : ""
                                  }
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </td>
                            </TableRow>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {t("settings.displayingProducts")} {filteredProducts.length}{" "}
                {t("settings.productsCount")}
                {filteredProducts.length > 0 && (
                  <span className="ml-2">
                    ({t("common.page")} {currentPage}/{totalPages})
                  </span>
                )}
              </div>

              {filteredProducts.length > 0 && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {t("settings.itemsPerPageLabel")}
                    </span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm">
                      {t("settings.productsCount")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      {t("settings.firstPage")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      {t("settings.previousPage")}
                    </Button>
                    <span className="text-sm px-2">
                      {t("common.page")} {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      {t("settings.nextPage")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      {t("settings.lastPage")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Selector Dialog */}
      <Dialog open={showProductSelector} onOpenChange={setShowProductSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("settings.selectProductsToAdd")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={t("settings.searchProductsPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("settings.categoryName")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("settings.allProductGroups")}
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

            <div className="border rounded-lg max-h-96 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const availableProducts = allProducts.filter(
                              (product: Product) => {
                                const matchesSearch =
                                  product.name
                                    .toLowerCase()
                                    .includes(searchTerm.toLowerCase()) ||
                                  product.sku
                                    .toLowerCase()
                                    .includes(searchTerm.toLowerCase());
                                const matchesCategory =
                                  selectedCategory === "all" ||
                                  product.categoryId.toString() ===
                                    selectedCategory;

                                // Check if product is not already in selected price lists
                                const notInPriceList = !priceListItemsData.some(
                                  (item: PriceListItem) =>
                                    item.productId === product.id,
                                );

                                return (
                                  matchesSearch &&
                                  matchesCategory &&
                                  notInPriceList
                                );
                              },
                            );
                            setSelectedProducts(
                              availableProducts.map((p: Product) => p.id),
                            );
                          } else {
                            setSelectedProducts([]);
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </TableHead>
                    <TableHead>{t("settings.productCode")}</TableHead>
                    <TableHead>{t("settings.productName")}</TableHead>
                    <TableHead>{t("settings.categoryName")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProducts
                    .filter((product: Product) => {
                      const matchesSearch =
                        product.name
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ||
                        product.sku
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase());
                      const matchesCategory =
                        selectedCategory === "all" ||
                        product.categoryId.toString() === selectedCategory;

                      // Only show products not already in selected price lists
                      const notInPriceList = !priceListItemsData.some(
                        (item: PriceListItem) => item.productId === product.id,
                      );

                      return matchesSearch && matchesCategory && notInPriceList;
                    })
                    .map((product: Product) => (
                      <TableRow key={product.id} className="hover:bg-gray-50">
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([
                                  ...selectedProducts,
                                  product.id,
                                ]);
                              } else {
                                setSelectedProducts(
                                  selectedProducts.filter(
                                    (id) => id !== product.id,
                                  ),
                                );
                              }
                            }}
                            className="w-4 h-4"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {product.sku}
                        </TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>
                          {categories.find(
                            (c: Category) => c.id === product.categoryId,
                          )?.name || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  {allProducts.filter((product: Product) => {
                    const matchesSearch =
                      product.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      product.sku
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase());
                    const matchesCategory =
                      selectedCategory === "all" ||
                      product.categoryId.toString() === selectedCategory;

                    // Only show products not already in selected price lists
                    const notInPriceList = !priceListItemsData.some(
                      (item: PriceListItem) => item.productId === product.id,
                    );

                    return matchesSearch && matchesCategory && notInPriceList;
                  }).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8 text-gray-500"
                      >
                        {t("settings.productsNotInPriceList")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowProductSelector(false);
                setSelectedProducts([]);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAddProducts}
              disabled={
                selectedProducts.length === 0 || addProductsMutation.isPending
              }
            >
              {addProductsMutation.isPending
                ? t("settings.addingProducts")
                : `${t("settings.addProducts")} ${selectedProducts.length} ${t("settings.productsCount")}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.importPricesFromExcel")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="mb-2">{t("settings.instructions")}:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>{t("settings.downloadExcelTemplate")}</li>
                <li>{t("settings.fillInPrices")}</li>
                <li>{t("settings.selectFileToImport")}</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label>{t("settings.excelFile")}</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemplate}
            >
              <FileDown className="w-4 h-4 mr-2" />
              {t("settings.downloadTemplate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowImportDialog(false)}
            >
              {t("settings.closeDialog")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.confirmDeletePriceListTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.confirmDeletePriceListDesc").replace(
                "{name}",
                priceListToDelete?.name || "",
              )}
              <br />
              <br />
              {t("settings.deletePriceListWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false);
                setPriceListToDelete(null);
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t("common.deleting")
                : t("settings.deletePriceListAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPriceList
                ? t("settings.editPriceList")
                : t("settings.createPriceList")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">
                {t("settings.priceListCode")}{" "}
                {!editingPriceList && (
                  <span className="text-xs text-gray-500">
                    {t("settings.priceListCodeAutoHint")}
                  </span>
                )}
                {editingPriceList && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="code"
                value={priceListForm.code || ""}
                onChange={(e) =>
                  setPriceListForm({ ...priceListForm, code: e.target.value })
                }
                placeholder={
                  editingPriceList
                    ? t("settings.enterPriceListName")
                    : t("settings.priceListCodeAutoGenerated")
                }
                required={editingPriceList}
                disabled={editingPriceList}
                className={
                  editingPriceList ? "bg-gray-100 cursor-not-allowed" : ""
                }
              />
              {!editingPriceList && nextCodeData?.code && (
                <p className="text-xs text-green-600">
                  {t("settings.nextCodeWillBe")} <strong>{nextCodeData.code}</strong>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                {t("settings.priceListName")}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={priceListForm.name}
                onChange={(e) =>
                  setPriceListForm({ ...priceListForm, name: e.target.value })
                }
                placeholder={t("settings.enterPriceListName")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {t("settings.priceListDescription")}
              </Label>
              <Input
                id="description"
                value={priceListForm.description}
                onChange={(e) =>
                  setPriceListForm({
                    ...priceListForm,
                    description: e.target.value,
                  })
                }
                placeholder={t("settings.enterPriceListDescription")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeCodes">
                {t("settings.selectStoresRequired")}
              </Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {availableStores.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {t("settings.noStoresYet")}
                  </p>
                ) : (
                  availableStores.map((store: any) => (
                    <div key={store.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`store-${store.id}`}
                        checked={priceListForm.storeCodes.includes(
                          store.storeCode,
                        )}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Nếu không phải admin, chỉ cho chọn 1 chi nhánh
                            if (!isAdmin) {
                              setPriceListForm({
                                ...priceListForm,
                                storeCodes: [store.storeCode],
                              });
                            } else {
                              setPriceListForm({
                                ...priceListForm,
                                storeCodes: [
                                  ...priceListForm.storeCodes,
                                  store.storeCode,
                                ],
                              });
                            }
                          } else {
                            setPriceListForm({
                              ...priceListForm,
                              storeCodes: priceListForm.storeCodes.filter(
                                (code) => code !== store.storeCode,
                              ),
                            });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <label
                        htmlFor={`store-${store.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {store.storeName} ({store.storeCode})
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-500">
                {isAdmin
                  ? t("settings.selectAll")
                  : t("settings.canSelectOnlyOneStore")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">{t("settings.applyFromDate")}</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={priceListForm.validFrom}
                  onChange={(e) =>
                    setPriceListForm({
                      ...priceListForm,
                      validFrom: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validTo">{t("settings.applyToDate")}</Label>
                <Input
                  id="validTo"
                  type="date"
                  value={priceListForm.validTo}
                  onChange={(e) =>
                    setPriceListForm({
                      ...priceListForm,
                      validTo: e.target.value,
                    })
                  }
                  min={priceListForm.validFrom || undefined}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t("settings.savingPriceList")
                  : editingPriceList
                    ? t("settings.updatePriceList")
                    : t("settings.createPriceList")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
