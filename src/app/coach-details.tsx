import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fromForm, PROFILE_FIELDS, toForm, type ProfileKey } from '@/coach/profile-fields';
import { Colors, Radius, Type } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useCoach } from '@/store/coach';

/** "Your details": what the coach remembers between chats. Edit or clear any of it. */
export default function CoachDetailsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useCoach((s) => s.profile);
  const setProfile = useCoach((s) => s.setProfile);
  const [form, setForm] = useState(() => toForm(profile));

  const change = (key: ProfileKey, text: string) => setForm((f) => ({ ...f, [key]: text }));

  const save = () => {
    const { profile: next, errors } = fromForm(form);
    if (errors.length) {
      Alert.alert('Check these', errors.join('\n'));
      return;
    }
    setProfile(next);
    haptics.success();
    router.back();
  };

  const forgetAll = () =>
    Alert.alert('Forget all your details?', 'Your coach will ask again in your next chat. Your calendar isn’t touched.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: () => {
          setProfile({});
          router.back();
        },
      },
    ]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text style={styles.topBarButton}>Cancel</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Your details</Text>
        <Pressable onPress={save} hitSlop={10} accessibilityRole="button">
          <Text style={[styles.topBarButton, styles.saveText]}>Save</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.intro}>
            Your coach remembers these between chats and fills them in as you talk. Clear a field to make it forget.
          </Text>
          {PROFILE_FIELDS.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={form[field.key]}
                  onChangeText={(text) => change(field.key, text)}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textSubtle}
                  multiline={field.kind === 'long'}
                  keyboardType={field.kind === 'number' ? 'number-pad' : 'default'}
                  autoCapitalize={field.kind === 'list' || field.kind === 'date' ? 'none' : 'sentences'}
                  style={[styles.input, field.kind === 'long' && styles.long]}
                />
                {field.unit && <Text style={styles.unit}>{field.unit}</Text>}
              </View>
            </View>
          ))}
          <Pressable onPress={forgetAll} accessibilityRole="button" style={styles.forget}>
            <Text style={styles.forgetText}>Forget all details</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  topBarButton: {
    color: Colors.textMuted,
    fontSize: 16,
    width: 70,
  },
  saveText: {
    color: Colors.accent,
    fontWeight: '700',
    textAlign: 'right',
  },
  topBarTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  form: {
    paddingHorizontal: 16,
    gap: 10,
  },
  intro: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  field: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  fieldLabel: {
    ...Type.caps,
    fontSize: 11,
    color: Colors.textSubtle,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 4,
  },
  long: {
    minHeight: 44,
    textAlignVertical: 'top',
  },
  unit: {
    color: Colors.textSubtle,
    fontSize: 14,
  },
  forget: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  forgetText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
});
