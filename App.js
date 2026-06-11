import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, TextInput, Vibration, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

export default function App() {
  const [isVibrate, setIsVibrate] = useState(false);
  const [audioUrl, setAudioUrl] = useState('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
  
  const soundRef = useRef(null);
  const isPlayingRef = useRef(false);
  const isPlayerLoading = useRef(false); // 新增防撞车锁：防止多线程同时加载引发重音

  // 初始化：从本地存储读取上次保存的配置，并立刻触发警报
  useEffect(() => {
    const initAndStart = async () => {
      try {
        // 全局音频模式配置：允许后台/锁屏不间断播放
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true, // 核心：锁屏允许后台继续跑
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          playsInSilentModeIOS: true,
          shouldRouteThroughEarpieceAndroid: false,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        });

        const savedVibrate = await AsyncStorage.getItem('isVibrate');
        const savedUrl = await AsyncStorage.getItem('audioUrl');
        
        const vibrateEnabled = savedVibrate === 'true';
        const urlToPlay = savedUrl !== null ? savedUrl : audioUrl;
        
        setIsVibrate(vibrateEnabled);
        if (savedUrl !== null) setAudioUrl(savedUrl);

        // 立刻启动报警
        startAlert(vibrateEnabled, urlToPlay);
      } catch (e) {
        console.log('读取配置失败', e);
      }
    };

    initAndStart();

    // 移除之前的 AppState 后台监听，不再让系统锁屏时去执行 stopAlert()
    return () => {
      stopAlert();
    };
  }, []);

  // 保存“震动”配置并实时测试更新
  const toggleVibrate = async (value) => {
    setIsVibrate(value);
    await AsyncStorage.setItem('isVibrate', String(value));
    // 改变开关时重新触发一次，保证状态最新
    startAlert(value, audioUrl);
  };

  // 保存“音频链接”配置并无缝换歌
  const saveUrl = async (text) => {
    setAudioUrl(text);
    await AsyncStorage.setItem('audioUrl', text);
    if (text.trim() !== '') {
      startAlert(isVibrate, text);
    }
  };

  // 启动报警逻辑（已完美解决重复、重音、锁屏积压问题）
  const startAlert = async (vibrateOn, url) => {
    // 如果正在加载中，直接拒绝后面的所有重复触发，防止解锁瞬间重音
    if (isPlayerLoading.current) return;
    isPlayerLoading.current = true;

    try {
      // 1. 每次播放新声音前，雷打不动先清理掉旧的实例，确保干净
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {}
        soundRef.current = null;
      }
      Vibration.cancel();
      isPlayingRef.current = false;

      // 2. 触发震动（控制为只震动一次 1 秒，不重复、不循环）
      if (vibrateOn) {
        Vibration.vibrate(1000); 
      }

      // 3. 异步加载并播放唯一的一个铃声
      if (url && url.trim() !== '') {
        isPlayingRef.current = true;
        const { sound } = await Audio.Sound.createAsync(
          { uri: url }, 
          { 
            shouldPlay: true, 
            isLooping: true, // 声音依然保持无限循环，直到拔线
            stayAwake: true  // 播放时阻止 CPU 睡眠
          }
        );
        soundRef.current = sound;
      }
    } catch (error) {
      console.log('音频播放失败，请检查链接是否正确', error);
    } finally {
      isPlayerLoading.current = false; // 解锁，允许下一次正常控制
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

  // 弹出简短的所需权限提示（只含名称）
  const showPermissionsNotice = () => {
    Alert.alert(
      "使用前必要权限开启提示",
      "为确保锁屏时能正常自动唤醒屏幕并播放，请检查并开启以下权限：\n\n" +
      "1. 锁屏显示\n" +
      "2. 后台弹出界面\n" +
      "3. 省电策略设定为：无限制",
      [{ text: "我知道了" }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: 100, paddingLeft: 20 }}>
      {/* 第一行：震动文本（白字） + 原生开关 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ color: '#ffffff' }}>振动？</Text>
        <Switch value={isVibrate} onValueChange={toggleVibrate} />
      </View>

      {/* 第二行：铃声文本（白字） + 原生单行输入框 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
        <Text style={{ color: '#ffffff' }}>铃声？</Text>
        <TextInput 
          value={audioUrl} 
          onChangeText={saveUrl} 
          placeholder="请输入音频网址"
          placeholderTextColor="#666666"
          style={{ borderWidth: 1, borderColor: '#ffffff', color: '#ffffff', width: 250, marginLeft: 10, padding: 2 }}
        />
      </View>

      {/* 新增第三行：点击提示系统权限的“注意”按钮 */}
      <TouchableOpacity 
        onPress={showPermissionsNotice}
        style={{ borderWidth: 1, borderColor: '#ffffff', paddingVertical: 10, paddingHorizontal: 20, width: 100, borderRadius: 4, alignItems: 'center' }}
      >
        <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>注意</Text>
      </TouchableOpacity>
    </View>
  );
}