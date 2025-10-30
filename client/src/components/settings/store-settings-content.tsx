import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTranslation } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StoreData {
  id: number;
  storeName: string;
  storeCode: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  pinCode?: string;
  domain?: string;
  priceListId?: number | null;
  priceIncludesTax?: boolean;
  typeUser: number;
}

export function StoreSettingsContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    storeName: "",
    storeCode: "",
    address: "",
    phone: "",
    email: "",
    taxId: "",
    pinCode: "",
    domain: "",
    priceListId: null as number | null,
    priceIncludesTax: false,
  });

  // Generate next store code
  const getNextStoreCode = () => {
    if (!stores || stores.length === 0) {
      return "CH-0001";
    }
    
    // Find the highest code number
    const maxCode = stores.reduce((max, store) => {
      const match = store.storeCode.match(/CH-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    
    const nextNum = maxCode + 1;
    return `CH-${nextNum.toString().padStart(4, '0')}`;
  };

  // Fetch current store settings to check isAdmin
  const { data: storeSettings } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings"],
  });

  const isAdmin = storeSettings?.isAdmin || false;

  // Fetch stores with typeUser = 0
  const { data: stores = [], isLoading } = useQuery<StoreData[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"],
    select: (data) => data.filter((store) => store.typeUser === 0),
  });

  // Fetch price lists
  const { data: priceLists = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, typeUser: 0 }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create store");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"] });
      toast({ title: "Thành công", description: "Tạo cửa hàng mới thành công" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update store");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"] });
      toast({ title: "Thành công", description: "Cập nhật cửa hàng thành công" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete store");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"] });
      toast({ title: "Thành công", description: "Xóa cửa hàng thành công" });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    },
  });

  // Calculate pagination
  const totalPages = Math.ceil(stores.length / itemsPerPage);
  const paginatedStores = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return stores.slice(startIndex, endIndex);
  }, [stores, currentPage, itemsPerPage]);

  const handleOpenDialog = (store?: StoreData) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        storeName: store.storeName,
        storeCode: store.storeCode,
        address: store.address || "",
        phone: store.phone || "",
        email: store.email || "",
        taxId: store.taxId || "",
        pinCode: store.pinCode || "",
        domain: store.domain || "",
        priceListId: store.priceListId || null,
        priceIncludesTax: store.priceIncludesTax || false,
      });
    } else {
      setEditingStore(null);
      const nextCode = getNextStoreCode();
      setFormData({
        storeName: "",
        storeCode: nextCode,
        address: "",
        phone: "",
        email: "",
        taxId: "",
        pinCode: "",
        domain: "",
        priceListId: null,
        priceIncludesTax: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStore(null);
    setFormData({
      storeName: "",
      storeCode: "",
      address: "",
      phone: "",
      email: "",
      taxId: "",
      pinCode: "",
      domain: "",
      priceListId: null,
      priceIncludesTax: false,
    });
  };

  const handleSubmit = () => {
    if (!formData.storeName || !formData.storeCode) {
      toast({ title: "Lỗi", description: "Vui lòng nhập tên và mã cửa hàng", variant: "destructive" });
      return;
    }

    if (editingStore) {
      updateMutation.mutate({ id: editingStore.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
        <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
            <Plus className="w-6 h-6 text-white" />
          </div>
          {t('settings.storeManagement')}
        </CardTitle>
        {isAdmin && (
          <Button
            onClick={() => handleOpenDialog()}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('settings.addStore')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('settings.loading')}</p>
            </div>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg mb-2">{t('settings.noStoresYet')}</p>
            <p className="text-gray-400 text-sm">{t('settings.clickAddStoreToStart')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="font-semibold text-gray-700 w-[200px] bg-gray-50 whitespace-nowrap">{t("settings.storeName")}</TableHead>
                  <TableHead className="font-semibold text-gray-700 w-[100px] bg-gray-50 whitespace-nowrap">{t("settings.storeCode")}</TableHead>
                  <TableHead className="font-semibold text-gray-700 w-[280px] bg-gray-50 whitespace-nowrap">{t("settings.address")}</TableHead>
                  <TableHead className="font-semibold text-gray-700 w-[120px] bg-gray-50 whitespace-nowrap">{t("settings.phone")}</TableHead>
                  <TableHead className="font-semibold text-gray-700 w-[150px] bg-gray-50 whitespace-nowrap">{t("settings.goToSalesPage")}</TableHead>
                  {isAdmin && (
                    <TableHead className="text-center font-semibold text-gray-700 w-[80px] bg-gray-50 whitespace-nowrap">{t("common.actions")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStores.map((store, index) => (
                  <TableRow
                    key={store.id}
                    className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-green-50`}
                  >
                    <TableCell className="font-medium text-gray-900">
                      <span title={store.storeName}>{store.storeName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {store.storeCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      <div className="line-clamp-2" title={store.address || "-"}>
                        {store.address || <span className="text-gray-400">-</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 whitespace-nowrap">
                      {store.phone || <span className="text-gray-400">-</span>}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {store.domain ? (
                        <a
                          href={store.domain.startsWith('http') ? store.domain : `https://${store.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 inline-flex items-center justify-center"
                          title={store.domain}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenDialog(store)}
                            className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                            title="Sửa"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setDeleteConfirm(store.id)}
                            className="h-8 w-8 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {stores.length > 0 && (
          <div className="mt-4 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {t("settings.displayingProducts")} {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, stores.length)} / {stores.length}
              </span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600">{t("settings.itemsPerPageLabel")}</span>
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
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingStore ? "Sửa cửa hàng" : "Thêm cửa hàng mới"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Tên cửa hàng *</Label>
                <Input
                  id="storeName"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  placeholder="Nhập tên cửa hàng"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storeCode">Mã cửa hàng *</Label>
                <Input
                  id="storeCode"
                  value={formData.storeCode}
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                  placeholder="Tự động tạo"
                />
                {!editingStore && (
                  <p className="text-xs text-gray-500">
                    Mã sẽ tự động tạo: {formData.storeCode}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Nhập địa chỉ"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Nhập số điện thoại"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Nhập email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Mã số thuế</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  placeholder="Nhập mã số thuế"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pinCode">Mã PIN</Label>
                <Input
                  id="pinCode"
                  type="text"
                  inputMode="numeric"
                  value={formData.pinCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setFormData({ ...formData, pinCode: value });
                  }}
                  placeholder="Nhập mã PIN (6 số)"
                  maxLength={6}
                  pattern="[0-9]*"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">{t("settings.domain")}</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder={t("settings.domainPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceListId">Bảng giá áp dụng</Label>
                <select
                  id="priceListId"
                  value={formData.priceListId || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priceListId: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-- Chọn bảng giá --</option>
                  {priceLists.map((priceList: any) => (
                    <option key={priceList.id} value={priceList.id}>
                      {priceList.name} ({priceList.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 col-span-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="priceIncludesTax"
                    checked={formData.priceIncludesTax || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priceIncludesTax: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <Label htmlFor="priceIncludesTax" className="text-sm font-medium cursor-pointer">
                    Giá đã bao gồm thuế
                  </Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Hủy
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingStore ? "Cập nhật" : "Tạo mới"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa cửa hàng này? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}