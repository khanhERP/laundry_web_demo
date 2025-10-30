
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Mail, Phone } from "lucide-react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get user info from localStorage and update when modal opens
  const getUserInfo = () => {
    const stored = localStorage.getItem("userInfo");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse userInfo:", e);
        return {};
      }
    }
    return {};
  };

  const [userInfo, setUserInfo] = useState(getUserInfo());
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    userName: userInfo.userName || "",
    email: userInfo.email || "",
    phone: userInfo.phone || "",
  });

  // Reload user info when modal opens
  useEffect(() => {
    if (isOpen) {
      const latestUserInfo = getUserInfo();
      setUserInfo(latestUserInfo);
      setFormData({
        userName: latestUserInfo.userName || "",
        email: latestUserInfo.email || "",
        phone: latestUserInfo.phone || "",
      });
    }
  }, [isOpen]);

  const updateUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/users/${userInfo.userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update user");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Update localStorage
      const updatedUserInfo = { ...userInfo, ...formData };
      localStorage.setItem("userInfo", JSON.stringify(updatedUserInfo));
      setUserInfo(updatedUserInfo);
      
      toast({
        title: "Thành công",
        description: "Cập nhật thông tin thành công",
      });
      
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/users"] });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật thông tin",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateUserMutation.mutate(formData);
  };

  const handleClose = () => {
    setIsEditing(false);
    setFormData({
      userName: userInfo.userName || "",
      email: userInfo.email || "",
      phone: userInfo.phone || "",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Thông tin tài khoản
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="userName" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Tên người dùng
            </Label>
            <Input
              id="userName"
              value={formData.userName}
              onChange={(e) =>
                setFormData({ ...formData, userName: e.target.value })
              }
              disabled={!isEditing}
              className={!isEditing ? "bg-gray-50" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              disabled={!isEditing}
              className={!isEditing ? "bg-gray-50" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Số điện thoại
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              disabled={!isEditing}
              className={!isEditing ? "bg-gray-50" : ""}
            />
          </div>

          <div className="bg-gradient-to-br from-green-50 to-blue-50 p-6 rounded-lg border border-green-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Thông tin tài khoản
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
                <span className="text-gray-600 text-sm">ID:</span>
                <p className="font-semibold text-gray-900">{userInfo.id || userInfo.userId || "N/A"}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
                <span className="text-gray-600 text-sm">Mã cửa hàng:</span>
                <p className="font-semibold text-gray-900">{userInfo.storeCode || "N/A"}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
                <span className="text-gray-600 text-sm">Loại người dùng:</span>
                <p className="font-semibold text-gray-900">
                  {userInfo.typeUser === 1 || userInfo.typeUser === "1" ? "Admin" : "Nhân viên"}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
                <span className="text-gray-600 text-sm">Mã PIN:</span>
                <p className="font-semibold text-gray-900">{userInfo.pinCode || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    userName: userInfo.userName || "",
                    email: userInfo.email || "",
                    phone: userInfo.phone || "",
                  });
                }}
              >
                Hủy
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Đóng
              </Button>
              <Button onClick={() => setIsEditing(true)}>Sửa</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
