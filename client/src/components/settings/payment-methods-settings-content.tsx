
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

export function PaymentMethodsSettingsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState<any>(null);
  const [methodForm, setMethodForm] = useState({
    nameKey: "",
    name: "",
    type: "custom",
    icon: "💳",
  });

  // Query payment methods
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"],
    queryFn: async () => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods");
      return response.json();
    },
  });

  // Create payment method mutation
  const createPaymentMethodMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"] });
      toast({
        title: "Thành công",
        description: "Đã thêm phương thức thanh toán mới",
      });
      resetForm();
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể thêm phương thức thanh toán",
        variant: "destructive",
      });
    },
  });

  // Update payment method mutation
  const updatePaymentMethodMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PUT", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật phương thức thanh toán",
      });
      resetForm();
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật phương thức thanh toán",
        variant: "destructive",
      });
    },
  });

  // Delete payment method mutation
  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"] });
      toast({
        title: "Thành công",
        description: "Đã xóa phương thức thanh toán",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa phương thức thanh toán hệ thống",
        variant: "destructive",
      });
    },
  });

  const toggleMethod = (id: number, currentEnabled: boolean) => {
    updatePaymentMethodMutation.mutate({
      id,
      data: { enabled: !currentEnabled },
    });
  };

  const handleEdit = (method: any) => {
    setEditingMethod(method);
    setMethodForm({
      nameKey: method.nameKey,
      name: method.name || "",
      type: method.type,
      icon: method.icon,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!methodForm.name.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên phương thức thanh toán",
        variant: "destructive",
      });
      return;
    }

    if (editingMethod) {
      updatePaymentMethodMutation.mutate({
        id: editingMethod.id,
        data: {
          name: methodForm.name,
          icon: methodForm.icon,
          type: methodForm.type,
        },
      });
    } else {
      createPaymentMethodMutation.mutate({
        nameKey: methodForm.nameKey || `custom_${Date.now()}`,
        name: methodForm.name,
        type: methodForm.type,
        icon: methodForm.icon,
        enabled: true,
        sortOrder: paymentMethods.length,
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Bạn có chắc chắn muốn xóa phương thức thanh toán này?")) {
      deletePaymentMethodMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingMethod(null);
    setMethodForm({
      nameKey: "",
      name: "",
      type: "custom",
      icon: "💳",
    });
  };

  const getPaymentMethodName = (method: any) => {
    if (method.name) return method.name;
    
    const names: { [key: string]: string } = {
      cash: "Tiền mặt",
      creditCard: "Thẻ tín dụng",
      debitCard: "Thẻ ghi nợ",
      momo: "MoMo",
      zalopay: "ZaloPay",
      vnpay: "VNPay",
      qrCode: "Mã QR",
      shopeepay: "ShopeePay",
      grabpay: "GrabPay",
    };
    
    return names[method.nameKey] || method.nameKey;
  };

  return (
    <>
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Phương thức thanh toán</CardTitle>
            <Button
              onClick={() => setShowForm(true)}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm phương thức
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paymentMethods.map((method: any) => (
              <div
                key={method.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  method.enabled
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{method.icon}</span>
                    <span className="font-medium">
                      {getPaymentMethodName(method)}
                    </span>
                  </div>
                  <Switch
                    checked={method.enabled}
                    onCheckedChange={() => toggleMethod(method.id, method.enabled)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(method)}
                    className="flex-1"
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Sửa
                  </Button>
                  {!method.isSystem && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(method.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? "Cập nhật phương thức thanh toán" : "Thêm phương thức thanh toán"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Tên phương thức</Label>
              <Input
                id="name"
                value={methodForm.name}
                onChange={(e) =>
                  setMethodForm({ ...methodForm, name: e.target.value })
                }
                placeholder="Nhập tên phương thức thanh toán"
              />
            </div>
            <div>
              <Label htmlFor="icon">Icon (Emoji)</Label>
              <Input
                id="icon"
                value={methodForm.icon}
                onChange={(e) =>
                  setMethodForm({ ...methodForm, icon: e.target.value })
                }
                placeholder="Nhập emoji icon"
              />
            </div>
            <div>
              <Label htmlFor="type">Loại</Label>
              <Select
                value={methodForm.type}
                onValueChange={(value) =>
                  setMethodForm({ ...methodForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tiền mặt</SelectItem>
                  <SelectItem value="card">Thẻ tín dụng</SelectItem>
                  <SelectItem value="debit">Thẻ ghi nợ</SelectItem>
                  <SelectItem value="digital">Ví điện tử</SelectItem>
                  <SelectItem value="qr">Mã QR</SelectItem>
                  <SelectItem value="custom">Tùy chỉnh</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
              {editingMethod ? "Cập nhật" : "Thêm mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
