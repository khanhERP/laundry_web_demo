
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { POSHeader } from "@/components/pos/header";
import { RightSidebar } from "@/components/ui/right-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, Plus, Edit, Trash2, Phone, Mail, MapPin, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/lib/i18n";
import type { Supplier } from "@shared/schema";
import { SupplierFormModal } from "@/components/suppliers/supplier-form-modal";

interface SuppliersPageProps {
  onLogout: () => void;
}

export default function SuppliersPage({ onLogout }: SuppliersPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers', { status: selectedStatus, search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await apiRequest('GET', `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers?${params}`);
      return response.json();
    },
  });

  // Fetch purchase order statistics for suppliers
  const { data: supplierStats } = useQuery({
    queryKey: ['https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-orders/supplier-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', 'https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/purchase-orders/supplier-stats');
      return response.json();
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers'] });
      toast({
        title: t('suppliers.deleteSuccess'),
        description: t('suppliers.deleteSuccessDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('suppliers.deleteFailed'),
        description: t('suppliers.deleteFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm(t('suppliers.confirmDelete'))) {
      deleteSupplierMutation.mutate(id);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  const [, navigate] = useLocation();

  const handleCreatePurchaseOrder = (supplier: Supplier) => {
    // Navigate to purchase order creation with pre-selected supplier
    navigate(`/purchases?action=create&supplierId=${supplier.id}`);
  };

  const getSupplierMetrics = (supplierId: number) => {
    if (!supplierStats) return { totalOrders: 0, onTimeDelivery: 0, averageRating: 0 };
    return supplierStats[supplierId] || { totalOrders: 0, onTimeDelivery: 0, averageRating: 0 };
  };

  const filteredSuppliers = suppliers || [];

  return (
    <div className="min-h-screen bg-green-50 grocery-bg">
      <POSHeader />
      <RightSidebar />
      
      <div className="main-content pt-16 px-6">
        <div className="max-w-7xl mx-auto py-8">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('suppliers.title')}</h1>
              <p className="mt-2 text-gray-600">{t('suppliers.description')}</p>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('suppliers.addSupplier')}
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder={t('suppliers.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={selectedStatus === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus("all")}
              >
                {t('common.all')}
              </Button>
              <Button
                variant={selectedStatus === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus("active")}
              >
                {t('suppliers.active')}
              </Button>
              <Button
                variant={selectedStatus === "inactive" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus("inactive")}
              >
                {t('suppliers.inactive')}
              </Button>
            </div>
          </div>

          {/* Suppliers Table */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">{t('common.loading')}</div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">{t('suppliers.noSuppliers')}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('suppliers.code')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('suppliers.name')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('suppliers.contactPerson')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('suppliers.phone')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('suppliers.address')}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('suppliers.status')}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('purchases.totalOrders')}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('common.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredSuppliers.map((supplier: Supplier) => (
                        <tr key={supplier.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {supplier.code}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {supplier.name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {supplier.contactPerson || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {supplier.phone || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={supplier.address || ''}>
                            {supplier.address || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                              {supplier.status === 'active' ? t('suppliers.active') : t('suppliers.inactive')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium text-green-600">
                            {getSupplierMetrics(supplier.id).totalOrders}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                            <div className="flex justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(supplier)}
                                className="h-8 px-2"
                                data-testid={`button-edit-supplier-${supplier.id}`}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(supplier.id)}
                                className="text-red-600 hover:text-red-700 h-8 px-2"
                                data-testid={`button-delete-supplier-${supplier.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Supplier Form Modal */}
      <SupplierFormModal
        isOpen={showForm}
        onClose={handleFormClose}
        supplier={editingSupplier}
      />
    </div>
  );
}
