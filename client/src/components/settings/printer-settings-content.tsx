import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Printer, Plus, Pencil, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PrinterConfig {
  id: number;
  name: string;
  printerType: string;
  connectionType: string;
  ipAddress: string | null;
  port: number | null;
  macAddress: string | null;
  paperWidth: number;
  printSpeed: number | null;
  isEmployee: boolean;
  isKitchen: boolean;
  isActive: boolean;
  copies: number;
  floor: string;
  zone: string;
  storeCode: string | null;
}

export function PrinterSettingsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [printerToDelete, setPrinterToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    printerType: "thermal",
    connectionType: "usb",
    ipAddress: "",
    port: 9100,
    macAddress: "",
    paperWidth: 80,
    printSpeed: 100,
    isEmployee: false,
    isKitchen: false,
    isActive: true,
    copies: 1,
    floor: "1",
    zone: "A",
  });

  // Fetch printer configs
  const { data: printers = [], isLoading } = useQuery<PrinterConfig[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"] });
      toast({ title: "Thành công", description: "Đã thêm cấu hình máy in" });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể thêm cấu hình máy in",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PUT", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"] });
      toast({ title: "Thành công", description: "Đã cập nhật cấu hình máy in" });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật cấu hình máy in",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"] });
      toast({ title: "Thành công", description: "Đã xóa cấu hình máy in" });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa cấu hình máy in",
        variant: "destructive",
      });
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs/${id}/toggle-status`);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ 
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"],
        type: 'active'
      });
      toast({ title: "Thành công", description: "Đã thay đổi trạng thái máy in" });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể thay đổi trạng thái máy in",
        variant: "destructive",
      });
    },
  });

  // Toggle employee status mutation
  const toggleEmployeeMutation = useMutation({
    mutationFn: async ({ id, printer }: { id: number; printer: PrinterConfig }) => {
      const updateData = {
        name: printer.name,
        printerType: printer.printerType,
        connectionType: printer.connectionType,
        ipAddress: printer.ipAddress,
        port: printer.port,
        macAddress: printer.macAddress,
        paperWidth: printer.paperWidth,
        printSpeed: printer.printSpeed,
        isEmployee: !printer.isEmployee,
        isKitchen: printer.isKitchen,
        isActive: printer.isActive,
        copies: printer.copies,
        floor: printer.floor,
        zone: printer.zone,
      };
      const response = await apiRequest("PUT", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs/${id}`, updateData);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ 
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"],
        type: 'active'
      });
      toast({ title: "Thành công", description: "Đã cập nhật trạng thái in nhân viên" });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái in nhân viên",
        variant: "destructive",
      });
    },
  });

  // Toggle kitchen status mutation
  const toggleKitchenMutation = useMutation({
    mutationFn: async ({ id, printer }: { id: number; printer: PrinterConfig }) => {
      const updateData = {
        name: printer.name,
        printerType: printer.printerType,
        connectionType: printer.connectionType,
        ipAddress: printer.ipAddress,
        port: printer.port,
        macAddress: printer.macAddress,
        paperWidth: printer.paperWidth,
        printSpeed: printer.printSpeed,
        isEmployee: printer.isEmployee,
        isKitchen: !printer.isKitchen,
        isActive: printer.isActive,
        copies: printer.copies,
        floor: printer.floor,
        zone: printer.zone,
      };
      const response = await apiRequest("PUT", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs/${id}`, updateData);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ 
        queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"],
        type: 'active'
      });
      toast({ title: "Thành công", description: "Đã cập nhật trạng thái in bếp" });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái in bếp",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (printer?: PrinterConfig) => {
    if (printer) {
      setEditingPrinter(printer);
      setFormData({
        name: printer.name,
        printerType: printer.printerType,
        connectionType: printer.connectionType,
        ipAddress: printer.ipAddress || "",
        port: printer.port || 9100,
        macAddress: printer.macAddress || "",
        paperWidth: printer.paperWidth,
        printSpeed: printer.printSpeed || 100,
        isEmployee: printer.isEmployee,
        isKitchen: printer.isKitchen,
        isActive: printer.isActive,
        copies: printer.copies,
        floor: printer.floor,
        zone: printer.zone,
      });
    } else {
      setEditingPrinter(null);
      setFormData({
        name: "",
        printerType: "thermal",
        connectionType: "usb",
        ipAddress: "",
        port: 9100,
        macAddress: "",
        paperWidth: 80,
        printSpeed: 100,
        isEmployee: false,
        isKitchen: false,
        isActive: true,
        copies: 1,
        floor: "1",
        zone: "A",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPrinter(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      ...formData,
      port: formData.connectionType === "network" ? formData.port : null,
      ipAddress: formData.connectionType === "network" ? formData.ipAddress : null,
      macAddress: formData.connectionType === "bluetooth" ? formData.macAddress : null,
    };

    if (editingPrinter) {
      updateMutation.mutate({ id: editingPrinter.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: number) => {
    setPrinterToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (printerToDelete) {
      deleteMutation.mutate(printerToDelete);
      setDeleteConfirmOpen(false);
      setPrinterToDelete(null);
    }
  };

  const handleEdit = (printer: PrinterConfig) => {
    handleOpenDialog(printer);
  };

  const handleToggleStatus = (printer: PrinterConfig) => {
    toggleStatusMutation.mutate(printer.id);
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-green-600" />
          Cấu hình máy in
        </CardTitle>
        <Button onClick={() => handleOpenDialog()} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Thêm máy in
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Đang tải...</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Tên máy in</TableHead>
                  <TableHead className="whitespace-nowrap">Kết nối</TableHead>
                  <TableHead className="whitespace-nowrap">Số bản</TableHead>
                  <TableHead className="whitespace-nowrap">Nhân viên</TableHead>
                  <TableHead className="whitespace-nowrap">Bếp</TableHead>
                  <TableHead className="whitespace-nowrap">Trạng thái</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Chưa có cấu hình máy in nào
                    </TableCell>
                  </TableRow>
                ) : (
                  printers.map((printer) => (
                    <TableRow key={printer.id}>
                      <TableCell className="font-medium">{printer.name}</TableCell>
                      <TableCell>
                        {printer.connectionType === "usb" ? "USB" :
                         printer.connectionType === "network" ? `Mạng (${printer.ipAddress})` :
                         "Bluetooth"}
                      </TableCell>
                      <TableCell>{printer.copies}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={printer.isEmployee}
                            onChange={() => toggleEmployeeMutation.mutate({ id: printer.id, printer })}
                            className="w-4 h-4 cursor-pointer accent-green-600"
                            disabled={toggleEmployeeMutation.isPending}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={printer.isKitchen}
                            onChange={() => toggleKitchenMutation.mutate({ id: printer.id, printer })}
                            className="w-4 h-4 cursor-pointer accent-green-600"
                            disabled={toggleKitchenMutation.isPending}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={printer.isActive}
                            onChange={() => toggleStatusMutation.mutate(printer.id)}
                            className="w-4 h-4 cursor-pointer accent-green-600"
                            disabled={toggleStatusMutation.isPending}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(printer)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(printer.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Dialog for Add/Edit */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPrinter ? "Sửa cấu hình máy in" : "Thêm máy in mới"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên máy in *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="printerType">Loại máy in</Label>
                  <Select
                    value={formData.printerType}
                    onValueChange={(value) => setFormData({ ...formData, printerType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thermal">Máy in nhiệt</SelectItem>
                      <SelectItem value="inkjet">Máy in phun mực</SelectItem>
                      <SelectItem value="laser">Máy in laser</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="connectionType">Loại kết nối</Label>
                  <Select
                    value={formData.connectionType}
                    onValueChange={(value) => setFormData({ ...formData, connectionType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usb">USB</SelectItem>
                      <SelectItem value="network">Mạng</SelectItem>
                      <SelectItem value="bluetooth">Bluetooth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paperWidth">Khổ giấy (mm)</Label>
                  <Select
                    value={formData.paperWidth.toString()}
                    onValueChange={(value) => setFormData({ ...formData, paperWidth: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58">58mm</SelectItem>
                      <SelectItem value="80">80mm</SelectItem>
                      <SelectItem value="112">112mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.connectionType === "network" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="ipAddress">Địa chỉ IP</Label>
                      <Input
                        id="ipAddress"
                        value={formData.ipAddress}
                        onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                        placeholder="192.168.1.100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="port">Cổng</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                      />
                    </div>
                  </>
                )}

                {formData.connectionType === "bluetooth" && (
                  <div className="space-y-2">
                    <Label htmlFor="macAddress">Địa chỉ MAC</Label>
                    <Input
                      id="macAddress"
                      value={formData.macAddress}
                      onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                      placeholder="00:11:22:33:44:55"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="printSpeed">Tốc độ in (mm/s)</Label>
                  <Input
                    id="printSpeed"
                    type="number"
                    value={formData.printSpeed}
                    onChange={(e) => setFormData({ ...formData, printSpeed: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="copies">Số bản in</Label>
                  <Input
                    id="copies"
                    type="number"
                    min="0"
                    value={formData.copies}
                    onChange={(e) => setFormData({ ...formData, copies: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="floor">Tầng</Label>
                  <Input
                    id="floor"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zone">Khu vực</Label>
                  <Input
                    id="zone"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isEmployee">In hóa đơn nhân viên</Label>
                  <Switch
                    id="isEmployee"
                    checked={formData.isEmployee}
                    onCheckedChange={(checked) => setFormData({ ...formData, isEmployee: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="isKitchen">In hóa đơn bếp</Label>
                  <Switch
                    id="isKitchen"
                    checked={formData.isKitchen}
                    onCheckedChange={(checked) => setFormData({ ...formData, isKitchen: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Kích hoạt</Label>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Hủy
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  {editingPrinter ? "Cập nhật" : "Thêm mới"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa cấu hình máy in này? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setDeleteConfirmOpen(false);
                setPrinterToDelete(null);
              }}>
                Hủy
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
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