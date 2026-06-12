import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, TextInput, Vibration, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

export default function App() {
  const [isVibrate, setIsVibrate] = useState(false);
  const [audioUrl, setAudioUrl] = useState('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
  
  const soundRef = useRef(null);
  const isPlayingRef = useRef(false);
  const isAudioLoadingRef = useRef(false); // 【新增核心防重锁】防止加载未完成时二次触发

  // 初始化：从本地存储读取上次保存的配置，并立刻触发警报
  useEffect(() => {
    const initAndStart = async () => {
      try {
        // 1. 配置 Expo 核心音频系统：允许后台运行，锁屏不静音
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true, // 👈 保证播放途中锁屏能持续播放
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

        // 2. 立刻根据读取到的配置启动报警（只会触发一次）
        await startAlert(vibrateEnabled, urlToPlay);
      } catch (e) {
        console.log('读取配置失败', e);
      }
    };

    initAndStart();

    // 🗑️ 【彻底删除了 AppState 监听】
    // 之前退后台会自动调用 stopAlert()，现在删掉后，哪怕锁屏代码也会在后台硬啃、持续播放！

    return () => {
      stopAlert();
    };
  }, []); // 👈 移除依赖项，确保仅在 App 点开启动的一瞬间执行一次，绝不重复！

  // 保存“震动”配置
  const toggleVibrate = async (value) => {
    setIsVibrate(value);
    await AsyncStorage.setItem('isVibrate', String(value));
    // 状态改变时，如果是开启，重新刷一下状态
    if (value && isPlayingRef.current) {
      Vibration.cancel();
      Vibration.vibrate([0, 1000, 500], true);
    } else if (!value) {
      Vibration.cancel();
    }
  };

  // 保存“音频链接”配置并切换播放
  const saveUrl = async (text) => {
    setAudioUrl(text);
    await AsyncStorage.setItem('audioUrl', text);
    if (text.trim() !== '') {
      // 切换新歌时，先强制关闭旧的，再播新的
      await stopAlert();
      await startAlert(isVibrate, text);
    }
  };

  // 启动报警逻辑
  const startAlert = async (vibrateOn, url) => {
    // 【防重音双保险】如果正在播放或者正在加载音频，直接拦截，绝不重叠
    if (isPlayingRef.current || isAudioLoadingRef.current) return;
    isAudioLoadingRef.current = true;

    if (vibrateOn) {
      Vibration.cancel(); // 震动前清空残留，确保单次执行
      Vibration.vibrate([0, 1000, 500], true);
    }

    if (url && url.trim() !== '') {
      try {
        // 先销毁可能遗留的实例
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: url }, 
          { 
            shouldPlay: true, 
            isLooping: true,
            stayAwake: true // 👈 核心：告诉系统保持音频硬件唤醒
          }
        );
        soundRef.current = sound;
        isPlayingRef.current = true; // 确认播放成功后再锁住状态
      } catch (error) {
        console.log('音频播放失败，请检查链接是否正确', error);
      } finally {
        isAudioLoadingRef.current = false; // 解开加载锁
      }
    } else {
      isAudioLoadingRef.current = false;
    }
  };

  // 停止报警逻辑
  const stopAlert = async () => {
    isPlayingRef.current = false;
    isAudioLoadingRef.current = false;
    Vibration.cancel();
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (e) {}
    }
  };

  // 【新增提示函数】弹窗告知必要权限
  const showPermissionNotice = () => {
    Alert.alert(
      "📢 正常运行必要权限说明",
      "为防止系统在后台和锁屏时杀掉本程序，请确保在系统设置中为本应用开启以下权限：\n\n" +
      "1. 【后台弹出界面】（最关键！允许定时唤醒）\n" +
      "2. 【锁屏显示】（允许在锁屏状态下展示界面）\n" +
      "3. 【显示常亮通知 / 通知权限】\n" +
      "4. 【省电策略】必须调整为 —— 无限制",
      [{ text: "我知道了", style: "cancel" }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: 100, paddingLeft: 20 }}>
      {/* 第一行：震动文本（白字） + 原生开关 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ color: '#ffffff' }}>振动？</Text>
        <Switch value={isVibrate} onValueChange={toggleVibrate} />
      </View>

      {/* 第二行：铃声文本（白字） + 原生单行输入框（白边框、白字） */}
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
          onPress={showPermissionNotice} 
          color="#FF3B30" 
        />
      </View>
    </View>
  );
}