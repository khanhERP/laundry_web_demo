import { X, Printer, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Receipt } from "@shared/schema";
import logoPath from "@assets/EDPOS_1753091767028.png";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { EInvoiceModal } from "./einvoice-modal";
import { PaymentMethodModal } from "./payment-method-modal";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt?: Receipt | null;
  cartItems?: any[];
  total?: number;
  isPreview?: boolean;
  onConfirm?: (orderData?: any) => void;
  isTitle?: boolean;
}

export function ReceiptModal({
  isOpen,
  onClose,
  receipt,
  cartItems = [],
  total = 0,
  isPreview = false,
  onConfirm,
  isTitle = true,
}: ReceiptModalProps) {
  // ALL HOOKS MUST BE AT THE TOP LEVEL - NEVER CONDITIONAL
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [domainName, setDomainName] = useState("");
  const { t } = useTranslation();
  const { toast } = useToast();

  console.log("🔍 ReceiptModal rendered with props:", {
    isOpen,
    isPreview,
    isTitle,
    hasReceipt: !!receipt,
    hasCartItems: cartItems?.length > 0,
    receiptIsPreview: receipt?.isPreview,
  });

  const lstBank = [
    {
      bankId: "970423",
      bankAccountNo: "00004129365",
      bankAccountName: "SHIN INSUNG",
      domain: "0108670987-001.edpos.vn",
    },
    {
      bankId: "970423",
      bankAccountNo: "00004129101",
      bankAccountName: "SHIN INSUNG",
      domain: "0108670987-002.edpos.vn",
    },
    {
      bankId: "970423",
      bankAccountNo: "00004129330",
      bankAccountName: "SHIN INSUNG",
      domain: "0108670987-003.edpos.vn",
    },
    {
      bankId: "970424",
      bankAccountNo: "700037614418",
      bankAccountName: "PARK CHEON KYU",
      domain: "0108670987-005.edpos.vn",
    },
    {
      bankId: "970407",
      bankAccountNo: "6868568185",
      bankAccountName: "NGUYEN THUY CHI",
      domain: "0108670987-004.edpos.vn",
    },
    {
      bankId: "970423",
      bankAccountNo: "00004129426",
      bankAccountName: "SHIN INSUNG",
      domain: "0108670987-006.edpos.vn",
    },
    {
      bankId: "970423",
      bankAccountNo: "00004129448",
      bankAccountName: "SHIN INSUNG",
      domain: "0108670987-007.edpos.vn",
    },
  ];

  // CRITICAL: Always use prop isPreview, completely ignore receipt.isPreview
  console.log("🔍 ReceiptModal mode:", {
    propIsPreview: isPreview,
    receiptIsPreview: receipt?.isPreview,
    isTitleProp: isTitle,
    mode: isPreview ? "PREVIEW" : "FINAL RECEIPT",
  });

  // Calculate title: isTitle=true always shows payment invoice, otherwise use isPreview
  let title =
    isTitle === false
      ? t("pos.receiptPreview").toUpperCase()
      : t("common.paymentInvoice").toUpperCase();

  // Query store settings
  const { data: storeSettings } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings");
      console.log("🏢 Store settings fetched:", response.json());
      return response.json();
    },
    enabled: isOpen, // Only fetch when modal is open
  });

  // Query to get table info based on orderId
  const { data: tableInfo } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables/by-order", receipt?.id],
    queryFn: async () => {
      if (!receipt?.id) return null;

      // First get the order to find tableId
      const orderResponse = await apiRequest(
        "GET",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${receipt.id}`,
      );
      const order = await orderResponse.json();
      receipt.orderNumber = order.orderNumber;

      if (!order?.tableId) return null;

      // Then get the table info
      const tableResponse = await apiRequest(
        "GET",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables/${order.tableId}`,
      );
      const table = await tableResponse.json();

      console.log("📍 Table info fetched for order:", {
        orderId: receipt.id,
        orderNumber: order.orderNumber,
        tableId: order.tableId,
        tableNumber: table.tableNumber,
      });

      return table;
    },
    enabled: isOpen && !!receipt?.id,
  });

  // Get table number from query result
  const displayTableNumber = useMemo(() => {
    if (receipt?.tableNumber) return receipt.tableNumber;
    if (tableInfo?.tableNumber) return tableInfo.tableNumber;
    return "-";
  }, [receipt?.tableNumber, tableInfo?.tableNumber]);

  // Log receipt modal state for debugging - ALWAYS CALL THIS HOOK
  useEffect(() => {
    const domainConnect = window.location.hostname;
    setDomainName(domainConnect);
    let selectBank = lstBank.find((item) => item.domain === domainName);
    if (selectBank) {
      setBankAccounts(selectBank);
    } else if (
      domainName != "0108670987-004.edpos.vn" ||
      domainName != "0108670987-008.edpos.vn"
    ) {
      setBankAccounts(lstBank[0]);
    }

    if (isOpen) {
      console.log("=== RECEIPT MODAL RENDERED ===");
      console.log(
        "Receipt Modal Mode:",
        isPreview ? "PREVIEW (Step 1)" : "FINAL RECEIPT (Step 5)",
      );
      console.log("Receipt Modal isOpen:", isOpen);
      console.log("Receipt Modal isPreview:", isPreview);
      console.log("Receipt Modal cartItems received:", cartItems);
      console.log("Receipt Modal cartItems length:", cartItems?.length || 0);
      console.log("Receipt Modal total:", total);
      console.log("Receipt Modal receipt:", receipt);
      console.log("🔍 ReceiptModal Props Debug:", {
        isOpen,
        isPreview,
        receipt,
        isTitle,
        cartItems: cartItems?.length || 0,
        onConfirm: !!onConfirm,
        hasReceiptData: !!(receipt && typeof receipt === "object"),
        hasValidData:
          !!(receipt && typeof receipt === "object") ||
          (isPreview &&
            cartItems &&
            Array.isArray(cartItems) &&
            cartItems.length > 0 &&
            total > 0),
      });

      console.log("Receipt Modal autoClose:", title);

      // Force show modal when receipt data exists
      if (receipt && typeof receipt === "object") {
        console.log(
          "✅ Receipt Modal: Valid receipt data found - modal will display",
        );
      }
    }
  }, [isOpen, receipt, isPreview, cartItems, total, onConfirm, isTitle]);

  // Don't return early here - let the Dialog component handle the open state

  useEffect(() => {
    async function fetchPrinterConfigs() {
      try {
        const printerResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs");
        if (!printerResponse.ok) {
          console.error("Failed to fetch printer configs");
          return;
        }

        const allConfigs = await printerResponse.json();
        console.log(`📋 Total printer configs found: ${allConfigs.length}`);

        // Get table floor if receipt has tableId
        let tableFloor = null;
        if (receipt?.tableId) {
          try {
            const tableResponse = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables/${receipt.tableId}`);
            if (tableResponse.ok) {
              const tableData = await tableResponse.json();
              tableFloor = tableData.floor;
              console.log(
                `📍 Table ${receipt.tableId} is on floor: ${tableFloor}`,
              );
            }
          } catch (error) {
            console.error("Error fetching table data:", error);
          }
        }

        let activePrinterConfigs = [];

        // For kitchen receipts, get kitchen printers matching the floor + one employee printer
        let employeePrinter = allConfigs.filter(
          (config) => config.isActive && config.isEmployee,
        );

        let kitchenPrinters = allConfigs.filter(
          (config) => config.isActive && config.isKitchen,
        );

        console.log(
          `🍳 Kitchen receipt mode - Found ${kitchenPrinters.length} active kitchen printers`,
        );

        // Filter kitchen printers by floor if we have table floor info
        if (tableFloor) {
          kitchenPrinters = kitchenPrinters.filter(
            (config) => config.floor === tableFloor,
          );
          console.log(
            `🖨️ Filtered to ${kitchenPrinters.length} kitchen printers for floor ${tableFloor}`,
          );
        }

        // Combine kitchen printers with one employee printer
        activePrinterConfigs = [...kitchenPrinters, ...employeePrinter];

        if (isTitle) {
          activePrinterConfigs = activePrinterConfigs.filter(
            (config) => config.isEmployee,
          );
        }

        if (activePrinterConfigs.length > 0) {
          let lstPrinters = activePrinterConfigs.map((printer) => {
            return {
              name: printer.name,
              type: printer.printerType,
              ip: printer.ipAddress,
              port: printer.port ?? 9100,
              copies: printer.copies ?? 1,
              serinumber: printer.macAddress,
            };
          });
          setPrinters(lstPrinters);
          console.log("Danh sachs máy in", lstPrinters);
          console.log("✅ Final printer list to be used:");
        } else {
          console.log("⚠️ No matching printers found");
        }
      } catch (error) {
        console.error("Error in fetchPrinterConfigs:", error);
      }
    }
    fetchPrinterConfigs();
  }, [receipt?.tableId]);

  // Handle missing data cases
  const hasReceiptData = receipt && typeof receipt === "object";
  const hasCartData =
    cartItems && Array.isArray(cartItems) && cartItems.length > 0;
  const hasValidData =
    hasReceiptData || (isPreview && hasCartData && total > 0);

  if (!hasValidData) {
    console.log("❌ Receipt Modal: No valid data for display", {
      hasReceiptData,
      hasCartData,
      isPreview,
      total,
    });

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thông tin hóa đơn</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p>
              {isPreview
                ? "Không có sản phẩm trong giỏ hàng để xem trư  c hóa đơn"
                : "Không có dữ liệu hóa đơn để hiển thị"}
            </p>
            <Button onClick={onClose} className="mt-4">
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleGetPrint = async () => {
    const printContent = document.getElementById("receipt-content");
    if (!printContent) {
      alert("Không tìm thấy nội dung hóa đơn để in.");
      return;
    }
    let content = printContent?.innerHTML ?? "";
    if (content) {
      // content = formatForMiniPrinter(receipt, storeSettings);
      content = generatePrintHTML(printContent, false);
    }

    console.log("🖨{ ============ BẮT ĐẦU IN HÓA ĐƠN ============");
    console.log(
      `📝 Loại hóa đơn: ${isTitle ? "Hóa đơn nhân viên" : "Hóa đơn bếp"}`,
    );
    console.log(`📊 Số lượng máy in sẽ được sử dụng: ${printers.length}`);
    console.log(
      `🏢 Bàn: ${receipt?.tableId ? `Bàn ${receipt.tableId}` : "POS"}`,
    );
    console.log(`📍 Tầng: ${receipt?.tableId ? "Sẽ lọc theo tầng" : "N/A"}`);

    if (printers.length > 0) {
      console.log("📋 ==========================================");
      console.log("📋 DANH SÁCH MÁY IN SẼ ĐƯỢC SỬ DỤNG:");
      console.log("📋 ==========================================");
      printers.forEach((printer, index) => {
        console.log(`\n   🖨️  MÁY IN #${index + 1}:`);
        console.log(`   ├─ Tên máy in: ${printer.name}`);
        console.log(`   ├─ Loại máy in: ${printer.type}`);
        console.log(
          `   ├─ Kết nối: ${printer.ip ? `IP ${printer.ip}:${printer.port}` : "USB"}`,
        );
        console.log(`   └─ Số bản in: ${printer.copies} bản`);
      });
      console.log("\n📋 ==========================================\n");
    } else {
      console.log("⚠️ ==========================================");
      console.log("⚠️ KHÔNG CÓ MÁY IN NÀO ĐƯỢC CÁU HÌNH!");
      console.log("⚠️ ==========================================");
    }

    try {
      console.log("📤 Đang gửi lệnh in đến máy in...");
      console.log(
        `📦 Dữ liệu gửi đi: ${printers.length} máy in, ${content.length} ký tự nội dung`,
      );

      const response = await fetch("http://localhost:5000/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printers,
          content,
        }),
      });

      const result = await response.text();
      console.log("✅ ==========================================");
      console.log("✅ KẾT QUẢ IN THÀNH CÔNG!");
      console.log("✅ ==========================================");
      console.log(`✅ Response: ${result}`);
      console.log(`✅ Đã in trên ${printers.length} máy in`);
      printers.forEach((printer, index) => {
        console.log(
          `   ✓ Máy in #${index + 1}: ${printer.name} - ${printer.copies} bản`,
        );
      });
      console.log("🖨️ ============ KẾT THÚC IN HÓA ĐƠN ============\n");
      toast({
        title: `${t("common.success")}`,
        description: `${t("common.success")}`,
      });

      onClose();
    } catch (error) {
      toast({
        title: `${t("common.error")}`,
        description:
          "Bạn chưa mở phần mềm hỗ trợ máy in. Vui lòng mở phần mềm Edposprintservice",
      });
      onClose();
    }
  };

  const handlePrint = async () => {
    console.log(
      "🖨️ Receipt Modal: Print button clicked - processing for multi-platform printing",
    );

    const printContent = document.getElementById("receipt-content");
    if (!printContent) {
      alert("Không tìm thấy nội dung hóa đơn để in.");
      return;
    }

    try {
      // Enhanced device detection
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isAndroid = /android/.test(userAgent);
      const isMobile =
        isIOS || isAndroid || /mobile|tablet|phone/.test(userAgent);
      const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
      const isChrome = /chrome/.test(userAgent);
      const isPOSTerminal =
        window.innerWidth <= 1024 && window.innerHeight <= 768;

      console.log("🔍 Enhanced device detection:", {
        isIOS,
        isAndroid,
        isMobile,
        isSafari,
        isChrome,
        isPOSTerminal,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: userAgent.substring(0, 100),
      });

      // Step 1: Check for active printer configurations
      let activePrinterConfigs = [];
      try {
        console.log("🖨️ Fetching active printer configurations...");
        const printerResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs");
        if (printerResponse.ok) {
          const allConfigs = await printerResponse.json();
          activePrinterConfigs = allConfigs.filter(
            (config) =>
              config.isActive && (config.isEmployee || config.isKitchen),
          );
          console.log("✅ Found active printer:", activePrinterConfigs);
          console.log(
            "✅ Found active printer configs:",
            activePrinterConfigs.length,
          );
        }
      } catch (configError) {
        console.log(
          "⚠️ Could not fetch printer configs, using fallback methods",
        );
      }

      // Step 2: Create receipt data structure for printing
      const receiptData = {
        content: printContent.innerHTML,
        type: "receipt",
        timestamp: new Date().toISOString(),
        orderId: receipt?.id,
        transactionId: receipt?.transactionId,
        deviceInfo: {
          userAgent: userAgent.substring(0, 100),
          platform: isIOS ? "iOS" : isAndroid ? "Android" : "Desktop",
          browser: isSafari ? "Safari" : isChrome ? "Chrome" : "Other",
          isMobile: isMobile,
        },
      };

      // Step 3: Try configured printers first (POS API with active configs)
      if (activePrinterConfigs.length > 0) {
        console.log("🖨️ Trying configured POS printers for all platforms...");

        try {
          const printResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/pos/print-receipt", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...receiptData,
              printerConfigs: activePrinterConfigs,
              preferredConfig:
                activePrinterConfigs.find((c) => c.isEmployee) ||
                activePrinterConfigs[0],
            }),
          });

          if (printResponse.ok) {
            const result = await printResponse.json();
            console.log(
              "✅ Receipt sent to configured printer successfully:",
              result,
            );

            // Show success message based on device type
            const successMessage = isMobile
              ? "✅ H=a đơn đã đưac gửi đến máy in thành công!\nKiểm tra máy in POS của bạn."
              : "✅ Hóa đơn đã được gửi đến máy in POS thành công!";

            alert(successMessage);
            onClose();

            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("printCompleted", {
                  detail: { closeAllModals: true, refreshData: true },
                }),
              );
            }
            return;
          } else {
            console.log(
              "⚠️ Configured printer API returned error, trying platform-specific fallbacks",
            );
          }
        } catch (apiError) {
          console.log(
            "⚠️ Configured printer API failed, using platform-specific fallbacks:",
            apiError.message,
          );
        }
      }

      // Step 4: Platform-specific fallback methods
      if (isMobile) {
        await handleMobilePrinting(
          printContent,
          isIOS,
          isAndroid,
          isSafari,
          isChrome,
        );
      } else {
        await handleDesktopPrinting(printContent);
      }
    } catch (error) {
      console.error("❌ Print error:", error);
      alert(`Có lỗi xảy ra khi in: ${error.message}\nVui lòng thử lại.`);
      // Final fallback to desktop method
      if (printContent) {
        handleDesktopPrint(printContent);
      }
    }
  };

  const formatForMiniPrinter = (receipt: any, config: any) => {
    const lineBreak = "\n";
    let formattedText = `
        ${config.storeName || "Tên cửa hàng"}
        Vị trí cửa hàng: ${config.address || "Địa chỉ cửa hàng"}
        Điện thoại: ${config.phone || "Số điện thoại"}
        Phiếu tạm tính
        Số giao dịch: ${receipt.transactionId}
        Ngày: ${new Date().toLocaleString("vi-VN")}
        Thu ngân: ${receipt.cashierName || "Tên thu ngân"}
    `;
    const taxGroups = receipt.items.reduce(
      (groups: Record<number, number>, item: any) => {
        const taxRate = parseFloat(item.taxRate || "0");
        const unitPrice = parseFloat(item.unitPrice || item.price || "0");
        const quantity = item.quantity || 1;
        const itemDiscount = parseFloat(item.discount || "0");

        const itemSubtotal = unitPrice * quantity - itemDiscount;
        if (!groups[taxRate]) {
          groups[taxRate] = 0;
        }
        const itemTax = (itemSubtotal * taxRate) / (100 + taxRate);
        groups[taxRate] += itemTax;
        return groups;
      },
      {},
    );
    const sortedTaxRates = Object.keys(taxGroups)
      .map(Number)
      .sort((a, b) => b - a);
    receipt.items.forEach((item: any) => {
      formattedText += `
        Tên sản phẩm: ${item.productName || "Không xác định"}
        SKU: ${item.sku} x ${item.quantity} (${(item.unitPrice || "0").toLocaleString("vi-VN")})
        Tổng: ${(parseFloat(item.unitPrice || "0") * (item.quantity || 1)).toLocaleString("vi-VN")} ₫
        Giảm giá: -${(item.discount || 0).toLocaleString("vi-VN")} ₫
      `;
    });
    formattedText += lineBreak;
    let taxText = "";
    sortedTaxRates.forEach((taxRate) => {
      taxText += `
        Thuế (${taxRate}%): ${Math.floor(taxGroups[taxRate]).toLocaleString("vi-VN")} ₫
      `;
    });
    const total = receipt.items.reduce((sum: number, item: any) => {
      return (
        sum +
        parseFloat(item.unitPrice || "0") * (item.quantity || 1) -
        (item.discount || 0)
      );
    }, 0);

    formattedText += `
        Thành tiền: ${total.toLocaleString("vi-VN")} ₫
        ${taxText}
        Tổng tiền: ${(total + Object.values(taxGroups).reduce((sum, tax) => sum + tax, 0)).toLocaleString("vi-VN")} ₫
    `;

    return formattedText.trim();
  };

  // Enhanced mobile printing handler
  const handleMobilePrinting = async (
    printContent: HTMLElement,
    isIOS: boolean,
    isAndroid: boolean,
    isSafari: boolean,
    isChrome: boolean,
  ) => {
    console.log(
      "📱 Using enhanced mobile printing for",
      isIOS ? "iOS" : isAndroid ? "Android" : "Mobile",
    );

    // Show user options for mobile printing with platform-specific messaging
    const platformMessage = isIOS
      ? "Máy in POS không khả dụng.\n\nChọn OK để tải file hóa đơn (Safari có thể mở trực tiếp).\nChọn Cancel để thử in trực tiếp từ trình duyệt."
      : isAndroid
        ? "Máy in POS không khả dụng.\n\nChọn OK để tải/chia sẻ file hóa đơn.\nChọn Cancel để thử in trực tiếp từ Chrome."
        : "Máy in POS không khả dụng.\n\nChọn OK để tải file hóa đơn.\nChọn Cancel để thử in trực tiếp.";

    const userChoice = confirm(platformMessage);

    if (userChoice) {
      // User chose to download/share file
      console.log("📱 User chose to download/share receipt file");
      await downloadReceiptFile(printContent, isIOS, isAndroid);
    } else {
      // User chose to try browser print dialog
      console.log("📱 User chose to try browser print dialog");
      await openBrowserPrintDialog(
        printContent,
        isIOS,
        isAndroid,
        isSafari,
        isChrome,
      );
    }
  };

  // Enhanced desktop printing handler
  const handleDesktopPrinting = async (printContent: HTMLElement) => {
    console.log("🖥️ Using enhanced desktop printing method");

    // Try direct browser print first
    try {
      const printWindow = window.open(
        "",
        "_blank",
        "width=800,height=600,scrollbars=yes,resizable=yes",
      );
      if (printWindow) {
        const printHTML = generatePrintHTML(printContent, false);
        printWindow.document.write(printHTML);
        printWindow.document.close();

        // Wait for content to load then print
        printWindow.onload = () => {
          setTimeout(() => {
            try {
              printWindow.print();
              printWindow.close();

              setTimeout(() => {
                console.log("🖨️ Desktop print completed, closing modal");
                onClose();

                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("printCompleted", {
                      detail: { closeAllModals: true, refreshData: true },
                    }),
                  );
                }
              }, 1000);
            } catch (printError) {
              console.log("⚠️ Direct print failed, offering download option");
              printWindow.close();
              // Fallback to download
              downloadReceiptFile(printContent, false, false);
            }
          }, 500);
        };

        // Handle print window errors
        printWindow.onerror = () => {
          console.log("⚠️ Print window error, offering download option");
          printWindow.close();
          downloadReceiptFile(printContent, false, false);
        };
      } else {
        // Popup blocked, offer download
        alert("Popup bị chặn. Sẽ tải file hóa đơn để bạn có thể in.");
        downloadReceiptFile(printContent, false, false);
      }
    } catch (error) {
      console.error("Desktop printing error:", error);
      downloadReceiptFile(printContent, false, false);
    }
  };

  // Generate optimized print HTML
  const generatePrintHTML = (printContent: HTMLElement, isMobile: boolean) => {
    // Get clean HTML content and ensure consistent formatting
    let cleanContent = printContent.innerHTML;

    // Ensure all numbers are properly formatted for printing
    cleanContent = cleanContent.replace(
      /(\d{1,3}(?:\.\d{3})*) ₫/g,
      (match, number) => {
        return `${number} ₫`;
      },
    );

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=576px, initial-scale=1.0">
        <title>Hóa đơn - ${receipt?.transactionId || "HĐ"}</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR&display=swap">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Noto Sans KR', 'Arial Unicode MS', sans-serif;
            font-size: 24px;
            line-height: 1.4;
            width: 100%;
            max-width: 576px;
            margin: 0 auto;
            padding: 0;
            background: #ffffff;
            color: #000000;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
          }

          th, td {
            padding: 4px 2px;
            text-align: left;
            vertical-align: top;
          }

          th {
            font-weight: bold;
            border-bottom: 1px dashed #000;
          }

          .center {
            text-align: center;
          }
          .right {
            text-align: right;
          }
          p, div, span {
            font-size: 16px !important;
          }
          h2 {
            font-size: 20px !important;
            font-weight: bold !important;
          }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .text-left { text-align: left !important; }
          .font-bold { font-weight: bold !important; }
          .font-semibold { font-weight: 400 !important; }
          .text-blue-600 { color: #000 !important; }
          .text-green-800 { color: #000 !important; }
          .text-red-600 { color: #000 !important; }
          .text-gray-600 { color: #000 !important; }
          .border-t { border-top: 1px dashed #000; margin: 8px 0; padding-top: 8px; }
          .border-b { border-bottom: 1px dashed #000; margin: 8px 0; padding-bottom: 8px; }
          .border-gray-300 { border-color: #d1d5db; }
          .flex { 
            display: flex !important; 
            justify-content: space-between !important; 
            align-items: center !important; 
          }
          .flex-1 { flex: 1 !important; }
          .justify-between { justify-content: space-between !important; }
          .items-center { align-items: center !important; }
          .space-y-1 > * + * { margin-top: 2px !important; }
          .space-y-2 > * + * { margin-top: 4px !important; }
          .mb-0 { margin-bottom: 0 !important; }
          .mb-1 { margin-bottom: 2px !important; }
          .mb-2 { margin-bottom: 4px !important; }
          .mb-3 { margin-bottom: 6px !important; }
          .mb-4 { margin-bottom: 8px !important; }
          .py-1 { padding: 2px 0 !important; }
          .py-2 { padding: 4px 0 !important; }
          .py-3 { padding: 6px 0 !important; }
          .pt-3 { padding-top: 6px !important; }

          .receipt-container { 
            width: 100%;
            max-width: 576px;
            margin: 0 auto;
            padding: 16px;
            box-sizing: border-box;
            background: #ffffff;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          ${cleanContent}
        </div>
      </body>
      </html>
    `;
  };

  // Enhanced download receipt file function - generates PDF
  const downloadReceiptFile = async (
    printContent: HTMLElement,
    isIOS: boolean,
    isAndroid: boolean,
  ) => {
    try {
      console.log("📄 Generating PDF for receipt download");

      // Create a new window for PDF generation
      const printWindow = window.open("", "_blank", "width=400,height=600");
      if (!printWindow) {
        throw new Error("Popup blocked - cannot generate PDF");
      }

      const cleanReceiptHTML = generatePrintHTML(printContent, true);
      printWindow.document.write(cleanReceiptHTML);
      printWindow.document.close();

      // Wait for content to load then trigger print to PDF
      await new Promise((resolve) => {
        printWindow.onload = () => {
          setTimeout(() => {
            try {
              // Trigger print dialog which allows saving as PDF
              printWindow.print();

              // Instructions for saving as PDF
              const pdfInstructions = isIOS
                ? "✅ Hộp thoại in đã mở!\n\nĐể lưu thành PDF:\n1. Trong hộp thoại in, chọn destination\n2. Chọn 'Save as PDF' hoặc 'Lưu thành PDF'\n3. Nhấn Save để tải file PDF"
                : isAndroid
                  ? "✅ Hộp thoại in đã mở!\n\nĐể lưu thành PDF:\n1. Trong hộp thoại in, chọn máy in\n2. Chọn 'Save as PDF' hoặc 'Lưu thành PDF'\n3. Nhấn Print để tải file PDF"
                  : "✅ Hộp thoại in đã mở!\n\nĐể lưu thành PDF:\n1. Trong hộp thoại in, chọn destination/máy in\n2. Chọn 'Save as PDF' hoặc 'Microsoft Print to PDF'\n3. Nhấn Save/Print để tải file PDF";

              alert(pdfInstructions);

              // Auto close after delay
              setTimeout(() => {
                if (!printWindow.closed) {
                  printWindow.close();
                }
                onClose();
              }, 3000);

              resolve(true);
            } catch (printError) {
              console.error("PDF generation error:", printError);
              printWindow.close();
              throw printError;
            }
          }, 1000);
        };
      });
    } catch (error) {
      console.error("❌ PDF generation failed:", error);

      // Fallback to HTML download if PDF generation fails
      console.log("🔄 Falling back to HTML download");
      const cleanReceiptHTML = generatePrintHTML(printContent, true);
      const blob = new Blob([cleanReceiptHTML], {
        type: "text/html;charset=utf-8",
      });
      const fileName = `hoa-don-${receipt?.transactionId || Date.now()}.html`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => {
        const fallbackInstructions =
          "⚠️ Không thể tạo PDF, đã tải file HTML thay thế.\n\nĐể chuyển thành PDF:\n1. Mở file HTML vừa tải\n2. Nhấn Ctrl+P (hoặc Cmd+P trên Mac)\n3. Chọn 'Save as PDF' trong hộp thoại in\n4. Nhấn Save để lưu file PDF";
        alert(fallbackInstructions);
        onClose();
      }, 500);
    }
  };

  // Enhanced browser print dialog function
  const openBrowserPrintDialog = async (
    printContent: HTMLElement,
    isIOS: boolean,
    isAndroid: boolean,
    isSafari: boolean,
    isChrome: boolean,
  ) => {
    const windowFeatures = isAndroid
      ? "width=400,height=600,scrollbars=yes,resizable=yes"
      : isIOS
        ? "width=375,height=667,scrollbars=yes,resizable=yes"
        : "width=400,height=600,scrollbars=yes";

    const printWindow = window.open("", "_blank", windowFeatures);

    if (printWindow) {
      const printHTML = generatePrintHTML(printContent, true);
      printWindow.document.write(printHTML);
      printWindow.document.close();

      // Platform-specific print handling
      const printDelay = isIOS ? 2000 : isAndroid ? 1500 : 1000;

      setTimeout(() => {
        try {
          printWindow.print();

          // Auto close handling
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
            onClose();
          }, printDelay);
        } catch (e) {
          const browserTip = isSafari
            ? "Vui lòng sử dụng menu Safari → Share → Print"
            : isChrome
              ? "Vui lòng s   dụng menu Chrome (⋮) → Print"
              : "Vui lòng sử dụng menu trình duyệt để in";

          alert(browserTip);
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
            onClose();
          }, 500);
        }
      }, printDelay);
    } else {
      alert(
        "Không thể mở cửa sổ in. Popup có thể bị chặn.\nSẽ tải file để bạn có thể in.",
      );
      downloadReceiptFile(printContent, isIOS, isAndroid);
    }
  };

  const handleDesktopPrint = (printContent: HTMLElement) => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt</title>
            <style>
              body {
                font-family: tahoma;
                font-size: 14px;
                font-weight: bold;
                margin: 0;
                padding: 15px;
                background: white;
                color: black;
                width: 280px;
              }
              .receipt-container {
                width: 100%;
                margin: 0 auto;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-left { text-align: left; }
              .font-bold { font-weight: bold; }
              .text-blue-600 { color: #2563eb; }
              .text-green-800 { color: #166534; }
              .text-red-600 { color: #dc2626; }
              .text-gray-600 { color: #4b5563; }
              .border-t { border-top: 1px solid #000; margin: 8px 0; padding-top: 8px; }
              .border-b { border-bottom: 1px solid #000; margin: 8px 0; padding-bottom: 8px; }
              .border-gray-300 { border-color: #d1d5db; }
              .flex { display: flex; justify-content: space-between; align-items: center; }
              .flex-1 { flex: 1; }
              .justify-between { justify-content: space-between; }
              .items-center { align-items: center; }
              .space-y-1 > * + * { margin-top: 2px; }
              .space-y-2 > * + * { margin-top: 4px; }
              .mb-1 { margin-bottom: 2px; }
              .mb-2 { margin-bottom: 4px; }
              .mb-3 { margin-bottom: 6px; }
              .mb-4 { margin-bottom: 8px; }
              .py-1 { padding: 2px 0; }
              .py-2 { padding: 4px 0; }
              .py-3 { padding: 6px 0; }
              .pt-3 { padding-top: 6px; }
              img { max-width: 80px; height: auto; display: block; margin: 0 auto; }
              @media print {
                body { 
                  margin: 0; 
                  padding: 10px;
                  font-size: 14px;
                  font-weight: bold;
                  width: 280px;
                }
                .receipt-container { width: 100%; }
                .text-blue-600 { color: #000 !important; }
                .text-green-800 { color: #000 !important; }
                .text-red-600 { color: #000 !important; }
                .text-gray-600 { color: #666 !important; }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();

      // Wait for images to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();

          // Auto close after print and refresh data
          setTimeout(() => {
            console.log(
              "🖨️ Receipt Modal: Auto-closing after print and refreshing data",
            );

            onClose();

            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("printCompleted", {
                  detail: { closeAllModals: true, refreshData: true },
                }),
              );
              window.dispatchEvent(
                new CustomEvent("refreshOrders", {
                  detail: { immediate: true },
                }),
              );
              window.dispatchEvent(
                new CustomEvent("refreshTables", {
                  detail: { immediate: true },
                }),
              );
            }
          }, 1000);
        }, 500);
      };

      // Close modal immediately after opening print window
      setTimeout(() => {
        console.log("🖨️ Closing receipt modal immediately after print");
        onClose();
      }, 50);
    }
  };

  const handleEmail = () => {
    // Mock email functionality
    alert("Email functionality would be implemented here");
  };

  const handleConfirmAndSelectPayment = () => {
    console.log(
      "📄 Receipt Modal: Confirming receipt and proceeding to payment method selection",
    );

    // Prepare complete order data with exact values
    const orderDataForPayment = {
      ...receipt,
      items:
        receipt?.items ||
        cartItems.map((item: any) => ({
          id: item.id,
          productId: item.productId || item.id,
          productName: item.productName || item.name,
          sku:
            item.sku ||
            `FOOD${String(item.productId || item.id).padStart(5, "0")}`,
          quantity: item.quantity,
          price: parseFloat(item.price || item.unitPrice || "0"),
          unitPrice: parseFloat(item.unitPrice || item.price || "0"),
          discount: parseFloat(item.discount || "0"),
          taxRate: parseFloat(item.taxRate || "0"),
          total:
            parseFloat(item.price || item.unitPrice || "0") * item.quantity -
            parseFloat(item.discount || "0"),
        })),
      exactSubtotal:
        receipt?.exactSubtotal || parseFloat(receipt?.subtotal || "0"),
      exactTax: receipt?.exactTax || parseFloat(receipt?.tax || "0"),
      exactDiscount:
        receipt?.exactDiscount || parseFloat(receipt?.discount || "0"),
      exactTotal:
        receipt?.exactTotal || parseFloat(receipt?.total || "0") || total,
    };

    console.log("🎯 Complete order data being passed:", orderDataForPayment);

    // Store in window for parent component to access
    if (typeof window !== "undefined") {
      (window as any).orderForPayment = orderDataForPayment;
    }

    // Close preview modal first
    onClose();

    // Call onConfirm with order data if provided
    if (onConfirm) {
      console.log(
        "📄 Receipt Modal: Calling onConfirm callback with order data",
      );
      onConfirm(orderDataForPayment);
    }
  };

  // Placeholder for handlePaymentMethodSelect, assuming it's defined elsewhere or in a parent component
  const handlePaymentMethodSelect = (method: string) => {
    console.log("Selected payment method:", method);
    // Logic to handle payment method selection, potentially opening e-invoice modal
  };

  // If receipt is null but isPreview is true, we still render the modal structure but without receipt data
  // This case is handled by the check below, which will render a message if receipt is null.
  // We only return null if !isOpen
  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    console.log(
      "🔴 Receipt Modal: handleClose called - mode:",
      isPreview ? "PREVIEW" : "FINAL",
    );

    if (!isPreview) {
      window.dispatchEvent(
        new CustomEvent("printCompleted", {
          detail: { closeAllModals: true, refreshData: !isPreview },
        }),
      );
    }

    // Call onClose callback
    onClose();
  };

  // Use stored values directly from receipt data
  const calculateSubtotal = () => {
    return Math.floor(parseFloat(receipt?.subtotal || "0"));
  };

  const calculateTax = () => {
    return Math.floor(parseFloat(receipt?.tax || "0"));
  };

  const calculateTotal = () => {
    return Math.floor(parseFloat(receipt?.total || "0"));
  };

  // Always render the Dialog component, let it handle the open state
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isPreview ? t("pos.receiptPreview") : t("pos.receipt")}
          </DialogTitle>
        </DialogHeader>

        {hasValidData ? (
          <div
            id="receipt-content"
            className="receipt-print bg-white"
            style={{
              width: "100%",
              maxWidth: "100%",
              padding: "16px",
              fontSize: "16px",
              margin: "0 auto",
              boxSizing: "border-box",
              backgroundColor: "#ffffff",
            }}
          >
            {/* Header - Store Info */}
            <div
              className="text-left mb-3"
              style={{
                fontSize: "16px",
                lineHeight: "1.4",
              }}
            >
              <h3 className="text-center mb-1 font-bold">
                GIẶT SẤY WASH FRIENDS
              </h3>
              <p className="text-center font-bold mb-0">
                {t("common.branch")}: {storeSettings?.storeName || ""}
              </p>
              <p className="text-center mb-0">
                {t("common.storeAddress")}: {storeSettings?.address || ""}
              </p>
              <p className="text-center mb-0">
                {t("common.storePhone")}: {storeSettings?.phone || ""}
              </p>
            </div>

            {/* Title */}
            <div className="text-center mb-3">
              <h2
                className="font-bold"
                style={{
                  fontSize: "20px",
                  textTransform: "uppercase",
                  margin: "0",
                  fontWeight: "bold",
                }}
              >
                {title}
              </h2>
            </div>

            {/* Invoice Info - Using Table */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "8px",
                fontSize: "16px",
              }}
            >
              <tbody>
                <tr>
                  <td style={{ padding: "2px 0" }}>{t("common.invoiceNo")}:</td>
                  <td style={{ padding: "2px 0", textAlign: "right" }}>
                    {receipt?.orderNumber || `ORD-${receipt?.id}`}
                  </td>
                </tr>
                {storeSettings?.businessType !== "laundry" && (
                  <tr>
                    <td style={{ padding: "2px 0" }}>{t("common.table")}:</td>
                    <td style={{ padding: "2px 0", textAlign: "right" }}>
                      {tableInfo?.tableNumber || receipt?.tableNumber || "-"}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "2px 0" }}>
                    {t("common.receiptTime")}:
                  </td>
                  <td style={{ padding: "2px 0", textAlign: "right" }}>
                    {new Date().toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
                {storeSettings?.businessType === "laundry" ? (
                  <>
                    <tr>
                      <td
                        style={{
                          padding: "2px 0",
                          width: "45%",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t("common.customerNameLabel")}:
                      </td>
                      <td
                        style={{
                          padding: "2px 0",
                          textAlign: "right",
                          width: "55%",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {receipt?.customerName || ""}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: "2px 0",
                          width: "45%",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t("common.customerPhoneLabel")}:
                      </td>
                      <td
                        style={{
                          padding: "2px 0",
                          textAlign: "right",
                          width: "55%",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {receipt?.customerPhone || receipt?.phone || "-"}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "2px 0" }}>
                        {t("customers.address")}:
                      </td>
                      <td style={{ padding: "2px 0", textAlign: "right" }}>
                        {receipt.customerTaxCode}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td style={{ padding: "2px 0" }}>{t("common.cashier")}:</td>
                    <td style={{ padding: "2px 0", textAlign: "right" }}>
                      {receipt?.cashierName || ""}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Divider */}
            <div
              style={{ borderTop: "1px dashed #000", margin: "8px 0" }}
            ></div>

            {/* Items List - Using HTML Table */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "8px",
                fontSize: "16px",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "4px 2px",
                      borderBottom: "1px dashed #000",
                    }}
                  >
                    {t("common.unitPrice")}
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "4px 2px",
                      borderBottom: "1px dashed #000",
                      width: "60px",
                    }}
                  >
                    {t("common.qty")}
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "4px 2px",
                      borderBottom: "1px dashed #000",
                      width: "100px",
                    }}
                  >
                    {t("common.lineTotal")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(receipt.items || []).map((item, index) => {
                  const unitPrice = parseFloat(
                    item.unitPrice || item.price || "0",
                  );
                  const quantity = parseFloat(item.quantity || "1");
                  const itemSubtotal = unitPrice * quantity;

                  return (
                    <>
                      <tr key={item.id || index}>
                        <td
                          style={{
                            padding: "4px 2px",
                            verticalAlign: "top",
                            textAlign: "justify",
                          }}
                          colspan={3}
                        >
                          {item.productName || item.name}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: "4px 2px",
                            verticalAlign: "top",
                          }}
                        >
                          {Math.floor(unitPrice).toLocaleString("vi-VN")}
                        </td>
                        <td
                          style={{
                            padding: "4px 2px",
                            textAlign: "center",
                            verticalAlign: "top",
                          }}
                        >
                          {quantity.toLocaleString("vi-VN")}
                        </td>
                        <td
                          style={{
                            padding: "4px 2px",
                            textAlign: "right",
                            verticalAlign: "top",
                          }}
                        >
                          {Math.floor(itemSubtotal).toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>

            {/* Divider */}
            <div
              style={{ borderTop: "1px dashed #000", margin: "8px 0" }}
            ></div>

            {/* Summary */}
            <table
              style={{
                width: "100%",
                marginBottom: "8px",
                fontSize: "16px",
              }}
            >
              <tbody>
                <tr>
                  <td style={{ padding: "2px 0" }}>
                    {t("common.totalBeforeDiscount")}:
                  </td>
                  <td style={{ padding: "2px 0", textAlign: "right" }}>
                    {(() => {
                      const itemsSubtotal = (receipt.items || []).reduce(
                        (sum, item) => {
                          const unitPrice = parseFloat(
                            item.unitPrice || item.price || "0",
                          );
                          const quantity = item.quantity || 1;
                          return sum + unitPrice * quantity;
                        },
                        0,
                      );
                      return Math.floor(itemsSubtotal).toLocaleString("vi-VN");
                    })()}
                  </td>
                </tr>

                {(() => {
                  const totalItemDiscount = (receipt.items || []).reduce(
                    (sum, item) => {
                      return sum + parseFloat(item.discount || "0");
                    },
                    0,
                  );
                  const orderDiscount = parseFloat(receipt.discount || "0");
                  const totalDiscount =
                    orderDiscount > 0 ? orderDiscount : totalItemDiscount;
                  return totalDiscount > 0 ? (
                    <tr>
                      <td style={{ padding: "2px 0" }}>
                        {t("common.discountLabel")}:
                      </td>
                      <td style={{ padding: "2px 0", textAlign: "right" }}>
                        {Math.floor(totalDiscount).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ) : null;
                })()}

                {(() => {
                  const priceIncludeTax =
                    receipt.priceIncludeTax ??
                    storeSettings?.priceIncludesTax ??
                    false;
                  const taxGroups = (receipt.items || []).reduce(
                    (groups, item) => {
                      const taxRate = parseFloat(
                        item.taxRate || item.product?.taxRate || "0",
                      );
                      const itemTaxFromDB = parseFloat(item.tax || "0");

                      if (taxRate > 0) {
                        if (!groups[taxRate]) groups[taxRate] = 0;

                        if (itemTaxFromDB > 0) {
                          groups[taxRate] += itemTaxFromDB;
                        } else {
                          const unitPrice = parseFloat(
                            item.unitPrice || item.price || "0",
                          );
                          const quantity = item.quantity || 1;
                          const itemDiscount = parseFloat(item.discount || "0");
                          const itemSubtotal = unitPrice * quantity;
                          const priceAfterDiscount =
                            itemSubtotal - itemDiscount;

                          const itemTax = priceIncludeTax
                            ? priceAfterDiscount * (taxRate / (100 + taxRate))
                            : priceAfterDiscount * (taxRate / 100);
                          groups[taxRate] += itemTax;
                        }
                      }
                      return groups;
                    },
                    {} as Record<number, number>,
                  );

                  const sortedTaxRates = Object.keys(taxGroups)
                    .map(Number)
                    .filter((taxRate) => taxRate > 0 && taxGroups[taxRate] > 0)
                    .sort((a, b) => b - a);

                  return sortedTaxRates.map((taxRate) => (
                    <tr key={taxRate}>
                      <td style={{ padding: "2px 0" }}>
                        {t("common.tax")} ({taxRate}%):
                      </td>
                      <td style={{ padding: "2px 0", textAlign: "right" }}>
                        {Math.floor(taxGroups[taxRate]).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ));
                })()}

                <tr>
                  <td
                    style={{
                      padding: "4px 0",
                      fontSize: "18px",
                      fontWeight: "bold",
                      borderTop: "1px dashed #000",
                    }}
                  >
                    {t("common.finalTotal")}:
                  </td>
                  <td
                    style={{
                      padding: "4px 0",
                      fontSize: "18px",
                      fontWeight: "bold",
                      textAlign: "right",
                      borderTop: "1px dashed #000",
                    }}
                  >
                    {Math.floor(
                      parseFloat(receipt.total || "0"),
                    ).toLocaleString("vi-VN")}
                  </td>
                </tr>
              </tbody>
            </table>

            <div
              style={{ borderTop: "1px dashed #000", margin: "8px 0" }}
            ></div>
            {domainName !== "0108670987-008.edpos.vn" ? (
              <div
                style={{
                  fontSize: "12px",
                  margin: "8px 0",
                  fontWeight: "normal",
                  lineHeight: "1.6",
                }}
              >
                {domainName != "0108670987-004.edpos.vn" && (
                  <p style={{ margin: "4px 0" }}>
                    Quý khách nhận được hàng vui lòng kiểm tra đồ giặt, sau 24
                    giờ kể từ khi giao hàng cửa hàng không chịu trách nhiệm các
                    vấn đề phát sinh sau đó. Các vấn đề phát sinh sau khi dịch
                    vụ tại cửa hàng sẽ được giải quyết dựa trên 「Tiêu chuẩn
                    giải quyết khiếu nại khách hàng
                  </p>
                )}
                <p style={{ margin: "4px 0", fontStyle: "italic" }}>
                  If you receive the goods, please check the laundry, after 24
                  hours of delivery, the store is not responsible for problems
                  arising afterwards. For problems that occur after using the
                  service at this store, we will compensate you according to the
                  compensation ratio of 「Consumer Dispute Resolution Standards.
                </p>
                {domainName != "0108670987-004.edpos.vn" && (
                  <p style={{ margin: "4px 0" }}>
                    세탁물 수령후 세탁확인 바랍니다. 수령 후 24시간이후에 문제
                    제기시 매장에서 책임지지 않습니다. 본 매장에서 서비스를
                    이용하신 후 발생한 문제에 대해서는 「소비자분쟁해결기준」
                    배상비율에 따라 배상해드립니다.
                  </p>
                )}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "12px",
                  margin: "8px 0",
                  fontWeight: "normal",
                  lineHeight: "1.6",
                }}
              >
                <p style={{ margin: "4px 0" }}>
                  - Quý khách nhận được hàng vui lòng kiểm tra đồ giặt, sau 24
                  giờ kể từ khi giao hàng cửa hàng không chịu trách nhiệm các
                  vấn đề phát sinh sau đó.
                </p>
                <p style={{ margin: "4px 0", fontStyle: "italic" }}>
                  - If you receive the goods, please check the laundry, after 24
                  hours of delivery, the store is not responsible for problems
                  arising afterwards.
                </p>
                <p style={{ margin: "4px 0" }}>
                  -세탁물 수령후 세탁확인 바랍니다. 수령 후 24시간이후에 문제
                  제기시 매장에서 책임지지 않습니다
                </p>
              </div>
            )}

            {/* QR Code - Bank Transfer */}
            {domainName !== "0108670987-008.edpos.vn" && (
              <>
                <div
                  style={{ borderTop: "1px dashed #000", margin: "8px 0" }}
                ></div>
                <div className="text-center my-4">
                  <div
                    style={{
                      width: "300px",
                      height: "300px",
                      margin: "0 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={(() => {
                        // Generate VietQR URL with bank account info from store settings
                        const bankId = bankAccounts?.bankId; // Shinhan Bank as default
                        const accountNo = bankAccounts?.bankAccountNo;
                        const accountName = bankAccounts?.bankAccountName;
                        const amount = Math.floor(
                          parseFloat(receipt.total || "0"),
                        );
                        const description = `THANH TOAN ${receipt.orderNumber}`;

                        // VietQR format - using VietQR API
                        const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.jpg?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;

                        return qrUrl;
                      })()}
                      alt="QR Code thanh toán"
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        margin: "0 auto",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div style={{ borderTop: "1px dashed #000", paddingTop: "8px" }}>
              <p
                className="text-center"
                style={{
                  fontSize: "16px",
                  margin: "4px 0",
                }}
              >
                {t("pos.thankYouAndComeAgain")}
              </p>
              <p
                className="text-center"
                style={{
                  fontSize: "14px",
                  margin: "4px 0",
                }}
              >
                {t("pos.thankYou")}
              </p>
            </div>
          </div>
        ) : isPreview && hasCartData && total > 0 ? (
          // Generate preview receipt from cartItems when in preview mode
          <div
            id="receipt-content"
            className="receipt-print bg-white"
            style={{ padding: "16px", fontSize: "16px", fontWeight: "bold" }}
          >
            <div className="text-center mb-4">
              <p className="text-xs font-semibold mb-1">
                {storeSettings?.storeName ||
                  "Easy Digital Point Of Sale Service"}
              </p>
              <p className="text-xs mb-0.5">{t("pos.mainStoreLocation")}</p>
              <p className="text-xs mb-0.5">
                {storeSettings?.address || "123 Commerce St, City, State 12345"}
              </p>
              <p className="text-xs mb-2">
                {t("pos.phone")} {storeSettings?.phone || "(555) 123-4567"}
              </p>
              <div className="flex items-center justify-center">
                <img src={logoPath} alt="EDPOS Logo" className="h-6" />
              </div>
              <p className="text-lg mb-2 invoice_title">{title}</p>
            </div>

            <div className="border-t border-b border-gray-300 py-3 mb-3">
              <div className="flex justify-between text-sm">
                <span>{t("pos.transactionNumber")}</span>
                <span>PREVIEW-{Date.now()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("pos.date")}</span>
                <span>{new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("pos.cashier")}</span>
                <span>Nhân viên</span>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              {cartItems.map((item, index) => {
                const unitPrice =
                  typeof item.price === "string"
                    ? parseFloat(item.price)
                    : item.price;
                const quantity = item.quantity;
                const itemSubtotal = unitPrice * quantity;

                // Calculate item discount from order-level discount (proportional distribution)
                let itemDiscount = 0;
                const orderDiscount = parseFloat(
                  receipt?.discount || total?.discount || "0",
                );

                if (orderDiscount > 0) {
                  const totalBeforeDiscount = cartItems.reduce((sum, itm) => {
                    const price =
                      typeof itm.price === "string"
                        ? parseFloat(itm.price)
                        : itm.price;
                    return sum + price * itm.quantity;
                  }, 0);

                  // For last item, use remaining discount to avoid rounding errors
                  if (index === cartItems.length - 1) {
                    let previousDiscounts = 0;
                    for (let i = 0; i < cartItems.length - 1; i++) {
                      const prevItem = cartItems[i];
                      const prevPrice =
                        typeof prevItem.price === "string"
                          ? parseFloat(prevItem.price)
                          : prevItem.price;
                      const prevSubtotal = prevPrice * prevItem.quantity;
                      previousDiscounts +=
                        totalBeforeDiscount > 0
                          ? Math.round(
                              (orderDiscount * prevSubtotal) /
                                totalBeforeDiscount,
                            )
                          : 0;
                    }
                    itemDiscount = orderDiscount - previousDiscounts;
                  } else {
                    // Proportional discount for non-last items
                    itemDiscount =
                      totalBeforeDiscount > 0
                        ? Math.round(
                            (orderDiscount * itemSubtotal) /
                              totalBeforeDiscount,
                          )
                        : 0;
                  }
                }

                const itemFinalAmount = itemSubtotal - itemDiscount;

                console.log(`Preview Item ${index}:`, {
                  name: item.name,
                  unitPrice,
                  quantity,
                  itemDiscount,
                  itemSubtotal,
                  itemFinalAmount,
                  hasDiscount: itemDiscount > 0,
                });

                return (
                  <div key={item.id}>
                    <div className="flex justify-between text-sm">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-600">
                          SKU:{" "}
                          {item.sku ||
                            `FOOD${String(item.id).padStart(5, "0")}`}
                        </div>
                        <div className="text-xs text-gray-600">
                          {quantity} x {unitPrice.toLocaleString("vi-VN")} ₫
                        </div>
                        {itemDiscount > 0 && (
                          <div className="text-xs text-red-600 font-medium">
                            Giảm giá: -
                            {Math.round(itemDiscount).toLocaleString("vi-VN")} ₫
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600">
                          {Math.floor(itemSubtotal).toLocaleString("vi-VN")} ₫
                        </div>
                        {itemDiscount > 0 && (
                          <div className="text-xs font-medium text-green-600">
                            {Math.floor(itemFinalAmount).toLocaleString(
                              "vi-VN",
                            )}{" "}
                            ₫
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-300 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>{t("pos.totalAmount")}</span>
                <span>
                  {(() => {
                    // Calculate subtotal as sum of unit price * quantity for all items (before discount)
                    const itemsSubtotal = (receipt.items || []).reduce(
                      (sum, item) => {
                        const unitPrice = parseFloat(
                          item.unitPrice || item.price || "0",
                        );
                        const quantity = item.quantity || 1;
                        return sum + unitPrice * quantity;
                      },
                      0,
                    );
                    return Math.floor(itemsSubtotal).toLocaleString("vi-VN");
                  })()}{" "}
                  ₫
                </span>
              </div>
              {(() => {
                // Group cart items by tax rate and calculate tax for each group
                const taxGroups = cartItems.reduce(
                  (groups, item) => {
                    const taxRate = parseFloat(
                      item.taxRate || item.product?.taxRate || "0",
                    );
                    const unitPrice =
                      typeof item.price === "string"
                        ? parseFloat(item.price)
                        : item.price;
                    const quantity = item.quantity;
                    const itemSubtotal = unitPrice * quantity;

                    // Calculate item discount from order-level discount (proportional distribution)
                    let itemDiscount = 0;
                    const orderDiscount = parseFloat(
                      receipt?.discount || total?.discount || "0",
                    );

                    if (orderDiscount > 0) {
                      const totalBeforeDiscount = cartItems.reduce(
                        (sum, itm) => {
                          const price =
                            typeof itm.price === "string"
                              ? parseFloat(itm.price)
                              : itm.price;
                          return sum + price * itm.quantity;
                        },
                        0,
                      );

                      const itemIndex = cartItems.indexOf(item);
                      if (itemIndex === cartItems.length - 1) {
                        let previousDiscounts = 0;
                        for (let i = 0; i < cartItems.length - 1; i++) {
                          const prevItem = cartItems[i];
                          const prevPrice =
                            typeof prevItem.price === "string"
                              ? parseFloat(prevItem.price)
                              : prevItem.price;
                          const prevSubtotal = prevPrice * prevItem.quantity;
                          previousDiscounts +=
                            totalBeforeDiscount > 0
                              ? Math.round(
                                  (orderDiscount * prevSubtotal) /
                                    totalBeforeDiscount,
                                )
                              : 0;
                        }
                        itemDiscount = orderDiscount - previousDiscounts;
                      } else {
                        itemDiscount =
                          totalBeforeDiscount > 0
                            ? Math.round(
                                (orderDiscount * itemSubtotal) /
                                  totalBeforeDiscount,
                              )
                            : 0;
                      }
                    }

                    const itemFinalAmount = itemSubtotal - itemDiscount;

                    // Calculate tax for this item based on its tax rate
                    const itemTax =
                      (itemFinalAmount * taxRate) / (100 + taxRate);

                    if (!groups[taxRate]) {
                      groups[taxRate] = 0;
                    }
                    groups[taxRate] += itemTax;

                    return groups;
                  },
                  {} as Record<number, number>,
                );

                // Sort tax rates in descending order and filter out 0% tax
                const sortedTaxRates = Object.keys(taxGroups)
                  .map(Number)
                  .filter((taxRate) => taxRate > 0) // Chỉ hiển thị thuế suất > 0%
                  .sort((a, b) => b - a);

                return sortedTaxRates.map((taxRate) => (
                  <div key={taxRate} className="flex justify-between text-sm">
                    <span>
                      {t("reports.tax")} ({taxRate}%):
                    </span>
                    <span>
                      {Math.floor(taxGroups[taxRate]).toLocaleString("vi-VN")} ₫
                    </span>
                  </div>
                ));
              })()}
              {(() => {
                // Calculate total discount from cart items only (no double counting)
                const totalItemDiscount = cartItems.reduce((sum, item) => {
                  return sum + parseFloat(item.discount || "0");
                }, 0);
                // Don't add order discount if item discounts exist (to avoid double counting)
                const orderDiscount = parseFloat(
                  receipt?.discount || total?.discount || "0",
                );
                const totalDiscount =
                  orderDiscount > 0 ? orderDiscount : totalItemDiscount;
                return totalDiscount > 0;
              })() && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>{t("reports.discount")}:</span>
                  <span className="font-medium">
                    -
                    {(() => {
                      const totalItemDiscount = cartItems.reduce(
                        (sum, item) => {
                          return sum + parseFloat(item.discount || "0");
                        },
                        0,
                      );
                      const orderDiscount = parseFloat(
                        receipt?.discount || total?.discount || "0",
                      );
                      // Show either item discounts or order discount, not both
                      const totalDiscount =
                        orderDiscount > 0 ? orderDiscount : totalItemDiscount;
                      return Math.floor(totalDiscount).toLocaleString("vi-VN");
                    })()}{" "}
                    ₫
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>{t("reports.totalMoney")}:</span>
                <span>
                  {Number(
                    receipt?.total || total?.total || total || 0,
                  ).toLocaleString("vi-VN")}{" "}
                  ₫
                </span>
              </div>
            </div>
          </div>
        ) : (
          // Fallback content - should not reach here due to validation above
          <div className="p-4 text-center">
            <p>Đang tải dữ liệu hóa đơn...</p>
            <Button onClick={onClose} className="mt-4">
              {t("reports.close")}
            </Button>
          </div>
        )}

        <div className="flex justify-center p-2 border-t">
          {isPreview ? (
            <div className="flex space-x-3 w-full">
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1"
              >
                {t("pos.cancel")}
              </Button>
              <Button
                onClick={handleConfirmAndSelectPayment}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
              >
                {t("pos.confirmAndSelectPayment")}
              </Button>
            </div>
          ) : (
            <div className="flex justify-center space-x-3">
              <Button
                onClick={() => {
                  if (printers?.length > 0) {
                    handleGetPrint();
                  } else {
                    handlePrint(); // First print
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200"
              >
                <Printer className="mr-2" size={16} />
                {t("pos.printReceipt")}
              </Button>
              <Button onClick={handleClose} variant="outline" className="ml-2">
                {t("common.close")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Payment Method Modal */}
      {showPaymentMethodModal && (
        <PaymentMethodModal
          isOpen={showPaymentMethodModal}
          onClose={() => setShowPaymentMethodModal(false)}
          onSelectMethod={handlePaymentMethodSelect}
          total={
            receipt?.exactTotal ||
            parseFloat(receipt?.total || "0") ||
            total ||
            0
          }
          cartItems={receipt?.items || cartItems}
          orderForPayment={
            typeof window !== "undefined" && (window as any).orderForPayment
              ? (window as any).orderForPayment
              : {
                  id: receipt?.id,
                  orderNumber:
                    receipt?.orderNumber ||
                    receipt?.transactionId ||
                    `ORD-${Date.now()}`,
                  tableId: receipt?.tableId || null,
                  customerName: receipt?.customerName || "Khách hàng lẻ",
                  status: "pending",
                  paymentStatus: "pending",
                  items: receipt?.items || cartItems || [],
                  subtotal:
                    receipt?.exactSubtotal ||
                    parseFloat(receipt?.subtotal || "0"),
                  tax: receipt?.exactTax || parseFloat(receipt?.tax || "0"),
                  discount:
                    receipt?.exactDiscount ||
                    parseFloat(receipt?.discount || "0"),
                  total:
                    receipt?.exactTotal || parseFloat(receipt?.total || "0"),
                  exactSubtotal:
                    receipt?.exactSubtotal ||
                    parseFloat(receipt?.subtotal || "0"),
                  exactTax:
                    receipt?.exactTax || parseFloat(receipt?.tax || "0"),
                  exactDiscount:
                    receipt?.exactDiscount ||
                    parseFloat(receipt?.discount || "0"),
                  exactTotal:
                    receipt?.exactTotal || parseFloat(receipt?.total || "0"),
                  orderedAt: new Date().toISOString(),
                }
          }
          receipt={receipt}
          onReceiptReady={(receiptData) => {
            console.log("📋 Receipt ready from payment method:", receiptData);
          }}
        />
      )}
    </Dialog>
  );
}
