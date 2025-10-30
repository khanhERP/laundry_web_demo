
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tag, ShoppingCart, Package } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface CategoryStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryStatsModal({ isOpen, onClose }: CategoryStatsModalProps) {
  const { t } = useTranslation();

  // Fetch categories
  const { data: categoriesData } = useQuery<any[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
  });

  // Fetch products
  const { data: productsData } = useQuery<any[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products", { includeInactive: true }],
    queryFn: async () => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products?includeInactive=true");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-green-600" />
            {t("settings.categoryTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t("settings.totalCategories")}
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {categoriesData ? categoriesData.length : 0}
                    </p>
                  </div>
                  <Tag className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t("settings.totalProducts")}
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {productsData ? productsData.length : 0}
                    </p>
                  </div>
                  <ShoppingCart className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t("settings.totalStockQuantity")}
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {productsData
                        ? productsData.reduce(
                            (total: number, product: any) =>
                              total + (product.stock || 0),
                            0,
                          )
                        : 0}
                    </p>
                  </div>
                  <Package className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t("settings.categories")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {categoriesData?.map((category: any) => (
                <Card
                  key={category.id}
                  className="border-2 hover:border-green-300 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {category.icon && (
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <span className="text-xl">
                            {category.icon === "fas fa-utensils"
                              ? "🍽️"
                              : category.icon === "fas fa-coffee"
                                ? "☕"
                                : category.icon === "fas fa-cookie"
                                  ? "🍪"
                                  : category.icon === "fas fa-ice-cream"
                                    ? "🍨"
                                    : category.icon === "fas fa-beer"
                                      ? "🍺"
                                      : category.icon === "fas fa-apple-alt"
                                        ? "🍎"
                                        : "🍽️"}
                          </span>
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold">{category.name}</h3>
                        <p className="text-sm text-gray-500">
                          {productsData
                            ? productsData.filter(
                                (p: any) => p.categoryId === category.id,
                              ).length
                            : 0}{" "}
                          {t("settings.productsCount")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
