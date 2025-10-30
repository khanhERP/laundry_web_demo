
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Users, Plus, Edit, Trash2, Search } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import type { Supplier } from "@shared/schema";
import { SupplierFormModal } from "@/components/suppliers/supplier-form-modal";

export default function SuppliersPageContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers"],
  });

  const { data: storesData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"],
  });

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowSupplierForm(true);
  };

  const handleDeleteSupplier = async (supplierId: number) => {
    if (!confirm(t("suppliers.confirmDelete"))) return;

    try {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers/${supplierId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      await queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers"] });
      toast({ title: t("common.success"), description: t("suppliers.deleteSuccess") });
    } catch (error) {
      toast({ title: t("common.error"), description: t("suppliers.deleteError"), variant: "destructive" });
    }
  };

  const filteredSuppliers = suppliersData?.filter((supplier: Supplier) => {
    const matchesSearch = 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.phone && supplier.phone.includes(searchTerm)) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStore = storeFilter === "all" || supplier.storeCode === storeFilter;
    
    return matchesSearch && matchesStore;
  }) || [];

  // Pagination calculations
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex);

  // Reset to first page when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStoreFilterChange = (value: string) => {
    setStoreFilter(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {t("suppliers.title")}
              </CardTitle>
              <CardDescription>{t("suppliers.description")}</CardDescription>
            </div>
            <Button onClick={() => { setEditingSupplier(null); setShowSupplierForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t("suppliers.addSupplier")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <Input
                placeholder={t("suppliers.searchPlaceholder")}
                className="w-64"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <Select value={storeFilter} onValueChange={handleStoreFilterChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("common.allStores")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allStores")}</SelectItem>
                  {storesData?.map((store: any) => (
                    store.storeCode && (
                      <SelectItem key={store.storeCode} value={store.storeCode}>
                        {store.storeName} ({store.storeCode})
                      </SelectItem>
                    )
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Search className="w-4 h-4 mr-2" />
                {t("common.search")}
              </Button>
            </div>
          </div>

          {suppliersLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{t("common.loading")}</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">{t("suppliers.noSuppliers")}</p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                {t("common.showing")} {startIndex + 1}-{Math.min(endIndex, filteredSuppliers.length)} {t("common.of")} {filteredSuppliers.length} {t("suppliers.suppliers")}
              </div>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-4 text-left font-medium text-sm text-gray-600 min-w-[150px]">
                        {t("suppliers.name")}
                      </th>
                      <th className="p-4 text-left font-medium text-sm text-gray-600 min-w-[120px]">
                        {t("suppliers.phone")}
                      </th>
                      <th className="p-4 text-left font-medium text-sm text-gray-600 min-w-[180px]">
                        {t("suppliers.email")}
                      </th>
                      <th className="p-4 text-left font-medium text-sm text-gray-600 min-w-[200px]">
                        {t("suppliers.address")}
                      </th>
                      <th className="p-4 text-left font-medium text-sm text-gray-600 w-[100px]">
                        {t("common.status")}
                      </th>
                      <th className="p-4 text-center font-medium text-sm text-gray-600 w-[120px]">
                        {t("common.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium">{supplier.name}</td>
                      <td className="p-4 text-sm text-gray-600">{supplier.phone || "-"}</td>
                      <td className="p-4 text-sm text-gray-600">{supplier.email || "-"}</td>
                      <td className="p-4 text-sm text-gray-600">{supplier.address || "-"}</td>
                      <td className="p-4">
                        <Badge variant="default" className="bg-green-500 text-white">
                          {t("common.active")}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditSupplier(supplier)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteSupplier(supplier.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <SupplierFormModal
        isOpen={showSupplierForm}
        onClose={() => { setShowSupplierForm(false); setEditingSupplier(null); }}
        supplier={editingSupplier || undefined}
      />
    </div>
  );
}
