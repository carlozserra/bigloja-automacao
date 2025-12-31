-- Enum para status de cobrança
CREATE TYPE public.status_cobranca AS ENUM ('aberta', 'encerrada');

-- Enum para status de disparo
CREATE TYPE public.status_disparo AS ENUM ('enviado', 'invalido', 'erro');

-- Tabela de clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de cobranças
CREATE TABLE public.cobrancas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data_vencimento DATE NOT NULL,
  status status_cobranca NOT NULL DEFAULT 'aberta',
  ativa BOOLEAN NOT NULL DEFAULT true,
  ultimo_disparo TIMESTAMP WITH TIME ZONE,
  status_ultimo_disparo status_disparo,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para clientes (acesso autenticado)
CREATE POLICY "Usuários autenticados podem ver clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar clientes"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar clientes"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem deletar clientes"
  ON public.clientes FOR DELETE
  TO authenticated
  USING (true);

-- Políticas RLS para cobranças (acesso autenticado)
CREATE POLICY "Usuários autenticados podem ver cobranças"
  ON public.cobrancas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar cobranças"
  ON public.cobrancas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar cobranças"
  ON public.cobrancas FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem deletar cobranças"
  ON public.cobrancas FOR DELETE
  TO authenticated
  USING (true);

-- Índices para performance
CREATE INDEX idx_cobrancas_cliente_id ON public.cobrancas(cliente_id);
CREATE INDEX idx_cobrancas_status ON public.cobrancas(status);
CREATE INDEX idx_cobrancas_data_vencimento ON public.cobrancas(data_vencimento);