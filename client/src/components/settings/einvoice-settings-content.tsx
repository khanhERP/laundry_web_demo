
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Edit, Trash2, FileText } from "lucide-react";

export function EInvoiceSettingsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Connection form state
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<any>(null);
  const [connectionFormData, setConnectionFormData] = useState({
    symbol: "",
    taxCode: "",
    loginId: "",
    password: "",
    softwareName: "",
    loginUrl: "",
    signMethod: "Ký server",
    cqtCode: "Cấp nhất",
    templateCode: "",
    notes: "",
    isDefault: false,
    isActive: true,
  });

  // Template form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: "",
    templateNumber: "",
    templateCode: "",
    symbol: "",
    useCK: true,
    notes: "",
    isDefault: false,
  });

  // Delete dialogs
  const [showConnectionDeleteDialog, setShowConnectionDeleteDialog] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<any>(null);
  const [showTemplateDeleteDialog, setShowTemplateDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any>(null);

  // Fetch e-invoice connections
  const { data: connections = [], isLoading: connectionsLoading } = useQuery<any[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice-connections"],
  });

  // Fetch invoice templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoice-templates"],
  });

  // Connection mutations
  const createConnectionMutation = useMutation({
    mutationFn: async (data: typeof connectionFormData) => {
      const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice-connections", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice-connections"] });
      toast({
        title: "Thành công",
        description: "Đã tạo kênh kết nối mới",
      });
      setShowConnectionForm(false);
      resetConnectionForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo kênh kết nối",
        variant: "destructive",
      });
    },
  });

  const updateConnectionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof connectionFormData }) => {
      const response = await apiRequest("PUT", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice-connections/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice-connections"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật kênh kết nối",
      });
      setShowConnectionForm(false);
      resetConnectionForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật kênh kết nối",
        variant: "destructive",
      });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice-connections/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/einvoice-connections"] });
      toast({
        title: "Thành công",
        description: "Đã xóa kênh kết nối",
      });
      setShowConnectionDeleteDialog(false);
      setConnectionToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa kênh kết nối",
        variant: "destructive",
      });
    },
  });

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateFormData) => {
      const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoice-templates", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoice-templates"] });
      toast({
        title: "Thành công",
        description: "Đã tạo mẫu hóa đơn mới",
      });
      setShowTemplateForm(false);
      resetTemplateForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo mẫu hóa đơn",
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof templateFormData }) => {
      const response = await apiRequest("PUT", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoice-templates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoice-templates"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật mẫu hóa đơn",
      });
      setShowTemplateForm(false);
      resetTemplateForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật mẫu hóa đơn",
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoice-templates/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/invoice-templates"] });
      toast({
        title: "Thành công",
        description: "Đã xóa mẫu hóa đơn",
      });
      setShowTemplateDeleteDialog(false);
      setTemplateToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa mẫu hóa đơn",
        variant: "destructive",
      });
    },
  });

  // Form handlers
  const resetConnectionForm = () => {
    setConnectionFormData({
      symbol: "",
      taxCode: "",
      loginId: "",
      password: "",
      softwareName: "",
      loginUrl: "",
      signMethod: "Ký server",
      cqtCode: "Cấp nhất",
      templateCode: "",
      notes: "",
      isDefault: false,
      isActive: true,
    });
    setEditingConnection(null);
  };

  const resetTemplateForm = () => {
    setTemplateFormData({
      name: "",
      templateNumber: "",
      templateCode: "",
      symbol: "",
      useCK: true,
      notes: "",
      isDefault: false,
    });
    setEditingTemplate(null);
  };

  const handleEditConnection = (connection: any) => {
    setEditingConnection(connection);
    setConnectionFormData({
      symbol: connection.symbol || "",
      taxCode: connection.taxCode || "",
      loginId: connection.loginId || "",
      password: connection.password || "",
      softwareName: connection.softwareName || "",
      loginUrl: connection.loginUrl || "",
      signMethod: connection.signMethod || "Ký server",
      cqtCode: connection.cqtCode || "Cấp nhất",
      templateCode: connection.templateCode || "",
      notes: connection.notes || "",
      isDefault: connection.isDefault ?? false,
      isActive: connection.isActive ?? true,
    });
    setShowConnectionForm(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setTemplateFormData({
      name: template.name || "",
      templateNumber: template.templateNumber || "",
      templateCode: template.templateCode || "",
      symbol: template.symbol || "",
      useCK: template.useCK ?? true,
      notes: template.notes || "",
      isDefault: template.isDefault ?? false,
    });
    setShowTemplateForm(true);
  };

  const handleConnectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConnection) {
      updateConnectionMutation.mutate({ id: editingConnection.id, data: connectionFormData });
    } else {
      createConnectionMutation.mutate(connectionFormData);
    }
  };

  const handleTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: templateFormData });
    } else {
      createTemplateMutation.mutate(templateFormData);
    }
  };

  const handleDeleteConnection = (connection: any) => {
    setConnectionToDelete(connection);
    setShowConnectionDeleteDialog(true);
  };

  const handleDeleteTemplate = (template: any) => {
    setTemplateToDelete(template);
    setShowTemplateDeleteDialog(true);
  };

  const confirmDeleteConnection = () => {
    if (connectionToDelete) {
      deleteConnectionMutation.mutate(connectionToDelete.id);
    }
  };

  const confirmDeleteTemplate = () => {
    if (templateToDelete) {
      deleteTemplateMutation.mutate(templateToDelete.id);
    }
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle>Thiết lập hóa đơn điện tử</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="connections" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="connections">Kênh kết nối HDDT</TabsTrigger>
            <TabsTrigger value="templates">Mẫu số hóa đơn điện tử</TabsTrigger>
          </TabsList>

          {/* Connections Tab */}
          <TabsContent value="connections" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Quản lý các kênh kết nối hóa đơn điện tử
              </p>
              <Button
                onClick={() => {
                  resetConnectionForm();
                  setShowConnectionForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Thêm kết nối
              </Button>
            </div>

            {connectionsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Chưa có kênh kết nối nào</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Mã số thuế
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ký hiệu
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Phần mềm
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Trạng thái
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {connections.map((connection) => (
                      <tr key={connection.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{connection.taxCode}</td>
                        <td className="px-4 py-3 text-sm">{connection.symbol}</td>
                        <td className="px-4 py-3 text-sm">{connection.softwareName}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              connection.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {connection.isActive ? "Hoạt động" : "Tạm dừng"}
                          </span>
                          {connection.isDefault && (
                            <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              Mặc định
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditConnection(connection)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteConnection(connection)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Quản lý các mẫu số hóa đơn điện tử
              </p>
              <Button
                onClick={() => {
                  resetTemplateForm();
                  setShowTemplateForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Thêm mẫu số
              </Button>
            </div>

            {templatesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Chưa có mẫu số hóa đơn nào</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tên mẫu
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Số mẫu
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Mã mẫu
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ký hiệu
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {templates.map((template) => (
                      <tr key={template.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{template.name}</td>
                        <td className="px-4 py-3 text-sm">{template.templateNumber}</td>
                        <td className="px-4 py-3 text-sm">{template.templateCode}</td>
                        <td className="px-4 py-3 text-sm">{template.symbol}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteTemplate(template)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Connection Form Dialog */}
        <Dialog open={showConnectionForm} onOpenChange={setShowConnectionForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingConnection ? "Chỉnh sửa kênh kết nối" : "Thêm kênh kết nối mới"}
              </DialogTitle>
              <DialogDescription>
                {editingConnection
                  ? "Cập nhật thông tin kênh kết nối hóa đơn điện tử"
                  : "Nhập thông tin kênh kết nối hóa đơn điện tử mới"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleConnectionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Ký hiệu hóa đơn *</Label>
                  <Input
                    id="symbol"
                    placeholder="VD: 01GTKT"
                    value={connectionFormData.symbol}
                    onChange={(e) =>
                      setConnectionFormData({ ...connectionFormData, symbol: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxCode">Mã số thuế *</Label>
                  <Input
                    id="taxCode"
                    placeholder="Nhập mã số thuế"
                    value={connectionFormData.taxCode}
                    onChange={(e) =>
                      setConnectionFormData({ ...connectionFormData, taxCode: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loginId">Tên đăng nhập *</Label>
                  <Input
                    id="loginId"
                    placeholder="Nhập tên đăng nhập"
                    value={connectionFormData.loginId}
                    onChange={(e) =>
                      setConnectionFormData({ ...connectionFormData, loginId: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu *</Label>
                  <Input
                    id="password"
                    type="text"
                    placeholder="Nhập mật khẩu"
                    value={connectionFormData.password}
                    onChange={(e) =>
                      setConnectionFormData({ ...connectionFormData, password: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="softwareName">Tên phần mềm *</Label>
                  <Input
                    id="softwareName"
                    placeholder="VD: EDPOS"
                    value={connectionFormData.softwareName}
                    onChange={(e) =>
                      setConnectionFormData({ ...connectionFormData, softwareName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateCode">Mã mẫu hóa đơn</Label>
                  <Input
                    id="templateCode"
                    placeholder="VD: 01GTKT0/001"
                    value={connectionFormData.templateCode}
                    onChange={(e) =>
                      setConnectionFormData({ ...connectionFormData, templateCode: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loginUrl">URL đăng nhập</Label>
                <Input
                  id="loginUrl"
                  type="url"
                  placeholder="https://..."
                  value={connectionFormData.loginUrl}
                  onChange={(e) =>
                    setConnectionFormData({ ...connectionFormData, loginUrl: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signMethod">Phương thức ký</Label>
                  <Select
                    value={connectionFormData.signMethod}
                    onValueChange={(value) =>
                      setConnectionFormData({ ...connectionFormData, signMethod: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ký server">Ký server</SelectItem>
                      <SelectItem value="USB Token">USB Token</SelectItem>
                      <SelectItem value="HSM">HSM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cqtCode">Mã CQT</Label>
                  <Select
                    value={connectionFormData.cqtCode}
                    onValueChange={(value) =>
                      setConnectionFormData({ ...connectionFormData, cqtCode: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cấp nhất">Cấp nhất</SelectItem>
                      <SelectItem value="Cấp hai">Cấp hai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  placeholder="Nhập ghi chú (nếu có)"
                  value={connectionFormData.notes}
                  onChange={(e) =>
                    setConnectionFormData({ ...connectionFormData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={connectionFormData.isDefault}
                  onCheckedChange={(checked) =>
                    setConnectionFormData({ ...connectionFormData, isDefault: checked })
                  }
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  Đặt làm kết nối mặc định
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={connectionFormData.isActive}
                  onCheckedChange={(checked) =>
                    setConnectionFormData({ ...connectionFormData, isActive: checked })
                  }
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Kích hoạt kết nối này
                </Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConnectionForm(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createConnectionMutation.isPending || updateConnectionMutation.isPending}
                >
                  {createConnectionMutation.isPending || updateConnectionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : editingConnection ? (
                    "Cập nhật"
                  ) : (
                    "Tạo mới"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Template Form Dialog */}
        <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Chỉnh sửa mẫu hóa đơn" : "Thêm mẫu hóa đơn mới"}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate
                  ? "Cập nhật thông tin mẫu hóa đơn điện tử"
                  : "Nhập thông tin mẫu hóa đơn điện tử mới"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTemplateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Tên mẫu *</Label>
                  <Input
                    id="templateName"
                    placeholder="VD: Hóa đơn GTGT"
                    value={templateFormData.name}
                    onChange={(e) =>
                      setTemplateFormData({ ...templateFormData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateNumber">Số mẫu *</Label>
                  <Input
                    id="templateNumber"
                    placeholder="VD: 01GTKT3/001"
                    value={templateFormData.templateNumber}
                    onChange={(e) =>
                      setTemplateFormData({ ...templateFormData, templateNumber: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="templateCodeField">Mã mẫu</Label>
                  <Input
                    id="templateCodeField"
                    placeholder="VD: 01GTKT0/001"
                    value={templateFormData.templateCode}
                    onChange={(e) =>
                      setTemplateFormData({ ...templateFormData, templateCode: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateSymbol">Ký hiệu *</Label>
                  <Input
                    id="templateSymbol"
                    placeholder="VD: AA/25E"
                    value={templateFormData.symbol}
                    onChange={(e) =>
                      setTemplateFormData({ ...templateFormData, symbol: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateNotes">Ghi chú</Label>
                <Textarea
                  id="templateNotes"
                  placeholder="Nhập ghi chú (nếu có)"
                  value={templateFormData.notes}
                  onChange={(e) =>
                    setTemplateFormData({ ...templateFormData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="useCK"
                  checked={templateFormData.useCK}
                  onCheckedChange={(checked) =>
                    setTemplateFormData({ ...templateFormData, useCK: checked })
                  }
                />
                <Label htmlFor="useCK" className="cursor-pointer">
                  Sử dụng chữ ký số
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="templateIsDefault"
                  checked={templateFormData.isDefault}
                  onCheckedChange={(checked) =>
                    setTemplateFormData({ ...templateFormData, isDefault: checked })
                  }
                />
                <Label htmlFor="templateIsDefault" className="cursor-pointer">
                  Đặt làm mẫu mặc định
                </Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTemplateForm(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                >
                  {createTemplateMutation.isPending || updateTemplateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : editingTemplate ? (
                    "Cập nhật"
                  ) : (
                    "Tạo mới"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Connection Dialog */}
        <AlertDialog
          open={showConnectionDeleteDialog}
          onOpenChange={setShowConnectionDeleteDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa kênh kết nối "{connectionToDelete?.softwareName}"?
                Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteConnection}
                className="bg-red-600 hover:bg-red-700"
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Template Dialog */}
        <AlertDialog
          open={showTemplateDeleteDialog}
          onOpenChange={setShowTemplateDeleteDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa mẫu hóa đơn "{templateToDelete?.name}"? Hành động
                này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteTemplate}
                className="bg-red-600 hover:bg-red-700"
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
