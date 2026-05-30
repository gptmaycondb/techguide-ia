// brand: 'hp' | 'ricoh' | 'general'
export const ASSISTANT_TIPS = [
  // ─── HP MFP E52645 — Atolamentos ─────────────────────────────────────────
  { brand: 'hp', text: 'Erro 13.xx no E52645 indica atolamento. Abra a porta direita e verifique o percurso do papel com cuidado.' },
  { brand: 'hp', text: 'Atolamento na bandeja 2 do E52645? Puxe a bandeja completamente, remova o papel e verifique o rolo de puxada.' },
  { brand: 'hp', text: 'Papel rasgado dentro do E52645? Nunca force a remoção — puxe sempre na direção do percurso de impressão.' },
  { brand: 'hp', text: 'Atolamento frequente no E52645 pode indicar rolo de puxada desgastado. Part number: RM1-6467.' },
  { brand: 'hp', text: 'Antes de limpar um atolamento no E52645, anote o código de erro completo (ex.: 13.02.00) para diagnóstico.' },

  // ─── HP MFP E52645 — Toner e suprimentos ─────────────────────────────────
  { brand: 'hp', text: 'Mensagem "Toner muito baixo" no E52645? O cartucho pode render até 30% mais ao continuar imprimindo.' },
  { brand: 'hp', text: 'Para substituir o toner do E52645, abra a porta superior, gire o cartucho 90° e puxe pela alça azul.' },
  { brand: 'hp', text: 'Cartuchos compatíveis no E52645 podem acionar alarme de "cartucho não HP". Use CF287A para resultado garantido.' },
  { brand: 'hp', text: 'Depois de instalar toner novo no E52645, imprima uma página de teste em Menu > Relatórios > Página de configuração.' },
  { brand: 'hp', text: 'O fusor do E52645 tem vida útil de aprox. 200.000 páginas. Kit de manutenção: B3M78-67901.' },

  // ─── HP MFP E52645 — Rede e conectividade ────────────────────────────────
  { brand: 'hp', text: 'Para acessar o EWS (Embedded Web Server) do E52645, descubra o IP em: Painel > Configurações > Rede > Ethernet.' },
  { brand: 'hp', text: 'E52645 não aparece na rede? Verifique se o protocolo TCP/IP está ativado no EWS em Rede > Configuração.' },
  { brand: 'hp', text: 'Para imprimir via e-mail no E52645, ative HP ePrint no EWS e anote o endereço gerado em HP Connected.' },
  { brand: 'hp', text: 'Digitalizar para e-mail no E52645 falha? Verifique a porta SMTP (587 para TLS) nas configurações do EWS.' },
  { brand: 'hp', text: 'Resetar configurações de rede no E52645: Menu > Configurações > Serviço > Restaurar padrões de rede.' },

  // ─── HP MFP E52645 — Digitalização ───────────────────────────────────────
  { brand: 'hp', text: 'Digitalizar para pasta de rede no E52645 exige configuração de destino de digitalização no EWS (porta 445 SMB).' },
  { brand: 'hp', text: 'Resolução recomendada para OCR no E52645: 300 dpi. Para fotos: 600 dpi. Isso afeta muito o tamanho do arquivo.' },
  { brand: 'hp', text: 'ADF do E52645 pula páginas? Limpe os rolos do alimentador com pano levemente umedecido com álcool isopropílico.' },
  { brand: 'hp', text: 'Digitalização lenta no E52645? Reduza a resolução ou escolha "Rascunho" no perfil de digitalização.' },

  // ─── HP MFP E52645 — Firmware e erros críticos ───────────────────────────
  { brand: 'hp', text: 'Erro 49.xx no E52645 é falha de firmware ou trabalho de impressão corrompido. Desligue, aguarde 60s e ligue.' },
  { brand: 'hp', text: 'Para atualizar firmware do E52645 offline: baixe o arquivo .rfu em support.hp.com e envie via EWS > Serviço > Firmware.' },
  { brand: 'hp', text: 'Erro 79.xxxx no E52645 indica memória insuficiente ou driver incompatível. Reinstale o driver PCL 6 mais recente.' },
  { brand: 'hp', text: 'Erro 50.x Fuser no E52645 indica falha no fusor. Desligue, aguarde 10 min e verifique o conector do fusor.' },
  { brand: 'hp', text: 'Erro 59.x Motor no E52645 pode ser solucionado verificando obstruções no mecanismo de transporte de papel.' },

  // ─── HP MFP E52645 — Qualidade de impressão ──────────────────────────────
  { brand: 'hp', text: 'Impressão com riscos verticais no E52645? Limpe o cartucho de toner e o tambor com pano seco sem fiapos.' },
  { brand: 'hp', text: 'Impressão muito clara no E52645? Verifique: densidade do toner em Menu > Configurações > Qualidade de impressão.' },
  { brand: 'hp', text: 'Manchas de toner no E52645 podem indicar fusor defeituoso ou tipo de papel incompatível com a temperatura do fusor.' },
  { brand: 'hp', text: 'Fantasma de impressão (imagem repetida levemente) no E52645 indica tambor desgastado — troque o cartucho.' },
  { brand: 'hp', text: 'Imprima uma "Página de diagnóstico de qualidade" em Relatórios para identificar a causa do problema visualmente.' },

  // ─── Ricoh IM C3000/C3500 — Atolamentos ──────────────────────────────────
  { brand: 'ricoh', text: 'Atolamento no Ricoh IM C3000? O painel indica exatamente onde — siga os números da tela na ordem mostrada.' },
  { brand: 'ricoh', text: 'Para limpar atolamento na unidade duplex do Ricoh IM C3000, abra a tampa traseira e verifique a alavanca verde.' },
  { brand: 'ricoh', text: 'Papel rasgado no Ricoh IM C3500? Use a alavanca azul de liberação perto do fusor para facilitar a remoção.' },
  { brand: 'ricoh', text: 'Atolamentos frequentes no Ricoh podem indicar umidade no papel. Guarde resmas em local seco e fechado.' },
  { brand: 'ricoh', text: 'No Ricoh IM C3000, após limpar atolamento, sempre feche TODAS as tampas antes de retomar — o painel confirma.' },

  // ─── Ricoh IM C3000/C3500 — SC Codes ─────────────────────────────────────
  { brand: 'ricoh', text: 'SC 302 no Ricoh IM C3000 indica problema no motor de polígono do laser. Exige visita técnica para calibração.' },
  { brand: 'ricoh', text: 'SC 543 no Ricoh indica falha no sensor de temperatura do fusor. Desligue e aguarde 30 min antes de religar.' },
  { brand: 'ricoh', text: 'SC 400 series no Ricoh geralmente indica problema no sistema de desenvolvimento de toner — documente e chame suporte.' },
  { brand: 'ricoh', text: 'Código SC no Ricoh não limpa sozinho — exige reset via modo de serviço ou intervenção técnica presencial.' },
  { brand: 'ricoh', text: 'Anote sempre o código SC completo (ex.: SC 302-01) ao chamar suporte — facilita o diagnóstico remoto.' },

  // ─── Ricoh IM C3000/C3500 — Toner e suprimentos ──────────────────────────
  { brand: 'ricoh', text: 'No Ricoh IM C3000, substitua o toner pela cor indicada no painel — nunca force um cartucho errado no slot.' },
  { brand: 'ricoh', text: 'Toner com menos de 10% no Ricoh? Peça reposição antes de acabar — o sistema bloqueia quando atinge zero.' },
  { brand: 'ricoh', text: 'Tambor do Ricoh IM C3000: vida útil de ~120.000 páginas. O painel avisa quando está perto do fim.' },
  { brand: 'ricoh', text: 'Substituir a unidade de coleta de toner residual no Ricoh é simples: abra a porta frontal, gire e puxe o container.' },
  { brand: 'ricoh', text: 'Grampeador do Ricoh IM C3500 usa cartucho tipo SR3130. Reponha quando o painel indicar "grampos acabando".' },

  // ─── Ricoh IM C3000/C3500 — Rede e conectividade ─────────────────────────
  { brand: 'ricoh', text: 'O IP do Ricoh IM C3000 fica em: Tela inicial > Configurações do usuário > Consultar informações do dispositivo.' },
  { brand: 'ricoh', text: 'Para acessar o Web Image Monitor do Ricoh, acesse http://[IP-da-impressora] no navegador.' },
  { brand: 'ricoh', text: 'Ricoh IM C3000 com Wi-Fi: configure em Configurações do sistema > Rede > Wi-Fi. Use WPA2 para segurança.' },
  { brand: 'ricoh', text: 'Digitalizar para pasta SMB no Ricoh: cadastre o destino no Web Image Monitor em Configurações de endereço.' },
  { brand: 'ricoh', text: 'Timeout de digitalização no Ricoh? Aumente o tempo limite em Configurações do sistema > Digitalização.' },

  // ─── Ricoh IM C3500 — Qualidade de impressão ─────────────────────────────
  { brand: 'ricoh', text: 'Cores descalibradas no Ricoh IM C3000? Execute calibração em Ferramentas de usuário > Manutenção > Calibração de cor.' },
  { brand: 'ricoh', text: 'Linhas brancas horizontais no Ricoh indicam cabeça de impressão suja. Execute "Limpeza do cabeçote" no menu.' },
  { brand: 'ricoh', text: 'Impressão manchada no Ricoh pode ser papel inadequado. Use papel certificado para laser (75-90g/m²).' },
  { brand: 'ricoh', text: 'Fundo cinza nas impressões do Ricoh? Ajuste a densidade do toner em Ferramentas > Qualidade de imagem.' },

  // ─── Geral — Uso e truques do TechGuide ──────────────────────────────────
  { brand: 'general', text: 'Inclua o código de erro exato na pergunta para respostas mais precisas. Ex: "Erro 13.02.00".' },
  { brand: 'general', text: 'Pergunte em português ou inglês — o assistente entende os dois e pode misturar termos técnicos em inglês.' },
  { brand: 'general', text: 'Use o modo Técnico (ícone engrenagem) para respostas mais detalhadas com part numbers e procedimentos avançados.' },
  { brand: 'general', text: 'Use o modo Usuário para respostas simples e diretas, ideais para repassar instruções ao cliente.' },
  { brand: 'general', text: 'Mude o modelo ativo no seletor do topo para obter respostas específicas para a impressora correta.' },
  { brand: 'general', text: 'Perguntas curtas e diretas geram respostas mais rápidas. Ex: "Como trocar fusor?" funciona ótimo.' },
  { brand: 'general', text: 'O histórico de conversa fica separado por impressora — cada modelo tem seu próprio contexto de chat.' },
  { brand: 'general', text: 'Acesse os manuais em PDF na aba Manuais para consultas offline sem precisar do assistente.' },
  { brand: 'general', text: 'Dúvidas sobre part numbers? Pergunte diretamente: "Qual o part number do rolo de puxada?"' },

  // ─── Geral — Manutenção preventiva ───────────────────────────────────────
  { brand: 'general', text: 'Limpeza preventiva mensal: limpe o vidro do scanner com pano seco e verifique o percurso do papel por detritos.' },
  { brand: 'general', text: 'Mantenha a impressora longe de ar condicionado direto — variações de temperatura afetam a qualidade do toner.' },
  { brand: 'general', text: 'Papel de boa qualidade reduz até 60% dos atolamentos. Evite papel reciclado de gramatura irregular.' },
  { brand: 'general', text: 'Kit de manutenção deve ser trocado conforme o contador de páginas — não espere o equipamento apresentar erro.' },
  { brand: 'general', text: 'Documente todos os erros com data e hora — um padrão de falhas recorrentes indica peça com desgaste acelerado.' },
  { brand: 'general', text: 'Papel de boa qualidade reduz até 60% dos atolamentos. Evite papel reciclado de gramatura irregular.' },
];
