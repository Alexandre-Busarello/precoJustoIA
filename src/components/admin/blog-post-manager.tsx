'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishDate: string | null;
  author: string;
  featured: boolean;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface BlogPostFull extends BlogPost {
  content: string;
  seoTitle?: string;
  seoDescription?: string;
  image?: string;
  imageAlt?: string;
  canonicalUrl?: string;
  lastModified?: string;
  generationPrompt?: string;
  sourceTopics?: any;
}

interface BlogStats {
  total: number;
  published: number;
  draft: number;
}

const statusConfig = {
  DRAFT: { label: 'Rascunho', color: 'bg-yellow-500', icon: Clock },
  PUBLISHED: { label: 'Publicado', color: 'bg-green-500', icon: CheckCircle },
};

const categories = [
  'Análise Setorial',
  'Renda Passiva',
  'Ferramentas',
  'Estratégias de Investimento',
  'Educação Financeira',
  'Mercado de Ações',
];

export function BlogPostManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [stats, setStats] = useState<BlogStats>({ total: 0, published: 0, draft: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog de edição
  const [selectedPost, setSelectedPost] = useState<BlogPostFull | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Partial<BlogPostFull>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/admin/blog-posts?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Erro ao carregar posts');
      }

      const data = await response.json();
      setPosts(data.posts);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, categoryFilter]);

  const handleSearch = () => {
    fetchData();
  };

  const handlePublish = async (postId: string) => {
    try {
      const response = await fetch('/api/admin/blog-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: postId,
          status: 'PUBLISHED',
          publishDate: new Date().toISOString().split('T')[0],
        }),
      });

      if (!response.ok) throw new Error('Erro ao publicar');

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao publicar post');
    }
  };

  const handleUnpublish = async (postId: string) => {
    try {
      const response = await fetch('/api/admin/blog-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: postId,
          status: 'DRAFT',
        }),
      });

      if (!response.ok) throw new Error('Erro ao despublicar');

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao despublicar post');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Tem certeza que deseja deletar este post?')) return;

    try {
      const response = await fetch(`/api/admin/blog-posts?id=${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao deletar');

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao deletar post');
    }
  };

  const handleEdit = async (post: BlogPost) => {
    try {
      const response = await fetch(`/api/admin/blog-posts/${post.id}`);
      if (!response.ok) throw new Error('Erro ao carregar post');

      const data = await response.json();
      setSelectedPost(data.post);
      setEditingPost(data.post);
      setEditDialogOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao carregar post');
    }
  };

  const handlePreview = async (post: BlogPost) => {
    try {
      const response = await fetch(`/api/admin/blog-posts/${post.id}`);
      if (!response.ok) throw new Error('Erro ao carregar post');

      const data = await response.json();
      setSelectedPost(data.post);
      setPreviewDialogOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao carregar post');
    }
  };

  const handleSave = async () => {
    if (!selectedPost) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/blog-posts/${selectedPost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPost),
      });

      if (!response.ok) throw new Error('Erro ao salvar');

      setEditDialogOpen(false);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar post');
    } finally {
      setSaving(false);
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (activeTab === 'draft') return post.status === 'DRAFT';
    if (activeTab === 'published') return post.status === 'PUBLISHED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Publicados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.published}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rascunhos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="DRAFT">Rascunho</SelectItem>
                <SelectItem value="PUBLISHED">Publicado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtrar
            </Button>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs e Lista */}
      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
          <CardDescription>Gerencie todos os posts do blog</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="draft">Rascunhos ({stats.draft})</TabsTrigger>
              <TabsTrigger value="published">Publicados ({stats.published})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : error ? (
                <div className="text-center py-8 text-red-600">{error}</div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum post encontrado
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPosts.map((post) => {
                    const status = statusConfig[post.status];
                    const StatusIcon = status.icon;

                    return (
                      <div
                        key={post.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={status.color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                              {post.generatedBy === 'AI' && (
                                <Badge variant="outline" className="text-purple-600">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  IA
                                </Badge>
                              )}
                              {post.featured && (
                                <Badge variant="outline" className="text-orange-600">
                                  Destaque
                                </Badge>
                              )}
                              <Badge variant="outline">{post.category}</Badge>
                            </div>
                            <h3 className="font-semibold text-lg mb-1">{post.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{post.excerpt}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Slug: {post.slug}</span>
                              <span>•</span>
                              <span>{post.readTime}</span>
                              <span>•</span>
                              <span>
                                {post.publishDate
                                  ? new Date(post.publishDate).toLocaleDateString('pt-BR')
                                  : 'Não publicado'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreview(post)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(post)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            {post.status === 'DRAFT' ? (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handlePublish(post.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Publicar
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnpublish(post.id)}
                              >
                                Despublicar
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(post.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Post</DialogTitle>
            <DialogDescription>Edite o conteúdo e metadados do post</DialogDescription>
          </DialogHeader>
          {editingPost && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título</label>
                <Input
                  value={editingPost.title || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Resumo (Excerpt)</label>
                <Textarea
                  value={editingPost.excerpt || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Categoria</label>
                  <Select
                    value={editingPost.category || ''}
                    onValueChange={(value) => setEditingPost({ ...editingPost, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={editingPost.status || 'DRAFT'}
                    onValueChange={(value: 'DRAFT' | 'PUBLISHED') =>
                      setEditingPost({ ...editingPost, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Rascunho</SelectItem>
                      <SelectItem value="PUBLISHED">Publicado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Conteúdo (Markdown)</label>
                <Textarea
                  value={editingPost.content || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                  rows={20}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">SEO Title</label>
                <Input
                  value={editingPost.seoTitle || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, seoTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">SEO Description</label>
                <Textarea
                  value={editingPost.seoDescription || ''}
                  onChange={(e) =>
                    setEditingPost({ ...editingPost, seoDescription: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Preview */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do Post</DialogTitle>
            <DialogDescription>Visualização do conteúdo renderizado</DialogDescription>
          </DialogHeader>
          {selectedPost && (
            <div className="prose prose-sm max-w-none">
              <h1>{selectedPost.title}</h1>
              <p className="text-muted-foreground">{selectedPost.excerpt}</p>
              <ReactMarkdown>{selectedPost.content}</ReactMarkdown>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Fechar
            </Button>
            {selectedPost && (
              <Button
                onClick={() => {
                  setPreviewDialogOpen(false);
                  handleEdit(selectedPost as any);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

