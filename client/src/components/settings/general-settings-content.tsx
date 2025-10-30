import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface GeneralSetting {
  id: number;
  settingCode: string;
  settingName: string;
  settingValue?: string;
  description?: string;
  isActive: boolean;
  storeCode?: string;
  createdAt: string;
  updatedAt: string;
}

export function GeneralSettingsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch general settings
  const { data: settings = [], isLoading } = useQuery<GeneralSetting[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/general-settings"],
  });

  // Update setting active status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, isActive, settingCode }: { id: number; isActive: boolean; settingCode?: string }) => {
      // Handle mutual exclusion between ST-002 and ST-003
      if (settingCode === "ST-002") {
        const st003 = settings.find(s => s.settingCode === "ST-003");
        if (st003) {
          // ST-002 bật → ST-003 tắt, ST-002 tắt → ST-003 bật
          await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/general-settings/${st003.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !isActive }),
            credentials: "include",
          });
        }
      } else if (settingCode === "ST-003") {
        const st002 = settings.find(s => s.settingCode === "ST-002");
        if (st002) {
          // ST-003 bật → ST-002 tắt, ST-003 tắt → ST-002 bật
          await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/general-settings/${st002.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !isActive }),
            credentials: "include",
          });
        }
      }

      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/general-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update setting status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/general-settings"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật trạng thái thiết lập",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái thiết lập",
        variant: "destructive",
      });
    },
  });



  // Group settings by revenue section
  const revenueSettings = settings.filter(
    (s) => s.settingCode === "ST-002" || s.settingCode === "ST-003"
  );
  const otherSettings = settings.filter(
    (s) => s.settingCode !== "ST-002" && s.settingCode !== "ST-003"
  );

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle>Thiết lập chung - Bán hàng</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Đang tải...</div>
        ) : settings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Chưa có thiết lập nào.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Revenue Settings Group */}
            {revenueSettings.length > 0 && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-green-600 rounded-full"></div>
                  <h3 className="text-lg font-bold text-green-800">
                    Doanh thu bán hàng theo ngày
                  </h3>
                </div>
                <div className="space-y-3">
                  {revenueSettings.map((setting) => (
                    <div
                      key={setting.id}
                      className="flex items-center justify-between p-4 bg-white border border-green-200 rounded-lg hover:shadow-md hover:border-green-300 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <h4 className="font-semibold text-gray-800">
                          {setting.settingName}
                        </h4>
                      </div>
                      <Switch
                        checked={setting.isActive}
                        onCheckedChange={(checked) =>
                          updateStatusMutation.mutate({
                            id: setting.id,
                            isActive: checked,
                            settingCode: setting.settingCode,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Settings Group */}
            {otherSettings.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                  <h3 className="text-lg font-bold text-blue-800">
                    Thiết lập khác
                  </h3>
                </div>
                <div className="space-y-3">
                  {otherSettings.map((setting) => (
                    <div
                      key={setting.id}
                      className="flex items-center justify-between p-4 bg-white border border-blue-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <h4 className="font-semibold text-gray-800">
                          {setting.settingName}
                        </h4>
                      </div>
                      <Switch
                        checked={setting.isActive}
                        onCheckedChange={(checked) =>
                          updateStatusMutation.mutate({
                            id: setting.id,
                            isActive: checked,
                            settingCode: setting.settingCode,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}