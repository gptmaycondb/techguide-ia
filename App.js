import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Animated, Dimensions, ScrollView, AppState, Alert,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { logout, restoreSession } from './src/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/LoginScreen';
import WelcomeScreen from './src/WelcomeScreen';

SplashScreen.preventAutoHideAsync();
import { ALL_MANUALS, API_URL, AI_PROVIDERS, DEFAULT_PROVIDER } from './src/data';
import ChatScreen from './src/ChatScreen';
import DrawerContent from './src/DrawerContent';
import ManualsScreen from './src/ManualsScreen';
import AssistantBubble from './src/AssistantBubble';
import FavoritesScreen from './src/FavoritesScreen';
import { favoriteId, addFavorite, removeFavorite, isFavorite, listFavorites, saveFavorites } from './src/favorites';
import { getCodeFavoriteRestoreMessages } from './src/codeFavorites';
import { ONBOARDING_STEPS, getOnboardingStep, onboardingStorageKey } from './src/onboarding';
import { clearAllConversations, clearConversation, deleteConversationMessage } from './src/conversationState';
import { colors as C, radius, spacing } from './src/theme';
import SurfaceCard from './src/components/SurfaceCard';
import StatusBadge from './src/components/StatusBadge';
import IconButton from './src/components/IconButton';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.82, 300);

const BOTTOM_TABS = [
  { id: 'chat', label: 'Consulta', icon: '💬' },
  { id: 'manuals', label: 'Manuais', icon: '📚' },
  { id: 'favorites', label: 'Favoritos', icon: '⭐' },
];

// Group manuals by brand for the picker
const BRAND_MAP = {};
ALL_MANUALS.forEach(m => {
  const b = m.brand || 'hp';
  if (!BRAND_MAP[b]) BRAND_MAP[b] = [];
  BRAND_MAP[b].push(m);
});
const BRANDS = [...new Map(
  Object.entries(BRAND_MAP).map(([id, manuals]) => [id, {
    id,
    label: id === 'hp' ? 'HP' : id.charAt(0).toUpperCase() + id.slice(1),
    color: manuals[0].color,
    manuals,
  }])
).values()];

const PROVIDERS_URL = 'https://manuais-hp.onrender.com/providers';
const KNOWN_PROVIDER_IDS = AI_PROVIDERS.map(p => p.id); // ['gemini', 'claude']

// Pure function: filters apiList by known provider IDs (in display order) and
// picks the default — saved provider if still valid, otherwise first in list.
// Returns { visible: string[], selected: string | null }
export function resolveProviders(apiList, knownIds, savedId) {
  const visible = knownIds.filter(id => apiList.includes(id));
  if (visible.length === 0) return { visible: [], selected: null };
  const selected = visible.includes(savedId) ? savedId : visible[0];
  return { visible, selected };
}

async function fetchProviders() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(PROVIDERS_URL, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

export default function App() {
  const [authStatus, setAuthStatus] = useState('loading'); // 'loading'|'guest'|'authed'
  const [authEmail, setAuthEmail]   = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const mode = 'tech';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [allMessages, setAllMessages] = useState({});
  const [favorites, setFavorites] = useState([]);

  // Manual selection
  const [selectedBrandId, setSelectedBrandId] = useState(BRANDS[0]?.id);
  const [selectedManualId, setSelectedManualId] = useState(ALL_MANUALS[0]?.id);
  const [showPicker, setShowPicker] = useState(false);
  const [showAssistant, setShowAssistant] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [tourStage, setTourStage] = useState(null);
  const [tourSpotlight, setTourSpotlight] = useState(null);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [visibleProviders, setVisibleProviders] = useState(AI_PROVIDERS); // fallback = todos

  const drawerAnim = useRef(new Animated.Value(-DRAWER_W)).current;
  const saveTimeoutRef = useRef(null);
  const skipPersistRef = useRef(false);
  const tourTargetRefs = useRef({});

  // Persist conversation history with debounce
  useEffect(() => {
    if (!authEmail || authStatus !== 'authed') return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const pruned = Object.fromEntries(
        Object.entries(allMessages).map(([k, msgs]) => [k, msgs.slice(-30)])
      );
      try { await AsyncStorage.setItem(`tg_messages_${authEmail}`, JSON.stringify(pruned)); } catch {}
    }, 800);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [allMessages, authEmail, authStatus]);

  const selectedBrand = BRANDS.find(b => b.id === selectedBrandId) || BRANDS[0];
  const manual = ALL_MANUALS.find(m => m.id === selectedManualId) || ALL_MANUALS[0];
  const chatKey = manual.id;
  const messages = allMessages[chatKey] || [];

  function setMessages(msgs) {
    setAllMessages(prev => ({
      ...prev,
      [chatKey]: typeof msgs === 'function' ? msgs(prev[chatKey] || []) : msgs,
    }));
  }

  async function initAuthedUser(email) {
    try {
      const saved = await AsyncStorage.getItem(`tg_messages_${email}`);
      if (saved) setAllMessages(JSON.parse(saved));
      const [savedFavorites, onboarding] = await Promise.all([
        listFavorites(email),
        AsyncStorage.getItem(onboardingStorageKey(email)),
      ]);
      setFavorites(savedFavorites);
      setOnboardingDone(Boolean(onboarding));
    } catch {}
    finally { setOnboardingReady(true); }
  }

  useEffect(() => {
    async function init() {
      try {
        const [session, savedProvider, providersData] = await Promise.all([
          restoreSession(),
          AsyncStorage.getItem('tg_provider'),
          fetchProviders(),
        ]);
        // Resolve visible providers: fallback to all known if endpoint failed/timeout
        const apiList = providersData?.providers || KNOWN_PROVIDER_IDS;
        const { visible, selected } = resolveProviders(apiList, KNOWN_PROVIDER_IDS, savedProvider);
        const filtered = visible.length > 0
          ? AI_PROVIDERS.filter(p => visible.includes(p.id))
          : AI_PROVIDERS; // fallback: show all (endpoint informativo não trava o app)
        setVisibleProviders(filtered);
        if (selected) {
          setProvider(selected);
          // Migrar preferência salva obsoleta ('claude-opus','openai','gpt-4o' → provider válido)
          if (selected !== savedProvider) {
            try { await AsyncStorage.setItem('tg_provider', selected); } catch {}
          }
        }
        if (session) {
          setAuthEmail(session.email);
          setAuthStatus('authed');
          setShowWelcome(true);
          await initAuthedUser(session.email);
        } else { setAuthStatus('guest'); }
      } catch { setAuthStatus('guest'); }
      finally { SplashScreen.hideAsync(); }
      wakeUpServer();
      checkOnline();
    }
    init();
    const interval = setInterval(checkOnline, 30000);
    return () => clearInterval(interval);
  }, []);

  // Ao voltar do segundo plano: acorda o servidor e revalida a conexão.
  // Sem isso, a 1ª busca após o resume pegava o indicador "ON" velho e/ou
  // o servidor hibernado, retornando "Sem conexão".
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { wakeUpServer(); checkOnline(); }
    });
    return () => sub.remove();
  }, []);

  async function wakeUpServer() {
    try { await fetch('https://manuais-hp.onrender.com/ping'); } catch {}
  }

  async function checkOnline() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('https://manuais-hp.onrender.com/ping', { signal: controller.signal });
      clearTimeout(timer);
      // Qualquer resposta HTTP = servidor no ar (404 incluído — ex: server.js antigo sem /ping)
      setIsOnline(res.status < 500);
    } catch { setIsOnline(false); }
  }

  function openDrawer() {
    setDrawerOpen(true);
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }

  function closeDrawer() {
    Animated.spring(drawerAnim, { toValue: -DRAWER_W, useNativeDriver: true, tension: 65, friction: 11 }).start(() => setDrawerOpen(false));
  }

  async function handleLogout() {
    closeDrawer();
    if (authEmail) {
      try { await AsyncStorage.removeItem(`tg_messages_${authEmail}`); } catch {}
    }
    await logout();
    setAuthStatus('guest');
    setAuthEmail(null);
    setAllMessages({});
    setPendingQuestion(null);
    setActiveTab('chat');
    setShowAssistant(true);
    setShowWelcome(false);
  }

  async function handleChangeProvider(id) {
    setProvider(id);
    await AsyncStorage.setItem('tg_provider', id);
  }

  function handleQuestion(q) {
    closeDrawer();
    setActiveTab('chat');
    setPendingQuestion(q);
  }

  function selectBrand(brandId) {
    setSelectedBrandId(brandId);
    const brand = BRANDS.find(b => b.id === brandId);
    if (brand?.manuals[0]) setSelectedManualId(brand.manuals[0].id);
  }

  function startOnboarding() {
    if (!onboardingReady || onboardingDone || !authEmail) return;
    setShowAssistant(true);
    setTourSpotlight(null);
    setTourStage('welcome');
  }

  async function finishOnboarding() {
    setTourStage(null);
    setTourSpotlight(null);
    setActiveTab('chat');
    setOnboardingDone(true);
    if (authEmail) {
      try { await AsyncStorage.setItem(onboardingStorageKey(authEmail), '1'); } catch {}
    }
  }

  function advanceOnboarding() {
    if (tourStage === 'welcome') {
      setTourStage(0);
    } else if (tourStage === ONBOARDING_STEPS.length - 1) {
      finishOnboarding();
    } else {
      setTourStage(stage => stage + 1);
    }
  }

  function setTourTargetRef(target) {
    return node => { tourTargetRefs.current[target] = node; };
  }

  function measureTourTarget(target) {
    requestAnimationFrame(() => {
      tourTargetRefs.current[target]?.measureInWindow?.((x, y, width, height) => {
        if (width && height) setTourSpotlight({ x, y, width, height });
      });
    });
  }

  const handleTourTargetLayout = useCallback((target, layout) => {
    if (getOnboardingStep(tourStage)?.target !== target) return;
    setTourSpotlight(previous => (
      previous?.x === layout.x && previous?.y === layout.y
      && previous?.width === layout.width && previous?.height === layout.height
        ? previous
        : layout
    ));
  }, [tourStage]);

  useEffect(() => {
    const step = getOnboardingStep(tourStage);
    if (!step) return;
    setActiveTab(step.tab);
    setShowPicker(false);
    setTourSpotlight(null);
    const timer = setTimeout(() => {
      if (step.target !== 'search' && step.target !== 'bubble') measureTourTarget(step.target);
    }, 120);
    return () => clearTimeout(timer);
  }, [tourStage]);

  useEffect(() => {
    if (onboardingReady && !onboardingDone && !showWelcome && authStatus === 'authed' && tourStage === null) {
      startOnboarding();
    }
  }, [onboardingReady, onboardingDone, showWelcome, authStatus, tourStage]);

  function toggleFavorite(item) {
    setFavorites(previous => {
      const next = isFavorite(previous, item.id) ? removeFavorite(previous, item.id) : addFavorite(previous, item);
      saveFavorites(authEmail, next);
      return next;
    });
  }

  async function handleClearAllConversations() {
    closeDrawer();
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    skipPersistRef.current = true;
    setAllMessages(clearAllConversations());
    if (authEmail) {
      try { await AsyncStorage.removeItem(`tg_messages_${authEmail}`); } catch {}
    }
  }

  function handleClearConversation() {
    setAllMessages(previous => clearConversation(previous, chatKey));
  }

  function confirmClearConversation() {
    Alert.alert(
      'Limpar conversa',
      `Apagar todas as mensagens e resultados de ${manual.label}? Esta ação não pode ser desfeita.`,
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Limpar', style: 'destructive', onPress: handleClearConversation }]
    );
  }

  function handleDeleteConversationMessage(messageId) {
    setAllMessages(previous => deleteConversationMessage(previous, chatKey, messageId));
  }

  function openCodeFavorite(item) {
    const restored = getCodeFavoriteRestoreMessages(item);
    if (!restored) {
      Alert.alert('Favorito sem resposta salva', 'Este favorito foi criado antes do salvamento de respostas. Favorite o codigo novamente apos uma nova consulta.');
      return;
    }
    setSelectedManualId(item.modelId);
    setActiveTab('chat');
    setAllMessages(previous => ({
      ...previous,
      [item.modelId]: [...(previous[item.modelId] || []), ...restored],
    }));
  }

  function modelFavorite(model) {
    return { type: 'model', id: favoriteId('model', model.id), label: model.label, meta: model.subtitle, color: model.color, modelId: model.id };
  }

  if (authStatus === 'loading') return null;
  if (authStatus === 'guest') return (
    <LoginScreen onLoginSuccess={async (email) => {
      setAuthEmail(email);
      setAuthStatus('authed');
      setShowAssistant(true);
      setShowWelcome(true);
      await initAuthedUser(email);
    }} />
  );
  if (authStatus === 'authed' && showWelcome) return (
    <WelcomeScreen
      brands={BRANDS}
      onSelectBrand={(brandId, manualId) => {
        selectBrand(brandId);
        setSelectedManualId(manualId);
        setShowWelcome(false);
        startOnboarding();
      }}
    />
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.surface} />

      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerLogo}>
            <Text style={styles.headerLogoText}>TG</Text>
          </View>

          {/* Title */}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activeTab === 'chat' ? manual.label : activeTab === 'favorites' ? 'Favoritos' : 'Manuais'}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {activeTab === 'chat' ? manual.subtitle : 'HP · Ricoh'}
            </Text>
          </View>

          {/* Online indicator */}
          <StatusBadge
            label={isOnline ? 'ON' : 'OFF'}
            tone={isOnline ? 'offline' : 'alert'}
            shape="pill"
            size={32}
            onPress={() => { wakeUpServer(); checkOnline(); }}
            style={[styles.onlineDot, { backgroundColor: isOnline ? C.offline + '22' : C.alert + '22', borderColor: isOnline ? C.offline : C.alert }]}
            textStyle={styles.onlineDotText}
          />

          {activeTab === 'chat' && (
            <>
              {messages.length > 0 && <TouchableOpacity accessibilityLabel="Limpar conversa" onPress={confirmClearConversation} style={styles.clearHeaderBtn} activeOpacity={0.75}><Ionicons name="trash-outline" size={18} color={C.dim} /></TouchableOpacity>}
            <IconButton icon="☰" onPress={openDrawer} style={styles.menuBtn} iconStyle={styles.menuBtnText} />
            </>
          )}
        </View>

        {/* Equipment selector strip — chat tab only */}
        {activeTab === 'chat' && (
          <TouchableOpacity
            ref={setTourTargetRef('equipment')}
            style={[styles.equipStrip, { borderLeftColor: manual.color }]}
            onPress={() => setShowPicker(p => !p)}
            activeOpacity={0.75}
          >
            <View style={[styles.equipBrandTag, { backgroundColor: manual.color + '20', borderColor: manual.color + '80' }]}>
              <Text style={[styles.equipBrandText, { color: manual.color }]}>
                {manual.brand === 'ricoh' ? 'Ricoh' : 'HP'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.equipModelText}>{manual.label}</Text>
              <Text style={styles.equipSubText}>{manual.subtitle}</Text>
            </View>
            <View style={styles.equipChangeBtn}>
              <Text style={styles.equipChangeTxt}>Trocar ▾</Text>
            </View>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Content */}
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, display: activeTab === 'chat' ? 'flex' : 'none' }}>
          <ChatScreen
            key={chatKey}
            manual={manual}
            mode={mode}
            isOnline={isOnline}
            pendingQuestion={pendingQuestion}
            onQuestionSent={() => setPendingQuestion(null)}
            messages={messages}
            setMessages={setMessages}
            provider={provider}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onDeleteMessage={handleDeleteConversationMessage}
            tourTarget={getOnboardingStep(tourStage)?.target}
            onTourTargetLayout={handleTourTargetLayout}
          />
        </View>
        <View style={{ flex: 1, display: activeTab === 'manuals' ? 'flex' : 'none' }}>
          <ManualsScreen favorites={favorites} onToggleFavorite={toggleFavorite} />
        </View>
        <View style={{ flex: 1, display: activeTab === 'favorites' ? 'flex' : 'none' }}>
          <FavoritesScreen favorites={favorites} onToggleFavorite={toggleFavorite} onSelectModel={(item) => { setSelectedManualId(item.modelId); setActiveTab('chat'); }} onOpenManual={() => setActiveTab('manuals')} onOpenCode={openCodeFavorite} />
        </View>
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {BOTTOM_TABS.map(tab => {
          const tourTarget = tab.id === 'favorites' ? 'favoritesTab' : tab.id === 'manuals' ? 'manualsTab' : null;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.bottomTab, activeTab === tab.id && styles.bottomTabActive]}
              onPress={() => { setActiveTab(tab.id); setShowPicker(false); }}
            >
              <View
                ref={tourTarget ? setTourTargetRef(tourTarget) : undefined}
                collapsable={false}
                style={styles.bottomTabSpotlightTarget}
              >
                <Text style={styles.bottomTabIcon}>{tab.icon}</Text>
                <Text style={[styles.bottomTabLabel, activeTab === tab.id && { color: C.accent }]}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Model Picker Overlay */}
      {showPicker && activeTab === 'chat' && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 45 }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          />
          <SafeAreaView style={styles.pickerPanel}>
            <View style={styles.pickerPanelHeader}>
              <Text style={styles.pickerPanelTitle}>Selecionar Equipamento</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.pickerPanelClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.brandRow}>
              {BRANDS.map(b => (
                <SurfaceCard
                  as={TouchableOpacity}
                  variant="bare"
                  key={b.id}
                  style={[
                    styles.brandCard,
                    { borderColor: selectedBrandId === b.id ? b.color : C.border },
                    selectedBrandId === b.id && { backgroundColor: b.color + '15' },
                  ]}
                  onPress={() => selectBrand(b.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.brandCardLabel, { color: selectedBrandId === b.id ? b.color : C.text }]}>
                    {b.label}
                  </Text>
                  <Text style={[styles.brandCardSub, { color: selectedBrandId === b.id ? b.color + 'cc' : C.muted }]}>
                    {b.manuals.length} modelo{b.manuals.length !== 1 ? 's' : ''}
                  </Text>
                </SurfaceCard>
              ))}
            </View>
            <View style={styles.pickerDivider} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modelRow}
            >
              {selectedBrand.manuals.map(m => (
                <SurfaceCard
                  variant="bare"
                  key={m.id}
                  style={[styles.modelCard, { borderColor: m.color + '60' }, selectedManualId === m.id && { backgroundColor: m.color + '22', borderColor: m.color }]}
                >
                  <TouchableOpacity style={styles.modelSelect} onPress={() => { setSelectedManualId(m.id); setShowPicker(false); }} activeOpacity={0.7}><View><Text style={[styles.modelCardText, { color: selectedManualId === m.id ? m.color : C.dim }]}>{m.label}</Text><Text style={[styles.modelCardSub, { color: selectedManualId === m.id ? m.color + 'aa' : C.muted }]}>{m.subtitle}</Text></View></TouchableOpacity>
                  <IconButton icon={isFavorite(favorites, favoriteId('model', m.id)) ? '★' : '☆'} onPress={() => toggleFavorite(modelFavorite(m))} style={styles.modelStar} iconStyle={isFavorite(favorites, favoriteId('model', m.id)) ? styles.modelStarFilled : styles.modelStarOutline} />
                </SurfaceCard>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}

      <AssistantBubble
        visible={showAssistant || tourStage !== null}
        onDismiss={() => setShowAssistant(false)}
        brand={selectedBrandId}
        modelId={selectedManualId}
        onTourTargetLayout={handleTourTargetLayout}
        tour={tourStage === null ? null : {
          welcome: tourStage === 'welcome',
          step: typeof tourStage === 'number' ? tourStage + 1 : null,
          total: ONBOARDING_STEPS.length,
          target: getOnboardingStep(tourStage)?.target,
          text: tourStage === 'welcome'
            ? 'Olá! Eu sou seu Assistente. Vou te mostrar o básico em 5 passos rápidos. Toque em Próximo.'
            : getOnboardingStep(tourStage)?.text,
          isLast: tourStage === ONBOARDING_STEPS.length - 1,
          spotlight: tourSpotlight,
          onNext: advanceOnboarding,
          onSkip: finishOnboarding,
        }}
      />

      {/* Drawer */}
      {drawerOpen && <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeDrawer} />}
      {drawerOpen && (
        <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.drawerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.drawerTitle}>Topicos Rapidos</Text>
                {authEmail ? <Text style={styles.drawerEmail} numberOfLines={1}>{authEmail}</Text> : null}
              </View>
              <IconButton icon="✕" onPress={closeDrawer} style={styles.closeBtn} iconStyle={styles.closeBtnText} />
            </View>
            <DrawerContent
              manual={manual}
              mode={mode}
              onQuestion={handleQuestion}
              onLogout={handleLogout}
              onClearAllConversations={handleClearAllConversations}
              showAssistant={showAssistant}
              onOpenAssistant={() => { closeDrawer(); setShowAssistant(true); }}
              provider={provider}
              visibleProviders={visibleProviders}
              onChangeProvider={handleChangeProvider}
            />
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  headerSafe: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  headerLogo: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  headerLogoText: { color: C.white, fontWeight: '800', fontSize: 11 },
  headerInfo: { flex: 1 },
  headerTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  headerSub: { color: C.dim, fontSize: 10, marginTop: 1 },
  onlineDot: { width: 32, height: 22, borderRadius: 11 },
  onlineDotText: { fontSize: 8, fontWeight: '700' },
  menuBtn: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  menuBtnText: { color: C.dim, fontSize: 17 },
  clearHeaderBtn: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

  // Equipment selector strip
  equipStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border,
    borderLeftWidth: 3, backgroundColor: C.surface2,
  },
  equipBrandTag: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  equipBrandText: { fontSize: 10, fontWeight: '800' },
  equipModelText: { color: C.text, fontSize: 12, fontWeight: '700' },
  equipSubText: { color: C.dim, fontSize: 10, marginTop: 1 },
  equipChangeBtn: {
    backgroundColor: C.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  equipChangeTxt: { color: C.accent, fontSize: 10, fontWeight: '700' },

  // Picker overlay
  pickerPanel: { backgroundColor: C.surface2, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerPanelTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  pickerPanelClose: { color: C.dim, fontSize: 18 },
  brandRow: { flexDirection: 'row', padding: 12, gap: 10 },
  brandCard: { flex: 1, paddingVertical: 18, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, backgroundColor: C.surface, alignItems: 'center', gap: 4 },
  brandCardLabel: { fontSize: 22, fontWeight: '800' },
  brandCardSub: { fontSize: 11 },
  pickerDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 14 },
  modelRow: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, gap: 8 },
  modelCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, minWidth: 130 },
  modelSelect: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
  modelStar: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'transparent', borderWidth: 0 },
  modelStarFilled: { color: C.alert, fontSize: 19 },
  modelStarOutline: { color: '#AEB6C4', fontSize: 19 },
  modelCardText: { fontSize: 13, fontWeight: '700' },
  modelCardSub: { fontSize: 10, marginTop: 3 },

  bottomNav: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 8 },
  bottomTab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  bottomTabActive: { borderTopWidth: 2, borderTopColor: C.accent },
  bottomTabSpotlightTarget: { alignItems: 'center', gap: 3 },
  bottomTabIcon: { fontSize: 20 },
  bottomTabLabel: { color: C.dim, fontSize: 11, fontWeight: '600' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 },
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_W, backgroundColor: C.surface, zIndex: 50, elevation: 20 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  drawerTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  drawerEmail: { color: C.muted, fontSize: 10, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: C.dim, fontSize: 14 },
});
