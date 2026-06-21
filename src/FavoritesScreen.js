import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as C, radius, spacing } from './theme';
import SurfaceCard from './components/SurfaceCard';
import IconButton from './components/IconButton';
import { getManualDownloadStatus } from './offlineStatus';
import { findManual, openManualPdf } from './manualOpen';

export default function FavoritesScreen({ favorites, onSelectModel, onOpenManual, onToggleFavorite }) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => favorites.filter(item => `${item.label} ${item.meta || ''}`.toLowerCase().includes(query.toLowerCase())), [favorites, query]);
  const models = visible.filter(item => item.type === 'model');
  const manuals = visible.filter(item => item.type === 'manual');
  const openManual = async item => {
    const manual = findManual(item.modelId, item.manualId);
    if (manual && await getManualDownloadStatus(manual).catch(() => false)) {
      try { await openManualPdf(manual); } catch {}
    } else onOpenManual(item);
  };
  const renderItem = (item, onPress, icon) => <SurfaceCard key={item.id} style={[styles.item, { borderLeftColor: item.color || C.accent }]}><TouchableOpacity style={styles.cardTap} onPress={() => onPress(item)} activeOpacity={0.75}><Ionicons name={icon} size={19} color={item.color || C.accent} /><View style={{ flex: 1 }}><Text style={styles.label}>{item.label}</Text><Text style={styles.meta}>{item.meta}</Text></View></TouchableOpacity><IconButton icon="★" onPress={() => onToggleFavorite(item)} style={styles.star} iconStyle={styles.starIcon} /></SurfaceCard>;
  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.search}><Ionicons name="search" size={18} color={C.dim} /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar favoritos" placeholderTextColor={C.muted} style={styles.input} /></View>
    <Text style={[styles.section, styles.equipmentSection]}>EQUIPAMENTOS</Text>
    {models.length ? models.map(item => renderItem(item, onSelectModel, 'print-outline')) : <Text style={styles.empty}>Nenhum equipamento favoritado.</Text>}
    <Text style={[styles.section, styles.manualSection]}>MANUAIS</Text>
    {manuals.length ? manuals.map(item => renderItem(item, openManual, 'document-text-outline')) : <Text style={styles.empty}>Nenhum manual favoritado.</Text>}
    <Text style={[styles.section, styles.codeSection]}>CÓDIGOS</Text>
    <Text style={styles.empty}>Favorite um código de erro na Consulta para vê-lo aqui.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({root:{flex:1,backgroundColor:C.bg},content:{padding:spacing.md,gap:spacing.sm,paddingBottom:28},search:{height:48,flexDirection:'row',alignItems:'center',gap:spacing.sm,backgroundColor:C.surface2,borderColor:C.border,borderWidth:1,borderRadius:radius.md,paddingHorizontal:spacing.md},input:{flex:1,color:C.text,fontSize:14},section:{fontSize:11,fontWeight:'800',letterSpacing:1,marginTop:spacing.md},equipmentSection:{color:C.hp},manualSection:{color:C.offline},codeSection:{color:C.alert},item:{flexDirection:'row',alignItems:'center',padding:spacing.md,borderLeftWidth:3},cardTap:{flex:1,flexDirection:'row',alignItems:'center',gap:spacing.sm},label:{color:C.text,fontSize:14,fontWeight:'700'},meta:{color:'#AEB6C4',fontSize:11,marginTop:2},star:{width:32,height:32,borderRadius:16,backgroundColor:'transparent',borderWidth:0},starIcon:{color:C.alert,fontSize:20},empty:{color:'#AEB6C4',fontSize:12,paddingVertical:spacing.sm}});
