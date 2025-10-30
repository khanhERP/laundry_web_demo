import { useState, useEffect, useRef } from "react";
import {
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  QrCode,
  Keyboard,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import QRCodeLib from "qrcode";
import { createQRPosAsync, type CreateQRPosRequest } from "@/lib/api";
import { EInvoiceModal } from "./einvoice-modal";
import { ReceiptModal } from "./receipt-modal";
import { usePopupSignal } from "@/hooks/use-popup-signal";
import VirtualKeyboard from "@/components/ui/virtual-keyboard";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PrintDialog } from "./print-dialog"; // Assuming PrintDialog is in the same directory

// Helper function for API requests (assuming it exists and handles headers, etc.)
// If not, you'll need to implement it or use fetch directly like in the original code.
// For demonstration, let's assume a simple fetch wrapper.
async function apiRequest(method: string, url: string, body?: any) {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  };
  return fetch(url, options);
}

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (method: string, data?: any) => void;
  total: number;
  onShowEInvoice?: () => void;
  cartItems?: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    sku?: string;
    taxRate?: number;
    discount?: number;
    afterTaxPrice?: number | string | null | "";
  }>;
  orderForPayment?: any; // Add orderForPayment prop for exact values
  products?: any[]; // Add products prop for tax rate and afterTaxPrice lookup
  getProductName?: (productId: number | string) => string; // Add getProductName function
  receipt?: any; // Add receipt prop to receive exact total from receipt modal
  onReceiptReady?: (receiptData: any) => void; // Add callback for receipt ready
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  onSelectMethod,
  total,
  onShowEInvoice,
  cartItems = [],
  orderForPayment, // Receive orderForPayment prop
  products, // Receive products prop
  getProductName, // Receive getProductName function
  receipt, // Receive receipt prop
  onReceiptReady, // Receive receipt ready callback
}: PaymentMethodModalProps) {
  // CRITICAL DEBUG: Log all props when component mounts
  console.log(`🔍 PAYMENT MODAL PROPS DEBUG:`, {
    isOpen: isOpen,
    total: total,
    cartItems: cartItems?.length || 0,
    orderForPayment: orderForPayment,
    orderForPaymentId: orderForPayment?.id,
    orderForPaymentStatus: orderForPayment?.status,
    orderForPaymentTableId: orderForPayment?.tableId,
    receipt: receipt,
    products: products?.length || 0,
    timestamp: new Date().toISOString(),
  });

  // Query store settings to get dynamic address - ALWAYS CALL THIS HOOK
  const { data: storeSettings } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings");
      return response.json();
    },
    enabled: isOpen, // Only fetch when modal is open
  });

  // Get priceIncludesTax setting from store settings
  let priceIncludesTax = storeSettings?.priceIncludesTax === true;

  // State for multiple payment methods
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<
    Array<{
      method: string;
      amount: number;
    }>
  >([]);
  const [showMultiPayment, setShowMultiPayment] = useState(false);

  // Validate orderForPayment exists or create fallback order info
  const orderInfo = orderForPayment || {
    id: `temp-${Date.now()}`,
    total: total || 0,
    subtotal: total || 0,
    tax: 0,
    items: cartItems || [],
  };

  // Log for debugging but don't block the modal
  if (!orderForPayment) {
    console.warn("⚠️ WARNING: orderForPayment is undefined, using fallback");
    console.log("🔍 Payment Modal Debug - Using fallback order:", {
      isOpen,
      total,
      cartItems: cartItems?.length,
      orderForPayment,
      orderInfo,
      receipt,
    });
  }

  if (!orderInfo.id) {
    console.error(`❌ PAYMENT MODAL: orderInfo.id is missing`, {
      orderInfo,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.log(`✅ PAYMENT MODAL: orderInfo is valid`, {
      id: orderInfo.id,
      status: orderInfo.status,
      tableId: orderInfo.tableId,
      total: orderInfo.total,
      timestamp: new Date().toISOString(),
    });
  }

  const { t } = useTranslation();
  const { toast } = useToast();
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [showEInvoice, setShowEInvoice] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [showCashPayment, setShowCashPayment] = useState(false);
  const [isShowTitle, setIsShowTitle] = useState(true); // Always true for invoice receipts
  const [currentTransactionUuid, setCurrentTransactionUuid] = useState<
    string | null
  >(null);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

  // Separate state for cash payment to avoid sharing with other screens
  const [cashAmountInput, setCashAmountInput] = useState("");

  const amountInputRef = useRef<HTMLInputElement>(null);
  const { listenForPaymentSuccess, removePaymentListener } = usePopupSignal();

  // CRITICAL: Add state for receipt modal and its data
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptDataForModal, setReceiptDataForModal] = useState<any>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false); // Add showPrintDialog state

  // Query payment methods from API
  const { data: paymentMethodsData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/payment-methods");
      return response.json();
    },
    enabled: isOpen, // Only fetch when modal is open
  });

  // Load payment methods from API
  const getPaymentMethods = () => {
    const paymentMethods = paymentMethodsData || [];

    console.log("All payment methods from API:", paymentMethods);

    // Filter to only return enabled payment methods and map to modal format
    const enabledMethods = paymentMethods
      .filter((method: any) => method.enabled === true)
      .map((method: any) => ({
        id: method.nameKey,
        name: getPaymentMethodName(method.nameKey),
        icon: getIconComponent(method.type),
        description: getMethodDescription(method.nameKey),
      }));

    console.log("Enabled payment methods:", enabledMethods);
    return enabledMethods;
  };

  const getIconComponent = (type: string) => {
    switch (type) {
      case "cash":
        return Banknote;
      case "card":
      case "debit":
      case "digital":
        return CreditCard;
      case "qr":
        return QrCode;
      default:
        return Wallet;
    }
  };

  const getPaymentMethodName = (nameKey: string) => {
    const names = {
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
    return (
      names[nameKey as keyof typeof names] || t("common.paymentMethodGeneric")
    );
  };

  const getMethodDescription = (nameKey: string) => {
    const descriptions = {
      cash: t("common.cash"),
      creditCard: t("common.visaMastercard"),
      debitCard: t("common.atmCard"),
      momo: t("common.momoWallet"),
      zalopay: t("common.zalopayWallet"),
      vnpay: t("common.vnpayWallet"),
      qrCode: t("common.qrBanking"),
      shopeepay: t("common.shopeepayWallet"),
      grabpay: t("common.grabpayWallet"),
    };
    return (
      descriptions[nameKey as keyof typeof descriptions] ||
      t("common.paymentMethodGeneric")
    );
  };

  const paymentMethods = getPaymentMethods();

  const handleSelect = async (method: string) => {
    console.log(`🚀 ========================================`);
    console.log(`🚀 HANDLESELECT FUNCTION ENTRY POINT`);
    console.log(`🚀 ========================================`);
    console.log(
      `🔥 HANDLESELECT FUNCTION CALLED - Method: ${method}, Order ID: ${orderInfo.id}`,
    );
    console.log(`🔍 onSelectMethod callback exists:`, !!onSelectMethod);

    // EARLY VALIDATION: Check if orderInfo exists and has an ID
    if (!orderInfo || !orderInfo.id) {
      console.error(`❌ CRITICAL ERROR: orderInfo is missing or has no ID`);
      alert("Lỗi: Không tìm thấy thông tin đơn hàng để thanh toán");
      return;
    }

    console.log(`✅ VALIDATION PASSED: orderInfo is valid`);
    setSelectedPaymentMethod(method);

    if (method === "cash") {
      console.log(`💰 CASH PAYMENT SELECTED - showing cash input form`);
      // Reset cash amount input when showing cash payment
      setCashAmountInput("");
      setAmountReceived("");
      // Show cash payment input form ONLY - do NOT update order status yet
      setShowCashPayment(true);
      console.log(
        `🔍 DEBUG: showCashPayment set to true, waiting for user input`,
      );
    } else if (method === "qrCode") {
      // Call CreateQRPos API for QR payment
      try {
        setQrLoading(true);
        const transactionUuid = `TXN-${Date.now()}`;

        // Use exact total with proper priority and discount consideration
        const baseTotal =
          receipt?.exactTotal ??
          orderForPayment?.exactTotal ??
          orderInfo?.exactTotal ??
          orderInfo?.total ??
          total ??
          0;

        // Get discount amount
        const discountAmount = Math.floor(
          parseFloat(receipt?.discount || orderForPayment?.discount || "0"),
        );

        // Calculate final total after discount
        let orderTotal;
        if (priceIncludesTax) {
          const subtotal =
            receipt?.exactSubtotal ??
            orderInfo?.exactSubtotal ??
            orderForPayment.subtotal ??
            0;
          const tax =
            receipt?.exactTax ??
            orderForPayment.tax ??
            orderInfo?.exactTax ??
            0;
          orderTotal = Math.max(
            0,
            parseFloat(subtotal || "0") -
              parseFloat(tax || "0") -
              discountAmount,
          );
        } else {
          orderTotal = Math.max(0, baseTotal - discountAmount);
        }

        const qrRequest: CreateQRPosRequest = {
          transactionUuid,
          depositAmt: orderTotal,
          posUniqueId: "HAN01",
          accntNo: "0900993023",
          posfranchiseeName: "DOOKI-HANOI",
          posCompanyName: "HYOJUNG",
          posBillNo: `BILL-${Date.now()}`,
        };

        const bankCode = "79616001";
        const clientID = "91a3a3668724e631e1baf4f8526524f3";

        console.log("Calling CreateQRPos API with:", {
          qrRequest,
          bankCode,
          clientID,
        });

        const qrResponse = await createQRPosAsync(
          qrRequest,
          bankCode,
          clientID,
        );

        console.log("CreateQRPos API response:", qrResponse);

        // Store transaction UUID for payment tracking
        setCurrentTransactionUuid(transactionUuid);

        // Listen for payment success notification
        listenForPaymentSuccess(transactionUuid, (success) => {
          if (success) {
            console.log(
              "Payment confirmed via WebSocket for transaction:",
              transactionUuid,
            );
            // Auto-complete the payment when notification is received
            handleQRComplete();
          }
        });

        // Generate QR code from the received QR data
        if (qrResponse.qrData) {
          console.log(
            "✅ Using actual QR data from CreateQRPos API:",
            qrResponse.qrData,
          );

          // Use the raw qrData directly - it's already in the correct format for VietQR
          const qrUrl = await QRCodeLib.toDataURL(qrResponse.qrData, {
            width: 256,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
          setQrCodeUrl(qrUrl);
          setShowQRCode(true);

          // Send QR payment info to customer display via WebSocket - ENHANCED VERSION
          const sendQRPaymentToDisplay = () => {
            try {
              const protocol =
                window.location.protocol === "https:" ? "wss:" : "ws:";
              const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
              console.log(
                "🎯 QR Payment: Connecting to WebSocket for customer display:",
                wsUrl,
              );

              const ws = new WebSocket(wsUrl);
              let connectionTimeout: NodeJS.Timeout;

              ws.onopen = () => {
                console.log("✅ QR Payment: WebSocket connected successfully");

                // Clear connection timeout since we're connected
                if (connectionTimeout) {
                  clearTimeout(connectionTimeout);
                }

                // Send QR payment message directly without registration delay
                const qrPaymentMessage = {
                  type: "qr_payment",
                  qrCodeUrl: qrUrl,
                  amount: Math.floor(orderTotal),
                  transactionUuid: transactionUuid,
                  paymentMethod: "QR Code",
                  timestamp: new Date().toISOString(),
                };

                console.log(
                  `📤 QR Payment: Sending message to customer display:`,
                  {
                    type: qrPaymentMessage.type,
                    amount: qrPaymentMessage.amount,
                    hasQrCodeUrl: !!qrPaymentMessage.qrCodeUrl,
                    qrCodeUrlLength: qrPaymentMessage.qrCodeUrl?.length || 0,
                    transactionUuid: qrPaymentMessage.transactionUuid,
                  },
                );

                try {
                  ws.send(JSON.stringify(qrPaymentMessage));
                  console.log(
                    "✅ QR Payment: Message sent successfully to customer display",
                  );

                  // Send a second confirmation message after a delay
                  setTimeout(() => {
                    const confirmationMessage = {
                      type: "qr_payment_confirmation",
                      originalMessage: qrPaymentMessage,
                      timestamp: new Date().toISOString(),
                    };

                    ws.send(JSON.stringify(confirmationMessage));
                    console.log("✅ QR Payment: Confirmation message sent");

                    // Close connection after confirmation
                    setTimeout(() => {
                      console.log(
                        "🔒 QR Payment: Closing WebSocket connection",
                      );
                      ws.close(1000, "QR payment sent successfully");
                    }, 500);
                  }, 500);
                } catch (sendError) {
                  console.error(
                    "❌ QR Payment: Error sending message:",
                    sendError,
                  );
                  ws.close();
                }
              };

              ws.onerror = (error) => {
                console.error("❌ QR Payment: WebSocket error:", error);
                if (connectionTimeout) {
                  clearTimeout(connectionTimeout);
                }
              };

              ws.onclose = (event) => {
                console.log("🔒 QR Payment: WebSocket closed", {
                  code: event.code,
                  reason: event.reason,
                  wasClean: event.wasClean,
                });

                if (connectionTimeout) {
                  clearTimeout(connectionTimeout);
                }
              };

              // Set connection timeout
              connectionTimeout = setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                  console.warn("⚠️ QR Payment: Connection timeout");
                  ws.close();
                }
              }, 5000);
            } catch (error) {
              console.error(
                "❌ QR Payment: Failed to create WebSocket connection:",
                error,
              );
            }
          };

          // Execute the function to send QR payment info
          console.log(
            "🚀 QR Payment: Starting QR payment transmission to customer display",
          );
          sendQRPaymentToDisplay();
        } else {
          console.error("No QR data received from API");
          // Fallback: try to use qrDataDecode if available
          const fallbackQrData =
            qrResponse.qrDataDecode ||
            `00020101021238630010A000000727013300069711330119NPIPIFPHAN0100004190208QRIBFTTA53037045408${Math.floor(orderTotal)}.005802VN6304`;
          console.log("📄 Using fallback QR data:", fallbackQrData);

          const qrUrl = await QRCodeLib.toDataURL(fallbackQrData, {
            width: 256,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
          setQrCodeUrl(qrUrl);
          setShowQRCode(true);

          // Send fallback QR payment info to customer display
          const sendFallbackQRPaymentToDisplay = () => {
            try {
              const protocol =
                window.location.protocol === "https:" ? "wss:" : "ws:";
              const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
              console.log(
                "Fallback QR Payment: Attempting to connect to WebSocket:",
                wsUrl,
              );

              const ws = new WebSocket(wsUrl);

              ws.onopen = () => {
                console.log(
                  "Fallback QR Payment: WebSocket connected successfully, sending QR payment info",
                );
                const fallbackMessage = {
                  type: "qr_payment",
                  qrCodeUrl: qrUrl,
                  amount: orderTotal,
                  transactionUuid: `FALLBACK-${Date.now()}`,
                  paymentMethod: "QR Code",
                  timestamp: new Date().toISOString(),
                };
                console.log(
                  "Fallback QR Payment: Sending message:",
                  fallbackMessage,
                );
                ws.send(JSON.stringify(fallbackMessage));
                console.log(
                  "Fallback QR Payment: QR payment info sent to customer display successfully",
                );

                setTimeout(() => {
                  ws.close();
                }, 2000);
              };

              ws.onerror = (error) => {
                console.error("Fallback QR Payment: WebSocket error:", error);
              };

              ws.onclose = (event) => {
                console.log("Fallback QR Payment: WebSocket closed", {
                  code: event.code,
                  reason: event.reason,
                  wasClean: event.wasClean,
                });
              };
            } catch (error) {
              console.error(
                "Fallback QR Payment: Failed to send QR payment info to customer display:",
                error,
              );
            }
          };

          // Call the function to send fallback QR payment info
          sendFallbackQRPaymentToDisplay();
        }
      } catch (error) {
        console.error("Error calling CreateQRPos API:", error);
        // Fallback to VietQR format on error
        try {
          // Get base values
          const exactSubtotal =
            receipt?.exactSubtotal ||
            orderInfo?.exactSubtotal ||
            parseFloat(receipt?.subtotal || "0") ||
            parseFloat(orderForPayment?.subtotal || "0") ||
            0;

          const exactTax =
            receipt?.exactTax ||
            (orderForPayment?.tax ??
              orderInfo?.exactTax ??
              parseFloat(receipt?.tax || "0") ??
              0);

          const discount = parseFloat(
            receipt?.discount || orderForPayment?.discount || "0",
          );

          let finalTotal;
          if (priceIncludesTax) {
            finalTotal = Math.max(0, exactSubtotal - exactTax - discount);
          } else {
            // When priceIncludesTax = false: total = subtotal + tax - discount
            finalTotal = Math.max(0, exactSubtotal + exactTax - discount);
          }
          // Generate a valid VietQR format string
          const fallbackQrData = `00020101021238630010A000000727013300069711330119NPIPIFPHAN0100004190208QRIBFTTA53037045408${Math.floor(finalTotal)}.005802VN6304`;
          console.log("📄 Using error fallback VietQR data:", fallbackQrData);

          const qrUrl = await QRCodeLib.toDataURL(fallbackQrData, {
            width: 256,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
          setQrCodeUrl(qrUrl);
          setShowQRCode(true);
        } catch (fallbackError) {
          console.error("Error generating fallback QR code:", fallbackError);
        }
      } finally {
        setQrLoading(false);
      }
    } else if (method === "vnpay") {
      // Generate QR code for VNPay
      try {
        setQrLoading(true);
        // Use exact total with proper priority and discount consideration for VNPay QR payment
        const baseTotal =
          receipt?.exactTotal ??
          orderForPayment?.exactTotal ??
          orderForPayment?.total ??
          orderInfo?.exactTotal ??
          orderInfo?.total ??
          total ??
          0;

        // Get discount amount from multiple sources
        let discountAmount = parseFloat(
          receipt?.discount || orderForPayment?.discount || "0",
        );
        // Add further logic for the payment
        if (discountAmount < 0) {
          discountAmount = 0; // Ensure discount is non-negative
        }

        // Calculate final total after discount
        let orderTotal;
        if (priceIncludesTax) {
          const subtotal =
            receipt?.exactSubtotal ??
            orderInfo?.exactSubtotal ??
            orderForPayment.subtotal ??
            0;
          const tax =
            receipt?.exactTax ??
            orderForPayment.tax ??
            orderInfo?.exactTax ??
            0;
          orderTotal = Math.max(
            0,
            parseFloat(subtotal || "0") -
              parseFloat(tax || "0") -
              discountAmount,
          );
        } else {
          orderTotal = Math.max(0, baseTotal - discountAmount);
        }

        const qrData = `Payment via ${method}\nAmount: ${Math.floor(orderTotal).toLocaleString("vi-VN")} ₫\nTime: ${new Date().toLocaleString("vi-VN")}`;
        const qrUrl = await QRCodeLib.toDataURL(qrData, {
          width: 256,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrCodeUrl(qrUrl);
        setShowQRCode(true);

        // Send VNPay QR payment info to customer display
        try {
          const protocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";
          const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
          const ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            console.log(
              "VNPay QR Payment: WebSocket connected, sending QR payment info",
            );
            ws.send(
              JSON.stringify({
                type: "qr_payment",
                qrCodeUrl: qrUrl,
                amount: orderTotal,
                transactionUuid: `VNPAY-${Date.now()}`,
                paymentMethod: "VNPay",
                timestamp: new Date().toISOString(),
              }),
            );
            console.log(
              "VNPay QR Payment: QR payment info sent to customer display",
            );
            setTimeout(() => {
              ws.close();
            }, 1000);
          };

          ws.onerror = (error) => {
            console.error("VNPay QR Payment: WebSocket error:", error);
          };

          ws.onclose = () => {
            console.log(
              "VNPay QR Payment: WebSocket closed after sending QR info",
            );
          };
        } catch (error) {
          console.error(
            "Failed to send VNPay QR payment info to customer display:",
            error,
          );
        }
      } catch (error) {
        console.error("Error generating QR code:", error);
      } finally {
        setQrLoading(false);
      }
    } else {
      // Check if this is a real order or temporary order
      const isTemporaryOrder = orderInfo.id.toString().startsWith("temp-");

      if (isTemporaryOrder) {
        console.log(`📝 Creating POS ${method} order`);

        // SỬ DỤNG TRỰC TIẾP DỮ LIỆU TỪ RECEIPT PREVIEW - KHÔNG TÍNH TOÁN LẠI
        const receiptSubtotal =
          receipt?.exactSubtotal || orderInfo?.exactSubtotal || 0;
        const receiptTax = receipt?.exactTax || orderInfo?.exactTax || 0;
        const receiptTotal = receipt?.exactTotal || orderInfo?.exactTotal || 0;

        console.log(
          `💰 ${method} Payment Complete: Using exact receipt preview data:`,
          {
            receiptSubtotal,
            receiptTax,
            receiptTotal,
            method,
            source: "receipt_preview_exact",
          },
        );

        // Get discount amount from multiple sources
        let discountAmount = parseFloat(
          receipt?.discount || orderForPayment?.discount || "0",
        );
        // Add further logic for the payment
        if (discountAmount < 0) {
          discountAmount = 0; // Ensure discount is non-negative
        }

        console.log(`💰 ${method} Discount amount:`, discountAmount);

        // Prepare order items with discount distribution
        let orderItems = (orderInfo.items || cartItems || []).map(
          (item: any) => ({
            productId: item.productId || item.id,
            quantity: parseInt(item.quantity?.toString() || "1"),
            unitPrice: item.unitPrice || item.price?.toString() || "0",
            total:
              item.total ||
              (
                parseFloat(item.price || "0") * parseInt(item.quantity || "1")
              ).toString(),
            notes: null,
            discount: "0.00", // Will be calculated below
          }),
        );

        // Distribute discount among items if discount exists
        if (discountAmount > 0 && orderItems.length > 0) {
          console.log("💰 Distributing discount among order items");

          // Calculate total amount (subtotal before discount)
          const totalAmount = orderItems.reduce((sum, item) => {
            const unitPrice = Number(item.unitPrice || 0);
            const quantity = Number(item.quantity || 0);
            return sum + unitPrice * quantity;
          }, 0);

          if (totalAmount > 0) {
            let allocatedDiscount = 0;

            orderItems = orderItems.map((item, index) => {
              const unitPrice = Number(item.unitPrice || 0);
              const quantity = Number(item.quantity || 0);
              const itemTotal = unitPrice * quantity;

              let itemDiscount = 0;

              if (index === orderItems.length - 1) {
                // Last item gets remaining discount to ensure total matches exactly
                itemDiscount = Math.max(0, discountAmount - allocatedDiscount);
              } else {
                // Calculate proportional discount
                const proportionalDiscount =
                  (discountAmount * itemTotal) / totalAmount;
                itemDiscount = Math.round(proportionalDiscount);
                allocatedDiscount += itemDiscount;
              }

              return {
                ...item,
                discount: itemDiscount.toFixed(2),
              };
            });

            console.log("💰 Discount distribution completed:", {
              totalDiscount: discountAmount,
              itemsWithDiscount: orderItems.map((item) => ({
                productId: item.productId,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                discount: item.discount,
              })),
            });
          }
        }

        const orderData = {
          orderNumber: `ORD-${Date.now()}`,
          tableId: null, // POS orders don't have tables
          salesChannel: "pos", // Mark as POS order
          customerName: orderInfo.customerName || receipt?.customerName || "Khách hàng lẻ",
          customerPhone: orderInfo.customerPhone || receipt?.customerPhone || null,
          customerCount: 1,
          status: "paid", // Mark as paid immediately
          paymentMethod: method, // Explicitly set payment method
          paymentStatus: "paid",
          subtotal: receiptSubtotal.toString(),
          tax: receiptTax.toString(),
          total: receiptTotal.toString(),
          notes: `POS ${method} Payment`,
          paidAt: new Date().toISOString(),
          discount: discountAmount.toString(),
        };

        console.log(`📝 Creating POS ${method} order:`, orderData);
        console.log(`📦 Order items:`, orderItems);

        // Create order via API
        const createResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order: orderData,
            items: orderItems,
          }),
        });

        if (createResponse.ok) {
          const createdOrder = await createResponse.json();
          console.log(
            `✅ POS ${method} order created successfully:`,
            createdOrder,
          );

          // Update orderInfo with the real order ID
          orderInfo.id = createdOrder.id;
          receipt.id = createdOrder.id;
          orderForPayment.id = createdOrder.id;
          orderInfo.orderNumber = createdOrder.orderNumber;

          // CHECK BUSINESS TYPE - if laundry, show receipt modal directly
          const businessType = storeSettings?.businessType;
          console.log(
            `🔍 ${method} Payment (POS Order): Business type is "${businessType}"`,
          );

          if (businessType === "laundry") {
            console.log(
              `🧺 LAUNDRY BUSINESS - showing receipt modal directly for ${method} payment`,
            );

            // Prepare receipt data from created order
            const receiptData = {
              ...createdOrder,
              items: orderItems.map((item: any) => ({
                ...item,
                productName: item.productName || getProductName?.(item.productId) || "Unknown",
                sku: item.sku || `ITEM-${item.productId}`,
              })),
              exactSubtotal: receiptSubtotal,
              exactTax: receiptTax,
              exactTotal: receiptTotal,
              exactDiscount: discountAmount,
              paymentMethod: method,
              isPreview: false,
              isInvoice: true,
            };

            // Set receipt data for modal and show it
            setReceiptDataForModal(receiptData);
            setShowReceiptModal(true);

            // Show success toast
            toast({
              title: "Thanh toán thành công",
              description: `Đã thanh toán bằng ${getPaymentMethodName(method)}`,
            });
          } else {
            console.log(
              `🏪 RESTAURANT BUSINESS - showing E-Invoice modal for ${method} payment`,
            );

            setSelectedPaymentMethod(method);
            setShowEInvoice(true);
            console.log(
              `🔥 SHOWING E-INVOICE MODAL for created POS ${method} order ${createdOrder.id}`,
            );
          }
        } else {
          const errorText = await createResponse.text();
          console.error(`❌ Failed to create POS ${method} order:`, errorText);
          toast({
            title: "Lỗi",
            description: `Không thể tạo đơn hàng với phương thức ${method}`,
            variant: "destructive",
          });
        }
      } else {
        // For other payment methods (card, digital wallets) on real orders, update order AND payment method
        console.log(
          `🚀 REAL ORDER ${method.toUpperCase()} PAYMENT - updating order for order ${orderInfo.id}`,
        );

        try {
          // First update the payment method and status
          const updateResponse = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderInfo.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: "paid",
              paymentMethod: method, // This ensures payment method is saved
              paymentStatus: "paid",
              paidAt: new Date().toISOString(),
            }),
          });

          if (updateResponse.ok) {
            const updatedOrder = await updateResponse.json();
            console.log(
              `✅ Order updated with ${method} payment successfully:`,
              {
                orderId: updatedOrder.id,
                orderNumber: updatedOrder.orderNumber,
                status: updatedOrder.status,
                paymentMethod: updatedOrder.paymentMethod,
                paymentStatus: updatedOrder.paymentStatus,
                paidAt: updatedOrder.paidAt,
                tableId: updatedOrder.tableId,
              },
            );

            // ALWAYS update table status if order has a table - regardless of payment method
            if (updatedOrder.tableId) {
              console.log(
                `🔄 Starting table status update for table ${updatedOrder.tableId} after ${method} payment`,
              );

              try {
                // Check if there are any other unpaid orders on this table
                const ordersResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                  },
                });

                if (!ordersResponse.ok) {
                  throw new Error(
                    "Failed to fetch orders for table status check",
                  );
                }

                const allOrders = await ordersResponse.json();

                const otherActiveOrders = Array.isArray(allOrders)
                  ? allOrders.filter(
                      (o: any) =>
                        o.tableId === updatedOrder.tableId &&
                        o.id !== updatedOrder.id &&
                        !["paid", "cancelled"].includes(o.status),
                    )
                  : [];

                console.log(
                  `🔍 Other active orders on table ${updatedOrder.tableId}:`,
                  {
                    otherOrdersCount: otherActiveOrders.length,
                    otherOrders: otherActiveOrders.map((o) => ({
                      id: o.id,
                      orderNumber: o.orderNumber,
                      status: o.status,
                    })),
                  },
                );

                // If no other unpaid orders, update table to available
                if (otherActiveOrders.length === 0) {
                  console.log(
                    `🔄 No other active orders - updating table ${updatedOrder.tableId} to available`,
                  );

                  const tableUpdateResponse = await fetch(
                    `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables/${updatedOrder.tableId}/status`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        status: "available",
                      }),
                    },
                  );

                  if (!tableUpdateResponse.ok) {
                    const errorText = await tableUpdateResponse.text();
                    throw new Error(`Table update failed: ${errorText}`);
                  }

                  console.log(
                    `✅ Table ${updatedOrder.tableId} updated to available after ${method} payment`,
                  );

                  // Send refresh signal via WebSocket
                  try {
                    const protocol =
                      window.location.protocol === "https:" ? "wss:" : "ws:";
                    const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
                    const ws = new WebSocket(wsUrl);

                    ws.onopen = () => {
                      console.log(
                        `📡 Sending table status refresh signal for table ${updatedOrder.tableId}`,
                      );
                      ws.send(
                        JSON.stringify({
                          type: "force_refresh",
                          source: "payment-method-modal",
                          reason: `table_status_updated_after_${method}_payment`,
                          tableId: updatedOrder.tableId,
                          timestamp: new Date().toISOString(),
                        }),
                      );
                      setTimeout(() => ws.close(), 100);
                    };
                  } catch (wsError) {
                    console.warn(
                      "⚠️ WebSocket refresh signal failed (non-critical):",
                      wsError,
                    );
                  }
                } else {
                  console.log(
                    `⏳ Table ${updatedOrder.tableId} still has ${otherActiveOrders.length} active orders, keeping occupied status`,
                  );
                }
              } catch (tableError) {
                console.error(
                  `❌ Error updating table status after ${method} payment:`,
                  tableError,
                );
                toast({
                  title: "Cảnh báo",
                  description: `Thanh toán thành công nhưng không thể cập nhật trạng thái bàn`,
                  variant: "destructive",
                });
              }
            } else {
              console.log(
                "ℹ️ Order has no table, skipping table status update",
              );
            }

            // CHECK BUSINESS TYPE - if laundry, show receipt modal directly
            const businessType = storeSettings?.businessType;
            console.log(
              `🔍 ${method} Payment (Real Order): Business type is "${businessType}"`,
            );

            if (businessType === "laundry") {
              console.log(
                `🧺 LAUNDRY BUSINESS - showing receipt modal directly for ${method} payment`,
              );

              // Prepare receipt data from updated order
              const receiptData = {
                ...updatedOrder,
                items: orderInfo.items || receipt?.items || [],
                exactSubtotal:
                  receipt?.exactSubtotal ||
                  orderInfo?.exactSubtotal ||
                  parseFloat(updatedOrder.subtotal || "0"),
                exactTax:
                  receipt?.exactTax ||
                  orderInfo?.exactTax ||
                  parseFloat(updatedOrder.tax || "0"),
                exactTotal:
                  receipt?.exactTotal ||
                  orderInfo?.exactTotal ||
                  parseFloat(updatedOrder.total || "0"),
                exactDiscount:
                  receipt?.exactDiscount ||
                  orderInfo?.exactDiscount ||
                  parseFloat(updatedOrder.discount || "0"),
                paymentMethod: method,
                isPreview: false,
                isInvoice: true,
              };

              // Set receipt data for modal and show it
              setReceiptDataForModal(receiptData);
              setShowReceiptModal(true);

              // Show success toast
              toast({
                title: "Thanh toán thành công",
                description: `Đã thanh toán bằng ${getPaymentMethodName(method)}`,
              });
            } else {
              console.log(
                `🏪 RESTAURANT BUSINESS - showing E-Invoice modal for ${method} payment`,
              );

              // Show success toast
              toast({
                title: "Thanh toán thành công",
                description: `Đã thanh toán bằng ${getPaymentMethodName(method)}`,
              });

              // Set payment method and show E-Invoice modal
              setSelectedPaymentMethod(method);
              setShowEInvoice(true);
              console.log(
                `🔥 SHOWING E-INVOICE MODAL after successful ${method} payment`,
              );
            }
          } else {
            const errorText = await updateResponse.text();
            console.error(
              `❌ Failed to update order with ${method} payment:`,
              errorText,
            );
            toast({
              title: "Lỗi",
              description: `Không thể cập nhật phương thức thanh toán ${method}`,
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error(
            `❌ Error updating order with ${method} payment:`,
            error,
          );
          toast({
            title: "Lỗi",
            description: `Lỗi khi xử lý thanh toán ${method}`,
            variant: "destructive",
          });
        }
      }
    }
  };

  const handleQRComplete = async () => {
    console.log(
      `🚀 QR PAYMENT COMPLETE - checking order type for order ${orderInfo.id}`,
    );

    // Check if this is a real order or temporary order
    const isTemporaryOrder = orderInfo.id.toString().startsWith("temp-");

    if (isTemporaryOrder) {
      console.log(
        `🔄 TEMPORARY ORDER DETECTED - using receipt preview data for QR payment ${orderInfo.id}`,
      );

      // Get discount amount and calculate distribution for QR payment
      const discountAmount = Math.floor(
        parseFloat(
          receipt?.discount ||
            receipt?.exactDiscount ||
            orderForPayment?.discount ||
            orderInfo?.discount ||
            "0",
        ),
      );

      console.log("💰 QR Order Creation: Discount amount:", discountAmount);

      // Prepare order items with discount distribution
      let orderItems = (orderInfo.items || cartItems || []).map(
        (item: any) => ({
          productId: item.productId || item.id,
          quantity: parseInt(item.quantity?.toString() || "1"),
          unitPrice: item.unitPrice || item.price?.toString() || "0",
          total:
            item.total ||
            (
              parseFloat(item.price || "0") * parseInt(item.quantity || "1")
            ).toString(),
          notes: null,
          discount: item.discount || "0", // Will be calculated below
        }),
      );

      // Distribute discount among items if discount exists
      if (discountAmount > 0 && orderItems.length > 0) {
        console.log("💰 Distributing QR discount among order items");

        // Calculate total amount (subtotal before discount)
        const totalAmount = orderItems.reduce((sum, item) => {
          const unitPrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 0);
          return sum + unitPrice * quantity;
        }, 0);

        if (totalAmount > 0) {
          let allocatedDiscount = 0;

          orderItems = orderItems.map((item, index) => {
            const unitPrice = Number(item.unitPrice || 0);
            const quantity = Number(item.quantity || 0);

            let itemDiscount = 0;

            if (index === orderItems.length - 1) {
              // Last item gets remaining discount to ensure total matches exactly
              itemDiscount = Math.max(0, discountAmount - allocatedDiscount);
            } else {
              // Calculate proportional discount
              const proportionalDiscount =
                (discountAmount * unitPrice) / totalAmount;
              itemDiscount = Math.round(proportionalDiscount);
              allocatedDiscount += itemDiscount;
            }

            const itemTotal = unitPrice * quantity - itemDiscount;
            item.total = itemTotal.toString();
            return {
              ...item,
              discount: itemDiscount.toFixed(2),
            };
          });

          console.log("💰 QR Discount distribution completed:", {
            totalDiscount: discountAmount,
            itemsWithDiscount: orderItems.map((item) => ({
              productId: item.productId,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              discount: item.discount,
            })),
          });
        }
      }

      // SỬ DỤNG TRỰC TIẾP DỮ LIỆU TỪ RECEIPT PREVIEW - KHÔNG TÍNH TOÁN LẠI
      const receiptSubtotal =
        receipt?.exactSubtotal || orderInfo?.exactSubtotal || 0;
      const receiptTax = receipt?.exactTax || orderInfo?.exactTax || 0;
      const receiptTotal = receipt?.exactTotal || orderInfo?.exactTotal || 0;

      const orderData = {
        orderNumber: `ORD-${Date.now()}`,
        tableId: null, // POS orders don't have tables
        salesChannel: "pos", // Mark as POS order
        customerName: orderInfo.customerName || receipt?.customerName || "Khách hàng lẻ",
        customerPhone: orderInfo.customerPhone || receipt?.customerPhone || null,
        customerCount: 1,
        status: "paid", // Mark as paid immediately for QR
        paymentMethod: "qrCode",
        paymentStatus: "paid",
        subtotal: receiptSubtotal.toString(),
        tax: receiptTax.toString(),
        total: receiptTotal.toString(),
        notes: `POS QR Payment - Transaction: ${currentTransactionUuid || "N/A"}`,
        paidAt: new Date().toISOString(),
        discount: discountAmount.toString(),
      };

      console.log("📝 Creating POS QR order:", orderData);
      console.log("📦 Order items:", orderItems);

      // Create order via API
      const createResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: orderData,
          items: orderItems,
        }),
      });

      if (createResponse.ok) {
        const createdOrder = await createResponse.json();
        console.log(`✅ POS QR order created successfully:`, createdOrder);

        // Update orderInfo with the real order ID for E-Invoice
        orderInfo.id = createdOrder.id;
        receipt.id = createdOrder.id;
        orderForPayment.id = createdOrder.id;
        orderInfo.orderNumber = createdOrder.orderNumber;

        // CHECK BUSINESS TYPE - if laundry, show receipt modal directly
        const businessType = storeSettings?.businessType;
        console.log(
          `🔍 QR Payment (POS Order): Business type is "${businessType}"`,
        );

        if (businessType === "laundry") {
          console.log(
            `🧺 LAUNDRY BUSINESS - showing receipt modal directly for QR payment`,
          );

          // Prepare receipt data from created order
          const receiptData = {
            ...createdOrder,
            items: orderItems.map((item: any) => ({
              ...item,
              productName:
                item.productName ||
                getProductName?.(item.productId) ||
                "Unknown",
              sku: item.sku || `ITEM-${item.productId}`,
            })),
            exactSubtotal: receiptSubtotal,
            exactTax: receiptTax,
            exactTotal: receiptTotal,
            exactDiscount: discountAmount,
            paymentMethod: "qrCode",
            isPreview: false,
            isInvoice: true,
          };

          // Set receipt data for modal and show it
          setReceiptDataForModal(receiptData);
          setShowReceiptModal(true);

          // Hide QR code display
          setShowQRCode(false);
          setQrCodeUrl("");

          // Show success toast
          toast({
            title: "Thanh toán thành công",
            description: "Đã thanh toán bằng QR Code",
          });
        } else {
          console.log(
            `🏪 RESTAURANT BUSINESS - showing E-Invoice modal for QR payment`,
          );

          setShowQRCode(false);
          setQrCodeUrl("");
          setSelectedPaymentMethod("qrCode");
          setShowEInvoice(true);
          console.log(
            `🔥 SHOWING E-INVOICE MODAL for created POS QR order ${createdOrder.id}`,
          );
        }
      } else {
        const errorText = await createResponse.text();
        console.error(`❌ Failed to create POS QR order:`, errorText);
        alert("Lỗi: Không thể tạo đơn hàng trong hệ thống");
      }
    } else {
      // For real orders, update order status to 'paid'
      console.log(
        `🚀 REAL ORDER QR PAYMENT COMPLETE - updating order status to 'paid' for order ${orderInfo.id}`,
      );

      try {
        console.log(`🔥 MAKING API CALL: PUT /api/orders/${orderInfo.id}`);

        const statusResponse = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderInfo.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "paid",
            paymentMethod: "qrCode",
            paymentStatus: "paid",
            paidAt: new Date().toISOString(),
          }),
        });

        if (statusResponse.ok) {
          const data = await statusResponse.json();
          console.log(`✅ Order status updated to paid successfully:`, data);

          setShowQRCode(false);
          setQrCodeUrl("");

          // CHECK BUSINESS TYPE - if laundry, show receipt modal directly
          const businessType = storeSettings?.businessType;
          console.log(
            `🔍 QR Payment (Real Order): Business type is "${businessType}"`,
          );

          // ALWAYS update table status if order has a table after QR payment
          if (data.tableId) {
            console.log(
              `🔄 Starting table status update for table ${data.tableId} after QR payment`,
            );

            try {
              // Check if there are any other unpaid orders on this table
              const ordersResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              });

              if (ordersResponse.ok) {
                const allOrders = await ordersResponse.json();

                const otherActiveOrders = Array.isArray(allOrders)
                  ? allOrders.filter(
                      (o: any) =>
                        o.tableId === data.tableId &&
                        o.id !== orderInfo.id &&
                        !["paid", "cancelled"].includes(o.status),
                    )
                  : [];

                console.log(
                  `🔍 Other active orders on table ${data.tableId}:`,
                  otherActiveOrders.length,
                );

                // If no other unpaid orders, update table to available
                if (otherActiveOrders.length === 0) {
                  const tableUpdateResponse = await fetch(
                    `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables/${data.tableId}/status`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        status: "available",
                      }),
                    },
                  );

                  if (tableUpdateResponse.ok) {
                    console.log(
                      `✅ Table ${data.tableId} updated to available after QR payment`,
                    );

                    // Send refresh signal via WebSocket
                    try {
                      const protocol =
                        window.location.protocol === "https:" ? "wss:" : "ws:";
                      const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
                      const ws = new WebSocket(wsUrl);

                      ws.onopen = () => {
                        ws.send(
                          JSON.stringify({
                            type: "force_refresh",
                            source: "payment-method-modal",
                            reason: "table_status_updated_after_qr_payment",
                            tableId: data.tableId,
                            timestamp: new Date().toISOString(),
                          }),
                        );
                        setTimeout(() => ws.close(), 100);
                      };
                    } catch (wsError) {
                      console.warn("⚠️ WebSocket signal failed:", wsError);
                    }
                  }
                }
              }
            } catch (tableError) {
              console.error(
                "❌ Error updating table status after QR payment:",
                tableError,
              );
            }
          }

          if (businessType === "laundry") {
            console.log(
              `🧺 LAUNDRY BUSINESS - showing receipt modal directly for real order QR payment`,
            );

            // Prepare receipt data from updated order
            const receiptData = {
              ...data,
              items: orderInfo.items || receipt?.items || [],
              exactSubtotal:
                receipt?.exactSubtotal ||
                orderInfo?.exactSubtotal ||
                parseFloat(data.subtotal || "0"),
              exactTax:
                receipt?.exactTax ||
                orderInfo?.exactTax ||
                parseFloat(data.tax || "0"),
              exactTotal:
                receipt?.exactTotal ||
                orderInfo?.exactTotal ||
                parseFloat(data.total || "0"),
              exactDiscount:
                receipt?.exactDiscount ||
                orderInfo?.exactDiscount ||
                parseFloat(data.discount || "0"),
              paymentMethod: "qrCode",
              isPreview: false,
              isInvoice: true,
            };

            // Set receipt data for modal and show it
            setReceiptDataForModal(receiptData);
            setShowReceiptModal(true);

            // Show success toast
            toast({
              title: "Thanh toán thành công",
              description: "Đã thanh toán bằng QR Code",
            });
          } else {
            console.log(
              `🏪 RESTAURANT BUSINESS - showing E-Invoice modal for QR payment`,
            );

            // Set payment method and show E-Invoice modal
            setSelectedPaymentMethod("qrCode");
            setShowEInvoice(true);
            console.log(
              `🔥 SHOWING E-INVOICE MODAL after successful QR payment`,
            );
          }
        } else {
          const errorText = await statusResponse.text();
          console.error(`❌ Failed to update order status:`, errorText);
          alert("Lỗi: Không thể cập nhật trạng thái đơn hàng");
          return;
        }
      } catch (error) {
        console.error(`❌ Error updating order status:`, error);
        alert("Lỗi: Không thể cập nhật trạng thái đơn hàng");
      }
    }
  };

  const handleBack = () => {
    setShowQRCode(false);
    setQrCodeUrl("");
    setShowCashPayment(false);
    // Reset toàn bộ trạng thái thanh toán tiền mặt
    setAmountReceived("");
    setCashAmountInput("");
    setSelectedPaymentMethod("");
    setShowVirtualKeyboard(false);

    // Remove payment listener if exists when going back from QR
    if (currentTransactionUuid) {
      removePaymentListener(currentTransactionUuid);
      setCurrentTransactionUuid(null);
    }

    // Send message to customer display to clear QR payment
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "qr_payment_cancelled",
            timestamp: new Date().toISOString(),
          }),
        );
        ws.close();
      };
    } catch (error) {
      console.error(
        "Failed to send QR payment cancellation to customer display:",
        error,
      );
    }
  };

  // Handle adding payment method
  const handleAddPaymentMethod = (methodId: string) => {
    const existing = selectedPaymentMethods.find((p) => p.method === methodId);
    if (!existing) {
      setSelectedPaymentMethods([
        ...selectedPaymentMethods,
        { method: methodId, amount: 0 },
      ]);
    }
  };

  // Handle removing payment method
  const handleRemovePaymentMethod = (methodId: string) => {
    setSelectedPaymentMethods(
      selectedPaymentMethods.filter((p) => p.method !== methodId),
    );
  };

  // Handle amount change
  const handleAmountChange = (methodId: string, amount: number) => {
    setSelectedPaymentMethods(
      selectedPaymentMethods.map((p) =>
        p.method === methodId ? { ...p, amount } : p,
      ),
    );
  };

  // Calculate remaining amount
  const getRemainingAmount = () => {
    const orderTotal =
      orderInfo?.total ||
      orderForPayment?.total ||
      receipt?.total ||
      total ||
      0;
    const paid = selectedPaymentMethods.reduce((sum, p) => sum + p.amount, 0);
    return Math.floor(parseFloat(orderTotal.toString())) - paid;
  };

  // Handle multi-payment complete
  const handleMultiPaymentComplete = async () => {
    const orderTotal =
      orderInfo?.total ||
      orderForPayment?.total ||
      receipt?.total ||
      total ||
      0;
    const totalPaid = selectedPaymentMethods.reduce(
      (sum, p) => sum + p.amount,
      0,
    );

    if (totalPaid < Math.floor(parseFloat(orderTotal.toString()))) {
      toast({
        title: "Lỗi",
        description: "Số tiền thanh toán chưa đủ",
        variant: "destructive",
      });
      return;
    }

    // Check if this is a real order or temporary order
    const isTemporaryOrder = orderInfo.id.toString().startsWith("temp-");

    if (isTemporaryOrder) {
      // Create order with multiple payment methods
      const receiptSubtotal =
        receipt?.exactSubtotal || orderInfo?.exactSubtotal || 0;
      const receiptTax = receipt?.exactTax || orderInfo?.exactTax || 0;
      const receiptTotal = receipt?.exactTotal || orderInfo?.exactTotal || 0;
      const discountAmount = Math.floor(
        parseFloat(receipt?.discount || orderForPayment?.discount || "0"),
      );

      let orderItems = (orderInfo.items || cartItems || []).map(
        (item: any) => ({
          productId: item.productId || item.id,
          quantity: parseInt(item.quantity?.toString() || "1"),
          unitPrice: item.unitPrice || item.price?.toString() || "0",
          total:
            item.total ||
            (
              parseFloat(item.price || "0") * parseInt(item.quantity || "1")
            ).toString(),
          notes: null,
          discount: item.discount || "0",
        }),
      );

      const orderData = {
        orderNumber: `ORD-${Date.now()}`,
        tableId: null,
        salesChannel: "pos",
        customerName: orderInfo.customerName || receipt?.customerName || "Khách hàng lẻ",
        customerPhone: orderInfo.customerPhone || receipt?.customerPhone || null,
        customerCount: 1,
        status: "paid",
        paymentMethod: JSON.stringify(selectedPaymentMethods), // Store as JSON
        paymentStatus: "paid",
        subtotal: receiptSubtotal.toString(),
        tax: receiptTax.toString(),
        total: receiptTotal.toString(),
        notes: `POS Multi Payment - ${selectedPaymentMethods.map((p) => `${p.method}: ${p.amount.toLocaleString("vi-VN")}₫`).join(", ")}`,
        paidAt: new Date().toISOString(),
        discount: discountAmount.toString(),
      };

      const createResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderData, items: orderItems }),
      });

      if (createResponse.ok) {
        const createdOrder = await createResponse.json();
        orderInfo.id = createdOrder.id;
        receipt.id = createdOrder.id;
        orderForPayment.id = createdOrder.id;
        orderInfo.orderNumber = createdOrder.orderNumber;
        setShowMultiPayment(false);
        setSelectedPaymentMethods([]);
        setSelectedPaymentMethod("multi");
        setShowEInvoice(true);
      }
    } else {
      // Update existing order
      const updateResponse = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderInfo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          paymentMethod: JSON.stringify(selectedPaymentMethods),
          paymentStatus: "paid",
          paidAt: new Date().toISOString(),
        }),
      });

      if (updateResponse.ok) {
        const updatedOrder = await updateResponse.json();
        console.log("✅ Multi-payment order updated:", updatedOrder);

        // ALWAYS update table status if order has a table - regardless of payment method
        if (updatedOrder.tableId) {
          console.log(
            `🔄 Starting table status update for table ${updatedOrder.tableId} after multi-payment`,
          );

          try {
            // Check if there are any other unpaid orders on this table
            const ordersResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            });

            if (!ordersResponse.ok) {
              throw new Error("Failed to fetch orders for table status check");
            }

            const allOrders = await ordersResponse.json();

            const otherActiveOrders = Array.isArray(allOrders)
              ? allOrders.filter(
                  (o: any) =>
                    o.tableId === updatedOrder.tableId &&
                    o.id !== updatedOrder.id &&
                    !["paid", "cancelled"].includes(o.status),
                )
              : [];

            console.log(
              `🔍 Other active orders on table ${updatedOrder.tableId}:`,
              {
                otherOrdersCount: otherActiveOrders.length,
                otherOrders: otherActiveOrders.map((o) => ({
                  id: o.id,
                  orderNumber: o.orderNumber,
                  status: o.status,
                })),
              },
            );

            // If no other unpaid orders, update table to available
            if (otherActiveOrders.length === 0) {
              console.log(
                `🔄 No other active orders - updating table ${updatedOrder.tableId} to available`,
              );

              const tableUpdateResponse = await fetch(
                `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables/${updatedOrder.tableId}/status`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "available" }),
                },
              );

              if (!tableUpdateResponse.ok) {
                const errorText = await tableUpdateResponse.text();
                throw new Error(`Table update failed: ${errorText}`);
              }

              console.log(
                `✅ Table ${updatedOrder.tableId} updated to available after multi-payment`,
              );

              // Send refresh signal via WebSocket
              try {
                const protocol =
                  window.location.protocol === "https:" ? "wss:" : "ws:";
                const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
                const ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                  console.log(
                    `📡 Sending table status refresh signal for table ${updatedOrder.tableId}`,
                  );
                  ws.send(
                    JSON.stringify({
                      type: "force_refresh",
                      source: "payment-method-modal",
                      reason: "table_status_updated_after_multi_payment",
                      tableId: updatedOrder.tableId,
                      timestamp: new Date().toISOString(),
                    }),
                  );
                  setTimeout(() => ws.close(), 100);
                };
              } catch (wsError) {
                console.warn(
                  "⚠️ WebSocket refresh signal failed (non-critical):",
                  wsError,
                );
              }
            } else {
              console.log(
                `⏳ Table ${updatedOrder.tableId} still has ${otherActiveOrders.length} active orders, keeping occupied status`,
              );
            }
          } catch (tableError) {
            console.error(
              `❌ Error updating table status after multi-payment:`,
              tableError,
            );
            toast({
              title: "Cảnh báo",
              description: `Thanh toán thành công nhưng không thể cập nhật trạng thái bàn`,
              variant: "destructive",
            });
          }
        } else {
          console.log("ℹ️ Order has no table, skipping table status update");
        }

        setShowMultiPayment(false);
        setSelectedPaymentMethods([]);
        setSelectedPaymentMethod("multi");

        // CHECK BUSINESS TYPE - if laundry, show receipt modal directly
        const businessType = storeSettings?.businessType;
        console.log(
          `🔍 Multi-payment (Real Order): Business type is "${businessType}"`,
        );

        if (businessType === "laundry") {
          console.log(
            `🧺 LAUNDRY BUSINESS - showing receipt modal directly for multi-payment`,
          );

          // Prepare receipt data from updated order
          const receiptData = {
            ...updatedOrder,
            items: orderInfo.items || receipt?.items || [],
            exactSubtotal:
              receipt?.exactSubtotal ||
              orderInfo?.exactSubtotal ||
              parseFloat(updatedOrder.subtotal || "0"),
            exactTax:
              receipt?.exactTax ||
              orderInfo?.exactTax ||
              parseFloat(updatedOrder.tax || "0"),
            exactTotal:
              receipt?.exactTotal ||
              orderInfo?.exactTotal ||
              parseFloat(updatedOrder.total || "0"),
            exactDiscount:
              receipt?.exactDiscount ||
              orderInfo?.exactDiscount ||
              parseFloat(updatedOrder.discount || "0"),
            paymentMethod: "multi",
            isPreview: false,
            isInvoice: true,
          };

          // Set receipt data for modal and show it
          setReceiptDataForModal(receiptData);
          setShowReceiptModal(true);

          // Show success toast
          toast({
            title: "Thanh toán thành công",
            description: "Đã thanh toán bằng nhiều phương thức",
          });
        } else {
          console.log(
            `🏪 RESTAURANT BUSINESS - showing E-Invoice modal for multi-payment`,
          );

          // Show success toast
          toast({
            title: "Thanh toán thành công",
            description: "Đã thanh toán bằng nhiều phương thức",
          });

          setShowEInvoice(true);
        }
      }
    }
  };

  const handleCashPaymentComplete = async () => {
    const receivedAmount = parseFloat(cashAmountInput || "0");

    // Use exact total from previous screen with correct logic
    const exactSubtotal =
      receipt?.exactSubtotal ??
      orderInfo?.exactSubtotal ??
      orderForPayment?.subtotal ??
      parseFloat(receipt?.subtotal || "0");

    const exactTax =
      receipt?.exactTax ??
      orderForPayment?.tax ??
      orderInfo?.exactTax ??
      parseFloat(receipt?.tax || "0");

    const discount = Math.floor(
      parseFloat(
        receipt?.discount ||
          receipt?.exactDiscount ||
          orderForPayment?.discount ||
          orderInfo?.discount ||
          "0",
      ),
    );

    let orderTotal;
    if (priceIncludesTax) {
      // When priceIncludesTax = true: total = subtotal - discount (subtotal already includes tax)
      orderTotal = Math.max(0, exactSubtotal - discount);
    } else {
      // When priceIncludesTax = false: total = subtotal + tax - discount
      orderTotal = Math.max(0, exactSubtotal + exactTax - discount);
    }

    // Get discount amount and calculate distribution for cash payment
    let discountAmount = Math.floor(
      parseFloat(
        receipt?.discount ||
          receipt?.exactDiscount ||
          orderForPayment?.discount ||
          orderInfo?.discount ||
          "0",
      ),
    );

    console.log("💰 Cash Order Creation: Discount amount:", discountAmount);

    // Calculate tiền thối: Tiền khách đưa - Tiền cần thanh toán
    const changeAmount = receivedAmount - orderTotal;
    const finalChange = changeAmount >= 0 ? changeAmount : 0;

    console.log("💰 Hoàn thành thanh toán tiền mặt:", {
      "Số tiền nhập": amountReceived,
      "Số tiền khách đưa": receivedAmount,
      "Tổng cần thanh toán": orderTotal,
      "Tiền thối": finalChange,
      "Đủ tiền": receivedAmount >= orderTotal,
    });

    if (receivedAmount < orderTotal) {
      console.warn("❌ Số tiền chưa đủ");
      return; // Không thực hiện nếu chưa đủ tiền
    }

    // Check if this is a real order or temporary order
    const isTemporaryOrder = orderInfo.id.toString().startsWith("temp-");

    if (isTemporaryOrder) {
      console.log(
        `🔄 TEMPORARY ORDER DETECTED - using receipt preview data for cash payment ${orderInfo.id}`,
      );

      // Prepare order items with discount distribution
      let orderItems = (orderInfo.items || cartItems || []).map(
        (item: any) => ({
          productId: item.productId || item.id,
          quantity: parseInt(item.quantity?.toString() || "1"),
          unitPrice: item.unitPrice || item.price?.toString() || "0",
          total:
            item.total ||
            (
              parseFloat(item.price || "0") * parseInt(item.quantity || "1")
            ).toString(),
          notes: null,
          discount: item.discount || "0", // Will be calculated below
        }),
      );

      // Distribute discount among items if discount exists
      if (discountAmount > 0 && orderItems.length > 0) {
        console.log("💰 Distributing cash discount among order items");

        // Calculate total amount (subtotal before discount)
        const totalAmount = orderItems.reduce((sum, item) => {
          const unitPrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 0);
          return sum + unitPrice * quantity;
        }, 0);

        if (totalAmount > 0) {
          let allocatedDiscount = 0;

          orderItems = orderItems.map((item, index) => {
            const unitPrice = Number(item.unitPrice || 0);
            const quantity = Number(item.quantity || 0);

            let itemDiscount = 0;

            if (index === orderItems.length - 1) {
              // Last item gets remaining discount to ensure total matches exactly
              itemDiscount = Math.max(0, discountAmount - allocatedDiscount);
            } else {
              // Calculate proportional discount
              const proportionalDiscount =
                (discountAmount * unitPrice) / totalAmount;
              itemDiscount = Math.round(proportionalDiscount);
              allocatedDiscount += itemDiscount;
            }

            const itemTotal = unitPrice * quantity - itemDiscount;
            item.total = itemTotal.toString();
            return {
              ...item,
              discount: itemDiscount.toFixed(2),
            };
          });

          console.log("💰 Cash Discount distribution completed:", {
            totalDiscount: discountAmount,
            itemsWithDiscount: orderItems.map((item) => ({
              productId: item.productId,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              discount: item.discount,
            })),
          });
        }
      }

      // SỬ DỤNG TRỰC TIẾP DỮ LIỆU TỪ RECEIPT PREVIEW - KHÔNG TÍNH TOÁN LẠI
      const receiptSubtotal =
        receipt?.exactSubtotal || orderInfo?.exactSubtotal || 0;
      const receiptTax = receipt?.exactTax || orderInfo?.exactTax || 0;
      const receiptTotal = receipt?.exactTotal || orderInfo?.exactTotal || 0;

      const orderData = {
        orderNumber: `ORD-${Date.now()}`,
        tableId: null, // POS orders don't have tables
        salesChannel: "pos", // Mark as POS order
        customerName: orderInfo.customerName || "Khách hàng lẻ",
        customerPhone: orderInfo.customerPhone || null, // Add customer phone
        customerCount: 1,
        status: "paid", // Mark as paid immediately for cash
        paymentMethod: "cash",
        paymentStatus: "paid",
        subtotal: receiptSubtotal.toString(),
        tax: receiptTax.toString(),
        total: receiptTotal.toString(),
        notes: t("common.comboValues.posPaymentNote")
          .replace("{amount}", cashAmountInput)
          .replace("{change}", finalChange.toString()),
        paidAt: new Date().toISOString(),
        discount: discountAmount.toString(),
      };

      console.log("📝 Creating POS order:", orderData);
      console.log("📦 Order items:", orderItems);

      // Create order via API
      const createResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: orderData,
          items: orderItems,
        }),
      });

      if (createResponse.ok) {
        const createdOrder = await createResponse.json();
        console.log(`✅ POS order created successfully:`, createdOrder);

        // Update orderInfo with the real order ID
        orderInfo.id = createdOrder.id;
        receipt.id = createdOrder.id;
        orderForPayment.id = createdOrder.id;
        orderInfo.orderNumber = createdOrder.orderNumber;

        // CHECK BUSINESS TYPE - if laundry, show receipt modal directly
        const businessType = storeSettings?.businessType;
        console.log(`🔍 Cash Payment: Business type is "${businessType}"`);

        if (businessType === "laundry") {
          console.log(
            `🧺 LAUNDRY BUSINESS - showing receipt modal directly for cash payment`,
          );

          // Prepare receipt data
          const receiptData = {
            ...createdOrder,
            items: orderItems.map((item: any) => ({
              ...item,
              productName:
                item.productName ||
                getProductName?.(item.productId) ||
                "Unknown",
              sku: item.sku || `ITEM-${item.productId}`,
            })),
            exactSubtotal: receiptSubtotal,
            exactTax: receiptTax,
            exactTotal: receiptTotal,
            exactDiscount: discountAmount,
            paymentMethod: "cash",
            isPreview: false,
            isInvoice: true,
          };

          // Set receipt data for modal and show it
          setReceiptDataForModal(receiptData);
          setShowReceiptModal(true);

          // Hide cash payment form immediately
          setShowCashPayment(false);
          setAmountReceived("");
          setCashAmountInput("");

          // DO NOT close payment modal yet - let receipt modal handle the flow
          console.log(
            `✅ Receipt modal opened for laundry business, keeping payment modal open in background`,
          );
        } else {
          console.log(
            `🏪 RESTAURANT BUSINESS - showing E-Invoice modal for cash payment`,
          );
          setShowEInvoice(true);
        }
      } else {
        const errorText = await createResponse.text();
        console.error(`❌ Failed to create POS order:`, errorText);
        alert("Lỗi: Không thể tạo đơn hàng trong hệ thống");
      }
    } else {
      // For real orders, update order status to 'paid' when cash payment is completed
      console.log(
        `🚀 REAL ORDER CASH PAYMENT COMPLETE - updating order status to 'paid' for order ${orderInfo.id}`,
      );

      try {
        console.log(`🔥 MAKING API CALL: PUT /api/orders/${orderInfo.id}`);

        const statusResponse = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${orderInfo.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "paid",
            paymentMethod: "cash",
            paymentStatus: "paid",
            paidAt: new Date().toISOString(),
          }),
        });

        if (statusResponse.ok) {
          const updatedOrder = await statusResponse.json();
          console.log(
            `✅ Order status updated to paid successfully:`,
            updatedOrder,
          );

          // ALWAYS update table status if order has a table - for cash payment
          if (updatedOrder.tableId) {
            console.log(
              `🔄 Starting table status update for table ${updatedOrder.tableId} after cash payment`,
            );

            try {
              // Check if there are any other unpaid orders on this table
              const ordersResponse = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              });

              if (!ordersResponse.ok) {
                throw new Error(
                  "Failed to fetch orders for table status check",
                );
              }

              const allOrders = await ordersResponse.json();

              const otherActiveOrders = Array.isArray(allOrders)
                ? allOrders.filter(
                    (o: any) =>
                      o.tableId === updatedOrder.tableId &&
                      o.id !== updatedOrder.id &&
                      !["paid", "cancelled"].includes(o.status),
                  )
                : [];

              console.log(
                `🔍 Other active orders on table ${updatedOrder.tableId}:`,
                {
                  otherOrdersCount: otherActiveOrders.length,
                  otherOrders: otherActiveOrders.map((o) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                  })),
                },
              );

              // If no other unpaid orders, update table to available
              if (otherActiveOrders.length === 0) {
                console.log(
                  `🔄 No other active orders - updating table ${updatedOrder.tableId} to available`,
                );

                const tableUpdateResponse = await fetch(
                  `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables/${updatedOrder.tableId}/status`,
                  {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: "available",
                    }),
                  },
                );

                if (!tableUpdateResponse.ok) {
                  const errorText = await tableUpdateResponse.text();
                  throw new Error(`Table update failed: ${errorText}`);
                }

                console.log(
                  `✅ Table ${updatedOrder.tableId} updated to available after cash payment`,
                );

                // Send refresh signal via WebSocket
                try {
                  const protocol =
                    window.location.protocol === "https:" ? "wss:" : "ws:";
                  const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
                  const ws = new WebSocket(wsUrl);

                  ws.onopen = () => {
                    console.log(
                      `📡 Sending table status refresh signal for table ${updatedOrder.tableId}`,
                    );
                    ws.send(
                      JSON.stringify({
                        type: "force_refresh",
                        source: "payment-method-modal",
                        reason: "table_status_updated_after_cash_payment",
                        tableId: updatedOrder.tableId,
                        timestamp: new Date().toISOString(),
                      }),
                    );
                    setTimeout(() => ws.close(), 100);
                  };
                } catch (wsError) {
                  console.warn(
                    "⚠️ WebSocket refresh signal failed (non-critical):",
                    wsError,
                  );
                }
              } else {
                console.log(
                  `⏳ Table ${updatedOrder.tableId} still has ${otherActiveOrders.length} active orders, keeping occupied status`,
                );
              }
            } catch (tableError) {
              console.error(
                `❌ Error updating table status after cash payment:`,
                tableError,
              );
              toast({
                title: "Cảnh báo",
                description: `Thanh toán thành công nhưng không thể cập nhật trạng thái bàn`,
                variant: "destructive",
              });
            }
          } else {
            console.log("ℹ️ Order has no table, skipping table status update");
          }

          // Reset trạng thái và đóng form tiền mặt
          setShowCashPayment(false);
          setAmountReceived("");
          setCashAmountInput("");
          setSelectedPaymentMethod("cash");

          // CHECK BUSINESS TYPE - if laundry, show receipt modal directly
          const businessType = storeSettings?.businessType;
          console.log(
            `🔍 Cash Payment (Real Order): Business type is "${businessType}"`,
          );

          if (businessType === "laundry") {
            console.log(
              `🧺 LAUNDRY BUSINESS - showing receipt modal directly for real order cash payment`,
            );

            // Prepare receipt data from updated order
            const receiptData = {
              ...updatedOrder,
              items: orderInfo.items || receipt?.items || [],
              exactSubtotal: exactSubtotal,
              exactTax: exactTax,
              exactTotal: orderTotal,
              exactDiscount: discountAmount,
              paymentMethod: "cash",
              isPreview: false,
              isInvoice: true,
            };

            // Set receipt data for modal
            setReceiptDataForModal(receiptData);
            setShowReceiptModal(true);
          } else {
            console.log(
              `🏪 RESTAURANT BUSINESS - showing E-Invoice modal for real order`,
            );
            setShowEInvoice(true);
          }
        } else {
          const errorText = await statusResponse.text();
          console.error(`❌ Failed to update order status:`, errorText);
          alert("Lỗi: Không thể cập nhật trạng thái đơn hàng");
        }
      } catch (error) {
        console.error(`❌ Error updating order status:`, error);
        alert("Lỗi: Không thể cập nhật trạng thái đơn hàng");
      }
    }
  };

  const handleEInvoiceComplete = (invoiceData: any) => {
    console.log("🎯 Payment Modal E-Invoice completed:", invoiceData);
    console.log(
      "📄 Invoice data received:",
      JSON.stringify(invoiceData, null, 2),
    );

    // Always close the E-Invoice modal first
    setShowEInvoice(false);

    // Validate invoiceData exists
    if (!invoiceData) {
      console.error("❌ No invoice data received");
      toast({
        title: "Lỗi",
        description: "Không nhận được dữ liệu hóa đơn",
        variant: "destructive",
      });
      return;
    }

    // Show success message based on action type
    if (invoiceData.publishLater) {
      console.log(
        "⏳ E-Invoice publish later completed - preparing receipt data",
      );
      toast({
        title: `${t("common.success")}`,
        description: `${t("einvoice.savedForLaterPublish")}. ${t("einvoice.displayingForPrint")}`,
      });
    } else {
      console.log("✅ E-Invoice published - preparing receipt data");
      toast({
        title: `${t("common.success")}`,
        description: `${t("einvoice.electronicinvoicehasbeensuccessfully")}`,
      });
    }

    // CRITICAL: Prepare complete receipt data
    const completeReceiptData = {
      ...invoiceData.receipt,
      tax: orderInfo?.tax || invoiceData.receipt?.tax || 0,
      discount: receipt?.discount || orderInfo?.discount || 0,
      isInvoice: true,
      isPreview: false, // Final receipt, not preview
      paymentMethod: selectedPaymentMethod,
    };

    console.log("📄 Complete receipt data prepared:", completeReceiptData);

    // Close all modals and notify parent
    onClose(); // Close payment modal

    // Call parent callback with receipt data and payment completion
    onSelectMethod("paymentCompleted", {
      success: true,
      receipt: completeReceiptData,
      shouldShowReceipt: true,
      publishLater: invoiceData.publishLater,
    });

    // Reset state
    setSelectedPaymentMethod("");
  };

  const handleEInvoiceClose = () => {
    console.log("🔙 E-invoice modal closed - closing entire payment flow");

    setShowEInvoice(false);
    setSelectedPaymentMethod("");
    setReceiptPreview(false);
    setPreviewReceipt(null);
    onClose(); // Always close the entire payment modal when E-invoice is closed
  };

  // Virtual keyboard handlers
  const handleVirtualKeyPress = (key: string) => {
    const currentValue = cashAmountInput || "";
    // Only allow numbers and prevent multiple decimal points
    if (!/^[0-9]$/.test(key)) return;

    const newValue = currentValue + key;
    console.log("🔢 Virtual keyboard input:", { currentValue, key, newValue });
    setCashAmountInput(newValue);
    setAmountReceived(newValue); // Sync for calculation

    // Focus the input to show cursor position
    const inputRef = amountInputRef.current;
    if (inputRef) {
      inputRef.focus();
      // Set cursor to end
      setTimeout(() => {
        inputRef.setSelectionRange(newValue.length, newValue.length);
      }, 0);
    }
  };

  const handleVirtualBackspace = () => {
    const currentValue = cashAmountInput;
    const newValue = currentValue.slice(0, -1);
    setCashAmountInput(newValue);
    setAmountReceived(newValue); // Sync for calculation

    // Focus the input to show cursor position
    const inputRef = amountInputRef.current;
    if (inputRef) {
      inputRef.focus();
      setTimeout(() => {
        inputRef.setSelectionRange(newValue.length, newValue.length);
      }, 0);
    }
  };

  const handleVirtualEnter = () => {
    // Hide keyboard on enter and try to complete payment if amount is sufficient
    setShowVirtualKeyboard(false);
    // Get base values
    const exactSubtotal =
      receipt?.exactSubtotal ||
      orderForPayment?.exactSubtotal ||
      parseFloat(receipt?.subtotal || "0") ||
      parseFloat(orderForPayment?.subtotal || "0") ||
      0;

    const exactTax =
      receipt?.exactTax ??
      orderForPayment?.tax ??
      orderInfo?.exactTax ??
      parseFloat(receipt?.tax || "0") ??
      0;

    const discount = parseFloat(
      receipt?.discount || orderForPayment?.discount || "0",
    );

    // Use stored total directly from order
    const finalTotal =
      Math.floor(Number(orderInfo?.total || receipt?.total || total || 0)) -
      discount;
    if (parseFloat(cashAmountInput) >= finalTotal) {
      handleCashPaymentComplete();
    }
  };

  const toggleVirtualKeyboard = () => {
    setShowVirtualKeyboard(!showVirtualKeyboard);
    if (!showVirtualKeyboard) {
      // If opening keyboard, focus on amount input
      setTimeout(() => {
        const inputRef = amountInputRef.current;
        if (inputRef) {
          inputRef.focus();
        }
      }, 100);
    }
  };

  // Track previous QR state to handle cancellation
  const [wasShowingQRCode, setWasShowingQRCode] = useState(false);

  // Track when QR code is showing
  useEffect(() => {
    if (showQRCode) {
      setWasShowingQRCode(true);
    }
  }, [showQRCode]);

  // Initialize cash amount when showing cash payment
  useEffect(() => {
    if (showCashPayment && isOpen) {
      // Auto-fill with order total
      const orderTotal = Math.floor(
        parseFloat(
          (
            orderInfo?.total ||
            orderForPayment?.total ||
            receipt?.total ||
            total ||
            "0"
          ).toString(),
        ),
      );
      setCashAmountInput(orderTotal.toString());
      setAmountReceived(orderTotal.toString());

      console.log("💰 Auto-filled cash amount:", {
        orderTotal,
        cashAmountInput: orderTotal.toString(),
      });
    }
  }, [
    showCashPayment,
    isOpen,
    orderInfo?.total,
    orderForPayment?.total,
    receipt?.total,
    total,
  ]);

  // Reset all states when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Always send message to customer display when modal closes
      const sendCloseMessage = () => {
        try {
          const protocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";
          const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
          const ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            console.log("Payment Modal: WebSocket connected for close message");

            // If QR code was showing, send cancellation and restore cart
            if (wasShowingQRCode || showQRCode || qrCodeUrl) {
              console.log("Payment Modal: Sending QR cancellation message");
              ws.send(
                JSON.stringify({
                  type: "qr_payment_cancelled",
                  timestamp: new Date().toISOString(),
                }),
              );

              // Wait a bit then send cart restore message
              setTimeout(() => {
                console.log("Payment Modal: Sending cart restore message");
                ws.send(
                  JSON.stringify({
                    type: "restore_cart_display",
                    timestamp: new Date().toISOString(),
                    reason: "payment_dialog_closed",
                  }),
                );
                ws.close();
              }, 100);
            } else {
              // Just send cart restore message if no QR code
              console.log(
                "Payment Modal: Sending cart restore message (no QR)",
              );
              ws.send(
                JSON.stringify({
                  type: "restore_cart_display",
                  timestamp: new Date().toISOString(),
                  reason: "payment_dialog_closed",
                }),
              );
              ws.close();
            }
          };

          ws.onerror = (error) => {
            console.error("Payment Modal: WebSocket error:", error);
          };

          ws.onclose = () => {
            console.log(
              "Payment Modal: WebSocket closed after sending close message",
            );
          };
        } catch (error) {
          console.error(
            "Payment Modal: Failed to send close message when modal closes:",
            error,
          );
        }
      };

      // Send close message after a small delay to ensure modal is fully closed
      setTimeout(sendCloseMessage, 50);

      // Reset all states when modal completely closes
      console.log("🔄 Payment Modal: Resetting all states on modal close");
      setShowQRCode(false);
      setQrCodeUrl("");
      setShowEInvoice(false);
      setSelectedPaymentMethod("");
      setQrLoading(false);
      setShowCashPayment(false);
      setAmountReceived("");
      setCashAmountInput("");
      setShowVirtualKeyboard(false);
      setWasShowingQRCode(false);
      setShowMultiPayment(false);
      setShowReceiptModal(false);
      setSelectedPaymentMethods([]);

      // Remove payment listener if exists
      if (currentTransactionUuid) {
        removePaymentListener(currentTransactionUuid);
        setCurrentTransactionUuid(null);
      }
    }
  }, [
    isOpen,
    currentTransactionUuid,
    removePaymentListener,
    showQRCode,
    qrCodeUrl,
    wasShowingQRCode,
  ]);

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            // When dialog is closed via X button or outside click
            try {
              const protocol =
                window.location.protocol === "https:" ? "wss:" : "ws:";
              const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
              const ws = new WebSocket(wsUrl);

              ws.onopen = () => {
                console.log(
                  "Payment Modal: Sending clear message from X button close",
                );
                // If QR code was showing, send cancellation and restore cart
                if (showQRCode || qrCodeUrl) {
                  ws.send(
                    JSON.stringify({
                      type: "qr_payment_cancelled",
                      timestamp: new Date().toISOString(),
                    }),
                  );
                  // Wait a bit then send cart restore message
                  setTimeout(() => {
                    ws.send(
                      JSON.stringify({
                        type: "restore_cart_display",
                        timestamp: new Date().toISOString(),
                        reason: "payment_dialog_x_button",
                      }),
                    );
                    ws.close();
                  }, 100);
                } else {
                  // Just send cart restore message if no QR code
                  ws.send(
                    JSON.stringify({
                      type: "restore_cart_display",
                      timestamp: new Date().toISOString(),
                      reason: "payment_dialog_x_button",
                    }),
                  );
                  ws.close();
                }
              };
            } catch (error) {
              console.error(
                "Failed to send clear message when X button clicked:",
                error,
              );
            }
          }
          onClose();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("common.selectPaymentMethod")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 p-4">
            {!showQRCode && !showCashPayment && !showMultiPayment ? (
              <>
                <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600 mb-1">
                    {t("common.totalAmount")}
                  </p>
                  <p className="text-3xl font-bold text-blue-600">
                    {(() => {
                      const orderTotal =
                        orderInfo?.total ||
                        orderForPayment?.total ||
                        receipt?.total ||
                        total ||
                        "0";
                      return Math.floor(
                        parseFloat(orderTotal.toString()),
                      ).toLocaleString("vi-VN");
                    })()}
                    ₫
                  </p>
                </div>

                <Button
                  onClick={() => setShowMultiPayment(true)}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium"
                >
                  💳 Thanh toán nhiều phương thức
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">
                      Hoặc chọn một phương thức
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 max-h-[400px] overflow-y-auto">
                  {paymentMethods.map((method) => {
                    const IconComponent = method.icon;
                    const isQRMethod =
                      method.id === "qrCode" || method.id === "vnpay";
                    const isLoading = qrLoading && isQRMethod;

                    return (
                      <Button
                        key={method.id}
                        variant="outline"
                        className="flex items-center justify-start p-3 h-auto hover:bg-blue-50 hover:border-blue-300 transition-all"
                        onClick={() => {
                          handleSelect(method.id);
                        }}
                        disabled={isLoading}
                      >
                        <IconComponent
                          className="mr-3 text-blue-600"
                          size={20}
                        />
                        <div className="text-left flex-1">
                          <div className="font-medium text-sm">
                            {isLoading ? t("common.generatingQr") : method.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {method.description}
                          </div>
                        </div>
                        {isLoading && (
                          <div className="ml-auto">
                            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                          </div>
                        )}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    try {
                      const protocol =
                        window.location.protocol === "https:" ? "wss:" : "ws:";
                      const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
                      const ws = new WebSocket(wsUrl);

                      ws.onopen = () => {
                        ws.send(
                          JSON.stringify({
                            type: "restore_cart_display",
                            timestamp: new Date().toISOString(),
                            reason: "payment_cancel_button",
                          }),
                        );
                        ws.close();
                      };
                    } catch (error) {
                      console.error(
                        "Failed to send clear message to customer display:",
                        error,
                      );
                    }

                    onClose();
                  }}
                  className="w-full"
                >
                  {t("common.cancel")}
                </Button>
              </>
            ) : showMultiPayment ? (
              <>
                <div className="text-center p-6 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-xl border-2 border-purple-200 shadow-sm">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Wallet className="w-5 h-5 text-purple-600" />
                    <p className="text-sm font-medium text-gray-700">
                      Tổng tiền cần thanh toán
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-purple-600 mb-3">
                    {Math.floor(
                      parseFloat((orderInfo?.total || total || 0).toString()),
                    ).toLocaleString("vi-VN")}
                    ₫
                  </p>
                  <div className="mt-3 p-3 bg-white/60 backdrop-blur rounded-lg border border-purple-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">
                        Còn lại:
                      </span>
                      <span
                        className={`font-bold text-lg ${getRemainingAmount() <= 0 ? "text-green-600" : "text-orange-600"}`}
                      >
                        {getRemainingAmount().toLocaleString("vi-VN")}₫
                      </span>
                    </div>
                    {getRemainingAmount() <= 0 && (
                      <div className="mt-2 flex items-center justify-center gap-1 text-green-600 text-xs font-medium">
                        <span className="inline-block w-2 h-2 bg-green-600 rounded-full"></span>
                        Đủ tiền thanh toán
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {selectedPaymentMethods.map((payment, index) => {
                    const method = paymentMethods.find(
                      (m) => m.id === payment.method,
                    );
                    if (!method) return null;
                    const IconComponent = method.icon;

                    return (
                      <div
                        key={payment.method}
                        className="relative group p-4 bg-gradient-to-r from-white to-blue-50/30 rounded-xl border-2 border-blue-100 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                      >
                        <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow">
                          {index + 1}
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <IconComponent
                              className="text-blue-600"
                              size={20}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-800 mb-2">
                              {method.name}
                            </p>
                            <div className="relative">
                              <input
                                type="number"
                                placeholder="Nhập số tiền thanh toán"
                                value={payment.amount || ""}
                                onChange={(e) =>
                                  handleAmountChange(
                                    payment.method,
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                              />
                              <span className="absolute right-3 top-2 text-gray-400 text-sm font-medium">
                                ₫
                              </span>
                            </div>
                            {payment.amount > 0 && (
                              <p className="mt-1 text-xs text-blue-600 font-medium">
                                {payment.amount.toLocaleString("vi-VN")}₫
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleRemovePaymentMethod(payment.method)
                            }
                            className="text-red-500 hover:text-white hover:bg-red-500 rounded-lg p-2 transition-all"
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {selectedPaymentMethods.length < paymentMethods.length && (
                    <div className="border-2 border-dashed border-purple-300 rounded-xl p-4 bg-purple-50/30 hover:bg-purple-50 transition-all">
                      <select
                        className="w-full p-3 border-none bg-transparent text-sm font-medium text-gray-700 cursor-pointer outline-none"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddPaymentMethod(e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">➕ Thêm phương thức thanh toán</option>
                        {paymentMethods
                          .filter(
                            (m) =>
                              !selectedPaymentMethods.find(
                                (p) => p.method === m.id,
                              ),
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowMultiPayment(false);
                      setSelectedPaymentMethods([]);
                    }}
                    className="flex-1 border-2 border-gray-300 hover:bg-gray-100 font-medium"
                  >
                    ← Quay lại
                  </Button>
                  <Button
                    onClick={handleMultiPaymentComplete}
                    disabled={
                      getRemainingAmount() > 0 ||
                      selectedPaymentMethods.length === 0
                    }
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium disabled:from-gray-400 disabled:to-gray-400 shadow-md"
                  >
                    ✓ Hoàn tất thanh toán
                  </Button>
                </div>
              </>
            ) : showQRCode ? (
              <>
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <QrCode className="w-6 h-6" />
                    <h3 className="text-lg font-semibold">
                      {t("common.scanQrPayment")}
                    </h3>
                  </div>

                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      {t("common.amountToPay")}
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {(() => {
                        const orderTotal =
                          orderInfo?.total ||
                          orderForPayment?.total ||
                          receipt?.total ||
                          total ||
                          "0";
                        return Math.floor(
                          parseFloat(orderTotal.toString()),
                        ).toLocaleString("vi-VN");
                      })()}
                      ₫
                    </p>
                  </div>

                  {qrCodeUrl && (
                    <div className="flex justify-center">
                      <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-lg">
                        <img
                          src={qrCodeUrl}
                          alt="QR Code for Bank Transfer"
                          className="w-64 h-64"
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-gray-600">
                    {t("common.useBankingApp")}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Send clear message to customer display before going back
                      try {
                        const protocol =
                          window.location.protocol === "https:"
                            ? "wss:"
                            : "ws:";
                        const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
                        const ws = new WebSocket(wsUrl);

                        ws.onopen = () => {
                          console.log(
                            "Payment Modal: Sending clear message from back button",
                          );
                          ws.send(
                            JSON.stringify({
                              type: "qr_payment_cancelled",
                              timestamp: new Date().toISOString(),
                            }),
                          );
                          // Wait a bit then send cart restore message
                          setTimeout(() => {
                            ws.send(
                              JSON.stringify({
                                type: "restore_cart_display",
                                timestamp: new Date().toISOString(),
                                reason: "payment_back_button",
                              }),
                            );
                            ws.close();
                          }, 100);
                        };
                      } catch (error) {
                        console.error(
                          "Failed to send clear message from back button:",
                          error,
                        );
                      }

                      handleBack();
                    }}
                    className="flex-1"
                  >
                    {t("common.goBack")}
                  </Button>
                  <Button
                    onClick={() => {
                      // Send clear message to customer display before completing
                      try {
                        const protocol =
                          window.location.protocol === "https:"
                            ? "wss:"
                            : "ws:";
                        const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
                        const ws = new WebSocket(wsUrl);

                        ws.onopen = () => {
                          console.log(
                            "Payment Modal: Sending clear message from complete button",
                          );
                          ws.send(
                            JSON.stringify({
                              type: "qr_payment_cancelled",
                              timestamp: new Date().toISOString(),
                            }),
                          );
                          // Wait a bit then send cart restore message
                          setTimeout(() => {
                            ws.send(
                              JSON.stringify({
                                type: "restore_cart_display",
                                timestamp: new Date().toISOString(),
                                reason: "payment_complete_button",
                              }),
                            );
                            ws.close();
                          }, 100);
                        };
                      } catch (error) {
                        console.error(
                          "Failed to send clear message from complete button:",
                          error,
                        );
                      }

                      handleQRComplete();
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
                  >
                    {t("common.complete")}
                  </Button>
                </div>
              </>
            ) : showCashPayment ? (
              <>
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Banknote className="w-6 h-6" />
                    <h3 className="text-lg font-semibold">
                      {t("common.cashPayment")}
                    </h3>
                  </div>

                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      {t("common.amountToPay")}
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {(() => {
                        const orderTotal =
                          orderInfo?.total ||
                          orderForPayment?.total ||
                          receipt?.total ||
                          total ||
                          "0";
                        return Math.floor(
                          parseFloat(orderTotal.toString()),
                        ).toLocaleString("vi-VN");
                      })()}
                      ₫
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("common.customerAmount")}
                      </label>
                      <input
                        ref={amountInputRef}
                        type="number"
                        step="1000"
                        min="0"
                        placeholder={t("common.enterCustomerAmount")}
                        value={cashAmountInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          console.log("💰 Cash input changed to:", value);
                          setCashAmountInput(value);
                          setAmountReceived(value); // Sync for calculation
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center"
                        autoFocus
                      />
                    </div>

                    {/* Virtual Keyboard Toggle */}
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleVirtualKeyboard}
                        className={`${showVirtualKeyboard ? "bg-blue-100 border-blue-300" : ""}`}
                      >
                        <Keyboard className="w-4 h-4 mr-2" />
                        {showVirtualKeyboard
                          ? t("common.hideKeyboard")
                          : t("common.showVirtualKeyboard")}
                      </Button>
                    </div>

                    {amountReceived &&
                      parseFloat(amountReceived || "0") > 0 && (
                        <div
                          className={`p-3 border rounded-lg ${(() => {
                            const receivedAmount = parseFloat(
                              cashAmountInput || "0",
                            );
                            const orderTotal = parseFloat(
                              orderInfo?.total || total || "0",
                            );
                            const changeAmount = receivedAmount - orderTotal;
                            return changeAmount >= 0
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200";
                          })()}`}
                        >
                          <div className="flex justify-between items-center">
                            <span
                              className={`text-sm font-medium ${(() => {
                                const receivedAmount = parseFloat(
                                  cashAmountInput || "0",
                                );
                                const orderTotal = parseFloat(
                                  orderInfo?.total || total || "0",
                                );
                                const changeAmount =
                                  receivedAmount - orderTotal;
                                return changeAmount >= 0
                                  ? "text-green-800"
                                  : "text-red-800";
                              })()}`}
                            >
                              {(() => {
                                const receivedAmount = parseFloat(
                                  cashAmountInput || "0",
                                );
                                const orderTotal = parseFloat(
                                  orderInfo?.total || total || "0",
                                );
                                const changeAmount =
                                  receivedAmount - orderTotal;

                                if (changeAmount >= 0) {
                                  return `${t("common.changeAmount")}: ${Math.floor(changeAmount).toLocaleString("vi-VN")} ₫`;
                                } else {
                                  return `Còn thiếu: ${Math.floor(Math.abs(changeAmount)).toLocaleString("vi-VN")} ₫`;
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Virtual Keyboard */}
                  {showVirtualKeyboard && (
                    <div className="mt-4">
                      <VirtualKeyboard
                        onKeyPress={handleVirtualKeyPress}
                        onBackspace={handleVirtualBackspace}
                        onEnter={handleVirtualEnter}
                        isVisible={showVirtualKeyboard}
                        className="border border-gray-200 rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Send clear message to customer display before going back from cash payment
                      try {
                        const protocol =
                          window.location.protocol === "https:"
                            ? "wss:"
                            : "ws:";
                        const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
                        const ws = new WebSocket(wsUrl);

                        ws.onopen = () => {
                          console.log(
                            "Payment Modal: Sending clear message from cash payment back button",
                          );
                          ws.send(
                            JSON.stringify({
                              type: "restore_cart_display",
                              timestamp: new Date().toISOString(),
                              reason: "cash_payment_back_button",
                            }),
                          );
                          ws.close();
                        };
                      } catch (error) {
                        console.error(
                          "Failed to send clear message from cash payment back button:",
                          error,
                        );
                      }

                      handleBack();
                    }}
                    className="flex-1"
                  >
                    {t("common.goBack")}
                  </Button>
                  <Button
                    onClick={() => {
                      // Send clear message to customer display before completing cash payment
                      try {
                        const protocol =
                          window.location.protocol === "https:"
                            ? "wss:"
                            : "ws:";
                        const wsUrl = `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/ws`;
                        const ws = new WebSocket(wsUrl);

                        ws.onopen = () => {
                          console.log(
                            "Payment Modal: Sending clear message from cash payment complete button",
                          );
                          ws.send(
                            JSON.stringify({
                              type: "restore_cart_display",
                              timestamp: new Date().toISOString(),
                              reason: "cash_payment_complete_button",
                            }),
                          );
                          ws.close();
                        };
                      } catch (error) {
                        console.error(
                          "Failed to send clear message from cash payment complete button:",
                          error,
                        );
                      }

                      handleCashPaymentComplete();
                    }}
                    disabled={(() => {
                      // ONLY check cashAmountInput if this is CASH payment
                      if (selectedPaymentMethod !== "cash") {
                        return false; // Non-cash methods are never disabled
                      }

                      const receivedAmount = parseFloat(cashAmountInput || "0");
                      const orderTotal = Math.floor(
                        parseFloat(
                          (
                            orderInfo?.total ||
                            orderForPayment?.total ||
                            receipt?.total ||
                            total ||
                            "0"
                          ).toString(),
                        ),
                      );

                      console.log("💰 Cash button check:", {
                        selectedPaymentMethod,
                        cashAmountInput,
                        receivedAmount,
                        orderTotal,
                        isDisabled:
                          !cashAmountInput || receivedAmount < orderTotal,
                      });

                      return !cashAmountInput || receivedAmount < orderTotal;
                    })()}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {t("common.complete")}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>

        {/* E-Invoice Modal - CRITICAL: Always render when showEInvoice is true */}
        {showEInvoice && (
          <EInvoiceModal
            isOpen={showEInvoice}
            onClose={handleEInvoiceClose}
            onConfirm={(invoiceData) => {
              console.log(
                "📧 E-Invoice confirmed from Payment Method Modal:",
                invoiceData,
              );

              // Ensure receipt data has isPreview = false
              const finalReceiptData = {
                ...(invoiceData.receipt || receipt),
                isPreview: false, // CRITICAL: Force false for final receipt
                isInvoice: true,
              };

              invoiceData.receipt = finalReceiptData;

              // Always call handleEInvoiceComplete to ensure proper processing
              handleEInvoiceComplete(invoiceData);

              // Close E-Invoice modal first
              setShowEInvoice(false);
              setShowReceiptModal(true);

              // Then notify parent with payment completion to show receipt
              onSelectMethod("paymentCompleted", {
                success: true,
                publishLater: invoiceData.publishLater,
                receipt: finalReceiptData,
                shouldShowReceipt: true,
                showReceiptModal: true,
                isPreview: false, // CRITICAL: Explicitly false
                source: "payment_method_modal_einvoice",
              });
            }}
            total={(() => {
              // Use the exact total that was passed to this modal
              const exactTotal =
                receipt?.exactTotal ||
                orderForPayment?.exactTotal ||
                orderInfo?.exactTotal ||
                total ||
                0;

              console.log("🔥 E-INVOICE MODAL: Using exact total:", {
                receiptExactTotal: receipt?.exactTotal,
                orderForPaymentExactTotal: orderForPayment?.exactTotal,
                orderInfoExactTotal: orderInfo?.exactTotal,
                propTotal: total,
                finalTotal: exactTotal,
              });

              return Math.floor(Number(exactTotal));
            })()}
            selectedPaymentMethod={selectedPaymentMethod}
            cartItems={(() => {
              // Use orderItems from orderInfo first, then fallback to other sources
              const itemsToMap =
                orderInfo?.items || receipt?.orderItems || cartItems || [];
              console.log(
                "📦 E-INVOICE MODAL: Mapping cart items for payment modal using exact Order Details data:",
                itemsToMap.length,
              );
              console.log(
                "📦 E-INVOICE MODAL: Payment Modal CartItems Debug:",
                {
                  orderForPayment: orderForPayment,
                  orderInfoItems: orderInfo?.items,
                  receipt: receipt,
                  receiptOrderItems: receipt?.orderItems,
                  cartItems: cartItems,
                  itemsToMap: itemsToMap,
                  products: products,
                },
              );

              return itemsToMap.map((item: any, index: number) => {
                const product = Array.isArray(products)
                  ? products.find((p: any) => p.id === item.productId)
                  : null;

                console.log(`📦 E-INVOICE MODAL: Mapping item ${index + 1}:`, {
                  rawItem: item,
                  foundProduct: product,
                  productId: item.productId,
                  productName: item.productName,
                  unitPrice: item.unitPrice,
                  quantity: item.quantity,
                  discount: item.discount,
                  total: item.total,
                  taxRate: product?.taxRate || item.taxRate || 0,
                });

                return {
                  id: item.productId || item.id,
                  name: item.productName || item.name,
                  price: parseFloat(item.unitPrice || item.price || "0"),
                  quantity: parseInt(item.quantity?.toString() || "1"),
                  discount: parseFloat(item.discount || "0"),
                  sku:
                    product?.sku ||
                    item.sku ||
                    `ITEM${String(item.productId || item.id).padStart(3, "0")}`,
                  taxRate: parseFloat(
                    product?.taxRate?.toString() ||
                      item.taxRate?.toString() ||
                      "0",
                  ),
                };
              });
            })()}
            orderId={receipt?.id || orderInfo?.id || orderForPayment?.id}
          />
        )}

        {/* Debug rendering states */}
        {console.log("🔍 PAYMENT MODAL RENDER DEBUG:", {
          showEInvoice: showEInvoice,
          selectedPaymentMethod: selectedPaymentMethod,
          shouldRenderEInvoice: showEInvoice && selectedPaymentMethod,
          showReceiptModal: showReceiptModal,
          receiptDataForModal: receiptDataForModal,
          showPrintDialog: showPrintDialog, // Include showPrintDialog in debug log
          timestamp: new Date().toISOString(),
        })}
      </Dialog>

      {/* Receipt Modal - CRITICAL: Always show with isPreview=false after payment */}
      {showReceiptModal && receiptDataForModal && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            console.log("🔒 Payment Modal: Receipt modal closed by user");
            setShowReceiptModal(false);
            setReceiptDataForModal(null);
            // Close payment modal when receipt modal is closed
            onClose();
          }}
          receipt={receiptDataForModal}
        />
      )}
    </>
  );
}