import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthPage } from '@/components/month-page';
import { MONTH_COUNT, indexOf } from '@/lib/dates';
import { useColors } from '@/lib/theme';

const MONTH_INDEXES = Array.from({ length: MONTH_COUNT }, (_, i) => i);

export default function Calendar() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const list = useRef<FlatList<number>>(null);
  const todayIndex = indexOf(new Date());

  const go = (index: number) => {
    if (index >= 0 && index < MONTH_COUNT) list.current?.scrollToIndex({ index, animated: true });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {height > 0 && (
          <FlatList
            ref={list}
            data={MONTH_INDEXES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={String}
            initialScrollIndex={todayIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            renderItem={({ item }) => (
              <MonthPage index={item} width={width} height={height} onGo={go} todayIndex={todayIndex} />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
