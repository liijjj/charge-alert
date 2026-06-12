import React, { useEffect, useRef } from 'react';
import { View, Text, Vibration, Button, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { activateKeepAwakeAsync } from 'expo-keep-awake';

export default function App() {
  // 默认直接开启强震
  const isVibrate = true; 
  
  // 👈 已经完美替换为你提供的国内免翻墙网易云直链
  const audioUrl = 'https://m804.music.126.net/20260612004620/3785a501f258470f53e79c2309b71104/jdyyaac/obj/w5rDlsOJwrLDjj7CmsOj/28482114573/469d/478c/fd27/6597efb87ba9086b96a30a52038e8fd6.m4a?vuutv=cfVmw8WMH9S5RFbZu3dV78cHSBGSbOlhCnnn3j6uLujrhO/JFtm0Ej9Iq6BQoDzPQGO8TcGPUjC9N3ByAGQxr/nvBiv6jJpGHCRNVm7fP0U=&authSecret=0000019eb77cf54910f40a3b237f1093&cdntag=bWFyaz1vc193ZWIscXVhbGl0eV9leGhpZ2g';

  const soundRef = useRef(null);
  const isTriggered = useRef(false); // 严格单次触发锁

  useEffect(() => {
    // App 被拉起来的瞬间，直接无视锁屏，全速开轰
    const clearLockAndPlay = async () => {
      if (isTriggered.current) return;
      isTriggered.current = true;

      try {
        // 1. 强行点亮屏幕，保持硬件唤醒（像素级模仿微信亮屏）
        await activateKeepAwakeAsync();

        // 2. 音频底层最高优先级配置：锁屏后台不准静音
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true, 
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          playsInSilentModeIOS: true,
          shouldRouteThroughEarpieceAndroid: false,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        });

        // 3. 触发强烈的间歇性连震
        Vibration.cancel();
        Vibration.vibrate([0, 800, 400, 800, 400], true);

        // 4. 清理旧实例，直接加载新音频
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { 
            shouldPlay: true, 
            isLooping: true, // 无限循环
            volume: 1.0 
          }
        );
        soundRef.current = sound;

      } catch (error) {
        console.log("国内直链加载或启动失败:", error);
      }
    };

    clearLockAndPlay();

    return () => {
      // 划掉或关闭 App 时瞬间释放所有硬件资源，不留垃圾进程
      Vibration.cancel();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // 纯原生提示
  const showNotice = () => {
    Alert.alert(
      "注意",
      "请确保红米系统已放行：\n1. 锁屏显示\n2. 后台弹出界面\n3. 省电策略->无限制",
      [{ text: "确定" }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: 120, paddingLeft: 25 }}>
      <Text style={{ color: '#00FF00', fontSize: 16, fontWeight: 'bold', marginBottom: 20 }}>
        ⚡ 充电警报全面屏接管系统（国内节点版）
      </Text>
      
      <Text style={{ color: '#ffffff', marginBottom: 40, fontSize: 14, lineHeight: 22 }}>
        已换用国内 CDN 音乐直链，免翻墙，加载速度极快。{"\n"}
        启动后将无视锁屏持续轰炸，直至你划掉应用。
      </Text>

      <View style={{ width: 120 }}>
        <Button title="注意" onPress={showNotice} color="#FF3B30" />
      </View>
    </View>
  );
}