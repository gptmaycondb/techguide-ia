import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as C, radius, spacing } from './theme';
import SurfaceCard from './components/SurfaceCard';
import StatusBadge from './components/StatusBadge';
import ActionButton from './components/ActionButton';
import { getModelOfflineStatus } from './offlineStatus';

const QUICK_ACTIONS = [
  ['Códigos de erro', 'Pesquisar código de erro no painel', 'warning-outline'],
  ['Part numbers', 'Consultar part number de peça', 'cube-outline'],
  ['Fusor', 'Diagnóstico e procedimento do fusor', 'flame-outline'],
  ['Toner', 'Troca e diagnóstico de toner', 'water-outline'],
  ['Digitalização', 'Configurar e diagnosticar digitalização', 'scan-outline'],
  ['Rede', 'Configurar rede e endereço IP', 'wifi-outline'],
];

export default function HomeScreen({ manual, isOnline, recentModels = [], onQuestion, onSelectModel, onSelectBrand }) {
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState({});
  const models = [manual, ...recentModels].filter((item, index, list) => item && list.findIndex(x => x.id === item.id) === index);

  useEffect(() => {
    let active = true;
    Promise.all(models.map(async item => [item.id, await getModelOfflineStatus(item.id).catch(() => null)]))
      .then(entries => active && setStatuses(Object.fromEntries(entries.filter(([, value]) => value))));
    return () => { active = false; };
  }, [manual.id, recentModels]);

  const submit = () => { const text = query.trim(); if (text) { setQuery(''); onQuestion(text); } };
  const statusLabel = item => {
    const status = statuses[item.id];
    return status?.downloaded ? `${status.downloaded}/${status.total} offline` : 'Somente online';
  };

  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <SurfaceCard style={styles.searchCard} variant="compact">
      <Ionicons name="search" size={18} color={C.dim} />
      <TextInput value={query} onChangeText={setQuery} onSubmitEditing={submit} placeholder="Buscar nos manuais..." placeholderTextColor={C.muted} style={styles.search} returnKeyType="search" />
    </SurfaceCard>
    <Text style={styles.section}>EQUIPAMENTO ATUAL</Text>
    <SurfaceCard style={[styles.current, { borderLeftColor: manual.color }]}>
      <View style={{ flex: 1 }}><Text style={[styles.brand, { color: manual.color }]}>{manual.brand === 'ricoh' ? 'RICOH' : 'HP'}</Text><Text style={styles.title}>{manual.label}</Text><Text style={styles.sub}>{manual.subtitle}</Text></View>
      <StatusBadge label={statusLabel(manual)} tone={statuses[manual.id]?.downloaded ? 'offline' : 'alert'} shape="pill" size={80} textStyle={styles.badgeText} />
    </SurfaceCard>
    <Text style={styles.section}>AÇÕES RÁPIDAS</Text>
    <View style={styles.grid}>{QUICK_ACTIONS.map(([label, question, icon]) => <ActionButton key={label} variant="secondary" style={styles.quick} onPress={() => onQuestion(question)}><Ionicons name={icon} size={20} color={C.accent} /><Text style={styles.quickText}>{label}</Text></ActionButton>)}</View>
    <Text style={styles.section}>MARCAS</Text>
    <View style={styles.brands}><ActionButton style={[styles.brandBtn, { backgroundColor: C.hp }]} label="HP" onPress={() => onSelectBrand('hp')} /><ActionButton style={[styles.brandBtn, { backgroundColor: C.ricoh }]} label="Ricoh" onPress={() => onSelectBrand('ricoh')} /></View>
    <Text style={styles.section}>RECENTES</Text>
    {recentModels.length === 0 ? <Text style={styles.empty}>Os modelos consultados aparecerão aqui.</Text> : recentModels.map(item => <SurfaceCard key={item.id} as={ActionButton} variant="card" style={[styles.recent, { borderLeftColor: item.color }]} onPress={() => onSelectModel(item.id)}><View style={{ flex: 1 }}><Text style={styles.title}>{item.label}</Text><Text style={styles.sub}>{item.subtitle}</Text></View><Text style={[styles.recentStatus, { color: statuses[item.id]?.downloaded ? C.offline : C.dim }]}>{statusLabel(item)}</Text></SurfaceCard>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ root:{flex:1,backgroundColor:C.bg},content:{padding:spacing.md,gap:spacing.md,paddingBottom:28},searchCard:{flexDirection:'row',alignItems:'center',gap:spacing.sm,paddingHorizontal:spacing.md},search:{flex:1,color:C.text,height:48,fontSize:14},section:{color:C.muted,fontWeight:'700',fontSize:11,letterSpacing:1,marginTop:spacing.sm},current:{flexDirection:'row',alignItems:'center',gap:spacing.md,padding:spacing.lg,borderLeftWidth:3},brand:{fontSize:10,fontWeight:'800'},title:{color:C.text,fontSize:15,fontWeight:'700'},sub:{color:C.dim,fontSize:11,marginTop:2},badgeText:{fontSize:9},grid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},quick:{width:'31.5%',minHeight:82,padding:spacing.sm,gap:6},quickText:{color:C.dim,fontSize:11,textAlign:'center',fontWeight:'600'},brands:{flexDirection:'row',gap:spacing.sm},brandBtn:{flex:1,minHeight:46},recent:{flexDirection:'row',alignItems:'center',padding:spacing.md,borderLeftWidth:3},recentStatus:{fontSize:10,fontWeight:'600'},empty:{color:C.muted,fontSize:12,paddingVertical:spacing.sm} });
