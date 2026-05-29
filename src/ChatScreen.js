import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, SafeAreaView, Keyboard, Platform,
} from 'react-native';
import { searchManual, hasRelevantContent } from './search';
import { API_URL, USER_MODES } from './data';

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  userBubble: '#1a2744', aiBubble: '#131a28', error: '#ff4d6d',
};

export default function ChatScreen({ manual, mode, isOnline, pendingQuestion, onQuestionSent, messages, setMessages }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const listRef = useRef(null);
  const currentMode = USER_MODES[mode];

  useEffect(() => {
    if (pendingQuestion) {
      send(pendingQuestion);
      onQuestionSent && onQuestionSent();
    }
  }, [pendingQuestion]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const scrollToBottom = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);

  async function send(question) {
    if (!question.trim() || loading) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', text: question };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);
    scrollToBottom();

    const history = newMsgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    const chunks = searchManual(question, manual.indexKey, 5);
    const foundInManual = chunks.length > 0 && hasRelevantContent(question, manual.indexKey);

    const contextBlock = chunks.length > 0
      ? '\n\nTRECHOS DO MANUAL:\n\n' + chunks.map((c, i) => `[${i+1}] ${c}`).join('\n\n') + '\n\nUse os trechos para responder.'
      : '\n\nNenhum trecho encontrado. Informe o usuario e responda com conhecimento geral.';

    const systemPrompt = manual.prompts[mode] + contextBlock;

    if (!isOnline) {
      const offlineText = foundInManual
        ? 'Modo offline - trechos do manual:\n\n' + chunks.map((c,i) => `[${i+1}] ${c.substring(0,350)}`).join('\n\n')
        : 'Modo offline. Sem conexao e sem trechos encontrados para esta pesquisa.';
      setMessages(m => [...m, { id: Date.now()+1, role: 'ai', text: offlineText, source: 'Manual (offline)', offline: true }]);
      setLoading(false);
      scrollToBottom();
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: systemPrompt, messages: history, manualId: manual.id }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('Resposta invalida do servidor'); }
      if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message);
      if (!data.content?.length) throw new Error('Resposta vazia');
      const answer = data.content.map(b => b.text || '').join('');
      const source = foundInManual ? `Manual: ${manual.subtitle}` : 'Resposta geral (nao no manual)';
      setMessages(m => [...m, { id: Date.now()+1, role: 'ai', text: answer, source, fromManual: foundInManual }]);
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Tempo limite excedido. Servidor iniciando, tente novamente em 30s.'
        : 'Erro: ' + err.message;
      setMessages(m => [...m, { id: Date.now()+1, role: 'ai', text: msg, isError: true }]);
    }

    setLoading(false);
    scrollToBottom();
  }

  function renderMessage({ item }) {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
        <View style={[styles.avatar, isUser ? styles.avatarUser : styles.avatarAi]}>
          <Text style={[styles.avatarText, { color: isUser ? C.accent : currentMode.color }]}>{isUser ? 'EU' : 'HP'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi,
            item.isError && { backgroundColor: '#1a0a10', borderColor: '#4a1020' },
            item.offline && { backgroundColor: '#1a0d2a', borderColor: '#6b21a8' },
          ]}>
            <Text style={[styles.bubbleText, item.isError && { color: C.error }]}>{item.text}</Text>
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
    const topics = manual.topics[mode] || manual.topics.user;
    const questions = Object.values(topics).flat().slice(0, 3);
    return (
      <View style={styles.welcome}>
        <View style={[styles.welcomeIcon, { backgroundColor: currentMode.color }]}>
          <Text style={styles.welcomeIconText}>{currentMode.icon}</Text>
        </View>
        <Text style={styles.welcomeTitle}>{manual.label}</Text>
        <Text style={[styles.welcomeMode, { color: currentMode.color }]}>{currentMode.description}</Text>
        <Text style={styles.welcomeHint}>Sugestoes:</Text>
        {questions.map((q, i) => (
          <TouchableOpacity key={i} style={styles.suggBtn} onPress={() => send(q)}>
            <Text style={styles.suggText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        {messages.length === 0
          ? <FlatList data={[{ key: 'w' }]} renderItem={renderWelcome} style={styles.list} />
          : <FlatList ref={listRef} data={messages} keyExtractor={m => m.id.toString()}
              renderItem={renderMessage} style={styles.list}
              contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 8 }} />
        }

        {loading && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={currentMode.color} />
            <Text style={[styles.typingText, { color: currentMode.color }]}>
              {mode === 'user' ? 'Buscando resposta...' : 'Consultando manual...'}
            </Text>
          </View>
        )}

        <View style={[styles.inputBar, Platform.OS === 'android' && { marginBottom: kbHeight > 0 ? kbHeight - 10 : 0 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={mode === 'user' ? 'Como posso te ajudar?' : 'Consulta tecnica...'}
            placeholderTextColor={C.muted}
            multiline
            maxLength={500}
            onFocus={scrollToBottom}
            textAlignVertical="center"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: (!input.trim() || loading) ? C.border : currentMode.color }]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendIcon}>▶</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { flex: 1 },
  welcome: { padding: 20, alignItems: 'center', gap: 10, marginTop: 16 },
  welcomeIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  welcomeIconText: { fontSize: 24 },
  welcomeTitle: { color: C.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  welcomeMode: { fontSize: 12, textAlign: 'center' },
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
  bubbleText: { color: '#ffffff', fontSize: 13, lineHeight: 20 },
  source: { color: C.muted, fontSize: 10, marginTop: 4, marginLeft: 2 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingLeft: 16 },
  typingText: { fontSize: 12 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  input: {
    flex: 1,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    minHeight: 50,
    maxHeight: 120,
  },
  sendBtn: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendIcon: { color: '#fff', fontSize: 18 },
});
