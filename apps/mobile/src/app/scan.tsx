import { Redirect, useLocalSearchParams } from 'expo-router';

/** Native system surfaces enter the existing scanner through this stable route. */
export default function SystemScannerEntry() {
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  return <Redirect href={{ pathname: '/', params: entry ? { entry } : {} }} />;
}
