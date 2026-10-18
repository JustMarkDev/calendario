import * as Clipboard from 'expo-clipboard';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { getMeta } from '@/lib/db';
import { api, connect, disconnect, getConfig, type SyncConfig } from '@/lib/sync';
import { materialAvailable, savePrefs, type ThemeMode, useColors, usePrefs } from '@/lib/theme';
import { updateAgendaWidget } from '@/widget/agenda';

type Agent = { id: string; name: string; kind: 'key' | 'grant' };
type Step = 'idle' | 'server' | 'name' | 'done';
const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
];

// Pasted into the agent's chat: enough for it to set itself up.
const instructions = (url: string, key: string) =>
  `Collegati al mio calendario con MCP (HTTP).
Indirizzo: ${url}/mcp
Intestazione: Authorization: Bearer ${key}
Se sei Claude Code, esegui: claude mcp add --transport http calendario ${url}/mcp --header "Authorization: Bearer ${key}"`;

export default function Settings() {
  const c = useColors();
  const prefs = usePrefs();
  const db = useSQLiteContext();
  const [config, setConfig] = useState<SyncConfig | null | undefined>(undefined);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const [version, setVersion] = useState(0); // bumped after every action to reload

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await getConfig();
      const at = await getMeta(db, 'synced_at');
      const res = saved ? await api(saved, '/api/keys') : { keys: [], grants: [] };
      if (!active) return;
      setConfig(saved);
      setSyncedAt(at);
      setAgents([
        ...res.keys.map((k: Agent) => ({ ...k, kind: 'key' })),
        ...res.grants.map((g: Agent) => ({ ...g, kind: 'grant' })),
      ]);
    })().catch((e) => {
      if (active) setStatus(e.message);
      getConfig().then((saved) => active && setConfig(saved));
    });
    return () => {
      active = false;
    };
  }, [db, version]);

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setStatus(null);
    try {
      await task();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
      setVersion((v) => v + 1);
    }
  };

  const setPrefs = (next: typeof prefs) => savePrefs(db, next).then(() => updateAgendaWidget(db));

  const finish = () => {
    setStep('idle');
    setName('');
    setMessage('');
    setCopied(false);
  };

  if (config === undefined) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const input = [styles.input, { color: c.fg, borderColor: c.line }];
  const button = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.button, { borderColor: c.accent }, primary && { backgroundColor: c.accent }, busy && { opacity: 0.5 }]}
    >
      <Text style={[styles.buttonText, { color: primary ? c.onAccent : c.accent }]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {step === 'idle' && button('Collega un agente', () => setStep(config ? 'name' : 'server'), true)}

      {step === 'server' && (
        <>
          <Text style={{ color: c.fg, fontSize: 17 }}>Prima collega il calendario al tuo server.</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Indirizzo del server"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={input}
          />
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="Chiave proprietario"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={input}
          />
          {button(
            'Continua',
            () =>
              run(async () => {
                await connect(db, { url: url.trim(), key: key.trim() });
                setStep('name');
              }),
            true,
          )}
          {button('Annulla', finish)}
        </>
      )}

      {step === 'name' && (
        <>
          <Text style={{ color: c.fg, fontSize: 17 }}>Come si chiama l&apos;agente?</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="es. Claude Code, Grok, Hermes"
            placeholderTextColor={c.muted}
            autoFocus
            style={input}
          />
          {button(
            'Collega',
            () =>
              name.trim() &&
              run(async () => {
                const saved = (await getConfig())!;
                const res = await api(saved, '/api/keys', {
                  method: 'POST',
                  body: JSON.stringify({ name: name.trim(), scope: 'write' }),
                });
                setMessage(instructions(saved.url, res.key));
                setStep('done');
              }),
            true,
          )}
          {button('Annulla', finish)}
        </>
      )}

      {step === 'done' && (
        <>
          <Text style={{ color: c.fg, fontSize: 17 }}>
            Copia il messaggio e incollalo nella chat di {name.trim()}: si collegherà da solo.
          </Text>
          {button(
            copied ? 'Copiato ✓' : 'Copia messaggio',
            () => Clipboard.setStringAsync(message).then(() => setCopied(true)),
            true,
          )}
          {button('Fine', finish)}
        </>
      )}

      {status && <Text style={{ color: '#d32f2f' }}>{status}</Text>}

      {agents.length > 0 && <Text style={[styles.heading, { color: c.fg }]}>Agenti collegati</Text>}
      {agents.map((a) => (
        <View key={a.id} style={[styles.agent, { borderColor: c.line }]}>
          <Text style={{ color: c.fg, fontSize: 17, flex: 1 }}>{a.name}</Text>
          <Pressable
            hitSlop={8}
            onPress={() =>
              Alert.alert(`Scollegare ${a.name}?`, 'Non potrà più vedere il calendario.', [
                { text: 'Annulla', style: 'cancel' },
                {
                  text: 'Scollega',
                  style: 'destructive',
                  onPress: () => run(() => api(config!, `/api/${a.kind === 'key' ? 'keys' : 'grants'}/${a.id}`, { method: 'DELETE' })),
                },
              ])
            }
          >
            <Text style={{ color: c.muted }}>Scollega</Text>
          </Pressable>
        </View>
      ))}

      <Text style={[styles.heading, { color: c.fg }]}>Aspetto</Text>
      <View style={styles.row}>
        {MODES.map((m) => (
          <Pressable
            key={m.value}
            onPress={() => setPrefs({ ...prefs, mode: m.value })}
            accessibilityState={{ selected: prefs.mode === m.value }}
            style={[styles.chip, prefs.mode === m.value ? { backgroundColor: c.accent } : { borderColor: c.line }]}
          >
            <Text style={{ color: prefs.mode === m.value ? c.onAccent : c.fg, fontSize: 16 }}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      {materialAvailable && (
        <View style={styles.row}>
          <Text style={{ color: c.fg, fontSize: 17, flex: 1 }}>Colori Material You</Text>
          <Switch
            value={prefs.materialYou}
            onValueChange={(materialYou) => setPrefs({ ...prefs, materialYou })}
            trackColor={{ true: c.accent, false: c.muted }}
            thumbColor={prefs.materialYou ? c.onAccent : undefined}
          />
        </View>
      )}

      {config && (
        <Pressable
          style={styles.footer}
          onPress={() =>
            Alert.alert('Scollegare il server?', 'Le note restano sul telefono.', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Scollega', style: 'destructive', onPress: () => run(() => disconnect(db)) },
            ])
          }
        >
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {syncedAt ? `Sincronizzato ${new Date(Number(syncedAt)).toLocaleString('it-IT')}` : 'Non ancora sincronizzato'}
            {' · Scollega server'}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  heading: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: 18, paddingVertical: 8 },
  agent: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  footer: { marginTop: 24 },
});
