import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Trash2, Edit, Save, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface IncomeVoucher {
  id?: string;
  voucherNumber: string;
  date: string;
  amount: number;
  account: string;
  recipient: string;
  receiverName?: string;
  phone: string;
  category: string;
  description: string;
}

interface IncomeVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher?: IncomeVoucher | null;
  mode: "create" | "edit";
}

const INCOME_CATEGORY_KEYS = [
  "sales",
  "service",
  "debtCollection",
  "other",
  "refund",
];

export default function IncomeVoucherModal({
  isOpen,
  onClose,
  voucher,
  mode,
}: IncomeVoucherModalProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "create");
  const queryClient = useQueryClient();

  // Load payment methods from localStorage (same as expense voucher)
  // Query payment methods from API
  const { data: paymentMethodsData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"],
    queryFn: async () => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods");
      return response.json();
    },
  });

  const getPaymentMethods = () => {
    const paymentMethods = paymentMethodsData || [];

    console.log("📋 All payment methods from API:", paymentMethods);

    // Filter to only return enabled payment methods
    const enabledMethods = paymentMethods.filter((method: any) => method.enabled === true);
    
    console.log("✅ Enabled payment methods:", enabledMethods);
    
    return enabledMethods;
  };

  const paymentMethods = getPaymentMethods();

  const [formData, setFormData] = useState<IncomeVoucher>({
    voucherNumber: "",
    date: new Date().toISOString().split("T")[0],
    amount: 0,
    account: "cash", // Use nameKey instead of hardcoded Vietnamese
    recipient: "",
    receiverName: "",
    phone: "",
    category: "other",
    description: "",
  });

  useEffect(() => {
    if (voucher && mode === "edit") {
      setFormData(voucher);
      setIsEditing(false);
    } else if (mode === "create") {
      // Generate voucher number for new voucher
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const timeStr = Date.now().toString().slice(-3);
      setFormData((prev) => ({
        ...prev,
        voucherNumber: `PT${dateStr}${timeStr}`,
        account: "cash", // Use nameKey instead of hardcoded Vietnamese
      }));
      setIsEditing(true);
    }
  }, [voucher, mode]);

  const createVoucherMutation = useMutation({
    mutationFn: async (data: IncomeVoucher) => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/income-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create income voucher");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã tạo phiếu thu mới",
      });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/income-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể tạo phiếu thu",
        variant: "destructive",
      });
    },
  });

  const updateVoucherMutation = useMutation({
    mutationFn: async (data: IncomeVoucher) => {
      console.log("Updating income voucher with data:", data);
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/income-vouchers/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("Income voucher updated successfully:", data);
      toast({
        title: "Thành công",
        description: `Đã cập nhật phiếu thu ${formData.voucherNumber} thành công`,
      });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/income-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      setIsEditing(false);
    },
    onError: (error) => {
      console.error("Failed to update income voucher:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Không thể cập nhật phiếu thu";
      toast({
        title: "Lỗi cập nhật phiếu thu",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/income-vouchers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete income voucher");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã xóa phiếu thu",
      });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/income-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      setShowDeleteDialog(false);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa phiếu thu",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // Validate required fields
    if (!formData.voucherNumber?.trim()) {
      toast({
        title: t("common.error"),
        description: t("common.enterVoucherNumber"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.recipient?.trim()) {
      toast({
        title: t("common.error"),
        description: t("common.enterRecipient"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      toast({
        title: t("common.error"),
        description: t("common.enterValidAmount"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.date?.trim()) {
      toast({
        title: t("common.error"),
        description: t("common.selectDate"),
        variant: "destructive",
      });
      return;
    }

    // Prepare clean data for submission
    const cleanData = {
      ...formData,
      id: voucher?.id, // Include ID for update
      voucherNumber: formData.voucherNumber.trim(),
      recipient: formData.recipient.trim(),
      account: formData.account || "cash", // Use nameKey instead of hardcoded Vietnamese
      category: formData.category || "other",
      date: formData.date.trim(),
      phone: formData.phone?.trim() || "",
      description: formData.description?.trim() || "",
      amount: Number(formData.amount),
    };

    console.log("💾 Saving income voucher with account value:", {
      account: cleanData.account,
      accountType: typeof cleanData.account,
      voucherNumber: cleanData.voucherNumber,
      fullData: cleanData,
    });

    if (mode === "create") {
      createVoucherMutation.mutate(cleanData);
    } else {
      updateVoucherMutation.mutate(cleanData);
    }
  };

  const handleDelete = () => {
    if (voucher?.id) {
      deleteVoucherMutation.mutate(voucher.id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN").format(value);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <span className="font-bold">
                {t("common.incomeVoucherTitle")}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 p-6">
            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-5 p-4 bg-gray-50 rounded-lg border">
                <h3 className="font-bold text-lg text-gray-800 mb-4">
                  {t("common.voucherInfo")}
                </h3>

                <div>
                  <Label
                    htmlFor="voucherNumber"
                    className="text-base font-bold mb-2"
                  >
                    {t("common.incomeVoucherNumber")}{" "}
                    <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="voucherNumber"
                    value={formData.voucherNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        voucherNumber: e.target.value,
                      }))
                    }
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}
                  />
                </div>

                <div>
                  <Label htmlFor="date" className="text-base font-bold mb-2">
                    {t("common.incomeDate")}{" "}
                    <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, date: e.target.value }))
                    }
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}
                  />
                </div>

                <div>
                  <Label htmlFor="amount" className="text-base font-bold mb-2">
                    {t("common.amountLabel")}{" "}
                    <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="text"
                    value={
                      formData.amount > 0 ? formatCurrency(formData.amount) : ""
                    }
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setFormData((prev) => ({
                        ...prev,
                        amount: parseFloat(value) || 0,
                      }));
                    }}
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="account" className="text-base font-bold mb-2">
                    {t("common.incomeAccount")}{" "}
                    <span className="text-red-600">*</span>
                  </Label>
                  <Select
                    value={formData.account}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, account: value }))
                    }
                    disabled={!isEditing}
                  >
                    <SelectTrigger
                      className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem
                          key={method.id}
                          value={method.nameKey}
                          className="text-base"
                        >
                          {t(`common.${method.nameKey}`)} {method.icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label
                    htmlFor="category"
                    className="text-base font-bold mb-2"
                  >
                    {t("common.incomeCategory")}{" "}
                    <span className="text-red-600">*</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, category: value }))
                    }
                    disabled={!isEditing}
                  >
                    <SelectTrigger
                      className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOME_CATEGORY_KEYS.map((categoryKey) => (
                        <SelectItem
                          key={categoryKey}
                          value={categoryKey}
                          className="text-base"
                        >
                          {t(`common.incomeCategories.${categoryKey}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-bold text-lg text-gray-800 mb-4">
                  {t("common.recipientInfo")}
                </h3>

                <div>
                  <Label
                    htmlFor="recipient"
                    className="text-base font-bold mb-2"
                  >
                    {t("common.recipient")}{" "}
                    <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="recipient"
                    value={formData.recipient}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        recipient: e.target.value,
                      }))
                    }
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-blue-100 text-gray-900" : "bg-white"}`}
                    placeholder={t("common.recipientPlaceholder")}
                  />
                </div>

                <div>
                  <Label
                    htmlFor="receiverName"
                    className="text-base font-bold mb-2"
                  >
                    {t("common.receiverName")}
                  </Label>
                  <Input
                    id="receiverName"
                    value={formData.receiverName || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        receiverName: e.target.value,
                      }))
                    }
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-blue-100 text-gray-900" : "bg-white"}`}
                    placeholder={t("common.receiverNamePlaceholder")}
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-base font-bold mb-2">
                    {t("common.phone")}
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-blue-100 text-gray-900" : "bg-white"}`}
                    placeholder={t("common.phoneNumberPlaceholder")}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <Label htmlFor="description" className="text-base font-bold mb-2">
                {t("common.explanation")}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                disabled={!isEditing}
                className={`text-base font-semibold ${!isEditing ? "bg-green-100 text-gray-900" : "bg-white"}`}
                placeholder={t("common.explanationPlaceholder")}
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-4 border-t-2">
              <div className="flex gap-3">
                {mode === "edit" && (
                  <>
                    <Button
                      variant="destructive"
                      size="lg"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={deleteVoucherMutation.isPending}
                      className="h-11 text-base"
                    >
                      <Trash2 className="w-5 h-5 mr-2" />
                      {t("common.delete")}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setIsEditing(true)}
                      disabled={isEditing}
                      className="h-11 text-base"
                    >
                      <Edit className="w-5 h-5 mr-2" />
                      {t("common.edit")}
                    </Button>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onClose}
                  disabled={
                    createVoucherMutation.isPending ||
                    updateVoucherMutation.isPending
                  }
                  className="h-11 text-base"
                >
                  <X className="w-5 h-5 mr-2" />
                  {t("common.close")}
                </Button>
                {isEditing && (
                  <Button
                    size="lg"
                    onClick={handleSave}
                    disabled={
                      createVoucherMutation.isPending ||
                      updateVoucherMutation.isPending
                    }
                    className="bg-green-600 hover:bg-green-700 h-11 text-base px-8"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    {t("common.save")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.confirmDeleteVoucher").replace(
                "{voucherNumber}",
                formData.voucherNumber,
              )}
              <br />
              <span className="text-red-600">{t("common.cannotUndo")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.skip")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteVoucherMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("common.agree")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
