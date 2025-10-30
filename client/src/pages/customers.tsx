
import { useState } from "react";
import { POSHeader } from "@/components/pos/header";
import { RightSidebar } from "@/components/ui/right-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Users, CreditCard, Plus, Edit, Trash2, Search, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Customer } from "@shared/schema";
import { CustomerFormModal } from "@/components/customers/customer-form-modal";
import { CustomerPointsModal } from "@/components/customers/customer-points-modal";
import { MembershipModal } from "@/components/membership/membership-modal";
import { PointsManagementModal } from "@/components/customers/points-management-modal";
import { Link } from "wouter";

interface CustomersPageProps {
  onLogout: () => void;
}

export default function CustomersPage({ onLogout }: CustomersPageProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showPointsManagementModal, setShowPointsManagementModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Fetch customers
  const { data: customersData, isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers"],
  });

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowCustomerForm(true);
  };

  const handleDeleteCustomer = async (customerId: number) => {
    if (!confirm(t("customers.confirmDelete"))) return;

    try {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers/${customerId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/customers"] });

      toast({
        title: t("common.success"),
        description: t("settings.customerDeleteSuccess"),
      });
    } catch (error) {
      console.error("Customer delete error:", error);
      toast({
        title: t("common.error"),
        description: t("settings.customerDeleteError"),
        variant: "destructive",
      });
    }
  };

  const handleManagePoints = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowPointsModal(true);
  };

  const handleCloseCustomerForm = () => {
    setShowCustomerForm(false);
    setEditingCustomer(null);
  };

  // Filter customers based on search term
  const filteredCustomers = customersData
    ? customersData.filter(
        (customer: Customer) =>
          customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
          customer.customerId.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
          (customer.phone && customer.phone.includes(customerSearchTerm)),
      )
    : [];

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-green-50 grocery-bg">
      <POSHeader onLogout={onLogout} />
      <RightSidebar />
      
      <div className="main-content pt-16 px-6">
        <div className="max-w-7xl mx-auto py-8">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t("customers.title")}</h1>
              <p className="mt-2 text-gray-600">{t("customers.description")}</p>
            </div>
            <div className="flex gap-4">
              <Link href="/sales-orders">
                <Button variant="outline">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t('nav.pos')}
                </Button>
              </Link>
              <Button onClick={() => setShowCustomerForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t("customers.addCustomer")}
              </Button>
            </div>
          </div>

          {/* Customer Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t("customers.totalCustomers")}
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {customersData ? customersData.length : 0}
                    </p>
                  </div>
                  <UserCheck className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t("customers.activeCustomers")}
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {customersData
                        ? customersData.filter((c) => c.status === "active").length
                        : 0}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t("customers.pointsIssued")}
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {customersData
                        ? customersData
                            .reduce((total, c) => total + (c.points || 0), 0)
                            .toLocaleString()
                        : 0}
                    </p>
                  </div>
                  <CreditCard className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t("customers.averageSpent")}
                    </p>
                    <p className="text-2xl font-bold text-orange-600">
                      {customersData && customersData.length > 0
                        ? Math.round(
                            customersData.reduce(
                              (total, c) => total + parseFloat(c.totalSpent || "0"),
                              0,
                            ) / customersData.length,
                          ).toLocaleString()
                        : "0"}{" "}
                      ₫
                    </p>
                  </div>
                  <CreditCard className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Management */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-600" />
                {t("customers.customerManagement")}
              </CardTitle>
              <CardDescription>
                {t("customers.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder={t("customers.searchPlaceholder")}
                    className="w-64"
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  />
                  <Button variant="outline" size="sm">
                    <Search className="w-4 h-4 mr-2" />
                    {t("common.search")}
                  </Button>
                </div>
              </div>

              {customersLoading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">{t("customers.loadingCustomerData")}</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8">
                  <UserCheck className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">{t("customers.noRegisteredCustomers")}</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <div className="grid grid-cols-8 gap-4 p-4 font-medium text-sm text-gray-600 bg-gray-50 border-b">
                    <div>{t("customers.customerId")}</div>
                    <div>{t("customers.name")}</div>
                    <div>{t("customers.phone")}</div>
                    <div>{t("customers.visitCount")}</div>
                    <div>{t("customers.totalSpent")}</div>
                    <div>{t("customers.points")}</div>
                    <div>{t("customers.membershipLevel")}</div>
                    <div className="text-center">{t("common.actions")}</div>
                  </div>

                  <div className="divide-y">
                    {paginatedCustomers.map((customer) => (
                      <div key={customer.id} className="grid grid-cols-8 gap-4 p-4 items-center">
                        <div className="font-mono text-sm">{customer.customerId}</div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-600">{customer.phone || "-"}</div>
                        <div className="text-center">{customer.visitCount || 0}</div>
                        <div className="text-sm font-medium">
                          {parseFloat(customer.totalSpent || "0").toLocaleString()} ₫
                        </div>
                        <div className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            onClick={() => handleManagePoints(customer)}
                          >
                            {customer.points || 0}P
                          </Button>
                        </div>
                        <div>
                          <Badge
                            variant="default"
                            className={`${
                              customer.membershipLevel === "VIP"
                                ? "bg-purple-500"
                                : customer.membershipLevel === "GOLD"
                                  ? "bg-yellow-500"
                                  : customer.membershipLevel === "SILVER"
                                    ? "bg-gray-300 text-black"
                                    : "bg-gray-400"
                            } text-white`}
                          >
                            {customer.membershipLevel === "VIP"
                              ? t("customers.vip")
                              : customer.membershipLevel === "GOLD"
                                ? t("customers.gold")
                                : customer.membershipLevel === "SILVER"
                                  ? t("customers.silver")
                                  : customer.membershipLevel}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCustomer(customer)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-500 hover:text-blue-700"
                            onClick={() => handleManagePoints(customer)}
                          >
                            <CreditCard className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteCustomer(customer.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pagination Controls */}
              {filteredCustomers.length > 0 && (
                <div className="flex items-center justify-between space-x-6 py-4 border-t">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">{t("common.show")} </p>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="top">
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm font-medium"> {t("common.rows")}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">
                      {t("common.page")} {currentPage} / {totalPages}
                    </p>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <ChevronLeft className="h-4 w-4 -ml-3" />
                      </button>
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
                      >
                        <ChevronRight className="h-4 w-4" />
                        <ChevronRight className="h-4 w-4 -ml-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-gray-600">
                  {t("customers.total")} {filteredCustomers.length}{" "}
                  {t("customers.totalCustomersRegistered")}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMembershipModal(true)}
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    {t("customers.membershipManagement")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPointsManagementModal(true)}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {t("customers.pointsManagement")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Customer Form Modal */}
      <CustomerFormModal
        isOpen={showCustomerForm}
        onClose={handleCloseCustomerForm}
        customer={editingCustomer}
      />

      {/* Customer Points Modal */}
      {selectedCustomer && (
        <CustomerPointsModal
          open={showPointsModal}
          onOpenChange={setShowPointsModal}
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
        />
      )}

      {/* Membership Management Modal */}
      <MembershipModal
        isOpen={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
      />

      {/* Points Management Modal */}
      <PointsManagementModal
        isOpen={showPointsManagementModal}
        onClose={() => setShowPointsManagementModal(false)}
      />
    </div>
  );
}
