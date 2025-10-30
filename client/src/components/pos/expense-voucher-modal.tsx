import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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

interface ExpenseVoucher {
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

interface ExpenseVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher?: ExpenseVoucher | null;
  mode: "create" | "edit";
}

const EXPENSE_CATEGORY_KEYS = [
  "hospitality",
  "officeSupplies",
  "utilities",
  "rent",
  "salary",
  "insurance",
  "repairs",
  "supplierPayment",
  "customerRefund",
  "other",
] as const;

export default function ExpenseVoucherModal({
  isOpen,
  onClose,
  voucher,
  mode
}: ExpenseVoucherModalProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [isGeneratingVoucher, setIsGeneratingVoucher] = useState(false);
  const queryClient = useQueryClient();

  // Load payment methods from localStorage (same as cash-book page)
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

    // Filter to only return enabled payment methods
    return paymentMethods.filter((method: any) => method.enabled === true);
  };

  const paymentMethods = getPaymentMethods();

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching customers:', error);
        return [];
      }
    },
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/employees"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/employees");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching employees:', error);
        return [];
      }
    },
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers"],
    queryFn: async () => {
      try {
        const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/suppliers");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        return [];
      }
    },
  });

  const [formData, setFormData] = useState<ExpenseVoucher>({
    voucherNumber: "",
    date: new Date().toISOString().split('T')[0],
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
      // Generate voucher number for new expense voucher (same logic as income voucher)
      const generateVoucherNumber = () => {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
        const timeStr = Date.now().toString().slice(-3);
        const autoVoucherNumber = `PC${dateStr}${timeStr}`;

        console.log(`✅ Auto-generated expense voucher number: ${autoVoucherNumber}`);

        setFormData({
          voucherNumber: autoVoucherNumber,
          date: new Date().toISOString().split('T')[0],
          amount: 0,
          account: "cash", // Use nameKey instead of hardcoded Vietnamese
          recipient: "",
          receiverName: "",
          phone: "",
          category: "other",
          description: "",
        });
      };

      generateVoucherNumber();
      setIsEditing(true);
    }
  }, [voucher, mode]);

  const createVoucherMutation = useMutation({
    mutationFn: async (data: ExpenseVoucher) => {
      console.log("Creating expense voucher with data:", data);
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/expense-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("Expense voucher created successfully:", data);
      toast({
        title: "Thành công",
        description: `Đã tạo phiếu chi ${formData.voucherNumber} thành công`,
      });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/expense-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      onClose();
    },
    onError: (error) => {
      console.error("Failed to create expense voucher:", error);
      const errorMessage = error instanceof Error ? error.message : "Không thể tạo phiếu chi";
      toast({
        title: "Lỗi tạo phiếu chi",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateVoucherMutation = useMutation({
    mutationFn: async (data: ExpenseVoucher) => {
      console.log("Updating expense voucher with data:", data);
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/expense-vouchers/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("Expense voucher updated successfully:", data);
      toast({
        title: "Thành công",
        description: `Đã cập nhật phiếu chi ${formData.voucherNumber} thành công`,
      });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/expense-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      setIsEditing(false);
    },
    onError: (error) => {
      console.error("Failed to update expense voucher:", error);
      const errorMessage = error instanceof Error ? error.message : "Không thể cập nhật phiếu chi";
      toast({
        title: "Lỗi cập nhật phiếu chi",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/expense-vouchers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete expense voucher");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã xóa phiếu chi",
      });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/expense-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      setShowDeleteDialog(false);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa phiếu chi",
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    // Validate required fields first
    if (!formData.recipient?.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập đối tượng nhận",
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập số tiền hợp lệ (lớn hơn 0)",
        variant: "destructive",
      });
      return;
    }

    if (!formData.date?.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn ngày chi",
        variant: "destructive",
      });
      return;
    }

    // Use existing voucher number or validate it exists
    let voucherNumber = formData.voucherNumber?.trim();

    if (!voucherNumber) {
      console.warn("⚠️ Voucher number is empty");
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập số phiếu chi (VD: PC000001/25)",
        variant: "destructive",
      });
      return;
    }

    console.log(`✅ Using voucher number: ${voucherNumber}`);

    // Prepare clean data for submission - only include necessary fields
    const cleanData: any = {
      voucherNumber: voucherNumber,
      recipient: formData.recipient.trim(),
      account: formData.account || "cash",
      category: formData.category || "other",
      date: formData.date.trim(),
      receiverName: formData.receiverName?.trim() || "",
      phone: formData.phone?.trim() || "",
      description: formData.description?.trim() || "",
      amount: Number(formData.amount),
    };

    // Add supplierId if recipient is a supplier
    const selectedRecipient = recipientOptions.find(option => option.name === formData.recipient);
    if (selectedRecipient && selectedRecipient.id) {
      cleanData.supplierId = selectedRecipient.id;
      console.log("💾 Adding supplierId to expense voucher:", {
        recipientName: formData.recipient,
        supplierId: selectedRecipient.id,
        mode: mode
      });
    } else {
      console.warn("⚠️ No supplierId found for recipient:", formData.recipient);
    }

    // Add id for update mode
    if (mode === "edit" && formData.id) {
      cleanData.id = formData.id;
    }

    console.log("💾 Saving expense voucher with account value:", {
      account: cleanData.account,
      accountType: typeof cleanData.account,
      voucherNumber: cleanData.voucherNumber,
      fullData: cleanData
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
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  // Get recipient options based on selected category
  const getRecipientOptions = () => {
    switch (formData.category) {
      case "customerRefund":
        return customers.map(customer => ({
          id: customer.id,
          name: customer.name,
          phone: customer.phone || "",
        }));
      case "salary":
        return employees.map(employee => ({
          id: employee.id,
          name: employee.name,
          phone: employee.phone || "",
        }));
      default:
        return suppliers.map(supplier => ({
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone || "",
        }));
    }
  };

  const recipientOptions = getRecipientOptions();

  // Handle category change - reset recipient when category changes
  const handleCategoryChange = (newCategory: string) => {
    setFormData(prev => ({
      ...prev,
      category: newCategory,
      recipient: "", // Reset recipient when category changes
      receiverName: "",
      phone: "",
    }));
  };

  // Handle recipient selection
  const handleRecipientChange = (recipientName: string) => {
    const selectedRecipient = recipientOptions.find(option => option.name === recipientName);
    if (selectedRecipient) {
      setFormData(prev => ({
        ...prev,
        recipient: selectedRecipient.name,
        phone: selectedRecipient.phone,
        // Do not auto-fill receiverName - let user enter manually
      }));
    }
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
              <span className="font-bold">{t('common.expenseVoucherTitle')}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 p-6">
            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-5 p-4 bg-gray-50 rounded-lg border">
                <h3 className="font-bold text-lg text-gray-800 mb-4">{t('common.voucherInfo')}</h3>

                <div>
                  <Label htmlFor="voucherNumber" className="text-base font-bold mb-2">
                    {t('common.expenseVoucherNumber')} <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="voucherNumber"
                    value={formData.voucherNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, voucherNumber: e.target.value }))}
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}
                  />
                </div>

                <div>
                  <Label htmlFor="date" className="text-base font-bold mb-2">
                    {t('common.expenseDate')} <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}
                  />
                </div>

                <div>
                  <Label htmlFor="amount" className="text-base font-bold mb-2">
                    {t('common.amount')} <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="text"
                    value={formData.amount > 0 ? formatCurrency(formData.amount) : ""}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData(prev => ({ ...prev, amount: parseFloat(value) || 0 }));
                    }}
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="account" className="text-base font-bold mb-2">
                    {t('common.expenseAccount')} <span className="text-red-600">*</span>
                  </Label>
                  <Select
                    value={formData.account}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, account: value }))}
                    disabled={!isEditing}
                  >
                    <SelectTrigger className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}>
                      <SelectValue>
                        {formData.account ? t(`common.${formData.account}`) : t('common.selectCategory')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.id} value={method.nameKey} className="text-base">
                          {t(`common.${method.nameKey}`)} {method.icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="category" className="text-base font-bold mb-2">
                    {t('common.expenseCategory')} <span className="text-red-600">*</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    disabled={!isEditing}
                  >
                    <SelectTrigger className={`h-11 text-base font-bold ${!isEditing ? "bg-gray-100 text-gray-900" : "bg-white"}`}>
                      <SelectValue>
                        {formData.category ? t(`common.${formData.category}`) : t('common.selectCategory')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORY_KEYS.map((categoryKey) => (
                        <SelectItem key={categoryKey} value={categoryKey} className="text-base">
                          {t(`common.${categoryKey}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-bold text-lg text-gray-800 mb-4">{t('common.recipientInfo')}</h3>

                <div>
                  <Label htmlFor="recipient" className="text-base font-bold mb-2">
                    {t('common.recipientObject')} <span className="text-red-600">*</span>
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({formData.category === "customerRefund" ? t('common.customer') :
                        formData.category === "salary" ? t('common.employee') : t('suppliers.supplier')})
                    </span>
                  </Label>
                  {isEditing ? (
                    <Select
                      value={formData.recipient}
                      onValueChange={handleRecipientChange}
                      disabled={!isEditing}
                    >
                      <SelectTrigger className={`h-11 text-base font-bold ${!isEditing ? "bg-blue-100 text-gray-900" : "bg-white"}`}>
                        <SelectValue placeholder={formData.category === "customerRefund" ? t('common.selectCustomer') :
                          formData.category === "salary" ? t('common.selectEmployee') : t('common.selectSupplier')} />
                      </SelectTrigger>
                      <SelectContent>
                        {recipientOptions.map((option) => (
                          <SelectItem key={option.id} value={option.name} className="text-base">
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="recipient"
                      value={formData.recipient}
                      disabled={true}
                      className="h-11 text-base font-bold bg-blue-100 text-gray-900"
                      placeholder={t('common.recipientPlaceholder')}
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="receiverName" className="text-base font-bold mb-2">{t('common.receiverName')}</Label>
                  <Input
                    id="receiverName"
                    value={formData.receiverName || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverName: e.target.value }))}
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-blue-100 text-gray-900" : "bg-white"}`}
                    placeholder={t('common.receiverNamePlaceholder')}
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-base font-bold mb-2">{t('common.phone')}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={!isEditing}
                    className={`h-11 text-base font-bold ${!isEditing ? "bg-blue-100 text-gray-900" : "bg-white"}`}
                    placeholder={t('common.phoneNumberPlaceholder')}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <Label htmlFor="description" className="text-base font-bold mb-2">{t('common.explanation')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                disabled={!isEditing}
                className={`text-base font-semibold ${!isEditing ? "bg-green-100 text-gray-900" : "bg-white"}`}
                placeholder={t('common.explanationPlaceholder')}
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
                      {t('common.delete')}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setIsEditing(true)}
                      disabled={isEditing}
                      className="h-11 text-base"
                    >
                      <Edit className="w-5 h-5 mr-2" />
                      {t('common.edit')}
                    </Button>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onClose}
                  disabled={createVoucherMutation.isPending || updateVoucherMutation.isPending}
                  className="h-11 text-base"
                >
                  <X className="w-5 h-5 mr-2" />
                  {t('common.close')}
                </Button>
                {isEditing && (
                  <Button
                    size="lg"
                    onClick={handleSave}
                    disabled={createVoucherMutation.isPending || updateVoucherMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 h-11 text-base px-8"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    {t('common.save')}
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
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.confirmDeleteVoucher').replace('{voucherNumber}', formData.voucherNumber)}
              <br />
              <span className="text-red-600">{t('common.cannotUndo')}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.skip')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteVoucherMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('common.agree')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}