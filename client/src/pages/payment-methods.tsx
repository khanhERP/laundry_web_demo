
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { POSHeader } from "@/components/pos/header";
import { RightSidebar } from "@/components/ui/right-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PaymentMethodsPageProps {
  onLogout: () => void;
}

export default function PaymentMethodsPage({ onLogout }: PaymentMethodsPageProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [editingMethod, setEditingMethod] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [methodForm, setMethodForm] = useState({
    icon: "",
  });

  // Query payment methods from API
  const { data: paymentMethodsFromAPI } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"],
    queryFn: async () => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods");
      return response.json();
    },
  });

  // Update local state when API data is loaded
  useEffect(() => {
    if (paymentMethodsFromAPI) {
      setPaymentMethods(paymentMethodsFromAPI);
      console.log("✅ Loaded payment methods from API:", paymentMethodsFromAPI);
    } else {
      // Default payment methods (fallback only)
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
      console.log("ℹ️ Created default payment methods");
    }
  }, [paymentMethodsFromAPI]);

  // Mutation to update payment method
  const updatePaymentMethodMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"] });
      toast({
        title: t("common.success"),
        description: "Đã cập nhật phương thức thanh toán",
      });
    },
  });

  const toggleMethod = (id: number) => {
    const method = paymentMethods.find((m) => m.id === id);
    if (!method) return;

    console.log("🔄 Toggling payment method:", id, "New enabled state:", !method.enabled);
    updatePaymentMethodMutation.mutate({
      id,
      data: { enabled: !method.enabled },
    });
  };

  const handleEdit = (method: any) => {
    setEditingMethod(method);
    setMethodForm({
      icon: method.icon,
    });
    setShowForm(true);
  };

  const handleUpdate = () => {
    if (!editingMethod) return;

    updatePaymentMethodMutation.mutate({
      id: editingMethod.id,
      data: { icon: methodForm.icon },
    });

    setShowForm(false);
    setEditingMethod(null);
    setMethodForm({ icon: "" });
  };

  // Mutation to delete payment method
  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods/${id}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"] });
      toast({
        title: t("common.success"),
        description: "Đã xóa phương thức thanh toán",
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: "Không thể xóa phương thức thanh toán hệ thống",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: number) => {
    deletePaymentMethodMutation.mutate(id);
  };

  const addPaymentMethod = () => {
    const newMethod = {
      id: paymentMethods.length + 1,
      nameKey: "newPayment",
      type: "custom",
      enabled: false,
      icon: "💳",
    };
    const updatedMethods = [...paymentMethods, newMethod];
    setPaymentMethods(updatedMethods);
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
    <div className="min-h-screen bg-green-50 grocery-bg">
      <POSHeader onLogout={onLogout} />
      <RightSidebar />
      
      <div className="main-content pt-16 px-6">
        <div className="max-w-7xl mx-auto py-8">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-green-600" />
                {t("settings.paymentMethods")}
              </h1>
              <p className="mt-2 text-gray-600">Quản lý các phương thức thanh toán cho hệ thống POS</p>
            </div>
          </div>

          {/* Payment Methods List - Grid Layout như Settings */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-600" />
                {t("settings.paymentMethods")}
              </CardTitle>
              <CardDescription>
                {t("settings.paymentMethodsDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">
                    {t("settings.availablePayments")}
                  </h3>
                  <Button
                    onClick={addPaymentMethod}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("settings.addPayment")}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paymentMethods.map((method) => (
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
                          <span className="text-2xl">
                            {method.icon}
                          </span>
                          <span className="font-medium">
                            {getPaymentMethodName(method.nameKey)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={method.enabled}
                            onCheckedChange={() => toggleMethod(method.id)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(method)}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {method.id > 9 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(method.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={
                          method.enabled ? "default" : "secondary"
                        }
                      >
                        {method.enabled
                          ? t("settings.enabled")
                          : t("settings.disabled")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {t("common.edit")} {t("settings.paymentMethods")}
                </DialogTitle>
                <DialogDescription>
                  Cập nhật thông tin phương thức thanh toán
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {editingMethod && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">{t("common.name")}</Label>
                    <span className="col-span-3 text-sm text-gray-600">
                      {getPaymentMethodName(editingMethod.nameKey)}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="paymentMethodIcon" className="text-right">
                    {t("common.icon")}
                  </Label>
                  <Input
                    id="paymentMethodIcon"
                    value={methodForm.icon}
                    onChange={(e) =>
                      setMethodForm({ icon: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="💳"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingMethod(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleUpdate}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {t("common.update")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
