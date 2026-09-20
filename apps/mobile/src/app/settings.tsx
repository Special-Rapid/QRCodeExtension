import { useMemo } from 'react';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { usePreferences } from '../lib/preferences';
import { getStrings } from '../lib/strings';
import { createPairStyles, getPalette } from '../lib/theme';

export default function SettingsScreen() {
  const { themePreference, setThemePreference, localePreference, setLocalePreference, resolvedTheme, locale } = usePreferences();
  const t = getStrings(locale);
  const styles = useMemo(() => createPairStyles(getPalette(resolvedTheme)), [resolvedTheme]);
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.pageIntro}>
      <Text style={styles.eyebrow}>{t.settingsEyebrow}</Text>
      <View style={styles.titleRow}><Text style={styles.title}>{t.settingsTitle}</Text><Pressable accessibilityRole="button" accessibilityLabel={t.pcLinkSettings} onPress={() => router.back()} style={styles.titleAction}><Text style={styles.titleActionText}>{t.pcLinkSettings}</Text></Pressable></View>
      <Text style={styles.copy}>{t.settingsBody}</Text>
    </View>
    <View style={styles.settingsCard}>
      <View style={styles.settingsSection}>
        <Text style={styles.settingsLabel}>{t.appearance}</Text>
        <Text style={styles.copy}>{t.settingsAppearanceBody}</Text>
        <View style={styles.settingsRow}>{(['system', 'light', 'dark'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: themePreference === value }} accessibilityLabel={value === 'system' ? t.themeSystem : value === 'light' ? t.themeLight : t.themeDark} onPress={() => { void setThemePreference(value); }} style={[styles.settingsChip, themePreference === value && styles.settingsChipActive]}><Text style={[styles.settingsChipText, themePreference === value && styles.settingsChipTextActive]}>{value === 'system' ? t.themeSystem : value === 'light' ? t.themeLight : t.themeDark}</Text></Pressable>)}</View>
      </View>
      <View style={styles.settingsSection}>
        <Text style={styles.settingsLabel}>{t.language}</Text>
        <Text style={styles.copy}>{t.settingsLanguageBody}</Text>
        <View style={styles.settingsRow}>{(['system', 'ja', 'en'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: localePreference === value }} accessibilityLabel={value === 'system' ? t.localeSystem : value === 'ja' ? t.localeJapanese : t.localeEnglish} onPress={() => { void setLocalePreference(value); }} style={[styles.settingsChip, localePreference === value && styles.settingsChipActive]}><Text style={[styles.settingsChipText, localePreference === value && styles.settingsChipTextActive]}>{value === 'system' ? t.localeSystem : value === 'ja' ? t.localeJapanese : t.localeEnglish}</Text></Pressable>)}</View>
      </View>
      {Platform.OS === 'ios' && <View style={styles.settingsSection}>
        <Text style={styles.settingsLabel}>{t.sharedImageHeading}</Text>
        <Text selectable style={styles.copy}>{t.sharedImageBody}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t.sharedImageSelect} style={styles.secondary} onPress={() => router.push('/image-scan' as never)}><Text style={styles.secondaryText}>{t.sharedImageSelect}</Text></Pressable>
      </View>}
    </View>
  </ScrollView>;
}
