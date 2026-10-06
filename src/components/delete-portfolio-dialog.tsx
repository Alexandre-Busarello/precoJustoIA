"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { invalidateDashboardPortfoliosCache } from "./dashboard-portfolios";

interface DeletePortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  portfolioName: string;
}

export function DeletePortfolioDialog({
  open,
  onOpenChange,
  portfolioId,
  portfolioName,
}: DeletePortfolioDialogProps) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmText === portfolioName;

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/portfolio/${portfolioId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao excluir carteira");
      }

      toast.success("Carteira excluída permanentemente");
      
      // Invalidate dashboard cache
      invalidateDashboardPortfoliosCache();
      
      // Redirect to portfolios list
      router.push("/carteira");
      router.refresh();
    } catch (error) {
      console.error("Error deleting portfolio:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir carteira"
      );
    } finally {
      setIsDeleting(false);
      onOpenChange(false);
      setConfirmText("");
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmText("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir carteira permanentemente</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Transações, histórico de métricas, alocações e análises de{" "}
            <span className="font-medium text-foreground">{portfolioName}</span> serão apagados.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-name" className="text-sm font-normal">
            Para confirmar, digite o nome da carteira:{" "}
            <span className="font-medium text-foreground">{portfolioName}</span>
          </Label>
          <Input
            id="confirm-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={portfolioName}
            autoComplete="off"
            disabled={isDeleting}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isDeleting ? (
              <>
                <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                Excluindo
              </>
            ) : (
              "Excluir carteira"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
