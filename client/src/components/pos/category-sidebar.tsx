import { useQuery } from "@tanstack/react-query";
import {
  Search,
  BarChart3,
  Settings,
  Coffee,
  Cookie,
  Smartphone,
  Home,
  User,
  Grid3X3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import type { Category, Product } from "@shared/schema";

interface CategorySidebarProps {
  selectedCategory: number | "all";
  onCategorySelect: (categoryId: number | "all") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenProductManager: () => void;
  onAddToCart: (productId: number) => void;
}

const categoryIcons = {
  Beverages: Coffee,
  Snacks: Cookie,
  Electronics: Smartphone,
  Household: Home,
  "Personal Care": User,
};

export function CategorySidebar({
  selectedCategory,
  onCategorySelect,
  searchQuery,
  onSearchChange,
  onOpenProductManager,
  onAddToCart,
}: CategorySidebarProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
    queryFn: async () => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products`);
      if (!response.ok) throw new Error("Failed to fetch products");
      const allProducts = await response.json();

      // Apply same filtering as ProductGrid - exclude raw materials and inactive products
      return allProducts.filter((product: any) => {
        const isNotRawMaterial =
          product.productType !== 2 || product.productType !== 4;
        const isActive = product.isActive !== false;
        return isNotRawMaterial && isActive;
      });
    },
  });

  // Filter out expense categories
  const filteredCategories = categories.filter((cat: Category) => {
    const categoryName = cat.name.toLowerCase();
    const isExpenseCategory = cat.id == 15 || cat.id == 17;

    // Get product count for this category
    const categoryProducts = products.filter(
      (p: Product) => p.categoryId === cat.id,
    );
    const hasProducts = categoryProducts.length > 0;

    // Only show category if it has products AND is not an expense category
    return hasProducts && !isExpenseCategory;
  });

  const getProductCountForCategory = (categoryId: number | "all") => {
    if (categoryId === "all") {
      // Count all products excluding those in expense categories
      const expenseCategoryIds = categories
        .filter((cat: Category) => {
          return cat.id == 15 || cat.id == 17;
        })
        .map((cat: Category) => cat.id);

      const count = products.filter(
        (p: Product) => !expenseCategoryIds.includes(p.categoryId),
      ).length;
      console.log("All products count (excluding expenses):", count);
      return count;
    }

    const categoryProducts = products.filter(
      (p: Product) => p.categoryId === categoryId,
    );
    console.log(
      `Category ${categoryId} products:`,
      categoryProducts.length,
      categoryProducts.map((p) => p.name),
    );

    return categoryProducts.length;
  };

  const handleBarcodeScan = () => {
    // Simulate barcode scanning
    const sampleSkus = ["BEV001", "BEV002", "SNK001", "ELC001"];
    const randomSku = sampleSkus[Math.floor(Math.random() * sampleSkus.length)];

    fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products/barcode/${randomSku}`)
      .then((res) => res.json())
      .then((product) => {
        if (product.id) {
          onAddToCart(product.id);
          toast({
            title: t("pos.productScanned"),
            description: `${product.name} ${t("pos.addedToCart")}`,
          });
        }
      })
      .catch(() => {
        toast({
          title: t("pos.scanFailed"),
          description: t("pos.productNotFound"),
          variant: "destructive",
        });
      });
  };

  return (
    <aside className="h-full bg-white shadow-lg border-r border-gray-200 flex flex-col">
      <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 flex-shrink-0">
        <div className="relative">
          <Input
            type="text"
            placeholder={t("pos.searchProducts")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value.toLowerCase())}
            className="pl-10 h-10 border-2 border-green-200 focus:border-green-500 rounded-lg"
          />
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600"
            size={18}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto lg:max-h-[calc(100vh-180px)] max-h-[300px]">
        <div className="p-2 md:p-3">
          <h3 className="font-semibold text-gray-800 mb-2 text-xs md:text-sm uppercase tracking-wide">
            {t("pos.categories")}
          </h3>
          <div className="space-y-1.5">
            <button
              onClick={() => onCategorySelect("all")}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-center justify-between ${
                selectedCategory === "all"
                  ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md"
                  : "bg-white hover:bg-gray-50 border border-gray-200"
              }`}
            >
              <span className="flex items-center text-sm font-medium">
                <Grid3X3 className={`w-4 mr-2 ${selectedCategory === "all" ? "text-white" : "text-gray-500"}`} size={16} />
                {t("pos.allProducts")}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                selectedCategory === "all" 
                  ? "bg-white/20 text-white" 
                  : "bg-gray-100 text-gray-600"
              }`}>
                {getProductCountForCategory("all")}
              </span>
            </button>

            {filteredCategories.map((category) => {
              const IconComponent =
                categoryIcons[category.name as keyof typeof categoryIcons] ||
                Grid3X3;
              const isSelected = selectedCategory === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => onCategorySelect(category.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-center justify-between ${
                    isSelected
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md"
                      : "bg-white hover:bg-gray-50 border border-gray-200"
                  }`}
                >
                  <span className="flex items-center text-sm font-medium">
                    <IconComponent
                      className={`w-4 mr-2 flex-shrink-0 ${isSelected ? "text-white" : "text-gray-500"}`}
                      size={16}
                    />
                    <span className="break-words">{category.name}</span>
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-2 flex-shrink-0 ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {getProductCountForCategory(category.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <Button
          onClick={onOpenProductManager}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white flex items-center justify-center rounded-lg shadow-md h-11 font-medium"
        >
          <Settings className="mr-2" size={18} />
          {t("pos.manageProducts")}
        </Button>
      </div>
    </aside>
  );
}