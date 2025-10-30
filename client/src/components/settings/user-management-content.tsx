import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, X, Eye, EyeOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";

interface UserData {
  id: number;
  userName: string;
  storeName: string;
  storeCode: string;
  isAdmin: boolean;
  typeUser: number;
  parent?: string;
}

export function UserManagementContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    userName: "",
    password: "",
    storeName: "",
    storeCode: "",
    isAdmin: false,
    parent: "",
  });
  const [selectedParentStores, setSelectedParentStores] = useState<string[]>(
    [],
  );

  // Fetch users with typeUser = 1
  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"],
    select: (data) => data.filter((user) => user.typeUser === 1),
  });

  // Fetch all stores for parent selection
  const { data: allStores = [] } = useQuery<UserData[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, typeUser: 1 }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"] });
      toast({
        title: t("common.success"),
        description: t("settings.userManagementContent.userCreatedSuccess"),
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"] });
      toast({
        title: t("common.success"),
        description: t("settings.userManagementContent.userUpdatedSuccess"),
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/store-settings/list"] });
      toast({
        title: t("common.success"),
        description: t("settings.userManagementContent.userDeletedSuccess"),
      });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = async (user?: UserData) => {
    if (user) {
      setEditingUser(user);
      const parentStores = user.parent
        ? user.parent.split(",").map((s) => s.trim())
        : [];
      setSelectedParentStores(parentStores);

      setFormData({
        userName: user.userName,
        password: user.password,
        storeName: user.storeName,
        storeCode: user.storeCode,
        isAdmin: user.isAdmin,
        parent: user.parent,
      });
    } else {
      setEditingUser(null);
      setShowPassword(false); // Hide password field when creating new user
      setSelectedParentStores([]);
      setFormData({
        userName: "",
        password: "",
        storeName: "",
        storeCode: "",
        isAdmin: false,
        parent: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setSelectedParentStores([]);
    setShowPassword(false);
    setFormData({
      userName: "",
      password: "",
      storeName: "",
      storeCode: "",
      isAdmin: false,
      parent: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.userName || !formData.userName.trim()) {
      toast({
        title: t("common.error"),
        description: t("settings.userManagementContent.enterUsername"),
        variant: "destructive",
      });
      return;
    }

    if (!editingUser && (!formData.password || !formData.password.trim())) {
      toast({
        title: t("common.error"),
        description: t("settings.userManagementContent.enterPassword"),
        variant: "destructive",
      });
      return;
    }

    const parentStoresString = selectedParentStores.join(", ");

    if (editingUser) {
      const updateData = {
        ...formData,
        parent: parentStoresString,
        typeUser: 1,
      };
      if (!updateData.password || !updateData.password.trim()) {
        delete updateData.password;
      }
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate({
        ...formData,
        parent: parentStoresString,
        typeUser: 1,
      });
    }
  };

  const handleAddParentStore = (storeCode: string) => {
    if (storeCode && !selectedParentStores.includes(storeCode)) {
      setSelectedParentStores([...selectedParentStores, storeCode]);
    }
  };

  const handleRemoveParentStore = (storeCode: string) => {
    setSelectedParentStores(
      selectedParentStores.filter((s) => s !== storeCode),
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("settings.userManagementContent.title")}</CardTitle>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t("settings.userManagementContent.addUser")}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">{t("common.loading")}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {t("common.noData")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("settings.userName")}</TableHead>
                <TableHead>
                  {t("settings.userManagementContent.adminRights")}
                </TableHead>
                <TableHead>
                  {t("settings.userManagementContent.managedStores")}
                </TableHead>
                <TableHead className="text-right">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.userName}</TableCell>
                  <TableCell>{user.isAdmin ? t("common.yes") : "-"}</TableCell>
                  <TableCell>{user.parent || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteConfirm(user.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingUser
                  ? t("settings.editUser")
                  : t("settings.createNewUser")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="userName">
                  {t("settings.userManagementContent.userNameRequired")}
                </Label>
                <Input
                  id="userName"
                  value={formData.userName}
                  onChange={(e) =>
                    setFormData({ ...formData, userName: e.target.value })
                  }
                  placeholder={t(
                    "settings.userManagementContent.enterUsername",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {editingUser
                    ? t("settings.userManagementContent.password")
                    : t("settings.userManagementContent.passwordRequired")}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={
                      editingUser
                        ? t("settings.userManagementContent.passwordOptional")
                        : t("settings.userManagementContent.enterPassword")
                    }
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="parent">
                  {t("settings.userManagementContent.managedStores")}
                </Label>
                <Select onValueChange={handleAddParentStore}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "settings.userManagementContent.selectManagedStores",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {allStores
                      .filter(
                        (store) =>
                          store.typeUser !== 1 &&
                          store.storeCode !== formData.storeCode,
                      )
                      .map((store) => (
                        <SelectItem key={store.id} value={store.storeCode}>
                          {store.storeName} ({store.storeCode})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedParentStores.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedParentStores.map((storeCode) => {
                      const store = allStores.find(
                        (s) => s.storeCode === storeCode,
                      );
                      return (
                        <div
                          key={storeCode}
                          className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
                        >
                          <span>{store?.storeName || storeCode}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-blue-200"
                            onClick={() => handleRemoveParentStore(storeCode)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-2 col-span-2 flex items-center gap-2">
                <Checkbox
                  id="isAdmin"
                  checked={formData.isAdmin}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isAdmin: checked === true })
                  }
                />
                <Label htmlFor="isAdmin" className="cursor-pointer">
                  {t("settings.userManagementContent.adminRights")}
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingUser
                  ? t("settings.userManagementContent.updateUser")
                  : t("settings.userManagementContent.createUser")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deleteConfirm !== null}
          onOpenChange={() => setDeleteConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings.confirmDeleteUser")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
