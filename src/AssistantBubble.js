import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Dimensions, Platform,
} from 'react-native';
import { ASSISTANT_TIPS } from './tips';
import { colors as C, radius } from './theme';
import SurfaceCard from './components/SurfaceCard';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BUBBLE_SIZE = 62;
const EDGE_PADDING = 14;
const DISMISS_ZONE_H = 90;
const DISMISS_THRESHOLD = SCREEN_H - DISMISS_ZONE_H;
const DISMISS_CENTER_X = SCREEN_W / 2 - BUBBLE_SIZE / 2;
const DISMISS_CENTER_Y = SCREEN_H - 60;
const TOUR_GAP = 18;
const TOUR_SPOTLIGHT_PAD = 10;
const TOUR_BALLOON_W = Math.min(300, SCREEN_W - EDGE_PADDING * 2);
const TOUR_BALLOON_H = 220;
const MAX_DOTS = 5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function clampSpotlight(spotlight) {
  if (!spotlight?.width || !spotlight?.height) return null;
  const maxWidth = SCREEN_W - EDGE_PADDING * 2;
  const maxHeight = SCREEN_H - EDGE_PADDING * 2;
  const width = Math.min(spotlight.width + TOUR_SPOTLIGHT_PAD * 2, maxWidth);
  const height = Math.min(spotlight.height + TOUR_SPOTLIGHT_PAD * 2, maxHeight);
  return {
    x: clamp(spotlight.x - TOUR_SPOTLIGHT_PAD, EDGE_PADDING, SCREEN_W - EDGE_PADDING - width),
    y: clamp(spotlight.y - TOUR_SPOTLIGHT_PAD, EDGE_PADDING, SCREEN_H - EDGE_PADDING - height),
    width,
    height,
  };
}

function getTourBubblePosition(spotlight, current) {
  if (!spotlight) return current;
  const roomOnRight = spotlight.x + spotlight.width + TOUR_GAP + BUBBLE_SIZE <= SCREEN_W - EDGE_PADDING;
  const roomBelow = spotlight.y + spotlight.height + TOUR_GAP + BUBBLE_SIZE <= SCREEN_H - 60;
  return {
    x: clamp(roomOnRight ? spotlight.x + spotlight.width + TOUR_GAP : spotlight.x - BUBBLE_SIZE - TOUR_GAP, EDGE_PADDING, SCREEN_W - BUBBLE_SIZE - EDGE_PADDING),
    y: clamp(roomBelow ? spotlight.y + spotlight.height + TOUR_GAP : spotlight.y - BUBBLE_SIZE - TOUR_GAP, 60, SCREEN_H - BUBBLE_SIZE - 60),
  };
}

function getTourBalloonPosition(bubble, spotlight) {
  const canSitRight = bubble.x + BUBBLE_SIZE + TOUR_GAP + TOUR_BALLOON_W <= SCREEN_W - EDGE_PADDING;
  const left = clamp(canSitRight ? bubble.x + BUBBLE_SIZE + TOUR_GAP : bubble.x - TOUR_BALLOON_W - TOUR_GAP, EDGE_PADDING, SCREEN_W - EDGE_PADDING - TOUR_BALLOON_W);
  const sitsBelowBubble = bubble.y + BUBBLE_SIZE + TOUR_GAP + TOUR_BALLOON_H <= SCREEN_H - 20;
  let top = sitsBelowBubble ? bubble.y + BUBBLE_SIZE + TOUR_GAP : bubble.y - TOUR_BALLOON_H - TOUR_GAP;

  // The balloon explains the target without covering it.
  if (spotlight && top < spotlight.y + spotlight.height && top + TOUR_BALLOON_H > spotlight.y) {
    top = sitsBelowBubble ? bubble.y - TOUR_BALLOON_H - TOUR_GAP : bubble.y + BUBBLE_SIZE + TOUR_GAP;
  }
  top = clamp(top, 52, SCREEN_H - TOUR_BALLOON_H - 20);
  return {
    left,
    top,
    tail: {
      left: clamp(bubble.x + BUBBLE_SIZE / 2 - left - 7, 16, TOUR_BALLOON_W - 30),
      [top > bubble.y ? 'top' : 'bottom']: -7,
    },
  };
}

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
    if (t.brand === 'general') return true;
    if (t.model) return t.model === modelId;
    return t.brand === brand;
  });
  return shuffle(filtered);
}

export default function AssistantBubble({ visible, onDismiss, brand = 'hp', modelId, tour, onTourTargetLayout }) {
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_W - BUBBLE_SIZE - EDGE_PADDING, y: SCREEN_H * 0.55 })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const zoneAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [dragging, setDragging] = useState(false);
  const [nearDismiss, setNearDismiss] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [shuffledTips, setShuffledTips] = useState(() => buildShuffledTips(brand, modelId));
  const [currentTip, setCurrentTip] = useState(0);
  const [tourBubblePosition, setTourBubblePosition] = useState(null);

  useEffect(() => {
    const next = buildShuffledTips(brand, modelId);
    setShuffledTips(next);
    setCurrentTip(0);
    setTipOpen(false);
  }, [brand, modelId]);

  useEffect(() => {
    if (dragging || tipOpen) {
      pulseAnim.stopAnimation();
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: false }).start();
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: false }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [dragging, tipOpen, pulseAnim]);

  useEffect(() => {
    Animated.timing(zoneAnim, { toValue: dragging ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [dragging, zoneAnim]);

  useEffect(() => {
    if (tipOpen || tour) {
      cardAnim.setValue(0.82);
      Animated.spring(cardAnim, { toValue: 1, tension: 120, friction: 8, useNativeDriver: false }).start();
    }
  }, [tipOpen, Boolean(tour), cardAnim]);

  useEffect(() => {
    if (!tour || tour.target === 'bubble') return;
    const spotlight = clampSpotlight(tour.spotlight);
    if (!spotlight) return;
    const next = getTourBubblePosition(spotlight, pan.__getValue());
    setTourBubblePosition(next);
    Animated.spring(pan, { toValue: next, tension: 110, friction: 10, useNativeDriver: false }).start();
  }, [tour?.target, tour?.spotlight?.x, tour?.spotlight?.y, tour?.spotlight?.width, tour?.spotlight?.height, pan]);

  const closeTip = useCallback(() => setTipOpen(false), []);
  const nextTip = useCallback(() => setCurrentTip(i => (i + 1) % shuffledTips.length), [shuffledTips.length]);
  const prevTip = useCallback(() => setCurrentTip(i => (i - 1 + shuffledTips.length) % shuffledTips.length), [shuffledTips.length]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
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
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
        setTipOpen(v => !v);
        return;
      }
      if (moveY > DISMISS_THRESHOLD) {
        Animated.parallel([
          Animated.timing(pan, { toValue: { x: DISMISS_CENTER_X, y: DISMISS_CENTER_Y }, duration: 220, useNativeDriver: false }),
          Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
        ]).start(() => onDismiss());
        return;
      }
      const snapX = moveX < SCREEN_W / 2 ? EDGE_PADDING : SCREEN_W - BUBBLE_SIZE - EDGE_PADDING;
      const snapY = clamp(pan.y.__getValue(), 60, SCREEN_H - BUBBLE_SIZE - 60);
      Animated.spring(pan, { toValue: { x: snapX, y: snapY }, tension: 120, friction: 9, useNativeDriver: false }).start();
    },
  })).current;

  useEffect(() => {
    if (visible) fadeAnim.setValue(1);
  }, [visible, fadeAnim]);

  useEffect(() => {
    if (tour?.target !== 'bubble') return;
    const value = pan.__getValue();
    setTourBubblePosition(value);
    onTourTargetLayout?.('bubble', { x: value.x, y: value.y, width: BUBBLE_SIZE, height: BUBBLE_SIZE });
  }, [tour?.target, pan, onTourTargetLayout]);

  if (!visible) return null;

  const total = shuffledTips.length;
  const halfDots = Math.floor(MAX_DOTS / 2);
  const dotStart = Math.max(0, Math.min(currentTip - halfDots, total - MAX_DOTS));
  const dots = Array.from({ length: Math.min(MAX_DOTS, total) }, (_, i) => dotStart + i);
  const tipText = shuffledTips[currentTip]?.text ?? '';
  const spotlight = clampSpotlight(tour?.spotlight);
  const balloonPosition = getTourBalloonPosition(tourBubblePosition || pan.__getValue(), spotlight);

  return (
    <Animated.View style={[styles.root, tour && styles.tourRoot, { opacity: fadeAnim }]} pointerEvents={tour ? 'auto' : 'box-none'}>
      {tour && <View style={styles.tourOverlay} pointerEvents="auto">
        {spotlight && <>
          <View style={[styles.shade, { top: 0, left: 0, right: 0, height: spotlight.y }]} />
          <View style={[styles.shade, { top: spotlight.y, left: 0, width: spotlight.x, height: spotlight.height }]} />
          <View style={[styles.shade, { top: spotlight.y, left: spotlight.x + spotlight.width, right: 0, height: spotlight.height }]} />
          <View style={[styles.shade, { top: spotlight.y + spotlight.height, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.spotlightRing, { left: spotlight.x, top: spotlight.y, width: spotlight.width, height: spotlight.height }]} />
        </>}
        {!spotlight && <View style={[styles.shade, StyleSheet.absoluteFillObject]} />}
      </View>}

      {tour ? (
        <Animated.View style={[styles.tourBalloon, balloonPosition, { transform: [{ scale: cardAnim }] }]}>
          <View style={[styles.balloonTail, balloonPosition.tail]} />
          <SurfaceCard variant="raised" style={styles.tourCard}>
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
        </Animated.View>
      ) : tipOpen && !dragging && (
        <SurfaceCard as={Animated.View} variant="raised" style={[styles.card, { transform: [{ scale: cardAnim }] }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderIcon}>💡</Text>
            <Text style={styles.cardHeaderLabel}>Dica {currentTip + 1} de {total}</Text>
            <TouchableOpacity onPress={closeTip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.cardClose}>×</Text></TouchableOpacity>
          </View>
          <View style={styles.cardDivider} />
          <Text selectable style={styles.cardText}>{tipText}</Text>
          <View style={styles.cardDivider} />
          <View style={styles.cardNav}>
            <TouchableOpacity onPress={prevTip} style={styles.navBtn}><Text style={styles.navArrow}>‹</Text></TouchableOpacity>
            <View style={styles.dots}>{dots.map(i => <View key={i} style={[styles.dot, i === currentTip && styles.dotActive]} />)}</View>
            <TouchableOpacity onPress={nextTip} style={styles.navBtn}><Text style={styles.navArrow}>›</Text></TouchableOpacity>
          </View>
        </SurfaceCard>
      )}

      <Animated.View style={[styles.dismissZone, { opacity: zoneAnim }]} pointerEvents="none">
        <View style={[styles.dismissCircle, nearDismiss && styles.dismissCircleActive]}><Text style={styles.dismissIcon}>×</Text></View>
      </Animated.View>
      {tour?.target === 'bubble' && <View style={[styles.dismissZone, styles.tourDismissZone]} pointerEvents="none">
        <View style={styles.dismissCircle}><Text style={styles.dismissIcon}>×</Text></View>
      </View>}

      <Animated.View
        style={[styles.bubbleWrap, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: pulseAnim }] }]}
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
    borderWidth: 2.5, borderColor: C.accent, overflow: 'hidden', shadowColor: C.accent,
    shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8, backgroundColor: C.bg,
  },
  bubbleDismiss: { borderColor: C.error, shadowColor: C.error },
  bubbleImg: { width: '100%', height: '100%', borderRadius: BUBBLE_SIZE / 2 },
  dismissZone: { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' },
  tourDismissZone: { opacity: 1 },
  dismissCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.dangerSurface, borderWidth: 2, borderColor: C.dangerBorder, alignItems: 'center', justifyContent: 'center' },
  dismissCircleActive: { backgroundColor: C.dangerSurface, borderColor: C.error, shadowColor: C.error, shadowOpacity: 0.6, shadowRadius: 12, elevation: 6 },
  dismissIcon: { color: C.danger, fontSize: 20, fontWeight: '700' },
  card: {
    position: 'absolute', top: Platform.OS === 'ios' ? 80 : 60, left: (SCREEN_W - 310) / 2, width: 310,
    backgroundColor: C.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: C.border,
    shadowColor: C.black, shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 12, overflow: 'hidden',
  },
  tourBalloon: { position: 'absolute', width: TOUR_BALLOON_W, zIndex: 2 },
  balloonTail: {
    position: 'absolute', width: 14, height: 14, backgroundColor: C.surface2, borderLeftWidth: 1,
    borderTopWidth: 1, borderColor: C.border, transform: [{ rotate: '45deg' }], zIndex: -1,
  },
  tourCard: {
    width: '100%', backgroundColor: C.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: C.border,
    shadowColor: C.black, shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 12, overflow: 'hidden',
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
  tourActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  skipTourBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  skipTourText: { color: C.dim, fontSize: 13, fontWeight: '700' },
  nextTourBtn: { backgroundColor: C.accent, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  nextTourText: { color: C.white, fontSize: 13, fontWeight: '800' },
});
