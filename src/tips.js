export const ASSISTANT_TIPS = [
  // ─── HP MFP E52645 — Atolamentos ───────────────────────────────────────────
  'Erro 13.xx no E52645 indica atolamento. Abra a porta direita e verifique o percurso do papel com cuidado.',
  'Atolamento na bandeja 2 do E52645? Puxe a bandeja completamente, remova o papel e verifique o rolo de puxada.',
  'Papel rasgado dentro do E52645? Nunca force a remoção — puxe sempre na direção do percurso de impressão.',
  'Atolamento frequente no E52645 pode indicar rolo de puxada desgastado. Part number: RM1-6467.',
  'Antes de limpar um atolamento no E52645, anote o código de erro completo (ex.: 13.02.00) para diagnóstico.',

  // ─── HP MFP E52645 — Toner e suprimentos ──────────────────────────────────
  'Mensagem "Toner muito baixo" no E52645? O cartucho pode render até 30% mais ao continuar imprimindo.',
  'Para substituir o toner do E52645, abra a porta superior, gire o cartucho 90° e puxe pela alça azul.',
  'Cartuchos compatíveis no E52645 podem acionar alarme de "cartucho não HP". Use CF287A para resultado garantido.',
  'Depois de instalar toner novo no E52645, imprima uma página de teste em Menu > Relatórios > Página de configuração.',
  'O fusor do E52645 tem vida útil de aprox. 200.000 páginas. Kit de manutenção: B3M78-67901.',

  // ─── HP MFP E52645 — Rede e conectividade ─────────────────────────────────
  'Para acessar o EWS (Embedded Web Server) do E52645, descubra o IP em: Painel > Configurações > Rede > Ethernet.',
  'E52645 não aparece na rede? Verifique se o protocolo TCP/IP está ativado no EWS em Rede > Configuração.',
  'Para imprimir via e-mail no E52645, ative HP ePrint no EWS e anote o endereço gerado em HP Connected.',
  'Digitalizar para e-mail no E52645 falha? Verifique a porta SMTP (587 para TLS) nas configurações do EWS.',
  'Resetar configurações de rede no E52645: Menu > Configurações > Serviço > Restaurar padrões de rede.',

  // ─── HP MFP E52645 — Digitalização ────────────────────────────────────────
  'Digitalizar para pasta de rede no E52645 exige configuração de destino de digitalização no EWS (porta 445 SMB).',
  'Resolução recomendada para OCR no E52645: 300 dpi. Para fotos: 600 dpi. Isso afeta muito o tamanho do arquivo.',
  'ADF do E52645 pula páginas? Limpe os rolos do alimentador com pano levemente umedecido com álcool isopropílico.',
  'Digitalização lenta no E52645? Reduza a resolução ou escolha "Rascunho" no perfil de digitalização.',

  // ─── HP MFP E52645 — Firmware e erros críticos ────────────────────────────
  'Erro 49.xx no E52645 é falha de firmware ou trabalho de impressão corrompido. Desligue, aguarde 60s e ligue.',
  'Para atualizar firmware do E52645 offline: baixe o arquivo .rfu em support.hp.com e envie via EWS > Serviço > Firmware.',
  'Erro 79.xxxx no E52645 indica memória insuficiente ou driver incompatível. Reinstale o driver PCL 6 mais recente.',
  'Erro 50.x Fuser no E52645 indica falha no fusor. Desligue, aguarde 10 min e verifique o conector do fusor.',
  'Erro 59.x Motor no E52645 pode ser solucionado verificando obstruções no mecanismo de transporte de papel.',

  // ─── HP MFP E52645 — Qualidade de impressão ───────────────────────────────
  'Impressão com riscos verticais no E52645? Limpe o cartucho de toner e o tambor com pano seco sem fiapos.',
  'Impressão muito clara no E52645? Verifique: densidade do toner em Menu > Configurações > Qualidade de impressão.',
  'Manchas de toner no E52645 podem indicar fusor defeituoso ou tipo de papel incompatível com a temperatura do fusor.',
  'Fantasma de impressão (imagem repetida levemente) no E52645 indica tambor desgastado — troque o cartucho.',
  'Imprima uma "Página de diagnóstico de qualidade" em Relatórios para identificar a causa do problema visualmente.',

  // ─── Ricoh IM C3000/C3500 — Atolamentos ───────────────────────────────────
  'Atolamento no Ricoh IM C3000? O painel indica exatamente onde — siga os números da tela na ordem mostrada.',
  'Para limpar atolamento na unidade duplex do Ricoh IM C3000, abra a tampa traseira e verifique a alavanca verde.',
  'Papel rasgado no Ricoh IM C3500? Use a alavanca azul de liberação perto do fusor para facilitar a remoção.',
  'Atolamentos frequentes no Ricoh podem indicar umidade no papel. Guarde resmas em local seco e fechado.',
  'No Ricoh IM C3000, após limpar atolamento, sempre feche TODAS as tampas antes de retomar — o painel confirma.',

  // ─── Ricoh IM C3500 — SC Codes (erros de serviço) ─────────────────────────
  'SC 302 no Ricoh IM C3000 indica problema no motor de polígono do laser. Exige visita técnica para calibração.',
  'SC 543 no Ricoh indica falha no sensor de temperatura do fusor. Desligue e aguarde 30 min antes de religar.',
  'SC 400 series no Ricoh geralmente indica problema no sistema de desenvolvimento de toner — documente e chame suporte.',
  'Código SC no Ricoh não limpa sozinho — exige reset via modo de serviço ou intervenção técnica presencial.',
  'Anote sempre o código SC completo (ex.: SC 302-01) ao chamar suporte — facilita o diagnóstico remoto.',

  // ─── Ricoh IM C3000/C3500 — Toner e suprimentos ───────────────────────────
  'No Ricoh IM C3000, substitua o toner pela cor indicada no painel — nunca force um cartucho errado no slot.',
  'Toner com menos de 10% no Ricoh? Peça reposição antes de acabar — o sistema bloqueia quando atinge zero.',
  'Tambor do Ricoh IM C3000: vida útil de ~120.000 páginas. O painel avisa quando está perto do fim.',
  'Substituir a unidade de coleta de toner residual no Ricoh é simples: abra a porta frontal, gire e puxe o container.',
  'Grampeador do Ricoh IM C3500 usa cartucho tipo SR3130. Reponha quando o painel indicar "grampos acabando".',

  // ─── Ricoh IM C3000/C3500 — Rede e conectividade ──────────────────────────
  'O IP do Ricoh IM C3000 fica em: Tela inicial > Configurações do usuário > Consultar informações do dispositivo.',
  'Para acessar o Web Image Monitor do Ricoh, acesse http://[IP-da-impressora] no navegador.',
  'Ricoh IM C3000 com Wi-Fi: configure em Configurações do sistema > Rede > Wi-Fi. Use WPA2 para segurança.',
  'Digitalizar para pasta SMB no Ricoh: cadastre o destino no Web Image Monitor em Configurações de endereço.',
  'Timeout de digitalização no Ricoh? Aumente o tempo limite em Configurações do sistema > Digitalização.',

  // ─── Ricoh IM C3500 — Qualidade de impressão ──────────────────────────────
  'Cores descalibradas no Ricoh IM C3000? Execute calibração em Ferramentas de usuário > Manutenção > Calibração de cor.',
  'Linhas brancas horizontais no Ricoh indicam cabeça de impressão suja. Execute "Limpeza do cabeçote" no menu.',
  'Impressão manchada no Ricoh pode ser papel inadequado. Use papel certificado para laser (75-90g/m²).',
  'Fundo cinza nas impressões do Ricoh? Ajuste a densidade do toner em Ferramentas > Qualidade de imagem.',

  // ─── Geral — Uso e truques do TechGuide ───────────────────────────────────
  'Inclua o código de erro exato na pergunta para respostas mais precisas. Ex: "Erro 13.02.00 no E52645".',
  'Pergunte em português ou inglês — o assistente entende os dois e pode misturar termos técnicos em inglês.',
  'Use o modo Técnico (ícone engrenagem) para respostas mais detalhadas com part numbers e procedimentos avançados.',
  'Use o modo Usuário para respostas simples e diretas, ideais para repassar instruções ao cliente.',
  'Mude o modelo ativo no seletor do topo para obter respostas específicas para a impressora correta.',
  'Perguntas curtas e diretas geram respostas mais rápidas. Ex: "Como trocar fusor E52645?" funciona ótimo.',
  'O histórico de conversa fica separado por impressora — cada modelo tem seu próprio contexto de chat.',
  'Acesse os manuais em PDF na aba Manuais para consultas offline sem precisar do assistente.',
  'Dúvidas sobre part numbers? Pergunte diretamente: "Qual o part number do rolo de puxada do E52645?"',
  'O assistente conhece os erros mais comuns de ambas as marcas — HP e Ricoh — basta perguntar!',

  // ─── Geral — Manutenção preventiva ────────────────────────────────────────
  'Limpeza preventiva mensal: limpe o vidro do scanner com pano seco e verifique o percurso do papel por detritos.',
  'Mantenha a impressora longe de ar condicionado direto — variações de temperatura afetam a qualidade do toner.',
  'Papel de boa qualidade reduz até 60% dos atolamentos. Evite papel reciclado de gramatura irregular.',
  'Kit de manutenção deve ser trocado conforme o contador de páginas — não espere o equipamento apresentar erro.',
  'Documente todos os erros com data e hora — um padrão de falhas recorrentes indica peça com desgaste acelerado.',
];
