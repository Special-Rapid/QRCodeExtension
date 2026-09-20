import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { usePreferences } from '../lib/preferences';
import { getStrings } from '../lib/strings';
import { createPairStyles, getPalette } from '../lib/theme';

export default function ImageScanScreen() {
  const { resolvedTheme, locale } = usePreferences();
  const t = getStrings(locale);
  const styles = useMemo(() => createPairStyles(getPalette(resolvedTheme)), [resolvedTheme]);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState(false);

  const selectImage = async () => {
    if (selecting) return;
    setSelecting(true);
    setError(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
      });
      const uri = result.assets?.[0]?.uri;
      if (!result.canceled && uri?.startsWith('file://')) router.replace({ pathname: '/', params: { imageUri: uri } });
      else if (!result.canceled) setError(true);
    } catch {
      setError(true);
    } finally {
      setSelecting(false);
    }
  };

  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.pageIntro}>
      <Text style={styles.eyebrow}>{t.imageScanEyebrow}</Text>
      <Text style={styles.title}>{t.imageScanTitle}</Text>
      <Text style={styles.copy}>{t.imageScanBody}</Text>
    </View>
    <View style={styles.settingsCard}>
      <View style={styles.settingsSection}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.imageScanChoose} accessibilityState={{ busy: selecting }} disabled={selecting} style={styles.primary} onPress={() => { void selectImage(); }}><Text style={styles.primaryText}>{selecting ? t.imageScanChoosing : t.imageScanChoose}</Text></Pressable>
        {error && <Text accessibilityLiveRegion="polite" style={styles.status}>{t.imageScanUnavailable}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={t.imageScanBack} style={styles.secondary} onPress={() => router.replace('/')}><Text style={styles.secondaryText}>{t.imageScanBack}</Text></Pressable>
      </View>
    </View>
  </ScrollView>;
}
