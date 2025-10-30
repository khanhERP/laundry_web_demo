import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";

interface SplitOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  orderItems: any[];
  onSplit: (splitData: any) => void;
}

export function SplitOrderModal({
  isOpen,
  onClose,
  order,
  orderItems,
  onSplit,
}: SplitOrderModalProps) {
  const { t } = useTranslation();
  const [newOrders, setNewOrders] = useState<any[]>([]);
  const [currentOrderItems, setCurrentOrderItems] = useState<any[]>([]);
  const [selectedOrderIndex, setSelectedOrderIndex] = useState<number>(0);

  // Fetch table info to get correct table number
  const { data: tablesData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/tables"],
  });

  // Fetch products to get correct tax rates
  const { data: productsData } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
  });

  const getTableNumber = () => {
    if (!order?.tableId || !tablesData) return "N/A";
    const table = tablesData.find((t: any) => t.id === order.tableId);
    return table?.tableNumber || "N/A";
  };

  const getProductTaxRate = (productId: number): number => {
    if (!productsData) return 0;
    const product = productsData.find((p: any) => p.id === productId);
    return product?.taxRate ? parseFloat(product.taxRate) : 0;
  };

  const getCustomerCount = () => {
    return order?.customerCount || 0;
  };

  useEffect(() => {
    if (orderItems && orderItems.length > 0 && order) {
      // Gộp các món giống nhau lại thành một dòng với tổng số lượng
      const mergedItems = new Map<number, any>();

      orderItems.forEach((item) => {
        if (mergedItems.has(item.productId)) {
          const existingItem = mergedItems.get(item.productId);
          existingItem.quantity += item.quantity;
          existingItem.remainingQuantity += item.quantity;
          // Cộng dồn total từ database
          existingItem.total = (
            parseFloat(existingItem.total) + parseFloat(item.total || "0")
          ).toString();
          // Cộng dồn discount nếu có
          existingItem.discount = (
            parseFloat(existingItem.discount || "0") +
            parseFloat(item.discount || "0")
          ).toString();
        } else {
          mergedItems.set(item.productId, {
            ...item,
            taxRate: item.taxRate || "0", // Lưu taxRate từ orderItems gốc
            remainingQuantity: item.quantity,
            discount: item.discount || "0", // Lưu discount từ orderItems gốc
          });
        }
      });

      // Tính tổng để phân bổ proportional từ order.subtotal và order.tax
      const mergedArray = Array.from(mergedItems.values());
      const totalFromItems = mergedArray.reduce(
        (sum, item) => sum + parseFloat(item.total || "0"),
        0,
      );

      // Lấy giá trị CHÍNH XÁC từ order trong database
      const orderSubtotal = Math.floor(Number(order.subtotal || 0));
      const orderTax = Math.floor(Number(order.tax || 0));
      const orderDiscount = Math.floor(Number(order.discount || 0));
      const orderTotal = Math.floor(Number(order.total || 0));

      // Phân bổ thuế proportional cho từng item từ order.tax
      let allocatedTax = 0;
      const itemsWithTax = mergedArray.map((item, index) => {
        const itemTotalFromDB = parseFloat(item.total || "0");

        // Phân bổ thuế proportional theo tỷ lệ total
        let itemTax: number;
        if (index === mergedArray.length - 1) {
          // Item cuối cùng lấy phần còn lại để tránh sai số làm tròn
          itemTax = orderTax - allocatedTax;
        } else {
          itemTax =
            totalFromItems > 0
              ? Math.floor((orderTax * itemTotalFromDB) / totalFromItems)
              : 0;
          allocatedTax += itemTax;
        }

        return {
          ...item,
          allocatedTax: itemTax, // Lưu thuế đã phân bổ
        };
      });

      setCurrentOrderItems(itemsWithTax);
    }
  }, [orderItems, order]);

  useEffect(() => {
    if (order) {
      const newOrderNumber = `ORD-${Date.now()}`;
      setNewOrders([
        {
          name: newOrderNumber,
          items: [],
          tableId: order.tableId, // Lưu tableId từ order gốc
        },
      ]);
    }
  }, [order]);

  const addNewOrder = () => {
    const newOrderNumber = `ORD-${Date.now()}`;
    setNewOrders([
      ...newOrders,
      {
        name: newOrderNumber,
        items: [],
        tableId: order?.tableId, // Lưu tableId từ order gốc
      },
    ]);
  };

  const removeOrder = (index: number) => {
    if (newOrders.length > 1) {
      const removed = newOrders[index];
      // Return items back to current order
      const updatedCurrent = [...currentOrderItems];
      removed.items.forEach((item: any) => {
        const currentItem = updatedCurrent.find((i) => i.id === item.id);
        if (currentItem) {
          currentItem.remainingQuantity += item.quantity;
        }
      });
      setCurrentOrderItems(updatedCurrent);
      setNewOrders(newOrders.filter((_, i) => i !== index));
    }
  };

  const moveItemToNewOrder = (
    item: any,
    newOrderIndex: number,
    quantity: number,
  ) => {
    // Validate quantity
    if (quantity <= 0) {
      console.warn("Cannot move 0 or negative quantity");
      return;
    }

    if (quantity > item.remainingQuantity) {
      console.warn(
        `Cannot move ${quantity}, only ${item.remainingQuantity} remaining`,
      );
      return;
    }

    const updatedCurrent = currentOrderItems.map((i) =>
      i.id === item.id
        ? { ...i, remainingQuantity: i.remainingQuantity - quantity }
        : i,
    );
    setCurrentOrderItems(updatedCurrent);

    const updatedNewOrders = [...newOrders];
    const existingItem = updatedNewOrders[newOrderIndex].items.find(
      (i: any) => i.id === item.id,
    );

    // Lấy tổng số lượng gốc từ database
    const totalQtyInOrder = item.quantity;
    const totalDiscountInDB = parseFloat(item.discount || "0");
    const discountPerUnit =
      totalQtyInOrder > 0 ? totalDiscountInDB / totalQtyInOrder : 0;

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      const unitPrice = parseFloat(existingItem.unitPrice);

      // Lấy discount hiện tại của item
      const currentDiscount = parseFloat(existingItem.discount || "0");

      // Cộng thêm discount cho số lượng mới thêm vào
      const additionalDiscount = Math.floor(discountPerUnit * quantity);
      const newItemDiscount = currentDiscount + additionalDiscount;

      // Tính total = unitPrice * quantity
      const itemSubtotal = Math.floor(unitPrice * newQuantity);
      const newTotal = itemSubtotal;

      existingItem.quantity = newQuantity;
      existingItem.total = newTotal.toString();
      existingItem.discount = newItemDiscount.toString();
    } else {
      const unitPrice = parseFloat(item.unitPrice);

      // Tính discount cho số lượng mới
      const newItemDiscount = Math.floor(discountPerUnit * quantity);

      // Tính total = unitPrice * quantity
      const itemSubtotal = Math.floor(unitPrice * quantity);
      const total = itemSubtotal;

      updatedNewOrders[newOrderIndex].items.push({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: quantity,
        total: total.toString(),
        discount: newItemDiscount.toString(),
        taxRate: item.taxRate || "0",
      });
    }
    setNewOrders(updatedNewOrders);
  };

  const removeItemFromNewOrder = (
    newOrderIndex: number,
    itemId: number,
    quantity: number,
  ) => {
    const updatedCurrent = currentOrderItems.map((i) =>
      i.id === itemId
        ? { ...i, remainingQuantity: i.remainingQuantity + quantity }
        : i,
    );
    setCurrentOrderItems(updatedCurrent);

    const updatedNewOrders = [...newOrders];

    // Tìm item gốc để lấy thông tin discount
    const originalItem = currentOrderItems.find((i) => i.id === itemId);
    const totalQtyInOrder = originalItem ? originalItem.quantity : 0;
    const totalDiscountInDB = originalItem
      ? parseFloat(originalItem.discount || "0")
      : 0;
    const discountPerUnit =
      totalQtyInOrder > 0 ? totalDiscountInDB / totalQtyInOrder : 0;

    updatedNewOrders[newOrderIndex].items = updatedNewOrders[
      newOrderIndex
    ].items
      .map((i: any) => {
        if (i.id === itemId) {
          const newQty = i.quantity - quantity;
          if (newQty > 0) {
            const unitPrice = parseFloat(i.unitPrice);
            const newTotal = Math.floor(unitPrice * newQty);

            // Trừ discount theo số lượng bị xóa
            const currentDiscount = parseFloat(i.discount || "0");
            const removedDiscount = Math.floor(discountPerUnit * quantity);
            const newDiscount = currentDiscount - removedDiscount;

            return {
              ...i,
              quantity: newQty,
              total: newTotal.toString(),
              discount: Math.max(0, newDiscount).toString(),
            };
          }
          return null;
        }
        return i;
      })
      .filter(Boolean);
    setNewOrders(updatedNewOrders);
  };

  const handleSplit = async () => {
    // Filter out orders with no items
    const splitData = newOrders
      .filter((order) => order.items.length > 0)
      .map((order) => {
        // Calculate accurate subtotal, discount, tax, and total for this split order
        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        order.items.forEach((item: any) => {
          const unitPrice = parseFloat(item.unitPrice);
          const quantity = item.quantity;
          const itemDiscount = parseFloat(item.discount || "0");

          const itemTotalBeforeDiscount = unitPrice * quantity;

          // Accumulate discount
          totalDiscount += itemDiscount;

          // Calculate tax for this item proportionally
          const currentItem = currentOrderItems.find(
            (i) => i.productId === item.productId,
          );

          let itemTax = 0;
          let itemSubtotal = 0;

          if (currentItem) {
            const itemTaxFromOrder = parseFloat(
              currentItem.allocatedTax || "0",
            );
            const totalQtyInOrder = parseFloat(currentItem.quantity || "0");

            itemTax = Math.floor(
              (itemTaxFromOrder / totalQtyInOrder) * quantity,
            );
            totalTax += itemTax;
          }

          // Calculate subtotal: price before tax (after discount)
          if (priceIncludesTax) {
            // When price includes tax: subtotal = (price * qty) - discount - tax
            itemSubtotal = itemTotalBeforeDiscount - itemDiscount - itemTax;
          } else {
            // When price doesn't include tax: subtotal = (price * qty) - discount
            itemSubtotal = itemTotalBeforeDiscount - itemDiscount;
          }

          subtotal += itemSubtotal;
        });

        // Calculate total
        let total = 0;
        if (priceIncludesTax) {
          // When price includes tax: total = subtotal + tax
          total = subtotal + totalTax;
        } else {
          // When price doesn't include tax: total = subtotal + tax
          total = subtotal + totalTax;
        }

        return {
          name: order.name,
          items: order.items.map((item: any) => {
            const unitPrice = parseFloat(item.unitPrice);
            const quantity = item.quantity;
            const itemDiscount = parseFloat(item.discount || "0");

            // Get product to calculate tax
            const currentItem = currentOrderItems.find(
              (i) => i.productId === item.productId,
            );

            let itemTax = 0;
            let priceBeforeTax = 0;

            if (currentItem) {
              const itemTaxFromOrder = parseFloat(
                currentItem.allocatedTax || "0",
              );
              const totalQtyInOrder = parseFloat(currentItem.quantity || "0");

              // Calculate tax for this item proportionally
              itemTax = Math.floor(
                (itemTaxFromOrder / totalQtyInOrder) * quantity,
              );

              // Calculate priceBeforeTax based on priceIncludesTax setting
              if (priceIncludesTax) {
                // When price includes tax: priceBeforeTax = (unitPrice * quantity - discount) / (1 + taxRate/100)
                const taxRate = parseFloat(item.taxRate || "0") / 100;
                const totalWithDiscount = unitPrice * quantity - itemDiscount;
                priceBeforeTax =
                  taxRate > 0
                    ? Math.floor(totalWithDiscount / (1 + taxRate))
                    : totalWithDiscount;
                priceBeforeTax = priceBeforeTax - itemTax;
              } else {
                // When price doesn't include tax: priceBeforeTax = unitPrice * quantity - discount
                priceBeforeTax = Math.floor(unitPrice * quantity);
              }
            }

            return {
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: (parseFloat(item.unitPrice) * item.quantity).toString(),
              discount: item.discount || "0",
              taxRate: item.taxRate || "0",
              tax: Math.floor(itemTax).toString(),
              priceBeforeTax: Math.floor(priceBeforeTax).toString(),
            };
          }),
          tableId: order?.tableId,
          subtotal: Math.floor(subtotal).toString(),
          tax: Math.floor(totalTax).toString(),
          discount: Math.floor(totalDiscount).toString(),
          total: Math.floor(total).toString(),
          parentOrderId: order?.id,
          priceIncludeTax: priceIncludesTax,
          customerName: order?.customerName || "Khách hàng",
          customerCount: order?.customerCount || 1,
        };
      });

    if (splitData.length === 0) {
      alert("Vui lòng thêm món vào ít nhất 1 đơn mới");
      return;
    }

    // Calculate remaining order's subtotal, discount, tax, and total
    let remainingSubtotal = 0;
    let remainingDiscount = 0;
    let remainingTax = 0;

    const remainingItems = currentOrderItems
      .filter((item) => item.remainingQuantity > 0)
      .map((item) => {
        const unitPrice = parseFloat(item.unitPrice);
        const quantity = item.remainingQuantity;
        const totalQtyInOrder = parseFloat(item.quantity || "0");
        const itemDiscount = parseFloat(item.discount || "0");

        const itemDiscountForRemaining = Math.floor(
          (itemDiscount / totalQtyInOrder) * quantity,
        );

        const itemTotalBeforeDiscount = unitPrice * quantity;
        remainingDiscount += itemDiscountForRemaining;

        // Calculate tax for remaining items
        const itemTaxFromOrder = parseFloat(item.allocatedTax || "0");
        const itemTax = Math.floor(
          (itemTaxFromOrder / totalQtyInOrder) * quantity,
        );
        remainingTax += itemTax;

        // Calculate priceBeforeTax and subtotal based on priceIncludesTax setting
        let priceBeforeTax = 0;
        let itemSubtotal = 0;

        if (priceIncludesTax) {
          // When price includes tax: subtotal = (price * qty) - discount - tax
          itemSubtotal =
            itemTotalBeforeDiscount - itemDiscountForRemaining - itemTax;
          priceBeforeTax = itemSubtotal;
        } else {
          // When price doesn't include tax: subtotal = (price * qty) - discount
          itemSubtotal = itemTotalBeforeDiscount - itemDiscountForRemaining;
          priceBeforeTax = itemSubtotal;
        }

        remainingSubtotal += itemSubtotal;

        return {
          productId: item.productId,
          quantity: quantity,
          unitPrice: item.unitPrice,
          total: (unitPrice * quantity).toString(),
          discount: itemDiscountForRemaining.toString(),
          tax: Math.floor(itemTax).toString(),
          priceBeforeTax: Math.floor(priceBeforeTax).toString(),
        };
      });

    let remainingTotal = 0;
    if (priceIncludesTax) {
      remainingTotal = remainingSubtotal + remainingTax;
    } else {
      remainingTotal = remainingSubtotal + remainingTax;
    }

    // Call onSplit and wait for completion
    await onSplit({
      originalOrderId: order?.id,
      splitItems: splitData,
      remainingItems: remainingItems,
      originalOrderUpdate: {
        subtotal: Math.floor(remainingSubtotal).toString(),
        tax: Math.floor(remainingTax).toString(),
        discount: Math.floor(remainingDiscount).toString(),
        total: Math.floor(remainingTotal).toString(),
      },
    });

    // Force immediate data refresh after split
    // Dispatch event to force refresh
    window.dispatchEvent(
      new CustomEvent("forceDataRefresh", {
        detail: {
          source: "split_order_modal",
          reason: "order_split_completed",
          timestamp: new Date().toISOString(),
        },
      }),
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get priceIncludesTax from the ORDER, not from store settings
  const priceIncludesTax = order?.priceIncludeTax ?? false;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Tách order - Order {order?.orderNumber || `ORD-${order?.id}`} - Bàn{" "}
            {getTableNumber()}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Left: Current Order Items */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold mb-4 text-lg">
              Order {order?.orderNumber || `ORD-${order?.id}`} - Bàn{" "}
              {getTableNumber()}
              <span className="ml-2 text-sm text-gray-500">
                ({getCustomerCount()} người)
              </span>
            </h3>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 font-bold text-sm bg-gray-100 p-2 rounded">
                <div className="col-span-3">Tên món</div>
                <div className="col-span-1 text-center">SL</div>
                <div className="col-span-2 text-right">
                  {t("pos.totalAmount").replace(":", "")}
                </div>
                <div className="col-span-2 text-right">
                  {t("reports.discount")}
                </div>
                <div className="col-span-2 text-right">{t("reports.tax")}</div>
                <div className="col-span-2 text-right">
                  {t("reports.totalMoney")}
                </div>
              </div>
              {currentOrderItems
                .filter((item) => item.remainingQuantity > 0)
                .map((item) => {
                  // Lấy thông tin cơ bản
                  const remainingQty = item.remainingQuantity;
                  const totalQtyInOrder = parseFloat(item.quantity || "0");
                  const unitPrice = parseFloat(item.unitPrice || "0");
                  const taxRate = getProductTaxRate(item.productId) / 100;

                  // Lấy total và discount từ database
                  const totalFromDB = parseFloat(item.total || "0");
                  const discountFromDB = parseFloat(item.discount || "0");

                  // Tính proportional cho phần còn lại
                  const itemTotalForRemaining = Math.floor(
                    (totalFromDB / totalQtyInOrder) * remainingQty,
                  );
                  const itemDiscountForRemaining = Math.floor(
                    (discountFromDB / totalQtyInOrder) * remainingQty,
                  );

                  // ✅ Tạm tính = price * quantity (TRƯỚC KHI trừ discount)
                  const itemSubtotalBeforeDiscount = Math.floor(
                    unitPrice * remainingQty,
                  );

                  // ✅ Sử dụng thuế đã phân bổ từ order.tax (proportional)
                  const itemTaxFromOrder = parseFloat(item.allocatedTax || "0");

                  // Tính thuế cho phần còn lại theo tỷ lệ
                  const itemTax = Math.floor(
                    (itemTaxFromOrder / totalQtyInOrder) * remainingQty,
                  );

                  // Tính tổng tiền
                  let itemTotal = 0;
                  if (priceIncludesTax) {
                    // Giá đã bao gồm thuế: tổng tiền = tạm tính - giảm giá
                    itemTotal =
                      itemSubtotalBeforeDiscount - itemDiscountForRemaining;
                  } else {
                    // Giá chưa bao gồm thuế: tổng tiền = tạm tính - giảm giá + thuế
                    itemTotal =
                      itemSubtotalBeforeDiscount -
                      itemDiscountForRemaining +
                      itemTax;
                  }

                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-center text-sm border-b pb-2"
                    >
                      <div className="col-span-3">{item.productName}</div>
                      <div className="col-span-1 text-center font-semibold text-blue-600">
                        {remainingQty}
                      </div>
                      <div className="col-span-2 text-right">
                        {formatCurrency(itemSubtotalBeforeDiscount)}
                      </div>
                      <div className="col-span-2 text-right text-red-600">
                        {itemDiscountForRemaining > 0
                          ? `-${formatCurrency(itemDiscountForRemaining)} ₫`
                          : "0 ₫"}
                      </div>
                      <div className="col-span-2 text-right text-green-600">
                        {formatCurrency(itemTax)}
                      </div>
                      <div className="col-span-2 text-right font-semibold">
                        {formatCurrency(itemTotal)}
                      </div>
                    </div>
                  );
                })}
              {currentOrderItems.filter((item) => item.remainingQuantity > 0)
                .length === 0 && (
                <div className="text-center text-gray-400 py-4 text-sm">
                  Tất cả món đã được tách
                </div>
              )}

              {/* Move buttons section */}
              {(() => {
                // Calculate total quantity of all products
                const totalQuantity = currentOrderItems.reduce(
                  (sum, item) => sum + item.remainingQuantity,
                  0,
                );
                const hasItemsToMove =
                  currentOrderItems.filter((item) => item.remainingQuantity > 0)
                    .length > 0;

                return hasItemsToMove && totalQuantity > 1 ? (
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="text-sm font-semibold text-blue-700 mb-2">
                      Chọn đơn đích bên phải, sau đó click nút để chuyển món:
                    </div>
                    <div className="space-y-2">
                      {currentOrderItems
                        .filter((item) => item.remainingQuantity > 0)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between bg-white p-2 rounded"
                          >
                            <span className="text-sm">{item.productName}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                moveItemToNewOrder(item, selectedOrderIndex, 1)
                              }
                              disabled={item.remainingQuantity === 0}
                              className="h-7 px-3"
                            >
                              Chuyển 1 →
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Right: New Orders */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">
                Tách mới món thành {newOrders.length} order
                <span className="ml-3 text-sm text-gray-600">
                  (Click vào đơn để chọn đích, sau đó bấm → để đẩy món)
                </span>
              </h3>
              {(() => {
                // Calculate total quantity of all products
                const totalQuantity = currentOrderItems.reduce(
                  (sum, item) => sum + item.remainingQuantity,
                  0,
                );
                return totalQuantity > 1 ? (
                  <Button onClick={addNewOrder} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Thêm order
                  </Button>
                ) : null;
              })()}
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {newOrders.map((newOrder, orderIdx) => (
                <div
                  key={orderIdx}
                  onClick={() => setSelectedOrderIndex(orderIdx)}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedOrderIndex === orderIdx
                      ? "bg-blue-100 border-blue-500 shadow-md"
                      : "bg-blue-50 border-gray-300 hover:bg-blue-75"
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h4
                      className={`font-semibold ${
                        selectedOrderIndex === orderIdx
                          ? "text-blue-800"
                          : "text-blue-700"
                      }`}
                    >
                      {newOrder.name}
                      {selectedOrderIndex === orderIdx && (
                        <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                          Đang chọn
                        </span>
                      )}
                    </h4>
                    {newOrders.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeOrder(orderIdx);
                          // Nếu xóa đơn đang chọn, chuyển về đơn đầu tiên
                          if (selectedOrderIndex === orderIdx) {
                            setSelectedOrderIndex(0);
                          } else if (selectedOrderIndex > orderIdx) {
                            setSelectedOrderIndex(selectedOrderIndex - 1);
                          }
                        }}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold bg-blue-100 p-1 rounded">
                      <div className="col-span-5">Tên món</div>
                      <div className="col-span-3 text-right">Tổng tiền</div>
                      <div className="col-span-4 text-center">SL Tách</div>
                    </div>
                    {newOrder.items.length === 0 ? (
                      <div className="text-center text-gray-400 py-4 text-sm">
                        Chưa có món nào
                      </div>
                    ) : (
                      <>
                        {newOrder.items.map((item: any) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-2 items-center text-sm bg-white p-2 rounded"
                          >
                            <div className="col-span-5">{item.productName}</div>
                            <div className="col-span-3 text-right">
                              {formatCurrency(
                                parseFloat(item.unitPrice) * item.quantity,
                              )}
                            </div>
                            <div className="col-span-4 flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeItemFromNewOrder(orderIdx, item.id, 1);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center font-semibold">
                                {item.quantity}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentItem = currentOrderItems.find(
                                    (i) => i.id === item.id,
                                  );
                                  if (
                                    currentItem &&
                                    currentItem.remainingQuantity > 0
                                  ) {
                                    moveItemToNewOrder(
                                      currentItem,
                                      orderIdx,
                                      1,
                                    );
                                  }
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeItemFromNewOrder(
                                    orderIdx,
                                    item.id,
                                    item.quantity,
                                  );
                                }}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        {/* Subtotal, Discount, Tax, and Total */}
                        <div className="border-t pt-2 mt-2 space-y-1 bg-blue-50 p-2 rounded">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {t("pos.totalAmount")}
                            </span>
                            <span className="font-medium">
                              {(() => {
                                let subtotal = 0;

                                newOrder.items.forEach((item: any) => {
                                  const unitPrice = parseFloat(item.unitPrice);
                                  const quantity = item.quantity;
                                  subtotal += unitPrice * quantity;
                                });

                                return formatCurrency(Math.floor(subtotal));
                              })()}{" "}
                              ₫
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-red-600">
                            <span>{t("reports.discount")}:</span>
                            <span className="font-medium">
                              -
                              {(() => {
                                const totalDiscount = newOrder.items.reduce(
                                  (sum: number, item: any) => {
                                    const itemDiscount = parseFloat(
                                      item.discount || "0",
                                    );
                                    return sum + itemDiscount;
                                  },
                                  0,
                                );
                                return formatCurrency(
                                  Math.floor(totalDiscount),
                                );
                              })()}{" "}
                              ₫
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-green-600">
                            <span>{t("reports.tax")}:</span>
                            <span className="font-medium">
                              {(() => {
                                let tax = 0;

                                newOrder.items.forEach((item: any) => {
                                  const currentItem = currentOrderItems.find(
                                    (i) => i.productId === item.productId,
                                  );
                                  if (currentItem) {
                                    const itemTaxFromOrder = parseFloat(
                                      currentItem.allocatedTax || "0",
                                    );
                                    const totalQtyInOrder = parseFloat(
                                      currentItem.quantity || "0",
                                    );
                                    const itemTax = Math.floor(
                                      (itemTaxFromOrder / totalQtyInOrder) *
                                        item.quantity,
                                    );
                                    tax += itemTax;
                                  }
                                });

                                return formatCurrency(Math.floor(tax));
                              })()}{" "}
                              ₫
                            </span>
                          </div>
                          <div className="flex justify-between text-sm font-bold border-t pt-1">
                            <span className="text-blue-700">
                              {t("reports.totalMoney")}:
                            </span>
                            <span className="text-blue-700">
                              {(() => {
                                let subtotal = 0;
                                let totalDiscount = 0;
                                let totalTax = 0;

                                newOrder.items.forEach((item: any) => {
                                  const unitPrice = parseFloat(item.unitPrice);
                                  const quantity = item.quantity;
                                  const itemDiscount = parseFloat(
                                    item.discount || "0",
                                  );

                                  subtotal += unitPrice * quantity;
                                  totalDiscount += itemDiscount;

                                  const currentItem = currentOrderItems.find(
                                    (i) => i.productId === item.productId,
                                  );

                                  if (currentItem) {
                                    const itemTaxFromOrder = parseFloat(
                                      currentItem.allocatedTax || "0",
                                    );
                                    const totalQtyInOrder = parseFloat(
                                      currentItem.quantity || "0",
                                    );
                                    totalTax += Math.floor(
                                      (itemTaxFromOrder / totalQtyInOrder) *
                                        quantity,
                                    );
                                  }
                                });

                                let total = 0;
                                if (priceIncludesTax) {
                                  total = subtotal - totalDiscount;
                                } else {
                                  total = subtotal - totalDiscount + totalTax;
                                }

                                return formatCurrency(Math.floor(total));
                              })()}{" "}
                              ₫
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button
            onClick={handleSplit}
            disabled={!newOrders.some((o) => o.items.length > 0)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Đồng ý
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
