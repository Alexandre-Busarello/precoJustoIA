#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Carregar variáveis de ambiente
dotenv.config();

const prisma = new PrismaClient();

// Caminho para o diretório de posts
const postsDirectory = path.join(process.cwd(), 'blog', 'data', 'posts');

interface BlogPostFrontmatter {
  id?: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishDate: string;
  author: string;
  featured?: boolean;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  image?: string;
  imageAlt?: string;
  canonicalUrl?: string;
  lastModified?: string;
}

async function migrateBlogPosts() {
  console.log('🚀 Iniciando migração de posts do blog...\n');

  try {
    // Ler todos os arquivos .md
    const fileNames = fs.readdirSync(postsDirectory)
      .filter(fileName => 
        fileName.endsWith('.md') && 
        !fileName.startsWith('README') && 
        !fileName.startsWith('.')
      );

    console.log(`📁 Encontrados ${fileNames.length} arquivos de posts\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const fileName of fileNames) {
      try {
        const filePath = path.join(postsDirectory, fileName);
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data, content } = matter(fileContents);

        const frontmatter = data as BlogPostFrontmatter;
        const slug = frontmatter.slug || fileName.replace(/\.md$/, '');

        // Verificar se já existe
        const existing = await prisma.blogPost.findUnique({
          where: { slug }
        });

        if (existing) {
          console.log(`⏭️  Post "${slug}" já existe, pulando...`);
          skipped++;
          continue;
        }

        // Converter publishDate para Date
        const publishDate = frontmatter.publishDate 
          ? new Date(frontmatter.publishDate)
          : null;

        // Converter lastModified para Date
        const lastModified = frontmatter.lastModified
          ? new Date(frontmatter.lastModified)
          : null;

        // Criar post no banco
        await prisma.blogPost.create({
          data: {
            slug,
            title: frontmatter.title,
            excerpt: frontmatter.excerpt,
            category: frontmatter.category,
            readTime: frontmatter.readTime,
            publishDate,
            author: frontmatter.author || 'Equipe Preço Justo AI',
            featured: frontmatter.featured || false,
            seoTitle: frontmatter.seoTitle,
            seoDescription: frontmatter.seoDescription,
            image: frontmatter.image,
            imageAlt: frontmatter.imageAlt,
            canonicalUrl: frontmatter.canonicalUrl,
            content,
            status: 'PUBLISHED', // Posts existentes são publicados
            tags: frontmatter.tags || [],
            lastModified,
            generatedBy: 'manual'
          }
        });

        console.log(`✅ Migrado: "${frontmatter.title}" (${slug})`);
        migrated++;

      } catch (error: any) {
        console.error(`❌ Erro ao migrar ${fileName}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Resumo da migração:');
    console.log(`   ✅ Migrados: ${migrated}`);
    console.log(`   ⏭️  Pulados: ${skipped}`);
    console.log(`   ❌ Erros: ${errors}`);
    console.log(`   📁 Total: ${fileNames.length}`);

  } catch (error: any) {
    console.error('❌ Erro geral na migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  migrateBlogPosts()
    .then(() => {
      console.log('\n✅ Migração concluída com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migração falhou:', error);
      process.exit(1);
    });
}

export { migrateBlogPosts };

