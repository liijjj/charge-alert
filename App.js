import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, TextInput, Vibration, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

export default function App() {
  const [isVibrate, setIsVibrate] = useState(false);
  const [audioUrl, setAudioUrl] = useState('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
  
  const soundRef = useRef(null);
  const isPlayingRef = useRef(false);

  // 初始化：只在 App 第一次完全点开/冷启动时执行唯一一次
  useEffect(() => {
    const initAndStart = async () => {
      try {
        // 核心补充：必须配置音频系统，允许锁屏和后台持续播放，不被系统静音
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true, // 👈 核心：保证播放途中锁屏不停止
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

        // 立刻根据读取到的配置启动报警（即便此时是锁屏后台启动，也会直接强行播放）
        await startAlert(vibrateEnabled, urlToPlay);
      } catch (e) {
        console.log('读取配置失败', e);
      }
    };

    initAndStart();

    // 🗑️ 【彻底移除 AppState 监听】
    // 删除了“退后台和锁屏就自动调用 stopAlert()”的逻辑，确保锁屏时后台启动绝不被掐断。

    return () => {
      stopAlert();
    };
  }, []); // 👈 【核心修复】这里改为独立空数组 []，确保只在启动时加载一次，彻底修复状态不保存的 Bug

  // 保存“震动”配置并实时无缝联动
  const toggleVibrate = async (value) => {
    setIsVibrate(value);
    await AsyncStorage.setItem('isVibrate', String(value));
    
    // 状态实时联动：如果开启则立刻单独追加震动，关闭则立刻停震，不再重跑整个 App 生命周期
    if (value) {
      Vibration.cancel();
      Vibration.vibrate([0, 1000, 500], true);
    } else {
      Vibration.cancel();
    }
  };

  // 保存“音频链接”配置并实时切歌
  const saveUrl = async (text) => {
    setAudioUrl(text);
    await AsyncStorage.setItem('audioUrl', text);
    
    // 如果用户在亮屏时修改了网址，直接干掉旧铃声，无缝播放新铃声
    if (text.trim() !== '') {
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch(e){}
        soundRef.current = null;
      }
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: text }, { shouldPlay: true, isLooping: true });
        soundRef.current = sound;
      } catch (error) {}
    }
  };

  // 启动报警逻辑
  const startAlert = async (vibrateOn, url) => {
    // 【严格防重音】如果当前已经有铃声在实例中，先无条件销毁，绝不叠加播放
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch(e){}
      soundRef.current = null;
    }
    
    isPlayingRef.current = true;

    if (vibrateOn) {
      Vibration.cancel();
      Vibration.vibrate([0, 1000, 500], true);
    }

    if (url && url.trim() !== '') {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url }, 
          { 
            shouldPlay: true, 
            isLooping: true,
            stayAwake: true // 强制保持音频硬件唤醒
          }
        );
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

  // 【按要求新增】纯原生“注意”提示弹窗函数
  const showPermissionsNotice = () => {
    Alert.alert(
      "注意",
      "使用前请务必开启以下权限：\n\n" +
      "1. 后台弹出界面\n" +
      "2. 锁屏显示\n" +
      "3. 通知权限\n" +
      "4. 省电策略设为无限制",
      [{ text: "确定", style: "cancel" }]
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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 30 }}>
        <Text style={{ color: '#ffffff' }}>铃声？</Text>
        <TextInput 
          value={audioUrl} 
          onChangeText={saveUrl} 
          placeholder="请输入音频网址"
          placeholderTextColor="#666666"
          style={{ borderWidth: 1, borderColor: '#ffffff', color: '#ffffff', width: 250, marginLeft: 10, padding: 2 }}
        />
      </View>

      {/* 第三行：【按要求新增】纯原生“注意”按钮 */}
      <View style={{ width: 100, marginTop: 10 }}>
        <Button 
          title="注意" 
          onPress={showPermissionsNotice} 
          color="#FF3B30" 
        />
      </View>
    </View>
  );
}