import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Table, Product, Category } from "@shared/schema";
import { useTranslation } from "@/lib/i18n";

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: Table | null;
  existingOrder?: any;
  mode?: "create" | "edit";
}

interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

// Helper function for currency formatting
const formatCurrency = (amount: string): string => {
  return parseFloat(amount).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

export function OrderDialog({
  open,
  onOpenChange,
  table,
  existingOrder,
  mode = "create",
}: OrderDialogProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerCount, setCustomerCount] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [existingItems, setExistingItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); // State for search input
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
  });

  const { data: storeSettings } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings"],
  });

  const { data: existingOrderItems, refetch: refetchExistingItems } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items", existingOrder?.id],
    enabled: !!(existingOrder?.id && mode === "edit" && open),
    staleTime: 0,
    queryFn: async () => {
      console.log("Fetching existing order items for order:", existingOrder.id);
      const response = await apiRequest(
        "GET",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${existingOrder.id}`,
      );
      const data = await response.json();
      console.log("Existing order items response:", data);
      return data;
    },
  });

  // Refetch existing items when dialog opens in edit mode
  useEffect(() => {
    if (mode === "edit" && open && existingOrder?.id) {
      console.log("Dialog opened in edit mode, refetching existing items");
      refetchExistingItems();
    }
  }, [mode, open, existingOrder?.id, refetchExistingItems]);

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: {
      order: any;
      items: any[];
      existingItems?: any[];
    }) => {
      console.log("=== ORDER MUTATION STARTED ===");
      console.log("Mode:", mode);
      console.log("Existing order:", existingOrder);
      console.log(
        mode === "edit" ? "Updating existing order:" : "Creating new order:",
        JSON.stringify(orderData, null, 2),
      );

      try {
        if (mode === "edit" && existingOrder) {
          let finalResult = null;

          // Step 1: Add new items if any exist
          if (orderData.items.length > 0) {
            console.log(
              `📝 Adding ${orderData.items.length} new items to existing order ${existingOrder.id}`,
            );
            const addItemsResponse = await apiRequest(
              "POST",
              `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${existingOrder.id}/items`,
              {
                items: orderData.items,
              },
            );

            const addItemsResult = await addItemsResponse.json();
            console.log("✅ Items added successfully:", addItemsResult);
            finalResult = addItemsResult.updatedOrder || addItemsResult;
          } else {
            console.log(
              `📝 No new items to add to order ${existingOrder.id}, proceeding with order update only`,
            );
          }

          // Step 1.5: If we have existing item changes, call recalculate API first
          const hasExistingItemChanges =
            existingItems.length !== (existingOrderItems?.length || 0);
          const shouldRecalculate =
            hasExistingItemChanges ||
            parseFloat(existingOrder.discount || "0") !== discount;
          if (shouldRecalculate) {
            console.log(
              `🧮 Calling recalculate API for order ${existingOrder.id}`,
            );
            try {
              const recalcResponse = await apiRequest(
                "POST",
                `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${existingOrder.id}/recalculate`,
              );
              const recalcResult = await recalcResponse.json();
              console.log("✅ Order totals recalculated:", recalcResult);
            } catch (error) {
              console.error("❌ Error recalculating order:", error);
            }
          }

          // Step 1.6: Update discount, tax and priceBeforeTax for ALL order items (existing + new) via API
          // IMPORTANT: Always update, even when discount = 0 (to reset discount)
          if (orderData?.existingItems && orderData.existingItems.length > 0) {
            // Calculate TOTAL amount including BOTH existing items AND new items
            let totalBeforeDiscount =
              (orderData?.existingItems?.reduce((sum, item) => {
                return (
                  sum +
                  parseFloat(item.unitPrice || "0") *
                    parseInt(item.quantity || "0")
                );
              }, 0) || 0) +
              (orderData.items?.reduce((sum, item) => {
                return (
                  sum +
                  parseFloat(item.unitPrice || "0") *
                    parseInt(item.quantity || "0")
                );
              }, 0) || 0);

            console.log(
              `💰 Updating discount, tax and priceBeforeTax for ${orderData.existingItems.length} existing order items`,
            );

            // Calculate updates for each existing item
            let allocatedDiscount = 0;
            const existingItemsCount = orderData?.existingItems.length || 0;
            const newItemsCount = orderData.items.length || 0;

            for (let i = 0; i < orderData.existingItems.length; i++) {
              const item = orderData.existingItems[i];
              const unitPrice = parseFloat(item.unitPrice || "0");
              const quantity = parseInt(item.quantity || "0");
              const itemSubtotal = unitPrice * quantity;
              const product = products?.find(
                (p: Product) => p.id === item.productId,
              );

              // Calculate discount
              let itemDiscountAmount = 0;
              const isLastOverallItem =
                i === existingItemsCount - 1 && newItemsCount === 0;

              if (discount > 0) {
                if (isLastOverallItem) {
                  itemDiscountAmount = Math.max(
                    0,
                    discount - allocatedDiscount,
                  );
                } else {
                  itemDiscountAmount =
                    totalBeforeDiscount > 0
                      ? Math.floor(
                          (discount * itemSubtotal) / totalBeforeDiscount,
                        )
                      : 0;
                  allocatedDiscount += itemDiscountAmount;
                }
              }

              // Calculate tax and priceBeforeTax
              let itemTax = 0;
              let priceBeforeTax = 0;

              if (product?.taxRate && parseFloat(product.taxRate) > 0) {
                const taxRate = parseFloat(product.taxRate) / 100;

                if (priceIncludesTax) {
                  const discountPerUnit = itemDiscountAmount / quantity;
                  const adjustedPrice = Math.max(
                    0,
                    unitPrice - discountPerUnit,
                  );
                  const giaGomThue = adjustedPrice * quantity;
                  priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
                  itemTax = giaGomThue - priceBeforeTax;
                } else {
                  priceBeforeTax = unitPrice * quantity;
                  itemTax = Math.round(priceBeforeTax * taxRate);
                }
              } else {
                priceBeforeTax = unitPrice * quantity;
                itemTax = 0;
              }

              // Update order item with all values
              try {
                const updatePayload = {
                  discount: parseFloat(itemDiscountAmount.toFixed(2)),
                  tax: parseFloat(Math.round(itemTax).toFixed(2)),
                  priceBeforeTax: parseFloat(
                    Math.round(priceBeforeTax).toFixed(2),
                  ),
                };

                console.log(
                  `🔧 Updating order item ${item.id} with payload:`,
                  updatePayload,
                );

                const updateResponse = await apiRequest(
                  "PUT",
                  `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${item.id}`,
                  updatePayload,
                );

                if (updateResponse.ok) {
                  const updatedItem = await updateResponse.json();
                  console.log(`✅ Updated order item ${item.id}:`, {
                    discount: updatedItem.discount,
                    tax: updatedItem.tax,
                    priceBeforeTax: updatedItem.priceBeforeTax,
                  });
                } else {
                  const errorText = await updateResponse.text();
                  console.error(
                    `❌ Failed to update order item ${item.id}:`,
                    errorText,
                  );
                }
              } catch (itemError) {
                console.error(
                  `❌ Error updating order item ${item.id}:`,
                  itemError,
                );
              }
            }

            console.log(`✅ All order items updated successfully`);
          }

          // Step 2: Use EXACT displayed values from screen footer (NO recalculation)
          console.log(
            `📝 Using EXACT displayed values for order ${existingOrder.id} - NO recalculation`,
          );

          // Get the EXACT displayed values from the footer calculations
          const footerSubtotal = calculateSubtotal();
          const footerTax = calculateTax();
          const footerTotal = calculateTotal();

          // Use floor to match exactly what user sees in footer
          const displayedSubtotal = Math.floor(footerSubtotal);
          const displayedTax = Math.floor(footerTax);
          const displayedDiscount = Math.floor(discount);
          const displayedTotal = Math.floor(footerTotal);

          console.log("💰 Edit mode - Using EXACT footer displayed values:", {
            footerSubtotal,
            footerTax,
            footerTotal,
            displayedSubtotal,
            displayedTax,
            displayedDiscount,
            displayedTotal,
            source: "footer_display_exact_match",
          });

          const updateResponse = await apiRequest(
            "PUT",
            `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${existingOrder.id}`,
            {
              customerName: orderData.order.customerName,
              customerCount: orderData.order.customerCount,
              subtotal: displayedSubtotal.toString(),
              tax: displayedTax.toString(),
              discount: displayedDiscount.toString(),
              total: displayedTotal.toString(),
            },
          );

          const updateResult = await updateResponse.json();
          console.log(
            "✅ Order updated successfully with current totals:",
            updateResult,
          );

          // Return the final result (prioritize the order update result)
          return updateResult;
        } else {
          console.log("📝 Creating new order...");

          const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders", orderData);

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to create order: ${errorData}`);
          }

          const result = await response.json();
          console.log("✅ Order created successfully:", result);
          return result;
        }
      } catch (error) {
        console.error("=== ORDER MUTATION ERROR ===");
        console.error("Error details:", error);
        throw error;
      }
    },
    onSuccess: async (response) => {
      console.log("=== ORDER MUTATION SUCCESS (SINGLE CALL) ===");
      console.log(
        mode === "edit"
          ? "Order updated successfully (no duplicates):"
          : "Order created successfully:",
        response,
      );

      // IMMEDIATE: Clear cache and force fresh data fetch
      console.log("🔄 Clearing cache and forcing fresh data fetch...");
      queryClient.clear();
      queryClient.removeQueries();

      // Force immediate refetch of order items if in edit mode
      if (mode === "edit" && existingOrder?.id) {
        console.log(
          "🔄 Force refetching order items for order:",
          existingOrder.id,
        );
        try {
          // Clear existing cache for this specific order items
          queryClient.removeQueries({
            queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items", existingOrder.id],
          });

          // Force fresh fetch of order items
          const freshOrderItems = await queryClient.fetchQuery({
            queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items", existingOrder.id],
            queryFn: async () => {
              const response = await apiRequest(
                "GET",
                `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${existingOrder.id}`,
              );
              const data = await response.json();
              console.log("🔄 Fresh order items fetched:", data);
              return data;
            },
            staleTime: 0, // Force fresh data
            gcTime: 0, // Don't cache
          });

          // Update existing items state immediately
          if (freshOrderItems && Array.isArray(freshOrderItems)) {
            setExistingItems(freshOrderItems);
            console.log("✅ Existing items state updated with fresh data");
          }

          console.log("✅ Order items refetched successfully");
        } catch (error) {
          console.error("❌ Error refetching order items:", error);
        }
      }

      // Invalidate and refetch all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] }),
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"] }),
        queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items"] }),
        queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"] }),
        queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"] }),
      ]);

      // Reset form state
      setCart([]);
      setCustomerName("");
      setCustomerCount(1);
      setDiscount(0);
      setSelectedCategory(null);
      setSearchQuery(""); // Reset search query
      setExistingItems([]);

      toast({
        title: t("orders.orderUpdateSuccess"),
        description: t("orders.orderUpdateSuccessDesc"),
      });

      // Đóng dialog - parent component sẽ xử lý việc mở lại order details
      console.log(
        "✅ Edit mode: closing edit dialog, parent will handle reopening order list",
      );
      onOpenChange(false);

      console.log("✅ Order mutation completed - proper update flow executed");
    },
    onError: (error: any) => {
      console.error("=== ORDER MUTATION ERROR ===");
      console.error("Full error object:", error);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response);
      console.error("Error response data:", error.response?.data);

      let errorMessage = t("orders.orderFailed");

      if (error.response?.data?.details) {
        errorMessage = error.response.data.details;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: t("common.error"),
        description:
          mode === "edit"
            ? `Lỗi cập nhật đơn hàng: ${errorMessage}`
            : `Lỗi tạo đơn hàng: ${errorMessage}`,
        variant: "destructive",
      });
    },
  });

  const filteredProducts = products
    ? (products as Product[]).filter((product: Product) => {
        // Filter by category
        const categoryMatch =
          !selectedCategory || product.categoryId === selectedCategory;

        // Filter by table floor - if table has floor, only show products from same floor
        const floorMatch =
          !table?.floor || !product.floor || product.floor === table.floor;

        const productType =
          Number(product.productType) !== 2 ||
          Number(product.productType) !== 4;

        // Exclude products from expense categories
        const category = categories?.find(
          (cat: any) => cat.id === product.categoryId,
        );
        const isExpenseCategory =
          product.categoryId == 15 || product.categoryId == 17;

        // Filter by search query (name or SKU)
        const searchMatch =
          !searchQuery ||
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.sku &&
            product.sku.toLowerCase().includes(searchQuery.toLowerCase()));

        return (
          categoryMatch &&
          floorMatch &&
          productType &&
          !isExpenseCategory &&
          searchMatch
        );
      })
    : [];

  const addToCart = (product: Product) => {
    // Check if product is out of stock
    if (product.stock <= 0) {
      toast({
        title: t("common.error"),
        description: `${product.name} đã hết hàng`,
        variant: "destructive",
      });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        // Check if adding one more would exceed stock
        if (existing.quantity >= product.stock) {
          toast({
            title: t("common.warning"),
            description: `Chỉ còn ${product.stock} ${product.name} trong kho`,
            variant: "destructive",
          });
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        );
      }
      return prev.filter((item) => item.product.id !== productId);
    });
  };

  const updateItemNotes = (productId: number, notes: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, notes } : item,
      ),
    );
  };

  const calculateSubtotal = () => {
    let totalSubtotal = 0;
    const priceIncludesTax = storeSettings?.priceIncludesTax || false;

    console.log("📊 calculateSubtotal - Starting:", {
      priceIncludesTax,
      mode,
      existingItemsCount:
        mode === "edit" && existingItems ? existingItems.length : 0,
      cartItemsCount: cart.length,
    });

    // Calculate total before discount for proportional distribution
    const totalBeforeDiscount =
      (mode === "edit" && existingItems
        ? existingItems.reduce((sum, item) => {
            return (
              sum +
              parseFloat(item.unitPrice || "0") * parseInt(item.quantity || "0")
            );
          }, 0)
        : 0) +
      cart.reduce((sum, item) => {
        return sum + parseFloat(item.product.price) * item.quantity;
      }, 0);

    let allocatedDiscount = 0;

    // Add existing order items if in edit mode
    if (mode === "edit" && existingItems && Array.isArray(existingItems)) {
      existingItems.forEach((item, index) => {
        const quantity = parseInt(item.quantity);
        const originalPrice = parseFloat(item.unitPrice);
        const product = products?.find((p: Product) => p.id === item.productId);

        let itemSubtotal = 0;
        let itemDiscountAmount = 0;

        // Calculate proportional discount for this item
        if (discount > 0 && totalBeforeDiscount > 0) {
          const isLastItem =
            index === existingItems.length - 1 && cart.length === 0;

          if (isLastItem) {
            // Last item gets remaining discount
            itemDiscountAmount = Math.max(0, discount - allocatedDiscount);
          } else {
            const itemTotal = originalPrice * quantity;
            itemDiscountAmount = (discount * itemTotal) / totalBeforeDiscount;
            allocatedDiscount += itemDiscountAmount;
          }
        }

        if (priceIncludesTax) {
          // When price includes tax: subtotal = (price - discount/qty) / (1 + tax_rate/100) * qty
          const taxRate = product?.taxRate ? parseFloat(product.taxRate) : 0;
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
          itemSubtotal =
            taxRate > 0
              ? (adjustedPrice / (1 + taxRate / 100)) * quantity
              : adjustedPrice * quantity;
        } else {
          // When price doesn't include tax: subtotal = (price - discount/qty) * qty
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
          itemSubtotal = adjustedPrice * quantity;
        }

        totalSubtotal += Math.round(itemSubtotal);

        console.log(`📊 Existing Item ${index + 1}:`, {
          productName: item.productName,
          originalPrice,
          quantity,
          itemDiscountAmount,
          itemSubtotal,
          runningSubtotal: totalSubtotal,
        });
      });
    }

    // Add new cart items
    cart.forEach((item, index) => {
      const quantity = item.quantity;
      const originalPrice = parseFloat(item.product.price);
      const product = products?.find((p: Product) => p.id === item.product.id);

      let itemSubtotal = 0;
      let itemDiscountAmount = 0;

      // Calculate proportional discount for this item
      if (discount > 0 && totalBeforeDiscount > 0) {
        const isLastItem = index === cart.length - 1;

        if (isLastItem) {
          // Last item gets remaining discount
          itemDiscountAmount = Math.max(0, discount - allocatedDiscount);
        } else {
          const itemTotal = originalPrice * quantity;
          itemDiscountAmount = (discount * itemTotal) / totalBeforeDiscount;
          allocatedDiscount += itemDiscountAmount;
        }
      }

      // Calculate item subtotal (price before tax)
      const taxRate = product?.taxRate ? parseFloat(product.taxRate) : 0;

      if (priceIncludesTax && taxRate > 0) {
        // When price includes tax:
        // Step 1: Calculate price after discount per unit
        const discountPerUnit = itemDiscountAmount / quantity;
        const priceAfterDiscount = Math.max(0, originalPrice - discountPerUnit);

        // Step 2: Extract the pre-tax price from the discounted price
        const priceBeforeTaxPerUnit = priceAfterDiscount / (1 + taxRate / 100);
        itemSubtotal = Math.round(priceBeforeTaxPerUnit * quantity);
      } else {
        // When price doesn't include tax: subtotal = (price - discount/qty) * qty
        const discountPerUnit = itemDiscountAmount / quantity;
        const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
        itemSubtotal = Math.round(adjustedPrice * quantity);
      }

      totalSubtotal += Math.round(itemSubtotal);

      console.log(`📊 Cart Item ${index + 1}:`, {
        productName: item.product.name,
        originalPrice,
        quantity,
        itemDiscountAmount,
        itemSubtotal,
        runningSubtotal: totalSubtotal,
      });
    });

    console.log(`🎯 FINAL SUBTOTAL RESULT:`, {
      totalSubtotal,
      priceIncludesTax,
      totalDiscount: discount,
      allocatedDiscount,
      itemsProcessed: {
        existingItems:
          mode === "edit" && existingItems ? existingItems.length : 0,
        cartItems: cart.length,
      },
    });

    return totalSubtotal;
  };

  // Get priceIncludesTax setting from store settings
  const priceIncludesTax = storeSettings?.priceIncludesTax || false;

  const calculateTax = () => {
    const existingItemsOld = existingItems.map((item) => {
      return {
        ...item,
        product: products?.find((p: Product) => p.id === item.productId),
      };
    });

    let cartOrder = [...cart, ...existingItemsOld];

    // Calculate total before discount for proportional distribution
    const totalBeforeDiscount = cartOrder.reduce((total, cartItem) => {
      return total + parseFloat(cartItem.product.price) * cartItem.quantity;
    }, 0);

    let allocatedDiscount = 0;

    return cartOrder.reduce((sum, item, index) => {
      if (item?.product?.taxRate && parseFloat(item?.product?.taxRate) > 0) {
        const originalPrice = parseFloat(item.product.price);
        const quantity = item.quantity;
        let taxRate = parseFloat(item.product.taxRate) / 100;
        const orderDiscount = discount;

        // Calculate discount for this item using same logic as calculateSubtotal
        let itemDiscountAmount = 0;
        if (orderDiscount > 0 && totalBeforeDiscount > 0) {
          const isLastItem = index === cartOrder.length - 1;

          if (isLastItem) {
            // Last item: total discount - sum of all previous discounts
            itemDiscountAmount = Math.max(
              0,
              Math.round(orderDiscount - allocatedDiscount),
            );
          } else {
            // Regular calculation for non-last items
            const itemTotal = originalPrice * quantity;
            itemDiscountAmount = Math.round(
              (orderDiscount * itemTotal) / totalBeforeDiscount,
            );
            allocatedDiscount += itemDiscountAmount;
          }
        }

        let itemTax = 0;

        if (priceIncludesTax) {
          // When price includes tax:
          const discountPerUnit = itemDiscountAmount / quantity;
          const priceAfterDiscount = Math.max(
            0,
            originalPrice - discountPerUnit,
          );
          const totalAfterDiscount = priceAfterDiscount * quantity;

          // Calculate pre-tax amount from discounted price
          const priceBeforeTax = Math.round(totalAfterDiscount / (1 + taxRate));

          // Tax = total after discount - pre-tax amount
          itemTax = Math.round(totalAfterDiscount - priceBeforeTax);
        } else {
          // When price doesn't include tax:
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, originalPrice - discountPerUnit);
          const priceBeforeTax = adjustedPrice * quantity;
          // tax = subtotal * taxRate
          itemTax = Math.round(priceBeforeTax * taxRate);
        }

        return sum + Math.max(0, itemTax);
      }
      return sum;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const total = subtotal + tax;

    console.log("💰 calculateTotal:", {
      subtotal,
      tax,
      total,
      discount,
      mode,
    });

    return Math.max(0, total);
  };

  const calculateGrandTotal = () => {
    // Use the same calculation as calculateTotal for consistency
    return calculateTotal();
  };

  const handlePlaceOrder = async () => {
    // For edit mode, allow update even with empty cart
    // In create mode, require items in cart
    if (!table || (mode !== "edit" && cart.length === 0)) return;

    if (mode === "edit" && existingOrder) {
      // Check for various types of changes
      const hasNewItems = cart.length > 0;
      const hasRemovedItems = existingItems.some((item) => item.quantity === 0);
      const hasCustomerNameChange =
        (customerName || "") !== (existingOrder.customerName || "");
      const hasCustomerCountChange =
        customerCount !== (existingOrder.customerCount || 1);

      const hasAnyChanges =
        hasNewItems ||
        hasRemovedItems ||
        hasCustomerNameChange ||
        hasCustomerCountChange;

      console.log("📝 Order Dialog: Update attempt - Changes detected:", {
        hasNewItems,
        hasRemovedItems,
        hasCustomerNameChange,
        hasCustomerCountChange,
        hasAnyChanges,
        cartLength: cart.length,
      });

      // Always allow update to proceed - user wants to refresh/update order data
      console.log("📝 Order Dialog: Processing order update:", {
        hasNewItems,
        hasRemovedItems,
        hasCustomerNameChange,
        hasCustomerCountChange,
        hasAnyChanges,
        allowUpdate: true,
        cartItemsCount: cart.length,
      });

      // For edit mode, handle ONLY new items from cart (don't duplicate existing items)
      // Calculate pre-allocated discounts for new items
      let totalBeforeDiscount =
        existingItems.reduce((sum, item) => {
          return sum + Number(item.unitPrice || 0) * Number(item.quantity || 0);
        }, 0) +
        cart.reduce((sum, item) => {
          return sum + parseFloat(item.product.price) * item.quantity;
        }, 0);

      let allocatedDiscountForExisting = 0;

      // Calculate discount already allocated to existing items
      if (existingItems.length > 0) {
        for (let i = 0; i < existingItems.length; i++) {
          const item = existingItems[i];
          const itemSubtotal =
            Number(item.unitPrice || 0) * Number(item.quantity || 0);

          const isLastExistingItem = i === existingItems.length - 1;
          const hasNewItems = cart.length > 0;

          if (isLastExistingItem && !hasNewItems) {
            // If this is the last item overall, it gets remaining discount
            allocatedDiscountForExisting = discount;
          } else {
            // Proportional discount
            const itemDiscount =
              totalBeforeDiscount > 0
                ? Math.round((discount * itemSubtotal) / totalBeforeDiscount)
                : 0;
            allocatedDiscountForExisting += itemDiscount;
          }
        }
      }

      const newItemsOnly = cart.map((item, index) => {
        const product = products?.find(
          (p: Product) => p.id === item.product.id,
        );
        const basePrice = parseFloat(item.product.price.toString());
        const quantity = item.quantity;
        const priceIncludesTax = storeSettings?.priceIncludesTax || false;

        // Calculate discount for this new item
        let itemDiscountAmount = 0;
        const isLastNewItem = index === cart.length - 1;
        const itemSubtotal = basePrice * quantity;

        if (discount > 0) {
          if (isLastNewItem) {
            // Last new item gets remaining discount
            itemDiscountAmount = Math.max(
              0,
              discount - allocatedDiscountForExisting,
            );
          } else {
            // Proportional discount
            itemDiscountAmount =
              totalBeforeDiscount > 0
                ? Math.floor((discount * itemSubtotal) / totalBeforeDiscount)
                : 0;
            allocatedDiscountForExisting += itemDiscountAmount;
          }
        }

        // Calculate tax using the SAME logic as calculateTax function
        let itemTax = 0;
        let priceBeforeTax = 0;

        if (product?.taxRate && parseFloat(product.taxRate) > 0) {
          const taxRate = parseFloat(product.taxRate) / 100;

          if (priceIncludesTax) {
            // When price includes tax:
            // Step 1: Calculate price after discount
            const discountPerUnit = itemDiscountAmount / quantity;
            const adjustedPrice = Math.max(0, basePrice - discountPerUnit);
            const giaGomThue = adjustedPrice * quantity;

            // Step 2: Calculate subtotal (price before tax)
            priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));

            // Step 3: Calculate tax
            itemTax = giaGomThue - priceBeforeTax;
          } else {
            // When price doesn't include tax:
            const discountPerUnit = itemDiscountAmount / quantity;
            const adjustedPrice = Math.max(0, basePrice - discountPerUnit);

            // priceBeforeTax = (price - discount) * quantity
            priceBeforeTax = Math.round(adjustedPrice * quantity);

            // tax = priceBeforeTax * taxRate
            itemTax = Math.round(priceBeforeTax * taxRate);
          }
        } else {
          // No tax rate
          const discountPerUnit = itemDiscountAmount / quantity;
          const adjustedPrice = Math.max(0, basePrice - discountPerUnit);
          priceBeforeTax = Math.round(adjustedPrice * quantity);
          itemTax = 0;
        }

        const itemTotalAmount = priceBeforeTax + itemTax;

        console.log(
          `📝 Order Dialog: Processing NEW cart item ${item.product.name}:`,
          {
            productId: item.product.id,
            quantity: item.quantity,
            basePrice,
            itemTax,
            itemTotalAmount,
            itemDiscountAmount,
            priceBeforeTax,
            priceIncludesTax,
          },
        );

        return {
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: basePrice.toString(),
          total: itemTotalAmount.toString(),
          discount: Math.round(itemDiscountAmount).toString(),
          tax: Math.round(itemTax).toString(),
          priceBeforeTax: Math.round(priceBeforeTax).toString(),
          notes: item.notes || null,
        };
      });

      // Track any modifications to existing items (quantity changes, removals, etc.)
      const hasExistingItemChanges =
        existingItems.length !== (existingOrderItems?.length || 0);

      console.log(`📝 Order Dialog: Checking for existing item changes:`, {
        currentExistingItemsCount: existingItems.length,
        originalExistingItemsCount: existingOrderItems?.length || 0,
        hasExistingItemChanges,
        hasDiscountChange:
          parseFloat(existingOrder.discount || "0") !== discount,
      });

      // Include updated order information
      const updatedOrder = {
        ...existingOrder,
        customerName: customerName || null,
        customerCount: parseInt(customerCount.toString()) || 1,
        discount: discount.toString(),
      };

      console.log("📝 Processing order update:", {
        orderId: existingOrder.id,
        hasNewItems: newItemsOnly.length > 0,
        hasExistingItemChanges,
        hasCustomerChanges: hasCustomerNameChange || hasCustomerCountChange,
        hasDiscountChange:
          parseFloat(existingOrder.discount || "0") !== discount,
        customerUpdates: {
          name: customerName,
          count: customerCount,
        },
        newItemsCount: newItemsOnly.length,
        proceedWithUpdate: true,
      });

      let allocatedDiscount = 0;
      const updatedExistingItems = existingItems.map((item, index) => {
        let product = products?.find((p: Product) => p.id === item.productId);
        let itemDiscountAmount = 0;

        if (discount > 0) {
          const itemSubtotal =
            Number(item.unitPrice || 0) * Number(item.quantity || 0);

          if (index === existingItems.length - 1) {
            // Last item gets remaining discount to ensure total matches exactly
            itemDiscountAmount = Math.max(0, discount - allocatedDiscount);
          } else {
            // Calculate proportional discount
            itemDiscountAmount =
              totalBeforeDiscount > 0
                ? Math.round((discount * itemSubtotal) / totalBeforeDiscount)
                : 0;
            allocatedDiscount += itemDiscountAmount;
          }
        }

        let itemTax = 0;
        let priceBeforeTax = 0;
        const unitPrice = parseFloat(item.unitPrice || "0");
        const quantity = item.quantity;

        if (product?.taxRate && parseFloat(product.taxRate) > 0) {
          const taxRate = parseFloat(product.taxRate) / 100;

          if (priceIncludesTax) {
            // When price includes tax: tax calculation similar to calculateTax
            const discountPerUnit = itemDiscountAmount / quantity;
            const adjustedPrice = Math.max(0, unitPrice - discountPerUnit);
            const giaGomThue = adjustedPrice * quantity;
            priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
            itemTax = giaGomThue - priceBeforeTax;
          } else {
            // When price doesn't include tax: tax = subtotal * taxRate
            priceBeforeTax = unitPrice * quantity - itemDiscountAmount;
            itemTax = Math.round(priceBeforeTax * taxRate);
          }
        } else {
          // No tax rate
          priceBeforeTax = unitPrice * quantity - itemDiscountAmount;
          itemTax = 0;
        }

        return {
          ...item,
          discount: itemDiscountAmount.toString(),
          tax: Math.round(itemTax).toString(),
          priceBeforeTax: Math.round(priceBeforeTax).toString(),
        };
      });

      // Always proceed with mutation - adding new items and updating order totals/info
      console.log(
        `📝 Order Dialog: Sending mutation with ${newItemsOnly.length} NEW items and updated order info`,
      );
      createOrderMutation.mutate({
        order: updatedOrder,
        items: newItemsOnly,
        existingItems: updatedExistingItems, // Include updated existing items with new discount values
      });
    } else {
      // Create mode - use exact displayed values
      const subtotalAmount = Math.floor(calculateSubtotal());
      const taxAmount = Math.floor(calculateTax());
      const totalAmount = Math.floor(calculateTotal());

      const order = {
        orderNumber: `ORD-${Date.now()}`,
        tableId: table.id,
        employeeId: null, // Set to null since no employees exist
        customerName: customerName || null,
        customerCount: parseInt(customerCount) || 1,
        subtotal: subtotalAmount.toString(),
        tax: taxAmount.toString(),
        discount: discount.toString(),
        total: totalAmount.toString(),
        status: "served",
        paymentStatus: "pending",
        orderedAt: new Date().toISOString(),
      };

      // Calculate discount distribution for new cart items using SAME logic as display
      let cartItemsWithDiscount = cart.map((item) => {
        const product = products?.find(
          (p: Product) => p.id === item.product.id,
        );
        const basePrice = item.product.price;
        const quantity = item.quantity;
        const priceIncludesTax = storeSettings?.priceIncludesTax || false;

        // Calculate subtotal using SAME logic as calculateSubtotal function
        let itemSubtotal = 0;
        if (priceIncludesTax) {
          // When priceIncludesTax = true: use base price as subtotal (will adjust for tax later)
          itemSubtotal = basePrice * quantity;
        } else {
          // When priceIncludesTax = false: use base price as subtotal
          itemSubtotal = basePrice * quantity;
        }

        // Calculate tax using SAME logic as calculateTax function
        let itemTax = 0;
        let priceBeforeTax = 0;
        if (product?.taxRate && parseFloat(product.taxRate) > 0) {
          const taxRate = parseFloat(product.taxRate) / 100;

          if (priceIncludesTax) {
            // When price includes tax: tax calculation similar to calculateTax
            const giaGomThue = basePrice * quantity;
            priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
            itemTax = giaGomThue - priceBeforeTax;
          } else {
            // When price doesn't include tax: tax = subtotal * taxRate
            priceBeforeTax = itemSubtotal;
            itemTax = Math.round(itemSubtotal * taxRate);
          }
        }

        const itemTotal = itemSubtotal + itemTax;

        return {
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: basePrice.toString(),
          total: itemTotal.toString(),
          discount: "0.00", // Will be calculated below
          tax: Math.round(itemTax).toString(),
          priceBeforeTax: Math.round(priceBeforeTax).toString(),
          notes: item.notes || null,
          basePrice: basePrice,
          itemSubtotal: itemSubtotal,
        };
      });

      // Distribute discount among cart items if there's a discount
      if (discount > 0 && cartItemsWithDiscount.length > 0) {
        const cartSubtotal = cartItemsWithDiscount.reduce(
          (sum, item) => sum + item.itemSubtotal,
          0,
        );
        let allocatedDiscount = 0;

        cartItemsWithDiscount = cartItemsWithDiscount.map((item, index) => {
          let product = products?.find((p: Product) => p.id === item.productId);

          let itemDiscount = 0;

          if (index === cartItemsWithDiscount.length - 1) {
            // Last item gets remaining discount
            itemDiscount = Math.max(0, discount - allocatedDiscount);
          } else {
            // Calculate proportional discount
            itemDiscount =
              cartSubtotal > 0
                ? Math.round((discount * item.itemSubtotal) / cartSubtotal)
                : 0;
            allocatedDiscount += itemDiscount;
          }

          // Calculate tax using SAME logic as calculateTax function
          let itemTax = 0;
          let priceBeforeTax = 0;
          if (product?.taxRate && parseFloat(product.taxRate) > 0) {
            const taxRate = parseFloat(product.taxRate) / 100;

            if (priceIncludesTax) {
              // When price includes tax: tax calculation similar to calculateTax
              const giaGomThue = item.basePrice * item.quantity - itemDiscount;
              priceBeforeTax = Math.round(giaGomThue / (1 + taxRate));
              itemTax = giaGomThue - priceBeforeTax;
            } else {
              // When price doesn't include tax: tax = subtotal * taxRate
              priceBeforeTax = item.itemSubtotal - itemDiscount;
              itemTax = Math.round(item.itemSubtotal * taxRate);
            }
          }

          return {
            ...item,
            tax: Math.round(itemTax).toString(),
            priceBeforeTax: Math.round(priceBeforeTax).toString(),
            discount: itemDiscount.toFixed(2),
          };
        });
      }

      // Clean up the items array for API
      const items = cartItemsWithDiscount.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.basePrice.toString(),
        total: item.total,
        discount: item.discount,
        tax: item.tax,
        priceBeforeTax: item.priceBeforeTax,
        notes: item.notes,
      }));

      console.log("Placing order:", { order, items });
      createOrderMutation.mutate({ order, items });
    }
  };

  const handleClose = () => {
    setCart([]);
    setCustomerName("");
    setCustomerCount(1);
    setDiscount(0);
    setSelectedCategory(null);
    setSearchQuery(""); // Clear search query on close
    // Only clear existing items if we're not in edit mode
    if (mode !== "edit") {
      setExistingItems([]);
    }
    onOpenChange(false);
  };

  useEffect(() => {
    if (table && open) {
      if (mode === "edit" && existingOrder) {
        setCustomerName(existingOrder.customerName || "");
        setCustomerCount(existingOrder.customerCount || 1);
        setDiscount(parseFloat(existingOrder.discount || "0"));
      } else {
        setCustomerCount(Math.min(table.capacity, 1));
        setDiscount(0);
      }
    }
  }, [table, open, mode, existingOrder]);

  useEffect(() => {
    if (
      mode === "edit" &&
      existingOrderItems &&
      Array.isArray(existingOrderItems)
    ) {
      console.log("Setting existing items:", existingOrderItems);
      setExistingItems(existingOrderItems);
    } else if (mode === "edit" && open && existingOrder?.id) {
      // Clear existing items when dialog opens in edit mode but no data yet
      setExistingItems([]);
    }
  }, [mode, existingOrderItems, open, existingOrder?.id]);

  if (!table) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {mode === "edit"
              ? `${t("orders.editOrderTitle")} ${table.tableNumber}`
              : `Bàn ${table.tableNumber}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? t("orders.editOrderDesc").replace(
                  "{orderNumber}",
                  existingOrder?.orderNumber || "",
                )
              : `${t("tables.tableCapacity")}: ${table.capacity}${t("orders.people")} | ${t("tables.selectMenuToOrder")}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
          {/* Menu Selection */}
          <div className="lg:col-span-2 space-y-4 flex flex-col min-h-0">
            {/* Customer Info */}
            <Card className="flex-shrink-0">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="customerName">
                      {t("tables.customerName")} ({t("tables.optional")})
                    </Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t("tables.customerNamePlaceholder")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerCount">
                      {t("tables.customerCount")}
                    </Label>
                    <Input
                      id="customerCount"
                      type="number"
                      min={1}
                      max={table.capacity}
                      value={customerCount}
                      onChange={(e) =>
                        setCustomerCount(parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="discount"
                      className="text-sm font-medium text-gray-700"
                    >
                      {t("reports.discount")} (₫)
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="discount"
                        type="text"
                        value={
                          discount > 0 ? discount.toLocaleString("vi-VN") : ""
                        }
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d]/g, "");
                          setDiscount(parseFloat(value) || 0);
                        }}
                        placeholder="Nhập số tiền giảm giá"
                        className="pl-3 pr-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-gray-400 text-sm">₫</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Tìm kiếm theo tên hoặc SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 flex-shrink-0">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                {t("tables.allCategories")}
              </Button>
              {Array.isArray(categories) &&
                categories
                  .filter((category: Category) => {
                    // Filter out expense categories
                    const categoryName = category.name.toLowerCase();
                    const isExpenseCategory =
                      category.id == 15 || category.id == 17;

                    // Only show categories that have non-expense products
                    const categoryProducts =
                      products?.filter(
                        (p: Product) => p.categoryId === category.id,
                      ) || [];
                    const hasValidProducts = categoryProducts.some(
                      (p: Product) => {
                        const productType =
                          Number(p.productType) !== 2 ||
                          Number(p.productType) !== 4;
                        return productType;
                      },
                    );

                    return !isExpenseCategory && hasValidProducts;
                  })
                  .map((category: Category) => (
                    <Button
                      key={category.id}
                      variant={
                        selectedCategory === category.id ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setSelectedCategory(category.id)}
                      className="whitespace-nowrap"
                    >
                      {category.name}
                    </Button>
                  ))}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 gap-3 overflow-y-auto flex-1 min-h-0">
              {filteredProducts.map((product: Product) => (
                <Card
                  key={product.id}
                  className={`transition-shadow ${
                    Number(product.stock) > 0
                      ? "cursor-pointer hover:shadow-md"
                      : "cursor-not-allowed opacity-60"
                  }`}
                >
                  <CardContent
                    className="p-3"
                    onClick={() =>
                      Number(product.stock) > 0 && addToCart(product)
                    }
                  >
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">{product.name}</h4>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {product.sku}
                      </p>
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span
                            className={`font-bold ${
                              Number(product.stock) > 0
                                ? "text-blue-600"
                                : "text-gray-400"
                            }`}
                          >
                            {(() => {
                              // Check store setting for price display
                              const priceIncludesTax =
                                storeSettings?.priceIncludesTax || false;
                              const basePrice = Number(product.price);
                              const taxRate = Number(product.taxRate || 0);

                              // if (priceIncludesTax && taxRate > 0) {
                              //   // If price includes tax, display price * (1 + tax/100)
                              //   const priceWithTax = basePrice * (1 + taxRate / 100);
                              //   return Math.round(priceWithTax).toLocaleString();
                              // } else {
                              //   // If price doesn't include tax, display base price
                              // }
                              return Math.round(basePrice).toLocaleString();
                            })()}{" "}
                            ₫
                          </span>
                          {product.taxRate && (
                            <span className="text-xs text-gray-500">
                              {t("reports.tax")}: {product.taxRate}%
                            </span>
                          )}
                        </div>
                        <Badge
                          variant={
                            Number(product.stock) > 0
                              ? "default"
                              : "destructive"
                          }
                        >
                          {Number(product.stock) > 0
                            ? `${t("tables.stockCount")} ${product.stock}`
                            : "Hết hàng"}
                        </Badge>
                      </div>
                      {Number(product.stock) === 0 && (
                        <div className="text-xs text-red-500 font-medium">
                          Sản phẩm hiện đang hết hàng
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="flex flex-col min-h-0 h-full">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">
                {mode === "edit"
                  ? t("orders.itemsAndNewItems")
                  : t("tables.orderHistory")}
              </h3>
              <Badge variant="secondary">
                {mode === "edit"
                  ? `${existingItems.length + cart.length} ${t("common.items")}`
                  : `${cart.length}${t("tables.itemsSelected")}`}
              </Badge>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
              {/* Existing Items (Edit Mode Only) */}
              {mode === "edit" && existingItems.length > 0 && (
                <>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-600">
                      {t("orders.previouslyOrdered")}
                    </h4>
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {existingItems.map((item, index) => (
                        <Card key={`existing-${index}`} className="bg-gray-50">
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">
                                  {item.productName}
                                </h4>
                                <p className="text-xs text-gray-500">
                                  {t("orders.alreadyOrdered")}
                                </p>
                                {/* Individual item discount for existing items */}
                                {discount > 0 &&
                                  (() => {
                                    const originalPrice = Number(
                                      item.unitPrice || 0,
                                    );
                                    const quantity = Number(item.quantity || 0);
                                    const itemTotal = originalPrice * quantity;

                                    // Calculate total before discount for all items
                                    const totalBeforeDiscount =
                                      existingItems.reduce((sum, item) => {
                                        return (
                                          sum +
                                          Number(item.unitPrice || 0) *
                                            Number(item.quantity || 0)
                                        );
                                      }, 0) +
                                      cart.reduce((sum, item) => {
                                        return (
                                          sum +
                                          Number(item.product.price) *
                                            item.quantity
                                        );
                                      }, 0);

                                    let itemDiscountAmount = 0;

                                    if (totalBeforeDiscount > 0) {
                                      // Calculate proportional discount
                                      itemDiscountAmount = Math.round(
                                        (discount * itemTotal) /
                                          totalBeforeDiscount,
                                      );
                                    }

                                    return itemDiscountAmount > 0 ? (
                                      <div className="flex items-center gap-1 text-xs text-red-600 mt-1 bg-red-50 px-2 py-0.5 rounded">
                                        <span className="font-medium">
                                          {t("common.discount")}:
                                        </span>
                                        <span className="font-semibold">
                                          -
                                          {itemDiscountAmount.toLocaleString(
                                            "vi-VN",
                                          )}{" "}
                                          ₫
                                        </span>
                                      </div>
                                    ) : null;
                                  })()}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="text-right bg-gray-50 px-3 py-2 rounded-lg">
                                  <div className="text-xs text-gray-500 mb-0.5">
                                    Thành tiền
                                  </div>
                                  <span className="text-sm font-bold text-blue-600">
                                    {(() => {
                                      // Calculate display total based on priceIncludesTax
                                      const unitPrice = parseFloat(
                                        item.unitPrice || "0",
                                      );
                                      const quantity = parseInt(
                                        item.quantity || "0",
                                      );
                                      const itemTotal = unitPrice * quantity;

                                      return Math.floor(
                                        itemTotal,
                                      ).toLocaleString();
                                    })()}{" "}
                                    ₫
                                  </span>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {parseFloat(
                                      item.unitPrice || "0",
                                    ).toLocaleString()}{" "}
                                    ₫ × {item.quantity}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Bạn có chắc chắn muốn xóa "${item.productName}" khỏi đơn hàng?`,
                                      )
                                    ) {
                                      // Remove item from existing items list
                                      setExistingItems((prev) =>
                                        prev.filter((_, i) => i !== index),
                                      );

                                      // Call API to delete the order item
                                      apiRequest(
                                        "DELETE",
                                        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${item.id}`,
                                      )
                                        .then(async () => {
                                          console.log(
                                            "🗑️ Order Dialog: Successfully deleted item:",
                                            item.productName,
                                          );

                                          toast({
                                            title: "Xóa món thành công",
                                            description: `Đã xóa "${item.productName}" khỏi đơn hàng`,
                                          });

                                          // Recalculate order total if this is an existing order
                                          if (existingOrder?.id) {
                                            try {
                                              console.log(
                                                "🧮 Order Dialog: Starting order total recalculation for order:",
                                                existingOrder.id,
                                              );

                                              // Fetch current order items after deletion
                                              const response = await apiRequest(
                                                "GET",
                                                `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items/${existingOrder.id}`,
                                              );
                                              const remainingItems =
                                                await response.json();

                                              console.log(
                                                "📦 Order Dialog: Remaining items after deletion:",
                                                remainingItems?.length || 0,
                                              );

                                              // Calculate new total based on remaining items
                                              let newSubtotal = 0;
                                              let newTax = 0;

                                              if (
                                                Array.isArray(remainingItems) &&
                                                remainingItems.length > 0
                                              ) {
                                                remainingItems.forEach(
                                                  (remainingItem: any) => {
                                                    const basePrice = Number(
                                                      remainingItem.unitPrice ||
                                                        0,
                                                    );
                                                    const quantity = Number(
                                                      remainingItem.quantity ||
                                                        0,
                                                    );
                                                    const product =
                                                      products?.find(
                                                        (p: any) =>
                                                          p.id ===
                                                          remainingItem.productId,
                                                      );

                                                    // Calculate subtotal
                                                    newSubtotal +=
                                                      basePrice * quantity;

                                                    // Calculate tax using Math.floor((after_tax_price - price) * quantity)
                                                    if (
                                                      product?.afterTaxPrice &&
                                                      product.afterTaxPrice !==
                                                        null &&
                                                      product.afterTaxPrice !==
                                                        ""
                                                    ) {
                                                      const afterTaxPrice =
                                                        parseFloat(
                                                          product.afterTaxPrice,
                                                        );
                                                      const taxPerUnit =
                                                        afterTaxPrice -
                                                        basePrice;
                                                      newTax += Math.floor(
                                                        taxPerUnit * quantity,
                                                      );
                                                    }
                                                  },
                                                );
                                              }
                                              // If no items left, totals should be 0
                                              else {
                                                console.log(
                                                  "📝 Order Dialog: No items left, setting totals to zero",
                                                );
                                                newSubtotal = 0;
                                                newTax = 0;
                                              }

                                              const newTotal =
                                                newSubtotal + newTax;

                                              console.log(
                                                "💰 Order Dialog: Calculated new totals:",
                                                {
                                                  newSubtotal,
                                                  newTax,
                                                  newTotal,
                                                  itemsCount:
                                                    remainingItems?.length || 0,
                                                },
                                              );

                                              // Update order with new totals
                                              apiRequest(
                                                "PUT",
                                                `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders/${existingOrder.id}`,
                                                {
                                                  subtotal:
                                                    newSubtotal.toString(),
                                                  tax: newTax.toString(),
                                                  total: newTotal.toString(),
                                                },
                                              ).then(() => {
                                                console.log(
                                                  "✅ Order Dialog: Order totals updated successfully",
                                                );

                                                // Force refresh of all related data to ensure UI updates immediately
                                                Promise.all([
                                                  queryClient.invalidateQueries(
                                                    {
                                                      queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"],
                                                    },
                                                  ),
                                                  queryClient.invalidateQueries(
                                                    {
                                                      queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"],
                                                    },
                                                  ),
                                                  queryClient.invalidateQueries(
                                                    {
                                                      queryKey: [
                                                        "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items",
                                                      ],
                                                    },
                                                  ),
                                                  queryClient.invalidateQueries(
                                                    {
                                                      queryKey: [
                                                        "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items",
                                                        existingOrder.id,
                                                      ],
                                                    },
                                                  ),
                                                ]).then(() => {
                                                  // Force immediate refetch to update table grid display
                                                  return Promise.all([
                                                    queryClient.refetchQueries({
                                                      queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"],
                                                    }),
                                                    queryClient.refetchQueries({
                                                      queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"],
                                                    }),
                                                  ]);
                                                });
                                              });

                                              console.log(
                                                "🔄 Order Dialog: All queries refreshed successfully",
                                              );
                                            } catch (error) {
                                              console.error(
                                                "❌ Order Dialog: Error recalculating order total:",
                                                error,
                                              );
                                              toast({
                                                title: "Cảnh báo",
                                                description:
                                                  "Món đã được xóa nhưng có lỗi khi cập nhật tổng tiền",
                                                variant: "destructive",
                                              });
                                            }
                                          }

                                          // Invalidate queries to refresh data
                                          queryClient.invalidateQueries({
                                            queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/order-items"],
                                          });
                                          queryClient.invalidateQueries({
                                            queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders"],
                                          });
                                        })
                                        .catch((error) => {
                                          console.error(
                                            "Error deleting order item:",
                                            error,
                                          );
                                          // Restore the item if deletion failed
                                          setExistingItems((prev) => [
                                            ...prev.slice(0, index),
                                            item,
                                            ...prev.slice(index),
                                          ]);
                                          toast({
                                            title: "Lỗi xóa món",
                                            description:
                                              "Không thể xóa món khỏi đơn hàng",
                                            variant: "destructive",
                                          });
                                        });
                                    }
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                  {cart.length > 0 && <Separator />}
                  {cart.length > 0 && (
                    <h4 className="text-sm font-medium text-gray-550">
                      {t("orders.newItemsToAdd")}
                    </h4>
                  )}
                </>
              )}

              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{t("tables.noItemsSelected")}</p>
                </div>
              ) : (
                <div
                  className={`${mode === "edit" ? "max-h-[300px]" : "max-h-[520px]"} overflow-y-auto space-y-3`}
                >
                  {cart.map((item) => (
                    <Card key={item.product.id}>
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-sm">
                              {item.product.name}
                            </h4>
                            <span className="text-sm font-bold">
                              {(() => {
                                const priceIncludesTax =
                                  storeSettings?.priceIncludesTax || false;
                                const basePrice = Number(item.product.price);
                                const taxRate = Number(
                                  item.product.taxRate || 0,
                                );
                                const quantity = item.quantity;

                                return Math.round(
                                  basePrice * quantity,
                                ).toLocaleString();
                              })()}{" "}
                              ₫
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeFromCart(item.product.id)}
                                className="h-6 w-6 p-0"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                max={item.product.stock}
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQuantity =
                                    parseInt(e.target.value) || 1;
                                  if (
                                    newQuantity >= 1 &&
                                    newQuantity <= item.product.stock
                                  ) {
                                    setCart((prev) =>
                                      prev.map((cartItem) =>
                                        cartItem.product.id === item.product.id
                                          ? {
                                              ...cartItem,
                                              quantity: newQuantity,
                                            }
                                          : cartItem,
                                      ),
                                    );
                                  }
                                }}
                                className="w-16 h-6 text-center text-sm p-1 border rounded"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addToCart(item.product)}
                                className="h-6 w-6 p-0"
                                disabled={item.quantity >= item.product.stock}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                              <div>
                                {t("tables.unitPrice")}:{" "}
                                {(() => {
                                  const priceIncludesTax =
                                    storeSettings?.priceIncludesTax || false;
                                  const basePrice = Number(item.product.price);
                                  const taxRate = Number(
                                    item.product.taxRate || 0,
                                  );

                                  return Math.round(basePrice).toLocaleString();
                                })()}{" "}
                                ₫
                              </div>
                              {(() => {
                                const basePrice = Number(item.product.price);
                                const quantity = item.quantity;
                                const product = products?.find(
                                  (p: Product) => p.id === item.product.id,
                                );
                                const priceIncludesTax =
                                  storeSettings?.priceIncludesTax || false;
                                const taxRate = product?.taxRate
                                  ? parseFloat(product.taxRate)
                                  : 0;

                                let taxAmount = 0;

                                if (taxRate > 0 && quantity > 0) {
                                  // Calculate item discount first
                                  let itemDiscountAmount = 0;
                                  if (discount > 0) {
                                    const totalBeforeDiscount =
                                      (mode === "edit" && existingItems
                                        ? existingItems.reduce((sum, item) => {
                                            return (
                                              sum +
                                              parseFloat(
                                                item.unitPrice || "0",
                                              ) *
                                                parseInt(item.quantity || "0")
                                            );
                                          }, 0)
                                        : 0) +
                                      cart.reduce((sum, item) => {
                                        return (
                                          sum +
                                          parseFloat(item.product.price) *
                                            item.quantity
                                        );
                                      }, 0);

                                    if (totalBeforeDiscount > 0) {
                                      const itemTotal = basePrice * quantity;
                                      itemDiscountAmount = Math.floor(
                                        (discount * itemTotal) /
                                          totalBeforeDiscount,
                                      );
                                    }
                                  }

                                  if (priceIncludesTax) {
                                    // When price includes tax:
                                    // giá bao gồm thuế = (price - (discount/quantity)) * quantity
                                    const discountPerUnit =
                                      itemDiscountAmount / quantity;
                                    const adjustedPrice = Math.max(
                                      0,
                                      basePrice - discountPerUnit,
                                    );
                                    const giaGomThue = adjustedPrice * quantity;
                                    // subtotal = giá bao gồm thuế / (1 + (taxRate / 100)) (làm tròn)
                                    const tamTinh = Math.round(
                                      giaGomThue / (1 + taxRate / 100),
                                    );
                                    // tax = giá bao gồm thuế - subtotal
                                    taxAmount = giaGomThue - tamTinh;
                                  } else {
                                    // When price doesn't include tax:
                                    // subtotal = (price - (discount/quantity)) * quantity
                                    const discountPerUnit =
                                      itemDiscountAmount / quantity;
                                    const adjustedPrice = Math.max(
                                      0,
                                      basePrice - discountPerUnit,
                                    );
                                    const tamTinh = adjustedPrice * quantity;
                                    // tax = subtotal * (taxRate / 100) (làm tròn)
                                    taxAmount = Math.round(
                                      tamTinh * (taxRate / 100),
                                    );
                                  }
                                }

                                return taxAmount > 0 ? (
                                  <div>
                                    {t("reports.tax")}:{" "}
                                    {Math.max(0, taxAmount).toLocaleString(
                                      "vi-VN",
                                    )}{" "}
                                    ₫
                                  </div>
                                ) : null;
                              })()}
                              {(() => {
                                const originalPrice = Number(item.product.price);
                                const quantity = item.quantity;
                                const itemTotal = originalPrice * quantity;
          
                                // Calculate total before discount for all items
                                const totalBeforeDiscount =
                                  existingItems.reduce((sum, item) => {
                                    return (
                                      sum +
                                      Number(item.unitPrice || 0) *
                                        Number(item.quantity || 0)
                                    );
                                  }, 0) +
                                  cart.reduce((sum, item) => {
                                    return (
                                      sum +
                                      Number(item.product.price) * item.quantity
                                    );
                                  }, 0);
          
                                let itemDiscountAmount = 0;
          
                                if (totalBeforeDiscount > 0) {
                                  // Calculate proportional discount
                                  itemDiscountAmount = Math.round(
                                    (discount * itemTotal) / totalBeforeDiscount,
                                  );
                                }
                                let finalTotal = itemTotal - itemDiscountAmount;

                                return (
                                  <div className="font-medium text-blue-600">
                                    {t("reports.totalMoney")}:{" "}
                                    {Math.floor(finalTotal).toLocaleString()} ₫
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Individual item discount display */}
                          {discount > 0 &&
                            (() => {
                              const originalPrice = Number(item.product.price);
                              const quantity = item.quantity;
                              const itemTotal = originalPrice * quantity;

                              // Calculate total before discount for all items
                              const totalBeforeDiscount =
                                existingItems.reduce((sum, item) => {
                                  return (
                                    sum +
                                    Number(item.unitPrice || 0) *
                                      Number(item.quantity || 0)
                                  );
                                }, 0) +
                                cart.reduce((sum, item) => {
                                  return (
                                    sum +
                                    Number(item.product.price) * item.quantity
                                  );
                                }, 0);

                              let itemDiscountAmount = 0;

                              if (totalBeforeDiscount > 0) {
                                // Calculate proportional discount
                                itemDiscountAmount = Math.round(
                                  (discount * itemTotal) / totalBeforeDiscount,
                                );
                              }

                              return itemDiscountAmount > 0 ? (
                                <div className="text-xs text-red-600 mt-1 text-end">
                                  <span>{t("common.discount")} : </span>
                                  <span>
                                    -{itemDiscountAmount.toLocaleString()} ₫
                                  </span>
                                </div>
                              ) : null;
                            })()}

                          <Textarea
                            placeholder={t("tables.specialRequests")}
                            value={item.notes || ""}
                            onChange={(e) =>
                              updateItemNotes(item.product.id, e.target.value)
                            }
                            className="text-xs h-16"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DialogFooter with Summary and Order Button */}
        {(cart.length > 0 ||
          (mode === "edit" && existingItems.length > 0) ||
          mode === "edit") && (
          <DialogFooter className="pt-4 pb-2 flex-shrink-0 border-t bg-white">
            <div className="flex items-center justify-between w-full">
              {/* Summary items in horizontal layout */}
              <div className="flex items-center gap-4 text-sm flex-wrap">
                {mode === "edit" && existingItems.length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">
                        {t("orders.previousItems")}
                      </span>
                      <span className="font-medium">
                        {Math.floor(
                          existingItems.reduce((total, item) => {
                            // Use unitPrice * quantity for existing items (pre-tax amount)
                            const itemSubtotal =
                              Number(item.unitPrice || 0) *
                              Number(item.quantity || 0);
                            return total + itemSubtotal;
                          }, 0),
                        ).toLocaleString()}{" "}
                        ₫
                      </span>
                    </div>
                    {cart.length > 0 && (
                      <div className="w-px h-4 bg-gray-300"></div>
                    )}
                  </>
                )}
                {cart.length > 0 && mode === "edit" && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">
                        {t("orders.newItems")}
                      </span>
                      <span className="font-medium">
                        {Math.floor(
                          cart.reduce(
                            (total, item) =>
                              total +
                              Number(item.product.price) * item.quantity,
                            0,
                          ),
                        ).toLocaleString()}{" "}
                        ₫
                      </span>
                    </div>
                    <div className="w-px h-4 bg-gray-300"></div>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{t("orders.subtotal")}</span>
                  <span className="font-medium">
                    {Math.floor(calculateSubtotal()).toLocaleString()} ₫
                  </span>
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{t("reports.tax")}</span>
                  <span className="font-medium">
                    {Math.floor(calculateTax()).toLocaleString()} ₫
                  </span>
                </div>
                {discount > 0 && (
                  <>
                    <div className="w-px h-4 bg-gray-300"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">
                        {t("reports.discount")}:
                      </span>
                      <span className="font-medium text-red-600">
                        {" "}
                        -{Math.floor(discount).toLocaleString()} ₫
                      </span>
                    </div>
                  </>
                )}
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-bold">
                    {t("orders.totalAmount")}
                  </span>
                  <span className="font-bold text-lg text-blue-600">
                    {Math.floor(calculateTotal()).toLocaleString()} ₫
                  </span>
                </div>
              </div>

              {/* Action button */}
              <Button
                onClick={handlePlaceOrder}
                disabled={createOrderMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 flex-shrink-0"
                size="lg"
              >
                {createOrderMutation.isPending
                  ? mode === "edit"
                    ? t("orders.updating")
                    : t("tables.placing")
                  : mode === "edit"
                    ? t("orders.updateOrder")
                    : t("tables.placeOrder")}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
