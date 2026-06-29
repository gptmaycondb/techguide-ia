// Dicas do assistente flutuante.
// brand: 'hp' | 'ricoh' | 'general'  (fallback por marca)
// model: id do manual (ex.: 'mfpe52645', 'mfpe62655') — quando presente, a dica
//        só aparece para aquele modelo específico. Sem 'model', vale para a marca toda.
export const ASSISTANT_TIPS = [
  // ─── HP MFP E52645 — Atolamentos ─────────────────────────────────────────
  { brand: 'hp', model: 'mfpe52645', text: 'Erro 13.xx no E52645 indica atolamento. Abra a porta direita e verifique o percurso do papel com cuidado.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Atolamento na bandeja 2 do E52645? Puxe a bandeja completamente, remova o papel e verifique o rolo de puxada.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Papel rasgado dentro do E52645? Nunca force a remoção — puxe sempre na direção do percurso de impressão.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Atolamento frequente no E52645 pode indicar rolo de puxada desgastado. Consulte o Parts Catalog do E52645 para identificar o kit correto da bandeja afetada.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Antes de limpar um atolamento no E52645, anote o código de erro completo para diagnóstico.' },

  // ─── HP MFP E52645 — Toner e suprimentos ─────────────────────────────────
  { brand: 'hp', model: 'mfpe52645', text: 'Mensagem "Toner muito baixo" no E52645? O cartucho pode render até 30% mais ao continuar imprimindo.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Para substituir o toner do E52645, abra a porta superior, gire o cartucho 90° e puxe pela alça azul.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Cartuchos compatíveis no E52645 podem acionar o alerta "cartucho não HP". Consulte o Parts Catalog do E52645 para identificar o cartucho correto.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Depois de instalar toner novo no E52645, imprima uma página de teste em Menu > Relatórios > Página de configuração.' },
  { brand: 'hp', model: 'mfpe52645', text: 'O fusor do E52645 é monitorado por rotações, não por páginas. Consulte o Parts Catalog para os kits corretos dos rolos do ADF e da bandeja 2.' },

  // ─── HP MFP E52645 — Rede e conectividade ────────────────────────────────
  { brand: 'hp', model: 'mfpe52645', text: 'Para acessar o EWS (Embedded Web Server) do E52645, descubra o IP em: Painel > Configurações > Rede > Ethernet.' },
  { brand: 'hp', model: 'mfpe52645', text: 'E52645 não aparece na rede? Verifique se o protocolo TCP/IP está ativado no EWS em Rede > Configuração.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Para imprimir via e-mail no E52645, ative HP Web Services no EWS em Configurações > HP Web Services e anote o endereço gerado.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Digitalizar para e-mail no E52645 falha? Verifique a porta SMTP (587 para TLS) nas configurações do EWS.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Resetar configurações de rede no E52645: Menu > Configurações > Serviço > Restaurar padrões de rede.' },

  // ─── HP MFP E52645 — Digitalização ───────────────────────────────────────
  { brand: 'hp', model: 'mfpe52645', text: 'Digitalizar para pasta de rede no E52645 exige configuração de destino de digitalização no EWS (porta 445 SMB).' },
  { brand: 'hp', model: 'mfpe52645', text: 'Resolução recomendada para OCR no E52645: 300 dpi. Para fotos: 600 dpi. Isso afeta muito o tamanho do arquivo.' },
  { brand: 'hp', model: 'mfpe52645', text: 'ADF do E52645 pula páginas? Limpe os rolos do alimentador com pano levemente umedecido com álcool isopropílico.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Digitalização lenta no E52645? Reduza a resolução ou escolha "Rascunho" no perfil de digitalização.' },

  // ─── HP MFP E52645 — Firmware e erros críticos ───────────────────────────
  { brand: 'hp', model: 'mfpe52645', text: 'Erro 49.xx no E52645 é falha de firmware ou trabalho de impressão corrompido. Desligue, aguarde 60s e ligue.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Para atualizar firmware do E52645 offline: baixe o arquivo .rfu em support.hp.com e envie via EWS > Serviço > Firmware.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Erro 82.WX.YZ no E52645 indica falha de hardware no disco/eMMC. Desligue, aguarde 60s e ligue. Se persistir, verifique o eMMC ou substitua o formatter.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Erro 50.x Fuser no E52645 indica falha no fusor. Desligue, aguarde 10 min e verifique o conector do fusor.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Erro 59.x Motor no E52645 pode ser solucionado verificando obstruções no mecanismo de transporte de papel.' },

  // ─── HP MFP E52645 — Qualidade de impressão ──────────────────────────────
  { brand: 'hp', model: 'mfpe52645', text: 'Impressão com riscos verticais no E52645? O cartucho integra tambor e toner — troque o cartucho completo. Nunca toque na superfície do tambor OPC.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Impressão muito clara no E52645? Verifique: densidade do toner em Menu > Configurações > Qualidade de impressão.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Manchas de toner no E52645 podem indicar fusor defeituoso ou tipo de papel incompatível com a temperatura do fusor.' },
  { brand: 'hp', model: 'mfpe52645', text: 'Fantasma de impressão (imagem repetida levemente) no E52645 indica tambor desgastado — troque o cartucho.' },

  // ─── HP MFP E62655 — Atolamentos ─────────────────────────────────────────
  { brand: 'hp', model: 'mfpe62655', text: 'Erro 13.xx no E62655 indica atolamento. Anote o código completo (ex.: 13.B9.DD), abra a porta direita e siga o percurso do papel.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Atolamento na bandeja do E62655? Puxe a bandeja completamente, remova o papel e inspecione os rolos de puxada e separação.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Atolamentos frequentes no E62655 podem indicar desgaste dos rolos. Consulte o Parts Catalog do E62655 para identificar os kits corretos de manutenção e do ADF.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Papel preso no duplexer do E62655 (13.B9.xx)? Verifique o caminho de frente-e-verso atrás da porta direita antes de forçar.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Papel rasgado dentro do E62655? Nunca force — puxe sempre na direção do percurso de impressão para não deixar resíduos no fusor.' },

  // ─── HP MFP E62655 — Toner e suprimentos ─────────────────────────────────
  { brand: 'hp', model: 'mfpe62655', text: 'O E62655 usa toner preto. Consulte o Parts Catalog para identificar o cartucho correto e mantenha reposição para evitar paradas.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Mensagem "Toner muito baixo" no E62655? É possível continuar imprimindo até a qualidade cair — mantenha o cartucho correto de reposição.' },
  { brand: 'hp', model: 'mfpe62655', text: 'No cartucho do E62655 o tambor é integrado. Nunca toque na superfície do tambor OPC ao substituir.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Na manutenção preventiva do E62655, consulte o Parts Catalog para selecionar o kit MFP compatível com a tensão do equipamento.' },
  { brand: 'hp', model: 'mfpe62655', text: 'ADF do E62655 com falhas de alimentação? Consulte o Parts Catalog para identificar o kit correto dos rolos do alimentador.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Após instalar toner novo no E62655, imprima a Página de Configuração em Menu > Relatórios para confirmar o reconhecimento do suprimento.' },

  // ─── HP MFP E62655 — Rede e conectividade ────────────────────────────────
  { brand: 'hp', model: 'mfpe62655', text: 'Para acessar o EWS do E62655, descubra o IP em: Painel > Configurações > Rede > Ethernet e digite-o no navegador.' },
  { brand: 'hp', model: 'mfpe62655', text: 'E62655 não aparece na rede? Confirme que o TCP/IP está ativo no EWS em Rede > Configuração e que o cabo/porta estão OK.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Digitalizar para e-mail no E62655 falhando? Verifique servidor SMTP e porta (587 para TLS) nas configurações do EWS.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Digitalizar para pasta de rede no E62655 usa SMB (porta 445). Configure o destino de digitalização pelo EWS.' },

  // ─── HP MFP E62655 — Firmware e erros críticos ───────────────────────────
  { brand: 'hp', model: 'mfpe62655', text: 'Erro 49.xx no E62655 é falha de firmware ou trabalho corrompido. Desligue, aguarde 60s e religue antes de reenviar o trabalho.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Erro 50.x Fuser no E62655 indica falha no fusor. Desligue, aguarde 10 minutos e verifique o conector; persistindo, consulte o Parts Catalog.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Erro 59.x Motor no E62655? Verifique obstruções no transporte de papel e o assentamento do cartucho/fusor.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Erro 82.xx no E62655 indica falha de armazenamento/hardware. Desligue, aguarde 60s e religue; se persistir, verifique o eMMC/formatter.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Atualização de firmware do E62655 offline: baixe o .rfu em support.hp.com e envie pelo EWS em Serviço > Atualização de firmware.' },

  // ─── HP MFP E62655 — Qualidade de impressão ──────────────────────────────
  { brand: 'hp', model: 'mfpe62655', text: 'Riscos verticais no E62655? O tambor é integrado ao cartucho — substitua o cartucho completo se o defeito acompanhar a página.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Impressão clara no E62655? Ajuste a densidade em Menu > Configurações > Qualidade de impressão e confirme nível do toner.' },
  { brand: 'hp', model: 'mfpe62655', text: 'Manchas ou borrões no E62655 podem indicar fusor no fim da vida — consulte o Parts Catalog para o kit correto.' },

  // ─── HP E826 SERIES ───────────────────────────────────────────────────────
  { brand: 'hp', model: 'hp_e826', text: 'No E826, 13.B2.D2 eh atolamento na bandeja 2: remova papel pela porta direita e pela cavidade da bandeja. Confira o codigo exato.' },
  { brand: 'hp', model: 'hp_e826', text: '13.B9.A1 no E826 indica atolamento em modo Auto-Sense Normal. Abra a porta direita e confira papel preso na area do fusor.' },
  { brand: 'hp', model: 'hp_e826', text: '10.00.35 no E826 indica cartucho de toner preto incompativel ou lido incorretamente. Remova, reinstale e confirme o suprimento correto.' },
  { brand: 'hp', model: 'hp_e826', text: '99.09.67 no E826 indica disco/eMMC sem firmware inicializavel. Baixe firmware pelo Preboot; se persistir, verifique disco/eMMC.' },
  { brand: 'hp', model: 'hp_e826', text: '59.05.50 e 59.05.60 no E826 apontam motor do tambor preto. Desligue/ligue e, se persistir, siga o diagnostico do CPMD.' },
  { brand: 'hp', model: 'hp_e826', text: 'Para trocar toner no E826, use Eject no painel, puxe o cartucho pela extremidade e instale apenas toner preto correto para a serie.' },
  { brand: 'hp', model: 'hp_e826', text: 'Atolamento em papel A3 no E826: remova no sentido do percurso e confira bandejas 2/3 e opcionais de 2 x 520 folhas antes de religar.' },
  { brand: 'hp', model: 'hp_e826', text: 'Para pecas do E826, consulte o Parts Catalog no manual de servico combinado da tela Consulta; nao use part number de memoria.' },

  // ─── RICOH MP C3004/C3504 ────────────────────────────────────────────────
  { brand: 'ricoh', model: 'ricoh_mpc3004', text: 'SC202 no MP C3004/3504 indica que o motor poligonal não atingiu o estado READY. Verifique motor, driver, chicote e conectores.' },
  { brand: 'ricoh', model: 'ricoh_mpc3004', text: 'Códigos de fusão como SC541, SC543, SC551 e SC553 no MP C3004/3504 exigem verificar termopilhas, chicotes e unidade de fusão.' },
  { brand: 'ricoh', model: 'ricoh_mpc3004', text: 'SC816 indica erro do subsistema de economia de energia; SC818, watchdog; e SC820, autodiagnóstico da CPU. Consulte o procedimento específico do código.' },
  { brand: 'ricoh', model: 'ricoh_mpc3004', text: 'SC441-00 indica travamento do motor de transferência do tambor; SC442-00 indica falha de elevação da ITB. Verifique motor, sensores e chicotes.' },
  { brand: 'ricoh', model: 'ricoh_mpc3004', text: 'Toner MP C3004/3504: cartuchos por cor CMYK. Anote a sigla exibida no painel ao substituir para nao trocar a cor errada.' },

  // ─── RICOH IM C3000/C3500 — Atolamentos ──────────────────────────────────
  { brand: 'ricoh', model: 'ricoh_imc3000', text: 'Código SC no painel da IM C3000? Anote o número completo (ex.: SC543) antes de reiniciar — ele identifica a falha exata.' },
  { brand: 'ricoh', model: 'ricoh_imc3000', text: 'Atolamento na IM C3000/3500? Abra a tampa frontal e a unidade de transferência ITB com cuidado para liberar o papel.' },
  { brand: 'ricoh', model: 'ricoh_imc3000', text: 'SC543/SC542 na IM C3000/3500 indica problema no fusor (termistor/aquecedor). Desligue, aguarde e religue; se persistir, fusor precisa de serviço.' },
  { brand: 'ricoh', model: 'ricoh_imc3000', text: 'Toner Ricoh IM C3000/3500 por cor: anote a sigla (K/C/M/Y) exibida no painel ao trocar.' },
  { brand: 'ricoh', text: 'SC codes da série 400 na Ricoh referem-se à área do tambor (PCDU). Verifique a unidade de imagem correspondente.' },

  // ─── RICOH SP 3710DN/SF ───────────────────────────────────────────────────
  { brand: 'ricoh', model: 'ricoh_sp3710', text: 'No SP 3710, anote o SC completo antes de reiniciar; SC### eh o codigo completo nesse modelo.' },
  { brand: 'ricoh', model: 'ricoh_sp3710', text: 'SC541 e SC543 no SP 3710 apontam falha de fusao/temperatura; verifique fusor, termistores, chicotes e PSU.' },
  { brand: 'ricoh', model: 'ricoh_sp3710', text: 'SC542-01 no SP 3710 eh fuser reload; apos corrigir a causa, use Fuser SC Reset no modo de manutencao.' },
  { brand: 'ricoh', model: 'ricoh_sp3710', text: 'SC202 no SP 3710 envolve motor poligonal/laser; verifique chicotes, laser unit e placa principal.' },
  { brand: 'ricoh', model: 'ricoh_sp3710', text: 'SP 3710SF digitaliza para e-mail ou pasta de rede; valide IP, SMTP/SMB e credenciais antes de testar.' },
  { brand: 'ricoh', model: 'ricoh_sp3710', text: 'Atolamento no SP 3710? Remova o papel no sentido do percurso e confira bandeja, duplex e saida antes de religar.' },
  { brand: 'ricoh', model: 'ricoh_sp3710', text: 'Para pecas do SP 3710, consulte o Parts Catalog na tela de Consulta; nao use part number de memoria.' },

  // RICOH MP 2555/3055/3555
  { brand: 'ricoh', model: 'ricoh_mp2555_series', text: 'SC202-00 no motor poligonal: desligue e ligue o equipamento; se persistir, confira chicote e conexoes da unidade laser antes de substituir componentes.' },
  { brand: 'ricoh', model: 'ricoh_mp2555_series', text: 'SC324-01 no motor de revelacao preto: reconecte o conector e confira chicote, torque da unidade e travamento mecanico antes da troca do motor.' },
  { brand: 'ricoh', model: 'ricoh_mp2555_series', text: 'SC520-01 no motor de registro: verifique conector, chicote e encoder; depois confira se o motor gira livremente antes de substituir placa ou motor.' },
  { brand: 'ricoh', model: 'ricoh_mp2555_series', text: 'SC541-01 na termopilha central do fusor: reconecte os conectores entre fusor e placa de controle e confira o chicote antes de substituir o sensor.' },
  { brand: 'ricoh', model: 'ricoh_mp2555_series', text: 'SC547-01 de zero-cross: desligue e ligue a chave principal; se voltar, confira o rele do fusor e a conexao entre fonte e placa controladora.' },
  { brand: 'ricoh', model: 'ricoh_mp2555_series', text: 'SC559-00 apos tres atolamentos no fusor: remova o papel preso e confirme uma saida normal de papel para zerar o contador de atolamentos.' },
  { brand: 'ricoh', model: 'ricoh_mp2555_series', text: 'SC940 na serie MP 2555 aponta solenoide de pickup de bandeja: confira solenoide, chicote e mecanismo de puxada antes de substituir.' },
  { brand: 'ricoh', model: 'ricoh_mp2555_series', text: 'Atolamento frequente de papel: confira roletes de tracao, guias do percurso e umidade/qualidade do papel antes de procurar falha eletronica.' },

  // ─── GENERAL ─────────────────────────────────────────────────────────────
  { brand: 'general', text: 'Sempre anote o código de erro completo antes de reiniciar o equipamento — ele é a chave do diagnóstico.' },
  { brand: 'general', text: 'Antes de abrir a impressora, desligue e aguarde alguns minutos: o fusor opera em alta temperatura.' },
  { brand: 'general', text: 'Use papel dentro da gramatura especificada para reduzir atolamentos e desgaste dos rolos.' },
  { brand: 'general', text: 'Mantenha o firmware atualizado: muitas falhas são corrigidas em novas versões.' },
  { brand: 'general', text: 'Limpe periodicamente os rolos de tração para evitar falhas de alimentação de papel.' },
];
