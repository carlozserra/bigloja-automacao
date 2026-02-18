import { useState, useEffect } from 'react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Send, RefreshCw, Check, XCircle, AlertCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Cobranca = Database['public']['Tables']['cobrancas']['Row'] & {
  clientes: Database['public']['Tables']['clientes']['Row'] | null;
};

type StatusDisparo = Database['public']['Enums']['status_disparo'];

export default function Disparador() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAtiva, setFilterAtiva] = useState<string>('todas');
  const [disparando, setDisparando] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCobrancas = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('cobrancas')
        .select('*, clientes(*)')
        .eq('status', 'aberta')
        .order('data_vencimento', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      setCobrancas(data || []);
    } catch {
      // Error logged silently for security
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as cobranças',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCobrancas();
  }, []);

  // Setup Realtime listener for cobrancas updates
  useEffect(() => {
    const channel = supabase
      .channel('realtime:cobrancas')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cobrancas',
        },
        (payload) => {
          const updatedCobranca = payload.new as Cobranca;
          
          setCobrancas((prevCobrancas) =>
            prevCobrancas.map((cobranca) =>
              cobranca.id === updatedCobranca.id
                ? {
                    ...cobranca,
                    ...updatedCobranca,
                  }
                : cobranca
            )
          );
        }
      )
      .subscribe();

    // Cleanup: unsubscribe from channel when component unmounts
    return () => {
      channel.unsubscribe();
    };
  }, []);

  const filteredCobrancas = cobrancas.filter((cobranca) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesClienteName = cobranca.clientes?.nome
      ?.toLowerCase()
      .includes(searchLower);
    const matchesCobrancaName = cobranca.nome
      ?.toLowerCase()
      .includes(searchLower);
    const matchesSearch = matchesClienteName || matchesCobrancaName;
    
    if (filterAtiva === 'ativas') return matchesSearch && cobranca.ativa;
    if (filterAtiva === 'inativas') return matchesSearch && !cobranca.ativa;
    return matchesSearch;
  });

  const toggleAtiva = async (cobranca: Cobranca) => {
    try {
      const { error } = await supabase
        .from('cobrancas')
        .update({ ativa: !cobranca.ativa })
        .eq('id', cobranca.id);

      if (error) throw error;

      setCobrancas((prev) =>
        prev.map((c) =>
          c.id === cobranca.id ? { ...c, ativa: !c.ativa } : c
        )
      );

      toast({
        title: 'Atualizado',
        description: `Cobrança ${!cobranca.ativa ? 'ativada' : 'desativada'}`,
      });
    } catch {
      // Error logged silently for security
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a cobrança',
        variant: 'destructive',
      });
    }
  };

  const dispararMensagem = async (cobranca: Cobranca) => {
    if (!cobranca.clientes) return;

    setDisparando(cobranca.id);

    try {
      // Chamar Edge Function que dispara o webhook do n8n
      const { data, error: invokeError } = await supabase.functions.invoke('disparar-webhook', {
        body: {
          cobranca: {
            id: cobranca.id,
            cliente_nome: cobranca.clientes.nome,
            cliente_telefone: cobranca.clientes.telefone,
            data_vencimento: cobranca.data_vencimento,
          },
        },
      });

      if (invokeError) throw invokeError;

      const status: StatusDisparo = data?.status === 'enviado' ? 'enviado' : 'erro';

      // Atualizar status de disparo
      const { error } = await supabase
        .from('cobrancas')
        .update({
          ultimo_disparo: new Date().toISOString(),
          status_ultimo_disparo: status,
        })
        .eq('id', cobranca.id);

      if (error) throw error;

      setCobrancas((prev) =>
        prev.map((c) =>
          c.id === cobranca.id
            ? {
                ...c,
                ultimo_disparo: new Date().toISOString(),
                status_ultimo_disparo: status,
              }
            : c
        )
      );

      if (status === 'enviado') {
        toast({
          title: 'Mensagem enviada!',
          description: `Cobrança de ${cobranca.clientes.nome} disparada`,
        });
      } else {
        toast({
          title: 'Erro no envio',
          description: data?.message || 'Falha ao enviar mensagem',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      // Error logged silently for security
      
      // Extrair mensagem de erro do backend
      let errorMessage = 'Não foi possível enviar a mensagem';
      
      // Tentar extrair a mensagem do contexto de erro do invoke
      if (error?.context?.body) {
        try {
          const errorBody = typeof error.context.body === 'string' 
            ? JSON.parse(error.context.body) 
            : error.context.body;
          if (errorBody?.message) {
            errorMessage = errorBody.message;
          }
        } catch {
          // Se não conseguir fazer parse, usa a mensagem padrão
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Atualizar status de erro
      await supabase
        .from('cobrancas')
        .update({
          status_ultimo_disparo: 'erro' as StatusDisparo,
        })
        .eq('id', cobranca.id);

      toast({
        title: 'Erro no envio',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setDisparando(null);
    }
  };

  const encerrarCobranca = async (cobranca: Cobranca) => {
    try {
      const { error } = await supabase
        .from('cobrancas')
        .delete()
        .eq('id', cobranca.id);

      if (error) throw error;

      setCobrancas((prev) => prev.filter((c) => c.id !== cobranca.id));

      toast({
        title: 'Cobrança deletada',
        description: 'O cliente realizou o pagamento e a cobrança foi removida',
      });
    } catch {
      // Error logged silently for security
      toast({
        title: 'Erro ao deletar',
        description: 'Não foi possível remover a cobrança do banco de dados',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: StatusDisparo | null) => {
    if (!status) return null;

    const config = {
      enviado: { icon: Check, className: 'status-enviado', label: 'Enviado' },
      erro: { icon: XCircle, className: 'status-erro', label: 'Erro' },
      invalido: { icon: AlertCircle, className: 'status-invalido', label: 'Inválido' },
    };

    const { icon: Icon, className, label } = config[status];
    return (
      <Badge variant="outline" className={className}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  // Helper function to parse dates correctly from ISO format (YYYY-MM-DD)
  // Avoids UTC interpretation issues
  const parseISODate = (dateString: string): Date => {
    return parse(dateString, 'yyyy-MM-dd', new Date());
  };

  const isAtrasada = (dataVencimento: string) => {
    return parseISODate(dataVencimento) < new Date();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Disparador de Mensagens</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie e envie cobranças por WhatsApp
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do cliente ou cobrança..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterAtiva} onValueChange={setFilterAtiva}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="inativas">Inativas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchCobrancas} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Cobrança</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Último Disparo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Ativa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredCobrancas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma cobrança encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredCobrancas.map((cobranca) => (
                <TableRow key={cobranca.id} className="animate-fade-in">
                  <TableCell className="font-medium">
                    {cobranca.nome || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>{cobranca.clientes?.nome}</TableCell>
                  <TableCell>{cobranca.clientes?.telefone}</TableCell>
                  <TableCell>
                    <span
                      className={
                        isAtrasada(cobranca.data_vencimento)
                          ? 'text-action font-medium'
                          : ''
                      }
                    >
                      {format(parseISODate(cobranca.data_vencimento), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </TableCell>
                  <TableCell>
                    {cobranca.ultimo_disparo
                      ? format(
                          new Date(cobranca.ultimo_disparo),
                          "dd/MM/yyyy HH:mm",
                          { locale: ptBR }
                        )
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(cobranca.status_ultimo_disparo)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={cobranca.ativa}
                      onCheckedChange={() => toggleAtiva(cobranca)}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="action"
                      size="sm"
                      onClick={() => dispararMensagem(cobranca)}
                      disabled={disparando === cobranca.id || !cobranca.ativa}
                    >
                      {disparando === cobranca.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-1" />
                          Disparar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => encerrarCobranca(cobranca)}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Pago
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total de Cobranças</p>
          <p className="text-2xl font-bold text-foreground">{cobrancas.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Cobranças Ativas</p>
          <p className="text-2xl font-bold text-foreground">
            {cobrancas.filter((c) => c.ativa).length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Atrasadas</p>
          <p className="text-2xl font-bold text-action">
            {cobrancas.filter((c) => isAtrasada(c.data_vencimento)).length}
          </p>
        </div>
      </div>
    </div>
  );
}
