-- Adicionar user_id às tabelas para isolamento de dados por usuário
ALTER TABLE public.clientes ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.cobrancas ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Remover políticas antigas
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem criar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem ver clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar cobranças" ON public.cobrancas;
DROP POLICY IF EXISTS "Usuários autenticados podem criar cobranças" ON public.cobrancas;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar cobranças" ON public.cobrancas;
DROP POLICY IF EXISTS "Usuários autenticados podem ver cobranças" ON public.cobrancas;

-- Criar novas políticas para clientes com verificação de ownership
CREATE POLICY "Users can view own clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own clientes"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clientes"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clientes"
  ON public.clientes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Criar novas políticas para cobrancas com verificação de ownership
CREATE POLICY "Users can view own cobrancas"
  ON public.cobrancas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cobrancas"
  ON public.cobrancas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cobrancas"
  ON public.cobrancas FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cobrancas"
  ON public.cobrancas FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);