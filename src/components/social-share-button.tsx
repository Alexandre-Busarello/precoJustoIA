"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Share2, Copy, Check, MessageCircle, Twitter, Linkedin, Facebook } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SocialShareButtonProps {
  url: string
  title: string
  description?: string
}

export function SocialShareButton({ url, title, description }: SocialShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const shareText = description 
    ? `${title}\n\n${description}\n\n${url}`
    : `${title}\n\n${url}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para a área de transferência.",
      })
      setTimeout(() => {
        setCopied(false)
        setOpen(false)
      }, 2000)
    } catch (err) {
      console.error("Erro ao copiar:", err)
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      })
    }
  }

  const handleShare = async (platform: string) => {
    const encodedUrl = encodeURIComponent(url)
    const encodedTitle = encodeURIComponent(title)
    const encodedText = encodeURIComponent(shareText)

    let shareUrl = ""

    switch (platform) {
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${encodedText}`
        break
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
        break
      case "linkedin":
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
        break
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        break
      default:
        return
    }

    // Abrir em nova janela
    window.open(shareUrl, "_blank", "width=600,height=400")
    setOpen(false)
  }

  // Verificar se Web Share API está disponível (mobile)
  const canUseNativeShare = typeof navigator !== "undefined" && "share" in navigator

  const handleNativeShare = async () => {
    if (canUseNativeShare) {
      try {
        await navigator.share({
          title,
          text: description || title,
          url,
        })
        setOpen(false)
      } catch (err) {
        // Usuário cancelou ou erro
        if ((err as Error).name !== "AbortError") {
          console.error("Erro ao compartilhar:", err)
        }
      }
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Compartilhar</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 sm:w-72" align="end">
        {/* Native Share (Mobile) */}
        {canUseNativeShare && (
          <>
            <DropdownMenuItem
              className="flex items-center gap-3 py-3 cursor-pointer"
              onClick={handleNativeShare}
            >
              <Share2 className="w-5 h-5 text-blue-600" />
              <div className="flex flex-col items-start">
                <span className="font-medium">Compartilhar</span>
                <span className="text-xs text-muted-foreground">Usar app do dispositivo</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* WhatsApp */}
        <DropdownMenuItem
          className="flex items-center gap-3 py-3 cursor-pointer"
          onClick={() => handleShare("whatsapp")}
        >
          <MessageCircle className="w-5 h-5 text-green-600" />
          <span className="font-medium">WhatsApp</span>
        </DropdownMenuItem>

        {/* Twitter/X */}
        <DropdownMenuItem
          className="flex items-center gap-3 py-3 cursor-pointer"
          onClick={() => handleShare("twitter")}
        >
          <Twitter className="w-5 h-5 text-blue-400" />
          <span className="font-medium">Twitter / X</span>
        </DropdownMenuItem>

        {/* LinkedIn */}
        <DropdownMenuItem
          className="flex items-center gap-3 py-3 cursor-pointer"
          onClick={() => handleShare("linkedin")}
        >
          <Linkedin className="w-5 h-5 text-blue-700" />
          <span className="font-medium">LinkedIn</span>
        </DropdownMenuItem>

        {/* Facebook */}
        <DropdownMenuItem
          className="flex items-center gap-3 py-3 cursor-pointer"
          onClick={() => handleShare("facebook")}
        >
          <Facebook className="w-5 h-5 text-blue-600" />
          <span className="font-medium">Facebook</span>
        </DropdownMenuItem>

        {/* Copiar Link */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-3 py-3 cursor-pointer"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-600">Link copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Copiar link</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

