import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';

const API_URL = 'http://localhost:8080';

async function api(path, method = 'GET', body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const rsp = await fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await rsp.json();
  if (!rsp.ok) throw new Error(json.error || 'api_error');
  return json;
}

export default function App() {
  const [view, setView] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(null);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const loadChats = async (tkn) => {
    setLoading(true);
    try {
      const data = await api('/api/chats', 'GET', null, tkn);
      setChats(data.chats || []);
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally { setLoading(false); }
  };

  const openChat = async (id) => {
    setChatId(id);
    setLoading(true);
    try {
      const data = await api(`/api/chats/${id}/messages`, 'GET', null, token);
      setMessages(data.messages || []);
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally { setLoading(false); }
  };

  const sendMessage = async () => {
    if (!chatId || !text) return;
    try {
      setMessages(prev => [...prev, { id: Math.random().toString(36).slice(2), text, senderId: 'me', createdAt: Date.now() }]);
      setText('');
      await fetch(API_URL, { method: 'HEAD' });
    } catch {}
  };

  const doLogin = async () => {
    setLoading(true);
    try {
      const res = await api('/api/auth/login','POST',{ username, password });
      setToken(res.token);
      setView('app');
      loadChats(res.token);
    } catch (e) {
      Alert.alert('Ошибка входа', e.message);
    } finally { setLoading(false); }
  };

  const doRegister = async () => {
    setLoading(true);
    try {
      await api('/api/auth/register','POST',{ username, password });
      await doLogin();
    } catch (e) {
      Alert.alert('Ошибка регистрации', e.message);
    } finally { setLoading(false); }
  };

  const renderChat = ({ item }) => (
    <TouchableOpacity style={styles.listItem} onPress={()=>openChat(item.id)}>
      <Text style={styles.listTitle}>{item.type.toUpperCase()} {item.name || ''}</Text>
      <Text style={styles.listSub}>{item.lastMessage?.text || 'Нет сообщений'}</Text>
    </TouchableOpacity>
  );

  if (view === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>SafeGram (RN)</Text>
        <TextInput value={username} onChangeText={setUsername} placeholder="Username" style={styles.input} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />
        <TouchableOpacity style={styles.button} onPress={doLogin}><Text style={styles.btnText}>Войти</Text></TouchableOpacity>
        <TouchableOpacity style={styles.buttonGhost} onPress={doRegister}><Text style={styles.btnText}>Регистрация</Text></TouchableOpacity>
        {loading && <ActivityIndicator color="#3b82f6" style={{marginTop:12}} />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Чаты</Text>
      {loading && <ActivityIndicator color="#3b82f6" style={{marginBottom:8}} />}
      {!chatId && (
        <FlatList
          data={chats}
          keyExtractor={item=>item.id}
          renderItem={renderChat}
          contentContainerStyle={{gap:8}}
        />
      )}
      {chatId && (
        <View style={{flex:1, width:'100%'}}>
          <TouchableOpacity style={styles.buttonGhost} onPress={()=>setChatId(null)}><Text style={styles.btnText}>Назад</Text></TouchableOpacity>
          <FlatList
            data={messages}
            keyExtractor={m=>m.id}
            renderItem={({item})=>(
              <View style={styles.message}>
                <Text style={styles.listSub}>{new Date(item.createdAt||Date.now()).toLocaleString()}</Text>
                <Text style={styles.listTitle}>{item.text}</Text>
              </View>
            )}
            contentContainerStyle={{gap:8}}
          />
          <View style={{flexDirection:'row', gap:8, marginTop:8}}>
            <TextInput value={text} onChangeText={setText} placeholder="Сообщение" style={[styles.input,{flex:1}]} />
            <TouchableOpacity style={styles.button} onPress={sendMessage}><Text style={styles.btnText}>Send</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, alignItems:'center', padding:16, backgroundColor:'#0b0e13' },
  title: { fontSize:22, fontWeight:'700', color:'#e5e7eb', marginBottom:12 },
  input: { width:'100%', backgroundColor:'#111827', color:'#e5e7eb', padding:12, borderRadius:10, borderWidth:1, borderColor:'#1f2937' },
  button: { backgroundColor:'#3b82f6', paddingVertical:12, paddingHorizontal:16, borderRadius:10, marginTop:10, alignItems:'center' },
  buttonGhost: { borderWidth:1, borderColor:'#3b82f6', paddingVertical:12, paddingHorizontal:16, borderRadius:10, marginTop:10, alignItems:'center' },
  btnText: { color:'#e5e7eb', fontWeight:'700' },
  listItem: { padding:12, backgroundColor:'#0f172a', borderRadius:10, borderWidth:1, borderColor:'#1f2937' },
  listTitle: { color:'#e5e7eb', fontWeight:'700' },
  listSub: { color:'#9ca3af', fontSize:12 },
  message: { padding:10, backgroundColor:'#0f172a', borderRadius:10, borderWidth:1, borderColor:'#1f2937' }
});
