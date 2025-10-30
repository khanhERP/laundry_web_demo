import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Printer,
  Plus,
  Trash2,
  TestTube,
  Wifi,
  Usb,
  Bluetooth,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";

interface PrinterConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PrinterConfig {
  id: number;
  name: string;
  printerType: string;
  connectionType: string;
  ipAddress?: string;
  port?: number | null;
  macAddress?: string;
  isEmployee: boolean;
  isKitchen: boolean;
  isActive: boolean;
  copies?: number;
}

export function PrinterConfigModal({
  isOpen,
  onClose,
}: PrinterConfigModalProps) {
  const { t } = useTranslation();
  const [selectedConfig, setSelectedConfig] = useState<PrinterConfig | null>(
    null,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [formData, setFormData] = useState({
    name: "",
    printerType: "thermal",
    connectionType: "usb",
    ipAddress: "",
    port: null,
    macAddress: "",
    floor: "1",
    zone: "A",
    isEmployee: false,
    isKitchen: false,
    isActive: true,
    copies: 0,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch printer configurations
  const { data: printerConfigs = [], isLoading } = useQuery({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"],
    queryFn: async () => {
      const response = await apiRequest("GET", "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs");
      return response.json();
    },
    enabled: isOpen,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always refetch fresh data
  });

  // Create printer config mutation
  const createConfigMutation = useMutation({
    mutationFn: async (configData: any) => {
      const response = await apiRequest(
        "POST",
        "https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs",
        configData,
      );
      return response.json();
    },
    onSuccess: () => {
      // Force refetch data
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"] });
      queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"] });
      toast({ title: "Thành công", description: "Đã thêm cấu hình máy in" });
      resetForm();
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể thêm cấu hình máy in",
        variant: "destructive",
      });
    },
  });

  // Update printer config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest(
        "PUT",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs/${id}`,
        data,
      );
      return response.json();
    },
    onSuccess: () => {
      // Force refetch data
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"] });
      queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật cấu hình máy in",
      });
      resetForm();
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật cấu hình máy in",
        variant: "destructive",
      });
    },
  });

  // Delete printer config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs/${id}`);
    },
    onSuccess: () => {
      // Force refetch data
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"] });
      queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs"] });
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

  // Test printer connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(
        "POST",
        `https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/printer-configs/${id}/test`,
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Kết nối thành công" : "Kết nối thất bại",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể kiểm tra kết nối",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      printerType: "thermal",
      connectionType: "usb",
      ipAddress: "",
      port: null,
      macAddress: "",
      floor: "1",
      zone: "A",
      isEmployee: false,
      isKitchen: false,
      isActive: true,
      copies: 0,
    });
    setSelectedConfig(null);
    setIsEditing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedConfig) {
      updateConfigMutation.mutate({ id: selectedConfig.id, data: formData });
    } else {
      createConfigMutation.mutate(formData);
    }
  };

  const handleEdit = (config: PrinterConfig) => {
    setSelectedConfig(config);
    setFormData({
      name: config.name,
      printerType: config.printerType,
      connectionType: config.connectionType,
      ipAddress: config.ipAddress || "",
      port: config.port || null,
      macAddress: config.macAddress || "",
      floor: config.floor || "1",
      zone: config.zone || "A",
      isEmployee: config.isEmployee,
      isKitchen: config.isKitchen,
      isActive: config.isActive,
      copies: config.copies || 0,
    });
    setIsEditing(true);
  };

  const handleToggleStatus = (config: PrinterConfig, newStatus: boolean) => {
    // Update the current printer status - only send necessary fields
    const updateData = {
      name: config.name,
      printerType: config.printerType,
      connectionType: config.connectionType,
      ipAddress: config.ipAddress,
      port: config.port,
      macAddress: config.macAddress,
      paperWidth: config.paperWidth,
      printSpeed: config.printSpeed,
      isEmployee: config.isEmployee,
      isKitchen: config.isKitchen,
      isActive: newStatus,
    };

    updateConfigMutation.mutate({
      id: config.id,
      data: updateData,
    });
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case "network":
        return <Wifi className="h-4 w-4" />;
      case "bluetooth":
        return <Bluetooth className="h-4 w-4" />;
      default:
        return <Usb className="h-4 w-4" />;
    }
  };

  // Calculate pagination
  const totalItems = printerConfigs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedConfigs = printerConfigs.slice(startIndex, endIndex);

  // Reset page when configs change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalItems, totalPages, currentPage]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {t("pos.printerConfiguration")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Printer Configuration Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {isEditing ? t("pos.editPrinter") : t("pos.addNewPrinter")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("pos.printerName")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="VD: Máy in quầy 1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="printerType">{t("pos.printerType")}</Label>
                  <Select
                    value={formData.printerType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, printerType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thermal">
                        {t("pos.thermal")}
                      </SelectItem>
                      <SelectItem value="inkjet">{t("pos.inkjet")}</SelectItem>
                      <SelectItem value="laser">{t("pos.laser")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="connectionType">
                    {t("pos.connectionType")}
                  </Label>
                  <Select
                    value={formData.connectionType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, connectionType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usb">USB</SelectItem>
                      <SelectItem value="network">
                        {t("pos.network")}
                      </SelectItem>
                      <SelectItem value="bluetooth">
                        {t("pos.bluetooth")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.connectionType === "usb" && (
                  <div>
                    <Label htmlFor="productId">Product ID (USB)</Label>
                    <Input
                      id="productId"
                      type="text"
                      value={formData.macAddress}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          macAddress: e.target.value,
                        })
                      }
                      placeholder="VD: 1234 hoặc USB-PRINTER-001"
                    />
                  </div>
                )}

                {formData.connectionType === "network" && (
                  <>
                    <div>
                      <Label htmlFor="ipAddress">{t("pos.ipAddress")}</Label>
                      <Input
                        id="ipAddress"
                        value={formData.ipAddress}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ipAddress: e.target.value,
                          })
                        }
                        placeholder="192.168.1.100"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="port">{t("pos.port")}</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            port: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          })
                        }
                      />
                    </div>
                  </>
                )}

                {formData.connectionType === "bluetooth" && (
                  <div>
                    <Label htmlFor="macAddress">{t("pos.macAddress")}</Label>
                    <Input
                      id="macAddress"
                      value={formData.macAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, macAddress: e.target.value })
                      }
                      placeholder="00:11:22:33:44:55"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="floor">{t("tables.floorLabel")}</Label>
                    <Select
                      value={formData.floor || "1"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, floor: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("tables.floorPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t("common.floor")} 1</SelectItem>
                        <SelectItem value="2">{t("common.floor")} 2</SelectItem>
                        <SelectItem value="3">{t("common.floor")} 3</SelectItem>
                        <SelectItem value="4">{t("common.floor")} 4</SelectItem>
                        <SelectItem value="5">{t("common.floor")} 5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="zone">{t("tables.zoneLabel")}</Label>
                    <Select
                      value={formData.zone || "A"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, zone: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("tables.zonePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">{t("common.zone")} A</SelectItem>
                        <SelectItem value="B">{t("common.zone")} B</SelectItem>
                        <SelectItem value="C">{t("common.zone")} C</SelectItem>
                        <SelectItem value="D">{t("common.zone")} D</SelectItem>
                        <SelectItem value="E">{t("common.zone")} E</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isEmployee"
                    checked={formData.isEmployee}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isEmployee: checked })
                    }
                  />
                  <Label htmlFor="isEmployee">{t("pos.employeePrinter")}</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isKitchen"
                    checked={formData.isKitchen}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isKitchen: checked })
                    }
                  />
                  <Label htmlFor="isKitchen">{t("pos.kitchenPrinter")}</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
                  <Label htmlFor="isActive">{t("pos.inUse")}</Label>
                </div>

                <div>
                  <Label htmlFor="copies">Số lần in</Label>
                  <Input
                    id="copies"
                    type="number"
                    min="0"
                    value={formData.copies || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        copies: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="Nhập số lần in"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={
                      createConfigMutation.isPending ||
                      updateConfigMutation.isPending
                    }
                    className="flex-1"
                  >
                    {isEditing ? t("pos.update") : t("pos.addNew")}
                  </Button>
                  {isEditing && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      {t("pos.cancel")}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Printer List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t("pos.printerList")}</span>
                {totalItems > 0 && (
                  <span className="text-sm text-gray-500">
                    ({totalItems} {t("pos.printers")})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">{t("pos.loading")}</div>
              ) : printerConfigs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Printer className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t("pos.noPrinterConfigs")}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedConfigs.map((config: PrinterConfig) => (
                      <div
                        key={config.id}
                        className={`border rounded-lg p-3 ${!config.isActive ? "opacity-60 bg-gray-50" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getConnectionIcon(config.connectionType)}
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {config.name}
                                {!config.isActive && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    {t("pos.off")}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                {config.printerType} - {config.connectionType}
                                {config.connectionType === "usb" &&
                                  config.macAddress && (
                                    <span>
                                      {" "}
                                      (Product ID: {config.macAddress})
                                    </span>
                                  )}
                                {config.connectionType === "network" &&
                                  config.ipAddress && (
                                    <span>
                                      {" "}
                                      ({config.ipAddress}:
                                      {config.port || "auto"})
                                    </span>
                                  )}
                                <br />
                                <span className="text-xs text-blue-600">
                                  Số lần in: {config.copies || 0}
                                </span>
                                {config.floor && config.zone && (
                                  <>
                                    <br />
                                    <span className="text-xs text-green-600">
                                      {t("common.floor")} {config.floor} - {t("common.zone")} {config.zone}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {config.isEmployee && config.isActive && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {t("pos.employee")}
                              </span>
                            )}
                            {config.isKitchen && config.isActive && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                {t("pos.kitchen")}
                              </span>
                            )}
                            {config.isActive && (
                              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">
                                {t("pos.using")}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(config)}
                            >
                              {t("pos.edit")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                deleteConfigMutation.mutate(config.id)
                              }
                              disabled={deleteConfigMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          <Switch
                            checked={config.isActive}
                            onCheckedChange={(checked) =>
                              handleToggleStatus(config, checked)
                            }
                            disabled={updateConfigMutation.isPending}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-500">
                        {t("common.showing")} {startIndex + 1}-
                        {Math.min(endIndex, totalItems)} {t("common.of")}{" "}
                        {totalItems} {t("pos.printers")}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          {t("common.previous")}
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => (
                            <Button
                              key={i + 1}
                              variant={
                                currentPage === i + 1 ? "default" : "outline"
                              }
                              size="sm"
                              className="min-w-[40px]"
                              onClick={() => setCurrentPage(i + 1)}
                            >
                              {i + 1}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          {t("common.next")}
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t("pos.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
