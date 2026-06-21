import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as C, radius, spacing } from './theme';
import SurfaceCard from './components/SurfaceCard';
import IconButton from './components/IconButton';

export default function FavoritesScreen({ favorites, onSelectModel, onOpenManual, onToggleFavorite }) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => favorites.filter(item => `${item.label} ${item.meta || ''}`.toLowerCase().includes(query.toLowerCase())), [favorites, query]);
  const models = visible.filter(item => item.type === 'model');
  const manuals = visible.filter(item => item.type === 'manual');
  const renderItem = (item, onPress, icon) => <SurfaceCard key={item.id} style={[styles.item, { borderLeftColor: item.color || C.accent }]}><View style={styles.itemMain}><Ionicons name={icon} size={19} color={item.color || C.accent} /><View style={{ flex: 1 }}><Text style={styles.label}>{item.label}</Text><Text style={styles.meta}>{item.meta}</Text></View><IconButton icon="★" onPress={() => onToggleFavorite(item)} style={styles.star} iconStyle={styles.starIcon} /></View><Text onPress={() => onPress(item)} style={styles.open}>{item.type === 'manual' ? 'Ver em Manuais' : 'Abrir na Consulta'}</Text></SurfaceCard>;
  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.search}><Ionicons name="search" size={18} color={C.dim} /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar favoritos" placeholderTextColor={C.muted} style={styles.input} /></View>
    <Text style={styles.section}>EQUIPAMENTOS</Text>
    {models.length ? models.map(item => renderItem(item, onSelectModel, 'print-outline')) : <Text style={styles.empty}>Nenhum equipamento favoritado.</Text>}
    <Text style={styles.section}>MANUAIS</Text>
    {manuals.length ? manuals.map(item => renderItem(item, onOpenManual, 'document-text-outline')) : <Text style={styles.empty}>Nenhum manual favoritado.</Text>}
    <Text style={styles.section}>CÓDIGOS</Text>
    <Text style={styles.empty}>Favorite um código de erro na Consulta para vê-lo aqui.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({root:{flex:1,backgroundColor:C.bg},content:{padding:spacing.md,gap:spacing.sm,paddingBottom:28},search:{height:48,flexDirection:'row',alignItems:'center',gap:spacing.sm,backgroundColor:C.surface2,borderColor:C.border,borderWidth:1,borderRadius:radius.md,paddingHorizontal:spacing.md},input:{flex:1,color:C.text,fontSize:14},section:{color:C.muted,fontSize:11,fontWeight:'700',letterSpacing:1,marginTop:spacing.md},item:{padding:spacing.md,borderLeftWidth:3},itemMain:{flexDirection:'row',alignItems:'center',gap:spacing.sm},label:{color:C.text,fontSize:14,fontWeight:'700'},meta:{color:C.dim,fontSize:11,marginTop:2},star:{width:32,height:32,borderRadius:16,backgroundColor:'transparent',borderWidth:0},starIcon:{color:C.alert,fontSize:20},open:{color:C.accent,fontSize:12,fontWeight:'700',marginTop:8,marginLeft:27},empty:{color:C.muted,fontSize:12,paddingVertical:spacing.sm}});
