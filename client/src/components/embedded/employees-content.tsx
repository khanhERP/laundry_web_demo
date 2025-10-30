import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Edit, Trash2, Search } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import type { Employee } from "@shared/schema";
import { EmployeeFormModal } from "@/components/employees/employee-form-modal";

export default function EmployeesPageContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: employeesData, isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/employees"],
  });

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleDeleteEmployee = async (employeeId: number) => {
    if (!confirm(t("employees.confirmDelete"))) return;

    try {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/employees/${employeeId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      await queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/employees"] });
      toast({ title: t("common.success"), description: t("employees.deleteSuccess") });
    } catch (error) {
      toast({ title: t("common.error"), description: t("employees.deleteError"), variant: "destructive" });
    }
  };

  const filteredEmployees = employeesData?.filter((employee: Employee) =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (employee.phone && employee.phone.includes(searchTerm))
  ) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {t("employees.employeeManagement")}
              </CardTitle>
              <CardDescription>{t("employees.description")}</CardDescription>
            </div>
            <Button
            onClick={() => {
              setEditingEmployee(null);
              setShowEmployeeForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("employees.addEmployee")}
          </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <Input
                placeholder={t("employees.searchPlaceholder")}
                className="w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button variant="outline" size="sm">
                <Search className="w-4 h-4 mr-2" />
                {t("common.search")}
              </Button>
            </div>
          </div>

          {employeesLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{t("common.loading")}</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">{t("employees.noEmployees")}</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="grid grid-cols-6 gap-4 p-4 font-medium text-sm text-gray-600 bg-gray-50 border-b">
                <div>{t("employees.name")}</div>
                <div>{t("employees.phone")}</div>
                <div>{t("employees.position")}</div>
                <div>{t("employees.email")}</div>
                <div>{t("common.status")}</div>
                <div className="text-center">{t("common.actions")}</div>
              </div>

              <div className="divide-y">
                {filteredEmployees.map((employee) => (
                  <div key={employee.id} className="grid grid-cols-6 gap-4 p-4 items-center">
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-sm text-gray-600">{employee.phone || "-"}</div>
                    <div className="text-sm text-gray-600">{employee.position || "-"}</div>
                    <div className="text-sm text-gray-600">{employee.email || "-"}</div>
                    <div>
                      <Badge variant="default" className="bg-green-500 text-white">
                        {t("common.active")}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditEmployee(employee)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteEmployee(employee.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeFormModal
        isOpen={showEmployeeForm}
        onClose={() => { setShowEmployeeForm(false); setEditingEmployee(null); }}
        mode={editingEmployee ? "edit" : "create"}
        employee={editingEmployee || undefined}
      />
    </div>
  );
}