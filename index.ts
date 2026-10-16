import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

// Both run headless (no screen mounted), so they register here at startup.
import '@/lib/background';
import { widgetTaskHandler } from '@/widget/agenda';

registerWidgetTaskHandler(widgetTaskHandler);
