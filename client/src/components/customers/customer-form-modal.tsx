import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/lib/i18n";
import { format } from "date-fns";
import type { Customer, InsertCustomer } from "@shared/schema";
import { z } from "zod";

const customerFormSchema = z.object({
  customerId: z.string().optional(),
  name: z.string().min(1, "Tên khách hàng là bắt buộc"),
  phone: z.string().min(1, "Số điện thoại là bắt buộc"),
  email: z.string().optional().or(z.literal("")).refine((email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), {
    message: "Email không hợp lệ"
  }),
  address: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  membershipLevel: z.enum(["SILVER", "GOLD", "VIP"]).optional(),
  notes: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  initialPhone?: string;
}

export function CustomerFormModal({ isOpen, onClose, customer, initialPhone }: CustomerFormModalProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("info");

  // Fetch customer order history
  const { data: orderHistory, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', customer?.id],
    queryFn: async () => {
      if (!customer?.id) return [];

      // Fetch all orders and filter by customer ID on client side
      const response = await apiRequest("GET", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/orders`);
      const allOrders = await response.json();

      // Filter orders that belong to this customer
      // Prioritize customerId match, then fallback to phone/name
      return allOrders.filter((order: any) => {
        // Primary match: customerId
        if (order.customerId === customer.id) {
          return true;
        }

        // Fallback matches for orders created before customerId was added
        const matchesPhone = customer.phone && order.customerPhone === customer.phone;
        const matchesName = customer.name && order.customerName === customer.name;

        return matchesPhone || matchesName;
      });
    },
    enabled: isOpen && !!customer?.id,
  });

  // Generate customer ID for new customers
  const generateCustomerId = async () => {
    try {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers/next-id");
      const data = await response.json();
      return data.nextId;
    } catch (error) {
      console.error("Error generating customer ID:", error);
      return "CUST001";
    }
  };

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      customerId: customer?.customerId || "",
      name: customer?.name || "",
      phone: customer?.phone || initialPhone || "",
      email: customer?.email || "",
      address: customer?.address || "",
      dateOfBirth: customer?.dateOfBirth || "",
      membershipLevel: customer?.membershipLevel || "SILVER",
      notes: customer?.notes || "",
      status: customer?.status || "active",
    },
  });

  // Reset form when customer changes and auto-generate ID for new customers
  useEffect(() => {
    if (customer && customer.id) {
      // Edit mode - customer has an ID
      form.reset({
        customerId: customer.customerId,
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        dateOfBirth: customer.dateOfBirth || "",
        membershipLevel: customer.membershipLevel || "Silver",
        notes: customer.notes || "",
        status: customer.status || "active",
      });
    } else {
      // Add mode - no customer or customer without ID
      generateCustomerId().then((nextId) => {
        form.reset({
          customerId: nextId,
          name: "",
          phone: initialPhone || "",
          email: "",
          address: "",
          dateOfBirth: "",
          membershipLevel: "SILVER",
          notes: "",
          status: "active",
        });
      });
    }
  }, [customer, initialPhone, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      // Clean data - remove empty strings and set to undefined
      const cleanData = {
        ...data,
        email: data.email?.trim() || undefined,
        address: data.address?.trim() || undefined,
        dateOfBirth: data.dateOfBirth?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
      };
      const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers", cleanData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers"] });
      toast({
        title: "common.success",
        description: customer ? "customers.customerUpdated" : "customers.customerAdded",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || "고객 정보 저장에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!customer?.id) {
        throw new Error("Customer ID is missing");
      }
      // Clean data - remove empty strings and set to undefined
      const cleanData = {
        ...data,
        email: data.email?.trim() || undefined,
        address: data.address?.trim() || undefined,
        dateOfBirth: data.dateOfBirth?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
      };
      const response = await apiRequest("PUT", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers/${customer.id}`, cleanData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers"] });
      toast({
        title: t('common.success'),
        description: "Cập nhật thông tin khách hàng thành công",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      console.error("Customer update error:", error);
      toast({
        title: t('common.error'),
        description: error.message || "Cập nhật thông tin khách hàng thất bại",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: CustomerFormData) => {
    // Check if we're editing an existing customer (has ID)
    if (customer?.id) {
      // Editing existing customer - send customerId for display purposes only
      const cleanData = {
        ...data,
        customerId: data.customerId,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        notes: data.notes || undefined,
      };
      console.log("Updating customer with ID:", customer.id, "Data:", cleanData);
      updateMutation.mutate(cleanData);
    } else {
      // Creating new customer - generate customerId for display
      let customerIdToUse = data.customerId;
      
      if (!customerIdToUse || customerIdToUse === t('common.autoGenerated')) {
        try {
          const response = await fetch('https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers/next-id');
          const { nextId } = await response.json();
          customerIdToUse = nextId;
        } catch (error) {
          console.error("Failed to generate customer ID:", error);
          toast({
            title: t('common.error'),
            description: "Không thể tạo mã khách hàng",
            variant: "destructive",
          });
          return;
        }
      }

      // Don't send 'id' field, let database auto-generate it
      const cleanData = {
        name: data.name,
        customerId: customerIdToUse,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        membershipLevel: data.membershipLevel,
        notes: data.notes || undefined,
        status: data.status,
      };
      console.log("Creating new customer with data:", cleanData);
      createMutation.mutate(cleanData);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      preparing: "bg-purple-100 text-purple-800",
      served: "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return statusColors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer?.id ? t('customers.editCustomer') : t('customers.addCustomer')}</DialogTitle>
          <DialogDescription>
            {t('customers.customerFormDesc')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">{t('customers.customerFormTitle')}</TabsTrigger>
            <TabsTrigger value="orders" disabled={!customer?.id}>
              {t('customers.history')}
              {orderHistory && orderHistory.length > 0 && (
                <Badge variant="secondary" className="ml-2">{orderHistory.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('customers.customerId')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={customer?.id ? t('customers.customerId') : t('common.autoGenerated')}
                            disabled={true} // Always disabled, auto-generated for new or fixed for existing
                            className="bg-gray-50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('customers.name')} *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('customers.namePlaceholder')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('customers.phone')} *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('customers.phonePlaceholder')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('customers.email')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder={t('customers.emailPlaceholder')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('customers.address')}</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder={t('customers.addressPlaceholder')} rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('customers.birthday')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="membershipLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('customers.membershipLevel')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('common.select')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SILVER">{t('customers.silver')}</SelectItem>
                            <SelectItem value="GOLD">{t('customers.gold')}</SelectItem>
                            <SelectItem value="VIP">{t('customers.vip')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('customers.status')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('common.select')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">{t('common.active')}</SelectItem>
                          <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.notes')}</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder={t('common.notesPlaceholder')} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {customer?.id ? t('common.update') : t('common.create')}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {ordersLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : orderHistory && orderHistory.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                          {t('common.no')}
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">
                          {t('orders.createdDate')}
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">
                          {t('orders.orderNumber')}
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                          {t('common.total')}
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                          {t('common.status')}
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                          {t('orders.paymentStatus')}
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          {t('common.notes')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orderHistory.map((order: any, index: number) => (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {format(new Date(order.orderedAt || order.createdAt), 'dd/MM/yyyy HH:mm')}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-blue-600">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Navigate to sales orders page with order filter
                                window.location.href = `/sales-orders?order=${order.orderNumber}`;
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer bg-transparent border-none p-0"
                              title="Click để xem chi tiết đơn hàng"
                            >
                              {order.orderNumber}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-sm text-right font-semibold text-green-600 whitespace-nowrap">
                            {parseFloat(order.total || 0).toLocaleString('vi-VN')}đ
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge className={getStatusBadge(order.status)}>
                              {order.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge className={order.isPaid ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                              {order.isPaid === true ? t('common.paid') : t('common.unpaid')}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 truncate max-w-xs">
                            {order.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">{t('customers.noOrderHistory')}</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}