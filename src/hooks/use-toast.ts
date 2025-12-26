"use client"

import { toast as sonnerToast } from "sonner"

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "destructive"
  duration?: number
}

export function useToast() {
  const toast = ({ title, description, variant = "default", duration }: ToastProps) => {
    const options = {
      description,
      ...(duration !== undefined && { duration })
    }
    
    if (variant === "destructive") {
      sonnerToast.error(title, options)
    } else {
      sonnerToast.success(title, options)
    }
  }

  return { toast }
}
