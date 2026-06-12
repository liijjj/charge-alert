import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, TextInput, Vibration, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

export default function App() {
  const [isVibrate, setIsVibrate] = useState(false);
  const [audioUrl, setAudioUrl] = useState('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
  const [isReady, setIsReady] = useState(false); // 确保读取本地数据完成后再允许播放

  const soundRef = useRef(null);
  const isPlayingRef = useRef(false);

  // 1. 第一步：仅在 App 第一次打开时，彻底读取本地配置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // 配置全局音频：允许后台锁屏播放
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true, 
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          playsInSilentModeIOS: true,
          shouldRouteThroughEarpieceAndroid: false,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        });

        const savedVibrate = await AsyncStorage.getItem('isVibrate');
        const savedUrl = await AsyncStorage.getItem('audioUrl');
        
        if (savedVibrate !== null) {
          setIsVibrate(savedVibrate === 'true');
        }
        if (savedUrl !== null && savedUrl.trim() !== '') {
          setAudioUrl(savedUrl);
        }
      } catch (e) {
        console.log('读取配置失败', e);
      } finally {
        setIsReady(true); // 核心：读取完毕，拉闸放行，允许响铃
      }
    };

    loadSettings();

    return () => {
      stopAlert();
    };
  }, []);

  // 2. 第二步：当数据读取完毕，或者用户手动修改了 [isVibrate, audioUrl] 时，触发警报
  useEffect(() => {
    if (!isReady) return; // 如果本地数据还没读完，绝对不盲目播放

    // 只要触发，就先干掉之前的声音和震动，确保同一时间只有一个实例在跑，彻底绝杀重音
    stopAlert().then(() => {
      startAlert(isVibrate, audioUrl);
    });

  }, [isVibrate, audioUrl, isReady]); // 👈 监听这两个值的变化，只要变了、或者刚进App，就立刻重播并绝对保存

  // 保存“震动”配置
  const toggleVibrate = async (value) => {
    setIsVibrate(value);
    await AsyncStorage.setItem('isVibrate', String(value)); // 确保写入本地
  };

  // 保存“音频链接”配置
  const saveUrl = async (text) => {
    setAudioUrl(text);
    await AsyncStorage.setItem('audioUrl', text); // 确保写入本地
  };

  // 启动报警逻辑
  const startAlert = async (vibrateOn, url) => {
    if (isPlayingRef.current) return;

    if (vibrateOn) {
      Vibration.cancel();
      Vibration.vibrate([0, 1000, 500], true); // 持续震动
    }

    if (url && url.trim() !== '') {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url }, 
          { 
            shouldPlay: true, 
            isLooping: true,
            stayAwake: true 
          }
        );
        soundRef.current = sound;
        isPlayingRef.current = true;
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
      } catch (e) {
        console.log('销毁音频失败', e);
      }
    }
  };

  // 提示函数
  const showPermissionNotice = () => {
    Alert.alert(
      "📢 正常运行必要权限说明",
      "为防止系统在后台和锁屏时杀掉本程序，请确保在系统设置中为本应用开启以下权限：\n\n" +
      "1. 【后台弹出界面】\n" +
      "2. 【锁屏显示】\n" +
      "3. 【显示常亮通知 / 通知权限】\n" +
      "4. 【省电策略】调整为 —— 无限制",
      [{ text: "我知道了", style: "cancel" }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: 100, paddingLeft: 20 }}>
      {/* 第一行：震动 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ color: '#ffffff' }}>振动？</Text>
        <Switch value={isVibrate} onValueChange={toggleVibrate} />
      </View>

      {/* 第二行：输入框 */}
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

      {/* 第三行：原生“注意”按钮 */}
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