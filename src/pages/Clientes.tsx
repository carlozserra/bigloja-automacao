import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, RefreshCw, Users } from 'lucide-react';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type Cliente = Database['public']['Tables']['clientes']['Row'];

const clienteSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  telefone: z.string().min(10, 'Telefone inválido').max(20, 'Telefone muito longo'),
});

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({ nome: '', telefone: '', ativo: true });
  const [formErrors, setFormErrors] = useState<{ nome?: string; telefone?: string }>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setClientes(data || []);
    } catch {
      // Error logged silently for security
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os clientes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const filteredClientes = clientes.filter((cliente) =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefone.includes(searchTerm)
  );

  const openCreateDialog = () => {
    setEditingCliente(null);
    setFormData({ nome: '', telefone: '', ativo: true });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone,
      ativo: cliente.ativo,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openDeleteDialog = (cliente: Cliente) => {
    setDeletingCliente(cliente);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    // Validate
    const validation = clienteSchema.safeParse(formData);
    if (!validation.success) {
      const errors: { nome?: string; telefone?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'nome') errors.nome = err.message;
        if (err.path[0] === 'telefone') errors.telefone = err.message;
      });
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (editingCliente) {
        // Update
        const { error } = await supabase
          .from('clientes')
          .update({
            nome: formData.nome.trim(),
            telefone: formData.telefone.trim(),
            ativo: formData.ativo,
          })
          .eq('id', editingCliente.id);

        if (error) throw error;

        setClientes((prev) =>
          prev.map((c) =>
            c.id === editingCliente.id
              ? { ...c, nome: formData.nome.trim(), telefone: formData.telefone.trim(), ativo: formData.ativo }
              : c
          )
        );

        toast({
          title: 'Cliente atualizado',
          description: 'Os dados foram salvos com sucesso',
        });
      } else {
        // Create - include user_id
        const { data, error } = await supabase
          .from('clientes')
          .insert({
            nome: formData.nome.trim(),
            telefone: formData.telefone.trim(),
            ativo: formData.ativo,
            user_id: user?.id,
          })
          .select()
          .single();

        if (error) throw error;

        setClientes((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));

        toast({
          title: 'Cliente criado',
          description: 'Novo cliente cadastrado com sucesso',
        });
      }

      setDialogOpen(false);
    } catch {
      // Error logged silently for security
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o cliente',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCliente) return;

    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', deletingCliente.id);

      if (error) throw error;

      setClientes((prev) => prev.filter((c) => c.id !== deletingCliente.id));

      toast({
        title: 'Cliente removido',
        description: 'O cliente foi excluído com sucesso',
      });
    } catch {
      // Error logged silently for security
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o cliente. Verifique se não há cobranças vinculadas.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingCliente(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie sua base de clientes
          </p>
        </div>
        <Button variant="action" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchClientes} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredClientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                  <Button variant="link" onClick={openCreateDialog} className="mt-2">
                    Cadastrar primeiro cliente
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredClientes.map((cliente) => (
                <TableRow key={cliente.id} className="animate-fade-in">
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell>{cliente.telefone}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={cliente.ativo}
                      onCheckedChange={async () => {
                        const { error } = await supabase
                          .from('clientes')
                          .update({ ativo: !cliente.ativo })
                          .eq('id', cliente.id);

                        if (!error) {
                          setClientes((prev) =>
                            prev.map((c) =>
                              c.id === cliente.id ? { ...c, ativo: !c.ativo } : c
                            )
                          );
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(cliente)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(cliente)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total de Clientes</p>
          <p className="text-2xl font-bold text-foreground">{clientes.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Clientes Ativos</p>
          <p className="text-2xl font-bold text-foreground">
            {clientes.filter((c) => c.ativo).length}
          </p>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
            <DialogDescription>
              {editingCliente
                ? 'Atualize os dados do cliente'
                : 'Preencha os dados para cadastrar um novo cliente'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                placeholder="Nome completo"
                value={formData.nome}
                onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
              />
              {formErrors.nome && (
                <p className="text-sm text-destructive">{formErrors.nome}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                placeholder="(11) 99999-9999"
                value={formData.telefone}
                onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
              />
              {formErrors.telefone && (
                <p className="text-sm text-destructive">{formErrors.telefone}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, ativo: checked }))
                }
              />
              <Label htmlFor="ativo">Cliente ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="action" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{deletingCliente?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
