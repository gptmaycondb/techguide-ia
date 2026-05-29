import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, SafeAreaView, Keyboard,
  Platform, Animated,
} from 'react-native';
import { searchManual, hasRelevantContent, MANUAL_INDEX_MAP } from './search';
import { API_URL, USER_MODES } from './data';

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  userBubble: '#1a2744', aiBubble: '#131a28', error: '#ff4d6d',
};

const TIPS = [
  '💡 Tente: "Como resolver atolamento na bandeja 2?"',
  '💡 Use o codigo de erro: "O que significa erro 13.02?"',
  '💡 Pesquise em portugues ou ingles — entendo os dois!',
  '💡 Tente: "Como substituir o fusor do E52645?"',
  '💡 Pergunte: "Qual o part number do rolo de puxada?"',
  '💡 Tente: "Scanner nao calibra, como resolver?"',
  '💡 Perguntas diretas dao melhores resultados',
  '💡 Tente: "Como configurar digitalizar para email?"',
  '💡 Pergunte: "Impressao saindo com riscos, o que fazer?"',
  '💡 Tente: "Como acessar o EWS da impressora?"',
  '💡 Pergunte: "Erro 49.xx firmware, como resolver?"',
  '💡 Tente: "Cartucho nao reconhecido, como resolver?"',
  '💡 Pergunte: "Como imprimir frente e verso automatico?"',
  '💡 Tente: "Bandeja 2 nao puxa papel, o que fazer?"',
  '💡 Pergunte: "Como trocar o kit de manutencao?"',
];

function AssistantBubble({ onSuggest, onClose }) {
  const [tipIdx, setTipIdx] = useState(Math.floor(Math.random() * TIPS.length));
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    const interval = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Animated.View style={[styles.assistantWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={styles.assistantBubble}
        onPress={() => onSuggest(TIPS[tipIdx].replace(/^💡 Tente: |^💡 Pergunte: |^💡 Use o codigo de erro: |^💡 /,'').replace(/"/g,''))}
        activeOpacity={0.8}
      >
        <Text style={styles.assistantIcon}>🤖</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.assistantTitle}>Assistente TG</Text>
          <Text style={styles.assistantTip}>{TIPS[tipIdx]}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.assistantClose} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Text style={styles.assistantCloseText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ChatScreen({ manual, mode, isOnline, pendingQuestion, onQuestionSent, messages, setMessages }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [showAssistant, setShowAssistant] = useState(true);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const currentMode = USER_MODES[mode] || USER_MODES['user'];

  useEffect(() => {
    if (pendingQuestion) {
      send(pendingQuestion);
      onQuestionSent && onQuestionSent();
    }
  }, [pendingQuestion]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKbHeight(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const scrollToBottom = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);

  async function send(question) {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput('');
    setShowAssistant(false);
    Keyboard.dismiss();

    const userMsg = { id: Date.now(), role: 'user', text: q };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);
    scrollToBottom();

    const history = newMsgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    const indexKey = MANUAL_INDEX_MAP[manual.id] || manual.indexKey || 'e52645_guia';
    const chunks = searchManual(q, indexKey, 6);
    const foundInManual = chunks.length > 0 && hasRelevantContent(q, indexKey);

    const contextBlock = chunks.length > 0
      ? '\n\nTRECHOS DO MANUAL:\n\n' + chunks.map((c, i) => `[${i+1}]\n${c}`).join('\n\n---\n\n')
      + '\n\nResponda baseando-se nos trechos acima.'
      : '\n\nNenhum trecho encontrado. Informe claramente e responda com conhecimento geral.';

    const systemPrompt = (manual.prompts?.[mode] || manual.prompts?.user || '') + contextBlock;

    if (!isOnline) {
      const offlineText = foundInManual
        ? 'Modo offline — Trechos encontrados:\n\n' + chunks.map((c,i) => `[${i+1}] ${c.substring(0,400)}${c.length>400?'...':''}`).join('\n\n')
        : 'Modo offline — Nenhum resultado encontrado. Conecte-se para usar a IA.';
      setMessages(m => [...m, { id: Date.now()+1, role: 'ai', text: offlineText, source: 'Manual (offline)', offline: true, fromManual: foundInManual }]);
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
      try { data = JSON.parse(text); } catch { throw new Error('Resposta invalida'); }
      if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message);
      if (!data.content?.length) throw new Error('Resposta vazia');
      const answer = data.content.map(b => b.text || '').join('');
      setMessages(m => [...m, {
        id: Date.now()+1, role: 'ai', text: answer,
        source: foundInManual ? `Manual: ${manual.subtitle}` : 'Resposta geral',
        fromManual: foundInManual,
      }]);
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Tempo limite excedido. Servidor iniciando — tente novamente em 30s.'
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
          <Text style={[styles.avatarText, { color: isUser ? C.accent : C.accent2 }]}>{isUser ? 'EU' : 'HP'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAi,
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
    const topics = manual.topics?.[mode] || manual.topics?.user || {};
    const questions = Object.values(topics).flat().slice(0, 4);
    return (
      <View style={styles.welcome}>
        <View style={[styles.welcomeIcon, { backgroundColor: C.accent }]}>
          <Text style={styles.welcomeIconText}>HP</Text>
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

  const extraBottom = Platform.OS === 'android' && kbHeight > 0 ? kbHeight : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        {messages.length === 0
          ? <FlatList data={[{ key: 'w' }]} renderItem={renderWelcome} style={styles.list} keyExtractor={i => i.key} />
          : <FlatList ref={listRef} data={messages} keyExtractor={m => m.id.toString()}
              renderItem={renderMessage} style={styles.list}
              contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 12 }} />
        }

        {loading && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={C.accent2} />
            <Text style={[styles.typingText, { color: C.accent2 }]}>Consultando manual...</Text>
          </View>
        )}

        {showAssistant && messages.length === 0 && kbHeight === 0 && (
          <AssistantBubble
            onSuggest={(tip) => { setInput(tip); inputRef.current?.focus(); }}
            onClose={() => setShowAssistant(false)}
          />
        )}

        <View style={[styles.inputBar, { marginBottom: extraBottom }]}>
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
  bubbleText: { color: '#ffffff', fontSize: 13, lineHeight: 20 },
  source: { color: C.muted, fontSize: 10, marginTop: 4, marginLeft: 2 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingLeft: 16 },
  typingText: { fontSize: 12 },
  assistantWrap: { marginHorizontal: 14, marginBottom: 6 },
  assistantBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0d1f3a', borderWidth: 1, borderColor: C.accent + '50',
    borderRadius: 14, padding: 12,
  },
  assistantIcon: { fontSize: 22 },
  assistantTitle: { color: C.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  assistantTip: { color: C.dim, fontSize: 12, lineHeight: 17 },
  assistantClose: { padding: 4 },
  assistantCloseText: { color: C.muted, fontSize: 14 },
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
