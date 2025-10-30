import { useState, useEffect, useRef } from "react";
import { X, Search, Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import VirtualKeyboard from "@/components/ui/virtual-keyboard";

// E-invoice software providers mapping
const EINVOICE_PROVIDERS = [
  { name: "EasyInvoice", value: "1" },
  { name: "VnInvoice", value: "2" },
  { name: "FptInvoice", value: "3" },
  { name: "MifiInvoice", value: "4" },
  { name: "EHoaDon", value: "5" },
  { name: "BkavInvoice", value: "6" },
  { name: "MInvoice", value: "7" },
  { name: "SInvoice", value: "8" },
  { name: "WinInvoice", value: "9" },
];

interface EInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (eInvoiceData: any) => void;
  total: number;
  cartItems?: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    sku?: string;
    discount?: number;
    taxRate?: number;
    afterTaxPrice?: string | number; // Add afterTaxPrice for detailed tax calculation
  }>;
  source?: "pos" | "table"; // Thêm prop để phân biệt nguồn gọi
  orderId?: number; // Thêm orderId để tự xử lý cập nhật trạng thái
  selectedPaymentMethod?: string; // Thêm prop để nhận phương thức thanh toán
}

export function EInvoiceModal({
  isOpen,
  onClose,
  onConfirm,
  total,
  cartItems = [],
  source = "pos", // Default là 'pos' để tương thích ngược
  orderId, // Thêm orderId prop
  selectedPaymentMethod = "", // Thêm selectedPaymentMethod prop
}: EInvoiceModalProps) {
  // Debug log to track cart items data flow
  console.log("🔍 EInvoiceModal Props Analysis:");
  console.log("- isOpen:", isOpen);
  console.log("- total:", total);
  console.log("- cartItems received:", cartItems);
  console.log("- cartItems type:", typeof cartItems);
  console.log("- cartItems is array:", Array.isArray(cartItems));
  console.log("- cartItems length:", cartItems?.length || 0);
  const [formData, setFormData] = useState({
    invoiceProvider: "",
    invoiceTemplate: "",
    selectedTemplateId: "",
    taxCode: "",
    customerName: "",
    address: "",
    phoneNumber: "",
    email: "",
  });

  const [isTaxCodeLoading, setIsTaxCodeLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false); // State for general publishing process
  const [isProcessingPublish, setIsProcessingPublish] = useState(false); // State for "Phát hành" button
  const [isProcessingPublishLater, setIsProcessingPublishLater] =
    useState(false); // State for "Phát hành sau" button
  const [lastActionTime, setLastActionTime] = useState(0); // Debounce timestamp
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [activeInputField, setActiveInputField] = useState<string | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Helper function để map phương thức thanh toán
  const getPaymentMethodCode = (paymentMethod: string): number => {
    switch (paymentMethod) {
      case "cash":
        return 1; // Tiền mặt
      case "qrCode":
        return 3; // QR Code (vẫn hiển thị là Chuyển khoản)
      case "creditCard":
      case "debitCard":
      case "momo":
      case "zalopay":
      case "vnpay":
        return 2; // Chuyển khoản
      default:
        return 2; // Default: Chuyển khoản
    }
  };

  // Helper function to get payment method name for transaction notes
  const getPaymentMethodName = (paymentMethod: string): string => {
    switch (paymentMethod) {
      case "cash":
        return "Tiền mặt";
      case "qrCode":
        return "QR Code";
      case "creditCard":
        return "Thẻ tín dụng";
      case "debitCard":
        return "Thẻ ghi nợ";
      case "momo":
        return "Momo";
      case "zalopay":
        return "ZaloPay";
      case "vnpay":
        return "VNPay";
      default:
        return "Khác";
    }
  };

  // Log the pre-selected payment method for debugging
  console.log(
    "💳 E-invoice modal received payment method:",
    selectedPaymentMethod,
  );

  // Mutation để hoàn tất thanh toán và cập nhật trạng thái
  const completePaymentMutation = useMutation({
    mutationFn: ({
      orderId,
      paymentMethod,
    }: {
      orderId: number;
      paymentMethod: string;
    }) => {
      console.log(
        "🔄 E-invoice modal: Starting payment completion mutation for order:",
        orderId,
      );
      // Pass the paymentMethod to the PUT request for status update
      return apiRequest("PUT", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderId}/status`, {
        status: "paid",
        paymentMethod, // Ensure paymentMethod is passed here
      });
    },
    onSuccess: (data, variables) => {
      console.log(
        "🎯 E-invoice modal completed payment successfully for order:",
        variables.orderId,
      );
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"] });

      toast({
        title: `${t("common.success")}`,
        description:
          "Hóa đơn điện tử đã được phát hành và đơn hàng đã được thanh toán",
      });

      console.log("✅ E-invoice modal: Payment completed, queries invalidated");
    },
    onError: (error, variables) => {
      console.error(
        "❌ Error completing payment from e-invoice modal for order:",
        variables.orderId,
        error,
      );
      toast({
        title: "Lỗi",
        description:
          "Hóa đơn điện tử đã phát hành nhưng không thể hoàn tất thanh toán",
        variant: "destructive",
      });

      console.log(
        "❌ E-invoice modal: Payment failed for order:",
        variables.orderId,
      );
    },
  });

  // Fetch E-invoice connections
  const { data: eInvoiceConnections = [] } = useQuery<any[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice-connections"],
    enabled: isOpen,
  });

  // Fetch active invoice templates for dropdown - use correct query key
  const { data: invoiceTemplates = [] } = useQuery<any[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoice-templates/active"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoice-templates/active");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("📋 Fetched active invoice templates:", data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching active invoice templates:", error);
        return [];
      }
    },
    enabled: isOpen,
    staleTime: 300000,
  });

  // Query all products to get tax rates
  const { data: products = [] } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching products:", error);
        return [];
      }
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  // Query order data to get priceIncludeTax setting
  const { data: orderData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      try {
        const response = await apiRequest("GET", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching order data:", error);
        return null;
      }
    },
    enabled: !!orderId,
    staleTime: 300000,
  });

  // Reset form only when modal opens, not when cartItems/total changes
  useEffect(() => {
    if (isOpen) {
      console.log("🔥 E-INVOICE MODAL OPENING");
      console.log("🔥 cartItems when modal opens:", cartItems);
      console.log(
        "🔥 cartItems length when modal opens:",
        cartItems?.length || 0,
      );
      console.log(
        "🔥 cartItems is array when modal opens:",
        Array.isArray(cartItems),
      );
      console.log("🔥 total when modal opens:", total);
      console.log("🔥 Available invoice templates:", invoiceTemplates);

      // Set default template from available templates
      const defaultTemplate = invoiceTemplates.find((t: any) => t.isDefault) || invoiceTemplates[0];
      
      setFormData({
        invoiceProvider: "EasyInvoice", // Default provider
        invoiceTemplate: defaultTemplate?.name || "1C25TYY", // Use actual template name
        selectedTemplateId: defaultTemplate?.id?.toString() || "",
        taxCode: "0123456789", // Default tax code
        customerName: "Khách hàng lẻ", // Default customer name
        address: "",
        phoneNumber: "",
        email: "",
      });
    }
  }, [isOpen, invoiceTemplates]); // Add invoiceTemplates dependency

  // Separate effect for debugging cartItems changes without resetting form
  useEffect(() => {
    if (isOpen) {
      console.log("🔄 Cart items or total changed:", {
        cartItems: cartItems?.length || 0,
        total,
        timestamp: new Date().toISOString(),
      });
    }
  }, [cartItems, total, isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleVirtualKeyPress = (key: string) => {
    if (!activeInputField) return;

    const currentValue =
      formData[activeInputField as keyof typeof formData] || "";
    const newValue = currentValue + key;
    handleInputChange(activeInputField, newValue);

    // Focus the input to show cursor position
    const inputRef = inputRefs.current[activeInputField];
    if (inputRef) {
      inputRef.focus();
      // Set cursor to end
      setTimeout(() => {
        inputRef.setSelectionRange(newValue.length, newValue.length);
      }, 0);
    }
  };

  const handleVirtualBackspace = () => {
    if (!activeInputField) return;

    const currentValue =
      formData[activeInputField as keyof typeof formData] || "";
    const newValue = currentValue.slice(0, -1);
    handleInputChange(activeInputField, newValue);

    // Focus the input to show cursor position
    const inputRef = inputRefs.current[activeInputField];
    if (inputRef) {
      inputRef.focus();
      setTimeout(() => {
        inputRef.setSelectionRange(newValue.length, newValue.length);
      }, 0);
    }
  };

  const handleVirtualEnter = () => {
    // Hide keyboard on enter
    setShowVirtualKeyboard(false);
    setActiveInputField(null);
  };

  const handleInputFocus = (fieldName: string) => {
    setActiveInputField(fieldName);
    if (showVirtualKeyboard) {
      // If keyboard is already shown, just switch focus
      const inputRef = inputRefs.current[fieldName];
      if (inputRef) {
        inputRef.focus();
      }
    }
  };

  const toggleVirtualKeyboard = () => {
    setShowVirtualKeyboard(!showVirtualKeyboard);
    if (!showVirtualKeyboard) {
      // If opening keyboard, focus on first input field
      setActiveInputField("taxCode");
      setTimeout(() => {
        const inputRef = inputRefs.current["taxCode"];
        if (inputRef) {
          inputRef.focus();
        }
      }, 100);
    } else {
      setActiveInputField(null);
    }
  };

  const handleGetTaxInfo = async () => {
    if (!formData.taxCode.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã số thuế trước khi lấy thông tin",
        variant: "destructive",
      });
      return;
    }

    setIsTaxCodeLoading(true);
    try {
      // Use a proxy endpoint through our server to avoid CORS issues
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tax-code-lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taxCode: formData.taxCode }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Tax code API response:", result);

      if (
        result.success &&
        result.data &&
        Array.isArray(result.data) &&
        result.data.length > 0
      ) {
        // Lấy phần tử đầu tiên từ mảng kết quả vì chỉ truyền 1 mã số thuế
        const taxInfo = result.data[0];

        if (taxInfo) {
          // Kiểm tra trạng thái
          if (taxInfo.tthai === "00") {
            // Trạng thái hợp lệ - cập nhật thông tin tự động
            setFormData((prev) => ({
              ...prev,
              customerName: taxInfo.tenCty || prev.customerName,
              address: taxInfo.diaChi || prev.address,
            }));
          } else {
            // Trạng thái không hợp lệ - hiển thị thông tin trạng thái
            toast({
              title: "Lỗi",
              description: `Mã số thuế không hợp lệ! Trạng thái: ${taxInfo.trangThaiHoatDong || "Không xác định"}`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Lỗi",
            description: "Không tìm thấy thông tin cho mã số thuế này",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Lỗi",
          description:
            result.message || "Không tìm thấy thông tin cho mã số thuế này",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching tax code info:", error);
      if (error === "TypeError" && error.includes("fetch")) {
        toast({
          title: "Lỗi kết nối",
          description:
            "Không thể kết nối đến dịch vụ tra cứu mã số thuế. Vui lòng thử lại sau.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Lỗi",
          description: `Có lỗi xảy ra khi lấy thông tin mã số thuế: ${error}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsTaxCodeLoading(false);
    }
  };

  const handlePublishLater = async (event?: React.MouseEvent) => {
    // Prevent event propagation and default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Add debouncing to prevent rapid clicks
    const now = Date.now();
    if (now - lastActionTime < 1000) {
      console.log("⚠️ Debouncing: Action too soon, ignoring duplicate call");
      return;
    }
    setLastActionTime(now);

    // Prevent duplicate calls
    if (isProcessingPublishLater || isPublishing) {
      console.log(
        "⚠️ Already processing publish later, skipping duplicate call",
      );
      return;
    }

    setIsProcessingPublishLater(true); // Set processing state for this button

    try {
      console.log(
        "🟡 PHÁT HÀNH SAU - Lưu thông tin hóa đơn vào bảng invoices và invoice_items",
      );
      console.log("🟡 Source:", source, "OrderId:", orderId);

      // Debug log current cart items BEFORE any processing
      console.log("=== PHÁT HÀNH SAU - KIỂM TRA DỮ LIỆU ===");
      console.log("cartItems received:", cartItems);
      console.log("cartItems length:", cartItems?.length || 0);
      console.log("cartItems detailed:", JSON.stringify(cartItems, null, 2));
      console.log("total amount:", total);

      // Validate cart items first
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        console.error("❌ No valid cart items found for later publishing");
        toast({
          title: `${t("common.error")}`,
          description: "Không có sản phẩm nào trong giỏ hàng để lưu thông tin.",
          variant: "destructive",
        });
        setIsProcessingPublishLater(false);
        return;
      }

      // Validate total amount
      if (!total || total <= 0) {
        console.error("❌ Invalid total amount for later publishing:", total);
        toast({
          title: `${t("common.error")}`,
          description: "Tổng tiền không hợp lệ để lưu hóa đơn.",
          variant: "destructive",
        });
        setIsProcessingPublishLater(false);
        return;
      }

      // Calculate totals using same logic as the main publish function
      const priceIncludeTax = orderData?.priceIncludeTax ?? false;

      let calculatedSubtotal = 0;
      let calculatedTax = 0;
      let calculatedDiscount = 0;

      // Get discount from orderData if available
      if (orderData?.discount) {
        calculatedDiscount = parseFloat(orderData.discount);
      } else {
        // Calculate discount from cart items if available
        calculatedDiscount = cartItems.reduce((sum, item) => {
          const itemDiscount =
            typeof item.discount === "string"
              ? parseFloat(item.discount || "0")
              : item.discount || 0;
          return sum + itemDiscount;
        }, 0);
      }

      cartItems.forEach((item, index) => {
        const itemPrice =
          typeof item.price === "string" ? parseFloat(item.price) : item.price;
        const itemQuantity =
          typeof item.quantity === "string"
            ? parseInt(item.quantity)
            : item.quantity;
        const product = products?.find((p: any) => p.id === item.id);
        const itemTaxRate = product?.taxRate ? parseFloat(product.taxRate) : 0;

        // Calculate discount for this item (same logic as main publish)
        let itemDiscountAmount = 0;
        if (calculatedDiscount > 0) {
          const totalBeforeDiscount = cartItems.reduce((total, cartItem) => {
            const cartItemPrice =
              typeof cartItem.price === "string"
                ? parseFloat(cartItem.price)
                : cartItem.price;
            const cartItemQuantity =
              typeof cartItem.quantity === "string"
                ? parseInt(cartItem.quantity)
                : cartItem.quantity;
            return total + cartItemPrice * cartItemQuantity;
          }, 0);

          const isLastItem = index === cartItems.length - 1;

          if (isLastItem) {
            let previousDiscounts = 0;
            for (let i = 0; i < cartItems.length - 1; i++) {
              const prevItem = cartItems[i];
              const prevItemPrice =
                typeof prevItem.price === "string"
                  ? parseFloat(prevItem.price)
                  : prevItem.price;
              const prevItemQuantity =
                typeof prevItem.quantity === "string"
                  ? parseInt(prevItem.quantity)
                  : prevItem.quantity;
              const prevItemTotal = prevItemPrice * prevItemQuantity;
              const prevItemDiscount =
                totalBeforeDiscount > 0
                  ? Math.round(
                      (calculatedDiscount * prevItemTotal) /
                        totalBeforeDiscount,
                    )
                  : 0;
              previousDiscounts += prevItemDiscount;
            }
            itemDiscountAmount = calculatedDiscount - previousDiscounts;
          } else {
            const itemTotal = itemPrice * itemQuantity;
            itemDiscountAmount =
              totalBeforeDiscount > 0
                ? Math.round(
                    (calculatedDiscount * itemTotal) / totalBeforeDiscount,
                  )
                : 0;
          }
        }

        let itemSubtotal = 0;

        if (priceIncludeTax && itemTaxRate > 0) {
          // When priceIncludeTax = true: use beforeTaxPrice or calculate from formula (same as sales-orders)
          if (
            product?.beforeTaxPrice &&
            product.beforeTaxPrice !== null &&
            product.beforeTaxPrice !== ""
          ) {
            const beforeTaxPrice = parseFloat(product.beforeTaxPrice);
            itemSubtotal = beforeTaxPrice * itemQuantity;
          } else {
            // Fallback: calculate using sales-orders formula
            const taxRate = itemTaxRate / 100;
            const giaGomThue = itemPrice * itemQuantity;
            const tamTinh = Math.round(giaGomThue / (1 + taxRate));
            itemSubtotal = tamTinh;
          }
        } else {
          // When priceIncludeTax = false: use base price as subtotal (same as sales-orders)
          itemSubtotal = itemPrice * itemQuantity;
        }

        // Calculate tax using EXACT same logic as sales-orders
        let itemTax = 0;
        if (itemTaxRate > 0) {
          if (priceIncludeTax) {
            if (
              product?.beforeTaxPrice &&
              product.beforeTaxPrice !== null &&
              product.beforeTaxPrice !== ""
            ) {
              const beforeTaxPrice = parseFloat(product.beforeTaxPrice);
              itemTax = Math.max(
                0,
                (itemPrice - beforeTaxPrice) * itemQuantity,
              );
            } else {
              const taxRate = itemTaxRate / 100;
              const giaGomThue = itemPrice * itemQuantity;
              const tamTinh = Math.round(giaGomThue / (1 + taxRate));
              itemTax = giaGomThue - tamTinh;
            }
          } else {
            if (
              product?.afterTaxPrice &&
              product.afterTaxPrice !== null &&
              product.afterTaxPrice !== ""
            ) {
              const afterTaxPrice = parseFloat(product.afterTaxPrice);
              const taxPerUnit = afterTaxPrice - itemPrice;
              itemTax = Math.max(0, taxPerUnit * itemQuantity);
            } else {
              itemTax = Math.round(itemSubtotal * (itemTaxRate / 100));
            }
          }
        }

        calculatedSubtotal += itemSubtotal;
        calculatedTax += itemTax;

        console.log(
          `💰 Publish Later Item calculation (sales-orders logic): ${item.name} - Price: ${itemPrice}, Qty: ${itemQuantity}, Discount: ${itemDiscountAmount}, Subtotal: ${itemSubtotal}, Tax: ${itemTax}`,
        );
      });

      console.log(
        `💰 Total calculations: Subtotal: ${calculatedSubtotal}, Tax: ${calculatedTax}, Discount: ${calculatedDiscount}, Total: ${total}`,
      );

      // Lấy thông tin mẫu số hóa đơn được chọn
      const selectedTemplate = invoiceTemplates.find(
        (template) => template.id.toString() === formData.selectedTemplateId,
      );

      // Map phương thức thanh toán từ selectedPaymentMethod sang mã số
      const paymentMethodCode = getPaymentMethodCode(selectedPaymentMethod);

      // Chuẩn bị thông tin hóa đơn để lưu vào bảng invoices và invoice_items
      const invoicePayload = {
        invoiceNumber: null, // Chưa có số hóa đơn vì chưa phát hành
        templateNumber: selectedTemplate?.templateNumber || null, // Mẫu số hóa đơn
        symbol: selectedTemplate?.symbol || null, // Ký hiệu hóa đơn
        customerName: formData.customerName || "Khách hàng",
        customerTaxCode: formData.taxCode || null,
        customerAddress: formData.address || null,
        customerPhone: formData.phoneNumber || null,
        customerEmail: formData.email || null,
        subtotal: calculatedSubtotal.toFixed(2),
        tax: calculatedTax.toFixed(2),
        discount: calculatedDiscount.toFixed(2), // Add discount to invoice payload
        total: (typeof total === "number" && !isNaN(total)
          ? total
          : calculatedSubtotal + calculatedTax - calculatedDiscount
        ).toFixed(2),
        paymentMethod: paymentMethodCode, // Sử dụng mã phương thức thanh toán thực tế
        invoiceDate: new Date(),
        status: "draft",
        einvoiceStatus: 0, // 0 = Chưa phát hành
        notes: `E-Invoice draft - MST: ${formData.taxCode || "N/A"}, Template: ${selectedTemplate?.name || "N/A"}, Giảm giá: ${calculatedDiscount.toLocaleString("vi-VN")} ₫, Đợi phát hành sau`,
        items: cartItems.map((item) => {
          const itemPrice =
            typeof item.price === "string"
              ? parseFloat(item.price)
              : item.price;
          const itemQuantity =
            typeof item.quantity === "string"
              ? parseInt(item.quantity)
              : item.quantity;
          const product = products?.find((p: any) => p.id === item.id);
          const itemTaxRate = product?.taxRate
            ? parseFloat(product.taxRate)
            : 0;

          // Calculate proportional discount for this item
          const itemBeforeDiscountTotal = itemPrice * itemQuantity;
          const totalBeforeDiscount = cartItems.reduce((sum, cartItem) => {
            const cartItemPrice =
              typeof cartItem.price === "string"
                ? parseFloat(cartItem.price)
                : cartItem.price;
            const cartItemQuantity =
              typeof cartItem.quantity === "string"
                ? parseInt(cartItem.quantity)
                : cartItem.quantity;
            return sum + cartItemPrice * cartItemQuantity;
          }, 0);

          let itemDiscountAmount = 0;
          if (calculatedDiscount > 0 && totalBeforeDiscount > 0) {
            itemDiscountAmount =
              (calculatedDiscount * itemBeforeDiscountTotal) /
              totalBeforeDiscount;
          }

          // Calculate item subtotal and tax using same logic as main function
          let itemSubtotal = 0;
          if (priceIncludeTax && itemTaxRate > 0) {
            if (
              product?.beforeTaxPrice &&
              product.beforeTaxPrice !== null &&
              product.beforeTaxPrice !== ""
            ) {
              const beforeTaxPrice = parseFloat(product.beforeTaxPrice);
              itemSubtotal = beforeTaxPrice * itemQuantity;
            } else {
              const taxRate = itemTaxRate / 100;
              const giaGomThue = itemPrice * itemQuantity;
              const tamTinh = Math.round(giaGomThue / (1 + taxRate));
              itemSubtotal = tamTinh;
            }
          } else {
            itemSubtotal = itemPrice * itemQuantity;
          }

          let itemTax = 0;
          if (itemTaxRate > 0) {
            if (priceIncludeTax) {
              if (
                product?.beforeTaxPrice &&
                product.beforeTaxPrice !== null &&
                product.beforeTaxPrice !== ""
              ) {
                const beforeTaxPrice = parseFloat(product.beforeTaxPrice);
                itemTax = Math.max(
                  0,
                  (itemPrice - beforeTaxPrice) * itemQuantity,
                );
              } else {
                const taxRate = itemTaxRate / 100;
                const giaGomThue = itemPrice * itemQuantity;
                const tamTinh = Math.round(giaGomThue / (1 + taxRate));
                itemTax = giaGomThue - tamTinh;
              }
            } else {
              if (
                product?.afterTaxPrice &&
                product.afterTaxPrice !== null &&
                product.afterTaxPrice !== ""
              ) {
                const afterTaxPrice = parseFloat(product.afterTaxPrice);
                const taxPerUnit = afterTaxPrice - itemPrice;
                itemTax = Math.max(0, taxPerUnit * itemQuantity);
              } else {
                itemTax = Math.round(itemSubtotal * (itemTaxRate / 100));
              }
            }
          }

          // Calculate final total after discount
          let itemTotal;
          if (priceIncludeTax) {
            itemTotal = itemPrice * itemQuantity - itemDiscountAmount;
          } else {
            itemTotal = itemSubtotal + itemTax - itemDiscountAmount;
          }

          return {
            productId: item.id,
            productName: item.name,
            quantity: itemQuantity,
            unitPrice: itemPrice.toFixed(2),
            total: itemTotal.toFixed(2),
            taxRate: itemTaxRate.toFixed(2),
            discount: itemDiscountAmount.toFixed(2), // Item-level discount
            discountAmount: itemDiscountAmount.toFixed(2), // Same as discount for consistency
          };
        }),
      };

      console.log(
        "💾 Lưu hóa đơn vào bảng invoices và invoice_items:",
        JSON.stringify(invoicePayload, null, 2),
      );

      // Lưu hóa đơn vào bảng invoices và invoice_items
      const invoiceResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoicePayload),
      });

      if (!invoiceResponse.ok) {
        const errorText = await invoiceResponse.text();
        console.error(
          "❌ Invoice save failed with status:",
          invoiceResponse.status,
        );
        console.error("❌ Error response:", errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        throw new Error(
          `Lưu hóa đơn thất bại: ${errorData.error || errorData.details || errorText}`,
        );
      }

      const savedInvoice = await invoiceResponse.json();
      console.log(
        "✅ Hóa đơn đã được lưu vào bảng invoices và invoice_items:",
        savedInvoice,
      );

      // Create receipt data for receipt modal
      console.log("formData_trường GGGGG", formData);
      const receiptData = {
        id: orderId, // Add orderId
        tableId: orderData?.tableId || null, // Add tableId from orderData
        transactionId:
          savedInvoice.invoice?.invoiceNumber || `TXN-${Date.now()}`,
        orderNumber: orderData?.orderNumber || `ORD-${orderId || Date.now()}`, // Add orderNumber
        items: cartItems.map((item) => {
          const itemPrice =
            typeof item.price === "string"
              ? parseFloat(item.price)
              : item.price;
          const itemQuantity =
            typeof item.quantity === "string"
              ? parseInt(item.quantity)
              : item.quantity;
          const itemTaxRate =
            typeof item.taxRate === "string"
              ? parseFloat(item.taxRate || "0")
              : item.taxRate || 0;
          const itemSubtotal = itemPrice * itemQuantity;
          const itemTax = (itemSubtotal * itemTaxRate) / 100;

          return {
            id: item.id,
            productId: item.id,
            productName: item.name,
            price: itemPrice.toFixed(2),
            discount: item.discount || "0",
            quantity: itemQuantity,
            total: (itemSubtotal + itemTax).toFixed(2),
            sku: item.sku || `FOOD${String(item.id).padStart(5, "0")}`,
            taxRate: itemTaxRate,
          };
        }),
        subtotal: calculatedSubtotal.toFixed(2),
        tax: calculatedTax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: "einvoice",
        originalPaymentMethod: selectedPaymentMethod, // Add original payment method
        amountReceived: total.toFixed(2),
        change: "0.00",
        cashierName: "System User",
        createdAt: new Date().toISOString(),
        customerName: formData.customerName,
        customerTaxCode: formData.taxCode,
        invoiceId: savedInvoice.invoice?.id,
        invoiceNumber: savedInvoice.invoice?.invoiceNumber,
      };

      // Prepare comprehensive invoice data with receipt to display receipt modal WITH isTitle=true
      const completeInvoiceData = {
        success: true, // Add success flag
        paymentMethod: selectedPaymentMethod, // Use original payment method
        originalPaymentMethod: selectedPaymentMethod,
        publishLater: true, // This is publish later, NOT preview
        receipt: receiptData, // Receipt data to display receipt modal
        customerName: formData.customerName,
        taxCode: formData.taxCode,
        showReceiptModal: true, // Flag for parent component to show receipt modal
        shouldShowReceipt: true, // Additional flag for receipt display
        isTitle: true, // IMPORTANT: Show as invoice, not preview
        einvoiceStatus: 0, // 0 = Not issued yet (for publish later)
        status: "draft", // Draft status for publish later
        cartItems: cartItems, // Include cart items for receipt
        total: total, // Include total
        subtotal: total - calculatedTax, // Calculate from total - tax
        tax: calculatedTax,
        invoiceId: savedInvoice.invoice?.id,
        source: source || "pos",
        orderId: orderId, // Pass orderId
        tableId: orderData?.tableId || null, // Pass tableId
      };

      // Update existing order status for publish later if orderId is provided
      if (orderId) {
        try {
          console.log(
            "🔄 Updating existing order status for publish later:",
            orderId,
          );

          const orderUpdateData = {
            einvoiceStatus: 0, // 0 = chưa phát hành (for publish later)
            paymentStatus: "paid",
            status: "paid",
            invoiceNumber: null, // No invoice number yet for publish later
            symbol: selectedTemplate?.symbol || null,
            templateNumber: selectedTemplate?.templateNumber || null,
            notes: `E-Invoice draft saved - MST: ${formData.taxCode || "N/A"}, Template: ${selectedTemplate?.name || "N/A"}, Đợi phát hành sau`,
            paidAt: new Date().toISOString(),
          };

          const updateResponse = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(orderUpdateData),
          });

          if (updateResponse.ok) {
            const updatedOrder = await updateResponse.json();
            console.log(
              "✅ Order updated successfully for publish later:",
              updatedOrder,
            );
          } else {
            const errorText = await updateResponse.text();
            console.error(
              "❌ Failed to update order for publish later:",
              errorText,
            );
          }
        } catch (updateError) {
          console.error(
            "❌ Error updating order for publish later:",
            updateError,
          );
        }
      }

      console.log(
        "✅ PUBLISH LATER: Prepared data for onConfirm with isTitle=true",
      );
      console.log(
        "📦 PUBLISH LATER: Complete invoice data:",
        completeInvoiceData,
      );

      // Call onConfirm to trigger receipt modal display with isTitle=true
      onConfirm(completeInvoiceData);
      console.log(
        "✅ PUBLISH LATER: onConfirm called - parent will show receipt modal with isTitle=true",
      );

      console.log("--------------------------------------------------");
    } catch (error) {
      console.error("❌ Error in handlePublishLater:", error);

      let errorMessage = "Có lỗi xảy ra khi lưu hóa đơn";
      if (error instanceof Error) {
        errorMessage = `Có lỗi xảy ra khi lưu hóa đơn: ${error.message}`;
      } else if (typeof error === "string") {
        errorMessage = `Có lỗi xảy ra khi lưu hóa đơn: ${error}`;
      } else {
        errorMessage = `Có lỗi xảy ra khi lưu hóa đơn: ${JSON.stringify(error)}`;
      }

      toast({
        variant: "destructive",
        title: `${t("common.error")}`,
        description: errorMessage,
      });
    } finally {
      setIsProcessingPublishLater(false); // Always reset processing state for this button
    }
  };

  const handleConfirm = async (event?: React.MouseEvent) => {
    // Prevent event propagation and default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Add debouncing to prevent rapid clicks
    const now = Date.now();
    if (now - lastActionTime < 1000) {
      console.log("⚠️ Debouncing: Action too soon, ignoring duplicate call");
      return;
    }
    setLastActionTime(now);

    // Prevent duplicate calls
    if (isProcessingPublish || isPublishing) {
      console.log("⚠️ Already processing publish, skipping duplicate call");
      return;
    }

    // Validate required fields
    if (!formData.invoiceProvider || !formData.customerName) {
      alert(
        "Vui lòng điền đầy đủ thông tin bắt buộc: Đơn vị HĐĐT và Tên đơn vị",
      );
      return;
    }

    if (!formData.selectedTemplateId) {
      alert("Vui lòng chọn mẫu số hóa đơn");
      return;
    }

    setIsProcessingPublish(true); // Set processing state for this button

    // Debug log current cart items
    console.log("=== PHÁT HÀNH HÓA ĐƠN - KIỂM TRA DỮ LIỆU ===");
    console.log("cartItems received:", cartItems);
    console.log("cartItems length:", cartItems?.length || 0);
    console.log("cartItems detailed:", JSON.stringify(cartItems, null, 2));
    console.log("total amount:", total);

    // Find the provider value from the EINVOICE_PROVIDERS mapping
    const provider = EINVOICE_PROVIDERS.find(
      (p) => p.name === formData.invoiceProvider,
    );
    const providerId = provider ? parseInt(provider.value) : 1;

    // Get connection info from database based on selected provider
    const connectionInfo = eInvoiceConnections.find(
      (conn) => conn.softwareName === formData.invoiceProvider && conn.isActive,
    );

    if (!connectionInfo) {
      alert(
        `Không tìm thấy thông tin kết nối cho ${formData.invoiceProvider}. Vui lòng kiểm tra cấu hình trong Settings.`,
      );
      return;
    }

    // Validate cart items with detailed logging
    console.log("🔍 VALIDATING CART ITEMS FOR E-INVOICE");
    console.log("Raw cartItems:", JSON.stringify(cartItems, null, 2));
    console.log("CartItems type:", typeof cartItems);
    console.log("CartItems is array:", Array.isArray(cartItems));
    console.log("CartItems length:", cartItems?.length);

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      console.error("❌ No valid cart items found:", {
        cartItems,
        isArray: Array.isArray(cartItems),
        length: cartItems?.length,
        total: total,
      });
      alert(
        "Không có sản phẩm nào trong giỏ hàng để tạo hóa đơn điện tử.\n\nDữ liệu nhận được:\n- Số sản phẩm: " +
          (cartItems?.length || 0) +
          "\n- Tổng tiền: " +
          total.toLocaleString("vi-VN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) +
          " ₫\n\nVui lòng thử lại từ màn hình bán hàng.",
      );
      return;
    }

    // Validate each cart item has required data
    const invalidItems = cartItems.filter((item) => {
      const isValid =
        item &&
        (item.id || item.sku) &&
        item.name &&
        item.price !== undefined &&
        item.price !== null &&
        item.quantity !== undefined &&
        item.quantity !== null &&
        item.quantity > 0;

      if (!isValid) {
        console.log("❌ Invalid item found:", item);
      }
      return !isValid;
    });

    if (invalidItems.length > 0) {
      console.error("❌ Invalid cart items found:", invalidItems);
      alert(
        `Có ${invalidItems.length} sản phẩm trong giỏ hàng thiếu thông tin:\n${invalidItems.map((item) => `- ${item?.name || "Không có tên"}`).join("\n")}\n\nVui lòng kiểm tra lại giỏ hàng.`,
      );
      return;
    }

    console.log("✅ All cart items are valid for e-invoice generation");

    // Generate a new GUID for transactionID
    const generateGuid = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        },
      );
    };

    // Get order discount from orderData if available
    const orderDiscount = orderData?.discount
      ? parseFloat(orderData.discount)
      : 0;

    // Determine if tax should be included based on orderData
    let priceIncludeTax = orderData?.priceIncludeTax;

    // --- Start: Get data directly from order and order_item tables ---
    // Use orderData values directly without recalculation
    let orderSubtotal = orderData?.subtotal
      ? parseFloat(orderData.subtotal)
      : 0;
    let orderTax = orderData?.tax ? parseFloat(orderData.tax) : 0;
    let orderTotal = orderData?.total ? parseFloat(orderData.total) : total;
    let orderDiscountValue = orderData?.discount
      ? parseFloat(orderData.discount)
      : 0;

    console.log("🔍 E-invoice: Using direct order values from database:", {
      orderSubtotal,
      orderTax,
      orderTotal,
      orderDiscountValue,
      priceIncludeTax,
    });
    // --- End: Get data directly from order and order_item tables ---
    if (orderData?.items?.length > 0) {
      cartItems = orderData.items ?? [];
    }

    cartItems = cartItems.map((item) => {
      const product = products?.find((p: any) => p.id === item.productId);
      item.price = product?.price;
      item.taxRate = product?.taxRate;
      item.name = product?.name;
      return item;
    });
    // Build invoice products array from order_items, get taxRate from product table via productId
    const invoiceProducts = cartItems.map((item) => {
      // Get product info from products table using productId to get taxRate
      const product = products?.find((p: any) => p.id === item.productId);
      const itemTaxRate = product?.taxRate ? parseFloat(product.taxRate) : 0;

      // Get data directly from order_items (cartItems prop)
      const itemUnitPrice = parseFloat(product.price || "0");
      const itemQuantity = item.quantity;
      const itemDiscount = parseFloat(item.discount || "0");

      console.log(`💰 Item ${item.name} from order_items:`, {
        unitPrice: itemUnitPrice,
        quantity: itemQuantity,
        discount: itemDiscount,
        taxRate: itemTaxRate,
        productId: item.id,
      });

      // Get SKU from product table or generate
      const productSKU =
        product?.sku || `ITEM${String(item.id).padStart(3, "0")}`;

      // Calculate based on priceIncludeTax setting
      let itemTotalAmountWithoutTax = 0;
      let itemTax = 0;

      if (priceIncludeTax) {
        // When price includes tax:
        // 1. Calculate total with tax first (after discount)
        const giaGomThue = itemUnitPrice * itemQuantity - itemDiscount;

        // 2. Calculate amount without tax: giaGomThue / (1 + taxRate/100)
        itemTotalAmountWithoutTax = giaGomThue / (1 + itemTaxRate / 100);

        // 3. Calculate tax: giaGomThue - itemTotalAmountWithoutTax
        itemTax = giaGomThue - itemTotalAmountWithoutTax;
      } else {
        // When price doesn't include tax:
        // 1. Calculate amount without tax first (after discount)
        itemTotalAmountWithoutTax = Math.round(
          itemUnitPrice * itemQuantity - itemDiscount,
        );

        // 2. Calculate tax: itemTotalAmountWithoutTax * taxRate / 100
        itemTax = (itemTotalAmountWithoutTax * itemTaxRate) / 100;
      }

      return {
        itmCd: productSKU,
        itmName: item.productName || product?.name || "Unknown Product",
        itmKnd: 1,
        unitNm: "Cái",
        qty: itemQuantity,
        unprc: itemUnitPrice,
        amt: Math.round(itemTotalAmountWithoutTax),
        discRate: 0,
        discAmt: 0,
        vatRt: itemTaxRate.toString(),
        vatAmt: Math.round(Math.max(0, itemTax)),
        totalAmt: Math.round(itemTotalAmountWithoutTax + itemTax),
      };
    });

    // Update totals calculation to use direct order values
    const totalAmount = Math.floor(orderTotal);
    const totalAmountWithoutTax = Math.floor(orderSubtotal);
    const totalTaxAmount = Math.floor(orderTax);

    console.log("💰 E-invoice totals:", {
      totalAmountWithoutTax,
      totalTaxAmount,
      totalAmount,
      priceIncludeTax: priceIncludeTax,
      itemsCount: invoiceProducts.length,
      totalDiscount: orderDiscountValue,
    });

    // Get selected template data for API mapping
    const selectedTemplate = invoiceTemplates.find(
      (template) => template.id.toString() === formData.selectedTemplateId,
    );

    if (!selectedTemplate) {
      alert("Không tìm thấy thông tin mẫu số hóa đơn được chọn");
      return;
    }

    const publishRequest = {
      login: {
        providerId: providerId,
        url: connectionInfo.loginUrl || "https://infoerpvn.com:9440",
        ma_dvcs: connectionInfo.taxCode,
        username: connectionInfo.loginId,
        password: connectionInfo.password,
        tenantId: "",
      },
      transactionID: generateGuid(),
      invRef: `INV-${Date.now()}`,
      invSubTotal: totalAmountWithoutTax,
      invVatRate: 0, // Default VAT rate
      invVatAmount: totalTaxAmount,
      invDiscAmount: Math.floor(orderDiscountValue), // Total discount from all items, rounded down
      invTotalAmount: totalAmount,
      paidTp: "TM", // Cash payment
      note: "",
      hdNo: "",
      createdDate: new Date().toISOString(),
      clsfNo: selectedTemplate.templateNumber, // Mẫu số
      spcfNo: selectedTemplate.name, // Tên
      templateCode: selectedTemplate.templateCode || "", // Mã mẫu
      buyerNotGetInvoice: 0,
      exchCd: "VND",
      exchRt: 1,
      bankAccount: "",
      bankName: "",
      customer: {
        custCd: formData.taxCode,
        custNm: formData.customerName,
        custCompany: formData.customerName,
        taxCode: formData.taxCode,
        custCity: "",
        custDistrictName: "",
        custAddrs: formData.address || "",
        custPhone: formData.phoneNumber || "",
        custBankAccount: "",
        custBankName: "",
        email: formData.email || "",
        emailCC: "",
      },
      products: invoiceProducts, // Already calculated with discounts
    };

    console.log(
      "Publishing invoice with data:",
      JSON.stringify(publishRequest, null, 2),
    );

    // Call the proxy API
    const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(publishRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `API call failed: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    console.log("Invoice published successfully:", result);

    let invoiceResult = {
      success: false,
      invoice: null,
      message: "",
      receipt: null,
    };
    if (result.success) {
      console.log(
        "✅ E-invoice published successfully, now saving invoice and order to database",
      );

      invoiceResult = {
        success: true,
        invoice: {
          id: result.data?.id,
          invoiceNumber: result.data?.invoiceNo,
          tradeNumber: result.data?.invoiceNo, // Assuming tradeNumber is the same as invoiceNo
        },
        message: result.message,
        receipt: {
          // Include receipt data here
          transactionId: result.data?.invoiceNo || `TXN-${Date.now()}`,
          items: cartItems.map((item) => {
            const itemPrice =
              typeof item.price === "string"
                ? parseFloat(item.price)
                : item.price;
            const itemQuantity =
              typeof item.quantity === "string"
                ? parseInt(item.quantity)
                : item.quantity;
            const itemTaxRate =
              typeof item.taxRate === "string"
                ? parseFloat(item.taxRate || "0")
                : item.taxRate || 0;
            const itemSubtotal = itemPrice * itemQuantity;
            const itemTax = (itemSubtotal * itemTaxRate) / 100;

            return {
              id: item.id,
              productId: item.id,
              productName: item.name,
              price: itemPrice.toFixed(2),
              quantity: itemQuantity,
              total: (itemSubtotal + itemTax).toFixed(2),
              sku: item.sku || `FOOD${String(item.id).padStart(5, "0")}`,
              taxRate: itemTaxRate,
              discount: item.discount || "0", // Include discount
            };
          }),
          subtotal: orderSubtotal.toFixed(2),
          tax: orderTax.toFixed(2),
          total: orderTotal.toFixed(2),
          paymentMethod: "einvoice",
          originalPaymentMethod: selectedPaymentMethod,
          amountReceived: orderTotal.toFixed(2),
          change: "0.00",
          cashierName: "System User",
          createdAt: new Date().toISOString(),
          invoiceNumber: result.data?.invoiceNo || null,
          customerName: formData.customerName,
          customerTaxCode: formData.taxCode,
        },
      };

      // Map order totals to variables for invoice saving
      const orderSubtotalForInvoice = orderSubtotal;
      const orderTaxForInvoice = orderTax;
      const orderTotalForInvoice = orderTotal;

      // Lưu thông tin hóa đơn vào bảng invoices với mapping phương thức thanh toán
      try {
        // Map phương thức thanh toán theo yêu cầu
        const paymentMethodCode = getPaymentMethodCode(selectedPaymentMethod);

        const invoicePayload = {
          invoiceNumber: result.data?.invoiceNo || null, // Số hóa đơn từ API response
          templateNumber: selectedTemplate.templateNumber || null, // Mẫu số hóa đơn
          symbol: selectedTemplate.symbol || null, // Ký hiệu hóa đơn
          customerName: formData.customerName || "Khách hàng",
          customerTaxCode: formData.taxCode || null,
          customerAddress: formData.address || null,
          customerPhone: formData.phoneNumber || null,
          customerEmail: formData.email || null,
          subtotal: orderSubtotalForInvoice.toFixed(2),
          tax: orderTaxForInvoice.toFixed(2),
          total: orderTotalForInvoice.toFixed(2),
          paymentMethod: paymentMethodCode, // Sử dụng mã số thay vì text
          invoiceDate: new Date(),
          status: "published",
          einvoiceStatus: 1, // 1 = Đã phát hành
          notes: `E-Invoice published - Symbol: ${selectedTemplate.symbol || "N/A"}, Template: ${selectedTemplate.templateNumber || "N/A"}, Transaction ID: ${publishRequest.transactionID}, Invoice No: ${result.data?.invoiceNo || "N/A"}`,
          items: cartItems.map((item) => {
            const itemPrice =
              typeof item.price === "string"
                ? parseFloat(item.price)
                : item.price;
            const itemQuantity =
              typeof item.quantity === "string"
                ? parseInt(item.quantity)
                : item.quantity;
            const itemTaxRate =
              typeof item.taxRate === "string"
                ? parseFloat(item.taxRate || "0")
                : item.taxRate || 0;
            const itemSubtotal = itemPrice * itemQuantity;
            const itemTax = (itemSubtotal * itemTaxRate) / 100;

            return {
              productId: item.id,
              productName: item.name,
              quantity: itemQuantity,
              unitPrice: itemPrice.toFixed(2),
              total: (itemSubtotal + itemTax).toFixed(2),
              taxRate: itemTaxRate.toFixed(2),
              discount: item.discount || 0, // Add discount here
              discountAmount: (itemSubtotal * (item.discount || 0)) / 100, // Calculate discount amount
            };
          }),
        };

        console.log("💾 Saving published invoice to database:", invoicePayload);

        const invoiceResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invoicePayload),
        });

        if (invoiceResponse.ok) {
          const savedInvoice = await invoiceResponse.json();
          console.log(
            "✅ Invoice saved to database successfully:",
            savedInvoice,
          );
        } else {
          const errorText = await invoiceResponse.text();
          console.error("❌ Failed to save invoice to database:", errorText);
        }
      } catch (invoiceSaveError) {
        console.error("❌ Error saving invoice to database:", invoiceSaveError);
      }

      // Update existing order status if orderId is provided
      if (orderId) {
        try {
          console.log(
            "🔄 Updating existing order status after e-invoice publish:",
            orderId,
          );

          const orderUpdateData = {
            einvoiceStatus: 1, // 1 = Đã phát hành
            paymentStatus: "paid",
            status: "paid",
            invoiceNumber: result.data?.invoiceNo || null,
            symbol: selectedTemplate.symbol || null,
            templateNumber: selectedTemplate.templateNumber || null,
            notes: `E-Invoice published - Invoice No: ${result.data?.invoiceNo || "N/A"}, Symbol: ${selectedTemplate.symbol || "N/A"}, Template: ${selectedTemplate.templateNumber || "N/A"}`,
            paidAt: new Date().toISOString(),
          };

          const updateResponse = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(orderUpdateData),
          });

          if (updateResponse.ok) {
            const updatedOrder = await updateResponse.json();
            console.log(
              "✅ Order updated successfully after e-invoice publish:",
              updatedOrder,
            );
          } else {
            const errorText = await updateResponse.text();
            console.error(
              "❌ Failed to update order after e-invoice publish:",
              errorText,
            );
          }
        } catch (updateError) {
          console.error(
            "❌ Error updating order after e-invoice publish:",
            updateError,
          );
        }
      } else {
        // Create new order for POS orders without orderId
        try {
          const orderStatus = "paid";
          const publishType = "publish"; // Indicate that this is a direct publish
          const einvoiceStatus = 1; // 1 = Đã phát hành

          // Create order data for POS E-invoice order
          const orderData = {
            orderNumber: `ORD-${Date.now()}`,
            tableId: null, // No table for POS orders
            salesChannel: "pos", // ALWAYS pos for POS e-invoice orders
            customerName: formData.customerName,
            customerPhone: formData.phoneNumber || null,
            customerEmail: formData.email || null,
            subtotal: orderSubtotalForInvoice.toFixed(2),
            tax: orderTaxForInvoice.toFixed(2),
            total: orderTotalForInvoice.toFixed(2),
            status: orderStatus,
            paymentMethod: publishType === "publish" ? "cash" : null, // Use 'cash' for published, null for draft
            paymentStatus: publishType === "publish" ? "paid" : "pending",
            einvoiceStatus: einvoiceStatus,
            invoiceNumber: result.data?.invoiceNo || null,
            symbol: selectedTemplate.symbol || null,
            templateNumber: selectedTemplate.templateNumber || null,
            notes: `E-Invoice published - Tax Code: ${formData.taxCode || "N/A"}, Address: ${formData.address || "N/A"}, Invoice No: ${result.data?.invoiceNo || "N/A"}`,
            orderedAt: new Date(),
            employeeId: null, // Can be set if employee info is available
            salesChannel: "pos",
          };

          console.log("💾 Saving published order to database:", orderData);

          const saveResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(orderData),
          });

          if (saveResponse.ok) {
            const savedOrder = await saveResponse.json();
            console.log("✅ Order saved to database successfully:", savedOrder);
          } else {
            console.error(
              "❌ Failed to save order to database:",
              await saveResponse.text(),
            );
          }
        } catch (saveError) {
          console.error("❌ Error saving order to database:", saveError);
        }
      }

      toast({
        title: `${t("common.success")}`,
        description: `Hóa đơn điện tử đã được phát hành thành công!\nSố hóa đơn: ${result.data?.invoiceNo || "N/A"}`,
      });

      // Create receipt data for printing
      const receiptData = {
        id: orderId, // Add orderId
        tableId: orderData?.tableId || null, // Add tableId from orderData
        orderNumber: orderData?.orderNumber || `ORD-${orderId || Date.now()}`, // Add orderNumber
        transactionId: result.data?.invoiceNo || `TXN-${Date.now()}`,
        items: cartItems.map((item) => {
          const itemPrice =
            typeof item.price === "string"
              ? parseFloat(item.price)
              : item.price;
          const itemQuantity =
            typeof item.quantity === "string"
              ? parseInt(item.quantity)
              : item.quantity;
          const itemTaxRate =
            typeof item.taxRate === "string"
              ? parseFloat(item.taxRate || "0")
              : item.taxRate || 0;
          const itemSubtotal = itemPrice * itemQuantity;
          const itemTax = (itemSubtotal * itemTaxRate) / 100;

          return {
            id: item.id,
            productId: item.id,
            productName: item.name,
            price: itemPrice.toFixed(2),
            quantity: itemQuantity,
            discount: item.discount || "0", // Include discount
            total: (itemSubtotal + itemTax).toFixed(2),
            sku: item.sku || `FOOD${String(item.id).padStart(5, "0")}`,
            taxRate: itemTaxRate,
          };
        }),
        subtotal: orderSubtotal.toFixed(2),
        tax: orderTax.toFixed(2),
        total: orderTotal.toFixed(2),
        paymentMethod: "einvoice",
        originalPaymentMethod: selectedPaymentMethod,
        amountReceived: orderTotal.toFixed(2),
        change: "0.00",
        cashierName: "System User",
        createdAt: new Date().toISOString(),
        invoiceNumber: result.data?.invoiceNo || null,
        customerName: formData.customerName,
        customerTaxCode: formData.taxCode,
      };

      // Prepare comprehensive invoice data with receipt
      const completeInvoiceData = {
        success: true,
        paymentMethod: selectedPaymentMethod,
        originalPaymentMethod: selectedPaymentMethod,
        publishLater: false, // This is direct publish, not publish later
        receipt: receiptData,
        customerName: formData.customerName,
        taxCode: formData.taxCode,
        showReceiptModal: true,
        shouldShowReceipt: true,
        einvoiceStatus: 1, // 1 = Issued
        status: "published",
        cartItems: cartItems,
        total: orderTotal,
        subtotal: orderSubtotal,
        tax: orderTax,
        invoiceId: result.data?.id,
        invoiceNumber: result.data?.invoiceNo,
        source: source || "pos",
        orderId: orderId, // Pass orderId
        tableId: orderData?.tableId || null, // Pass tableId
      };

      console.log(
        "✅ Prepared comprehensive invoice result with receipt:",
        completeInvoiceData,
      );

      // Call onConfirm to trigger receipt modal display
      onConfirm(completeInvoiceData);
      console.log(
        "✅ PUBLISH: onConfirm called - parent will handle modal states",
      );

      console.log("--------------------------------------------------");
    } else {
      // If invoice publishing failed, still try to create a transaction for the payment
      console.warn(
        "Invoice publishing failed, proceeding to create transaction for payment.",
      );

      // Calculate values for failed invoice transaction
      let subtotal = 0;
      let tax = 0;
      cartItems.forEach((item) => {
        const itemPrice =
          typeof item.price === "string" ? parseFloat(item.price) : item.price;
        const itemQuantity =
          typeof item.quantity === "string"
            ? parseInt(item.quantity)
            : item.quantity;
        const itemTaxRate =
          typeof item.taxRate === "string"
            ? parseFloat(item.taxRate || "0")
            : item.taxRate || 0;

        const itemSubtotal = itemPrice * itemQuantity;
        const itemTax = (itemSubtotal * itemTaxRate) / 100;

        subtotal += itemSubtotal;
        tax += itemTax;
      });
      const transactionTotal = total; // Use the total passed to the modal

      const transactionData = {
        transaction: {
          transactionId: `TXN-${Date.now()}`,
          subtotal: subtotal.toString(),
          tax: tax.toString(),
          total: transactionTotal.toString(),
          paymentMethod: getPaymentMethodName(selectedPaymentMethod),
          cashierName: "POS User",
          notes: "Thanh toán POS - Hóa đơn không thành công", // Note that invoice failed
          invoiceId: null, // No invoice ID
          invoiceNumber: null, // No invoice number
        },
        items: cartItems.map((item) => ({
          productId: item.id,
          productName: item.name,
          price:
            typeof item.price === "string" ? item.price : item.price.toString(),
          quantity:
            typeof item.quantity === "string"
              ? parseInt(item.quantity)
              : item.quantity,
          total: (
            (typeof item.price === "string"
              ? parseFloat(item.price)
              : item.price) *
            (typeof item.quantity === "string"
              ? parseInt(item.quantity)
              : item.quantity)
          ).toString(),
        })),
      };

      try {
        const transactionResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(transactionData),
        });

        if (transactionResponse.ok) {
          const transactionResult = await response.json();
          console.log(
            "✅ Transaction created successfully for failed invoice:",
            transactionResult,
          );
        } else {
          const errorText = await transactionResponse.text();
          console.error(
            "❌ Failed to create transaction for failed invoice:",
            errorText,
          );
        }
      } catch (transactionError) {
        console.error(
          "❌ Error creating transaction for failed invoice:",
          transactionError,
        );
      }
      // Re-throw the original error to show the user that invoice publishing failed
      throw new Error(result.message || "Có lỗi xảy ra khi phát hành hóa đơn");
    }
  };

  const handleCancel = () => {
    setIsPublishing(false); // Reset general publishing state
    setIsProcessingPublish(false); // Reset specific publish button state
    setIsProcessingPublishLater(false); // Reset specific publish later button state
    setLastActionTime(0); // Reset debounce timer
    
    // Dispatch event for other components
    window.dispatchEvent(
      new CustomEvent("einvoiceModalClosed", {
        detail: { refreshData: true, timestamp: new Date().toISOString() },
      }),
    );
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-blue-700 bg-blue-100 p-3 rounded-t-lg">
            {t("einvoice.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* E-invoice Provider Information */}
          <div>
            <h3 className="text-base font-medium mb-4">
              {t("einvoice.providerInfo")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoiceProvider">
                  {t("einvoice.providerUnit")}
                </Label>
                <Select
                  value={formData.invoiceProvider}
                  onValueChange={(value) =>
                    handleInputChange("invoiceProvider", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn đơn vị HĐĐT" />
                  </SelectTrigger>
                  <SelectContent>
                    {EINVOICE_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.name}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoiceTemplate">
                  {t("einvoice.invoiceTemplate")}
                </Label>
                <Select
                  value={formData.selectedTemplateId}
                  onValueChange={(value) =>
                    handleInputChange("selectedTemplateId", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("einvoice.selectTemplate")} />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceTemplates.map((template) => (
                      <SelectItem
                        key={template.id}
                        value={template.id.toString()}
                      >
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div>
            <h3 className="text-base font-medium mb-4">
              {t("einvoice.customerInfo")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taxCode">{t("einvoice.taxCode")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="taxCode"
                    ref={(el) => {
                      inputRefs.current["taxCode"] = el;
                    }}
                    value={formData.taxCode}
                    onChange={(e) =>
                      handleInputChange("taxCode", e.target.value)
                    }
                    onFocus={() => handleInputFocus("taxCode")}
                    placeholder="0123456789"
                    disabled={false}
                    readOnly={false}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={handleGetTaxInfo}
                    disabled={isTaxCodeLoading}
                  >
                    {isTaxCodeLoading ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
                        Đang tải...
                      </>
                    ) : (
                      t("einvoice.getInfo")
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="customerName">
                  {t("einvoice.companyName")}
                </Label>
                <Input
                  id="customerName"
                  ref={(el) => {
                    inputRefs.current["customerName"] = el;
                  }}
                  value={formData.customerName}
                  onChange={(e) =>
                    handleInputChange("customerName", e.target.value)
                  }
                  onFocus={() => handleInputFocus("customerName")}
                  placeholder="Công ty TNHH ABC"
                  disabled={false}
                  readOnly={false}
                />
              </div>
              <div>
                <Label htmlFor="address">{t("einvoice.address")}</Label>
                <Input
                  id="address"
                  ref={(el) => {
                    inputRefs.current["address"] = el;
                  }}
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  onFocus={() => handleInputFocus("address")}
                  placeholder="Cầu Giấy, Hà Nội"
                  disabled={false}
                  readOnly={false}
                />
              </div>
              <div>
                <Label htmlFor="phoneNumber">
                  {t("einvoice.idCardNumber")}
                </Label>
                <Input
                  id="phoneNumber"
                  ref={(el) => {
                    inputRefs.current["phoneNumber"] = el;
                  }}
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    handleInputChange("phoneNumber", e.target.value)
                  }
                  onFocus={() => handleInputFocus("phoneNumber")}
                  placeholder="0123456789"
                  disabled={false}
                  readOnly={false}
                />
              </div>

              <div>
                <Label htmlFor="email">{t("einvoice.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  ref={(el) => {
                    inputRefs.current["email"] = el;
                  }}
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  onFocus={() => handleInputFocus("email")}
                  placeholder="ngocnv@gmail.com"
                  disabled={false}
                  readOnly={false}
                />
              </div>
            </div>
          </div>

          {/* Total Amount Display */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">{t("einvoice.totalAmount")}</span>
              <span className="text-lg font-bold text-blue-600">
                {Math.floor(total).toLocaleString("vi-VN")} ₫
              </span>
            </div>
          </div>

          {/* Virtual Keyboard Toggle */}
          <div className="flex justify-center pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleVirtualKeyboard}
              className={`${showVirtualKeyboard ? "bg-blue-100 border-blue-300" : ""}`}
            >
              <Keyboard className="w-4 h-4 mr-2" />
              {showVirtualKeyboard
                ? "Ẩn bàn phím"
                : t("einvoice.virtualKeyboard")}
            </Button>
          </div>

          {/* Virtual Keyboard */}
          {showVirtualKeyboard && (
            <div className="mt-4">
              <VirtualKeyboard
                onKeyPress={handleVirtualKeyPress}
                onBackspace={handleVirtualBackspace}
                onEnter={handleVirtualEnter}
                isVisible={showVirtualKeyboard}
                className="mx-auto"
              />
              {activeInputField && (
                <p className="text-sm text-gray-600 text-center mt-2">
                  Đang nhập vào:{" "}
                  {activeInputField === "taxCode"
                    ? "Mã số thuế"
                    : activeInputField === "customerName"
                      ? "Tên đơn vị"
                      : activeInputField === "address"
                        ? "Địa chỉ"
                        : activeInputField === "phoneNumber"
                          ? "Số điện thoại"
                          : activeInputField === "email"
                            ? "Email"
                            : activeInputField}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              onClick={handleConfirm} // Changed to call handleConfirm directly
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={
                isProcessingPublish || isPublishing || isProcessingPublishLater
              } // Disable if ANY processing is happening
            >
              {isProcessingPublish || isPublishing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  {t("einvoice.publishing")}
                </>
              ) : (
                <>
                  <span className="mr-2">✅</span>
                  {t("einvoice.publish")}
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={(e) => handlePublishLater(e)}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white"
              disabled={
                isProcessingPublishLater || isPublishing || isProcessingPublish
              } // Disable if ANY processing is happening
            >
              {isProcessingPublishLater || isPublishing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  {t("einvoice.publishing")}
                </>
              ) : (
                <>
                  <span className="mr-2">⏳</span>
                  {t("einvoice.publishLater")}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLastActionTime(0); // Reset debounce timer
                handleCancel();
              }}
              className="flex-1"
              disabled={
                isProcessingPublish || isProcessingPublishLater || isPublishing
              } // Disable if ANY processing is happening
            >
              <span className="mr-2">❌</span>
              {t("einvoice.cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
