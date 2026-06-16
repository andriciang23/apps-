import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="drink/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Drink Detail',
            headerBackTitle: 'Back',
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}
