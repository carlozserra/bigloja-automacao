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
      console.error('[AUTH] Missing authorization header');
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

    // Verify JWT using getClaims (compatible with signing-keys)
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('[AUTH] Token validation failed');
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('[WEBHOOK] Request initiated', { user_id: userId });

    // Get webhook URL
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!webhookUrl) {
      console.error('[CONFIG] Webhook URL not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço temporariamente indisponível' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate input
    const body = await req.json();
    const cobrancaId = body?.cobranca?.id;

    if (!cobrancaId || !isValidUUID(cobrancaId)) {
      console.error('[VALIDATION] Invalid cobranca ID format');
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
      console.error('[DB] Cobranca not found or access denied');
      return new Response(
        JSON.stringify({ error: 'Cobrança não encontrada ou acesso negado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Type assertion for clientes relationship (single object due to foreign key)
    const clienteData = cobranca.clientes;
    const cliente = Array.isArray(clienteData) ? clienteData[0] : clienteData;
    
    if (!cliente || typeof cliente !== 'object' || !('nome' in cliente) || !('telefone' in cliente)) {
      console.error('[DB] Cliente not found for cobranca');
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

    console.log('[WEBHOOK] Sending request', { cobranca_id: cobranca.id });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });

    const responseText = await response.text();
    console.log('[WEBHOOK] Response received', { status: response.status, cobranca_id: cobranca.id });

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
    console.error('[ERROR] Webhook execution failed');
    return new Response(
      JSON.stringify({ status: 'erro', message: 'Falha ao processar requisição' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
