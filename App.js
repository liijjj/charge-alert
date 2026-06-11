import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, TextInput, AppState, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

export default function App() {
  const [isVibrate, setIsVibrate] = useState(false);
  const [audioUrl, setAudioUrl] = useState('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
  
  const soundRef = useRef(null);
  const isPlayingRef = useRef(false);

  // 初始化：从本地存储读取上次保存的配置，并立刻触发警报
  useEffect(() => {
    const initAndStart = async () => {
      try {
        const savedVibrate = await AsyncStorage.getItem('isVibrate');
        const savedUrl = await AsyncStorage.getItem('audioUrl');
        
        // 更新状态机的数值
        const vibrateEnabled = savedVibrate === 'true';
        const urlToPlay = savedUrl !== null ? savedUrl : audioUrl;
        
        setIsVibrate(vibrateEnabled);
        if (savedUrl !== null) setAudioUrl(savedUrl);

        // 立刻根据读取到的配置启动报警
        startAlert(vibrateEnabled, urlToPlay);
      } catch (e) {
        console.log('读取配置失败', e);
      }
    };

    initAndStart();

    // 监听后台/前台切换
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        startAlert(isVibrate, audioUrl);
      } else {
        stopAlert();
      }
    });

    return () => {
      subscription.remove();
      stopAlert();
    };
  }, [isVibrate, audioUrl]);

  // 保存“震动”配置
  const toggleVibrate = async (value) => {
    setIsVibrate(value);
    await AsyncStorage.setItem('isVibrate', String(value));
  };

  // 保存“音频链接”配置
  const saveUrl = async (text) => {
    setAudioUrl(text);
    await AsyncStorage.setItem('audioUrl', text);
  };

  // 启动报警逻辑
  const startAlert = async (vibrateOn, url) => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    if (vibrateOn) {
      Vibration.vibrate([0, 1000, 500], true);
    }

    if (url && url.trim() !== '') {
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true, isLooping: true });
        soundRef.current = sound;
      } catch (error) {
        console.log('音频播放失败，请检查链接是否正确', error);
      }
    }
  };

  // 停止报警逻辑
  const stopAlert = async () => {
    isPlayingRef.current = false;
    Vibration.cancel();
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (e) {}
    }
  };

  return (
    <View style={{ paddingTop: 100, paddingLeft: 20 }}>
      {/* 第一行：震动文本 + 原生开关(复选框) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Text>振动？</Text>
        <Switch value={isVibrate} onValueChange={toggleVibrate} />
      </View>

      {/* 第二行：铃声文本 + 原生单行输入框 */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text>铃声？</Text>
        <TextInput 
          value={audioUrl} 
          onChangeText={saveUrl} 
          placeholder="请输入音频网址"
          style={{ borderWidth: 1, borderColor: '#000', width: 250, marginLeft: 10, padding: 2 }}
        />
      </View>
    </View>
  );
}