import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
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

export default function CategoryManagementContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    icon: "fas fa-utensils",
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<
    any[]
  >({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"],
  });

  const { data: productsData } = useQuery<any[]>({
    queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/products"],
  });

  const resetCategoryForm = () => {
    setCategoryForm({ id: "", name: "", icon: "fas fa-utensils" });
    setEditingCategory(null);
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({
        title: t("common.error"),
        description: t("settings.categoryNameRequired"),
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      await queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"] });
      toast({
        title: t("common.success"),
        description: t("settings.categoryCreateSuccess"),
      });
      setShowCategoryForm(false);
      resetCategoryForm();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("settings.categoryCreateError"),
        variant: "destructive",
      });
    }
  };

  const handleUpdateCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({
        title: t("common.error"),
        description: t("settings.categoryNameRequired"),
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      setShowCategoryForm(false);
      resetCategoryForm();
      await queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"] });
      toast({
        title: t("common.success"),
        description: t("settings.categoryUpdateSuccess"),
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("settings.categoryUpdateError"),
        variant: "destructive",
      });
    }
  };

  const handleEditCategory = (category: any) => {
    setCategoryForm({
      id: category.id.toString(),
      name: category.name || "",
      icon: category.icon || "fas fa-utensils",
    });
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = (categoryId: number) => {
    const categoryProducts = productsData?.filter(
      (product: any) => product.categoryId === categoryId,
    );

    if (categoryProducts && categoryProducts.length > 0) {
      toast({
        title: t("common.error"),
        description: t("settings.categoryDeleteWithProducts", {
          count: categoryProducts.length,
        }),
        variant: "destructive",
      });
      return;
    }

    const category = categoriesData?.find((c: any) => c.id === categoryId);
    setCategoryToDelete(category);
    setShowDeleteDialog(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      const response = await fetch(`https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories/${categoryToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }

      await queryClient.refetchQueries({ queryKey: ["https://796f2db4-7848-49ea-8b2b-4c67f6de26d7-00-248bpbd8f87mj.sisko.replit.dev/api/categories"] });
      toast({
        title: t("common.success"),
        description: t("settings.categoryDeleteSuccess"),
      });

      setShowDeleteDialog(false);
      setCategoryToDelete(null);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("settings.categoryDeleteError"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t("settings.categories")}</CardTitle>
            <Button
              onClick={() => {
                resetCategoryForm();
                setShowCategoryForm(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("settings.addCategory")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categoriesLoading ? (
            <div className="text-center py-8">{t("common.loading")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoriesData
                .filter((item) => item.id != 15 && item.id != 17)
                ?.map((category: any) => (
                  <Card key={category.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <i
                          className={`${category.icon} text-2xl text-green-600`}
                        ></i>
                        <div>
                          <h3 className="font-medium">{category.name}</h3>
                          <p className="text-sm text-gray-500">
                            ID: {category.id}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCategory(category)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Form Dialog */}
      <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? t("settings.editCategory")
                : t("settings.addCategory")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">
                {t("settings.categoryName")}
              </Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                placeholder={t("settings.categoryNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-icon">
                {t("settings.categoryIcon")}
              </Label>
              <Input
                id="category-icon"
                value={categoryForm.icon}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, icon: e.target.value })
                }
                placeholder="fas fa-utensils"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCategoryForm(false);
                resetCategoryForm();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={
                editingCategory ? handleUpdateCategory : handleCreateCategory
              }
            >
              {editingCategory ? t("common.update") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.confirmDeleteCategory")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.confirmDeleteCategoryDesc")}{" "}
              <strong>{categoryToDelete?.name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false);
                setCategoryToDelete(null);
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
