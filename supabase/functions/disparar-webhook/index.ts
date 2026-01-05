import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation helper
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth context
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Get webhook URL
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!webhookUrl) {
      console.error('N8N_WEBHOOK_URL não configurada');
      return new Response(
        JSON.stringify({ error: 'Webhook URL não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate input
    const body = await req.json();
    const cobrancaId = body?.cobranca?.id;

    if (!cobrancaId || !isValidUUID(cobrancaId)) {
      console.error('Invalid cobranca ID:', cobrancaId);
      return new Response(
        JSON.stringify({ error: 'Invalid cobranca ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch cobranca from database - RLS will ensure user owns this record
    const { data: cobranca, error: fetchError } = await supabaseClient
      .from('cobrancas')
      .select('id, data_vencimento, nome, clientes(nome, telefone)')
      .eq('id', cobrancaId)
      .single();

    if (fetchError || !cobranca) {
      console.error('Cobranca not found or access denied:', fetchError?.message);
      return new Response(
        JSON.stringify({ error: 'Cobrança não encontrada ou acesso negado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Type assertion for clientes relationship (single object due to foreign key)
    const clienteData = cobranca.clientes;
    const cliente = Array.isArray(clienteData) ? clienteData[0] : clienteData;
    
    if (!cliente || typeof cliente !== 'object' || !('nome' in cliente) || !('telefone' in cliente)) {
      console.error('Cliente not found for cobranca:', cobrancaId);
      return new Response(
        JSON.stringify({ error: 'Cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use database data, not user input - prevents injection attacks
    const webhookData = {
      cliente_nome: cliente.nome,
      cliente_telefone: cliente.telefone,
      data_vencimento: cobranca.data_vencimento,
      cobranca_id: cobranca.id,
      cobranca_nome: cobranca.nome || null,
    };

    console.log('Sending to webhook:', JSON.stringify(webhookData));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });

    const responseText = await response.text();
    console.log('Webhook response:', response.status, responseText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          status: 'erro',
          message: `Erro no webhook: ${response.status}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ status: 'enviado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao disparar webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ status: 'erro', message: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});