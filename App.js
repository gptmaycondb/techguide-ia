import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, StatusBar, Animated, Dimensions,
} from 'react-native';
import { MANUALS, USER_MODES } from './src/data';
import ChatScreen from './src/ChatScreen';
import DrawerContent from './src/DrawerContent';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.82, 300);

const C = {
  bg: '#0d0f14', surface: '#161920', surface2: '#1e2230',
  border: '#2a2f3e', accent: '#0096ff', accent2: '#00d4aa',
  text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  purple: '#a855f7',
};

export default function App() {
  const [currentId, setCurrentId] = useState(MANUALS[0].id);
  const [mode, setMode] = useState('user');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_W)).current;

  const manual = MANUALS.find(m => m.id === currentId);
  const currentMode = USER_MODES[mode];

  useEffect(() => {
    checkOnline();
    const interval = setInterval(checkOnline, 10000);
    return () => clearInterval(interval);
  }, []);

  async function checkOnline() {
    try {
      const res = await fetch('https://manuais-hp.onrender.com/', {
        method: 'HEAD', signal: AbortSignal.timeout(3000)
      });
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    }
  }

  function toggleMode() {
    setMode(m => m === 'user' ? 'tech' : 'user');
  }

  function openDrawer() {
    setDrawerOpen(true);
    Animated.spring(drawerAnim, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11
    }).start();
  }

  function closeDrawer() {
    Animated.spring(drawerAnim, {
      toValue: -DRAWER_W, useNativeDriver: true, tension: 65, friction: 11
    }).start(() => setDrawerOpen(false));
  }

  function handleQuestion(q) {
    closeDrawer();
    setPendingQuestion(q);
  }

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
            <Text style={styles.headerTitle} numberOfLines={1}>{manual.label}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{manual.subtitle}</Text>
          </View>

          {/* MODE TOGGLE */}
          <TouchableOpacity style={[styles.modeToggle, { borderColor: currentMode.color }]} onPress={toggleMode}>
            <Text style={styles.modeIcon}>{currentMode.icon}</Text>
            <Text style={[styles.modeLabel, { color: currentMode.color }]}>{currentMode.label}</Text>
          </TouchableOpacity>

          {!isOnline && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>OFF</Text>
            </View>
          )}
          <TouchableOpacity style={styles.menuBtn} onPress={openDrawer}>
            <Text style={styles.menuBtnText}>☰</Text>
          </TouchableOpacity>
        </View>

        {/* MODE BANNER */}
        <View style={[styles.modeBanner, { backgroundColor: currentMode.color + '15', borderBottomColor: currentMode.color + '40' }]}>
          <Text style={styles.modeBannerIcon}>{currentMode.icon}</Text>
          <Text style={[styles.modeBannerText, { color: currentMode.color }]}>
            {mode === 'user' ? 'Modo Usuario — respostas simples e diretas' : 'Modo Tecnico — informacoes tecnicas completas'}
          </Text>
        </View>
      </SafeAreaView>

      {/* TABS */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          {MANUALS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.tab, currentId === m.id && { borderColor: m.color, backgroundColor: m.color + '15' }]}
              onPress={() => setCurrentId(m.id)}
            >
              <Text style={[styles.tabText, currentId === m.id && { color: m.color, fontWeight: '700' }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CHAT */}
      <ChatScreen
        key={currentId + mode}
        manual={manual}
        mode={mode}
        isOnline={isOnline}
        pendingQuestion={pendingQuestion}
        onQuestionSent={() => setPendingQuestion(null)}
      />

      {/* DRAWER OVERLAY */}
      {drawerOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeDrawer} />
      )}

      {/* DRAWER */}
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
  headerLogoText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  headerInfo: { flex: 1 },
  headerTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  headerSub: { color: C.dim, fontSize: 10, marginTop: 1 },
  modeToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 16, borderWidth: 1, backgroundColor: C.surface2 },
  modeIcon: { fontSize: 13 },
  modeLabel: { fontSize: 11, fontWeight: '600' },
  modeBanner: { paddingHorizontal: 14, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1 },
  modeBannerIcon: { fontSize: 12 },
  modeBannerText: { fontSize: 11 },
  offlineBadge: { backgroundColor: '#1a0d2a', borderWidth: 1, borderColor: '#6b21a8', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  offlineBadgeText: { color: '#a855f7', fontSize: 9, fontWeight: '700' },
  menuBtn: { width: 34, height: 34, borderRadius: 7, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  menuBtnText: { color: C.dim, fontSize: 17 },
  tabsWrapper: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tabsContent: { paddingHorizontal: 10, paddingVertical: 7, gap: 5 },
  tab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2 },
  tabText: { color: C.dim, fontSize: 11 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 },
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_W, backgroundColor: C.surface, zIndex: 50, elevation: 20 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  drawerTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  drawerMode: { fontSize: 11, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: C.dim, fontSize: 14 },
});
