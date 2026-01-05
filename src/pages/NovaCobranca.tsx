import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Plus, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type Cliente = Database['public']['Tables']['clientes']['Row'];

export default function NovaCobranca() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clienteId, setClienteId] = useState<string>('');
  const [nomeCobranca, setNomeCobranca] = useState<string>('');
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('ativo', true)
          .order('nome', { ascending: true });

        if (error) throw error;
        setClientes(data || []);
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os clientes',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, [toast]);

  const handleSubmit = async () => {
    if (!clienteId) {
      toast({
        title: 'Atenção',
        description: 'Selecione um cliente',
        variant: 'destructive',
      });
      return;
    }

    if (!dataVencimento) {
      toast({
        title: 'Atenção',
        description: 'Selecione a data de vencimento',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('cobrancas').insert({
        cliente_id: clienteId,
        nome: nomeCobranca.trim() || null,
        data_vencimento: format(dataVencimento, 'yyyy-MM-dd'),
        status: 'aberta',
        ativa: true,
      });

      if (error) throw error;

      toast({
        title: 'Cobrança criada!',
        description: 'A cobrança foi cadastrada com sucesso',
      });

      navigate('/');
    } catch (error) {
      console.error('Erro ao criar cobrança:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a cobrança',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedCliente = clientes.find((c) => c.id === clienteId);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nova Cobrança</h1>
          <p className="text-muted-foreground mt-1">
            Cadastre uma nova cobrança para um cliente
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Cobrança</CardTitle>
          <CardDescription>
            Selecione o cliente e a data de vencimento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nome da Cobrança */}
          <div className="space-y-2">
            <Label>Nome da Cobrança (opcional)</Label>
            <Input
              placeholder="Ex: Mensalidade Janeiro, Parcela 1/12..."
              value={nomeCobranca}
              onChange={(e) => setNomeCobranca(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Cliente Select */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione um cliente'} />
              </SelectTrigger>
              <SelectContent>
                {clientes.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum cliente ativo encontrado
                  </SelectItem>
                ) : (
                  clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.telefone}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {clientes.length === 0 && !loading && (
              <Button
                variant="link"
                className="p-0 h-auto text-sm"
                onClick={() => navigate('/clientes')}
              >
                Cadastrar novo cliente
              </Button>
            )}
          </div>

          {/* Data de Vencimento */}
          <div className="space-y-2">
            <Label>Data de Vencimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dataVencimento && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataVencimento
                    ? format(dataVencimento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataVencimento}
                  onSelect={setDataVencimento}
                  initialFocus
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Preview */}
          {selectedCliente && dataVencimento && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Resumo</p>
              <div className="text-sm text-muted-foreground space-y-1">
                {nomeCobranca && (
                  <p>
                    <span className="font-medium">Cobrança:</span> {nomeCobranca}
                  </p>
                )}
                <p>
                  <span className="font-medium">Cliente:</span> {selectedCliente.nome}
                </p>
                <p>
                  <span className="font-medium">Telefone:</span> {selectedCliente.telefone}
                </p>
                <p>
                  <span className="font-medium">Vencimento:</span>{' '}
                  {format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button
              variant="action"
              className="flex-1"
              onClick={handleSubmit}
              disabled={saving || !clienteId || !dataVencimento}
            >
              {saving ? (
                'Criando...'
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Cobrança
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
