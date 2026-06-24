import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Dimensions, Platform,
} from 'react-native';
import { ASSISTANT_TIPS } from './tips';
import { colors as C, radius } from './theme';
import SurfaceCard from './components/SurfaceCard';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BUBBLE_SIZE      = 62;
const EDGE_PADDING     = 14;
const DISMISS_ZONE_H   = 90;
const DISMISS_THRESHOLD  = SCREEN_H - DISMISS_ZONE_H;
const DISMISS_CENTER_X   = SCREEN_W / 2 - BUBBLE_SIZE / 2;
const DISMISS_CENTER_Y   = SCREEN_H - 60;

const MAX_DOTS = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildShuffledTips(brand, modelId) {
  const filtered = ASSISTANT_TIPS.filter(t => {
    if (t.brand === 'general') return true;            // sempre incluídas
    if (t.model) return t.model === modelId;           // dica específica do modelo
    return t.brand === brand;                           // dica genérica da marca (sem modelo)
  });
  return shuffle(filtered);
}

export default function AssistantBubble({ visible, onDismiss, brand = 'hp', modelId, tour, onTourTargetLayout }) {
  const pan       = useRef(new Animated.ValueXY({ x: SCREEN_W - BUBBLE_SIZE - EDGE_PADDING, y: SCREEN_H * 0.55 })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const zoneAnim  = useRef(new Animated.Value(0)).current;
  const cardAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const [dragging, setDragging]         = useState(false);
  const [nearDismiss, setNearDismiss]   = useState(false);
  const [tipOpen, setTipOpen]           = useState(false);
  const [shuffledTips, setShuffledTips] = useState(() => buildShuffledTips(brand, modelId));
  const [currentTip, setCurrentTip]     = useState(0);

  // Re-shuffle when brand or model changes
  useEffect(() => {
    const next = buildShuffledTips(brand, modelId);
    setShuffledTips(next);
    setCurrentTip(0);
    setTipOpen(false);
  }, [brand, modelId]);

  // Pulse loop when idle
  useEffect(() => {
    if (dragging || tipOpen) {
      pulseAnim.stopAnimation();
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: false }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dragging, tipOpen, pulseAnim]);

  // Dismiss zone fade
  useEffect(() => {
    Animated.timing(zoneAnim, { toValue: dragging ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [dragging, zoneAnim]);

  // TipCard scale animation
  useEffect(() => {
    if (tipOpen || tour) {
      cardAnim.setValue(0.82);
      Animated.spring(cardAnim, { toValue: 1, tension: 120, friction: 8, useNativeDriver: false }).start();
    }
  }, [tipOpen, Boolean(tour), cardAnim]);

  const closeTip = useCallback(() => setTipOpen(false), []);
  const nextTip  = useCallback(() => setCurrentTip(i => (i + 1) % shuffledTips.length), [shuffledTips.length]);
  const prevTip  = useCallback(() => setCurrentTip(i => (i - 1 + shuffledTips.length) % shuffledTips.length), [shuffledTips.length]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,

      onPanResponderGrant: () => {
        pan.setOffset(pan.__getValue());
        pan.setValue({ x: 0, y: 0 });
        setDragging(true);
        setTipOpen(false);
      },

      onPanResponderMove: (_, g) => {
        pan.setValue({ x: g.dx, y: g.dy });
        const currentY = (pan.y._offset || 0) + g.dy;
        setNearDismiss(currentY > DISMISS_THRESHOLD - 20);
      },

      onPanResponderRelease: (_, g) => {
        pan.flattenOffset();
        setDragging(false);
        setNearDismiss(false);

        const { moveY, moveX, dx, dy } = g;

        // Tap detection
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
          setTipOpen(v => !v);
          return;
        }

        // Dismiss zone
        if (moveY > DISMISS_THRESHOLD) {
          Animated.parallel([
            Animated.timing(pan, {
              toValue: { x: DISMISS_CENTER_X, y: DISMISS_CENTER_Y },
              duration: 220, useNativeDriver: false,
            }),
            Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
          ]).start(() => onDismiss());
          return;
        }

        // Snap to nearest horizontal edge
        const snapX = moveX < SCREEN_W / 2 ? EDGE_PADDING : SCREEN_W - BUBBLE_SIZE - EDGE_PADDING;
        const rawY  = pan.y.__getValue();
        const snapY = Math.max(60, Math.min(rawY, SCREEN_H - BUBBLE_SIZE - 60));
        Animated.spring(pan, {
          toValue: { x: snapX, y: snapY },
          tension: 120, friction: 9, useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Reset fade when becoming visible again
  useEffect(() => {
    if (visible) fadeAnim.setValue(1);
  }, [visible, fadeAnim]);

  useEffect(() => {
    if (tour?.target !== 'bubble') return;
    const value = pan.__getValue();
    onTourTargetLayout?.('bubble', { x: value.x, y: value.y, width: BUBBLE_SIZE, height: BUBBLE_SIZE });
  }, [tour?.target, pan, onTourTargetLayout]);

  if (!visible) return null;

  const total    = shuffledTips.length;
  const halfDots = Math.floor(MAX_DOTS / 2);
  const dotStart = Math.max(0, Math.min(currentTip - halfDots, total - MAX_DOTS));
  const dots     = Array.from({ length: Math.min(MAX_DOTS, total) }, (_, i) => dotStart + i);
  const tipText  = shuffledTips[currentTip]?.text ?? '';

  const spotlight = tour?.spotlight;

  return (
    <Animated.View style={[styles.root, tour && styles.tourRoot, { opacity: fadeAnim }]} pointerEvents={tour ? 'auto' : 'box-none'}>

      {tour && <View style={styles.tourOverlay} pointerEvents="auto">
        {spotlight && <>
          <View style={[styles.shade, { top: 0, left: 0, right: 0, height: Math.max(0, spotlight.y - 10) }]} />
          <View style={[styles.shade, { top: Math.max(0, spotlight.y - 10), left: 0, width: Math.max(0, spotlight.x - 10), height: spotlight.height + 20 }]} />
          <View style={[styles.shade, { top: Math.max(0, spotlight.y - 10), left: spotlight.x + spotlight.width + 10, right: 0, height: spotlight.height + 20 }]} />
          <View style={[styles.shade, { top: spotlight.y + spotlight.height + 10, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.spotlightRing, { left: spotlight.x - 10, top: spotlight.y - 10, width: spotlight.width + 20, height: spotlight.height + 20 }]} />
        </>}
        {!spotlight && <View style={[styles.shade, StyleSheet.absoluteFillObject]} />}
      </View>}

      {/* TipCard */}
      {tour ? (
        <SurfaceCard as={Animated.View} variant="raised" style={[styles.card, styles.tourCard, (tour.target === 'favoritesTab' || tour.target === 'manualsTab') && styles.tourCardTop, { transform: [{ scale: cardAnim }] }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderLabel}>{tour.welcome ? 'Boas-vindas' : `Passo ${tour.step} de ${tour.total}`}</Text>
          </View>
          <View style={styles.cardDivider} />
          <Text selectable style={styles.cardText}>{tour.text}</Text>
          <View style={styles.cardDivider} />
          <View style={styles.tourActions}>
            <TouchableOpacity onPress={tour.onSkip} style={styles.skipTourBtn}><Text style={styles.skipTourText}>Pular</Text></TouchableOpacity>
            <TouchableOpacity onPress={tour.onNext} style={styles.nextTourBtn}><Text style={styles.nextTourText}>{tour.isLast ? 'Concluir' : 'Próximo'}</Text></TouchableOpacity>
          </View>
        </SurfaceCard>
      ) : tipOpen && !dragging && (
        <SurfaceCard as={Animated.View} variant="raised" style={[styles.card, { transform: [{ scale: cardAnim }] }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderIcon}>💡</Text>
            <Text style={styles.cardHeaderLabel}>Dica {currentTip + 1} de {total}</Text>
            <TouchableOpacity onPress={closeTip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.cardClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cardDivider} />
          <Text selectable style={styles.cardText}>{tipText}</Text>
          <View style={styles.cardDivider} />
          <View style={styles.cardNav}>
            <TouchableOpacity onPress={prevTip} style={styles.navBtn}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.dots}>
              {dots.map(i => (
                <View key={i} style={[styles.dot, i === currentTip && styles.dotActive]} />
              ))}
            </View>
            <TouchableOpacity onPress={nextTip} style={styles.navBtn}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </SurfaceCard>
      )}

      {/* Dismiss zone */}
      <Animated.View style={[styles.dismissZone, { opacity: zoneAnim }]} pointerEvents="none">
        <View style={[styles.dismissCircle, nearDismiss && styles.dismissCircleActive]}>
          <Text style={styles.dismissIcon}>✕</Text>
        </View>
      </Animated.View>

      {/* Bubble */}
      <Animated.View
        style={[
          styles.bubbleWrap,
          { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: pulseAnim }] },
        ]}
        {...(tour ? {} : panResponder.panHandlers)}
      >
        <View style={[styles.bubble, nearDismiss && styles.bubbleDismiss]}>
          <Image source={require('../assets/assistant.png')} style={styles.bubbleImg} />
        </View>
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 60 },
  tourRoot: { zIndex: 70 },
  tourOverlay: { ...StyleSheet.absoluteFillObject },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.68)' },
  spotlightRing: { position: 'absolute', borderWidth: 2, borderColor: C.accent, borderRadius: radius.md },

  bubbleWrap: { position: 'absolute', top: 0, left: 0, width: BUBBLE_SIZE, height: BUBBLE_SIZE },
  bubble: {
    width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2.5, borderColor: C.accent, overflow: 'hidden',
    shadowColor: C.accent, shadowOpacity: 0.55, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }, elevation: 8, backgroundColor: C.bg,
  },
  bubbleDismiss: { borderColor: C.error, shadowColor: C.error },
  bubbleImg: { width: '100%', height: '100%', borderRadius: BUBBLE_SIZE / 2 },

  dismissZone: { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' },
  dismissCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.dangerSurface, borderWidth: 2, borderColor: C.dangerBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  dismissCircleActive: {
    backgroundColor: C.dangerSurface, borderColor: C.error,
    shadowColor: C.error, shadowOpacity: 0.6, shadowRadius: 12, elevation: 6,
  },
  dismissIcon: { color: C.danger, fontSize: 20, fontWeight: '700' },

  card: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 80 : 60,
    left: (SCREEN_W - 310) / 2, width: 310,
    backgroundColor: C.surface2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: C.border,
    shadowColor: C.black, shadowOpacity: 0.45, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 12, overflow: 'hidden',
  },
  tourCard: { top: undefined, bottom: 24, left: 16, right: 16, width: undefined },
  tourCardTop: { top: Platform.OS === 'ios' ? 80 : 60, bottom: undefined },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  cardHeaderIcon: { fontSize: 16 },
  cardHeaderLabel: { flex: 1, color: C.accent, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  cardClose: { color: C.dim, fontSize: 18, paddingLeft: 4 },
  cardDivider: { height: 1, backgroundColor: C.border },
  cardText: { color: C.text, fontSize: 14, lineHeight: 21, paddingHorizontal: 18, paddingVertical: 16 },
  cardNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 10 },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navArrow: { color: C.accent, fontSize: 28, fontWeight: '300', lineHeight: 34 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  dotActive: { backgroundColor: C.accent, width: 8, height: 8, borderRadius: 4 },
  tourActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  skipTourBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  skipTourText: { color: C.dim, fontSize: 13, fontWeight: '700' },
  nextTourBtn: { backgroundColor: C.accent, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  nextTourText: { color: C.white, fontSize: 13, fontWeight: '800' },
});
