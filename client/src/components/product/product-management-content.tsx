
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Edit, Trash2, Search } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import type { Product, Category } from "@shared/schema";
import { ProductManagerModal } from "@/components/pos/product-manager-modal";

export default function ProductManagementContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showProductManager, setShowProductManager] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: productsData, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
  });

  const { data: categoriesData } = useQuery<Category[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
  });

  const filteredProducts = productsData?.filter((product: Product) =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(productSearchTerm.toLowerCase())
  ) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  const handleSearchChange = (value: string) => {
    setProductSearchTerm(value);
    setCurrentPage(1);
  };

  const getCategoryName = (categoryId: number) => {
    const category = categoriesData?.find((c) => c.id === categoryId);
    return category?.name || t("common.uncategorized");
  };

  return (
    <div className="space-y-6">
      {/* Product Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t("settings.totalProducts")}</p>
                <p className="text-2xl font-bold text-green-600">{productsData?.length || 0}</p>
              </div>
              <Package className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t("common.active")}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {productsData?.filter((p) => p.stock > 0).length || 0}
                </p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t("settings.categories")}</p>
                <p className="text-2xl font-bold text-purple-600">
                  {categoriesData?.length || 0}
                </p>
              </div>
              <Package className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t("inventory.totalValue")}</p>
                <p className="text-2xl font-bold text-orange-600">
                  {productsData
                    ? Math.round(
                        productsData.reduce(
                          (total, p) => total + parseFloat(p.price || "0") * (p.stock || 0),
                          0
                        )
                      ).toLocaleString()
                    : "0"}{" "}
                  ₫
                </p>
              </div>
              <Package className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Management */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                {t("settings.productManagementDesc")}
              </CardTitle>
            </div>
            <Button onClick={() => { setEditingProduct(null); setShowProductManager(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t("settings.addProduct")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <Input
                placeholder={t("inventory.searchProducts")}
                className="w-64"
                value={productSearchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <Button variant="outline" size="sm">
                <Search className="w-4 h-4 mr-2" />
                {t("common.search")}
              </Button>
            </div>
          </div>

          {productsLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{t("common.loading")}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">{t("inventory.noProducts")}</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="grid grid-cols-8 gap-4 p-4 font-medium text-sm text-gray-600 bg-gray-50 border-b">
                <div>{t("common.sku")}</div>
                <div>{t("inventory.productName")}</div>
                <div>{t("common.category")}</div>
                <div>{t("common.price")}</div>
                <div>{t("common.stock")}</div>
                <div>{t("settings.unit")}</div>
                <div>{t("common.status")}</div>
                <div className="text-center">{t("common.actions")}</div>
              </div>

              <div className="divide-y">
                {paginatedProducts.map((product) => (
                  <div key={product.id} className="grid grid-cols-8 gap-4 p-4 items-center">
                    <div className="font-mono text-sm">{product.sku || "-"}</div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-gray-600">{getCategoryName(product.categoryId)}</div>
                    <div className="text-sm font-medium">
                      {parseFloat(product.price || "0").toLocaleString()} ₫
                    </div>
                    <div className="text-center">{product.stock || 0}</div>
                    <div className="text-sm text-gray-600">{product.unit || "-"}</div>
                    <div>
                      {product.trackInventory !== false ? (
                        <Badge
                          variant="default"
                          className={`${
                            product.stock > 0
                              ? "bg-green-500"
                              : "bg-red-500"
                          } text-white`}
                        >
                          {product.stock > 0 ? t("common.active") : t("common.outOfStock")}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-blue-500 text-white">
                          {t("common.active")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingProduct(product); setShowProductManager(true); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-6">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {t("common.total")} {filteredProducts.length} {t("common.product")}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t("common.show")}</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 w-[70px] rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="15">15</option>
                  <option value="20">20</option>
                  <option value="30">30</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <span className="text-sm font-medium">{t("common.rows")}</span>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {t("common.page")} {currentPage} / {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product Manager Modal */}
      <ProductManagerModal
        isOpen={showProductManager}
        onClose={() => { setShowProductManager(false); setEditingProduct(null); }}
        product={editingProduct}
      />
    </div>
  );
}
