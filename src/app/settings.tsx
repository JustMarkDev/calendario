import * as Clipboard from 'expo-clipboard';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getMeta } from '@/lib/db';
import { api, connect, disconnect, getConfig, sync, type SyncConfig } from '@/lib/sync';
import { useColors } from '@/lib/theme';

type Access = { id: string; name: string; scope: 'read' | 'write'; kind: 'key' | 'grant' };
const SCOPES = [
  { value: 'read', label: 'Solo lettura' },
  { value: 'write', label: 'Lettura e scrittura' },
] as const;

export default function Settings() {
  const c = useColors();
  const db = useSQLiteContext();
  const [config, setConfig] = useState<SyncConfig | null | undefined>(undefined);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<Access[]>([]);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<'read' | 'write'>('write');
  const [created, setCreated] = useState<string | null>(null);

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
      setAccess([
        ...res.keys.map((k: Access) => ({ ...k, kind: 'key' })),
        ...res.grants.map((g: Access) => ({ ...g, kind: 'grant' })),
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

  if (config === undefined) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const input = [styles.input, { color: c.fg, borderColor: c.line }];
  const button = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.button, { borderColor: c.accent }, primary && { backgroundColor: c.accent }, busy && { opacity: 0.5 }]}
    >
      <Text style={{ color: primary ? '#fff' : c.accent, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  const copyRow = (value: string) => (
    <View style={styles.row}>
      <Text selectable style={[styles.code, { color: c.fg, borderColor: c.line }]}>
        {value}
      </Text>
      {button('Copia', () => Clipboard.setStringAsync(value))}
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.heading, { color: c.fg }]}>Sincronizzazione</Text>
      {config ? (
        <>
          <Text style={{ color: c.fg }}>Collegato a {config.url}</Text>
          <Text style={{ color: c.muted }}>
            {syncedAt
              ? `Ultima sincronizzazione: ${new Date(Number(syncedAt)).toLocaleString('it-IT')}`
              : 'Non ancora sincronizzato'}
          </Text>
          <View style={styles.row}>
            {button('Sincronizza ora', () => run(() => sync(db)), true)}
            {button('Scollega', () =>
              Alert.alert('Scollegare il server?', 'Le note restano sul telefono.', [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Scollega', style: 'destructive', onPress: () => run(() => disconnect(db)) },
              ]),
            )}
          </View>
        </>
      ) : (
        <>
          <Text style={{ color: c.muted }}>
            Collega il tuo server per avere le note su più dispositivi e farle usare agli assistenti AI.
          </Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://calendario.nome.workers.dev"
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
          <View style={styles.row}>
            {button('Collega', () => run(() => connect(db, { url: url.trim(), key: key.trim() })), true)}
          </View>
        </>
      )}
      {status && <Text style={{ color: '#d32f2f' }}>{status}</Text>}

      {config && (
        <>
          <Text style={[styles.heading, { color: c.fg }]}>Accesso agenti</Text>
          <Text style={{ color: c.muted }}>
            ChatGPT, Claude e gli altri assistenti si collegano con questo indirizzo (MCP). Al primo accesso chiedono
            la chiave proprietario.
          </Text>
          {copyRow(`${config.url}/mcp`)}
          <Text style={{ color: c.muted }}>
            Bot e script fatti a mano usano una chiave personale, con l&apos;MCP qui sopra o con l&apos;API descritta in{' '}
            {config.url}/openapi.json
          </Text>

          {access.map((a) => (
            <View key={a.id} style={[styles.access, { borderColor: c.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.fg, fontSize: 16 }}>{a.name}</Text>
                <Text style={{ color: c.muted }}>
                  {a.kind === 'key' ? 'Chiave' : 'Assistente collegato'} ·{' '}
                  {SCOPES.find((s) => s.value === a.scope)?.label}
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  Alert.alert(`Revocare «${a.name}»?`, 'Smetterà subito di funzionare.', [
                    { text: 'Annulla', style: 'cancel' },
                    {
                      text: 'Revoca',
                      style: 'destructive',
                      onPress: () => run(() => api(config, `/api/${a.kind === 'key' ? 'keys' : 'grants'}/${a.id}`, { method: 'DELETE' })),
                    },
                  ])
                }
              >
                <Text style={{ color: c.muted }}>Revoca</Text>
              </Pressable>
            </View>
          ))}

          <Text style={[styles.subheading, { color: c.fg }]}>Nuova chiave</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Nome (es. Bot Telegram)"
            placeholderTextColor={c.muted}
            style={input}
          />
          <View style={styles.row}>
            {SCOPES.map((s) => (
              <Pressable
                key={s.value}
                onPress={() => setNewScope(s.value)}
                accessibilityState={{ selected: newScope === s.value }}
                style={[styles.chip, { borderColor: newScope === s.value ? c.accent : c.line }]}
              >
                <Text style={{ color: newScope === s.value ? c.accent : c.fg }}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            {button(
              'Crea chiave',
              () =>
                newName.trim() &&
                run(async () => {
                  const res = await api(config, '/api/keys', {
                    method: 'POST',
                    body: JSON.stringify({ name: newName.trim(), scope: newScope }),
                  });
                  setCreated(res.key);
                  setNewName('');
                }),
              true,
            )}
          </View>
          {created && (
            <>
              <Text style={{ color: c.fg }}>Copia la chiave adesso: non verrà più mostrata.</Text>
              {copyRow(created)}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  heading: { fontSize: 20, fontWeight: '600', marginTop: 8 },
  subheading: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  code: { flex: 1, fontFamily: 'monospace', fontSize: 13, borderWidth: 1, borderRadius: 8, padding: 8 },
  access: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
});
