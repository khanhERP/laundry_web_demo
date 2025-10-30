
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Save } from "lucide-react";

interface PaymentMethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentMethodsModal({
  isOpen,
  onClose,
}: PaymentMethodsModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [editingMethod, setEditingMethod] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [methodForm, setMethodForm] = useState({
    nameKey: "",
    icon: "",
  });

  // Load payment methods from localStorage
  useEffect(() => {
    const savedMethods = localStorage.getItem("paymentMethods");
    if (savedMethods) {
      setPaymentMethods(JSON.parse(savedMethods));
    } else {
      // Default payment methods
      const defaultMethods = [
        { id: 1, nameKey: "cash", type: "cash", enabled: true, icon: "💵" },
        { id: 2, nameKey: "creditCard", type: "card", enabled: false, icon: "💳" },
        { id: 3, nameKey: "debitCard", type: "debit", enabled: false, icon: "💳" },
        { id: 4, nameKey: "momo", type: "digital", enabled: false, icon: "📱" },
        { id: 5, nameKey: "zalopay", type: "digital", enabled: false, icon: "📱" },
        { id: 6, nameKey: "vnpay", type: "digital", enabled: false, icon: "💳" },
        { id: 7, nameKey: "qrCode", type: "qr", enabled: true, icon: "📱" },
        { id: 8, nameKey: "shopeepay", type: "digital", enabled: false, icon: "🛒" },
        { id: 9, nameKey: "grabpay", type: "digital", enabled: false, icon: "🚗" },
      ];
      setPaymentMethods(defaultMethods);
      localStorage.setItem("paymentMethods", JSON.stringify(defaultMethods));
    }
  }, []);

  const saveToLocalStorage = (methods: any[]) => {
    localStorage.setItem("paymentMethods", JSON.stringify(methods));
    setPaymentMethods(methods);
  };

  const toggleMethod = (id: number) => {
    const updated = paymentMethods.map((method) =>
      method.id === id ? { ...method, enabled: !method.enabled } : method
    );
    saveToLocalStorage(updated);
  };

  const handleEdit = (method: any) => {
    setEditingMethod(method);
    setMethodForm({
      nameKey: method.nameKey,
      icon: method.icon,
    });
    setShowForm(true);
  };

  const handleUpdate = () => {
    if (!editingMethod) return;

    const updated = paymentMethods.map((method) =>
      method.id === editingMethod.id
        ? { ...method, icon: methodForm.icon }
        : method
    );

    saveToLocalStorage(updated);
    setShowForm(false);
    setEditingMethod(null);
    setMethodForm({ nameKey: "", icon: "" });

    toast({
      title: t("common.success"),
      description: "Đã cập nhật phương thức thanh toán",
    });
  };

  const handleDelete = (id: number) => {
    const updated = paymentMethods.filter((method) => method.id !== id);
    saveToLocalStorage(updated);

    toast({
      title: t("common.success"),
      description: "Đã xóa phương thức thanh toán",
    });
  };

  const getPaymentMethodName = (nameKey: string) => {
    const names: { [key: string]: string } = {
      cash: t("common.cash"),
      creditCard: t("common.creditCard"),
      debitCard: t("common.debitCard"),
      momo: t("common.momo"),
      zalopay: t("common.zalopay"),
      vnpay: t("common.vnpay"),
      qrCode: t("common.qrCode"),
      shopeepay: t("common.shopeepay"),
      grabpay: t("common.grabpay"),
    };
    return names[nameKey] || nameKey;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {t("settings.paymentMethods")}
          </DialogTitle>
          <DialogDescription>
            Quản lý các phương thức thanh toán cho hệ thống POS
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Methods List */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Icon
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Tên phương thức
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paymentMethods.map((method) => (
                  <tr key={method.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-2xl">{method.icon}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {getPaymentMethodName(method.nameKey)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {method.type}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={method.enabled}
                        onCheckedChange={() => toggleMethod(method.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(method)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {method.id > 9 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(method.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit Form */}
          {showForm && editingMethod && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-medium mb-4">Chỉnh sửa icon</h3>
              <div className="space-y-4">
                <div>
                  <Label>Icon (Emoji)</Label>
                  <Input
                    value={methodForm.icon}
                    onChange={(e) =>
                      setMethodForm({ ...methodForm, icon: e.target.value })
                    }
                    placeholder="💳"
                    className="text-2xl"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUpdate} className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    Lưu
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingMethod(null);
                    }}
                    className="flex-1"
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
