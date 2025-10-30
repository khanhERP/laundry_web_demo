
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { Plus, Edit, Trash2, Store } from "lucide-react";
import type { StoreSettings } from "@shared/schema";

export function StoreListManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showStoreForm, setShowStoreForm] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreSettings | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<StoreSettings | null>(null);

  const [storeForm, setStoreForm] = useState({
    storeName: "",
    storeCode: "",
    pinCode: "",
    taxId: "",
    priceListId: null as number | null,
    address: "",
    phone: "",
    email: "",
    businessType: "restaurant",
    openTime: "09:00",
    closeTime: "22:00",
  });

  // Fetch all stores
  const { data: allStoresData, isLoading } = useQuery<StoreSettings[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"],
  });

  // Filter out stores with userType = 1 (admin accounts)
  const storesData = allStoresData?.filter((store: any) => store.userType !== 1) || [];

  // Fetch active price lists
  const { data: priceLists = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists"],
    queryFn: async () => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/price-lists");
      if (!response.ok) throw new Error("Failed to fetch price lists");
      const data = await response.json();
      // Filter only active price lists
      return data.filter((pl: any) => pl.isActive);
    },
  });

  // Create store mutation
  const createStoreMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create store");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"] });
      toast({
        title: "Thành công",
        description: "Đã tạo cửa hàng mới",
      });
      setShowStoreForm(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update store mutation
  const updateStoreMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      toast({
        title: "Thành công",
        description: "Đã cập nhật thông tin cửa hàng",
      });
      setShowStoreForm(false);
      setEditingStore(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete store mutation
  const deleteStoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete store");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"] });
      toast({
        title: "Thành công",
        description: "Đã xóa cửa hàng",
      });
      setShowDeleteDialog(false);
      setStoreToDelete(null);
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa cửa hàng",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStoreForm({
      storeName: "",
      storeCode: "",
      pinCode: "",
      taxId: "",
      priceListId: null,
      address: "",
      phone: "",
      email: "",
      businessType: "restaurant",
      openTime: "09:00",
      closeTime: "22:00",
    });
  };

  const handleEdit = (store: StoreSettings) => {
    setEditingStore(store);
    setStoreForm({
      storeName: store.storeName || "",
      storeCode: store.storeCode || "",
      pinCode: store.pinCode || "",
      taxId: store.taxId || "",
      priceListId: (store as any).priceListId || null,
      address: store.address || "",
      phone: store.phone || "",
      email: store.email || "",
      businessType: store.businessType || "restaurant",
      openTime: store.openTime || "09:00",
      closeTime: store.closeTime || "22:00",
    });
    setShowStoreForm(true);
  };

  const handleDelete = (store: StoreSettings) => {
    setStoreToDelete(store);
    setShowDeleteDialog(true);
  };

  const handleSubmit = () => {
    if (!storeForm.storeName || !storeForm.storeCode || !storeForm.pinCode) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc",
        variant: "destructive",
      });
      return;
    }

    if (editingStore) {
      updateStoreMutation.mutate({ id: editingStore.id, data: storeForm });
    } else {
      createStoreMutation.mutate(storeForm);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Danh sách cửa hàng</CardTitle>
          <Button onClick={() => setShowStoreForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm cửa hàng
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Đang tải...</p>
          ) : (
            <div className="space-y-4">
              {storesData?.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Store className="w-8 h-8 text-gray-500" />
                    <div>
                      <h3 className="font-semibold">{store.storeName}</h3>
                      <p className="text-sm text-gray-600">
                        Mã: {store.storeCode}
                      </p>
                      <p className="text-sm text-gray-500">{store.address}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(store)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(store)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Store Form Dialog */}
      <Dialog open={showStoreForm} onOpenChange={setShowStoreForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStore ? "Sửa thông tin cửa hàng" : "Thêm cửa hàng mới"}
            </DialogTitle>
            <DialogDescription>
              {editingStore
                ? "Cập nhật thông tin cửa hàng"
                : "Nhập thông tin cửa hàng mới"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>
                Tên cửa hàng <span className="text-red-500">*</span>
              </Label>
              <Input
                value={storeForm.storeName}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, storeName: e.target.value })
                }
                placeholder="Nhập tên cửa hàng"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Mã cửa hàng <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={storeForm.storeCode}
                  onChange={(e) =>
                    setStoreForm({ ...storeForm, storeCode: e.target.value })
                  }
                  placeholder="Nhập mã cửa hàng"
                />
              </div>

              <div>
                <Label>
                  Mã PIN <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="password"
                  value={storeForm.pinCode}
                  onChange={(e) =>
                    setStoreForm({ ...storeForm, pinCode: e.target.value })
                  }
                  placeholder="Nhập mã PIN"
                  maxLength={6}
                />
              </div>
            </div>

            <div>
              <Label>Mã số thuế</Label>
              <Input
                value={storeForm.taxId}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, taxId: e.target.value })
                }
                placeholder="Nhập mã số thuế"
              />
            </div>

            <div>
              <Label>Bảng giá áp dụng</Label>
              <select
                value={storeForm.priceListId || ""}
                onChange={(e) =>
                  setStoreForm({
                    ...storeForm,
                    priceListId: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Chọn bảng giá --</option>
                {priceLists.map((priceList: any) => (
                  <option key={priceList.id} value={priceList.id}>
                    {priceList.name} ({priceList.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Loại hình kinh doanh</Label>
              <select
                value={storeForm.businessType}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, businessType: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="restaurant">POS Nhà hàng</option>
                <option value="laundry">POS Giặt là</option>
                <option value="retail">POS Bán lẻ</option>
              </select>
            </div>

            <div>
              <Label>Địa chỉ</Label>
              <Input
                value={storeForm.address}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, address: e.target.value })
                }
                placeholder="Nhập địa chỉ"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Số điện thoại</Label>
                <Input
                  value={storeForm.phone}
                  onChange={(e) =>
                    setStoreForm({ ...storeForm, phone: e.target.value })
                  }
                  placeholder="Nhập số điện thoại"
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  value={storeForm.email}
                  onChange={(e) =>
                    setStoreForm({ ...storeForm, email: e.target.value })
                  }
                  placeholder="Nhập email"
                  type="email"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Giờ mở cửa</Label>
                <Input
                  value={storeForm.openTime}
                  onChange={(e) =>
                    setStoreForm({ ...storeForm, openTime: e.target.value })
                  }
                  type="time"
                />
              </div>

              <div>
                <Label>Giờ đóng cửa</Label>
                <Input
                  value={storeForm.closeTime}
                  onChange={(e) =>
                    setStoreForm({ ...storeForm, closeTime: e.target.value })
                  }
                  type="time"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowStoreForm(false);
                setEditingStore(null);
                resetForm();
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleSubmit}>
              {editingStore ? "Cập nhật" : "Tạo mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa cửa hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa cửa hàng "{storeToDelete?.storeName}"?
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                storeToDelete && deleteStoreMutation.mutate(storeToDelete.id)
              }
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
