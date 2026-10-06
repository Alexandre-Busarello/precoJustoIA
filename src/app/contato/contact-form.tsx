"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const CONTACT_EMAIL = "contato@precojusto.ai"

const SUBJECTS = [
  { value: "duvida", label: "Dúvida geral" },
  { value: "suporte", label: "Suporte técnico" },
  { value: "metodologia", label: "Dúvida sobre um cálculo" },
  { value: "sugestao", label: "Sugestão" },
  { value: "pagamento", label: "Pagamento ou cancelamento" },
  { value: "parceria", label: "Parceria" },
  { value: "outro", label: "Outro" },
] as const

/**
 * Monta a mensagem e abre o aplicativo de e-mail do usuário (mailto). Não há envio pelo servidor:
 * a resposta chega pelo mesmo e-mail de quem escreveu.
 */
export function ContactForm() {
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [subjectMissing, setSubjectMissing] = useState(false)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subject) {
      setSubjectMissing(true)
      return
    }
    const subjectLabel = SUBJECTS.find((s) => s.value === subject)?.label ?? "Contato"
    const body = `${message.trim()}\n\n${name.trim()}`
    const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[Site] ${subjectLabel}`)}&body=${encodeURIComponent(body)}`
    window.location.href = href
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="contato-nome">Nome</Label>
        <Input
          id="contato-nome"
          name="nome"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contato-assunto">Assunto</Label>
        <Select
          value={subject}
          onValueChange={(value) => {
            setSubject(value)
            setSubjectMissing(false)
          }}
        >
          <SelectTrigger id="contato-assunto" className="w-full" aria-invalid={subjectMissing || undefined}>
            <SelectValue placeholder="Selecione o assunto" />
          </SelectTrigger>
          <SelectContent>
            {SUBJECTS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {subjectMissing && <p className="text-xs text-negative">Escolha um assunto.</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contato-mensagem">Mensagem</Label>
        <Textarea
          id="contato-mensagem"
          name="mensagem"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Conte o que aconteceu ou o que você precisa"
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Abrir no aplicativo de e-mail
      </Button>
      <p className="text-xs text-muted-foreground">
        O formulário abre uma mensagem pronta para {CONTACT_EMAIL} no seu aplicativo de e-mail.
      </p>
    </form>
  )
}
