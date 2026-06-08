import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, SafeAreaView, Keyboard,
  Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { searchManual, searchErrorCode, hasRelevantContent, MANUAL_INDEX_MAP } from './search';
import { API_URL, DEFAULT_PROVIDER } from './data';

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  userBubble: '#1a2744', aiBubble: '#131a28', error: '#ff4d6d',
};

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

export default function ChatScreen({ manual, mode, isOnline, pendingQuestion, onQuestionSent, messages, setMessages, provider = DEFAULT_PROVIDER }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
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
    const history = newMsgs.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    // Cada manual declara seus próprios índices de busca (src/data.js → searchKeys).
    // Fallback para a chave primária do MANUAL_INDEX_MAP quando não declarado.
    const primaryKey = MANUAL_INDEX_MAP[manual.id] || manual.indexKey || 'e52645_guia';
    const searchKeys = (manual.searchKeys && manual.searchKeys.length
      ? manual.searchKeys
      : [primaryKey]
    ).filter((v, i, a) => a.indexOf(v) === i);

    // Trechos de código de erro carregam o procedimento completo do manual
    // (defeito + causas + solução), até 2400 chars. Trechos de manual (busca textual)
    // ficam em 1200 chars — contexto de apoio, não a resposta principal.
    const capErr = c => c.length > 2400 ? c.substring(0, 2400) + '…' : c;
    const capMan = c => c.length > 2400 ? c.substring(0, 2400) + '…' : c;
    // Busca erros em todos os índices do modelo (evita cruzamento entre modelos Ricoh
    // porque cada modelo só tem seus próprios índices em searchKeys).
    const errorChunks = searchKeys
      .flatMap(k => searchErrorCode(q, k))
      .filter((t, i, a) => a.indexOf(t) === i)
      .slice(0, 4).map(capErr);
    const manualChunks = searchKeys.flatMap(k => searchManual(q, k, 3)).slice(0, 4).map(capMan);
    const seen = new Set();
    const chunks = [...errorChunks, ...manualChunks].filter(c => {
      const key = c.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
    const foundInManual = chunks.length > 0 && searchKeys.some(k => hasRelevantContent(q, k));

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
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const ev = JSON.parse(data);
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
          } catch {}
        }
      };

      xhr.onload = () => {
        clearTimeout(timeoutId);
        if (!doneReceived) {
          // Fallback: servidor devolveu JSON puro (sem SSE)
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
          } catch (err) {
            setMessages(m => m.map(msg =>
              msg.id === aiMsgId ? { ...msg, text: friendlyError(err), isError: true, streaming: false } : msg
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
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
        <View style={[styles.avatar, isUser ? styles.avatarUser : styles.avatarAi]}>
          <Text style={[styles.avatarText, { color: isUser ? C.accent : C.accent2 }]}>{isUser ? 'EU' : (manual.brand === 'ricoh' ? 'RC' : 'HP')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAi,
            item.isError && { backgroundColor: '#1a0a10', borderColor: '#4a1020' },
            item.offline && { backgroundColor: '#1a0d2a', borderColor: '#6b21a8' },
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
            <Text style={[styles.source, !item.fromManual && { color: '#f59e0b' }]}>
              {item.fromManual ? '● ' : '⚠ '}{item.source}
            </Text>
          )}
        </View>
      </View>
    );
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
          <TouchableOpacity key={i} style={styles.suggBtn} onPress={() => send(q)}>
            <Text style={styles.suggText}>→ {q}</Text>
          </TouchableOpacity>
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
              {messages.map((item, index) => (
                <View key={item.id}>
                  {renderMessage({ item, index })}
                </View>
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
  welcome: { padding: 20, alignItems: 'center', gap: 10, marginTop: 16 },
  welcomeIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  welcomeIconText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  welcomeTitle: { color: C.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  welcomeSub: { color: C.dim, fontSize: 12, textAlign: 'center' },
  welcomeHint: { color: C.muted, fontSize: 11, marginTop: 6 },
  suggBtn: { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 },
  suggText: { color: C.dim, fontSize: 13 },
  msgRow: { flexDirection: 'row', gap: 8 },
  msgRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgRowAi: { alignSelf: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarUser: { backgroundColor: C.userBubble, borderWidth: 1, borderColor: '#2040a0' },
  avatarAi: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  avatarText: { fontSize: 10, fontWeight: '700' },
  bubble: { padding: 10, borderRadius: 14 },
  bubbleUser: { backgroundColor: C.userBubble, borderWidth: 1, borderColor: '#2040a0', borderTopRightRadius: 4 },
  bubbleAi: { backgroundColor: C.aiBubble, borderWidth: 1, borderColor: C.border, borderTopLeftRadius: 4 },
  bubbleText: {
    color: '#ffffff', fontSize: 13, lineHeight: 20,
    padding: 0, borderWidth: 0, backgroundColor: 'transparent',
  },
  linkBtn: { marginTop: 6, backgroundColor: '#0d1f3a', borderRadius: 8, borderWidth: 1, borderColor: C.accent + '50', paddingHorizontal: 10, paddingVertical: 6 },
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
    color: '#ffffff', fontSize: 15, height: 50,
  },
  sendBtn: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendIcon: { color: '#fff', fontSize: 18 },
});
