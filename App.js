import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Animated, Dimensions, ScrollView,
} from 'react-native';
import { ALL_MANUALS, USER_MODES } from './src/data';
import ChatScreen from './src/ChatScreen';
import DrawerContent from './src/DrawerContent';
import ProfileSelect from './src/ProfileSelect';
import ManualsScreen from './src/ManualsScreen';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.82, 300);

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
};

const BOTTOM_TABS = [
  { id: 'chat', label: 'Consulta', icon: '💬' },
  { id: 'manuals', label: 'Manuais', icon: '📚' },
];

// Group manuals by brand for the picker
const BRAND_MAP = {};
ALL_MANUALS.forEach(m => {
  const b = m.brand || 'hp';
  if (!BRAND_MAP[b]) BRAND_MAP[b] = [];
  BRAND_MAP[b].push(m);
});
const BRANDS = Object.entries(BRAND_MAP).map(([id, manuals]) => ({
  id,
  label: id === 'hp' ? 'HP' : id.charAt(0).toUpperCase() + id.slice(1),
  color: manuals[0].color,
  manuals,
}));

export default function App() {
  const [started, setStarted] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [mode, setMode] = useState('user');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [allMessages, setAllMessages] = useState({});

  // Manual selection
  const [selectedBrandId, setSelectedBrandId] = useState(BRANDS[0]?.id);
  const [selectedManualId, setSelectedManualId] = useState(ALL_MANUALS[0]?.id);
  const [showPicker, setShowPicker] = useState(false);

  const drawerAnim = useRef(new Animated.Value(-DRAWER_W)).current;

  const selectedBrand = BRANDS.find(b => b.id === selectedBrandId) || BRANDS[0];
  const manual = ALL_MANUALS.find(m => m.id === selectedManualId) || ALL_MANUALS[0];
  const currentMode = USER_MODES[mode];
  const chatKey = manual.id + '_' + mode;
  const messages = allMessages[chatKey] || [];

  function setMessages(msgs) {
    setAllMessages(prev => ({
      ...prev,
      [chatKey]: typeof msgs === 'function' ? msgs(prev[chatKey] || []) : msgs,
    }));
  }

  useEffect(() => {
    wakeUpServer();
    checkOnline();
    const interval = setInterval(checkOnline, 30000);
    return () => clearInterval(interval);
  }, []);

  async function wakeUpServer() {
    try { await fetch('https://manuais-hp.onrender.com/', { method: 'HEAD' }); } catch {}
  }

  async function checkOnline() {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10000);
      const res = await fetch('https://manuais-hp.onrender.com/', { method: 'HEAD', signal: controller.signal });
      setIsOnline(res.ok);
    } catch { setIsOnline(false); }
  }

  function openDrawer() {
    setDrawerOpen(true);
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }

  function closeDrawer() {
    Animated.spring(drawerAnim, { toValue: -DRAWER_W, useNativeDriver: true, tension: 65, friction: 11 }).start(() => setDrawerOpen(false));
  }

  function handleQuestion(q) {
    closeDrawer();
    setActiveTab('chat');
    setPendingQuestion(q);
  }

  function toggleMode() {
    setMode(m => m === 'user' ? 'tech' : 'user');
  }

  function selectBrand(brandId) {
    setSelectedBrandId(brandId);
    const brand = BRANDS.find(b => b.id === brandId);
    if (brand?.manuals[0]) setSelectedManualId(brand.manuals[0].id);
  }

  if (!started) return <ProfileSelect onSelect={() => setStarted(true)} />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.surface} />

      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerLogo}>
            <Text style={styles.headerLogoText}>TG</Text>
          </View>

          {/* Tappable title → opens picker */}
          <TouchableOpacity
            style={styles.headerInfo}
            onPress={() => activeTab === 'chat' && setShowPicker(p => !p)}
            activeOpacity={activeTab === 'chat' ? 0.7 : 1}
          >
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activeTab === 'chat' ? manual.label : 'Manuais'}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {activeTab === 'chat'
                ? manual.subtitle + (activeTab === 'chat' ? ' ▾' : '')
                : 'HP · Ricoh'}
            </Text>
          </TouchableOpacity>

          {/* Mode toggle */}
          <TouchableOpacity
            style={[styles.modeBtn, { borderColor: currentMode.color }]}
            onPress={toggleMode}
          >
            <Text style={styles.modeIcon}>{currentMode.icon}</Text>
            <Text style={[styles.modeLabel, { color: currentMode.color }]}>{currentMode.label}</Text>
          </TouchableOpacity>

          {/* Online indicator */}
          <TouchableOpacity
            style={[styles.onlineDot, { backgroundColor: isOnline ? '#00d4aa22' : '#6b21a822', borderColor: isOnline ? '#00d4aa' : '#6b21a8' }]}
            onPress={() => { wakeUpServer(); checkOnline(); }}
          >
            <Text style={{ color: isOnline ? '#00d4aa' : '#a855f7', fontSize: 8, fontWeight: '700' }}>{isOnline ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>

          {activeTab === 'chat' && (
            <TouchableOpacity style={styles.menuBtn} onPress={openDrawer}>
              <Text style={styles.menuBtnText}>☰</Text>
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'chat' ? (
          <ChatScreen
            manual={manual}
            mode={mode}
            isOnline={isOnline}
            pendingQuestion={pendingQuestion}
            onQuestionSent={() => setPendingQuestion(null)}
            messages={messages}
            setMessages={setMessages}
          />
        ) : (
          <ManualsScreen />
        )}
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {BOTTOM_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.bottomTab, activeTab === tab.id && styles.bottomTabActive]}
            onPress={() => { setActiveTab(tab.id); setShowPicker(false); }}
          >
            <Text style={styles.bottomTabIcon}>{tab.icon}</Text>
            <Text style={[styles.bottomTabLabel, activeTab === tab.id && { color: C.accent }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
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
                <TouchableOpacity
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
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.pickerDivider} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modelRow}
            >
              {selectedBrand.manuals.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.modelCard,
                    { borderColor: m.color + '60' },
                    selectedManualId === m.id && { backgroundColor: m.color + '22', borderColor: m.color },
                  ]}
                  onPress={() => { setSelectedManualId(m.id); setShowPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modelCardText, { color: selectedManualId === m.id ? m.color : C.dim }]}>
                    {m.label}
                  </Text>
                  <Text style={[styles.modelCardSub, { color: selectedManualId === m.id ? m.color + 'aa' : C.muted }]}>
                    {m.subtitle}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}

      {/* Drawer */}
      {drawerOpen && <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeDrawer} />}
      {drawerOpen && (
        <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.drawerHeader}>
              <View>
                <Text style={styles.drawerTitle}>Topicos Rapidos</Text>
                <Text style={[styles.drawerMode, { color: currentMode.color }]}>{currentMode.icon} {currentMode.label}</Text>
              </View>
              <TouchableOpacity onPress={closeDrawer} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <DrawerContent manual={manual} mode={mode} onQuestion={handleQuestion} />
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  headerSafe: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  headerLogo: { width: 30, height: 30, borderRadius: 7, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  headerLogoText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  headerInfo: { flex: 1 },
  headerTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  headerSub: { color: C.dim, fontSize: 10, marginTop: 1 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 16, borderWidth: 1, backgroundColor: C.surface2 },
  modeIcon: { fontSize: 13 },
  modeLabel: { fontSize: 11, fontWeight: '700' },
  onlineDot: { width: 32, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  menuBtn: { width: 34, height: 34, borderRadius: 7, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  menuBtnText: { color: C.dim, fontSize: 17 },

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
  modelCard: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, minWidth: 130 },
  modelCardText: { fontSize: 13, fontWeight: '700' },
  modelCardSub: { fontSize: 10, marginTop: 3 },

  bottomNav: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 8 },
  bottomTab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  bottomTabActive: { borderTopWidth: 2, borderTopColor: C.accent },
  bottomTabIcon: { fontSize: 20 },
  bottomTabLabel: { color: C.dim, fontSize: 11, fontWeight: '600' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 },
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_W, backgroundColor: C.surface, zIndex: 50, elevation: 20 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  drawerTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  drawerMode: { fontSize: 11, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: C.dim, fontSize: 14 },
});
