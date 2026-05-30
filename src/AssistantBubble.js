import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Dimensions, Platform,
} from 'react-native';
import { ASSISTANT_TIPS } from './tips';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BUBBLE_SIZE      = 62;
const EDGE_PADDING     = 14;
const DISMISS_ZONE_H   = 90;
const DISMISS_THRESHOLD  = SCREEN_H - DISMISS_ZONE_H;
const DISMISS_CENTER_X   = SCREEN_W / 2 - BUBBLE_SIZE / 2;
const DISMISS_CENTER_Y   = SCREEN_H - 60;

const C = {
  bg: '#0d0f14', surface2: '#1e2230', border: '#2a2f3e',
  accent: '#0096ff', text: '#e4e8f0', dim: '#7a8299', muted: '#4a5168',
  error: '#ff4d6d',
};

const MAX_DOTS = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildShuffledTips(brand) {
  const filtered = ASSISTANT_TIPS.filter(t => t.brand === brand || t.brand === 'general');
  return shuffle(filtered);
}

export default function AssistantBubble({ visible, onDismiss, brand = 'hp' }) {
  const pan       = useRef(new Animated.ValueXY({ x: SCREEN_W - BUBBLE_SIZE - EDGE_PADDING, y: SCREEN_H * 0.55 })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const zoneAnim  = useRef(new Animated.Value(0)).current;
  const cardAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const [dragging, setDragging]         = useState(false);
  const [nearDismiss, setNearDismiss]   = useState(false);
  const [tipOpen, setTipOpen]           = useState(false);
  const [shuffledTips, setShuffledTips] = useState(() => buildShuffledTips(brand));
  const [currentTip, setCurrentTip]     = useState(0);

  // Re-shuffle when brand changes
  useEffect(() => {
    const next = buildShuffledTips(brand);
    setShuffledTips(next);
    setCurrentTip(0);
    setTipOpen(false);
  }, [brand]);

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
    if (tipOpen) {
      cardAnim.setValue(0.82);
      Animated.spring(cardAnim, { toValue: 1, tension: 120, friction: 8, useNativeDriver: false }).start();
    }
  }, [tipOpen, cardAnim]);

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

  if (!visible) return null;

  const total    = shuffledTips.length;
  const halfDots = Math.floor(MAX_DOTS / 2);
  const dotStart = Math.max(0, Math.min(currentTip - halfDots, total - MAX_DOTS));
  const dots     = Array.from({ length: Math.min(MAX_DOTS, total) }, (_, i) => dotStart + i);
  const tipText  = shuffledTips[currentTip]?.text ?? '';

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]} pointerEvents="box-none">

      {/* TipCard */}
      {tipOpen && !dragging && (
        <Animated.View style={[styles.card, { transform: [{ scale: cardAnim }] }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderIcon}>💡</Text>
            <Text style={styles.cardHeaderLabel}>Dica {currentTip + 1} de {total}</Text>
            <TouchableOpacity onPress={closeTip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.cardClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cardDivider} />
          <Text style={styles.cardText}>{tipText}</Text>
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
        </Animated.View>
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
        {...panResponder.panHandlers}
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
    backgroundColor: '#1a0a10', borderWidth: 2, borderColor: '#4a1020',
    alignItems: 'center', justifyContent: 'center',
  },
  dismissCircleActive: {
    backgroundColor: '#3a0818', borderColor: C.error,
    shadowColor: C.error, shadowOpacity: 0.6, shadowRadius: 12, elevation: 6,
  },
  dismissIcon: { color: '#ff6b8a', fontSize: 20, fontWeight: '700' },

  card: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 80 : 60,
    left: (SCREEN_W - 310) / 2, width: 310,
    backgroundColor: C.surface2, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 12, overflow: 'hidden',
  },
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
});
