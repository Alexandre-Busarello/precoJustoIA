# Posts do Blog - Preço Justo AI

Este diretório contém todos os posts do blog em formato Markdown (.md).

## 📝 Estrutura de um Post

Cada post deve ter um arquivo `.md` com o seguinte formato:

```markdown
---
id: 1
slug: nome-do-post
title: Título do Post
excerpt: Breve descrição do post (2-3 linhas)
category: Categoria
readTime: 10 min
publishDate: 2025-01-15
author: Equipe Preço Justo AI
featured: false
tags:
  - tag1
  - tag2
  - tag3
seoTitle: Título otimizado para SEO (opcional)
seoDescription: Descrição otimizada para SEO (opcional)
image: /imagem-do-post.png (opcional)
imageAlt: Texto alternativo da imagem (opcional)
canonicalUrl: https://precojusto.ai/blog/slug (opcional)
lastModified: 2025-01-20 (opcional)
---

# Conteúdo do Post

Seu conteúdo em Markdown aqui...
```

## 🏷️ Metadados Obrigatórios

- **id**: ID único do post (número)
- **slug**: URL amigável (kebab-case, sem acentos)
- **title**: Título do post
- **excerpt**: Descrição curta para cards e listagens
- **category**: Categoria do post (ex: Educação, Estratégias, etc.)
- **readTime**: Tempo estimado de leitura (ex: "10 min")
- **publishDate**: Data de publicação (formato: YYYY-MM-DD)
- **author**: Autor do post
- **tags**: Array de tags relacionadas

## 🎯 Metadados Opcionais (Recomendados para SEO)

- **seoTitle**: Título otimizado para SEO (50-60 caracteres)
- **seoDescription**: Meta descrição para SEO (150-160 caracteres)
- **image**: URL da imagem destacada do post
- **imageAlt**: Texto alternativo da imagem
- **canonicalUrl**: URL canônica (caso o post seja republicado)
- **lastModified**: Data da última modificação
- **featured**: `true` para destacar o post na página principal

## 📂 Categorias Disponíveis

- **Educação**: Guias e tutoriais básicos
- **Estratégias**: Estratégias de investimento
- **Renda Passiva**: Conteúdo sobre dividendos e renda passiva
- **Tecnologia**: IA, automação e tecnologia
- **Análise Setorial**: Análises de setores específicos

## ✍️ Guia de Estilo Markdown

### Títulos
```markdown
# H1 - Título Principal (usado uma vez)
## H2 - Seções Principais
### H3 - Subseções
#### H4 - Detalhes
```

### Ênfase
```markdown
**negrito**
*itálico*
***negrito e itálico***
```

### Listas
```markdown
- Item 1
- Item 2
  - Sub-item 2.1
  - Sub-item 2.2

1. Primeiro
2. Segundo
3. Terceiro
```

### Links
```markdown
[Texto do link](https://url.com)
```

### Imagens
```markdown
![Texto alternativo](/caminho/para/imagem.png)
```

### Código
```markdown
`código inline`

\`\`\`typescript
// Bloco de código
const exemplo = "código";
\`\`\`
```

### Citações
```markdown
> Esta é uma citação
```

### Tabelas
```markdown
| Coluna 1 | Coluna 2 |
|----------|----------|
| Valor 1  | Valor 2  |
```

## 🔍 SEO - Boas Práticas

### Título do Post
- 50-60 caracteres
- Inclua palavra-chave principal
- Seja claro e atrativo
- Use números quando relevante

### Excerpt (Descrição)
- 150-160 caracteres
- Inclua palavra-chave secundária
- Mostre o benefício do conteúdo
- Chame para ação

### Tags
- 3-5 tags por post
- Use palavras-chave relevantes
- Mantenha consistência entre posts
- Combine termos gerais e específicos

### Conteúdo
- Mínimo 800 palavras para SEO
- Use H2 e H3 para estruturar
- Inclua links internos e externos
- Otimize imagens (alt text)
- Use palavras-chave naturalmente

## 📊 Estrutura de Conteúdo Recomendada

1. **Introdução** (100-150 palavras)
   - Apresente o problema/tópico
   - Mostre o que será abordado
   - Engaje o leitor

2. **Corpo Principal** (dividido em seções)
   - Use H2 para seções principais
   - Use H3 para subseções
   - Inclua exemplos práticos
   - Use listas e tabelas
   - Adicione imagens explicativas

3. **Conclusão** (50-100 palavras)
   - Resuma os pontos principais
   - Call-to-action
   - Link para recursos relacionados

## 🚀 Como Adicionar um Novo Post

1. Crie um novo arquivo `.md` neste diretório
2. Nomeie o arquivo com o slug: `meu-novo-post.md`
3. Adicione os metadados no formato frontmatter (entre `---`)
4. Escreva o conteúdo em Markdown
5. Faça commit e push - o post será gerado automaticamente!

## 📝 Exemplo Completo

Veja os posts existentes neste diretório como referência:
- `guia-completo-analise-fundamentalista-iniciantes.md`
- `formula-benjamin-graham-acoes-baratas.md`
- `dividend-yield-renda-passiva-sustentavel.md`

## 🛠️ Ferramentas Úteis

- **Editor Markdown**: VS Code com extensão Markdown Preview
- **Validação Frontmatter**: Verifique a sintaxe YAML
- **Preview**: Use `npm run dev` e acesse `/blog/seu-slug`

## ⚠️ Importante

- O nome do arquivo deve ser exatamente igual ao `slug` definido no frontmatter
- Datas devem estar no formato `YYYY-MM-DD`
- Tags devem ser em minúsculas
- IDs devem ser únicos e sequenciais

## 🔄 Sistema de Cache

O sistema faz cache dos posts em produção. Para limpar o cache:
- Em desenvolvimento: salve o arquivo novamente
- Em produção: faça novo deploy ou aguarde revalidação automática

---

Para mais informações, consulte a documentação do serviço em `/src/lib/blog-service.ts`

