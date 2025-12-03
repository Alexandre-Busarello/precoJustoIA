/**
 * JSON Editor Component
 * Componente para editar JSON com validação e formatação
 */

'use client';

import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Copy, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface JsonEditorProps {
  value: any;
  onChange: (value: any) => void;
  label?: string;
  placeholder?: string;
  minHeight?: string;
}

export function JsonEditor({
  value,
  onChange,
  label = 'Configuração JSON',
  placeholder = '{}',
  minHeight = '400px'
}: JsonEditorProps) {
  const [jsonString, setJsonString] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  // Inicializar com valor formatado
  useEffect(() => {
    try {
      if (value === null || value === undefined) {
        setJsonString('');
        setError(null);
        setIsValid(false);
        return;
      }
      const formatted = JSON.stringify(value, null, 2);
      setJsonString(formatted);
      setError(null);
      setIsValid(true);
    } catch (err) {
      setJsonString(String(value || ''));
      setError('Erro ao formatar JSON inicial');
      setIsValid(false);
    }
  }, [value]);

  const handleChange = (newValue: string) => {
    setJsonString(newValue);
    
    // Se estiver vazio, não chamar onChange
    if (!newValue.trim()) {
      setError(null);
      setIsValid(false);
      return;
    }
    
    // Tentar parsear para validar
    try {
      const parsed = JSON.parse(newValue);
      setError(null);
      setIsValid(true);
      onChange(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON inválido');
      setIsValid(false);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonString);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonString(formatted);
      setError(null);
      setIsValid(true);
      onChange(parsed);
    } catch (err) {
      setError('Não é possível formatar JSON inválido');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
  };

  const handleReset = () => {
    try {
      const formatted = JSON.stringify(value, null, 2);
      setJsonString(formatted);
      setError(null);
      setIsValid(true);
    } catch (err) {
      // Ignorar erro de reset
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFormat}
            disabled={!isValid}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Formatar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copiar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Resetar
          </Button>
        </div>
      </div>
      
      <Textarea
        value={jsonString}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className={`font-mono text-sm ${!isValid ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
        style={{ minHeight }}
      />
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {isValid && jsonString.trim() && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">
            JSON válido
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

