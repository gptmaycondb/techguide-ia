import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, SafeAreaView, Keyboard,
  Linking, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { searchManual, searchErrorCode, searchErrorCodeEntries, hasRelevantContent, computeFoundInManual, MANUAL_INDEX_MAP } from './search';
import { API_URL, DEFAULT_PROVIDER } from './data';
import {
  loadModel, loadEmbeddings, unloadEmbeddings,
  isModelReady, semanticSearchManual,
} from './semanticSearch';
import { colors as C, radius } from './theme';
import SurfaceCard from './components/SurfaceCard';
import IconButton from './components/IconButton';
import { favoriteId, isFavorite, textHash } from './favorites';
import { getErrorFamily } from './errorFamilies';

function friendlyError(err) {
  if (err.name === 'AbortError') return 'Tempo limite excedido. Servidor iniciando — tente novamente em 30s.';
  const msg = err.message || '';
  if (msg.includes('ANTHROPIC_API_KEY')) return 'Provedor Claude sem chave configurada no servidor.';
  if (msg.includes('OPENAI_API_KEY'))    return 'Provedor OpenAI não configurado. Troque o modelo de IA no Drawer.';
  if (msg.includes('GEMINI_API_KEY'))    return 'Provedor Gemini não configurado. Troque o modelo de IA no Drawer.';
  if (msg.includes('Resposta invalida')) return 'Resposta inesperada do servidor. Tente novamente.';
  if (msg.includes('Resposta vazia'))    return 'A IA não retornou resposta. Reformule a pergunta.';
  if (msg.includes('Failed to fetch') || msg.includes('Network request failed'))
    return 'Sem conexão com o servidor. Verifique sua internet.';
  return 'Erro: ' + msg;
}

// Parser SSE puro — extrai eventos de um trecho de texto SSE.
// Puro (sem side-effects): testável fora do componente e compartilhado entre
// onprogress e onload para evitar duplicação da lógica de parsing.
function parseSseText(text) {
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (!data) continue;
    try { events.push(JSON.parse(data)); } catch {}
  }
  return events;
}

export function buildChatHistory(messages) {
  return messages
    .filter(m => m.role !== 'errorCode' && m.text)
    .slice(-6)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
}

export default function ChatScreen({ manual, mode, isOnline, pendingQuestion, onQuestionSent, messages, setMessages, provider = DEFAULT_PROVIDER, favorites = [], onToggleFavorite = () => {}, onClearConversation = () => {}, onDeleteMessage = () => {} }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // searchKeys derivado do manual — estável durante a vida do componente (key={chatKey})
  const primaryKey = MANUAL_INDEX_MAP[manual.id] || manual.indexKey || 'e52645_guia';
  const searchKeys = (manual.searchKeys?.length ? manual.searchKeys : [primaryKey])
    .filter((v, i, a) => a.indexOf(v) === i);

  // Inicia download do modelo em background no 1º render (falha silenciosa → fallback keyword)
  useEffect(() => {
    loadModel().catch(() => {});
  }, []);

  // Pré-carrega embeddings do manual atual; libera ao desmontar (manual trocado via key={})
  useEffect(() => {
    searchKeys.forEach(k => loadEmbeddings(k).catch(() => {}));
    return () => searchKeys.forEach(unloadEmbeddings);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingQuestion) {
      send(pendingQuestion);
      onQuestionSent && onQuestionSent();
    }
  }, [pendingQuestion]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    });
    return () => show.remove();
  }, []);

  const scrollToBottom = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);

  function confirmClearConversation() {
    Alert.alert(
      'Limpar conversa',
      `Apagar todas as mensagens e resultados de ${manual.label}? Esta ação não pode ser desfeita.`,
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Limpar', style: 'destructive', onPress: onClearConversation }]
    );
  }

  function confirmDeleteMessage(messageId) {
    Alert.alert(
      'Apagar mensagem',
      'Esta mensagem será removida da conversa. Esta ação não pode ser desfeita.',
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => onDeleteMessage(messageId) }]
    );
  }

  async function send(question) {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput('');
    Keyboard.dismiss();

    const userMsg = { id: Date.now(), role: 'user', text: q };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);
    scrollToBottom();

    // Limit history to last 6 messages (3 exchanges) to avoid growing token cost
    const history = buildChatHistory(newMsgs);

    // Trechos de código de erro carregam o procedimento completo do manual
    // (defeito + causas + solução), até 2400 chars. Trechos de manual (busca textual)
    // ficam em 1200 chars — contexto de apoio, não a resposta principal.
    const capErr = c => c.length > 2400 ? c.substring(0, 2400) + '…' : c;
    const capMan = c => c.length > 2400 ? c.substring(0, 2400) + '…' : c;
    // searchErrorCode recebe todas as keys do modelo para cobrir cpmd + service + guia.
    // Isolamento cross-model preservado: filtro por keys do modelo, não por key única.
    const errorChunks = searchErrorCode(q, searchKeys)
      .slice(0, 4).map(capErr);
    const errorEntries = searchErrorCodeEntries(q, searchKeys);
    // Busca semântica on-device quando modelo está pronto; fallback keyword se ainda não carregou
    const rawManualChunks = isModelReady()
      ? await semanticSearchManual(q, searchKeys, 5)
      : searchKeys.flatMap(k => searchManual(q, k, 3));
    const manualChunks = rawManualChunks.slice(0, 5).map(capMan);
    const seen = new Set();
    const chunks = [...errorChunks, ...manualChunks].filter(c => {
      const key = c.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
    const hasRC = searchKeys.map(k => hasRelevantContent(q, k));
    const foundInManual = computeFoundInManual(errorChunks, chunks, hasRC);

    if (errorEntries.length) {
      setMessages(m => [...m, { id: `error-code-${Date.now()}`, role: 'errorCode', entries: errorEntries }]);
    }

    const noChunksMsg = '\n\nNenhum trecho encontrado nos manuais indexados. Informe ao usuario que a informacao nao foi localizada no indice e sugira consultar o manual fisico ou reformular a busca.';

    const contextBlock = chunks.length > 0
      ? '\n\nTRECHOS DO MANUAL:\n\n' + chunks.map((c, i) => `[${i+1}]\n${c}`).join('\n\n---\n\n')
      + '\n\nResponda baseando-se nos trechos acima.'
      : noChunksMsg;

    const systemPrompt = (manual.prompts?.[mode] || manual.prompts?.user || '') + contextBlock;

    if (!isOnline) {
      const offlineText = foundInManual
        ? 'Modo offline — Trechos encontrados:\n\n' + chunks.map((c,i) => `[${i+1}] ${c.substring(0,1000)}${c.length>1000?'...':''}`).join('\n\n')
        : 'Modo offline — Nenhum resultado encontrado. Conecte-se para usar a IA.';
      setMessages(m => [...m, { id: Date.now()+1, role: 'ai', text: offlineText, source: 'Manual (offline)', offline: true, fromManual: foundInManual }]);
      setLoading(false);
      scrollToBottom();
      return;
    }

    const aiMsgId = Date.now() + 1;
    setMessages(m => [...m, { id: aiMsgId, role: 'ai', text: '', streaming: true }]);
    scrollToBottom();

    // Contrato legado: envia o systemPrompt já montado com os trechos corretos
    // (errorChunks de error_codes_index.json + manualChunks). O backend não refaz
    // a busca — evita alucinação em códigos de erro, que o backend não consegue resolver.
    const payload = JSON.stringify({
      system: systemPrompt,
      messages: history,
      max_tokens: 4096,
      provider,
    });

    // Em erro de REDE (não do servidor), tenta de novo 1x: ao voltar do segundo
    // plano no Android a 1ª conexão costuma estar "stale" e falha; a 2ª funciona.
    function startRequest(attempt) {
      let timeoutId;
      let firstChunk = true;
      let doneReceived = false;
      let lastIndex = 0;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_URL);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');

      // Timeout de INATIVIDADE: 60s sem nenhum chunk → aborta. Reinicia a cada dado
      // recebido, permitindo respostas longas (procedimentos completos) desde que
      // os tokens continuem fluindo.
      const armTimeout = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          xhr.abort();
          setMessages(m => m.map(msg =>
            msg.id === aiMsgId
              ? { ...msg, text: friendlyError({ name: 'AbortError' }), isError: true, streaming: false }
              : msg
          ));
          setLoading(false);
          scrollToBottom();
        }, 60000);
      };

      xhr.onprogress = () => {
        armTimeout();
        const raw = xhr.responseText.slice(lastIndex);
        lastIndex = xhr.responseText.length;
        for (const ev of parseSseText(raw)) {
          if (ev.type === 'delta' && ev.text) {
            if (firstChunk) { firstChunk = false; setLoading(false); }
            setMessages(m => m.map(msg =>
              msg.id === aiMsgId ? { ...msg, text: msg.text + ev.text } : msg
            ));
            scrollToBottom();
          } else if (ev.type === 'done') {
            doneReceived = true;
            // foundInManual LOCAL — o backend (contrato legado) não sabe se houve trecho.
            setMessages(m => m.map(msg =>
              msg.id === aiMsgId ? {
                ...msg, streaming: false,
                source: foundInManual ? `Manual: ${manual.subtitle}` : 'Resposta geral',
                fromManual: foundInManual,
              } : msg
            ));
          } else if (ev.type === 'error') {
            setMessages(m => m.map(msg =>
              msg.id === aiMsgId
                ? { ...msg, text: friendlyError(new Error(ev.message)), isError: true, streaming: false }
                : msg
            ));
          }
        }
      };

      xhr.onload = () => {
        clearTimeout(timeoutId);
        if (!doneReceived) {
          // Processar SSE restante não lido pelo onprogress (offset lastIndex evita duplicação).
          // Gemini e providers rápidos podem entregar tudo antes do onprogress disparar.
          for (const ev of parseSseText(xhr.responseText.slice(lastIndex))) {
            if (ev.type === 'delta' && ev.text) {
              setMessages(m => m.map(msg =>
                msg.id === aiMsgId ? { ...msg, text: msg.text + ev.text } : msg
              ));
            } else if (ev.type === 'done') {
              doneReceived = true;
              setMessages(m => m.map(msg =>
                msg.id === aiMsgId ? {
                  ...msg, streaming: false,
                  source: foundInManual ? `Manual: ${manual.subtitle}` : 'Resposta geral',
                  fromManual: foundInManual,
                } : msg
              ));
            } else if (ev.type === 'error') {
              doneReceived = true;
              setMessages(m => m.map(msg =>
                msg.id === aiMsgId
                  ? { ...msg, text: friendlyError(new Error(ev.message)), isError: true, streaming: false }
                  : msg
              ));
            }
          }
        }
        if (!doneReceived) {
          // Fallback JSON puro: backend antigo sem SSE ou resposta não-stream.
          try {
            const json = JSON.parse(xhr.responseText);
            if (json.error) throw new Error(typeof json.error === 'string' ? json.error : json.error.message);
            if (!json.content?.length) throw new Error('Resposta vazia');
            const answer = json.content.map(b => b.text || '').join('');
            setMessages(m => m.map(msg =>
              msg.id === aiMsgId ? {
                ...msg, text: answer, streaming: false,
                source: foundInManual ? `Manual: ${manual.subtitle}` : 'Resposta geral',
                fromManual: foundInManual,
              } : msg
            ));
          } catch (parseErr) {
            const preview = xhr.responseText.slice(0, 300).replace(/\n/g, ' ');
            const errMsg = /Unexpected|JSON|token/i.test(parseErr.message)
              ? `Resposta inesperada do servidor: "${preview}"`
              : parseErr.message;
            setMessages(m => m.map(msg =>
              msg.id === aiMsgId
                ? { ...msg, text: friendlyError(new Error(errMsg)), isError: true, streaming: false }
                : msg
            ));
          }
        }
        setLoading(false);
        scrollToBottom();
      };

      xhr.onerror = () => {
        clearTimeout(timeoutId);
        // Erro de rede: o request não chegou ao servidor → retry seguro (sem duplicar).
        if (attempt < 2) {
          setMessages(m => m.map(msg =>
            msg.id === aiMsgId ? { ...msg, text: '', streaming: true } : msg
          ));
          setTimeout(() => startRequest(attempt + 1), 1200);
          return;
        }
        setMessages(m => m.map(msg =>
          msg.id === aiMsgId
            ? { ...msg, text: friendlyError(new Error('Network request failed')), isError: true, streaming: false }
            : msg
        ));
        setLoading(false);
        scrollToBottom();
      };

      armTimeout();
      xhr.send(payload);
    }

    startRequest(1);
  }

  function extractLinks(text) {
    const links = [];
    const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    const plainRe = /https?:\/\/[^\s\])"]+/g;
    let m;
    while ((m = mdRe.exec(text)) !== null) links.push({ label: m[1], url: m[2] });
    const stripped = text.replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, '');
    while ((m = plainRe.exec(stripped)) !== null) links.push({ label: m[0], url: m[0] });
    return links;
  }

  function renderMessage({ item }) {
    if (item.role === 'errorCode') {
      const entries = [...new Map(item.entries.map(entry => [entry.code, entry])).values()];
      return <View style={styles.codeGroup}>
        {entries.map(entry => {
          const id = favoriteId('code', `${entry.code}:${entry.serviceKey}:${textHash(entry.text)}`);
          const favorite = { type: 'code', id, label: entry.code, meta: sourceLabel(entry.serviceKey), color: C.alert, code: entry.code, serviceKey: entry.serviceKey, text: entry.text, modelId: manual.id };
          const family = getErrorFamily(entry.code, manual.id);
          return <SurfaceCard key={id} style={styles.codeCard}>
            <View style={styles.codeHead}><View style={{ flex: 1 }}><Text style={styles.codeValue}>{entry.code}</Text><View style={styles.codeTags}>{family && <Text style={styles.codeFamily}>{family}</Text>}<Text style={[styles.codeModel, { color: manual.color || C.accent, borderColor: (manual.color || C.accent) + '80' }]}>{manual.label}</Text><Text style={styles.codeSource}>{sourceLabel(entry.serviceKey)}</Text></View></View><IconButton icon={isFavorite(favorites, id) ? '★' : '☆'} onPress={() => onToggleFavorite(favorite)} style={styles.codeStar} iconStyle={isFavorite(favorites, id) ? styles.codeStarFilled : styles.codeStarOutline} /></View>
          </SurfaceCard>;
        })}
      </View>;
    }
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
        <View style={[styles.avatar, isUser ? styles.avatarUser : styles.avatarAi]}>
          <Text style={[styles.avatarText, { color: isUser ? C.accent : C.accent2 }]}>{isUser ? 'EU' : (manual.brand === 'ricoh' ? 'RC' : 'HP')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAi,
            item.isError && { backgroundColor: C.dangerSurface, borderColor: C.dangerBorder },
            item.offline && { backgroundColor: C.offlineSurface, borderColor: C.offlineBorder },
          ]}>
            <Text
              selectable
              style={[styles.bubbleText, item.isError && { color: C.error }]}
            >
              {item.streaming ? item.text + '▌' : item.text}
            </Text>
            {!isUser && !item.isError && extractLinks(item.text).map((lnk, i) => (
              <TouchableOpacity key={i} style={styles.linkBtn} onPress={() => Linking.openURL(lnk.url)}>
                <Text style={styles.linkBtnText} numberOfLines={1}>🔗 {lnk.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {item.source && (
            <Text style={[styles.source, !item.fromManual && { color: C.alert }]}>
              {item.fromManual ? '● ' : '⚠ '}{item.source}
            </Text>
          )}
        </View>
      </View>
    );
  }

  function sourceLabel(serviceKey) {
    if (serviceKey.includes('cpmd')) return 'Manual (CPMD)';
    if (serviceKey.includes('service')) return 'Service Manual';
    return 'Manual';
  }

  function renderWelcome() {
    const topics = manual.topics?.[mode] || manual.topics?.user || {};
    const questions = Object.values(topics).flat().slice(0, 4);
    return (
      <View style={styles.welcome}>
        <View style={[styles.welcomeIcon, { backgroundColor: manual.color || C.accent }]}>
          <Text style={styles.welcomeIconText}>{manual.brand === 'ricoh' ? 'RC' : 'HP'}</Text>
        </View>
        <Text style={styles.welcomeTitle}>{manual.label}</Text>
        <Text style={styles.welcomeSub}>{manual.subtitle}</Text>
        <Text style={styles.welcomeHint}>Sugestoes de pesquisa:</Text>
        {questions.map((q, i) => (
          <SurfaceCard as={TouchableOpacity} key={i} variant="compact" style={styles.suggBtn} onPress={() => send(q)}>
            <Text style={styles.suggText}>→ {q}</Text>
          </SurfaceCard>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {messages.length === 0
          ? <ScrollView style={styles.list} contentContainerStyle={{ flexGrow: 1 }}>
              {renderWelcome()}
            </ScrollView>
          : <ScrollView ref={listRef} style={styles.list}
              contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}>
              {messages.length > 0 && <TouchableOpacity style={styles.clearConversationBtn} onPress={confirmClearConversation} activeOpacity={0.75}><Text style={styles.clearConversationText}>Limpar conversa</Text></TouchableOpacity>}
              {messages.map((item, index) => (
                <TouchableOpacity key={item.id} activeOpacity={1} onLongPress={() => confirmDeleteMessage(item.id)} delayLongPress={450}>
                  {renderMessage({ item, index })}
                </TouchableOpacity>
              ))}
            </ScrollView>
        }

        {loading && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={C.accent2} />
            <Text style={[styles.typingText, { color: C.accent2 }]}>Consultando manual...</Text>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Pesquise no manual..."
            placeholderTextColor={C.muted}
            multiline={false}
            maxLength={300}
            textAlignVertical="center"
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: (!input.trim() || loading) ? C.border : C.accent }]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendIcon}>▶</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { flex: 1 },
  clearConversationBtn: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1, borderColor: C.dangerBorder, backgroundColor: C.dangerSurface },
  clearConversationText: { color: C.danger, fontSize: 11, fontWeight: '700' },
  welcome: { padding: 20, alignItems: 'center', gap: 10, marginTop: 16 },
  codeGroup: { gap: 8, paddingHorizontal: 14 },
  codeCard: { backgroundColor: C.alert + '12', borderColor: C.alert + '70', borderLeftWidth: 3, borderLeftColor: C.alert, padding: 12 },
  codeHead: { flexDirection: 'row', alignItems: 'center' },
  codeValue: { color: C.alert, fontSize: 18, fontWeight: '800' },
  codeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  codeFamily: { color: C.alert, backgroundColor: C.alert + '1f', borderColor: C.alert + '80', borderWidth: 1, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: '700' },
  codeModel: { backgroundColor: 'transparent', borderWidth: 1, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: '700' },
  codeSource: { color: '#AEB6C4', backgroundColor: C.surface2, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, fontSize: 11 },
  codeStar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'transparent', borderWidth: 0 },
  codeStarFilled: { color: C.alert, fontSize: 20 },
  codeStarOutline: { color: '#AEB6C4', fontSize: 20 },
  welcomeIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  welcomeIconText: { color: C.white, fontWeight: '800', fontSize: 18 },
  welcomeTitle: { color: C.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  welcomeSub: { color: C.dim, fontSize: 12, textAlign: 'center' },
  welcomeHint: { color: C.muted, fontSize: 11, marginTop: 6 },
  suggBtn: { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 },
  suggText: { color: C.dim, fontSize: 13 },
  msgRow: { flexDirection: 'row', gap: 8 },
  msgRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgRowAi: { alignSelf: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarUser: { backgroundColor: C.userBubble, borderWidth: 1, borderColor: C.accent + '80' },
  avatarAi: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  avatarText: { fontSize: 10, fontWeight: '700' },
  bubble: { padding: 10, borderRadius: 14 },
  bubbleUser: { backgroundColor: C.userBubble, borderWidth: 1, borderColor: C.accent + '80', borderTopRightRadius: radius.sm / 2 },
  bubbleAi: { backgroundColor: C.aiBubble, borderWidth: 1, borderColor: C.border, borderTopLeftRadius: 4 },
  bubbleText: {
    color: C.white, fontSize: 13, lineHeight: 20,
    padding: 0, borderWidth: 0, backgroundColor: 'transparent',
  },
  linkBtn: { marginTop: 6, backgroundColor: C.infoSurface, borderRadius: radius.sm, borderWidth: 1, borderColor: C.accent + '50', paddingHorizontal: 10, paddingVertical: 6 },
  linkBtnText: { color: C.accent, fontSize: 11, fontWeight: '600' },
  source: { color: C.muted, fontSize: 10, marginTop: 4, marginLeft: 2 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingLeft: 16 },
  typingText: { fontSize: 12 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface,
  },
  input: {
    flex: 1, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    color: C.white, fontSize: 15, height: 50,
  },
  sendBtn: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendIcon: { color: C.white, fontSize: 18 },
});
