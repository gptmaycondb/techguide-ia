import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, StatusBar, Animated, Dimensions,
} from 'react-native';
import { MANUALS, USER_MODES } from './src/data';
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

export default function App() {
  const [mode, setMode] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [currentId, setCurrentId] = useState(MANUALS[0].id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_W)).current;

  const manual = MANUALS.find(m => m.id === currentId);
  const currentMode = mode ? USER_MODES[mode] : null;

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
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('https://manuais-hp.onrender.com/', {
        method: 'HEAD', signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsOnline(res.ok);
    } catch { setIsOnline(false); }
  }

  function openDrawer() {
    setDrawerOpen(true);
    Animated.spring(drawerAnim, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }

  function closeDrawer() {
    Animated.spring(drawerAnim, {
      toValue: -DRAWER_W, useNativeDriver: true, tension: 65, friction: 11,
    }).start(() => setDrawerOpen(false));
  }

  function handleQuestion(q) {
    closeDrawer();
    setActiveTab('chat');
    setPendingQuestion(q);
  }

  if (!mode) return <ProfileSelect onSelect={setMode} />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.surface} />

      {/* HEADER */}
      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerLogo}>
            <Text style={styles.headerLogoText}>TG</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activeTab === 'chat' ? manual.label : 'Manuais HP'}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {activeTab === 'chat' ? manual.subtitle : 'Visualizar e baixar PDFs'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.profileBtn, { borderColor: currentMode.color }]}
            onPress={() => setMode(null)}
          >
            <Text style={styles.profileEmoji}>{currentMode.icon}</Text>
            <Text style={[styles.profileLabel, { color: currentMode.color }]}>
              {currentMode.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.onlineDot, {
              backgroundColor: isOnline ? '#00d4aa22' : '#6b21a822',
              borderColor: isOnline ? '#00d4aa' : '#6b21a8',
            }]}
            onPress={() => { wakeUpServer(); checkOnline(); }}
          >
            <Text style={{ color: isOnline ? '#00d4aa' : '#a855f7', fontSize: 8, fontWeight: '700' }}>
              {isOnline ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          {activeTab === 'chat' && (
            <TouchableOpacity style={styles.menuBtn} onPress={openDrawer}>
              <Text style={styles.menuBtnText}>☰</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Mode banner - only on chat tab */}
        {activeTab === 'chat' && (
          <View style={[styles.modeBanner, {
            backgroundColor: currentMode.color + '12',
            borderBottomColor: currentMode.color + '30',
          }]}>
            <Text style={styles.modeBannerIcon}>{currentMode.icon}</Text>
            <Text style={[styles.modeBannerText, { color: currentMode.color }]}>
              {mode === 'user'
                ? 'Modo Usuario — respostas simples'
                : 'Modo Tecnico — informacoes completas'}
            </Text>
            <TouchableOpacity onPress={() => setMode(null)} style={styles.switchBtn}>
              <Text style={[styles.switchBtnText, { color: currentMode.color }]}>Trocar</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* MODEL TABS - only on chat */}
      {activeTab === 'chat' && (
        <View style={styles.tabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            {MANUALS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelTab, currentId === m.id && {
                  borderColor: m.color, backgroundColor: m.color + '15',
                }]}
                onPress={() => setCurrentId(m.id)}
              >
                <Text style={[styles.modelTabText, currentId === m.id && {
                  color: m.color, fontWeight: '700',
                }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* CONTENT */}
      <View style={{ flex: 1 }}>
        {activeTab === 'chat' ? (
          <ChatScreen
            key={currentId + mode}
            manual={manual}
            mode={mode}
            isOnline={isOnline}
            pendingQuestion={pendingQuestion}
            onQuestionSent={() => setPendingQuestion(null)}
          />
        ) : (
          <ManualsScreen />
        )}
      </View>

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        {BOTTOM_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.bottomTab, activeTab === tab.id && styles.bottomTabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.bottomTabIcon}>{tab.icon}</Text>
            <Text style={[styles.bottomTabLabel, activeTab === tab.id && { color: C.accent }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* DRAWER */}
      {drawerOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeDrawer} />
      )}
      {drawerOpen && (
        <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.drawerHeader}>
              <View>
                <Text style={styles.drawerTitle}>Topicos Rapidos</Text>
                <Text style={[styles.drawerMode, { color: currentMode.color }]}>
                  {currentMode.icon} Modo {currentMode.label}
                </Text>
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
  profileBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 16, borderWidth: 1, backgroundColor: C.surface2 },
  profileEmoji: { fontSize: 13 },
  profileLabel: { fontSize: 11, fontWeight: '700' },
  onlineDot: { width: 32, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  menuBtn: { width: 34, height: 34, borderRadius: 7, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  menuBtnText: { color: C.dim, fontSize: 17 },
  modeBanner: { paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1 },
  modeBannerIcon: { fontSize: 12 },
  modeBannerText: { flex: 1, fontSize: 11 },
  switchBtn: { paddingHorizontal: 8, paddingVertical: 3 },
  switchBtnText: { fontSize: 11, fontWeight: '700' },
  tabsWrapper: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tabsContent: { paddingHorizontal: 10, paddingVertical: 7, gap: 5 },
  modelTab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2 },
  modelTabText: { color: C.dim, fontSize: 11 },
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
