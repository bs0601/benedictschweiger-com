exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    
    // Basic validation
    if (!data.nome || !data.email || !data.telefone) {
      return { statusCode: 400, body: 'Missing required fields' };
    }

    // Format the lead data for email
    const budgetLabels = {
      'ate-4m': 'Até R$ 4 milhões',
      '4m-5m': 'R$ 4 milhões — R$ 5 milhões',
      '5m-6m': 'R$ 5 milhões — R$ 6 milhões',
      'acima-6m': 'Acima de R$ 6 milhões'
    };

    const timelineLabels = {
      'imediato': 'Imediato (já estou decidido)',
      '1-3-meses': '1 a 3 meses',
      '3-6-meses': '3 a 6 meses',
      '6-12-meses': '6 a 12 meses',
      'ainda-nao-sei': 'Ainda estou pesquisando'
    };

    const financiamentoLabels = {
      'a-vista': 'À vista',
      'financiado': 'Financiamento bancário',
      'parcelado-direto': 'Parcelado direto com proprietário',
      'nao-sei-ainda': 'Ainda não decidi'
    };

    const emailBody = `
Novo lead — Casa Maresias
========================

Nome: ${data.nome}
Email: ${data.email}
Telefone: ${data.telefone}
Cidade/Estado: ${data.cidade || 'Não informado'}

QUALIFICAÇÃO
------------
Faixa de investimento: ${budgetLabels[data.budget] || data.budget}
Timeline: ${timelineLabels[data.timeline] || data.timeline}
Forma de pagamento: ${financiamentoLabels[data.financiamento] || data.financiamento}

Enviado em: ${new Date(data.submittedAt).toLocaleString('pt-BR')}
Source: ${data.source}
    `.trim();

    // Log lead (replace with email service when ready)
    console.log('=== NEW LEAD ===');
    console.log(emailBody);
    console.log('================');

    // Build WhatsApp message for qualified leads
    const waMsg = encodeURIComponent(`Olá! Tenho interesse na Casa Maresias (Cond. Vila Verde).

Meus dados:
• Nome: ${data.nome}
• Cidade: ${data.cidade || 'Não informado'}
• Orçamento: ${budgetLabels[data.budget]}
• Timeline: ${timelineLabels[data.timeline]}
• Pagamento: ${financiamentoLabels[data.financiamento]}

Gostaria de agendar uma visita.`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        whatsappUrl: `https://wa.me/5511999895999?text=${waMsg}`
      })
    };

  } catch (err) {
    console.error('Lead capture error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
